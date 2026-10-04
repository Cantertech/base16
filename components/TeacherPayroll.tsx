import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Search, DollarSign, CheckCircle, AlertCircle, RefreshCw, X, 
    Calendar, CreditCard, ChevronDown, Check, FileText, Send, UserCheck
} from 'lucide-react';
import Loading from './Loading';
import PayslipModal from './PayslipModal';

interface TeacherPayrollProps {
    schoolId: string;
    teachers: any[];
}

interface PayModalState {
    teacher: any;
    baseSalary: number;
    daysAbsent: number;
    absentDeduction: number;
    bonus: number;
    otherDeductions: number;
    paymentMethod: string;
    notes: string;
}

const TeacherPayroll: React.FC<TeacherPayrollProps> = ({ schoolId, teachers }) => {
    const queryClient = useQueryClient();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
    const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
    const [activePayModal, setActivePayModal] = useState<PayModalState | null>(null);

    // 1. Fetch School Settings (Currency, Name, Logo)
    const { data: schoolData } = useQuery({
        queryKey: ['schoolSettings', schoolId],
        queryFn: async () => {
            const { data } = await supabase.from('schools').select('*').eq('id', schoolId).single();
            return data;
        },
        enabled: !!schoolId
    });

    const currencySymbol = schoolData?.currency || 'GH₵';

    // 2. Fetch Payroll Records for Month
    const { data: payrollRecords = [], isLoading } = useQuery({
        queryKey: ['teacherPayroll', schoolId, selectedMonth],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payroll_records')
                .select('*')
                .eq('school_id', schoolId)
                .eq('month', selectedMonth);

            if (error) {
                console.warn('Teacher payroll query notice:', error.message);
                return [];
            }
            return data || [];
        },
        enabled: !!schoolId
    });

    // 3. Fetch Monthly Attendance to cross-reference Absent Days
    const { data: monthlyAttendance = [] } = useQuery({
        queryKey: ['teacherMonthlyAttendanceForPayroll', schoolId, selectedMonth],
        queryFn: async () => {
            const startStr = `${selectedMonth}-01`;
            const [y, m] = selectedMonth.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const endStr = `${selectedMonth}-${lastDay < 10 ? '0' + lastDay : lastDay}`;

            const { data, error } = await supabase
                .from('teacher_attendance')
                .select('teacher_id, status')
                .eq('school_id', schoolId)
                .gte('date', startStr)
                .lte('date', endStr);

            if (error) return [];
            return data || [];
        },
        enabled: !!schoolId
    });

    // Calculate absent days per teacher for this month
    const absentCountMap: Record<string, number> = {};
    monthlyAttendance.forEach((a: any) => {
        if (a.status === 'Absent' && a.teacher_id) {
            absentCountMap[a.teacher_id] = (absentCountMap[a.teacher_id] || 0) + 1;
        }
    });

    // 4. Mark Single Staff as Paid Mutation
    const markAsPaidMutation = useMutation({
        mutationFn: async (payload: {
            teacherId: string;
            baseSalary: number;
            daysAbsent?: number;
            absentDeduction?: number;
            bonus?: number;
            otherDeductions?: number;
            netSalary?: number;
            paymentMethod?: string;
            notes?: string;
        }) => {
            const existing = payrollRecords.find((r: any) => r.teacher_id === payload.teacherId);
            const today = new Date().toISOString().split('T')[0];
            const netSalary = payload.netSalary !== undefined 
                ? payload.netSalary 
                : (payload.baseSalary + (payload.bonus || 0) - (payload.absentDeduction || 0) - (payload.otherDeductions || 0));

            const recordData = {
                school_id: schoolId,
                teacher_id: payload.teacherId,
                month: selectedMonth,
                base_salary: payload.baseSalary,
                days_absent: payload.daysAbsent || 0,
                absent_deduction: payload.absentDeduction || 0,
                bonus: payload.bonus || 0,
                other_deductions: payload.otherDeductions || 0,
                net_salary: Math.max(0, netSalary),
                status: 'Paid',
                payment_date: today,
                payment_method: payload.paymentMethod || 'Cash',
                notes: payload.notes || null,
                updated_at: new Date().toISOString()
            };

            if (existing) {
                const { error } = await supabase
                    .from('payroll_records')
                    .update(recordData)
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('payroll_records')
                    .insert([recordData]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
            setActivePayModal(null);
        },
        onError: (err: any) => {
            alert(`Failed to record salary payment: ${err.message}`);
        }
    });

    // 5. Bulk Mark All Unpaid Staff as Paid
    const markAllPaidMutation = useMutation({
        mutationFn: async () => {
            const today = new Date().toISOString().split('T')[0];
            const paidTeacherIds = new Set(payrollRecords.filter((r: any) => r.status === 'Paid').map((r: any) => r.teacher_id));
            const unpaidTeachers = teachers.filter(t => !paidTeacherIds.has(t.id));

            if (unpaidTeachers.length === 0) return;

            const inserts = unpaidTeachers.map(t => {
                const base = Number(t.salary || 0);
                const absentDays = absentCountMap[t.id] || 0;
                return {
                    school_id: schoolId,
                    teacher_id: t.id,
                    month: selectedMonth,
                    base_salary: base,
                    days_absent: absentDays,
                    absent_deduction: 0,
                    bonus: 0,
                    other_deductions: 0,
                    net_salary: base,
                    status: 'Paid',
                    payment_date: today,
                    payment_method: 'Cash'
                };
            });

            const { error } = await supabase
                .from('payroll_records')
                .upsert(inserts, { onConflict: 'school_id,teacher_id,month' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
            alert('All unpaid teachers have been marked as Paid!');
        },
        onError: (err: any) => {
            alert(`Bulk payment failed: ${err.message}`);
        }
    });

    // 6. Mark as Unpaid Mutation (Revert)
    const markAsUnpaidMutation = useMutation({
        mutationFn: async (recordId: string) => {
            const { error } = await supabase.from('payroll_records').delete().eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
        },
        onError: (err: any) => {
            alert(`Failed to revert: ${err.message}`);
        }
    });

    // Open detailed pay modal
    const openPayModal = (teacher: any) => {
        const base = Number(teacher.salary || 0);
        const absentDays = absentCountMap[teacher.id] || 0;
        // Standard daily rate estimate: salary / 22 working days
        const estimatedDailyRate = base > 0 ? Math.round(base / 22) : 0;
        const absentDeduct = absentDays * estimatedDailyRate;

        setActivePayModal({
            teacher,
            baseSalary: base,
            daysAbsent: absentDays,
            absentDeduction: 0, // default 0 unless admin applies it
            bonus: 0,
            otherDeductions: 0,
            paymentMethod: 'Cash',
            notes: ''
        });
    };

    // Filter teachers list
    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.subject && t.subject.toLowerCase().includes(searchQuery.toLowerCase()));

        const record = payrollRecords.find((r: any) => r.teacher_id === t.id);
        const isPaid = record?.status === 'Paid';

        if (statusFilter === 'Paid') return matchesSearch && isPaid;
        if (statusFilter === 'Unpaid') return matchesSearch && !isPaid;
        return matchesSearch;
    });

    // Metrics
    const totalSalaryBudget = teachers.reduce((sum, t) => sum + Number(t.salary || 0), 0);
    const paidRecords = payrollRecords.filter((r: any) => r.status === 'Paid');
    const totalPaidAmount = paidRecords.reduce((sum: number, r: any) => sum + Number(r.net_salary || 0), 0);
    const totalPendingAmount = Math.max(0, totalSalaryBudget - totalPaidAmount);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20 md:pb-0">
            {/* Header Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 text-emerald-600">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Disbursed ({selectedMonth})</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">
                            {currencySymbol} {totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 text-blue-600">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid Staff Members</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">
                            {paidRecords.length} / {teachers.length}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100 text-amber-600">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Payout</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">
                            {currencySymbol} {totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="pl-10 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none text-xs font-bold text-slate-800"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {(['All', 'Paid', 'Unpaid'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setStatusFilter(tab)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['teacherPayroll'] })}
                        className="p-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {teachers.length - paidRecords.length > 0 && (
                        <button
                            onClick={() => {
                                if (confirm(`Disburse full base salaries to all ${teachers.length - paidRecords.length} unpaid teachers for ${selectedMonth}?`)) {
                                    markAllPaidMutation.mutate();
                                }
                            }}
                            disabled={markAllPaidMutation.isPending}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                            <UserCheck className="h-4 w-4" />
                            Pay All Unpaid Staff
                        </button>
                    )}

                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search staff..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 focus:outline-none w-full text-xs font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Payroll Roster Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Days Absent</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base Salary</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Payout</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTeachers.map((teacher) => {
                                const record = payrollRecords.find((r: any) => r.teacher_id === teacher.id);
                                const isPaid = record?.status === 'Paid';
                                const absentDays = absentCountMap[teacher.id] || 0;
                                const baseSalary = Number(teacher.salary || 0);
                                const netPayout = record ? Number(record.net_salary || baseSalary) : baseSalary;

                                return (
                                    <tr key={teacher.id} className="hover:bg-slate-50/60 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs border border-slate-200">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{teacher.name}</div>
                                                    <div className="text-xs text-slate-400 font-medium">
                                                        {teacher.subject || 'Staff Member'}{teacher.assigned_class ? ` • ${teacher.assigned_class}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Absent Days Badge */}
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {absentDays > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700">
                                                    {absentDays} {absentDays === 1 ? 'day' : 'days'}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-green-600">0 days</span>
                                            )}
                                        </td>

                                        {/* Base Salary */}
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-500 text-sm">
                                            {currencySymbol} {baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>

                                        {/* Net Payout */}
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="font-black text-slate-900 text-sm">
                                                {currencySymbol} {netPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            {record && record.payment_method && (
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    via {record.payment_method}
                                                </div>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {isPaid ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                {isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isPaid ? (
                                                    <>
                                                        <button 
                                                            onClick={() => setSelectedPayslip({ record, teacher })}
                                                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            Payslip
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (confirm(`Revert payment status for ${teacher.name}?`)) {
                                                                    markAsUnpaidMutation.mutate(record.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                                            title="Revert to Unpaid"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 justify-end">
                                                        <button 
                                                            onClick={() => markAsPaidMutation.mutate({ teacherId: teacher.id, baseSalary })}
                                                            disabled={markAsPaidMutation.isPending}
                                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                        >
                                                            Quick Pay
                                                        </button>
                                                        <button 
                                                            onClick={() => openPayModal(teacher)}
                                                            className="px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                                                            title="Customise payment (bonus, deductions, method)"
                                                        >
                                                            Custom...
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredTeachers.length === 0 && (
                    <div className="p-16 text-center">
                        <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-bold">No teachers match this filter</p>
                        <p className="text-xs text-slate-400 mt-1">Try switching to 'All' or clearing your search term.</p>
                    </div>
                )}
            </div>

            {/* Custom Pay Modal */}
            {activePayModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Disburse Salary</h3>
                                <p className="text-xs text-slate-500">{activePayModal.teacher.name} • {selectedMonth}</p>
                            </div>
                            <button onClick={() => setActivePayModal(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-sm">
                            {/* Base Salary */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Base Salary ({currencySymbol})</label>
                                <input
                                    type="number"
                                    value={activePayModal.baseSalary}
                                    onChange={e => setActivePayModal({ ...activePayModal, baseSalary: Number(e.target.value) })}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none font-bold"
                                />
                            </div>

                            {/* Bonus / Allowances */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bonus / Allowance</label>
                                    <input
                                        type="number"
                                        value={activePayModal.bonus}
                                        onChange={e => setActivePayModal({ ...activePayModal, bonus: Number(e.target.value) })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none font-bold text-green-600"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Other Deductions</label>
                                    <input
                                        type="number"
                                        value={activePayModal.otherDeductions}
                                        onChange={e => setActivePayModal({ ...activePayModal, otherDeductions: Number(e.target.value) })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none font-bold text-red-600"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Absent Days Notification */}
                            {activePayModal.daysAbsent > 0 && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between text-xs text-red-700">
                                    <span>Teacher recorded <strong>{activePayModal.daysAbsent} absent days</strong> this month.</span>
                                </div>
                            )}

                            {/* Payment Method */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                                <select
                                    value={activePayModal.paymentMethod}
                                    onChange={e => setActivePayModal({ ...activePayModal, paymentMethod: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none font-bold bg-white"
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Mobile Money">Mobile Money (MTN / Telecel)</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>

                            {/* Net Total Summary */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600 uppercase">Calculated Net Payout</span>
                                <span className="text-xl font-black text-slate-900">
                                    {currencySymbol} {Math.max(0, activePayModal.baseSalary + activePayModal.bonus - activePayModal.otherDeductions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setActivePayModal(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => markAsPaidMutation.mutate({
                                    teacherId: activePayModal.teacher.id,
                                    baseSalary: activePayModal.baseSalary,
                                    bonus: activePayModal.bonus,
                                    otherDeductions: activePayModal.otherDeductions,
                                    paymentMethod: activePayModal.paymentMethod,
                                    netSalary: Math.max(0, activePayModal.baseSalary + activePayModal.bonus - activePayModal.otherDeductions)
                                })}
                                disabled={markAsPaidMutation.isPending}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50"
                            >
                                {markAsPaidMutation.isPending ? 'Disbursing...' : 'Confirm & Mark Paid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payslip Modal View */}
            {selectedPayslip && (
                <PayslipModal
                    record={selectedPayslip.record}
                    teacher={selectedPayslip.teacher}
                    school={schoolData}
                    onClose={() => setSelectedPayslip(null)}
                />
            )}
        </div>
    );
};

export default TeacherPayroll;
