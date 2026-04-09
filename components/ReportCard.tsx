import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Building2, Save, Plus, PenTool } from 'lucide-react';
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
        global_report_sections?: { title: string; content: string }[];
    };
    global_report_sections?: { title: string; content: string }[];
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
    activeModules?: string[];
}

const ReportCard: React.FC<ReportCardProps> = ({ student, results, onClose, schoolConfig, position, schoolId, printMode, savedReportData, activeModules }) => {
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
    const [interest, setInterest] = useState(savedReportData?.interest || '');
    const [itemsToBring, setItemsToBring] = useState(savedReportData?.items_to_bring || (schoolConfig as any)?.items_to_bring_default || '');
    const [nextTermReopens, setNextTermReopens] = useState(savedReportData?.next_term_reopens || (schoolConfig as any)?.next_term_reopens || '');
    const [extraBillItems, setExtraBillItems] = useState<{ label: string; value: number }[]>(savedReportData?.extra_bill_items || []);
    const [extraReportSections, setExtraReportSections] = useState<{ title: string; content: string }[]>(savedReportData?.extra_report_sections || []);
    const [attendancePresentDays, setAttendancePresentDays] = useState<number>(savedReportData?.attendance_present ? Number(savedReportData.attendance_present) : (student.attendance || 0));
    const [attendanceTotalDays, setAttendanceTotalDays] = useState<number>(savedReportData?.attendance_total ? Number(savedReportData.attendance_total) : ((schoolConfig as any)?.term_total_days || 0));
    const [pupilBill, setPupilBill] = useState<number>(savedReportData?.pupil_bill ? Number(savedReportData.pupil_bill) : 0);
    const [otherFees, setOtherFees] = useState<number>(savedReportData?.other_fees ? Number(savedReportData.other_fees) : 0);
    const [nextClass, setNextClass] = useState(savedReportData?.next_class || getNextClass(student.class));
    const [isSaving, setIsSaving] = useState(false);
    const showFees = activeModules?.includes('revenue_guard') || activeModules?.includes('complete_bundle');

    const addExtraBillItem = () => {
        setExtraBillItems([...extraBillItems, { label: '', value: 0 }]);
    };
    const updateExtraBillItem = (index: number, field: 'label' | 'value', value: any) => {
        const newItems = [...extraBillItems];
        if (field === 'value') {
            newItems[index] = { ...newItems[index], [field]: Number(value) };
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        setExtraBillItems(newItems);
    };
    const removeExtraBillItem = (index: number) => {
        setExtraBillItems(extraBillItems.filter((_, i) => i !== index));
    };

    const addExtraReportSection = () => {
        setExtraReportSections([...extraReportSections, { title: '', content: '' }]);
    };
    const updateExtraReportSection = (index: number, field: 'title' | 'content', value: string) => {
        const newSections = [...extraReportSections];
        newSections[index] = { ...newSections[index], [field]: value };
        setExtraReportSections(newSections);
    };
    const removeExtraReportSection = (index: number) => {
        setExtraReportSections(extraReportSections.filter((_, i) => i !== index));
    };

    const totalBill = Number((student as any).balance || 0) + pupilBill + otherFees + extraBillItems.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const [attendanceStats, setAttendanceStats] = useState<{ present: number, total: number } | null>(null);

    // Fetch Detailed Attendance
    useEffect(() => {
        const fetchAtt = async () => {
            if (schoolConfig?.attendance_mode === 'manual') return;
            if (!student.id || student.id.includes('preview')) return;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(student.id)) return;

            const { data, error } = await supabase.rpc('get_student_attendance_summary', { p_student_id: student.id });
            if (!error && data) {
                setAttendanceStats(data);
                // System Calculated Attendance - Always use data if available
                setAttendancePresentDays(Number(data.present));
                
                // For Total Days, prioritize system total, fallback to config total, then student record
                const sysTotal = Number(data.total);
                const configTotal = (schoolConfig as any)?.term_total_days;
                
                if (sysTotal > 0) setAttendanceTotalDays(sysTotal);
                else if (configTotal) setAttendanceTotalDays(configTotal);
                else setAttendanceTotalDays(Number(student.attendance || 0));
            }
        };
        fetchAtt();
    }, [student.id, schoolConfig?.attendance_mode]);

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
                    if (data.items_to_bring) setItemsToBring(data.items_to_bring);
                    if (data.next_term_reopens) setNextTermReopens(data.next_term_reopens);
                    if (data.extra_bill_items) setExtraBillItems(data.extra_bill_items);
                    
                    const savedSections = (data.extra_report_sections && Array.isArray(data.extra_report_sections)) ? data.extra_report_sections : [];
                    const globalSections = (schoolConfig as any)?.global_report_sections || [];
                    
                    let finalSections = [...savedSections];
                    
                    // Legacy migration for items_to_bring
                    if (finalSections.length === 0 && data.items_to_bring && data.items_to_bring.trim() !== '') {
                        finalSections = [{ title: 'Items to Bring Next Term', content: data.items_to_bring }];
                    }

                    // Merge global sections that don't exist in saved data
                    globalSections.forEach((gs: any) => {
                        const exists = finalSections.some(s => s.title.toLowerCase() === gs.title.toLowerCase());
                        if (!exists && gs.title.trim() !== '') {
                            finalSections.push({ title: gs.title, content: gs.content || '' });
                        }
                    });

                    setExtraReportSections(finalSections);
                } else {
                    // No saved data yet, initialize from global sections
                    const globalSections = (schoolConfig as any)?.global_report_sections || [];
                    setExtraReportSections(globalSections.map((gs: any) => ({ title: gs.title, content: gs.content || '' })));
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
                p_interest: interest,
                p_items_to_bring: itemsToBring,
                p_next_term_reopens: nextTermReopens,
                p_extra_bill_items: JSON.stringify(extraBillItems),
                p_extra_report_sections: JSON.stringify(extraReportSections)
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

    const rcConfig = schoolConfig?.report_card_config;
    const layoutPref = rcConfig?.layout;
    const nurseryClasses = (rcConfig as any)?.nursery_classes || [];

    // Direct overrides
    const layoutAssignments = (rcConfig as any)?.class_layouts || {};
    const classLayout = layoutAssignments[student.class] || layoutPref || 'modern';

    const isNursery = classLayout === 'nursery';
    const isClassic = classLayout === 'classic_tabular';

    const nurseryContent = (
        <div ref={printMode ? undefined : componentRef} className={`bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-12 print:p-4 print:p-2 min-h-[1056px] print:min-h-0 text-slate-800 flex flex-col font-serif relative overflow-hidden ${printMode ? 'p-0 shadow-none' : 'shadow-2xl border border-slate-100'}`} style={{ fontFamily: 'Georgia, serif' }}>
            {/* Premium Watermark */}
            {schoolConfig?.logo_url && (
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
                    <img src={schoolConfig.logo_url} alt="" className="w-1/2 grayscale" />
                </div>
            )}

            {/* Elegant Corner Ornaments */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-slate-200 pointer-events-none"></div>
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-slate-200 pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-slate-200 pointer-events-none"></div>
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-slate-200 pointer-events-none"></div>

            {/* Soft texture background */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none select-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>

            {/* Header */}
            {/* Classic-Style Institutional Header */}
            <div className="relative mb-1 text-center border-b-2 border-double border-slate-900 pb-4 print:pb-1 pt-2">
                <div className="absolute top-0 left-0 w-full h-full opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="flex justify-center items-center gap-10 mb-2 print:mb-1">
                        {schoolConfig?.logo_url && (
                            <div className="h-16 w-16 print:h-14 print:w-14 flex items-center justify-center p-1.5 bg-white border border-slate-200 shadow-sm">
                                <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                            </div>
                        )}
                        <div className="h-16 w-16 print:h-14 print:w-14 bg-slate-50 border-2 border-slate-900 shadow-lg flex items-center justify-center overflow-hidden shrink-0 print:border-slate-950">
                            {student.photo ? (
                                <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="text-center p-1">
                                    <Building2 className="w-6 h-6 text-slate-200 mx-auto" />
                                    <span className="text-[5px] text-slate-300 font-black uppercase">Passport</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="max-w-3xl mx-auto">
                        <h1 className="font-serif text-3xl md:text-3xl print:text-3xl font-black uppercase tracking-tight text-slate-900 leading-none mb-1 shadow-sm">{schoolConfig?.name || 'NAME OF SCHOOL'}</h1>
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <span className="h-0.5 w-6 bg-slate-900/10"></span>
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.5em]">Foundation Stage Assessment</p>
                            <span className="h-0.5 w-6 bg-slate-900/10"></span>
                        </div>
                        <div className="inline-block px-10 py-1 border-y-2 border-slate-950/20">
                            <h2 className="text-[14px] font-black uppercase tracking-[0.25em] text-slate-950 italic">Terminal Narrative Report</h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* Disciplined Student Persona Grid (Consistent with Classic) */}
            <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-2 mb-4 print:mb-1.5 bg-slate-50/50 p-4 print:p-1.5 border border-slate-200 print:bg-white print:border-slate-950">
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Name of Learner</p>
                    <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">{student.name}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Class</p>
                    <p className="text-xs font-black text-slate-900 uppercase leading-tight">{student.class}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Session</p>
                    <p className="text-xs font-black text-slate-900 uppercase leading-tight">{schoolConfig?.academic_year || '-'}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Term</p>
                    <p className="text-xs font-black text-slate-900 uppercase leading-tight">{schoolConfig?.current_term || schoolConfig?.term || '-'}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Attendance</p>
                    <p className="text-[9px] font-bold text-slate-700 uppercase leading-tight">{attendancePresentDays} / {attendanceTotalDays}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Re-opening</p>
                    <p className="text-[9px] font-bold text-slate-700 uppercase leading-tight">{schoolConfig?.next_term_reopens || 'TBD'}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Learner ID</p>
                     <p className="text-[9px] font-bold text-slate-700 uppercase leading-tight">#{student.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Tracking</p>
                     <p className="text-[9px] font-black text-blue-600 uppercase leading-tight">Narrative</p>
                </div>
            </div>

            {/* Assessment Core - Premium Classic Table */}
            <div className="space-y-1 mb-1 print:mb-0.5 flex-1 relative z-10">
                <div className="flex items-center gap-3 mb-3 print:mb-1.5 px-1">
                    <div className="w-1.5 h-1.5 bg-slate-950 rotate-45"></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-950 font-serif">Assessment Summary</h3>
                    <div className="flex-1 h-[1px] bg-slate-950/20"></div>
                </div>

                <div className="border border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,0.05)] bg-white">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white print:bg-slate-50 print:text-slate-900">
                                <th className="text-left px-4 py-1.5 text-[8px] font-black uppercase tracking-wider print:py-0.5">Category</th>
                                <th className="text-center px-4 py-1.5 text-[8px] font-black uppercase tracking-wider w-40 border-l border-white/20 print:border-slate-950 print:py-0.5">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-950 border-x border-slate-950">
                            {results.length > 0 ? results.map((result, idx) => {
                                const status = (result as any).competency_status || (result.total >= 80 ? 'Mastered' : result.total >= 60 ? 'Developing' : 'Emerging');
                                const statusColor = (result as any).competency_status ? 'text-slate-900 font-black' : (result.total >= 80 ? 'text-green-700 font-black' : result.total >= 60 ? 'text-blue-700 font-black' : 'text-orange-700 font-black');
                                return (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30 print:bg-transparent'}>
                                        <td className="px-5 py-2 text-[10px] font-black text-slate-900 uppercase tracking-tight print:py-1.5">{result.subject}</td>
                                        <td className="px-4 py-2 text-center border-l border-slate-100 print:border-slate-300">
                                            <span className={`text-[10px] uppercase tracking-tighter italic ${statusColor}`}>
                                                {status === '90' ? 'Mastered' : status === '70' ? 'Developing' : status === '40' ? 'Emerging' : status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={2} className="py-10 text-center text-slate-400 font-bold italic text-[11px] uppercase tracking-widest">No Narrative Recorded</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="border-t border-slate-950">
                            <tr className="bg-slate-50 print:bg-white text-[8px]">
                                <td colSpan={2} className="px-5 py-2">
                                    <div className="flex justify-between items-center opacity-80">
                                        <span className="font-black uppercase text-slate-400 tracking-widest border-r border-slate-300 pr-4 mr-4">Performance Key</span>
                                        <div className="flex flex-1 justify-start gap-10">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                                <span className="font-black uppercase text-slate-600 tracking-wider">Mastered (M)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                                <span className="font-black uppercase text-slate-600 tracking-wider">Developing (D)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-orange-600 rounded-full"></div>
                                                <span className="font-black uppercase text-slate-600 tracking-wider">Emerging (E)</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Classic Narrative Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4 mb-2 print:mb-1 pt-4 border-t-2 border-slate-100 relative z-10">
                <div className="space-y-4">
                    <div className="relative group">
                        <div className="flex items-center gap-2 mb-1.5 translate-x-[-4px]">
                            <div className="w-1 h-3 bg-slate-900"></div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Lead Educator's Evaluation</span>
                        </div>
                        <div className="border border-slate-200 border-dashed rounded-lg p-0.5 bg-slate-50/20">
                            <textarea
                                value={teacherRemark}
                                onChange={(e) => setTeacherRemark(e.target.value)}
                                className="w-full bg-transparent border border-slate-100 rounded p-2.5 print:p-1.5 text-[11px] font-bold text-slate-900 italic leading-snug h-20 print:h-14 resize-none outline-none focus:bg-white transition-all"
                                placeholder="..."
                            />
                        </div>
                    </div>
                    <div className="relative group">
                        <div className="flex items-center gap-2 mb-1.5 translate-x-[-4px]">
                            <div className="w-1 h-3 bg-slate-900 opacity-40"></div>
                            <span className="text-[9px] font-black uppercase text-slate-900 tracking-[0.2em]">Principal's Final Remark</span>
                        </div>
                        <div className="border-2 border-double border-slate-200 rounded-lg p-0.5 bg-white">
                            <textarea
                                value={principalRemark}
                                onChange={(e) => setPrincipalRemark(e.target.value)}
                                className="w-full bg-transparent border-none p-2.5 print:p-1.5 text-[11px] font-black text-slate-950 italic leading-snug h-12 print:h-10 resize-none outline-none"
                                placeholder="..."
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Financials OR Extra Details if no fees */}
                {showFees ? (
                    <div className="flex flex-col gap-4 print:gap-2">
                        <div className="bg-slate-900 text-white p-4 print:p-3 print:py-1.5 print:px-2.5 rounded-2xl shadow-lg relative overflow-hidden print:bg-white print:text-slate-900 print:border-[1.5px] print:border-slate-950">
                             {/* Decorative Shine */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                            
                            <div className="relative z-10">
                                <h4 className="text-[8px] font-black uppercase tracking-widest mb-3 opacity-60">Financial Overview</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center pb-1 border-b border-white/10 print:border-slate-200">
                                        <span className="text-[10px] font-bold opacity-60">Termly Fees</span>
                                        <span className="font-mono text-xs">GHS {pupilBill.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-1 border-b border-white/10 print:border-slate-200">
                                        <span className="text-[10px] font-bold opacity-60">Ancillary</span>
                                        <span className="font-mono text-xs">GHS {otherFees.toFixed(2)}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between items-end">
                                        <div>
                                            <p className="text-[7px] font-black uppercase opacity-40 mb-0.5">Total Due</p>
                                            <p className="text-xl font-black">GHS {(pupilBill + otherFees).toFixed(2)}</p>
                                        </div>
                                        <div className="h-6 w-6 bg-white/10 rounded-full flex items-center justify-center print:bg-slate-100">
                                            <Building2 className="w-3 h-3 opacity-40 print:opacity-100 print:text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Classic Signatures */}
                        <div className="grid grid-cols-2 gap-8 mt-auto px-4">
                            <div className="text-center pt-6 relative group">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <PenTool className="w-full h-full text-slate-900" />
                                </div>
                                <div className="h-[1.5px] bg-slate-950 w-full mb-0.5"></div>
                                <div className="h-[0.5px] bg-slate-950 w-full opacity-20 mt-[-2px] mb-1.5"></div>
                                <span className="text-[8px] font-black uppercase text-slate-900 tracking-[0.2em]">Lead Preceptor</span>
                            </div>
                            <div className="text-center pt-6 relative group">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <PenTool className="w-full h-full text-slate-900" />
                                </div>
                                <div className="h-[1.5px] bg-slate-950 w-full mb-0.5"></div>
                                <div className="h-[0.5px] bg-slate-950 w-full opacity-20 mt-[-2px] mb-1.5"></div>
                                <span className="text-[8px] font-black uppercase text-slate-900 tracking-[0.2em]">Head of Institution</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                             <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Child Development Notes</h4>
                                <p className="text-[9px] text-slate-300 uppercase font-black italic">Behavioral & Material Checklist</p>
                             </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            {extraReportSections.map((section, idx) => (
                                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group relative">
                                    <div className="flex justify-between items-center mb-2">
                                        <input 
                                            type="text" 
                                            value={section.title} 
                                            onChange={e => updateExtraReportSection(idx, 'title', e.target.value)} 
                                            placeholder="Section Title"
                                            className="bg-transparent border-none text-[10px] font-black uppercase text-slate-700 outline-none w-full"
                                        />
                                        <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <textarea 
                                        value={section.content} 
                                        onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} 
                                        className="w-full bg-transparent border-none outline-none text-[11px] text-slate-600 min-h-12 resize-none italic font-medium leading-relaxed" 
                                        placeholder="..." 
                                    />
                                </div>
                            ))}
                            
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                             <div className="text-center pt-6">
                                <div className="h-px bg-slate-200 w-full mb-1"></div>
                                <span className="text-[7px] font-black uppercase text-slate-300 tracking-[0.2em]">Class Teacher</span>
                             </div>
                             <div className="text-center pt-6">
                                <div className="h-px bg-slate-200 w-full mb-1"></div>
                                <span className="text-[7px] font-black uppercase text-slate-300 tracking-[0.2em]">Principal</span>
                             </div>
                        </div>
                    </div>
                )}
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
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attendance (Auto)</p>
                    <div className="flex items-center gap-1 border-b border-slate-300 pb-1">
                        <input type="number" value={attendancePresentDays} readOnly={true} className="w-8 bg-transparent outline-none text-[11px] font-bold text-center text-blue-600 cursor-not-allowed" />
                        <span className="text-[9px] text-slate-400 lowercase italic">out of</span>
                        <input type="number" value={attendanceTotalDays} readOnly={true} className="w-8 bg-transparent outline-none text-[11px] font-bold text-center text-slate-500 cursor-not-allowed" />
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Re-opening Date</p>
                    <input 
                        type="text" 
                        value={nextTermReopens} 
                        onChange={e => setNextTermReopens(e.target.value)} 
                        className="w-full bg-transparent border-b border-slate-300 outline-none text-[11px] font-bold text-slate-700 uppercase pb-1" 
                    />
                </div>
            </div>

            {/* Results Table - Clean & Professional */}
            <div className="flex-1 mb-3 print:mb-1 overflow-x-auto relative max-w-full">
                <table className="w-full min-w-[700px] border-collapse border-y-2 border-slate-950 text-[10px] md:text-xs print:text-[10px]">
                    <thead>
                        <tr className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900">
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-left font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300">Subject Name</th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-24">Class Score<br /><span className="text-[8px] opacity-70">({schoolConfig?.weights?.class || 30}%)</span></th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-24">Exam Score<br /><span className="text-[8px] opacity-70">({schoolConfig?.weights?.exam || 70}%)</span></th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black uppercase tracking-wider border-x border-slate-800 bg-slate-800 print:bg-slate-200 print:border-slate-300 w-24 underline decoration-2">Total Score</th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-12">Grade</th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-left font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 min-w-[150px]">Subject Teacher's Remark</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border-x-2 border-slate-950">
                        {results.map((result, index) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            // Only treat as a Narrative/Nursery score if we are in Nursery layout OR it's exclusively competency data without numeric scores 
                            const isNurseryScore = isNursery || (!!(result as any).competency_status && !result.classScore && !result.examScore);
                            const nurseryStatus = (result as any).competency_status || (result.total === 90 ? 'Mastered' : result.total === 70 ? 'Developing' : result.total === 40 ? 'Emerging' : result.total.toString());

                            return (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 print:bg-transparent'}>
                                    <td className="p-1.5 print:py-0.5 print:px-1.5 font-black text-slate-900 border-r border-slate-200 uppercase">{result.subject}</td>
                                    {isNurseryScore ? (
                                        <td colSpan={3} className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black text-slate-900 bg-slate-100/30 border-r border-slate-200 uppercase tracking-widest italic text-[10px]">
                                            {nurseryStatus === '90' ? 'Mastered' : nurseryStatus === '70' ? 'Developing' : nurseryStatus === '40' ? 'Emerging' : nurseryStatus}
                                        </td>
                                    ) : (
                                        <>
                                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-center text-slate-700 border-r border-slate-200 font-bold">{result.classScore}</td>
                                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-center text-slate-700 border-r border-slate-200 font-bold">{result.examScore}</td>
                                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black text-slate-900 bg-slate-100/50 border-r border-slate-200">{result.total}</td>
                                        </>
                                    )}
                                    <td className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black text-slate-900 border-r border-slate-200">
                                        <span className={`inline-block w-8 py-0.5 rounded-sm ${grade === 'A' || grade === 'B' ? 'bg-green-100 text-green-800' : grade === 'F' ? 'bg-red-100 text-red-800' : ''}`}>
                                            {grade}
                                        </span>
                                    </td>
                                    <td className="p-1.5 print:py-0.5 print:px-1.5 italic text-slate-600 font-medium capitalize text-[9px]">{remark.toLowerCase()}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-50 font-black border-t-2 border-slate-950 print:bg-slate-50">
                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-right uppercase tracking-[0.2em]" colSpan={3}>Aggregate Summary / Average</td>
                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-center text-base underline decoration-double">{overallAverage}</td>
                            <td colSpan={2} className="p-1.5 print:py-0.5 print:px-1.5"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Bottom Content: Appraisal, Remarks and Financials */}
            <div className={`grid grid-cols-1 ${showFees ? 'md:grid-cols-2 print:grid-cols-2' : ''} gap-4 print:gap-2 mb-4 print:mb-1 mt-auto`}>
                {/* Full Width or Two-Column Remarks */}
                <div className={`space-y-3 ${!showFees ? 'grid grid-cols-2 gap-4' : ''}`}>
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-900 whitespace-nowrap">Appraisal & Conduct</h4>
                                <div className="flex-1 h-px bg-slate-200"></div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-start gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0"></div>
                                    <div className="flex-1 border-b border-slate-200 pb-1">
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Conduct / Attitude:</span>
                                        <input type="text" value={conduct} onChange={(e) => setConduct(e.target.value)} className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 mt-1" />
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0"></div>
                                    <div className="flex-1 border-b border-slate-200 pb-1">
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Interest / Talent:</span>
                                        <input type="text" value={interest} onChange={(e) => setInterest(e.target.value)} className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 mt-1" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div className="relative pt-2">
                                <div className="absolute -left-4 top-2 bottom-0 w-1 bg-slate-100 rounded-full"></div>
                                <span className="text-[7px] font-black uppercase text-slate-400 tracking-[0.15em] mb-1.5 block italic">Subject Teacher's Feedback:</span>
                                <textarea
                                    value={teacherRemark}
                                    onChange={(e) => setTeacherRemark(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded outline-none text-[10px] font-bold text-slate-900 leading-none min-h-12 print:min-h-8 p-1.5 italic resize-none"
                                />
                                <div className="flex justify-end mt-1">
                                    <div className="text-right">
                                        <div className="h-px w-20 bg-slate-300 mb-0.5"></div>
                                        <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Teacher's Sig.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div className="relative">
                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-slate-900 rounded-full"></div>
                                <span className="text-[8px] font-black uppercase text-slate-900 tracking-[0.15em] mb-1.5 block">Final Decision & Headmaster:</span>
                                <textarea
                                    value={principalRemark}
                                    onChange={(e) => setPrincipalRemark(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg outline-none text-[11px] font-black text-slate-900 leading-relaxed min-h-12 print:min-h-10 p-2 italic resize-none"
                                />
                                <div className="flex justify-between items-end mt-2">
                                    <div className="text-left">
                                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none">{new Date().toLocaleDateString('en-GB')}</p>
                                        <p className="text-[6px] font-black text-slate-300 uppercase leading-none mt-0.5">Issued On</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="h-px w-32 bg-slate-950 mb-0.5"></div>
                                        <p className="text-[7px] font-black text-slate-900 uppercase tracking-widest leading-none">Principal (Stamp)</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Supplemental Information Grid */}
                {!showFees && extraReportSections.length > 0 && (
                    <div className="pt-8 mt-4 border-t-2 border-slate-100">
                         <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Important Supplemental Information</h4>
                        </div>
                        <div className={`grid ${extraReportSections.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-8 pb-4`}>
                            {extraReportSections.map((section, idx) => (
                                <div key={idx} className="space-y-2 group relative bg-slate-50/50 p-4 rounded-xl border-l-4 border-blue-100 min-h-[100px]">
                                    <div className="flex justify-between items-center">
                                        <input 
                                            type="text" 
                                            value={section.title} 
                                            onChange={e => updateExtraReportSection(idx, 'title', e.target.value)} 
                                            placeholder="Section Title"
                                            className="bg-transparent border-none text-[9px] font-black uppercase text-blue-500 outline-none w-full tracking-widest font-black"
                                        />
                                        <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <textarea 
                                        value={section.content} 
                                        onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} 
                                        className="w-full bg-transparent border-none outline-none text-[11px] text-slate-900 min-h-16 resize-none italic font-medium leading-relaxed" 
                                        placeholder="..." 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            {/* Section 2: Financials & Right Side Items (only shown if enabled) */}
            {showFees && (
                    <div className="bg-slate-900 text-white p-4 print:p-2.5 rounded-xl shadow-xl flex flex-col justify-between print:bg-transparent print:text-slate-900 print:shadow-none print:border-2 print:border-slate-900">
                        <div>
                            <div className="flex justify-between items-center mb-4 print:mb-2 border-b border-slate-700 pb-1.5 print:border-slate-400">
                                <h4 className="text-[11px] font-black uppercase tracking-widest">Financial Summary</h4>
                                <span className="text-[8px] font-bold opacity-60">PUPIL'S BILL</span>
                            </div>

                            <div className="space-y-2 mb-3">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="opacity-70 font-bold uppercase tracking-wider">Arrears</span>
                                    <span className="font-mono">GHS {(student as any).balance || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="opacity-70 font-bold uppercase tracking-wider">Current Fees</span>
                                    <div className="flex items-center gap-2">
                                        <span className="opacity-40 font-mono">GHS</span>
                                        <input type="number" value={pupilBill} onChange={(e) => setPupilBill(Number(e.target.value))} className="w-20 bg-slate-800/50 border-b border-slate-600 text-right outline-none font-mono py-1 px-2 focus:bg-slate-700 print:bg-transparent print:border-slate-300" />
                                    </div>
                                </div>
                                
                                {extraBillItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group relative text-xs">
                                        <input type="text" value={item.label} onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} placeholder="Item" className="bg-transparent border-b border-slate-700 text-[10px] uppercase tracking-wider font-bold outline-none focus:border-white w-1/2 opacity-70 focus:opacity-100 print:border-none print:opacity-100" />
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-40 font-mono">GHS</span>
                                            <input type="number" value={item.value} onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} className="w-20 bg-slate-800/50 border-b border-slate-600 text-right outline-none font-mono py-1 px-2 focus:bg-slate-700 print:bg-transparent print:border-slate-300" />
                                            <button onClick={() => removeExtraBillItem(idx)} className="print:hidden p-1 text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                                
                                <button onClick={addExtraBillItem} className="print:hidden w-full py-1 border border-dashed border-slate-700 rounded text-[8px] font-black uppercase hover:bg-white/10 opacity-60">+ Charge Item</button>

                                {/* Financial summary section ended above */}
                            </div>

                            <div className="border-t-4 border-double border-slate-700 pt-6 mt-6 print:border-slate-950">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Payable</p>
                                        <p className="text-3xl font-black font-serif italic tracking-tighter">
                                            <span className="text-sm mr-2 opacity-40">GHS</span>
                                            {totalBill.toFixed(2)}
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
                )}
            </div>

            {/* Institutional Footer */}
            <div className="mt-3 border-t border-slate-200 pt-2 flex justify-between items-center text-[7px] font-black uppercase text-slate-400 tracking-widest">
                <div>Generated on {new Date().toLocaleDateString('en-GB')} | Secure Digital Report</div>
                <div className="flex items-center gap-2 print:py-0.5 print:px-1">
                    <span>Accredited</span>
                    <span className="text-slate-950">Orbit SMS v2.0</span>
                </div>
            </div>
        </div>
    );

    const modernContent = (
        <div ref={printMode ? undefined : componentRef} id={printMode ? undefined : "report-card-content"} className={`bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-12 print:p-2 shadow-sm min-h-[1100px] print:min-h-0 flex flex-col print:shadow-none ${printMode ? 'p-0 shadow-none border-none min-h-0' : 'print:p-0 print:min-h-0'}`}>

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
                            <th className="p-1.5 print:p-0.5 text-left text-[9px] font-black uppercase tracking-widest rounded-tl-xl leading-none">Subject</th>
                            {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                <th className="p-1.5 print:p-0.5 text-center text-[9px] font-black uppercase tracking-widest w-20 leading-none">Class ({schoolConfig?.weights?.class || 30}%)</th>
                            )}
                            <th className="p-1.5 print:p-0.5 text-center text-[9px] font-black uppercase tracking-widest w-20 leading-none">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                            <th className="p-1.5 print:p-0.5 text-center text-[9px] font-black uppercase tracking-widest w-20 bg-blue-600 print:bg-blue-100 leading-none">Total</th>
                            <th className="p-1.5 print:p-0.5 text-center text-[9px] font-black uppercase tracking-widest w-12 leading-none">Grade</th>
                            <th className="p-1.5 print:p-0.5 text-left text-[9px] font-black uppercase tracking-widest rounded-tr-xl leading-none">Remark</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 border border-slate-100">
                        {results.map((result, index) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            return (
                                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-1.5 print:p-0.5 font-bold text-slate-900 text-[10px] leading-tight">{result.subject}</td>
                                    {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                        <td className="p-1.5 print:p-0.5 text-center text-slate-500 font-medium text-[10px] leading-tight">{result.classScore}</td>
                                    )}
                                    <td className="p-1.5 print:p-0.5 text-center text-slate-500 font-medium text-[10px] leading-tight">{result.examScore}</td>
                                    <td className="p-1.5 print:p-0.5 text-center font-black text-blue-700 bg-blue-50/30 text-[10px] leading-tight">{result.total}</td>
                                    <td className="p-1.5 print:p-0.5 text-center">
                                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black ${grade === 'A' || grade?.startsWith('EE') ? 'bg-green-100 text-green-700' :
                                            grade === 'F' || grade?.startsWith('BE') ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                            {grade}
                                        </span>
                                    </td>
                                    <td className="p-1.5 print:p-0.5 text-slate-500 italic text-[9px] font-medium leading-tight">{remark}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-900 text-white font-black print:bg-slate-100 print:text-slate-900">
                            <td className="p-2.5 print:p-1.5 text-right uppercase text-[9px] tracking-[0.2em] rounded-bl-xl" colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 2 : 3}>Performance Summary</td>
                            <td className="p-2.5 print:p-1.5 text-center text-lg underline decoration-blue-400 decoration-2">{overallAverage}</td>
                            <td className="p-4 print:p-2 rounded-br-2xl" colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Bottom Section: Remarks & Bill */}
            <div className={`grid grid-cols-1 ${showFees ? 'md:grid-cols-2 print:grid-cols-2' : ''} gap-3 print:gap-1.5 mb-3 print:mb-1 mt-auto whitespace-nowrap`}>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {schoolConfig?.report_card_config?.show_attendance !== false && (
                            <div className="bg-slate-100/50 p-2 print:p-1 rounded-lg border border-slate-100 italic transition-all group">
                                <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest mb-0.5 leading-none flex items-center gap-1">
                                    Attendance <span className="text-[6px] text-slate-400">(Auto)</span>
                                </p>
                                <div className="flex items-center gap-1 leading-none h-4">
                                    <div className="flex flex-col">
                                        <input type="number" value={attendancePresentDays} readOnly={true} className="w-10 bg-transparent border-none outline-none text-center font-black text-[11px] text-blue-600 p-0 cursor-not-allowed" />
                                    </div>
                                    <span className="text-slate-300 font-bold">/</span>
                                    <div className="flex flex-col">
                                        <input type="number" value={attendanceTotalDays} readOnly={true} className="w-10 bg-transparent border-none outline-none text-center font-black text-[11px] text-slate-400 p-0 cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-slate-50 p-2 print:p-1 rounded-xl border border-slate-100 italic">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Reopens</p>
                            <input 
                                type="text" 
                                value={nextTermReopens} 
                                onChange={e => setNextTermReopens(e.target.value)} 
                                className="w-full bg-transparent border-b border-slate-200 outline-none font-bold text-[10px] p-0" 
                                placeholder="set date"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-2 print:p-1 rounded-xl border border-slate-100 italic">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Conduct</p>
                            <input type="text" value={conduct} onChange={e => setConduct(e.target.value)} className="w-full bg-transparent border-b border-slate-100 outline-none font-bold text-[10px]" placeholder="..." />
                        </div>
                        <div className="bg-slate-50 p-2 print:p-1 rounded-xl border border-slate-100 italic">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Interest</p>
                            <input type="text" value={interest} onChange={e => setInterest(e.target.value)} className="w-full bg-transparent border-b border-slate-100 outline-none font-bold text-[10px]" placeholder="..." />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 italic leading-none">Teacher Remark</p>
                                <textarea value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} className="w-full bg-slate-50/50 border border-slate-100 rounded p-1 print:py-0.5 print:px-1 text-[10px] italic font-medium resize-none h-10 print:h-7 outline-none" />
                            </div>
                        )}
                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 italic leading-none">Final Decision</p>
                                <textarea value={principalRemark} onChange={(e) => setPrincipalRemark(e.target.value)} className="w-full bg-slate-50/50 border border-slate-100 rounded p-1 print:py-0.5 print:px-1 text-[10px] italic font-medium resize-none h-10 print:h-7 outline-none" />
                            </div>
                        )}
                    </div>

                    {/* Extra Info Grid for Modern View */}
                    {extraReportSections.length > 0 && (
                        <div className="pt-4 border-t border-slate-100 mt-2">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">Additional Particulars</h4>
                                </div>
                            </div>
                            
                            <div className={`grid grid-cols-1 ${!showFees ? 'md:grid-cols-2 lg:grid-cols-2 print:grid-cols-2' : ''} gap-4 pb-4`}>
                                {extraReportSections.map((section, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative group hover:border-blue-200 transition-all print:p-0 print:border-none print:shadow-none">
                                        <div className="flex justify-between items-center mb-1">
                                            <input 
                                                type="text" 
                                                value={section.title} 
                                                onChange={e => updateExtraReportSection(idx, 'title', e.target.value)} 
                                                placeholder="Section Title"
                                                className="bg-transparent border-none text-[8px] font-black uppercase text-blue-500 outline-none w-full tracking-widest"
                                            />
                                            <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <textarea 
                                            value={section.content} 
                                            onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} 
                                            className="w-full bg-transparent border-none outline-none text-[10px] text-slate-600 min-h-12 resize-none italic font-medium leading-tight" 
                                            placeholder="..." 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {showFees && (
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

                                {/* Custom Bill Items */}
                                {extraBillItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group relative">
                                        <input 
                                            type="text" 
                                            value={item.label} 
                                            onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} 
                                            placeholder="Item Name"
                                            className="bg-transparent border-b border-white/20 text-xs uppercase tracking-wider font-bold outline-none focus:border-white w-1/2 opacity-70 focus:opacity-100 print:border-none print:opacity-100" 
                                        />
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-60 font-mono">GHS</span>
                                            <input 
                                                type="number" 
                                                value={item.value} 
                                                onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} 
                                                className="w-24 bg-white/10 border-b border-white/30 text-right outline-none font-mono py-1 px-2 focus:bg-white/20 rounded-t print:bg-slate-50 print:border-slate-300 print:text-slate-900" 
                                            />
                                            <button onClick={() => removeExtraBillItem(idx)} className="print:hidden h-6 w-6 rounded-full bg-red-400/20 hover:bg-red-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <button onClick={addExtraBillItem} className="print:hidden w-full py-2 border border-dashed border-white/30 rounded-lg text-[10px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                                    <X className="w-3 h-3 rotate-45" /> Add Custom Bill Item
                                </button>
                            </div>
                        </div>

                        <div className="relative z-10 pt-6 border-t border-white/20 flex justify-between items-end print:border-slate-900">
                            <div>
                                <p className="text-[10px] font-black uppercase opacity-70 mb-1 tracking-widest">Grand Total Payable</p>
                                <p className="text-3xl font-black tracking-tighter">
                                    <span className="text-sm mr-1 opacity-60">GHS</span>
                                    {totalBill.toFixed(2)}
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
                )}
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

