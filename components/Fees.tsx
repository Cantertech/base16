import React, { useState, useEffect } from 'react';
import {
    Search, Banknote, CreditCard, Wallet, TrendingUp,
    ArrowUpRight, CheckCircle, AlertCircle, X, Download, Plus
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
    const [activeTab, setActiveTab] = useState<'overview' | 'structure'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'owing'>('all');
    const [receiptData, setReceiptData] = useState<any>(null);

    // Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isAddFeeModalOpen, setIsAddFeeModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.class.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesStatus = true;
        if (filterStatus === 'owing') matchesStatus = s.balance > 0;
        if (filterStatus === 'paid') matchesStatus = s.balance <= 0;

        return matchesSearch && matchesStatus;
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

                        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 col-span-2 md:col-span-1">
                            <div className="flex justify-between items-start mb-2 md:mb-4">
                                <div className="p-2 md:p-3 bg-red-50 rounded-xl text-red-600">
                                    <AlertCircle className="h-4 w-4 md:h-6 md:w-6" />
                                </div>
                                <span className="bg-red-50 text-red-700 text-[10px] md:text-xs font-bold px-2 py-1 rounded-full">Arrears</span>
                            </div>
                            <p className="text-slate-500 text-xs md:text-sm font-medium">Outstanding Debt</p>
                            <h3 className="text-lg md:text-2xl font-bold text-red-600">{formatAmount(totalOutstanding)}</h3>
                        </div>
                    </div>

                    {/* Fee Table */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
                        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h3 className="font-bold text-lg text-slate-800">Student Fee List</h3>

                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                {/* Filters */}
                                <div className="flex bg-slate-100 p-1 rounded-lg self-start">
                                    {['all', 'owing', 'paid'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setFilterStatus(status as any)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${filterStatus === status
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative flex-1 sm:flex-none">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search student or class..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-64 text-sm"
                                    />
                                </div>
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
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800">Current Term Fee Structure</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsAddFeeModalOpen(true)}
                                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" /> Add Fee Item
                            </button>
                        </div>
                    </div>
                    {/* Mobile List View for Fees */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {feeStructure.length > 0 ? (
                            feeStructure.map((fee) => (
                                <div key={fee.id} className="p-4 flex justify-between items-center group">
                                    <div>
                                        <p className="font-bold text-slate-800">{fee.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-100">
                                                {fee.target_class || 'All Students'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-900 text-lg">{fee.amount.toFixed(2)}</p>
                                        <button
                                            onClick={() => handleDeleteFeeItem(fee.id)}
                                            className="text-red-400 text-xs mt-1 hover:text-red-600 block ml-auto"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                No fee structure defined.
                            </div>
                        )}
                    </div>

                    {/* Desktop Table */}
                    <div className="overflow-x-auto hidden md:block">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Fee Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Target Class</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Amount ({currency.code})</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {feeStructure.length > 0 ? (
                                    feeStructure.map((fee) => (
                                        <tr key={fee.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-bold text-slate-800">{fee.name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                                                    {fee.target_class || 'All Students'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">{fee.amount.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteFeeItem(fee.id)}
                                                    className="text-slate-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            No fee structure defined. Click "Add Fee Item" to start.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                />
            )}

        </div>
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
const AddFeeItemModal = ({ onClose, onConfirm, classes }: any) => {
    const { currency } = useCurrency();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [applyToAll, setApplyToAll] = useState(true);
    const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

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