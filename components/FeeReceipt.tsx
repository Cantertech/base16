import React, { useRef } from 'react';
import { X, Printer, Download, Share2 } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface FeeReceiptProps {
    data: {
        schoolName: string;
        schoolLogo?: string;
        schoolAddress?: string;
        schoolPhone?: string;
        schoolEmail?: string;
        studentName: string;
        studentClass: string;
        studentId: string;
        transactionId: string;
        date: string;
        amount: number;
        method: string;
        reference?: string;
        previousBalance: number;
        newBalance: number;
        type: string;
    };
    onClose: () => void;
}

const FeeReceipt: React.FC<FeeReceiptProps> = ({ data, onClose }) => {
    const { formatAmount, currency } = useCurrency();
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = React.useState(false);

    const handlePrint = () => {
        const printContent = receiptRef.current;
        if (!printContent) return;

        const originalContents = document.body.innerHTML;
        const printContents = printContent.innerHTML;

        // Create a temporary container for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Receipt - ${data.studentName}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            @media print {
                                body { -webkit-print-color-adjust: exact; }
                            }
                        </style>
                    </head>
                    <body class="bg-white p-8">
                        ${printContents}
                        <script>
                            window.onload = function() { window.print(); window.close(); }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleDownloadPdf = async () => {
        if (!receiptRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(receiptRef.current, {
                scale: 2, // Higher quality
                backgroundColor: '#ffffff',
                useCORS: true // For images
            } as any);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Receipt_${data.transactionId}.pdf`);
        } catch (error) {
            console.error('PDF Generation failed', error);
            alert('Failed to generate PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Payment Receipt</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium"
                        >
                            <Printer className="h-4 w-4" /> Print
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isDownloading}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? (
                                <span className="animate-pulse">Saving...</span>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" /> Download PDF
                                </>
                            )}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Receipt Preview Area */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
                    <div ref={receiptRef} className="bg-white w-full max-w-[210mm] min-h-[148mm] p-8 shadow-sm border border-slate-200 relative">

                        {/* Watermark */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden">
                            {data.schoolLogo ? (
                                <img src={data.schoolLogo} alt="Watermark" className="w-96 h-96 object-contain grayscale" />
                            ) : (
                                <span className="text-9xl font-bold rotate-45">PAID</span>
                            )}
                        </div>

                        {/* Header */}
                        <div className="relative z-10 border-b-2 border-slate-800 pb-6 mb-6 flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                {data.schoolLogo && (
                                    <img src={data.schoolLogo} alt="Logo" className="h-20 w-20 object-contain" />
                                )}
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{data.schoolName}</h1>
                                    <div className="text-sm text-slate-500 space-y-0.5 mt-1">
                                        {data.schoolAddress && <p>{data.schoolAddress}</p>}
                                        {data.schoolPhone && <p>Tel: {data.schoolPhone}</p>}
                                        {data.schoolEmail && <p>Email: {data.schoolEmail}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-bold text-slate-800 uppercase mb-1">Official Receipt</h2>
                                <p className="text-sm text-slate-500">No: <span className="font-mono font-bold text-slate-700">{data.transactionId.slice(0, 8).toUpperCase()}</span></p>
                                <p className="text-sm text-slate-500">Date: <span className="font-bold text-slate-700">{new Date(data.date).toLocaleDateString()}</span></p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="relative z-10 space-y-6">

                            {/* Student Details */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Received From</p>
                                    <p className="font-bold text-lg text-slate-800">{data.studentName}</p>
                                    <p className="text-sm text-slate-600">ID: {data.studentId}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Class / Grade</p>
                                    <p className="font-bold text-lg text-slate-800">{data.studentClass}</p>
                                </div>
                            </div>

                            {/* Payment Details Table */}
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="text-left py-2 text-sm font-bold text-slate-600 uppercase">Description</th>
                                        <th className="text-right py-2 text-sm font-bold text-slate-600 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="py-4 text-slate-800">
                                            <p className="font-bold">{data.type}</p>
                                            <p className="text-sm text-slate-500">Method: {data.method} {data.reference ? `• Ref: ${data.reference}` : ''}</p>
                                        </td>
                                        <td className="py-4 text-right font-bold text-lg text-slate-900">
                                            {formatAmount(data.amount)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* --- REDESIGNED FOOTER SECTION --- */}
                            <div className="mt-8 pt-6 border-t-2 border-slate-100">
                                <div className="grid grid-cols-5 gap-8">

                                    {/* Left Side: Words & Signature */}
                                    <div className="col-span-3 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Amount in Words</p>
                                            <div className="text-slate-700 font-serif italic text-lg leading-relaxed">
                                                {currency.code} {data.amount} Only
                                            </div>
                                        </div>

                                        <div className="mt-12 pt-4">
                                            <div className="border-b border-slate-400 border-dashed w-64 mb-2"></div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authorized Signature</p>
                                        </div>
                                    </div>

                                    {/* Right Side: Financial Summary Card */}
                                    <div className="col-span-2 bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-slate-500">
                                                <span className="text-xs font-bold uppercase tracking-wide">Outstanding</span>
                                                <span className="font-mono font-medium">{formatAmount(data.previousBalance)}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-slate-800 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                <span className="text-sm font-bold flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Paid Now
                                                </span>
                                                <span className="font-mono font-bold text-green-700">{formatAmount(data.amount)}</span>
                                            </div>

                                            <div className="border-t border-slate-200 my-2"></div>

                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold text-right mb-1">New Balance</p>
                                                <p className={`text-2xl font-extrabold text-right ${data.newBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                    {formatAmount(data.newBalance)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Footer Meta */}
                            <div className="mt-8 flex justify-between items-center text-[10px] text-slate-300 uppercase tracking-widest font-medium">
                                <p>System Generated Receipt • base16 School Management</p>
                                <p>{new Date().toLocaleString()}</p>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeReceipt;
