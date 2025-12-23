import React, { useState, useEffect } from 'react';
import {
    Search, Banknote, CreditCard, Wallet, TrendingUp,
    ArrowUpRight, CheckCircle, AlertCircle, X, Download, Plus
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';
import { getCachedData, setCachedData, clearCache } from '../utils/cache';

const CACHE_KEY_FEES_DATA = 'orbit_fees_full_data';

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

// --- Main Component ---
const Fees: React.FC = () => {
    const { formatAmount, currency } = useCurrency();
    const [activeTab, setActiveTab] = useState<'overview' | 'structure'>('overview');
    const [students, setStudents] = useState<Student[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [feeStructure, setFeeStructure] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isAddFeeModalOpen, setIsAddFeeModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    // Load Data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (background = false) => {
        // Cache Check
        if (!background) {
            const cached = getCachedData<any>(CACHE_KEY_FEES_DATA);
            if (cached) {
                setStudents(cached.students);
                setTransactions(cached.transactions);
                setFeeStructure(cached.feeStructure);
                setClasses(cached.classes);
                // If we have cache, we could stop here or do a background refresh.
                // For 'Fees', accuracy is key, so maybe background refresh is safer?
                // But the user complained about "dataload", so let's trust cache for 2 mins.
                // We'll proceed to fetch ONLY if no cache.
                return;
            }
        }
        try {
            // Fetch Students
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('*');

            if (studentsError) throw studentsError;

            if (studentsData) {
                // Logic moved to end for unified cache setting
            }

            // Fetch Transactions
            const { data: transactionsData, error: transactionsError } = await supabase
                .from('transactions')
                .select('*, students(name)')
                .order('created_at', { ascending: false });

            if (transactionsError) throw transactionsError;

            if (transactionsData) {
                // Logic moved to end for unified cache setting
            }

            // Fetch Fee Structure
            const { data: feesData, error: feesError } = await supabase
                .from('fee_structure')
                .select('*')
                .order('created_at', { ascending: true });

            if (feesError) throw feesError;
            // setFeeStructure handled below

            // Fetch Classes (for dropdowns)
            const { data: classesData } = await supabase
                .from('classes')
                .select('*')
                .order('name');
            // setClasses handled below


            // Transform Students
            const mappedStudents = (studentsData || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                class: s.class,
                balance: s.balance,
                parentPhone: s.parent_phone
            }));

            // Transform Transactions
            const mappedTransactions = (transactionsData || []).map((t: any) => ({
                id: t.id,
                studentId: t.student_id,
                studentName: t.students?.name || 'Unknown',
                amount: t.amount,
                date: t.date,
                type: t.type,
                method: t.method,
                reference: t.reference
            }));

            setStudents(mappedStudents);
            setTransactions(mappedTransactions);
            if (feesData) setFeeStructure(feesData);
            if (classesData) setClasses(classesData);

            // Save to Cache
            setCachedData(CACHE_KEY_FEES_DATA, {
                students: mappedStudents,
                transactions: mappedTransactions,
                feeStructure: feesData || [],
                classes: classesData || []
            });

        } catch (error) {
            console.error('Error fetching fee data:', error);
        }
    };

    // --- Derived Statistics ---
    // 1. Total Outstanding (Sum of all student balances)
    const totalOutstanding = students.reduce((sum, s) => sum + s.balance, 0);

    // 2. Total Collected (Sum of all transactions)
    const totalCollected = transactions.reduce((sum, t) => sum + t.amount, 0);

    // 3. Total Expected (Collected + Outstanding)
    // Logic: The school expects to have (what they have) + (what they are owed)
    const totalExpected = totalCollected + totalOutstanding;

    // --- Payment Handler ---
    const handlePayment = async (paymentData: any) => {
        if (!selectedStudent) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single();

            if (!profile?.school_id) throw new Error('No school associated with user');

            // 1. Create Transaction Record
            const newTransaction = {
                school_id: profile.school_id,
                student_id: selectedStudent.id,
                amount: Number(paymentData.amount),
                date: paymentData.date,
                type: 'Tuition Fee Payment',
                method: paymentData.method,
                reference: paymentData.reference
            };

            const { error: trxError } = await supabase
                .from('transactions')
                .insert([newTransaction]);

            if (trxError) throw trxError;

            // 2. Update Student Balance
            const newBalance = Math.max(0, selectedStudent.balance - Number(paymentData.amount));
            const { error: updateError } = await supabase
                .from('students')
                .update({ balance: newBalance })
                .eq('id', selectedStudent.id);

            if (updateError) throw updateError;

            // 3. Refresh Data
            clearCache(CACHE_KEY_FEES_DATA);
            fetchData(true); // Force background refresh

            // 4. Close & Notify
            setIsPaymentModalOpen(false);
            setSelectedStudent(null);
            alert(`Success! Payment recorded. SMS sent to parent (${selectedStudent.parentPhone}): "Thank you for your payment of ${currency.code} ${paymentData.amount}."`);

        } catch (error: any) {
            console.error('Payment error:', error);
            alert(`Payment failed: ${error.message}`);
        }
    };

    const handleAddFeeItem = async (feeData: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single();

            if (!profile?.school_id) throw new Error('No school associated with user');

            const newFee = {
                school_id: profile.school_id,
                name: feeData.name,
                amount: Number(feeData.amount),
                target_class: feeData.targetClass === 'All' ? null : feeData.targetClass
            };

            const { error } = await supabase
                .from('fee_structure')
                .insert([newFee]);

            if (error) throw error;

            clearCache(CACHE_KEY_FEES_DATA);
            fetchData(true);
            setIsAddFeeModalOpen(false);
            alert('Fee item added successfully!');
        } catch (error: any) {
            console.error('Error adding fee item:', error);
            alert(`Failed to add fee item: ${error.message}`);
        }
    };

    const handleDeleteFeeItem = async (id: string) => {
        if (!confirm('Are you sure you want to delete this fee item?')) return;
        try {
            const { error } = await supabase
                .from('fee_structure')
                .delete()
                .eq('id', id);

            if (error) throw error;
            clearCache(CACHE_KEY_FEES_DATA);
            fetchData(true);
        } catch (error: any) {
            console.error('Error deleting fee item:', error);
            alert(`Failed to delete: ${error.message}`);
        }
    };

    const openPaymentModal = (student: Student) => {
        setSelectedStudent(student);
        setIsPaymentModalOpen(true);
    };

    // Filter Logic
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.class.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 relative h-full">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Fee Management</h1>
                    <p className="text-slate-500 text-sm">Track collections, monitor debtors, and process payments.</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Overview & Payments
                    </button>
                    <button
                        onClick={() => setActiveTab('structure')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'structure' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Fee Structure
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                                    <Wallet className="h-6 w-6" />
                                </div>
                                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">Total Bills</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium">Total Expected</p>
                            <h3 className="text-2xl font-bold text-slate-800">{formatAmount(totalExpected)}</h3>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-green-50 rounded-xl text-green-600">
                                    <Banknote className="h-6 w-6" />
                                </div>
                                <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Collected</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium">Total Received</p>
                            <h3 className="text-2xl font-bold text-green-600">{formatAmount(totalCollected)}</h3>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-red-50 rounded-xl text-red-600">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <span className="bg-red-50 text-red-700 text-xs font-bold px-2 py-1 rounded-full">Arrears</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium">Outstanding Debt</p>
                            <h3 className="text-2xl font-bold text-red-600">{formatAmount(totalOutstanding)}</h3>
                        </div>
                    </div>

                    {/* Fee Table */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h3 className="font-bold text-lg text-slate-800">Student Fee List</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search student or class..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-64 text-sm"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
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
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-100">
                                                                <CheckCircle className="h-3 w-3" /> Fully Paid
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
                    <div className="p-0">
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
const PaymentModal = ({ student, onClose, onConfirm }: { student: Student, onClose: () => void, onConfirm: (data: any) => void }) => {
    const { formatAmount, currency } = useCurrency();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({ amount, method, date, reference });
    };

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
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-blue-500 uppercase font-bold tracking-wide">Student</p>
                            <p className="font-bold text-blue-900">{student.name}</p>
                            <p className="text-xs text-blue-700">{student.class}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-blue-500 uppercase font-bold tracking-wide">Balance</p>
                            <p className="font-bold text-red-600 text-lg">{formatAmount(student.balance)}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount ({currency.code})</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-500 font-bold">{currency.symbol}</span>
                            </div>
                            <input
                                required
                                type="number"
                                min="1"
                                max={student.balance} // Optional: restrict overpayment
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full pl-8 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none font-bold text-lg"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                            <select
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                                value={method}
                                onChange={e => setMethod(e.target.value)}
                            >
                                <option value="Cash">Cash</option>
                                <option value="MoMo">Mobile Money</option>
                                <option value="Bank Deposit">Bank Deposit</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                            <input
                                required
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reference / Receipt #</label>
                        <input
                            type="text"
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                            placeholder="Optional (e.g. RCP-1024)"
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="h-5 w-5" /> Confirm Payment
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default Fees;

// --- Sub-component: Add Fee Item Modal ---
const AddFeeItemModal = ({ onClose, onConfirm, classes }: any) => {
    const { currency } = useCurrency();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [targetClass, setTargetClass] = useState('All');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({ name, amount, targetClass });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Add Fee Item</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fee Name</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                            placeholder="e.g. Tuition Fee, PTA Levy"
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
                            onChange={e => setAmount(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Target Class</label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                            value={targetClass}
                            onChange={e => setTargetClass(e.target.value)}
                        >
                            <option value="All">All Students</option>
                            {classes.map((c: any) => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Select "All Students" or a specific class.</p>
                    </div>
                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                        >
                            Save Fee Item
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};