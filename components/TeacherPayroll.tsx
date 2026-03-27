import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, DollarSign, CheckCircle, AlertCircle, RefreshCw, X, Calendar, CreditCard } from 'lucide-react';
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

    const markAsPaidMutation = useMutation({
        mutationFn: async ({ teacherId, salary }: { teacherId: string, salary: number }) => {
            // Check if record exists
            const existing = payrollRecords.find((r: any) => r.teacher_id === teacherId);
            
            if (existing) {
                const { error } = await supabase.from('payroll_records').update({
                    status: 'Paid',
                    payment_date: new Date().toISOString().split('T')[0],
                    net_salary: salary,
                    base_salary: salary
                }).eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('payroll_records').insert([{
                    school_id: schoolId,
                    teacher_id: teacherId,
                    month: selectedMonth,
                    base_salary: salary,
                    net_salary: salary,
                    status: 'Paid',
                    payment_date: new Date().toISOString().split('T')[0]
                }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
        }
    });

    const markAsUnpaidMutation = useMutation({
        mutationFn: async (recordId: string) => {
            const { error } = await supabase.from('payroll_records').delete().eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherPayroll', schoolId, selectedMonth] });
        }
    });

    const filteredTeachers = teachers.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        totalPaid: payrollRecords.filter((r: any) => r.status === 'Paid').length,
        totalAmount: payrollRecords.reduce((sum: number, r: any) => sum + Number(r.net_salary || 0), 0)
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-emerald-50 p-3 rounded-xl">
                        <DollarSign className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Payout ({selectedMonth})</p>
                        <p className="text-2xl font-black text-slate-800">GH₵ {stats.totalAmount.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-xl">
                        <CheckCircle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paid Staff</p>
                        <p className="text-2xl font-black text-slate-800">{stats.totalPaid} / {teachers.length}</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none text-sm font-medium"
                        />
                    </div>
                    <button 
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['teacherPayroll'] })}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search teachers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none text-sm font-medium"
                    />
                </div>
            </div>

            {/* Teacher List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Pay Amount</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredTeachers.map((teacher) => {
                                const record = payrollRecords.find((r: any) => r.teacher_id === teacher.id);
                                const isPaid = record?.status === 'Paid';

                                return (
                                    <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{teacher.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{teacher.subject || 'Staff'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="font-black text-slate-700 text-sm">
                                                GH₵ {Number(teacher.salary || 0).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {isPaid ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                {isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isPaid ? (
                                                    <>
                                                        <button 
                                                            onClick={() => setSelectedPayslip({ record, teacher })}
                                                            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                                        >
                                                            View Slip
                                                        </button>
                                                        <button 
                                                            onClick={() => markAsUnpaidMutation.mutate(record.id)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                            title="Revert Status"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button 
                                                        onClick={() => markAsPaidMutation.mutate({ teacherId: teacher.id, salary: teacher.salary })}
                                                        disabled={markAsPaidMutation.isPending}
                                                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50"
                                                    >
                                                        {markAsPaidMutation.isPending ? 'Processing...' : 'Mark as Paid'}
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

                {filteredTeachers.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CreditCard className="h-10 w-10 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium italic">No teachers found in this school.</p>
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
        </div>
    );
};

export default TeacherPayroll;
