import React, { useState, useEffect } from 'react';
import {
    Search, Banknote, CreditCard, Wallet, TrendingUp, Clock,
    ArrowUpRight, CheckCircle, AlertCircle, X, Download, Plus, Trash2, ArrowLeft, ChevronRight, Loader2
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';
import FeeReceipt from './FeeReceipt';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
interface Student {
    id: string;
    name: string;
    class: string;
    balance: number;
    parentPhone: string;
}

interface Transaction {
    id: string;
    studentId: string;
    studentName?: string;
    amount: number;
    date: string;
    type: string;
    method?: string;
    reference?: string;
}

interface FeesProps {
    currentUser?: {
        id: string;
        school_id: string;
        role: 'admin' | 'teacher';
    };
}

// --- Fetch Functions ---
const fetchSchoolInfo = async (schoolId: string) => {
    const { data } = await supabase.from('schools').select('*').eq('id', schoolId).single();
    return data;
};

const fetchStudents = async (schoolId: string) => {
    const { data, error } = await supabase.from('students').select('*').eq('school_id', schoolId);
    if (error) throw error;
    return (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        balance: s.balance,
        parentPhone: s.parent_phone
    })) as Student[];
};

const fetchTransactions = async (schoolId: string, term?: string, year?: string) => {
    let query = supabase
        .from('transactions')
        .select('*, students(name)')
        .eq('school_id', schoolId);

    if (term) query = query.eq('term', term);
    if (year) query = query.eq('academic_year', year);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((t: any) => ({
        id: t.id,
        studentId: t.student_id,
        studentName: t.students?.name || 'Unknown',
        amount: t.amount,
        date: t.date,
        type: t.type,
        method: t.method,
        reference: t.reference
    })) as Transaction[];
};

const fetchFeeStructure = async (schoolId: string, term?: string, year?: string) => {
    let query = supabase.from('fee_structure').select('*').eq('school_id', schoolId);

    if (term) query = query.eq('term', term);
    if (year) query = query.eq('academic_year', year);

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
};

const fetchClasses = async (schoolId: string) => {
    const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name');
    return data || [];
};


