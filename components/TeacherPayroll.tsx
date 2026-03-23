import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Search, DollarSign, CheckCircle, AlertCircle, RefreshCw, Edit, X, CreditCard, User, MoreVertical, Settings2, Calendar } from 'lucide-react';
import Loading from './Loading';
import PayslipModal from './PayslipModal';

interface TeacherPayrollProps {
    schoolId: string;
    teachers: any[];
}

const TeacherPayroll: React.FC<TeacherPayrollProps> = ({ schoolId, teachers }) => {
    const queryClient = useQueryClient();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    const { data: schoolData } = useQuery({
        queryKey: ['schoolSettings', schoolId],
        queryFn: async () => {
            const { data } = await supabase.from('schools').select('*').eq('id', schoolId).single();
            return data;
        },
        enabled: !!schoolId
    });

    const { data: payrollRecords = [], isLoading } = useQuery({
        queryKey: ['teacherPayroll', schoolId, selectedMonth],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payroll_records')
                .select('*')
                .eq('school_id', schoolId)
                .eq('month', selectedMonth);

            if (error) throw error;
            return data || [];
        },
        enabled: !!schoolId
    });

    const { data: attendanceStats = {} } = useQuery({
        queryKey: ['teacherAttendanceStats', schoolId, selectedMonth],
        queryFn: async () => {
            const start = `${selectedMonth}-01`;
            const end = new Date(selectedMonth.split('-')[0], Number(selectedMonth.split('-')[1]), 0).toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('teacher_attendance')
                .select('teacher_id, status')
                .eq('school_id', schoolId)
                .gte('date', start)
                .lte('date', end)
                .eq('status', 'Absent');

            if (error) throw error;
            const stats: Record<string, number> = {};
            data?.forEach((r: any) => {
                if (!stats[r.teacher_id]) stats[r.teacher_id] = 0;
                stats[r.teacher_id]++;
            });
            return stats;
        },
        enabled: !!schoolId
    });

    const generatePayrollMutation = useMutation({
        mutationFn: async () => {
            // Delete existing drafts
            await supabase.from('payroll_records').delete().eq('school_id', schoolId).eq('month', selectedMonth).eq('status', 'Draft');

            const inserts = teachers.map(t => {
                const daysAbsent = attendanceStats[t.id] || 0;
                const baseSalary = t.salary || 0;
                const dailyRate = baseSalary / 22; // Assumption
                const absentDeduction = daysAbsent * dailyRate;

                const teacherAllowances = t.allowances || [];
                const teacherDeductions = t.deductions || [];
                const bonus = teacherAllowances.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
                const otherDeductions = teacherDeductions.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

                const netSalary = Math.max(0, baseSalary + bonus - absentDeduction - otherDeductions);

                return {
                    school_id: schoolId,
                    teacher_id: t.id,
                    month: selectedMonth,
                    base_salary: baseSalary,
                    days_absent: daysAbsent,
                    bonus: bonus,
                    other_deductions: otherDeductions,
                    absent_deduction: absentDeduction,
                    allowances: teacherAllowances,
                    deductions: teacherDeductions,
                    net_salary: netSalary,
                    status: 'Draft'
                };
            });

            if (inserts.length === 0) return;
            const { error } = await supabase.from('payroll_records').insert(inserts);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
        }
    });

    const processPaymentMutation = useMutation({
        mutationFn: async (recordId: string) => {
            const { error } = await supabase.from('payroll_records').update({
                status: 'Paid',
                payment_date: new Date().toISOString().split('T')[0]
            }).eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
        }
    });

    const filteredRecords = payrollRecords.filter((r: any) => {
        const teacher = teachers.find(t => t.id === r.teacher_id);
        return teacher && teacher.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-xl">
                        <DollarSign className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Payroll</p>
                        <p className="text-2xl font-black text-slate-800">
                            GH₵ {filteredRecords.reduce((sum, r) => sum + Number(r.net_salary), 0).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-green-50 p-3 rounded-xl">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paid Staff</p>
                        <p className="text-2xl font-black text-slate-800">
                            {filteredRecords.filter(r => r.status === 'Paid').length} / {filteredRecords.length}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-orange-50 p-3 rounded-xl">
                        <AlertCircle className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Payment</p>
                        <p className="text-2xl font-black text-slate-800">
                            {filteredRecords.filter(r => r.status === 'Draft').length} Staff
                        </p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none text-sm font-medium"
                            />
                        </div>
                        <button
                            onClick={() => generatePayrollMutation.mutate()}
                            disabled={generatePayrollMutation.isPending}
                            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2 transition-all disabled:opacity-70 active:scale-95"
                        >
                            {generatePayrollMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            <span className="hidden sm:inline">Refresh & Generate</span>
                            <span className="sm:hidden">Generate</span>
                        </button>
                    </div>
                    <div className="relative w-full lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:outline-none w-full text-sm font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Table / List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-4">
                        <Loading type="spinner" fullScreen={false} />
                        <p className="text-slate-400 text-sm font-medium">Crunching payroll data...</p>
                    </div>
                ) : filteredRecords.length > 0 ? (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base Pay</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Absences</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Payable</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredRecords.map((record: any) => {
                                        const teacher = teachers.find(t => t.id === record.teacher_id);
                                        if (!teacher) return null;
                                        return (
                                            <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200 group-hover:bg-white transition-colors">
                                                            {teacher.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 text-sm">{teacher.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{teacher.subject}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-600 text-sm">
                                                    GH₵ {Number(record.base_salary).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${record.days_absent > 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                                        {record.days_absent} Days
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="font-black text-primary-600 text-base">
                                                        GH₵ {Number(record.net_salary).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${record.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {record.status === 'Paid' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {record.status === 'Draft' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => setEditingRecord(record)}
                                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                                                                    title="Adjust Payroll"
                                                                >
                                                                    <Settings2 className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => processPaymentMutation.mutate(record.id)}
                                                                    className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-100 active:scale-95"
                                                                >
                                                                    Pay Now
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => setSelectedPayslip({ record, teacher })}
                                                                className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                                            >
                                                                View Slip
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredRecords.map((record: any) => {
                                const teacher = teachers.find(t => t.id === record.teacher_id);
                                if (!teacher) return null;
                                return (
                                    <div key={record.id} className="p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center font-bold text-primary-600 border border-primary-100 shrink-0">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-sm leading-tight">{teacher.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{teacher.subject}</div>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${record.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {record.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-2">
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Base Pay</p>
                                                <p className="text-sm font-bold text-slate-600">GH₵ {Number(record.base_salary).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Net Payable</p>
                                                <p className="text-sm font-black text-primary-600">GH₵ {Number(record.net_salary).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2">
                                            {record.status === 'Draft' ? (
                                                <>
                                                    <button
                                                        onClick={() => setEditingRecord(record)}
                                                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs uppercase tracking-widest transition-all"
                                                    >
                                                        Adjust
                                                    </button>
                                                    <button
                                                        onClick={() => processPaymentMutation.mutate(record.id)}
                                                        className="flex-[2] px-4 py-3 bg-primary-600 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary-100"
                                                    >
                                                        Pay Now
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedPayslip({ record, teacher })}
                                                    className="w-full px-4 py-3 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all"
                                                >
                                                    View Payslip
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="p-16 text-center border-2 border-dashed border-slate-100 m-4 rounded-3xl">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CreditCard className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Clear as a Whistle!</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto mb-8 font-medium italic">
                            No payroll records found for {selectedMonth}. Time to generate them and get the team paid!
                        </p>
                        <button
                            onClick={() => generatePayrollMutation.mutate()}
                            className="px-8 py-3 bg-primary-600 text-white font-black rounded-2xl hover:bg-primary-700 transition-all shadow-xl shadow-primary-200"
                        >
                            Generate Payroll Now
                        </button>
                    </div>
                )}
            </div>

            {selectedPayslip && (
                <PayslipModal
                    record={selectedPayslip.record}
                    teacher={selectedPayslip.teacher}
                    school={schoolData}
                    onClose={() => setSelectedPayslip(null)}
                />
            )}

            {/* Edit Modal Refined */}
            {editingRecord && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary-50 p-2 rounded-lg">
                                    <Settings2 className="h-5 w-5 text-primary-600" />
                                </div>
                                <h3 className="font-black text-slate-800">Payroll Adjustment</h3>
                            </div>
                            <button onClick={() => setEditingRecord(null)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/50">
                            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Standard Salary (GH₵)</label>
                                <input
                                    type="number"
                                    value={editingRecord.base_salary}
                                    onChange={e => setEditingRecord({ ...editingRecord, base_salary: e.target.value })}
                                    className="w-full text-lg font-black text-slate-800 bg-transparent focus:outline-none"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allowances / Bonuses</h4>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRecord({ ...editingRecord, allowances: [...(editingRecord.allowances || []), { name: '', amount: 0 }] })}
                                        className="text-[10px] font-black text-primary-600 uppercase tracking-widest px-2 py-1 bg-primary-50 rounded-lg"
                                    >
                                        + Add New
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(editingRecord.allowances || []).map((item: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                            <input
                                                type="text"
                                                placeholder="Name (e.g. Housing)"
                                                value={item.name}
                                                onChange={e => {
                                                    const newArr = [...editingRecord.allowances]; newArr[idx].name = e.target.value; setEditingRecord({ ...editingRecord, allowances: newArr });
                                                }}
                                                className="flex-1 bg-transparent p-2 text-sm font-bold text-slate-700 focus:outline-none"
                                            />
                                            <div className="flex items-center gap-2 border-l border-slate-100 pl-2">
                                                <span className="text-[10px] font-bold text-green-500">GH₵</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={e => {
                                                        const newArr = [...editingRecord.allowances]; newArr[idx].amount = Number(e.target.value); setEditingRecord({ ...editingRecord, allowances: newArr });
                                                    }}
                                                    className="w-20 bg-transparent p-2 text-sm font-black text-green-600 focus:outline-none"
                                                />
                                            </div>
                                            <button type="button" onClick={() => {
                                                const newArr = [...editingRecord.allowances]; newArr.splice(idx, 1); setEditingRecord({ ...editingRecord, allowances: newArr });
                                            }} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><X className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Other Deductions</h4>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRecord({ ...editingRecord, deductions: [...(editingRecord.deductions || []), { name: '', amount: 0 }] })}
                                        className="text-[10px] font-black text-red-600 uppercase tracking-widest px-2 py-1 bg-red-50 rounded-lg"
                                    >
                                        + Add New
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(editingRecord.deductions || []).map((item: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                            <input
                                                type="text"
                                                placeholder="Reason"
                                                value={item.name}
                                                onChange={e => {
                                                    const newArr = [...editingRecord.deductions]; newArr[idx].name = e.target.value; setEditingRecord({ ...editingRecord, deductions: newArr });
                                                }}
                                                className="flex-1 bg-transparent p-2 text-sm font-bold text-slate-700 focus:outline-none"
                                            />
                                            <div className="flex items-center gap-2 border-l border-slate-100 pl-2">
                                                <span className="text-[10px] font-bold text-red-500">GH₵</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={e => {
                                                        const newArr = [...editingRecord.deductions]; newArr[idx].amount = Number(e.target.value); setEditingRecord({ ...editingRecord, deductions: newArr });
                                                    }}
                                                    className="w-20 bg-transparent p-2 text-sm font-black text-red-600 focus:outline-none"
                                                />
                                            </div>
                                            <button type="button" onClick={() => {
                                                const newArr = [...editingRecord.deductions]; newArr.splice(idx, 1); setEditingRecord({ ...editingRecord, deductions: newArr });
                                            }} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><X className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-4">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estimated Net Pay</span>
                                <span className="text-xl font-black text-primary-600">
                                    GH₵ {(
                                        Number(editingRecord.base_salary) -
                                        Number(editingRecord.absent_deduction || 0) +
                                        (editingRecord.allowances || []).reduce((s: any, a: any) => s + Number(a.amount), 0) -
                                        (editingRecord.deductions || []).reduce((s: any, d: any) => s + Number(d.amount), 0)
                                    ).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingRecord(null)} className="flex-1 px-4 py-3 text-slate-500 bg-slate-100 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                                <button
                                    onClick={() => {
                                        const bonus = (editingRecord.allowances || []).reduce((s: any, a: any) => s + Number(a.amount), 0);
                                        const other_deductions = (editingRecord.deductions || []).reduce((s: any, d: any) => s + Number(d.amount), 0);
                                        const net = Number(editingRecord.base_salary) - Number(editingRecord.absent_deduction || 0) + bonus - other_deductions;

                                        supabase.from('payroll_records').update({
                                            base_salary: editingRecord.base_salary,
                                            allowances: editingRecord.allowances,
                                            deductions: editingRecord.deductions,
                                            bonus,
                                            other_deductions,
                                            net_salary: net
                                        }).eq('id', editingRecord.id).then(() => {
                                            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
                                            setEditingRecord(null);
                                        });
                                    }}
                                    className="flex-[2] px-4 py-3 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                >
                                    Update Record
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherPayroll;
