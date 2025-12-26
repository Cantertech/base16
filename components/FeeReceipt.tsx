import React, { useRef } from 'react';
import { X, Printer, Download, Share2 } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

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
                            <Printer className="h-4 w-4" /> Print / PDF
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

                            {/* Summary Box */}
                            <div className="flex justify-end mt-4">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Previous Balance:</span>
                                        <span>{formatAmount(data.previousBalance)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">
                                        <span>Amount Paid:</span>
                                        <span>- {formatAmount(data.amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
                                        <span>Remaining Balance:</span>
                                        <span className={`${data.newBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatAmount(data.newBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Amount in Words (Simple Placeholder) */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-400 uppercase font-bold">Amount in Words</p>
                                <p className="text-sm text-slate-600 italic capitalize">
                                    {/* In a real app, use a number-to-words library here */}
                                    {currency.code} {data.amount} Only
                                </p>
                            </div>

                            {/* Footer / Signature */}
                            <div className="mt-12 pt-8 flex justify-between items-end">
                                <div className="text-xs text-slate-400">
                                    <p>Generated by Orbit School Management System</p>
                                    <p>{new Date().toLocaleString()}</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b border-slate-300 w-48 mb-2"></div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Authorized Signature</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeReceipt;
