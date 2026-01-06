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
            // 1. Create a temporary container for the clone
            // We place it off-screen but ensuring it has the full width/height needed
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '0';
            tempContainer.style.width = '210mm'; // A4 width
            tempContainer.style.zIndex = '-1';
            document.body.appendChild(tempContainer);

            // 2. Clone the receipt node
            const clone = receiptRef.current.cloneNode(true) as HTMLElement;

            // 3. Reset any scroll or max-height constraints on the clone to ensure full visibility
            clone.style.height = 'auto';
            clone.style.maxHeight = 'none';
            clone.style.overflow = 'visible';
            clone.style.transform = 'none'; // Clear potential transforms

            tempContainer.appendChild(clone);

            // 4. Capture the clone
            // We wait a tiny bit to ensure DOM is updated (though usually synchronous for append)
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(clone, {
                scale: 2, // Higher quality
                backgroundColor: '#ffffff',
                useCORS: true, // For images
                logging: false,
                windowWidth: tempContainer.scrollWidth,
                windowHeight: tempContainer.scrollHeight
            } as any);

            // 5. Generate PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Receipt_${data.transactionId}.pdf`);

            // 6. Cleanup
            document.body.removeChild(tempContainer);

        } catch (error) {
            console.error('PDF Generation failed', error);
            alert('Failed to generate PDF. Please try again.');
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
                        <div className="relative z-10 border-b-2 border-slate-800 pb-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left w-full md:w-auto">
                                {data.schoolLogo && (
                                    <img src={data.schoolLogo} alt="Logo" className="h-16 w-16 md:h-20 md:w-20 object-contain mx-auto md:mx-0" />
                                )}
                                <div>
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight leading-tight">{data.schoolName}</h1>
                                    <div className="text-xs md:text-sm text-slate-500 space-y-0.5 mt-1">
                                        {data.schoolAddress && <p>{data.schoolAddress}</p>}
                                        {data.schoolPhone && <p>Tel: {data.schoolPhone}</p>}
                                        {data.schoolEmail && <p>Email: {data.schoolEmail}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="text-center md:text-right w-full md:w-auto mt-4 md:mt-0 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg">
                                <h2 className="text-lg md:text-xl font-bold text-slate-800 uppercase mb-1">Official Receipt</h2>
                                <div className="flex flex-row md:flex-col justify-between md:justify-end gap-4 md:gap-0">
                                    <p className="text-sm text-slate-500">No: <span className="font-mono font-bold text-slate-700">{data.transactionId.slice(0, 8).toUpperCase()}</span></p>
                                    <p className="text-sm text-slate-500">Date: <span className="font-bold text-slate-700">{new Date(data.date).toLocaleDateString()}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="relative z-10 space-y-6">

                            {/* Student Details */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                                <div className="text-center sm:text-left">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Received From</p>
                                    <p className="font-bold text-lg text-slate-800">{data.studentName}</p>
                                    <p className="text-sm text-slate-600">ID: {data.studentId}</p>
                                </div>
                                <div className="text-center sm:text-right border-t sm:border-t-0 border-slate-200 pt-2 sm:pt-0 mt-2 sm:mt-0">
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
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

                                    {/* Left Side: Words & Signature */}
                                    <div className="md:col-span-3 flex flex-col justify-between order-2 md:order-1">
                                        <div className="mb-6 md:mb-0 text-center md:text-left">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Amount in Words</p>
                                            <div className="text-slate-700 font-serif italic text-base md:text-lg leading-relaxed bg-slate-50 md:bg-transparent p-2 md:p-0 rounded">
                                                {currency.code} {data.amount} Only
                                            </div>
                                        </div>

                                        <div className="mt-8 md:mt-12 pt-4 flex flex-col items-center md:items-start">
                                            <div className="border-b border-slate-400 border-dashed w-48 md:w-64 mb-2"></div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authorized Signature</p>
                                        </div>
                                    </div>

                                    {/* Right Side: Financial Summary Card */}
                                    <div className="md:col-span-2 md:pl-4 order-1 md:order-2">
                                        <div className="bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-xl space-y-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Previous Balance</span>
                                                <span className="font-mono text-sm font-semibold text-slate-500">{formatAmount(data.previousBalance)}</span>
                                            </div>

                                            <div className="flex justify-between items-end">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paid Now</span>
                                                <span className="font-mono text-lg font-bold text-slate-800">{formatAmount(data.amount)}</span>
                                            </div>

                                            <div className="border-t-2 border-slate-200 md:border-slate-100 my-2"></div>

                                            <div className="flex justify-between items-end">
                                                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Balance Due</span>
                                                <span className={`font-mono text-xl font-bold ${data.newBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                    {formatAmount(data.newBalance)}
                                                </span>
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
