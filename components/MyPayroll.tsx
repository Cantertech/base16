import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { FileText, DollarSign, Calendar } from 'lucide-react';
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
        return <div className="p-8 flex justify-center"><Loading type="spinner" fullScreen={false} /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">My Payslips</h1>
                <p className="text-slate-500 text-sm">View and download your monthly salary slips.</p>
            </div>

            {records.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {records.map((record: any) => (
                        <div key={record.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FileText className="h-16 w-16 text-primary-500" />
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                                <Calendar className="h-4 w-4" />
                                {record.month}
                            </div>
                            <div className="mb-6">
                                <p className="text-slate-500 text-sm mb-1">Net Pay</p>
                                <p className="text-3xl font-black text-slate-800">GH₵ {Number(record.net_salary).toFixed(2)}</p>
                            </div>
                            <button
                                onClick={() => setSelectedPayslip({ record, teacher: { name: currentUser.name, subject: 'Teacher' } })}
                                className="w-full flex items-center justify-center gap-2 bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold py-2.5 rounded-lg transition-colors"
                            >
                                <FileText className="h-4 w-4" /> View Payslip
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 mb-2">No Payslips Yet</h3>
                    <p className="text-slate-500">When your payroll is processed, your payslips will appear here.</p>
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