// --- Main Component ---
const Fees: React.FC<FeesProps> = ({ currentUser }) => {
    const { formatAmount, currency } = useCurrency();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'analytics'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'owing'>('all');
    const [receiptData, setReceiptData] = useState<any>(null);
    const [selectedFeeClass, setSelectedFeeClass] = useState<string>('General');
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false); // Mobile Detail View State
    const [analyticsStartDate, setAnalyticsStartDate] = useState<string>(
        new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
    );
    const [analyticsEndDate, setAnalyticsEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

    // Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isAddFeeModalOpen, setIsAddFeeModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const schoolId = currentUser?.school_id;

    // --- Queries ---
    const { data: students = [] } = useQuery({
        queryKey: ['students', schoolId],
        queryFn: () => fetchStudents(schoolId!),
        enabled: !!schoolId
    });

    const { data: schoolInfo } = useQuery({
        queryKey: ['schoolInfo', schoolId],
        queryFn: () => fetchSchoolInfo(schoolId!),
        enabled: !!schoolId
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ['transactions', schoolId, schoolInfo?.current_term, schoolInfo?.academic_year],
        queryFn: () => fetchTransactions(schoolId!, schoolInfo?.current_term, schoolInfo?.academic_year),
        enabled: !!schoolId && !!schoolInfo
    });

    const { data: feeStructure = [] } = useQuery({
        queryKey: ['feeStructure', schoolId, schoolInfo?.current_term, schoolInfo?.academic_year],
        queryFn: () => fetchFeeStructure(schoolId!, schoolInfo?.current_term, schoolInfo?.academic_year),
        enabled: !!schoolId && !!schoolInfo // Wait for school config
    });

    const { data: classes = [] } = useQuery({
        queryKey: ['feeClasses', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId
    });



    // --- Mutations ---
    const paymentMutation = useMutation({
        mutationFn: async ({ student, paymentData }: { student: Student, paymentData: any }) => {
            const newTransaction = {
                school_id: schoolId,
                student_id: student.id,
                amount: Number(paymentData.amount),
                date: paymentData.date,
                type: 'Tuition Fee Payment',
                method: paymentData.method,
                reference: paymentData.reference,
                term: schoolInfo?.current_term,
                academic_year: schoolInfo?.academic_year
            };

            const { data: insertedTrx, error: trxError } = await supabase
                .from('transactions')
                .insert([newTransaction])
                .select()
                .single();

            if (trxError) throw trxError;

            const previousBalance = student.balance;
            // Allow negative balance (credit) if overpayment
            const newBalance = previousBalance - Number(paymentData.amount);

            const { error: updateError } = await supabase
                .from('students')
                .update({ balance: newBalance })
                .eq('id', student.id);

            if (updateError) throw updateError;

            return {
                schoolName: schoolInfo?.name || 'School Name',
                schoolLogo: schoolInfo?.logo_url,
                schoolAddress: schoolInfo?.address,
                schoolPhone: schoolInfo?.phone,
                schoolEmail: schoolInfo?.email,
                studentName: student.name,
                studentClass: student.class,
                studentId: student.id,
                transactionId: insertedTrx.id,
                date: paymentData.date,
                amount: Number(paymentData.amount),
                method: paymentData.method,
                reference: paymentData.reference,
                previousBalance: previousBalance,
                newBalance: newBalance,
                type: 'Tuition Fee Payment'
            };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['transactions', schoolId] });
            // Note: We don't close modal yet, we wait for user to click "Generate Receipt" or "Close" in the modal's success state
        },
        onError: (error: any) => {
            alert(`Payment failed: ${error.message}`);
        }
    });

    const addFeeMutation = useMutation({
        mutationFn: async (feeData: any) => {
            const feesToInsert = [];
            if (feeData.applyToAll) {
                feesToInsert.push({
                    school_id: schoolId,
                    name: feeData.name,
                    amount: Number(feeData.amount),
                    target_class: null,
                    term: schoolInfo?.current_term,
                    academic_year: schoolInfo?.academic_year
                });
            } else {
                if (!feeData.selectedClasses || feeData.selectedClasses.length === 0) throw new Error("Please select at least one class.");
                feeData.selectedClasses.forEach((cls: string) => {
                    feesToInsert.push({
                        school_id: schoolId,
                        name: feeData.name,
                        amount: Number(feeData.amount),
                        target_class: cls,
                        term: schoolInfo?.current_term,
                        academic_year: schoolInfo?.academic_year
                    });
                });
            }

            const { error } = await supabase.from('fee_structure').insert(feesToInsert);
            if (error) throw error;

            // Auto-update student balances
            if (feeData.applyToAll) {
                await supabase.rpc('add_fee_to_students', { p_school_id: schoolId, p_amount: Number(feeData.amount), p_target_class: null });
            } else {
                await Promise.all(feeData.selectedClasses.map((cls: string) =>
                    supabase.rpc('add_fee_to_students', { p_school_id: schoolId, p_amount: Number(feeData.amount), p_target_class: cls })
                ));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feeStructure', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            setIsAddFeeModalOpen(false);
            alert('Fee item(s) added successfully!');
        },
        onError: (error: any) => {
            alert(`Failed to add fee item: ${error.message}`);
        }
    });

    const deleteFeeMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('fee_structure').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feeStructure', schoolId] });
        },
        onError: (error: any) => {
            alert(`Failed to delete: ${error.message}`);
        }
    });

    const deleteTransactionMutation = useMutation({
        mutationFn: async (transaction: Transaction) => {
            // --- SECURITY CHECK: Don't allow double reversals ---
            if (transaction.type.includes('(REVERSED)')) {
                throw new Error("This transaction has already been reversed.");
            }

            // 1. Mark the ORIGINAL transaction as reversed in its type
            const { error: updateOrigError } = await supabase
                .from('transactions')
                .update({ type: `${transaction.type} (REVERSED)` })
                .eq('id', transaction.id);

            if (updateOrigError) throw updateOrigError;

            // 2. Create a NEW reversal record
            const reversalTransaction = {
                school_id: schoolId,
                student_id: transaction.studentId,
                amount: -Math.abs(transaction.amount),
                date: new Date().toISOString().split('T')[0],
                type: 'Payment Reversal',
                method: transaction.method,
                reference: `Reversal of ${transaction.id.slice(0, 8)}...`,
                term: schoolInfo?.current_term,
                academic_year: schoolInfo?.academic_year
            };

            const { error: insertError } = await supabase
                .from('transactions')
                .insert([reversalTransaction]);

            if (insertError) throw insertError;

            // 3. Adjust student balance (add the money back to debt)
            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('balance')
                .eq('id', transaction.studentId)
                .single();

            if (studentError) throw studentError;

            const newBalance = (student.balance || 0) + Math.abs(transaction.amount);

            const { error: updateError } = await supabase
                .from('students')
                .update({ balance: newBalance })
                .eq('id', transaction.studentId);

            if (updateError) throw updateError;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            alert('Payment successfully REVERSED and student balance restored.');
        },
        onError: (error: any) => {
            alert(`Reversal Error: ${error.message}`);
        }
    });

    // --- Handlers ---
    const handlePayment = async (paymentData: any) => {
        if (!selectedStudent) return null;
        return await paymentMutation.mutateAsync({ student: selectedStudent, paymentData });
    };

    const handleAddFeeItem = (feeData: any) => addFeeMutation.mutate(feeData);

    const handleDeleteFeeItem = (id: string) => {
        if (!confirm('Are you sure you want to delete this fee item?')) return;
        deleteFeeMutation.mutate(id);
    };

    const openPaymentModal = (student: Student) => {
        setSelectedStudent(student);
        setIsPaymentModalOpen(true);
    };

    // Filter Logic
    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesClass = selectedClassFilter === 'all' || s.class === selectedClassFilter;

        let matchesStatus = true;
        if (filterStatus === 'owing') matchesStatus = s.balance > 0;
        if (filterStatus === 'paid') matchesStatus = s.balance <= 0;

        return matchesSearch && matchesStatus && matchesClass;
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Stats
    const totalOutstanding = students.reduce((sum, s) => sum + s.balance, 0);
    const totalCollected = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpected = totalCollected + totalOutstanding;


    return (
        <div className="p-4 md:p-8 space-y-4 md:space-y-8 relative h-full pb-20 md:pb-0 overflow-y-auto">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">Fee Management</h1>
                    <p className="text-slate-500 text-xs md:text-sm">Track collections, monitor debtors, and process payments.</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex w-full md:w-auto bg-white p-1 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Overview & Payments
                    </button>
                    <button
                        onClick={() => setActiveTab('structure')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'structure' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Fee Structure
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Analytics & Reports
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-2 md:mb-4">
                                <div className="p-2 md:p-3 bg-blue-50 rounded-xl text-blue-600">
                                    <Wallet className="h-4 w-4 md:h-6 md:w-6" />
                                </div>
                                <span className="bg-blue-50 text-blue-700 text-[10px] md:text-xs font-bold px-2 py-1 rounded-full">Total Bills</span>
                            </div>
                            <p className="text-slate-500 text-xs md:text-sm font-medium">Total Expected</p>
                            <h3 className="text-lg md:text-2xl font-bold text-slate-800">{formatAmount(totalExpected)}</h3>
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-2 md:mb-4">
                                <div className="p-2 md:p-3 bg-green-50 rounded-xl text-green-600">
                                    <Banknote className="h-4 w-4 md:h-6 md:w-6" />
                                </div>
                                <span className="bg-green-50 text-green-700 text-[10px] md:text-xs font-bold px-2 py-1 rounded-full">Collected</span>
                            </div>
                            <p className="text-slate-500 text-xs md:text-sm font-medium">Total Received</p>
                            <h3 className="text-lg md:text-2xl font-bold text-green-600">{formatAmount(totalCollected)}</h3>
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 col-span-2 md:col-span-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2 md:mb-4">
                                <div className="p-2 md:p-3 bg-red-50 rounded-xl text-red-600">
                                    <AlertCircle className="h-4 w-4 md:h-6 md:w-6" />
                                </div>
                                <button
                                    onClick={() => setIsHistoryModalOpen(true)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                                >
                                    <Clock className="h-3 w-3" /> View History
                                </button>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs md:text-sm font-medium">Outstanding Debt</p>
                                <h3 className="text-lg md:text-2xl font-bold text-red-600">{formatAmount(totalOutstanding)}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Fee Table */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
                        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h3 className="font-bold text-lg text-slate-800">Student Fee List</h3>

                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-start sm:items-center">
                                {/* Class Filter */}
                                <select
                                    value={selectedClassFilter}
                                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-auto"
                                >
                                    <option value="all">All Classes</option>
                                    {classes.map((cls: any) => (
                                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                                    ))}
                                </select>

                                {/* Status Filters */}
                                <div className="flex bg-slate-100 p-1 rounded-lg self-stretch sm:self-auto">
                                    {['all', 'owing', 'paid'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setFilterStatus(status as any)}
                                            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${filterStatus === status
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative flex-1 sm:flex-none w-full sm:w-auto">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search student..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-64 text-sm"
                                    />
                                </div>

                                <button
                                    onClick={() => {
                                        const printContent = `
                                            <html>
                                                <head>
                                                    <title>Debtor List - ${selectedClassFilter}</title>
                                                    <style>
                                                        body { font-family: sans-serif; padding: 20px; }
                                                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                                        th { background-color: #f4f4f4; }
                                                        .header { text-align: center; margin-bottom: 30px; }
                                                        .summary { margin-top: 20px; font-weight: bold; }
                                                    </style>
                                                </head>
                                                <body>
                                                    <div class="header">
                                                        <h1>Debtor / Payment List</h1>
                                                        <p>Class: ${selectedClassFilter === 'all' ? 'All Classes' : selectedClassFilter} | Status: ${filterStatus.toUpperCase()}</p>
                                                        <p>Date: ${new Date().toLocaleDateString()}</p>
                                                    </div>
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>Student Name</th>
                                                                <th>Class</th>
                                                                <th>Balance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            ${filteredStudents.map(s => `
                                                                <tr>
                                                                    <td>${s.name}</td>
                                                                    <td>${s.class}</td>
                                                                    <td>${formatAmount(s.balance)}</td>
                                                                </tr>
                                                            `).join('')}
                                                        </tbody>
                                                    </table>
                                                    <div class="summary">
                                                        Total Outstanding in List: ${formatAmount(filteredStudents.reduce((sum, s) => sum + Math.max(0, s.balance), 0))}
                                                    </div>
                                                </body>
                                            </html>
                                        `;
                                        const win = window.open('', '_blank');
                                        win?.document.write(printContent);
                                        win?.document.close();
                                        win?.print();
                                    }}
                                    className="bg-white border border-slate-300 p-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                                    title="Print Current List"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map(student => {
                                    const studentPaid = transactions
                                        .filter(t => t.studentId === student.id)
                                        .reduce((sum, t) => sum + t.amount, 0);
                                    const totalBilled = student.balance + studentPaid;

                                    return (
                                        <div key={student.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-slate-900">{student.name}</p>
                                                    <p className="text-xs text-slate-500">Class: {student.class}</p>
                                                </div>
                                                <div className="text-right">
                                                    {student.balance > 0 ? (
                                                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold border border-red-100">
                                                            <AlertCircle className="h-3 w-3" /> Due: {formatAmount(student.balance)}
                                                        </span>
                                                    ) : student.balance < 0 ? (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-100">
                                                            Credit: {formatAmount(Math.abs(student.balance))}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold border border-green-100">
                                                            <CheckCircle className="h-3 w-3" /> Paid
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-2 rounded-lg">
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-500 font-bold">Total Bill</p>
                                                    <p className="font-medium text-slate-800">{formatAmount(totalBilled)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-500 font-bold">Paid So Far</p>
                                                    <p className="font-medium text-green-600">{formatAmount(studentPaid)}</p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => openPaymentModal(student)}
                                                className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                                            >
                                                <CreditCard className="h-4 w-4" /> Record Payment
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-slate-500 text-sm">No students found.</div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="overflow-x-auto hidden md:block">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Billed</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Paid</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map(student => {
                                            // Calculate paid amount dynamically based on transactions
                                            const studentPaid = transactions
                                                .filter(t => t.studentId === student.id)
                                                .reduce((sum, t) => sum + t.amount, 0);

                                            // Total Billed = Current Balance + Amount Paid
                                            const totalBilled = student.balance + studentPaid;

                                            return (
                                                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{student.class}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">{formatAmount(totalBilled)}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-green-600">{formatAmount(studentPaid)}</td>
                                                    <td className="px-6 py-4">
                                                        {student.balance > 0 ? (
                                                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-red-100">
                                                                Owing {formatAmount(student.balance)}
                                                            </span>
                                                        ) : student.balance < 0 ? (
                                                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-blue-100">
                                                                Credit {formatAmount(Math.abs(student.balance))}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-100">
                                                                <CheckCircle className="h-3 w-3" /> Paid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {student.balance > 0 && (
                                                            <button
                                                                onClick={() => openPaymentModal(student)}
                                                                className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm inline-flex items-center gap-1"
                                                            >
                                                                <CreditCard className="h-3 w-3" /> Pay
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                No students found matching your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'structure' ? (
                <div className="flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-right-4 duration-300 h-[calc(100vh-12rem)]">

                    {/* Class Selector Sidebar */}
                    <div className={`w-full md:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col ${isMobileDetailOpen ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm">
                            Manage By Class
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-1">
                            <button
                                onClick={() => { setSelectedFeeClass('General'); setIsMobileDetailOpen(true); }}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${selectedFeeClass === 'General'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 opacity-50" />
                                    General Structure
                                </span>
                                {selectedFeeClass === 'General' ? (
                                    <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-300 md:hidden" />
                                )}
                            </button>

                            <div className="py-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Classes</div>

                            {classes.map((cls: any) => (
                                <button
                                    key={cls.id}
                                    onClick={() => { setSelectedFeeClass(cls.name); setIsMobileDetailOpen(true); }}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-between ${selectedFeeClass === cls.name
                                        ? 'bg-primary-50 text-primary-700 font-bold border border-primary-100'
                                        : 'text-slate-600 hover:bg-slate-50 group'
                                        }`}
                                >
                                    <span>{cls.name}</span>
                                    <div className="flex items-center gap-2">
                                        {feeStructure.filter((f: any) => f.target_class === cls.name).length > 0 && (
                                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-md font-bold group-hover:bg-white transition-colors">
                                                {feeStructure.filter((f: any) => f.target_class === cls.name).length}
                                            </span>
                                        )}
                                        <ChevronRight className={`h-4 w-4 md:hidden ${selectedFeeClass === cls.name ? 'text-primary-400' : 'text-slate-300'}`} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fee List Area */}
                    <div className={`
                        flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col
                        ${isMobileDetailOpen ? 'fixed inset-0 z-50 rounded-none border-0' : 'hidden md:flex'}
                        md:static md:flex md:border md:rounded-xl md:shadow-sm
                    `}>
                        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 safe-area-top">
                            <div className="flex items-center gap-3">
                                {/* Mobile Back Button */}
                                <button
                                    onClick={() => setIsMobileDetailOpen(false)}
                                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>

                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">
                                        {selectedFeeClass === 'General' ? 'General Fee Structure' : `${selectedFeeClass} Fees`}
                                    </h3>
                                    <p className="text-slate-500 text-xs hidden md:block">
                                        {selectedFeeClass === 'General'
                                            ? 'Fees applied to every student in the school.'
                                            : `Managing fees specific to ${selectedFeeClass} + General fees.`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddFeeModalOpen(true)}
                                className="bg-primary-600 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm shadow-primary-200"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="hidden md:inline">{selectedFeeClass === 'General' ? 'Add General Fee' : `Add Fee for ${selectedFeeClass}`}</span>
                                <span className="md:hidden">Add Fee</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 md:p-6 space-y-6 bg-slate-50/30">

                            {/* General Fees Section */}
                            {(selectedFeeClass === 'General' || feeStructure.some((f: any) => f.target_class === null)) && (
                                <div className="space-y-3">
                                    {selectedFeeClass !== 'General' && (
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                                            <Wallet className="h-3 w-3" /> General Fees
                                        </div>
                                    )}

                                    {feeStructure.filter((f: any) => f.target_class === null).length > 0 ? (
                                        feeStructure.filter((f: any) => f.target_class === null).map((fee: any) => (
                                            <div key={fee.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 min-w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                        <Wallet className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm md:text-base">{fee.name}</p>
                                                        <p className="text-xs text-slate-400">Universal</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 md:gap-6">
                                                    <span className="font-bold text-slate-800 text-base md:text-lg">{formatAmount(fee.amount)}</span>
                                                    <button
                                                        onClick={() => handleDeleteFeeItem(fee.id)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Fee"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm bg-slate-50">
                                            No general fees found.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Specific Fees Section */}
                            {selectedFeeClass !== 'General' && (
                                <div className="space-y-3 pt-6 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-xs font-bold text-primary-600 uppercase tracking-wider mb-2 px-1">
                                        <TrendingUp className="h-3 w-3" /> {selectedFeeClass} Only
                                    </div>

                                    {feeStructure.filter((f: any) => f.target_class === selectedFeeClass).length > 0 ? (
                                        feeStructure.filter((f: any) => f.target_class === selectedFeeClass).map((fee: any) => (
                                            <div key={fee.id} className="group flex items-center justify-between p-4 bg-primary-50/40 border border-primary-100 rounded-xl hover:border-primary-300 transition-all shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 min-w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                                                        <Banknote className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm md:text-base">{fee.name}</p>
                                                        <p className="text-xs text-primary-600 font-medium">Class Specific</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 md:gap-6">
                                                    <span className="font-bold text-primary-700 text-base md:text-lg">{formatAmount(fee.amount)}</span>
                                                    <button
                                                        onClick={() => handleDeleteFeeItem(fee.id)}
                                                        className="p-2 text-primary-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Fee"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 border-2 border-dashed border-primary-100 bg-primary-50/20 rounded-xl text-primary-400 text-sm">
                                            No specific fees for {selectedFeeClass}.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary Footer */}
                            <div className="mt-8 pt-6 pb-20 md:pb-8 border-t border-slate-100">
                                <div className="flex justify-between items-center text-sm p-4 bg-slate-900 text-white rounded-xl shadow-lg">
                                    <span className="font-medium opacity-80">Total for {selectedFeeClass}</span>
                                    <span className="text-xl font-bold">
                                        {formatAmount(
                                            feeStructure
                                                .filter((f: any) => f.target_class === null || f.target_class === (selectedFeeClass === 'General' ? null : selectedFeeClass))
                                                .reduce((sum: number, f: any) => sum + f.amount, 0)
                                        )}
                                    </span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            ) : activeTab === 'analytics' ? (
                <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Financial Reports</h3>
                                <p className="text-slate-500 text-sm">Analyze payments and outstanding balances over time.</p>
                            </div>
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-slate-600">From:</label>
                                    <input
                                        type="date"
                                        value={analyticsStartDate}
                                        onChange={(e) => setAnalyticsStartDate(e.target.value)}
                                        className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-primary-600 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-slate-600">To:</label>
                                    <input
                                        type="date"
                                        value={analyticsEndDate}
                                        onChange={(e) => setAnalyticsEndDate(e.target.value)}
                                        className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-primary-600 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const startMatch = analyticsStartDate ? new Date(analyticsStartDate).getTime() : 0;
                            const endMatch = analyticsEndDate ? new Date(analyticsEndDate).getTime() + (24 * 60 * 60 * 1000) - 1 : Infinity;

                            const rangeTransactions = transactions.filter(t => {
                                const tDate = new Date(t.date).getTime();
                                return tDate >= startMatch && tDate <= endMatch;
                            });

                            const totalRevenueInRange = rangeTransactions.reduce((sum, t) => sum + t.amount, 0);
                            const uniqueStudentsCount = new Set(rangeTransactions.map(t => t.studentId)).size;

                            return (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-500">Revenue in Range</p>
                                                <p className="text-2xl font-bold text-green-600">{formatAmount(totalRevenueInRange)}</p>
                                            </div>
                                            <div className="bg-green-100 text-green-600 p-3 rounded-full">
                                                <TrendingUp className="h-6 w-6" />
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-500">Students Paid in Range</p>
                                                <p className="text-2xl font-bold text-slate-800">{uniqueStudentsCount}</p>
                                            </div>
                                            <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
                                                <Banknote className="h-6 w-6" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                                        <h4 className="font-bold text-slate-800">Transactions in Date Range</h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const headers = ['Date', 'Student Name', 'Type', 'Amount', 'Method', 'Reference'];
                                                    const rows = rangeTransactions.map(t => [
                                                        new Date(t.date).toLocaleDateString(),
                                                        `"${(t.studentName || 'Unknown').replace(/"/g, '""')}"`,
                                                        `"${(t.type || '').replace(/"/g, '""')}"`,
                                                        t.amount,
                                                        `"${(t.method || '').replace(/"/g, '""')}"`,
                                                        `"${(t.reference || '').replace(/"/g, '""')}"`
                                                    ]);
                                                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                                    const link = document.createElement('a');
                                                    const url = URL.createObjectURL(blob);
                                                    link.setAttribute('href', url);
                                                    link.setAttribute('download', `financial_report_${analyticsStartDate || 'start'}_to_${analyticsEndDate || 'end'}.csv`);
                                                    link.style.visibility = 'hidden';
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }}
                                                className="flex items-center gap-2 text-xs font-bold bg-white text-slate-700 hover:text-primary-600 px-3 py-1.5 rounded border border-slate-200 shadow-sm transition-colors"
                                            >
                                                <Download className="h-4 w-4" /> CSV
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const printContent = `
                                                        <html>
                                                            <head>
                                                                <title>Financial Report</title>
                                                                <style>
                                                                    body { font-family: sans-serif; padding: 20px; }
                                                                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                                                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                                                                    th { background-color: #f8f9fa; }
                                                                    .header { text-align: center; margin-bottom: 20px; }
                                                                    .summary-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                                                                </style>
                                                            </head>
                                                            <body>
                                                                <div class="header">
                                                                    <h1>${schoolInfo?.name || 'School'} Financial Report</h1>
                                                                    <p>Period: ${analyticsStartDate} to ${analyticsEndDate}</p>
                                                                </div>
                                                                <div class="summary-box">
                                                                    <p>Total Revenue in Period: ${formatAmount(totalRevenueInRange)}</p>
                                                                    <p>Total Transactions: ${rangeTransactions.length}</p>
                                                                </div>
                                                                <table>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Date</th>
                                                                            <th>Student</th>
                                                                            <th>Payment Type</th>
                                                                            <th>Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        ${rangeTransactions.map(t => `
                                                                            <tr>
                                                                                <td>${new Date(t.date).toLocaleDateString()}</td>
                                                                                <td>${t.studentName}</td>
                                                                                <td>${t.type}</td>
                                                                                <td>${formatAmount(t.amount)}</td>
                                                                            </tr>
                                                                        `).join('')}
                                                                    </tbody>
                                                                </table>
                                                            </body>
                                                        </html>
                                                    `;
                                                    const win = window.open('', '_blank');
                                                    win?.document.write(printContent);
                                                    win?.document.close();
                                                    win?.print();
                                                }}
                                                className="flex items-center gap-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded shadow-sm transition-colors"
                                            >
                                                Print Paper Report
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto mb-10">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Name</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {rangeTransactions.length > 0 ? (
                                                    rangeTransactions.map((t, idx) => (
                                                        <tr key={t.id || idx} className="hover:bg-slate-50 group">
                                                            <td className="px-4 py-3 text-sm text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
                                                            <td className="px-4 py-3 text-sm font-bold text-slate-800">{t.studentName}</td>
                                                            <td className="px-4 py-3 text-sm text-slate-500">{t.type}</td>
                                                            <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{formatAmount(t.amount)}</td>
                                                            <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(`Are you sure you want to REVERSE this payment of ${formatAmount(t.amount)} for ${t.studentName}? This will add the amount back to their outstanding balance.`)) {
                                                                            deleteTransactionMutation.mutate(t);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Reverse Transaction"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No transactions found for this date range.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div>
                                                <h4 className="font-bold text-lg text-slate-800">Class-Based Debtor Report</h4>
                                                <p className="text-slate-500 text-sm">Select a class to generate a full debt report.</p>
                                            </div>
                                            <div className="flex gap-3 w-full md:w-auto">
                                                <select
                                                    value={selectedClassFilter}
                                                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                                                    className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                                >
                                                    <option value="all">All Classes</option>
                                                    {classes.map((cls: any) => (
                                                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        const debtorsList = students.filter(s =>
                                                            s.balance > 0 &&
                                                            (selectedClassFilter === 'all' || s.class === selectedClassFilter)
                                                        );

                                                        const reportHtml = `
                                                            <html>
                                                                <head>
                                                                    <title>Official Debtor Report - ${selectedClassFilter}</title>
                                                                    <style>
                                                                        body { font-family: sans-serif; padding: 40px; color: #1a1a1a; }
                                                                        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                                                                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                                                        th { text-align: left; padding: 12px; border: 1px solid #ddd; background: #eee; font-size: 13px; }
                                                                        td { padding: 12px; border: 1px solid #ddd; font-size: 13px; }
                                                                        .total { margin-top: 30px; text-align: right; font-weight: bold; font-size: 16px; }
                                                                    </style>
                                                                </head>
                                                                <body>
                                                                    <div class="header">
                                                                        <h1>${schoolInfo?.name || 'School'} Debtor Report</h1>
                                                                        <p>Class: ${selectedClassFilter === 'all' ? 'All Classes' : selectedClassFilter}</p>
                                                                        <p>Date: ${new Date().toLocaleDateString()}</p>
                                                                    </div>
                                                                    <table>
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Student Name</th>
                                                                                <th>Class</th>
                                                                                <th>Outstanding Balance (${currency.code})</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            ${debtorsList.map(s => `
                                                                                <tr>
                                                                                    <td>${s.name}</td>
                                                                                    <td>${s.class}</td>
                                                                                    <td>${s.balance.toFixed(2)}</td>
                                                                                </tr>
                                                                            `).join('')}
                                                                        </tbody>
                                                                    </table>
                                                                    <div class="total">
                                                                        Total Arrears: ${currency.code} ${debtorsList.reduce((sum, s) => sum + s.balance, 0).toFixed(2)}
                                                                    </div>
                                                                </body>
                                                            </html>
                                                        `;
                                                        const win = window.open('', '_blank');
                                                        win?.document.write(reportHtml);
                                                        win?.document.close();
                                                        win?.print();
                                                    }}
                                                    className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-sm transition-all"
                                                >
                                                    Print Report
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            ) : null}

            {/* --- PAYMENT MODAL --- */}
            {isPaymentModalOpen && selectedStudent && (
                <PaymentModal
                    student={selectedStudent}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onConfirm={handlePayment}
                    onGenerateReceipt={(data) => {
                        setIsPaymentModalOpen(false);
                        setSelectedStudent(null);
                        setReceiptData(data);
                    }}
                />
            )}

            {/* --- RECEIPT MODAL --- */}
            {receiptData && (
                <FeeReceipt
                    data={receiptData}
                    onClose={() => setReceiptData(null)}
                />
            )}

            {/* --- ADD FEE MODAL --- */}
            {isAddFeeModalOpen && (
                <AddFeeItemModal
                    onClose={() => setIsAddFeeModalOpen(false)}
                    onConfirm={handleAddFeeItem}
                    classes={classes}
                    initialClass={selectedFeeClass}
                />
            )}

            {/* --- TRANSACTION HISTORY MODAL --- */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Recent Transactions</h3>
                                <p className="text-xs text-slate-500 font-medium">Review and correct payment entries.</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Student</th>
                                            <th className="px-6 py-4">Method</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {transactions.slice(0, 50).map((t) => {
                                            const isReversalRecord = t.type === 'Payment Reversal' || t.amount < 0;
                                            const wasOriginallyReversed = t.type.includes('(REVERSED)');
                                            return (
                                                <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors group ${isReversalRecord ? 'bg-red-50/30' : wasOriginallyReversed ? 'bg-slate-100/50 opacity-60' : ''}`}>
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4">
                                                        <p className={`text-sm font-bold ${isReversalRecord ? 'text-red-700' : wasOriginallyReversed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.studentName}</p>
                                                        <p className="text-[10px] text-slate-400 italic font-medium">{t.type}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded ${isReversalRecord ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                                            {t.method || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-black text-sm ${isReversalRecord ? 'text-red-600' : wasOriginallyReversed ? 'text-slate-400' : 'text-green-600'}`}>
                                                        {formatAmount(t.amount)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {(!isReversalRecord && !wasOriginallyReversed) && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Create a REVERSAL entry for this payment of ${formatAmount(t.amount)} for ${t.studentName}?`)) {
                                                                        deleteTransactionMutation.mutate(t);
                                                                    }
                                                                }}
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                                title="Reverse Entry"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {transactions.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold italic">No transactions found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
};

// --- Sub-component: Payment Modal ---
const PaymentModal = ({ student, onClose, onConfirm, onGenerateReceipt }: { student: Student, onClose: () => void, onConfirm: (data: any) => Promise<any>, onGenerateReceipt: (data: any) => void }) => {
    const { formatAmount, currency } = useCurrency();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const result = await onConfirm({ amount, method, date, reference });
        setIsSubmitting(false);
        if (result) {
            setSuccessData(result);
        }
    };

    if (successData) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-center p-8">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Payment Confirmed!</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        Successfully received <span className="font-bold text-slate-700">{currency.code} {amount}</span> from {student.name}.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => onGenerateReceipt(successData)}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Download className="h-5 w-5" /> Generate Receipt
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-white text-slate-500 py-3 rounded-xl font-medium hover:bg-slate-50 border border-slate-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Receive Payment</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Student Info Card */}
                    <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-slate-800">{student.name}</p>
                            <p className="text-xs text-slate-500">{student.class}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Outstanding</p>
                            <p className="font-bold text-red-600">{formatAmount(student.balance)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">{currency.code}</span>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none font-medium"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                            <input
                                required
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm bg-white"
                            >
                                <option>Cash</option>
                                <option>Bank Transfer</option>
                                <option>Mobile Money</option>
                                <option>Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Reference No.</label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                                placeholder="Optional"
                            />
                        </div>
                    </div>


                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-4 bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Processing...' : `Confirm Payment`}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- Sub-component: Add Fee Modal ---
const AddFeeItemModal = ({ onClose, onConfirm, classes, initialClass }: any) => {
    const { currency } = useCurrency();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');

    // Logic to pre-select class if provided
    const isSpecific = initialClass && initialClass !== 'General';
    const [applyToAll, setApplyToAll] = useState(!isSpecific);
    const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
        isSpecific ? new Set([initialClass]) : new Set()
    );

    const toggleClass = (cls: string) => {
        const newSet = new Set(selectedClasses);
        if (newSet.has(cls)) newSet.delete(cls);
        else newSet.add(cls);
        setSelectedClasses(newSet);
    };

    const handleSelectAllClasses = () => {
        if (selectedClasses.size === classes.length) {
            setSelectedClasses(new Set());
        } else {
            setSelectedClasses(new Set(classes.map((c: any) => c.name)));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({ name, amount, applyToAll, selectedClasses: Array.from(selectedClasses) });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Add New Fee Item</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fee Description</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                            placeholder="e.g. Tuition Fee, Exam Fee"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount ({currency.code})</label>
                        <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="radio"
                                checked={applyToAll}
                                onChange={() => setApplyToAll(true)}
                                className="text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium text-slate-800">Apply to All Students</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="radio"
                                checked={!applyToAll}
                                onChange={() => setApplyToAll(false)}
                                className="text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium text-slate-800">Select Specific Classes</span>
                        </div>
                    </div>

                    {!applyToAll && (
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                            <div className="flex justify-end mb-2">
                                <button type="button" onClick={handleSelectAllClasses} className="text-xs text-primary-600 hover:underline font-medium">
                                    {selectedClasses.size === classes.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {classes.map((c: any) => (
                                    <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-50 p-1 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedClasses.has(c.name)}
                                            onChange={() => toggleClass(c.name)}
                                            className="rounded text-primary-600 focus:ring-primary-500"
                                        />
                                        {c.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-sm">Save Fee</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Fees;