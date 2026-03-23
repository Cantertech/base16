import React, { useRef } from 'react';
import { X, Download, Printer, ShieldCheck, CreditCard, User, Building, Calendar, FileText, CheckCircle2 } from 'lucide-react';
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

        // Temporarily set width for high-quality capture
        const originalWidth = slipRef.current.style.width;
        const originalMaxWidth = slipRef.current.style.maxWidth;

        // Force a standard width for the capture
        slipRef.current.style.width = '800px';
        slipRef.current.style.maxWidth = 'none';

        try {
            const canvas = await html2canvas(slipRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Payslip_${teacher.name.replace(/\s+/g, '_')}_${record.month}.pdf`);
        } catch (error) {
            console.error('PDF Generation failed:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            // Restore original styles
            slipRef.current.style.width = originalWidth;
            slipRef.current.style.maxWidth = originalMaxWidth;
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatDate = (date: string) => {
        return new Date(date || new Date()).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center backdrop-blur-md p-2 md:p-4 overflow-hidden">
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Modal Toolbar */}
                <div className="px-4 md:px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary-50 p-2 rounded-lg">
                            <FileText className="h-5 w-5 text-primary-600" />
                        </div>
                        <h3 className="font-bold text-base md:text-lg text-slate-800">Payslip Preview</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-bold text-xs transition-all shadow-sm active:scale-95"
                        >
                            <Download className="h-4 w-4" /> Download PDF
                        </button>
                        <button
                            onClick={handlePrint}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                            title="Print"
                        >
                            <Printer className="h-5 w-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Visible Download Button for Mobile */}
                <div className="sm:hidden p-4 bg-slate-50 border-b border-slate-100">
                    <button
                        onClick={handleDownloadPDF}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm"
                    >
                        <Download className="h-4 w-4" /> Download PDF
                    </button>
                </div>

                {/* Slip Viewer */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50 flex flex-col md:items-center relative overflow-x-hidden md:overflow-x-visible">

                    {/* Mobile Simplified View */}
                    <div className="md:hidden space-y-4 w-full max-w-sm mx-auto">
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <FileText className="w-24 h-24" />
                            </div>
                            <div className="text-center pb-5 mb-5 border-b border-slate-100 relative z-10">
                                <h2 className="font-black text-slate-800 text-lg leading-tight mb-1">{school?.name || 'Orbit Academy'}</h2>
                                <p className="text-primary-600 text-[10px] font-bold tracking-widest uppercase mb-1">{record.month || 'Current Month'}</p>
                            </div>

                            <div className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Earnings</p>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="font-bold text-slate-700 text-sm">Basic Salary</span>
                                        <span className="font-black text-slate-800 text-sm">GH₵ {Number(record.base_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {record.allowances?.map((al: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-sm">
                                            <span className="font-bold text-blue-700">{al.name}</span>
                                            <span className="font-black text-blue-700">+{Number(al.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                    {Number(record.bonus) > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-sm">
                                            <span className="font-bold text-blue-700">Bonuses & Additions</span>
                                            <span className="font-black text-blue-700">+{Number(record.bonus).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Deductions</p>
                                    {Number(record.absent_deduction) > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100/50 text-sm">
                                            <span className="font-bold text-red-700">Absence Penalty</span>
                                            <span className="font-black text-red-700">-{Number(record.absent_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {record.deductions?.map((ded: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100/50 text-sm">
                                            <span className="font-bold text-red-700">{ded.name}</span>
                                            <span className="font-black text-red-700">-{Number(ded.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                    {Number(record.other_deductions) > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100/50 text-sm">
                                            <span className="font-bold text-red-700">Other Deductions</span>
                                            <span className="font-black text-red-700">-{Number(record.other_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-5 border-t-2 border-slate-100 flex justify-between items-end bg-slate-900 -mx-6 -mb-6 p-6">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Net Payable Amount</p>
                                    <h4 className="text-2xl font-black text-white leading-none">
                                        <span className="text-xs mr-1 opacity-70">GH₵</span>
                                        {Number(record.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Professional PDF View (Desktop only, absolutely positioned offscreen on mobile) */}
                    <div className="max-md:absolute max-md:-left-[9999px] max-md:opacity-0 max-md:pointer-events-none md:pointer-events-auto w-full md:relative md:overflow-x-auto pb-4">
                        <div
                            ref={slipRef}
                            className="bg-white p-6 md:p-12 w-full min-w-[700px] max-w-[210mm] shrink-0 shadow-2xl rounded-sm md:rounded-lg relative border-t-8 border-primary-600 overflow-hidden mx-auto"
                            id="printable-slip"
                        >
                            {/* Decorative Background Element */}
                            <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-primary-50 rounded-full opacity-50 blur-3xl pointer-events-none"></div>

                            {/* Document Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 mb-8 border-b border-slate-100 relative text-left">
                                <div className="flex items-center gap-4">
                                    {school?.logo_url ? (
                                        <div className="h-16 w-16 md:h-20 md:w-20 bg-slate-50 rounded-2xl flex items-center justify-center p-2 border border-slate-100 shrink-0">
                                            <img src={school.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="h-16 w-16 md:h-20 md:w-20 bg-primary-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                                            <Building className="h-10 w-10" />
                                        </div>
                                    )}
                                    <div>
                                        <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{school?.name || 'Orbit Academy'}</h1>
                                        <p className="text-primary-600 text-xs md:text-sm font-bold tracking-widest uppercase">{school?.motto || 'Excellence in Education'}</p>
                                        <p className="text-slate-400 text-[10px] md:text-xs mt-1 italic">Generated on {formatDate(new Date().toISOString())}</p>
                                    </div>
                                </div>
                                <div className="text-left md:text-right w-full md:w-auto">
                                    <span className="inline-block bg-primary-600 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase mb-3 shadow-lg shadow-primary-200">
                                        Official Payslip
                                    </span>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payroll Period</p>
                                        <p className="text-lg font-black text-slate-800">{record.month || 'Current Month'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-10 text-left">
                                <div className="space-y-4">
                                    <div className="p-4 md:p-6 rounded-2xl bg-slate-50 border border-slate-100 flex gap-4">
                                        <div className="bg-white h-10 w-10 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                                            <User className="h-5 w-5 text-primary-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Employee Information</p>
                                            <p className="text-base font-black text-slate-800">{teacher.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">{teacher.subject || 'Staff Member'}</p>
                                            <p className="text-[10px] text-slate-400 mt-1 font-mono">ID: {teacher.id?.substring(0, 8).toUpperCase()}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 md:p-6 rounded-2xl bg-green-50/50 border border-green-100 flex gap-4 relative overflow-hidden">
                                        {/* Success Micro-pattern */}
                                        <div className="absolute top-0 right-0 p-2 opacity-10">
                                            <CheckCircle2 className="h-16 w-16" />
                                        </div>
                                        <div className="bg-white h-10 w-10 rounded-xl flex items-center justify-center shadow-sm border border-green-100 shrink-0">
                                            <CreditCard className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="relative z-10 text-left">
                                            <p className="text-[10px] text-green-600/70 font-bold uppercase tracking-wider mb-1">Payment Status</p>
                                            <p className="text-base font-black text-green-700">Payment Processed</p>
                                            <p className="text-xs text-green-600 mb-2 font-medium">Released: {formatDate(record.payment_date)}</p>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-600 text-white rounded-md text-[9px] font-black uppercase">
                                                <ShieldCheck className="h-3 w-3" /> Fully Verified
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown Table */}
                            <div className="mb-10 text-left">
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                    <table className="w-full text-left min-w-[500px]">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Reference</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount (GH₵)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {/* Basic Earnings */}
                                            <tr>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-2 w-2 rounded-full bg-primary-500"></div>
                                                        <span className="font-bold text-slate-700">Basic Salary</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right text-xs text-slate-400 font-medium">Contracted</td>
                                                <td className="px-6 py-5 text-right font-black text-slate-800">{Number(record.base_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>

                                            {/* Allowances */}
                                            {record.allowances?.length > 0 ? (
                                                record.allowances.map((al: any, idx: number) => (
                                                    <tr key={`al-${idx}`} className="bg-blue-50/20">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-3 pl-4 border-l-4 border-blue-500">
                                                                <span className="font-bold text-blue-700">{al.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right text-[10px] text-blue-400 font-bold uppercase tracking-wider">Allowance</td>
                                                        <td className="px-6 py-5 text-right font-black text-blue-700">+{Number(al.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                Number(record.bonus) > 0 && (
                                                    <tr className="bg-blue-50/20">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-3 pl-4 border-l-4 border-blue-500">
                                                                <span className="font-bold text-blue-700">Bonuses & Additions</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right text-[10px] text-blue-400 font-bold uppercase tracking-wider">Extra</td>
                                                        <td className="px-6 py-5 text-right font-black text-blue-700">+{Number(record.bonus).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                )
                                            )}

                                            {/* Deductions - Absences */}
                                            {Number(record.absent_deduction) > 0 && (
                                                <tr className="bg-red-50/20">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3 pl-4 border-l-4 border-red-500">
                                                            <span className="font-bold text-red-700">Absence Penalty</span>
                                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-black uppercase ml-2">{record.days_absent} Days</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right text-[10px] text-red-400 font-bold uppercase tracking-wider">Deduction</td>
                                                    <td className="px-6 py-5 text-right font-black text-red-700">-{Number(record.absent_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            )}

                                            {/* Other Deductions */}
                                            {record.deductions?.length > 0 ? (
                                                record.deductions.map((ded: any, idx: number) => (
                                                    <tr key={`ded-${idx}`} className="bg-red-50/20">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-3 pl-4 border-l-4 border-red-500">
                                                                <span className="font-bold text-red-700">{ded.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right text-[10px] text-red-400 font-bold uppercase tracking-wider">Deduction</td>
                                                        <td className="px-6 py-5 text-right font-black text-red-700">-{Number(ded.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                Number(record.other_deductions) > 0 && (
                                                    <tr className="bg-red-50/20">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-3 pl-4 border-l-4 border-red-500">
                                                                <span className="font-bold text-red-700">Miscellaneous Deductions</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right text-[10px] text-red-400 font-bold uppercase tracking-wider">Payroll Adj</td>
                                                        <td className="px-6 py-5 text-right font-black text-red-700">-{Number(record.other_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals Section */}
                            <div className="flex flex-col md:flex-row justify-between gap-8 pt-8 border-t-2 border-slate-100 text-left">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary-600 p-2 rounded-lg rotate-3 shadow-lg">
                                            <ShieldCheck className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Document Security</p>
                                            <p className="text-xs font-bold text-slate-600">Encrypted Digital Record</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 inline-block overflow-hidden max-w-full">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Hash ID</span>
                                        </div>
                                        <p className="text-[9px] font-mono text-slate-400 break-all">
                                            {btoa(`${teacher.id}-${record.id}-${record.payment_date}`).substring(0, 32)}
                                        </p>
                                    </div>
                                </div>

                                <div className="w-full md:w-80 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Total Gross Earnings</span>
                                            <span className="font-bold text-slate-800">GH₵ {(Number(record.base_salary) + Number(record.bonus || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Total Salary Deductions</span>
                                            <span className="font-bold text-red-600">GH₵ -{(Number(record.absent_deduction || 0) + Number(record.other_deductions || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl shadow-slate-200 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                            <Building className="h-12 w-12 text-white" />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Net Payable Amount</p>
                                        <h4 className="text-3xl font-black text-white flex items-baseline gap-2">
                                            <span className="text-sm font-bold opacity-70">GH₵</span>
                                            {Number(record.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </h4>
                                    </div>

                                    <div className="text-center pt-2">
                                        <p className="text-[10px] text-slate-400 font-bold italic">*** Amount paid in full through bank transfer ***</p>
                                    </div>
                                </div>
                            </div>

                            {/* Fine Print Footer */}
                            <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                                <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> System Generated</div>
                                    <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> Digital Signature Valid</div>
                                    <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> Compliance Verified</div>
                                </div>
                                <p className="text-[10px] text-slate-300">
                                    This document is private and confidential. If you are not the intended recipient, please notify the school administration immediately.
                                </p>
                                <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Powered by <span className="text-primary-600">Orbit Platform</span> • Next-Gen School Operating System
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                @media print {
                    body * { visibility: hidden; }
                    #printable-slip, #printable-slip * { visibility: visible; }
                    #printable-slip { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
                }
            `}} />
            </div>
        </div>
    );
};

export default PayslipModal;
