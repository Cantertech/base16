import React, { useRef, useState } from 'react';
import { X, Printer, Building2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

interface Result {
    subject: string;
    classScore: number;
    examScore: number;
    total: number;
    grade?: string;
    remarks?: string;
}

interface Student {
    id: string;
    name: string;
    class: string;
    attendance: number;
    photo?: string;
}

interface SchoolConfig {
    name: string;
    logo_url?: string;
    motto?: string;
    address?: string;
    phone?: string;
    email?: string;
    academic_year?: string;
    term?: string;
    grading?: { min: number; max: number; grade: string; remark: string }[];
}

interface ReportCardProps {
    student: Student;
    results: Result[];
    onClose: () => void;
    schoolConfig?: SchoolConfig;
}

const ReportCard: React.FC<ReportCardProps> = ({ student, results, onClose, schoolConfig }) => {
    const componentRef = useRef<HTMLDivElement>(null);

    // Editable State
    const [teacherRemark, setTeacherRemark] = useState("A disciplined and hardworking student. Keep it up!");
    const [principalRemark, setPrincipalRemark] = useState("Promoted to the next class.");

    const handlePrint = useReactToPrint({
        content: () => {
            const element = componentRef.current || document.getElementById('report-card-content');
            if (!element) {
                console.error("Print content not found!");
            }
            return element;
        },
        documentTitle: `${student.name}_Report_Card`,
        onAfterPrint: () => console.log("Print finished"),
        onPrintError: (errorLocation, error) => console.error("Print Error:", errorLocation, error),
    });

    // Helper to calculate grade if not provided
    const calculateGrade = (score: number) => {
        if (schoolConfig?.grading) {
            const grade = schoolConfig.grading.find(g => score >= g.min && score <= g.max);
            return grade ? grade.grade : 'F';
        }
        // Default grading
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    };

    const calculateRemark = (score: number) => {
        if (schoolConfig?.grading) {
            const grade = schoolConfig.grading.find(g => score >= g.min && score <= g.max);
            return grade ? grade.remark : 'Fail';
        }
        if (score >= 80) return 'Excellent';
        if (score >= 70) return 'Very Good';
        if (score >= 60) return 'Good';
        if (score >= 50) return 'Pass';
        return 'Fail';
    };

    const overallTotal = results.reduce((sum, r) => sum + r.total, 0);
    const overallAverage = results.length > 0 ? (overallTotal / results.length).toFixed(1) : '0.0';

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            {/* Modal Container - constrained height */}
            <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">

                {/* Fixed Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 rounded-t-xl print:hidden">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-400" /> Student Report Card
                    </h2>
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-slate-400 mr-4 hidden sm:block">
                            <span className="font-bold text-yellow-400">Tip:</span> You can edit the remarks below before printing.
                        </p>
                        <button
                            onClick={() => handlePrint()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Printer className="h-4 w-4" /> Print Report
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto flex-1 bg-slate-100 p-4 md:p-8">
                    {/* Printable Paper */}
                    <div ref={componentRef} id="report-card-content" className="bg-white max-w-3xl mx-auto p-8 md:p-12 shadow-sm min-h-[1123px] flex flex-col print:shadow-none print:p-0">

                        {/* Header Section */}
                        <div className="flex justify-between items-start border-b-4 border-blue-900 pb-6 mb-8">
                            <div className="flex items-center gap-6">
                                <div className="h-24 w-24 bg-slate-50 rounded-full border-2 border-slate-200 flex items-center justify-center overflow-hidden print-color-adjust-exact">
                                    {schoolConfig?.logo_url ? (
                                        <img src={schoolConfig.logo_url} alt="School Logo" className="h-full w-full object-cover" />
                                    ) : (
                                        <Building2 className="h-12 w-12 text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-1">
                                        {schoolConfig?.name || 'Brainwave Academy'}
                                    </h1>
                                    <p className="text-slate-500 font-serif italic text-lg mb-2">
                                        "{schoolConfig?.motto || 'Excellence in Education'}"
                                    </p>
                                    <div className="text-sm text-slate-600 space-y-0.5">
                                        <p>{schoolConfig?.address || '123 Education Lane, Accra, Ghana'}</p>
                                        <p>{schoolConfig?.email || 'info@brainwave.edu.gh'} | {schoolConfig?.phone || '+233 20 000 0000'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 mb-2 print-color-adjust-exact">
                                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Academic Year</p>
                                    <p className="text-lg font-bold text-blue-900">{schoolConfig?.academic_year || '2024/2025'}</p>
                                </div>
                                <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 print-color-adjust-exact">
                                    <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">Term</p>
                                    <p className="text-lg font-bold text-orange-900">{schoolConfig?.term || 'First Term'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Student Details */}
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8 flex justify-between items-center print-color-adjust-exact">
                            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Student Name</p>
                                    <p className="text-xl font-bold text-slate-900">{student.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Student ID</p>
                                    <p className="text-lg font-medium text-slate-700 font-mono">{student.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Class</p>
                                    <p className="text-lg font-medium text-slate-700">{student.class}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Attendance</p>
                                    <p className="text-lg font-medium text-slate-700">{student.attendance}%</p>
                                </div>
                            </div>
                            <div className="h-32 w-32 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                                {student.photo ? (
                                    <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="text-center p-2">
                                        <div className="h-16 w-16 bg-slate-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-slate-400">{student.name.charAt(0)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Student Photo</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="flex-1">
                            <table className="w-full border-collapse mb-8">
                                <thead>
                                    <tr className="bg-slate-900 text-white print-color-adjust-exact">
                                        <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider rounded-tl-lg">Subject</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider w-24">Class (30%)</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider w-24">Exam (70%)</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider w-24 bg-blue-800">Total (100%)</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider w-20">Grade</th>
                                        <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider w-48 rounded-tr-lg">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 border border-slate-200">
                                    {results.map((result, index) => {
                                        const grade = calculateGrade(result.total);
                                        const remark = calculateRemark(result.total);
                                        return (
                                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50 print:bg-slate-50'}>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-800 border-r border-slate-200">{result.subject}</td>
                                                <td className="px-4 py-3 text-sm text-center text-slate-600 border-r border-slate-200">{result.classScore}</td>
                                                <td className="px-4 py-3 text-sm text-center text-slate-600 border-r border-slate-200">{result.examScore}</td>
                                                <td className="px-4 py-3 text-sm text-center font-bold text-blue-700 bg-blue-50 border-r border-slate-200 print-color-adjust-exact">{result.total}</td>
                                                <td className={`px - 4 py - 3 text - sm text - center font - bold border - r border - slate - 200 ${grade === 'A' || grade === 'B' ? 'text-green-600' :
                                                    grade === 'F' ? 'text-red-600' : 'text-slate-700'
                                                    } `}>{grade}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 italic">{remark}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 border-t-2 border-slate-300 print-color-adjust-exact">
                                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right uppercase" colSpan={3}>Overall Average</td>
                                        <td className="px-4 py-3 text-sm font-black text-center text-slate-900 bg-slate-200 print-color-adjust-exact">{overallAverage}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Editable Remarks & Signatures */}
                        <div className="grid grid-cols-2 gap-12 mt-auto">
                            <div>
                                <p className="font-bold text-sm uppercase text-slate-500 mb-2">Class Teacher's Remarks:</p>
                                <textarea
                                    className="w-full font-serif italic border-b border-slate-300 pb-1 mb-6 text-slate-800 resize-none overflow-hidden bg-transparent outline-none focus:border-blue-500 transition-colors"
                                    value={teacherRemark}
                                    onChange={(e) => setTeacherRemark(e.target.value)}
                                    rows={2}
                                />

                                <p className="font-bold text-sm uppercase text-slate-500 mb-2">Principal's Remarks:</p>
                                <textarea
                                    className="w-full font-serif italic border-b border-slate-300 pb-1 text-slate-800 resize-none overflow-hidden bg-transparent outline-none focus:border-blue-500 transition-colors"
                                    value={principalRemark}
                                    onChange={(e) => setPrincipalRemark(e.target.value)}
                                    rows={2}
                                />
                            </div>
                            <div className="flex flex-col justify-end items-center">
                                <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
                                <p className="font-bold uppercase text-xs text-slate-900">Principal's Signature & Stamp</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-[10px] text-slate-400 mt-8 pt-4 border-t border-slate-100">
                            Generated by Brainwave School Management System on {new Date().toLocaleDateString()}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportCard;