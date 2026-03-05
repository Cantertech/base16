import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Search, DollarSign, CheckCircle, AlertCircle, RefreshCw, Edit, X } from 'lucide-react';
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
            const end = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).toISOString().split('T')[0];

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
            const deleteExisting = await supabase.from('payroll_records').delete().eq('school_id', schoolId).eq('month', selectedMonth).eq('status', 'Draft');

            const inserts = teachers.map(t => {
                const daysAbsent = attendanceStats[t.id] || 0;
                const baseSalary = t.salary || 0;
                const dailyRate = baseSalary / 22;
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
            alert('Draft payroll generated successfully!');
        }
    });

    const updateRecordMutation = useMutation({
        mutationFn: async (payload: any) => {
            const bonus = (payload.allowances || []).reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
            const otherDeductions = (payload.deductions || []).reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

            const totalAdd = Number(payload.base_salary) + bonus;
            const totalSub = Number(payload.absent_deduction) + otherDeductions;
            const net = Math.max(0, totalAdd - totalSub);

            const { error } = await supabase.from('payroll_records').update({
                bonus: bonus,
                other_deductions: otherDeductions,
                base_salary: payload.base_salary,
                allowances: payload.allowances,
                deductions: payload.deductions,
                net_salary: net
            }).eq('id', payload.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
            setEditingRecord(null);
        }
    });

    const processPaymentMutation = useMutation({
        mutationFn: async (recordId: string) => {
            const { error } = await supabase.from('payroll_records').update({ status: 'Paid', payment_date: new Date().toISOString().split('T')[0] }).eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
            alert('Payment marked as paid!');
        }
    });

    const filteredRecords = payrollRecords.filter((r: any) => {
        const teacher = teachers.find(t => t.id === r.teacher_id);
        return teacher && teacher.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                    <div className="flex gap-4 items-center flex-wrap">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                        />
                        <button
                            onClick={() => generatePayrollMutation.mutate()}
                            disabled={generatePayrollMutation.isPending}
                            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 flex items-center gap-2 transition-colors disabled:opacity-70"
                        >
                            {generatePayrollMutation.isPending ? <Loading type="spinner" fullScreen={false} /> : <RefreshCw className="h-4 w-4" />}
                            Generate {selectedMonth} Payroll
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-64 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Staff Member</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Base Pay</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Absences</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Deductions</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Net Payable</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-8"><Loading type="spinner" fullScreen={false} /></td></tr>
                            ) : filteredRecords.length > 0 ? (
                                filteredRecords.map((record: any) => {
                                    const teacher = teachers.find(t => t.id === record.teacher_id);
                                    if (!teacher) return null;
                                    return (
                                        <tr key={record.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-slate-900">{teacher.name}</div>
                                                <div className="text-xs text-slate-500">{teacher.subject}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700">
                                                GH₵ {Number(record.base_salary).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${record.days_absent > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`}>
                                                    {record.days_absent} Days
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-red-600">
                                                - GH₵ {Number(record.absent_deduction).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-700 text-lg">
                                                GH₵ {Number(record.net_salary).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${record.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {record.status === 'Paid' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {record.status === 'Draft' ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingRecord(record)}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded"
                                                            title="Edit Allowances/Deductions"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => processPaymentMutation.mutate(record.id)}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1"
                                                        >
                                                            <DollarSign className="h-3 w-3" /> Pay Now
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setSelectedPayslip({ record, teacher })}
                                                        className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors flex justify-center items-center gap-1 ml-auto"
                                                    >
                                                        <FileText className="h-3 w-3" /> Payslip
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <DollarSign className="h-12 w-12 text-slate-300 mx-auto" />
                                            <h3 className="text-lg font-bold text-slate-700">No Payroll Found for {selectedMonth}</h3>
                                            <p className="text-slate-500 text-sm max-w-sm">
                                                Click the "Generate Payroll" button above to automatically calculate attendance deductions and net salaries for all staff.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedPayslip && (
                <PayslipModal
                    record={selectedPayslip.record}
                    teacher={selectedPayslip.teacher}
                    school={schoolData}
                    onClose={() => setSelectedPayslip(null)}
                />
            )}

            {editingRecord && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h3 className="font-bold text-lg">Edit Payroll Record</h3>
                            <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Base Salary (GH₵)</label>
                                <input type="number" value={editingRecord.base_salary} onChange={e => setEditingRecord({ ...editingRecord, base_salary: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-primary-600 focus:outline-none" />
                            </div>

                            <hr className="my-2 border-slate-100" />
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">Allowances</label>
                                <button type="button" onClick={() => setEditingRecord({ ...editingRecord, allowances: [...(editingRecord.allowances || []), { name: '', amount: 0 }] })} className="text-xs text-primary-600">Add</button>
                            </div>
                            <div className="space-y-2">
                                {(editingRecord.allowances || []).map((item: any, idx: number) => (
                                    <div key={idx} className="flex gap-2">
                                        <input type="text" placeholder="Name" value={item.name} onChange={e => {
                                            const newArr = [...editingRecord.allowances]; newArr[idx].name = e.target.value; setEditingRecord({ ...editingRecord, allowances: newArr });
                                        }} className="flex-1 p-2 border rounded text-sm" />
                                        <input type="number" placeholder="Amt" value={item.amount} onChange={e => {
                                            const newArr = [...editingRecord.allowances]; newArr[idx].amount = Number(e.target.value); setEditingRecord({ ...editingRecord, allowances: newArr });
                                        }} className="w-24 p-2 border rounded text-sm" />
                                        <button type="button" onClick={() => {
                                            const newArr = [...editingRecord.allowances]; newArr.splice(idx, 1); setEditingRecord({ ...editingRecord, allowances: newArr });
                                        }} className="text-red-500 p-2"><X className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>

                            <hr className="my-2 border-slate-100" />
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">Other Deductions</label>
                                <button type="button" onClick={() => setEditingRecord({ ...editingRecord, deductions: [...(editingRecord.deductions || []), { name: '', amount: 0 }] })} className="text-xs text-primary-600">Add</button>
                            </div>
                            <div className="space-y-2">
                                {(editingRecord.deductions || []).map((item: any, idx: number) => (
                                    <div key={idx} className="flex gap-2">
                                        <input type="text" placeholder="Name" value={item.name} onChange={e => {
                                            const newArr = [...editingRecord.deductions]; newArr[idx].name = e.target.value; setEditingRecord({ ...editingRecord, deductions: newArr });
                                        }} className="flex-1 p-2 border rounded text-sm" />
                                        <input type="number" placeholder="Amt" value={item.amount} onChange={e => {
                                            const newArr = [...editingRecord.deductions]; newArr[idx].amount = Number(e.target.value); setEditingRecord({ ...editingRecord, deductions: newArr });
                                        }} className="w-24 p-2 border rounded text-sm" />
                                        <button type="button" onClick={() => {
                                            const newArr = [...editingRecord.deductions]; newArr.splice(idx, 1); setEditingRecord({ ...editingRecord, deductions: newArr });
                                        }} className="text-red-500 p-2"><X className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 focus:ring-primary-600 shrink-0 flex justify-end gap-2 bg-slate-50">
                            <button onClick={() => setEditingRecord(null)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                            <button onClick={() => updateRecordMutation.mutate(editingRecord)} className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg font-medium">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
};

export default TeacherPayroll;
