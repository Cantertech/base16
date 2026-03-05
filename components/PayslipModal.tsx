import React, { useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PayslipModalProps {
    record: any;
    teacher: any;
    school: any;
    onClose: () => void;
}

const PayslipModal: React.FC<PayslipModalProps> = ({ record, teacher, school, onClose }) => {
    const slipRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = async () => {
        if (!slipRef.current) return;
        const canvas = await html2canvas(slipRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Payslip_${teacher.name}_${record.month}.pdf`);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-slate-100 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg text-slate-800">Payslip Preview</h3>
                    <div className="flex items-center gap-3">
                        <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors">
                            <Download className="h-4 w-4" /> Download PDF
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50 flex justify-center">
                    <div ref={slipRef} className="bg-white p-10 w-full max-w-2xl shadow-sm border border-slate-200 rounded-lg relative">
                        {/* Header */}
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-6 mb-6">
                            {school?.logo_url && <img src={school.logo_url} alt="Logo" className="h-16 w-16 object-contain" />}
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wider">{school?.name || 'School Name'}</h1>
                                <p className="text-slate-500 text-sm">{school?.motto || 'Education for a brighter future'}</p>
                            </div>
                            <div className="ml-auto text-right">
                                <h2 className="text-xl font-bold text-primary-700 uppercase tracking-widest bg-primary-50 px-3 py-1 rounded inline-block">Payslip</h2>
                                <p className="text-slate-600 font-medium mt-2">Period: {record.month}</p>
                            </div>
                        </div>

                        {/* Teacher Info */}
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Employee Details</p>
                                <p className="font-bold text-slate-800 text-lg">{teacher.name}</p>
                                <p className="text-slate-600 text-sm">{teacher.subject}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Payment Status</p>
                                <p className="font-bold text-green-600 text-lg flex items-center gap-2">
                                    Paid on {new Date(record.payment_date || new Date()).toLocaleDateString('en-GB')}
                                </p>
                            </div>
                        </div>

                        {/* Financial Table */}
                        <table className="w-full mb-8 border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-300">
                                    <th className="text-left py-3 text-sm font-bold text-slate-700 uppercase">Description</th>
                                    <th className="text-right py-3 text-sm font-bold text-slate-700 uppercase">Earnings (GH₵)</th>
                                    <th className="text-right py-3 text-sm font-bold text-slate-700 uppercase">Deductions (GH₵)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-100">
                                    <td className="py-4 text-slate-800 font-medium">Basic Salary</td>
                                    <td className="py-4 text-right text-slate-800 font-medium">{Number(record.base_salary).toFixed(2)}</td>
                                    <td className="py-4 text-right text-slate-800">-</td>
                                </tr>
                                {record.allowances?.length > 0 ? (
                                    record.allowances.map((al: any, idx: number) => (
                                        <tr key={`al-${idx}`} className="border-b border-slate-100 bg-green-50/50">
                                            <td className="py-4 text-green-800 font-medium pl-4 border-l-2 border-green-500">{al.name}</td>
                                            <td className="py-4 text-right text-green-700 font-bold">{Number(al.amount).toFixed(2)}</td>
                                            <td className="py-4 text-right text-slate-800">-</td>
                                        </tr>
                                    ))
                                ) : (
                                    Number(record.bonus) > 0 && (
                                        <tr className="border-b border-slate-100 bg-green-50/50">
                                            <td className="py-4 text-green-800 font-medium pl-4 border-l-2 border-green-500">Allowances & Bonuses</td>
                                            <td className="py-4 text-right text-green-700 font-bold">{Number(record.bonus).toFixed(2)}</td>
                                            <td className="py-4 text-right text-slate-800">-</td>
                                        </tr>
                                    )
                                )}
                                {Number(record.absent_deduction) > 0 && (
                                    <tr className="border-b border-slate-100 bg-red-50/50">
                                        <td className="py-4 text-red-800 font-medium pl-4 border-l-2 border-red-500">Absence Deduction ({record.days_absent} Days)</td>
                                        <td className="py-4 text-right text-slate-800">-</td>
                                        <td className="py-4 text-right text-red-700 font-bold">{Number(record.absent_deduction).toFixed(2)}</td>
                                    </tr>
                                )}
                                {record.deductions?.length > 0 ? (
                                    record.deductions.map((ded: any, idx: number) => (
                                        <tr key={`ded-${idx}`} className="border-b border-slate-100 bg-red-50/50">
                                            <td className="py-4 text-red-800 font-medium pl-4 border-l-2 border-red-500">{ded.name}</td>
                                            <td className="py-4 text-right text-slate-800">-</td>
                                            <td className="py-4 text-right text-red-700 font-bold">{Number(ded.amount).toFixed(2)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    Number(record.other_deductions) > 0 && (
                                        <tr className="border-b border-slate-100 bg-red-50/50">
                                            <td className="py-4 text-red-800 font-medium pl-4 border-l-2 border-red-500">Other Deductions</td>
                                            <td className="py-4 text-right text-slate-800">-</td>
                                            <td className="py-4 text-right text-red-700 font-bold">{Number(record.other_deductions).toFixed(2)}</td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>

                        {/* Summary */}
                        <div className="flex justify-end mb-12">
                            <div className="w-64 border-t-2 border-slate-800 pt-4">
                                <div className="flex justify-between mb-2">
                                    <p className="text-slate-600 font-medium text-sm">Gross Earnings</p>
                                    <p className="font-bold text-slate-800">{(Number(record.base_salary) + Number(record.bonus)).toFixed(2)}</p>
                                </div>
                                <div className="flex justify-between mb-4 border-b border-slate-200 pb-4">
                                    <p className="text-slate-600 font-medium text-sm">Total Deductions</p>
                                    <p className="font-bold text-red-600">{(Number(record.absent_deduction) + Number(record.other_deductions)).toFixed(2)}</p>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <p className="text-slate-800 font-bold uppercase text-sm">Net Payable</p>
                                    <p className="text-2xl font-black text-primary-600">GH₵ {Number(record.net_salary).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-xs text-slate-400 mt-8 pt-8 border-t border-slate-100">
                            <p>This is a system generated payslip.</p>
                            <p className="mt-1">Generated by Orbit ERP • School Operations Platform</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayslipModal;
