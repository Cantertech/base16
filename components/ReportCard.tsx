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
    report_card_config?: {
        layout?: string;
        show_position?: boolean;
        show_attendance?: boolean;
        show_class_teacher_remark?: boolean;
        show_head_teacher_remark?: boolean;
        show_student_photo?: boolean;
        nursery_classes?: string[];
    };
}

interface ReportCardProps {
    student: Student;
    results: Result[];
    onClose: () => void;
    schoolConfig?: SchoolConfig;
    position?: { position: number; total: number } | null;
    schoolId?: string;
    printMode?: boolean;
    savedReportData?: any;
}

const ReportCard: React.FC<ReportCardProps> = ({ student, results, onClose, schoolConfig, position, schoolId, printMode, savedReportData }) => {
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
    const [teacherRemark, setTeacherRemark] = useState(savedReportData?.teacher_remark || "A disciplined and hardworking student. Keep it up!");
    const [principalRemark, setPrincipalRemark] = useState(savedReportData?.principal_remark || "Promoted to the next class.");
    const [promotionStatus, setPromotionStatus] = useState(savedReportData?.promotion_status || `Promoted to ${getNextClass(student.class)}`);
    const [conduct, setConduct] = useState(savedReportData?.conduct || "Satisfactory");
    const [interest, setInterest] = useState(savedReportData?.interest || "Information Technology");
    const [attendancePresentDays, setAttendancePresentDays] = useState<number>(savedReportData?.attendance_present || 0);
    const [attendanceTotalDays, setAttendanceTotalDays] = useState<number>(savedReportData?.attendance_total || 0);
    const [pupilBill, setPupilBill] = useState<number>(savedReportData?.pupil_bill ? Number(savedReportData.pupil_bill) : 0);
    const [otherFees, setOtherFees] = useState<number>(savedReportData?.other_fees ? Number(savedReportData.other_fees) : 0);
    const [nextClass, setNextClass] = useState(savedReportData?.next_class || getNextClass(student.class));
    const [isSaving, setIsSaving] = useState(false);
    const [attendanceStats, setAttendanceStats] = useState<{ present: number, total: number } | null>(null);

    // Fetch Detailed Attendance
    useEffect(() => {
        const fetchAtt = async () => {
            if (!student.id || student.id.includes('preview')) return;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(student.id)) return;

            const { data, error } = await supabase.rpc('get_student_attendance_summary', { p_student_id: student.id });
            if (!error && data) {
                setAttendanceStats(data);
                // Set defaults if not yet manually edited (handled in loadSaved too)
                setAttendancePresentDays(d => d === 0 ? data.present : d);
                setAttendanceTotalDays(d => d === 0 ? data.total : d);
            }
        };
        fetchAtt();
    }, [student.id]);

    // Initialize Defaults from Config if no saved data exists
    useEffect(() => {
        const config = schoolConfig?.report_card_config as any;
        const classFeesMap = (schoolConfig as any)?.class_fees;

        const initFees = async () => {
            if (config?.billing_mode === 'manual' && classFeesMap && student.class) {
                const classFees = classFeesMap[student.class];
                if (classFees) {
                    setPupilBill(prev => prev === 0 ? (typeof classFees === 'object' ? (classFees.tuition || 0) : Number(classFees)) : prev);
                    setOtherFees(prev => prev === 0 ? (typeof classFees === 'object' ? (classFees.others || 0) : 0) : prev);
                }
            } else if (config?.billing_mode === 'system' && schoolId && student.class) {
                // Fetch live from fee_structure
                const { data, error } = await supabase
                    .from('fee_structure')
                    .select('*')
                    .eq('school_id', schoolId)
                    .or(`target_class.is.null,target_class.eq."${student.class}"`)
                    .eq('term', schoolConfig?.current_term || schoolConfig?.term || '')
                    .eq('academic_year', schoolConfig?.academic_year || '');

                if (!error && data && data.length > 0) {
                    // Logic: sum up everything containing 'tuition' or 'school fee' for PupilBill, others for OtherFees
                    const tuitionKeywords = ['tuition', 'school fee', 'admission', 'enrollment'];
                    let tSum = 0;
                    let oSum = 0;

                    data.forEach(fee => {
                        const name = fee.name.toLowerCase();
                        if (tuitionKeywords.some(kw => name.includes(kw))) {
                            tSum += Number(fee.amount);
                        } else {
                            oSum += Number(fee.amount);
                        }
                    });

                    setPupilBill(prev => prev === 0 ? tSum : prev);
                    setOtherFees(prev => prev === 0 ? oSum : prev);
                }
            }
        };

        initFees();
    }, [schoolConfig, student.class, schoolId]);

    // Fetch Saved Report Data
    useEffect(() => {
        if (savedReportData) return;
        const term = schoolConfig?.current_term || schoolConfig?.term;
        const year = schoolConfig?.academic_year;

        if (schoolId && student.id && !student.id.includes('preview') && term && year) {
            const loadSaved = async () => {
                const { data } = await supabase.from('student_report_cards')
                    .select('*')
                    .eq('school_id', schoolId)
                    .eq('student_id', student.id)
                    .eq('term', term)
                    .eq('academic_year', year)
                    .maybeSingle();
                if (data) {
                    if (data.teacher_remark) setTeacherRemark(data.teacher_remark);
                    if (data.principal_remark) setPrincipalRemark(data.principal_remark);
                    if (data.promotion_status) setPromotionStatus(data.promotion_status);
                    if (data.conduct) setConduct(data.conduct);
                    if (data.interest) setInterest(data.interest);
                    if (data.attendance_present !== null) setAttendancePresentDays(data.attendance_present);
                    if (data.attendance_total !== null) setAttendanceTotalDays(data.attendance_total);
                    if (data.pupil_bill !== null) setPupilBill(Number(data.pupil_bill));
                    if (data.other_fees !== null) setOtherFees(Number(data.other_fees));
                    if (data.next_class) setNextClass(data.next_class);
                }
            };
            loadSaved();
        }
    }, [schoolId, student.id, schoolConfig]);

    const handleSave = async () => {
        if (!schoolId) {
            alert("Cannot save: Missing School ID. Please refresh.");
            return;
        }
        setIsSaving(true);
        try {
            const term = schoolConfig?.current_term || schoolConfig?.term || '';
            const { error } = await supabase.rpc('save_student_report', {
                p_school_id: schoolId,
                p_student_id: student.id,
                p_class: student.class,
                p_term: term,
                p_year: schoolConfig?.academic_year || '',
                p_teacher_remark: teacherRemark,
                p_principal_remark: principalRemark,
                p_promotion_status: promotionStatus,
                p_position: position?.position || 0,
                p_total_students: position?.total || 0,
                p_attendance_present: attendancePresentDays,
                p_attendance_total: attendanceTotalDays,
                p_next_class: nextClass,
                p_pupil_bill: pupilBill,
                p_other_fees: otherFees,
                p_conduct: conduct,
                p_interest: interest
            });

            if (error) throw error;
            alert("Report card details saved successfully!");
        } catch (err: any) {
            console.error('Save failed', err);
            alert(`Failed to save report: ${err.message}`);
        } finally {
            setIsSaving(false);
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

    const isClassic = schoolConfig?.report_card_config?.layout === 'classic_tabular';
    const isNursery = (schoolConfig?.report_card_config as any)?.use_nursery_layout !== false && (
        student.class.toLowerCase().includes('nursery') ||
        student.class.toLowerCase().includes('kg') ||
        student.class.toLowerCase().includes('creche') ||
        student.class.toLowerCase().includes('preschool')
    );

    const nurseryContent = (
        <div ref={printMode ? undefined : componentRef} className={`bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-12 print:p-4 print:p-2 min-h-[1056px] print:min-h-0 text-slate-800 flex flex-col font-serif relative overflow-hidden ${printMode ? 'p-0 shadow-none' : 'shadow-2xl border border-slate-100'}`} style={{ fontFamily: 'Georgia, serif' }}>

            {/* Soft background pattern for Nursery */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

            {/* Header */}
            <div className="text-center mb-10 print:mb-3 relative">
                <div className="flex justify-center items-center gap-8 print:gap-4 print:p-4 print:p-2 mb-6 print:mb-2">
                    {schoolConfig?.logo_url && (
                        <div className="h-20 w-20 print:h-14 print:w-14 md:h-28 print:h-28 md:w-28 print:w-28 flex items-center justify-center p-2 bg-white border border-slate-200 rounded-full shadow-sm print-color-adjust-exact">
                            <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    <div className="h-20 w-20 print:h-14 print:w-14 md:h-28 print:h-28 md:w-28 print:w-28 bg-slate-50 border-2 border-slate-900 rounded shadow-md flex items-center justify-center overflow-hidden shrink-0">
                        {student.photo ? (
                            <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                            <Building2 className="w-8 h-8 text-slate-200" />
                        )}
                    </div>
                </div>
                <h1 className="font-black text-2xl md:text-4xl print:text-4xl uppercase tracking-tighter text-slate-900 mb-2">{schoolConfig?.name || 'NAME OF SCHOOL'}</h1>
                <p className="text-[10px] md:text-xs print:text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mb-4">Foundation Stage Unit</p>
                <div className="h-1 w-24 bg-slate-900 mx-auto rounded-full"></div>
                <h2 className="font-black text-lg md:text-2xl print:text-2xl uppercase tracking-widest mt-6 text-slate-800">Learner's Progress Report</h2>
            </div>

            {/* Student Persona Grid */}
            <div className="bg-slate-50 rounded-2xl p-6 print:p-3 print:py-1 print:px-2 mb-8 print:mb-3 border border-slate-200 grid grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-6 print:gap-3 print:p-3 print:py-1 print:px-2 relative z-10">
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Child's Full Name</span>
                    <p className="text-sm md:text-lg print:text-lg font-black text-slate-900 border-b border-slate-300 pb-1">{student.name}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Class / Developmental Stage</span>
                    <p className="text-sm md:text-lg print:text-lg font-black text-slate-900 border-b border-slate-300 pb-1">{student.class}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Academic Session</span>
                    <p className="text-sm md:text-lg print:text-lg font-black text-slate-900 border-b border-slate-300 pb-1">{schoolConfig?.academic_year || '2025'}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Term</span>
                    <p className="text-sm font-black text-slate-700 border-b border-slate-200 pb-1">{schoolConfig?.current_term || schoolConfig?.term || 'First Term'}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Attendance</span>
                    <p className="text-sm font-black text-slate-700 border-b border-slate-200 pb-1">{attendancePresentDays} / {attendanceTotalDays || '-'}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Next Level Begins</span>
                    <p className="text-sm font-black text-slate-700 border-b border-slate-200 pb-1">
                        {schoolConfig?.next_term_reopens ? new Date(schoolConfig.next_term_reopens).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '................'}
                    </p>
                </div>
            </div>

            {/* Core Assessment Areas */}
            <div className="space-y-4 mb-10 print:mb-3 flex-1">
                <div className="flex items-center gap-4 print:p-2 mb-6 print:mb-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-3 py-1 print:bg-transparent print:border-y-2 print:border-slate-900 print:text-slate-900">Assessment of Learning Fields</h3>
                    <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                <div className="grid grid-cols-1 gap-y-6">
                    {results.length > 0 ? results.map((result, idx) => (
                        <div key={idx} className="group">
                            <div className="flex justify-between items-end gap-4 print:p-2 mb-1">
                                <span className="text-xs font-black uppercase text-slate-900 tracking-wide">{result.subject}</span>
                                <span className="text-[10px] font-bold text-slate-500 italic">
                                    {result.total >= 80 ? 'Mastered / Exceeding' : result.total >= 60 ? 'Developing / Expected' : 'Emerging / Needs Support'}
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${result.total >= 80 ? 'bg-green-500' : result.total >= 60 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                    style={{ width: `${result.total}%` }}
                                ></div>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-slate-400 font-bold italic">No specific assessment data recorded for this term.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Qualitative Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4 print:p-4 print:p-2 mb-10 print:mb-3 pt-6 border-t border-slate-100">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.1em]">Class Teacher's Observation</span>
                            <textarea
                                value={teacherRemark}
                                onChange={(e) => setTeacherRemark(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 print:py-1 print:px-2 text-xs font-bold text-slate-800 italic leading-relaxed h-24 print:h-14 resize-none outline-none focus:border-slate-900 transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.1em]">Head of Foundation Stage Remarks</span>
                            <textarea
                                value={principalRemark}
                                onChange={(e) => setPrincipalRemark(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 print:py-1 print:px-2 text-xs font-bold text-slate-800 italic leading-relaxed h-16 print:h-10 resize-none outline-none focus:border-slate-900 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 print:gap-3 print:p-3 print:py-1 print:px-2">
                    <div className="bg-slate-900 text-white p-6 print:p-3 print:py-1 print:px-2 rounded-2xl shadow-lg relative overflow-hidden print:bg-white print:text-slate-900 print:border-2 print:border-slate-900">
                        <div className="relative z-10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-70">Tuition Summary for Next Level</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold opacity-60">Composite Fees</span>
                                    <span className="font-mono text-sm">GHS {pupilBill.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold opacity-60">Auxiliary Charges</span>
                                    <span className="font-mono text-sm">GHS {otherFees.toFixed(2)}</span>
                                </div>
                                <div className="pt-3 mt-3 border-t border-white/20 flex justify-between items-center">
                                    <span className="text-sm font-black uppercase tracking-tighter">Total Payable</span>
                                    <span className="text-xl font-black">GHS {(pupilBill + otherFees).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 print:p-2">
                        <div className="text-center pt-8">
                            <div className="h-px bg-slate-300 w-full mb-2"></div>
                            <span className="text-[8px] font-black uppercase text-slate-400">Class Teacher</span>
                        </div>
                        <div className="text-center pt-8">
                            <div className="h-px bg-slate-300 w-full mb-2"></div>
                            <span className="text-[8px] font-black uppercase text-slate-400">Headmistress</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between items-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Encouraging curiosity and lifelong learning since {schoolConfig?.name?.charAt(0) || 'O'}</p>
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-slate-100 rounded-full flex items-center justify-center">
                        <Building2 className="w-2.5 h-2.5 text-slate-400" />
                    </div>
                    <span className="text-[8px] font-black text-slate-300 uppercase">Orbit Learning Management System</span>
                </div>
            </div>
        </div>
    );

    const classicContent = (
        <div ref={printMode ? undefined : componentRef} className={`bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-12 print:p-4 print:p-2 min-h-[1056px] print:min-h-0 text-slate-900 flex flex-col font-serif relative overflow-hidden ${printMode ? 'p-0 shadow-none' : 'shadow-2xl border border-slate-200'}`} style={{ fontFamily: 'Georgia, serif' }}>

            {/* Watermark Logo (Print Only) */}
            {schoolConfig?.logo_url && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none w-[500px] h-[500px] hidden print:block">
                    <img src={schoolConfig.logo_url} alt="" className="w-full h-full object-contain grayscale" />
                </div>
            )}

            {/* Premium Header */}
            <div className="relative mb-10 print:mb-3 pb-6 border-b-2 border-slate-950">
                <div className="flex flex-col md:flex-row print:flex-row justify-between items-center gap-6 print:gap-3 print:p-3 print:py-1 print:px-2">
                    <div className="flex items-center gap-6 print:gap-3 print:p-3 print:py-1 print:px-2">
                        {schoolConfig?.logo_url && (
                            <div className="h-24 w-24 print:h-16 print:w-16 p-1 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center shrink-0">
                                <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                            </div>
                        )}
                        <div className="text-center md:text-left print:text-left">
                            <h1 className="text-2xl md:text-4xl print:text-4xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2 font-serif mt-2">
                                {schoolConfig?.name || 'NAME OF SCHOOL'}
                            </h1>
                            <div className="text-[10px] md:text-xs print:text-xs text-slate-700 font-bold uppercase tracking-wide space-y-1">
                                <p>{schoolConfig?.address || 'ADDRESS OF THE SCHOOL'}</p>
                                <p>TEL: {schoolConfig?.phone || 'CONTACT PHONE'} {schoolConfig?.email ? `| EMAIL: ${schoolConfig.email}` : ''}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 print:py-1 print:px-2 shrink-0">
                        {schoolConfig?.report_card_config?.show_student_photo !== false && (
                            <div className="h-28 w-28 print:h-16 print:w-16 bg-white border-4 border-slate-950 shadow-md flex items-center justify-center overflow-hidden relative">
                                {student.photo ? (
                                    <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="text-center p-2">
                                        <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                                        <span className="text-[8px] text-slate-400 uppercase font-black">Passport Photo</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="bg-slate-950 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.3em] shadow-lg">
                            Terminal Report
                        </div>
                    </div>
                </div>
            </div>

            {/* Student Info Card */}
            <div className="grid grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-x-8 gap-y-6 mb-10 print:mb-3 bg-slate-50/50 p-6 print:p-3 print:py-1 print:px-2 border border-slate-200 rounded-sm print:bg-transparent print:border-slate-300">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Name of Student</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{student.name}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Academic Year</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{schoolConfig?.academic_year || '2024/2025'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Term</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{schoolConfig?.current_term || schoolConfig?.term || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Class</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{student.class}</p>
                </div>

                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enrollment No.</p>
                    <p className="text-[11px] font-bold text-slate-700 uppercase border-b border-slate-300 pb-1">{student.id.substring(0, 8).toUpperCase()}</p>
                </div>
                {schoolConfig?.report_card_config?.show_position !== false && (
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Position</p>
                        <p className="text-[11px] font-bold text-slate-700 uppercase border-b border-slate-300 pb-1">
                            {position?.position || '-'} <span className="text-[9px] text-slate-400 lowercase italic">out of</span> {position?.total || '-'}
                        </p>
                    </div>
                )}
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Days Present</p>
                    <p className="text-[11px] font-bold text-slate-700 uppercase border-b border-slate-300 pb-1">
                        {attendancePresentDays} <span className="text-[9px] text-slate-400 lowercase italic">out of</span> {attendanceTotalDays || schoolConfig?.report_card_config?.term_total_days || '-'}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Re-opening Date</p>
                    <p className="text-[11px] font-bold text-slate-700 uppercase border-b border-slate-300 pb-1">
                        {schoolConfig?.next_term_reopens ? new Date(schoolConfig.next_term_reopens).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'NOT FIXED'}
                    </p>
                </div>
            </div>

            {/* Results Table - Clean & Professional */}
            <div className="flex-1 mb-8 print:mb-3 overflow-x-auto relative max-w-full">
                <table className="w-full min-w-[700px] border-collapse border-y-2 border-slate-950 text-[11px] md:text-xs print:text-xs">
                    <thead>
                        <tr className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900">
                            <th className="p-3 print:py-1 print:px-2 text-left font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300">Subject Name</th>
                            <th className="p-3 print:py-1 print:px-2 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-24">Class Score<br /><span className="text-[9px] opacity-70">({schoolConfig?.weights?.class || 30}%)</span></th>
                            <th className="p-3 print:py-1 print:px-2 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-24">Exam Score<br /><span className="text-[9px] opacity-70">({schoolConfig?.weights?.exam || 70}%)</span></th>
                            <th className="p-3 print:py-1 print:px-2 text-center font-black uppercase tracking-wider border-x border-slate-800 bg-slate-800 print:bg-slate-200 print:border-slate-300 w-24 underline decoration-2">Total Score</th>
                            <th className="p-3 print:py-1 print:px-2 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-16">Grade</th>
                            <th className="p-3 print:py-1 print:px-2 text-left font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 min-w-[150px]">Subject Teacher's Remark</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border-x-2 border-slate-950">
                        {results.map((result, index) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            return (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 print:bg-transparent'}>
                                    <td className="p-3 print:py-1 print:px-2 font-black text-slate-900 border-r border-slate-200 uppercase">{result.subject}</td>
                                    <td className="p-3 print:py-1 print:px-2 text-center text-slate-700 border-r border-slate-200 font-bold">{result.classScore}</td>
                                    <td className="p-3 print:py-1 print:px-2 text-center text-slate-700 border-r border-slate-200 font-bold">{result.examScore}</td>
                                    <td className="p-3 print:py-1 print:px-2 text-center font-black text-slate-900 bg-slate-100/50 border-r border-slate-200">{result.total}</td>
                                    <td className="p-3 print:py-1 print:px-2 text-center font-black text-slate-900 border-r border-slate-200">
                                        <span className={`inline-block w-8 py-1 rounded-sm ${grade === 'A' || grade === 'B' ? 'bg-green-100 text-green-800' : grade === 'F' ? 'bg-red-100 text-red-800' : ''}`}>
                                            {grade}
                                        </span>
                                    </td>
                                    <td className="p-3 print:py-1 print:px-2 italic text-slate-600 font-medium capitalize">{remark.toLowerCase()}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-50 font-black border-t-2 border-slate-950 print:bg-slate-50">
                            <td className="p-3 print:py-1 print:px-2 text-right uppercase tracking-[0.2em]" colSpan={3}>Aggregate Summary / Average</td>
                            <td className="p-3 print:py-1 print:px-2 text-center text-lg underline decoration-double">{overallAverage}</td>
                            <td colSpan={2} className="p-3 print:py-1 print:px-2"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Qualitative Section & Bill */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-10 print:gap-4 mb-8 print:mb-3 mt-auto">
                <div className="space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] border-b-2 border-slate-900 pb-1 inline-block">Appraisal & Remarks</h4>

                    <div className="space-y-4">
                        <div className="flex items-end gap-3 print:py-1 print:px-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mb-1">Conduct / Attitude:</span>
                            <input type="text" value={conduct} onChange={(e) => setConduct(e.target.value)} className="flex-1 border-b border-slate-300 outline-none text-xs font-bold text-slate-900 bg-transparent pb-1" />
                        </div>
                        <div className="flex items-end gap-3 print:py-1 print:px-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mb-1">Interest / Talent:</span>
                            <input type="text" value={interest} onChange={(e) => setInterest(e.target.value)} className="flex-1 border-b border-slate-300 outline-none text-xs font-bold text-slate-900 bg-transparent pb-1" />
                        </div>

                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-slate-400">Class Teacher's Remark:</span>
                                <textarea
                                    value={teacherRemark}
                                    onChange={(e) => setTeacherRemark(e.target.value)}
                                    className="w-full border-b border-slate-300 outline-none text-xs font-bold text-slate-900 bg-transparent italic h-12 print:h-8 py-1 leading-relaxed resize-none"
                                />
                            </div>
                        )}

                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-slate-400">Headmaster's Recommendation & Signature:</span>
                                <textarea
                                    value={principalRemark}
                                    onChange={(e) => setPrincipalRemark(e.target.value)}
                                    className="w-full border-b border-slate-300 outline-none text-xs font-bold text-slate-900 bg-transparent italic h-12 print:h-8 py-1 leading-relaxed resize-none"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-6 print:p-3 print:py-1 print:px-2 rounded shadow-xl flex flex-col justify-between print:bg-transparent print:text-slate-900 print:shadow-none print:border-2 print:border-slate-900">
                    <div>
                        <div className="flex justify-between items-center mb-6 print:mb-2 border-b border-slate-700 pb-2 print:border-slate-400">
                            <h4 className="text-sm font-black uppercase tracking-widest">Financial Summary</h4>
                            <span className="text-[9px] font-bold opacity-60">PUPIL'S BILL</span>
                        </div>

                        <div className="space-y-4 mb-8 print:mb-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="opacity-70 font-bold uppercase tracking-wider">Previous Balance (Arrears)</span>
                                <span className="font-mono">GHS {(student as any).balance || '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="opacity-70 font-bold uppercase tracking-wider">Current Term Fees</span>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-40 font-mono">GHS</span>
                                    <input type="number" value={pupilBill} onChange={(e) => setPupilBill(Number(e.target.value))} className="w-20 bg-slate-800/50 border-b border-slate-600 text-right outline-none font-mono py-1 px-2 focus:bg-slate-700 print:bg-transparent print:border-slate-300" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="opacity-70 font-bold uppercase tracking-wider">Other Scheduled Charges</span>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-40 font-mono">GHS</span>
                                    <input type="number" value={otherFees} onChange={(e) => setOtherFees(Number(e.target.value))} className="w-20 bg-slate-800/50 border-b border-slate-600 text-right outline-none font-mono py-1 px-2 focus:bg-slate-700 print:bg-transparent print:border-slate-300" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t-4 border-double border-slate-700 pt-6 mt-auto print:border-slate-950">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Payable Amount</p>
                                <p className="text-3xl font-black font-serif italic tracking-tighter">
                                    <span className="text-sm mr-2 opacity-40">GHS</span>
                                    {(Number((student as any).balance || 0) + pupilBill + otherFees).toFixed(2)}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="h-10 w-32 border-b-2 border-slate-600 mb-1 mx-auto print:border-slate-900"></div>
                                <p className="text-[8px] font-bold uppercase opacity-60 tracking-widest">Authorized Stamp</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Institutional Footer */}
            <div className="mt-8 border-t border-slate-200 pt-4 flex justify-between items-center text-[8px] font-black uppercase text-slate-400 tracking-widest">
                <div>Generated on {new Date().toLocaleDateString('en-GB')} | Secure Digital Report</div>
                <div className="flex items-center gap-3 print:py-1 print:px-2">
                    <span>Ghana Education Service Accredited</span>
                    <span className="text-slate-950">Orbit SMS Professional v2.0</span>
                </div>
            </div>
        </div>
    );

    const modernContent = (
        <div ref={printMode ? undefined : componentRef} id={printMode ? undefined : "report-card-content"} className={`bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-12 print:p-4 print:p-2 shadow-sm min-h-[1123px] print:min-h-0 flex flex-col print:shadow-none ${printMode ? 'p-0 shadow-none border-none min-h-0' : 'print:p-0 print:min-h-0'}`}>

            {/* Modern Premium Header */}
            <div className="flex flex-col md:flex-row print:flex-row justify-between items-center md:items-start print:items-start border-b-4 border-slate-900 pb-8 mb-8 print:mb-3 text-center md:text-left print:text-left">
                <div className="flex flex-col md:flex-row print:flex-row items-center gap-8 print:gap-4 print:p-4 print:p-2 mb-4 md:mb-0 print:mb-0">
                    <div className="h-24 w-24 print:h-16 print:w-16 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                        {schoolConfig?.logo_url ? (
                            <img src={schoolConfig.logo_url} alt="School Logo" className="h-full w-full object-contain p-2" />
                        ) : (
                            <Building2 className="h-12 w-12 text-slate-200" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-4xl print:text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">
                            {schoolConfig?.name || 'Orbit Academy'}
                        </h1>
                        <p className="text-slate-500 font-medium text-lg mb-3">
                            {schoolConfig?.motto || 'Excellence in Digital Learning'}
                        </p>
                        <div className="text-xs md:text-sm print:text-sm text-slate-400 font-bold uppercase tracking-wider space-y-1">
                            <p>{schoolConfig?.address}</p>
                            <p>{schoolConfig?.email} | {schoolConfig?.phone}</p>
                        </div>
                    </div>
                </div>
                <div className="flex md:flex-col print:flex-col gap-3 print:py-1 print:px-2">
                    <div className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg text-center">
                        <p className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-1">Academic Session</p>
                        <p className="text-lg font-black">{schoolConfig?.academic_year || '2025'}</p>
                    </div>
                    <div className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg text-center">
                        <p className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-1">Current Term</p>
                        <p className="text-lg font-black">{schoolConfig?.current_term || schoolConfig?.term || '-'}</p>
                    </div>
                </div>
            </div>

            {/* Student Profile Card */}
            <div className="bg-slate-50 rounded-3xl p-6 print:p-3 print:py-1 print:px-2 border border-slate-100 mb-8 print:mb-3 flex flex-col md:flex-row print:flex-row items-center gap-8 print:gap-4 print:p-4 print:p-2 relative overflow-hidden">
                {/* Abstract Background Element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16"></div>

                {schoolConfig?.report_card_config?.show_student_photo !== false && (
                    <div className="h-32 w-32 print:h-20 print:w-20 bg-white rounded-2xl border-4 border-white shadow-xl flex items-center justify-center overflow-hidden shrink-0 relative z-10">
                        {student.photo ? (
                            <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="text-center p-4 print:p-2">
                                <span className="text-4xl font-black text-slate-100">{student.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 text-center md:text-left print:text-left relative z-10">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Student Particulars</p>
                    <h2 className="text-2xl md:text-3xl print:text-3xl font-black text-slate-900 mb-4">{student.name}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-6 print:gap-3 print:p-3 print:py-1 print:px-2">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Student ID</p>
                            <p className="font-bold text-slate-700 font-mono">{student.id.substring(0, 8).toUpperCase()}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Current Class</p>
                            <p className="font-bold text-slate-700">{student.class}</p>
                        </div>
                        {schoolConfig?.report_card_config?.show_position !== false && (
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Term Rank</p>
                                <p className="font-black text-blue-600">
                                    {position?.position ? (
                                        <>
                                            {position.position}
                                            <span className="text-xs ml-0.5 opacity-60">
                                                {(() => {
                                                    const n = position.position;
                                                    const s = ["th", "st", "nd", "rd"];
                                                    const v = n % 100;
                                                    return s[(v - 20) % 10] || s[v] || s[0];
                                                })()}
                                            </span>
                                            <span className="text-slate-300 font-normal mx-2">/</span>
                                            <span className="text-slate-400">{position.total}</span>
                                        </>
                                    ) : '-'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="flex-1 mb-8 print:mb-3 overflow-x-auto relative max-w-full">
                <div className="flex items-center gap-4 print:p-2 mb-6 print:mb-2 min-w-[700px]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Academic Assessment</h3>
                    <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                <table className="w-full min-w-[700px] border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900">
                            <th className="p-4 print:p-2 text-left text-[10px] font-black uppercase tracking-widest rounded-tl-2xl">Subject</th>
                            {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                <th className="p-4 print:p-2 text-center text-[10px] font-black uppercase tracking-widest w-28">Class ({schoolConfig?.weights?.class || 30}%)</th>
                            )}
                            <th className="p-4 print:p-2 text-center text-[10px] font-black uppercase tracking-widest w-28">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                            <th className="p-4 print:p-2 text-center text-[10px] font-black uppercase tracking-widest w-28 bg-blue-600 print:bg-blue-100">Total (100)</th>
                            <th className="p-4 print:p-2 text-center text-[10px] font-black uppercase tracking-widest w-24">Grade</th>
                            <th className="p-4 print:p-2 text-left text-[10px] font-black uppercase tracking-widest rounded-tr-2xl">Remark</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 border border-slate-100">
                        {results.map((result, index) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            return (
                                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 print:p-2 font-bold text-slate-900">{result.subject}</td>
                                    {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                        <td className="p-4 print:p-2 text-center text-slate-500 font-medium">{result.classScore}</td>
                                    )}
                                    <td className="p-4 print:p-2 text-center text-slate-500 font-medium">{result.examScore}</td>
                                    <td className="p-4 print:p-2 text-center font-black text-blue-700 bg-blue-50/30">{result.total}</td>
                                    <td className="p-4 print:p-2 text-center">
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black ${grade === 'A' || grade?.startsWith('EE') ? 'bg-green-100 text-green-700' :
                                            grade === 'F' || grade?.startsWith('BE') ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                            {grade}
                                        </span>
                                    </td>
                                    <td className="p-4 print:p-2 text-slate-500 italic text-xs">{remark}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-900 text-white font-black print:bg-slate-100 print:text-slate-900">
                            <td className="p-4 print:p-2 text-right uppercase text-[10px] tracking-[0.2em] rounded-bl-2xl" colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 2 : 3}>Overall Performance Average</td>
                            <td className="p-4 print:p-2 text-center text-xl underline decoration-blue-400 decoration-2">{overallAverage}</td>
                            <td className="p-4 print:p-2 rounded-br-2xl" colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Bottom Section: Remarks & Bill */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4 print:p-4 print:p-2 mb-8 print:mb-3 mt-auto">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 print:p-2">
                        {schoolConfig?.report_card_config?.show_attendance !== false && (
                            <div className="bg-slate-50 p-4 print:p-2 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Attendance</p>
                                <p className="font-bold text-slate-900">{attendanceStats ? `${attendanceStats.present} out of ${attendanceStats.total}` : '-'}</p>
                            </div>
                        )}
                        <div className="bg-slate-50 p-4 print:p-2 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Term Start</p>
                            <p className="font-bold text-slate-900 text-xs">
                                {schoolConfig?.next_term_reopens ? new Date(schoolConfig.next_term_reopens).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Class Teacher's Remark</p>
                                <textarea value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 print:py-1 print:px-2 text-xs italic font-medium resize-none h-20 print:h-12 print:h-8 outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        )}
                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Headmaster's Final Decision</p>
                                <textarea value={principalRemark} onChange={(e) => setPrincipalRemark(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 print:py-1 print:px-2 text-xs italic font-medium resize-none h-20 print:h-12 print:h-8 outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-blue-600 text-white p-8 print:p-4 print:p-2 rounded-[2rem] shadow-xl flex flex-col justify-between relative overflow-hidden print:bg-white print:border-2 print:border-slate-900 print:text-slate-900 print:shadow-none">
                    {/* Decorative Pattern */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] print:hidden"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8 print:mb-3">
                            <h4 className="text-sm font-black uppercase tracking-widest border-b border-indigo-400 pb-1 print:border-slate-900">Financial Statement</h4>
                            <span className="text-[9px] font-bold bg-white/20 px-2 py-1 rounded print:bg-slate-100">TERM {schoolConfig?.current_term || 1}</span>
                        </div>

                        <div className="space-y-4 mb-8 print:mb-3">
                            <div className="flex justify-between items-center border-b border-blue-500/50 pb-2 print:border-slate-200">
                                <span className="text-xs font-bold opacity-80 uppercase tracking-wider">Outstanding Balance</span>
                                <span className="font-mono text-lg font-black">GHS {(student as any).balance || '0.00'}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-blue-500/50 pb-2 print:border-slate-200">
                                <span className="text-xs font-bold opacity-80 uppercase tracking-wider">New Bill Amount</span>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-60 font-mono">GHS</span>
                                    <input type="number" value={pupilBill} onChange={(e) => setPupilBill(Number(e.target.value))} className="w-24 bg-white/10 border-b border-white/30 text-right outline-none font-mono py-1 px-2 focus:bg-white/20 rounded-t print:bg-slate-50 print:border-slate-300 print:text-slate-900" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold opacity-80 uppercase tracking-wider">Auxiliary Charges</span>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-60 font-mono">GHS</span>
                                    <input type="number" value={otherFees} onChange={(e) => setOtherFees(Number(e.target.value))} className="w-24 bg-white/10 border-b border-white/30 text-right outline-none font-mono py-1 px-2 focus:bg-white/20 rounded-t print:bg-slate-50 print:border-slate-300 print:text-slate-900" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 pt-6 border-t border-white/20 flex justify-between items-end print:border-slate-900">
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-70 mb-1 tracking-widest">Grand Total Payable</p>
                            <p className="text-3xl font-black tracking-tighter">
                                <span className="text-sm mr-1 opacity-60">GHS</span>
                                {(Number((student as any).balance || 0) + pupilBill + otherFees).toFixed(2)}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="h-12 w-12 bg-white/20 rounded-full mx-auto mb-2 flex items-center justify-center print:bg-slate-100">
                                <Building2 className="w-6 h-6 opacity-60 print:opacity-100 print:text-slate-400" />
                            </div>
                            <p className="text-[8px] font-black uppercase opacity-60 tracking-widest">Digital Stamp Verified</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Institutional Bar */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">
                <div>Secure Academic Record No. {student.id.substring(0, 12).toUpperCase()}</div>
                <div>© {new Date().getFullYear()} Orbit Education ERP System</div>
            </div>
        </div>
    );

    const innerContent = isNursery ? nurseryContent : (isClassic ? classicContent : modernContent);

    if (printMode) {
        return (
            <div className="print-page-break" style={{ pageBreakAfter: 'always', margin: '0 auto', maxWidth: '100%', breakAfter: 'page' }}>
                {innerContent}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 md:p-4 print:p-2 print:p-4 print:p-2 backdrop-blur-sm overflow-hidden">
            {/* Modal Container - constrained height */}
            <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[95vh] h-full md:h-auto print:h-auto animate-in fade-in zoom-in-95 duration-200">

                {/* Fixed Header */}
                <div className="bg-slate-900 text-white p-3 print:py-1 print:px-2 md:p-4 print:p-2 print:p-4 print:p-2 flex justify-between items-center shrink-0 rounded-t-xl print:hidden">
                    <h2 className="font-bold text-base md:text-lg print:text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4 md:h-5 print:h-5 md:w-5 print:w-5 text-blue-400" /> Student Report Card
                    </h2>
                    <div className="flex items-center gap-2 md:gap-3 print:py-1 print:px-2 print:gap-3 print:py-1 print:px-2">
                        <p className="text-xs text-slate-400 mr-4 hidden md:block print:block">
                            <span className="font-bold text-yellow-400">Tip:</span> You can edit the remarks below before printing.
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 md:px-4 print:px-4 md:py-2 print:py-2 rounded-lg text-xs md:text-sm print:text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            <Save className="h-3 w-3 md:h-4 print:h-4 md:w-4 print:w-4" /> <span className="hidden sm:inline print:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                            onClick={() => handlePrint()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 md:px-4 print:px-4 md:py-2 print:py-2 rounded-lg text-xs md:text-sm print:text-sm font-bold transition-colors"
                        >
                            <Printer className="h-3 w-3 md:h-4 print:h-4 md:w-4 print:w-4" /> <span className="hidden sm:inline print:inline">Print Report</span><span className="sm:hidden print:hidden">Print</span>
                        </button>
                        <button onClick={onClose!} className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5">
                            <X className="h-4 w-4 md:h-5 print:h-5 md:w-5 print:w-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto flex-1 bg-slate-100 p-2 md:p-8 print:p-4 print:p-2 print:p-8 print:p-4 print:p-2">
                    {innerContent}
                </div>
            </div>
        </div>
    );
};

export default ReportCard;

