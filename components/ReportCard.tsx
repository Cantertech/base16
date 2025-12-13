import React from 'react';
import { X, Printer, Building2 } from 'lucide-react';

interface Result {
    subject: string;
    classScore: number;
    examScore: number;
    total: number;
}

interface Student {
    id: string;
    name: string;
    class: string;
    attendance: number;
}

interface ReportCardProps {
    student: Student;
    results: Result[];
    schoolConfig: any;
    onClose: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ student, results, schoolConfig, onClose }) => {

    const getGrade = (score: number) => {
        if (score >= 80) return { grade: 'A', remark: 'Excellent' };
        if (score >= 70) return { grade: 'B', remark: 'Very Good' };
        if (score >= 60) return { grade: 'C', remark: 'Good' };
        if (score >= 50) return { grade: 'D', remark: 'Pass' };
        return { grade: 'F', remark: 'Fail' };
    };

    const getPosition = (score: number) => {
        // Randomized position for demo purposes
        const pos = Math.floor(Math.random() * 10) + 1;
        const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
        return `${pos}${suffix}`;
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">

                {/* Modal Controls (Hidden when printing) */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:hidden">
                    <h3 className="font-bold">Report Card Preview</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            <Printer className="h-4 w-4" /> Print PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Report Card Content */}
                <div className="p-8 md:p-12 print:p-8 space-y-8">

                    {/* School Header */}
                    <div className="flex flex-col items-center text-center border-b-2 border-slate-900 pb-6">
                        <div className="h-20 w-20 mb-4 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden">
                            {schoolConfig?.logo ? (
                                <img src={schoolConfig.logo} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                                <Building2 className="h-10 w-10 text-slate-400" />
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-wide">{schoolConfig?.name || 'School Name'}</h1>
                        <p className="text-slate-500 italic font-serif mt-1">{schoolConfig?.motto || 'Motto goes here'}</p>
                        <p className="text-sm font-bold text-slate-800 mt-2">TERMINAL ASSESSMENT REPORT - 2025</p>
                    </div>

                    {/* Student Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
                        <div>
                            <span className="block text-xs text-slate-500 uppercase font-bold">Name of Student</span>
                            <span className="font-bold text-slate-900 text-lg">{student.name}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-500 uppercase font-bold">Student ID</span>
                            <span className="font-mono text-slate-900">{student.id}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-500 uppercase font-bold">Class</span>
                            <span className="font-bold text-slate-900">{student.class}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-500 uppercase font-bold">Attendance</span>
                            <span className="font-bold text-slate-900">{student.attendance}/100</span>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div>
                        <table className="w-full border-collapse border border-slate-900">
                            <thead className="bg-slate-100 text-slate-900 print:bg-slate-100">
                                <tr>
                                    <th className="border border-slate-900 px-3 py-2 text-left uppercase text-xs font-bold w-1/3">Subject</th>
                                    <th className="border border-slate-900 px-3 py-2 text-center uppercase text-xs font-bold">Class (30)</th>
                                    <th className="border border-slate-900 px-3 py-2 text-center uppercase text-xs font-bold">Exam (70)</th>
                                    <th className="border border-slate-900 px-3 py-2 text-center uppercase text-xs font-bold">Total (100)</th>
                                    <th className="border border-slate-900 px-3 py-2 text-center uppercase text-xs font-bold">Grade</th>
                                    <th className="border border-slate-900 px-3 py-2 text-left uppercase text-xs font-bold">Remark</th>
                                    <th className="border border-slate-900 px-3 py-2 text-center uppercase text-xs font-bold">Pos.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((res, i) => {
                                    const { grade, remark } = getGrade(res.total);
                                    return (
                                        <tr key={i} className="text-sm">
                                            <td className="border border-slate-900 px-3 py-3 font-semibold">{res.subject}</td>
                                            <td className="border border-slate-900 px-3 py-3 text-center">{res.classScore}</td>
                                            <td className="border border-slate-900 px-3 py-3 text-center">{res.examScore}</td>
                                            <td className="border border-slate-900 px-3 py-3 text-center font-bold bg-slate-50 print:bg-transparent">{res.total}</td>
                                            <td className={`border border-slate-900 px-3 py-3 text-center font-bold ${grade === 'F' ? 'text-red-600' : ''}`}>{grade}</td>
                                            <td className="border border-slate-900 px-3 py-3 text-left italic">{remark}</td>
                                            <td className="border border-slate-900 px-3 py-3 text-center">{getPosition(res.total)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Remarks & Signature */}
                    <div className="grid grid-cols-2 gap-12 pt-8">
                        <div>
                            <p className="font-bold text-sm uppercase text-slate-500 mb-2">Class Teacher's Remarks:</p>
                            <p className="font-serif italic border-b border-slate-300 pb-1 mb-6">A disciplined and hardworking student. Keep it up!</p>

                            <p className="font-bold text-sm uppercase text-slate-500 mb-2">Principal's Remarks:</p>
                            <p className="font-serif italic border-b border-slate-300 pb-1">Promoted to the next class.</p>
                        </div>
                        <div className="flex flex-col justify-end items-center">
                            <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
                            <p className="font-bold uppercase text-xs">Principal's Signature & Stamp</p>
                        </div>
                    </div>

                    <div className="text-center text-xs text-slate-400 mt-8 pt-4 border-t border-slate-100">
                        Generated by Brainwave School Management System on {new Date().toLocaleDateString()}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReportCard;