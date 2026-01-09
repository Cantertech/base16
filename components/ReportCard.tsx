import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Building2, Save } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../utils/supabaseClient';

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
    name?: string;
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
    grading?: { min: number; max: number; grade: string; remark: string; points?: number }[];
    grading_type?: 'STANDARD' | 'COMPETENCY';
}

interface ReportCardProps {
    student: Student;
    results: Result[];
    onClose: () => void;
    schoolConfig?: SchoolConfig;
    position?: { position: number; total: number } | null;
    schoolId?: string;
}

const ReportCard: React.FC<ReportCardProps> = ({ student, results, onClose, schoolConfig, position, schoolId }) => {
    const componentRef = useRef<HTMLDivElement>(null);

    // Helper to guess next class
    const getNextClass = (currentClass: string) => {
        const c = currentClass.trim();
        // Handle common patterns
        if (c.match(/Basic\s*(\d+)/i)) {
            const num = parseInt(c.match(/(\d+)/)![0]);
            return c.replace(num.toString(), (num + 1).toString());
        }
        if (c.match(/JHS\s*(\d+)/i)) {
            const num = parseInt(c.match(/(\d+)/)![0]);
            if (num >= 3) return "Graduated";
            return c.replace(num.toString(), (num + 1).toString());
        }
        if (c.match(/KG\s*1/i)) return c.replace('1', '2');
        if (c.match(/KG\s*2/i)) return "Basic 1";
        if (c.match(/Nursery\s*1/i)) return c.replace('1', '2');
        if (c.match(/Nursery\s*2/i)) return "KG 1";
        // Default fallback
        return `Next Class`;
    };

    // Editable State
    const [teacherRemark, setTeacherRemark] = useState("A disciplined and hardworking student. Keep it up!");
    const [principalRemark, setPrincipalRemark] = useState("Promoted to the next class.");
    const [promotionStatus, setPromotionStatus] = useState(`Promoted to ${getNextClass(student.class)}`);
    const [isSaving, setIsSaving] = useState(false);
    const [attendanceStats, setAttendanceStats] = useState<{ present: number, total: number } | null>(null);

    // Fetch Detailed Attendance
    useEffect(() => {
        const fetchAtt = async () => {
            const { data } = await supabase.rpc('get_student_attendance_summary', { p_student_id: student.id });
            if (data) setAttendanceStats(data);
        };
        fetchAtt();
    }, [student.id]);

    // Fetch Saved Report Data
    useEffect(() => {
        if (schoolId && schoolConfig?.term && schoolConfig?.academic_year) {
            const loadSaved = async () => {
                const { data } = await supabase.from('student_report_cards')
                    .select('*')
                    .eq('school_id', schoolId)
                    .eq('student_id', student.id)
                    .eq('term', schoolConfig.term)
                    .eq('academic_year', schoolConfig.academic_year)
                    .single();
                if (data) {
                    if (data.teacher_remark) setTeacherRemark(data.teacher_remark);
                    if (data.principal_remark) setPrincipalRemark(data.principal_remark);
                    if (data.promotion_status) setPromotionStatus(data.promotion_status);
                }
            };
            loadSaved();
        }
    }, [schoolId, student.id, schoolConfig]);

    const handleSave = async () => {
        if (!schoolId) return;
        setIsSaving(true);
        const { error } = await supabase.rpc('save_student_report', {
            p_school_id: schoolId,
            p_student_id: student.id,
            p_class: student.class,
            p_term: schoolConfig?.term || '',
            p_year: schoolConfig?.academic_year || '',
            p_teacher_remark: teacherRemark,
            p_principal_remark: principalRemark,
            p_promotion_status: promotionStatus,
            p_position: position?.position || 0,
            p_total_students: position?.total || 0
        });
        setIsSaving(false);
        if (!error) {
            // Optional: Toast or feedback
        } else {
            console.error('Save failed', error);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `${student.name}_Report_Card`,
        onAfterPrint: () => console.log("Print finished"),
        onPrintError: (errorLocation, error) => console.error("Print Error:", errorLocation, error),
    });

    // Helper to calculate grade if not provided
    const calculateGrade = (score: number) => {
        if (schoolConfig?.grading && Array.isArray(schoolConfig.grading)) {
            const grade = schoolConfig.grading.find(g => Number(score) >= Number(g.min) && Number(score) <= Number(g.max));
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
        if (schoolConfig?.grading && Array.isArray(schoolConfig.grading)) {
            const grade = schoolConfig.grading.find(g => Number(score) >= Number(g.min) && Number(score) <= Number(g.max));
            return grade ? grade.remark : 'Fail';
        }
        if (score >= 80) return 'Excellent';
        if (score >= 70) return 'Very Good';
        if (score >= 60) return 'Good';
        if (score >= 50) return 'Pass';
        return 'Fail';
    };

    const calculatePoints = (score: number) => {
        if (schoolConfig?.grading && Array.isArray(schoolConfig.grading)) {
            const grade = schoolConfig.grading.find(g => Number(score) >= Number(g.min) && Number(score) <= Number(g.max));
            return grade?.points ?? 0;
        }
        return 0; // Default if no system
    };

    const overallTotal = results.reduce((sum, r) => sum + r.total, 0);
    const overallAverage = results.length > 0 ? (overallTotal / results.length).toFixed(1) : '0.0';

    const totalPoints = results.reduce((sum, r) => sum + calculatePoints(r.total), 0);
    const gpa = results.length > 0 ? (totalPoints / results.length).toFixed(2) : '0.00';
    const hasPointsSystem = schoolConfig?.grading?.some(g => g.points !== undefined && g.points > 0);

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm overflow-hidden">
            {/* Modal Container - constrained height */}
            <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[95vh] h-full md:h-auto animate-in fade-in zoom-in-95 duration-200">

                {/* Fixed Header */}
                <div className="bg-slate-900 text-white p-3 md:p-4 flex justify-between items-center shrink-0 rounded-t-xl print:hidden">
                    <h2 className="font-bold text-base md:text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4 md:h-5 md:w-5 text-blue-400" /> Student Report Card
                    </h2>
                    <div className="flex items-center gap-2 md:gap-3">
                        <p className="text-xs text-slate-400 mr-4 hidden md:block">
                            <span className="font-bold text-yellow-400">Tip:</span> You can edit the remarks below before printing.
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            <Save className="h-3 w-3 md:h-4 md:w-4" /> <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                            onClick={() => handlePrint()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-colors"
                        >
                            <Printer className="h-3 w-3 md:h-4 md:w-4" /> <span className="hidden sm:inline">Print Report</span><span className="sm:hidden">Print</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5">
                            <X className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto flex-1 bg-slate-100 p-2 md:p-8">
                    {/* Printable Paper */}
                    <div ref={componentRef} id="report-card-content" className="bg-white max-w-3xl mx-auto p-4 md:p-12 shadow-sm min-h-[800px] md:min-h-[1123px] flex flex-col print:shadow-none print:p-0 print:min-h-0">

                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between items-center md:items-start border-b-4 border-blue-900 pb-4 md:pb-6 mb-6 md:mb-8 text-center md:text-left">
                            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-4 md:mb-0">
                                <div className="h-16 w-16 md:h-24 md:w-24 bg-slate-50 rounded-full border-2 border-slate-200 flex items-center justify-center overflow-hidden print-color-adjust-exact shrink-0">
                                    {schoolConfig?.logo_url ? (
                                        <img src={schoolConfig.logo_url} alt="School Logo" className="h-full w-full object-cover" />
                                    ) : (
                                        <Building2 className="h-8 w-8 md:h-12 md:w-12 text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight mb-1">
                                        {schoolConfig?.name || 'Base16 Academy'}
                                    </h1>
                                    <p className="text-slate-500 font-serif italic text-base md:text-lg mb-2">
                                        "{schoolConfig?.motto || 'Excellence in Education'}"
                                    </p>
                                    <div className="text-xs md:text-sm text-slate-600 space-y-0.5">
                                        <p>{schoolConfig?.address || '123 Education Lane, Accra, Ghana'}</p>
                                        <p>{schoolConfig?.email || 'info@brainwave.edu.gh'} | {schoolConfig?.phone || '+233 20 000 0000'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-center md:text-right flex md:block gap-2 md:gap-0 justify-center w-full md:w-auto">
                                <div className="bg-blue-50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-blue-100 mb-0 md:mb-2 print-color-adjust-exact">
                                    <p className="text-[10px] md:text-xs text-blue-600 font-bold uppercase tracking-wider">Academic Year</p>
                                    <p className="text-sm md:text-lg font-bold text-blue-900">{schoolConfig?.academic_year || '2024/2025'}</p>
                                </div>
                                <div className="bg-orange-50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-orange-100 print-color-adjust-exact">
                                    <p className="text-[10px] md:text-xs text-orange-600 font-bold uppercase tracking-wider">Term</p>
                                    <p className="text-sm md:text-lg font-bold text-orange-900">{schoolConfig?.term || 'First Term'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Student Details */}
                        <div className="bg-slate-50 rounded-xl p-4 md:p-6 border border-slate-200 mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 print-color-adjust-exact">
                            <div className="grid grid-cols-2 gap-x-8 md:gap-x-12 gap-y-3 md:gap-y-4 w-full sm:w-auto">
                                <div className="col-span-2 sm:col-span-1">
                                    <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 md:mb-1">Student Name</p>
                                    <p className="text-lg md:text-xl font-bold text-slate-900 truncate">{student.name}</p>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 md:mb-1">Student ID</p>
                                    <p className="text-base md:text-lg font-medium text-slate-700 font-mono">{student.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 md:mb-1">Class</p>
                                    <p className="text-base md:text-lg font-medium text-slate-700">{student.class}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 md:mb-1">Attendance</p>
                                    <p className="text-base md:text-lg font-medium text-slate-700">
                                        {attendanceStats ? `${attendanceStats.present} / ${attendanceStats.total}` : `${student.attendance}%`}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5 md:mb-1">Position</p>
                                    <p className="text-base md:text-lg font-bold text-blue-900">
                                        {position ? `${position.position} / ${position.total}` : '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="h-24 w-24 md:h-32 md:w-32 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                {student.photo ? (
                                    <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="text-center p-2">
                                        <div className="h-12 w-12 md:h-16 md:w-16 bg-slate-100 rounded-full mx-auto mb-1 md:mb-2 flex items-center justify-center">
                                            <span className="text-xl md:text-2xl font-bold text-slate-400">{student.name.charAt(0)}</span>
                                        </div>
                                        <p className="text-[8px] md:text-[10px] text-slate-400 uppercase font-bold">Student Photo</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="flex-1">
                            {/* Mobile Results List (Screen Only) */}
                            <div className="md:hidden space-y-3 mb-8 print:hidden">
                                {results.map((result, index) => {
                                    const grade = calculateGrade(result.total);
                                    const isCompetency = schoolConfig?.grading_type === 'COMPETENCY';

                                    return (
                                        <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-slate-800 text-sm">{result.subject}</h3>
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${grade === 'A' || grade === 'EE1' ? 'bg-green-100 text-green-700' :
                                                    grade === 'F' || grade === 'BE2' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {grade}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                                {!isCompetency && (
                                                    <div className="bg-white p-2 rounded border border-slate-100 text-center">
                                                        <span className="block text-slate-400 text-[10px] uppercase font-bold">Class</span>
                                                        <span className="font-mono font-medium">{result.classScore}</span>
                                                    </div>
                                                )}
                                                <div className={`bg-white p-2 rounded border border-slate-100 text-center ${isCompetency ? 'col-span-1' : ''}`}>
                                                    <span className="block text-slate-400 text-[10px] uppercase font-bold">Exam</span>
                                                    <span className="font-mono font-medium">{result.examScore}</span>
                                                </div>
                                                <div className="bg-blue-50 p-2 rounded border border-blue-100 text-center">
                                                    <span className="block text-blue-400 text-[10px] uppercase font-bold">Total</span>
                                                    <span className="font-black text-blue-800">{result.total}</span>
                                                </div>
                                            </div>

                                            {result.remarks && (
                                                <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2 mt-2">
                                                    "{result.remarks}"
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop/Print Results Table */}
                            <table className="w-full border-collapse mb-8 hidden md:table print:table min-w-full">
                                <thead>
                                    <tr className="bg-slate-900 text-white print:bg-transparent print:text-black print:border-b-2 print:border-black">
                                        <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-bold uppercase tracking-wider rounded-tl-lg print:rounded-none">Subject</th>
                                        {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                            <th className="px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold uppercase tracking-wider w-16 md:w-24">Class (30%)</th>
                                        )}
                                        <th className="px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold uppercase tracking-wider w-16 md:w-24">Exam {schoolConfig?.grading_type === 'COMPETENCY' ? '(100%)' : '(70%)'}</th>
                                        <th className="px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold uppercase tracking-wider w-16 md:w-24 bg-blue-800 print:bg-transparent print:text-black">Total (100%)</th>
                                        <th className="px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold uppercase tracking-wider w-12 md:w-20">Grade</th>
                                        {hasPointsSystem && <th className="px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold uppercase tracking-wider w-12 md:w-20">Points</th>}
                                        <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-bold uppercase tracking-wider w-32 md:w-48 rounded-tr-lg print:rounded-none">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 border border-slate-200 print:border-black">
                                    {results.map((result, index) => {
                                        const grade = calculateGrade(result.total);
                                        const remark = calculateRemark(result.total);
                                        const points = calculatePoints(result.total);
                                        return (
                                            <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50 print:bg-white'} print:border-b print:border-slate-200`}>
                                                <td className="px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-bold text-slate-800 border-r border-slate-200 print:border-black">{result.subject}</td>
                                                {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                                    <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-center text-slate-600 border-r border-slate-200 print:border-black">{result.classScore}</td>
                                                )}
                                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-center text-slate-600 border-r border-slate-200 print:border-black">{result.examScore}</td>
                                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-center font-bold text-blue-700 bg-blue-50 border-r border-slate-200 print:bg-transparent print:text-black print:border-black">{result.total}</td>
                                                <td className={`px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-center font-bold border-r border-slate-200 print:border-black print:text-black ${grade === 'A' || grade === 'B' || grade?.startsWith('EE') ? 'text-green-600' :
                                                    grade === 'F' || grade?.startsWith('BE') ? 'text-red-600' : 'text-slate-700'
                                                    } `}>{grade}</td>
                                                {hasPointsSystem && <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-center font-medium text-slate-700 border-r border-slate-200 print:border-black">{points}</td>}
                                                <td className="px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm text-slate-600 italic print:text-black">{remark}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 border-t-2 border-slate-300 print:bg-transparent print:border-black">
                                        <td className="px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-bold text-slate-900 text-right uppercase" colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 2 : 3}>Averages</td>
                                        <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm font-black text-center text-slate-900 bg-slate-200 print:bg-transparent print:border print:border-black">{overallAverage}</td>
                                        <td colSpan={1}></td>
                                        {hasPointsSystem && <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm font-black text-center text-blue-800 bg-blue-100 print:bg-transparent print:text-black">GPA: {gpa}</td>}
                                        <td colSpan={1}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Editable Remarks & Signatures */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mt-auto">
                            <div>
                                <p className="font-bold text-xs md:text-sm uppercase text-slate-500 mb-2">Class Teacher's Remarks:</p>
                                <textarea
                                    className="w-full font-serif italic border-b border-slate-300 pb-1 mb-6 text-slate-800 resize-none overflow-hidden bg-transparent outline-none focus:border-blue-500 transition-colors text-sm md:text-base"
                                    value={teacherRemark}
                                    onChange={(e) => setTeacherRemark(e.target.value)}
                                    rows={2}
                                />

                                <p className="font-bold text-xs md:text-sm uppercase text-slate-500 mb-2">Principal's Remarks:</p>
                                <textarea
                                    className="w-full font-serif italic border-b border-slate-300 pb-1 text-slate-800 resize-none overflow-hidden bg-transparent outline-none focus:border-blue-500 transition-colors text-sm md:text-base"
                                    value={principalRemark}
                                    onChange={(e) => setPrincipalRemark(e.target.value)}
                                    rows={2}
                                />

                                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <p className="font-bold text-xs md:text-sm uppercase text-slate-500 mb-1">Final Decision / Promotion:</p>
                                    <input
                                        type="text"
                                        value={promotionStatus}
                                        onChange={(e) => setPromotionStatus(e.target.value)}
                                        className="w-full font-bold text-slate-900 bg-transparent outline-none border-b border-slate-300 focus:border-blue-500 pb-1"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col justify-end items-center mt-4 md:mt-0">
                                <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
                                <p className="font-bold uppercase text-[10px] md:text-xs text-slate-900">Principal's Signature & Stamp</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-[8px] md:text-[10px] text-slate-400 mt-8 pt-4 border-t border-slate-100">
                            Generated by Base16 School Management System on {new Date().toLocaleDateString()}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportCard;