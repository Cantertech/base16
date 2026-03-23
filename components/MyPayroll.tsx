import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { FileText, DollarSign, Calendar, TrendingUp, ShieldCheck, Download, ChevronRight } from 'lucide-react';
import Loading from './Loading';
import PayslipModal from './PayslipModal';

const MyPayroll = ({ currentUser }: any) => {
    const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

    const { data: records = [], isLoading } = useQuery({
        queryKey: ['myPayroll', currentUser.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payroll_records')
                .select('*')
                .eq('teacher_id', currentUser.id)
                .eq('status', 'Paid')
                .order('month', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!currentUser.id
    });

    const { data: schoolData } = useQuery({
        queryKey: ['schoolSettings', currentUser.school_id],
        queryFn: async () => {
            const { data } = await supabase.from('schools').select('*').eq('id', currentUser.school_id).single();
            return data;
        },
        enabled: !!currentUser.school_id
    });

    if (isLoading) {
        return (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loading type="spinner" fullScreen={false} />
                <p className="text-slate-400 text-sm font-bold animate-pulse">Fetching your payroll history...</p>
            </div>
        );
    }

    const totalEarned = records.reduce((sum, r) => sum + Number(r.net_salary), 0);
    const latestPay = records[0]?.net_salary || 0;

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary-600">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="text-xs font-black uppercase tracking-[0.2em]">Secure Portal</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">My Payroll & Slips</h1>
                    <p className="text-slate-500 font-medium">Manage your earnings, view history, and download official payslips.</p>
                </div>

                {/* Quick Summary Card */}
                <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <TrendingUp className="h-12 w-12" />
                        </div>
                        <div className="bg-primary-50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                            <DollarSign className="h-6 w-6 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Net Pay</p>
                            <p className="text-2xl font-black text-slate-800">GH₵ {Number(latestPay).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* List vs Empty State */}
            {records.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {records.map((record: any) => (
                        <div
                            key={record.id}
                            className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group cursor-pointer"
                            onClick={() => setSelectedPayslip({ record, teacher: { name: currentUser.name, subject: currentUser.subject || 'Staff Member', id: currentUser.id } })}
                        >
                            {/* Decorative Month Label */}
                            <div className="absolute top-0 right-0 p-6">
                                <span className="bg-slate-50 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                    {record.month.split('-')[1]}/{record.month.split('-')[0]}
                                </span>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                                        <Calendar className="h-6 w-6 text-slate-400 group-hover:text-primary-600 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Payment Month</p>
                                        <h3 className="text-lg font-black text-slate-800 leading-none">
                                            {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </h3>
                                    </div>
                                </div>

                                <div className="py-2">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Pay Credited</p>
                                            <p className="text-3xl font-black text-slate-900 leading-none">
                                                <span className="text-sm font-bold text-slate-400 mr-1">GH₵</span>
                                                {Number(record.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className="bg-green-50 px-2 py-1 rounded-lg">
                                            <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter">Paid</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold">Verified</span>
                                    </div>
                                    <span className="text-primary-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        Open Details <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-100 p-20 text-center shadow-sm">
                    <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce transition-all">
                        <FileText className="h-12 w-12 text-slate-200" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">No Records Yet</h3>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto italic mb-10">
                        Historical payslips will appear here once your school's administration processes the payroll records.
                    </p>
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200">
                        <TrendingUp className="h-4 w-4 text-primary-400" /> System is Online & Ready
                    </div>
                </div>
            )}

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

export default MyPayroll;
