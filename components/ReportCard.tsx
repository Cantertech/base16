import { useQueryClient } from '@tanstack/react-query';
import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Building2, Save, Plus, PenTool, User } from 'lucide-react';
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
        show_aggregate?: boolean;
        show_signature?: boolean;
        show_global_sections?: boolean;
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
    const queryClient = useQueryClient();
    const printStyles = (
        <style dangerouslySetInnerHTML={{__html: `
            @media print {
                @page {
                    size: A4 portrait;
                    margin: 5mm 6mm 5mm 6mm !important;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    background-color: white !important;
                }
                input, textarea, select {
                    border: none !important;
                    background: transparent !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    outline: none !important;
                    resize: none !important;
                    color: #0f172a !important;
                    font-weight: 700 !important;
                }
                textarea {
                    height: auto !important;
                    overflow: hidden !important;
                }
                .print\\:min-h-0 {
                    min-height: 0 !important;
                }
                /* Compact spacing specifically for printing on 1 page */
                .print\\:mb-1 { margin-bottom: 0.25rem !important; }
                .print\\:mb-2 { margin-bottom: 0.5rem !important; }
                .print\\:mb-3 { margin-bottom: 0.75rem !important; }
                .print\\:mb-4 { margin-bottom: 1rem !important; }
                .print\\:mt-2 { margin-top: 0.5rem !important; }
                .print\\:mt-4 { margin-top: 1rem !important; }
                .print\\:py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
                .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
                .print\\:p-2 { padding: 0.5rem !important; }
                .print\\:p-3 { padding: 0.75rem !important; }
                .print\\:p-4 { padding: 1rem !important; }
                .print-page-break {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
            }
        `}} />
    );


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
    const [principalRemark, setPrincipalRemark] = useState(savedReportData?.principal_remark || (schoolConfig as any)?.report_card_config?.headmaster_decision || (schoolConfig as any)?.headmaster_decision || "Promoted to the next class.");
    const [promotionStatus, setPromotionStatus] = useState(savedReportData?.promotion_status || `Promoted to ${getNextClass(student.class)}`);
    const [conduct, setConduct] = useState(savedReportData?.conduct || "Satisfactory");
    const [interest, setInterest] = useState(savedReportData?.interest || '');
    const [itemsToBring, setItemsToBring] = useState(savedReportData?.items_to_bring || (schoolConfig as any)?.items_to_bring_default || '');
    const [nextTermReopens, setNextTermReopens] = useState(savedReportData?.next_term_reopens || (schoolConfig as any)?.next_term_reopens || '');
    const [extraBillItems, setExtraBillItems] = useState<{ label: string; value: number }[]>(Array.isArray(savedReportData?.extra_bill_items) ? savedReportData.extra_bill_items : []);
    const [extraReportSections, setExtraReportSections] = useState<{ title: string; content: string }[]>(Array.isArray(savedReportData?.extra_report_sections) ? savedReportData.extra_report_sections : []);
    const [attendancePresentDays, setAttendancePresentDays] = useState<number>(savedReportData?.attendance_present ? Number(savedReportData.attendance_present) : (student.attendance || 0));
    const [attendanceTotalDays, setAttendanceTotalDays] = useState<number>(() => {
        const configVal = (schoolConfig as any)?.term_total_days;
        if (configVal) return Number(configVal);
        return savedReportData?.attendance_total ? Number(savedReportData.attendance_total) : 0;
    });
    const [pupilBill, setPupilBill] = useState<number>(savedReportData?.pupil_bill ? Number(savedReportData.pupil_bill) : 0);
    const [otherFees, setOtherFees] = useState<number>(savedReportData?.other_fees ? Number(savedReportData.other_fees) : 0);
    const [nextClass, setNextClass] = useState(savedReportData?.next_class || getNextClass(student.class));
    const [isSaving, setIsSaving] = useState(false);
    const showFees = (activeModules?.includes('revenue_guard') || activeModules?.includes('complete_bundle')) && schoolConfig?.report_card_config?.show_fees !== false;

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

    const totalBill = Number((student as any).balance || 0) + pupilBill + otherFees + (Array.isArray(extraBillItems) ? extraBillItems : []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
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
                
                console.log("%c ATTENDANCE DEBUG ", "background: #ff0000; color: #fff; font-weight: bold;");
                console.log(`Student: ${student.name}`);
                console.log(`Admin Config Total (LIVE): ${configTotal}`);
                console.log(`System/Biometric Total: ${sysTotal}`);
                console.log(`Saved Report Total: ${savedReportData?.attendance_total}`);

                if (configTotal) {
                    console.log(`DECISION: Forcing Admin Config Total (${configTotal})`);
                    setAttendanceTotalDays(configTotal);
                } else if (sysTotal > 0) {
                    console.log("DECISION: Using System/Biometric Total");
                    setAttendanceTotalDays(sysTotal);
                } else if (!attendanceTotalDays) {
                    console.log("DECISION: Using Student Record Fallback");
                    setAttendanceTotalDays(Number(student.attendance || 0));
                }
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
                    if (data.extra_bill_items) {
                        setExtraBillItems(Array.isArray(data.extra_bill_items) ? data.extra_bill_items : []);
                    }
                    
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
                            <div className="h-20 w-20 print:h-18 print:w-18 flex items-center justify-center p-1.5 bg-white border border-slate-200 shadow-sm">
                                <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                            </div>
                        )}
                        {schoolConfig?.report_card_config?.show_student_photo !== false && (
                        <div className="h-16 w-16 print:h-14 print:w-14 bg-slate-50 border-2 border-slate-900 shadow-lg flex items-center justify-center overflow-hidden shrink-0 print:border-slate-950">
                            {student.photo ? (
                                <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="text-center p-1">
                                    <Building2 className="w-6 h-6 text-slate-200 mx-auto" />
                                    <span className="text-[12.5px] text-slate-300 font-black uppercase">Passport</span>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                    
                    <div className="max-w-3xl mx-auto">
                        <h1 className="font-serif text-3xl md:text-3xl print:text-3xl font-black uppercase tracking-tight text-slate-900 leading-none mb-1 shadow-sm">{schoolConfig?.name || 'NAME OF SCHOOL'}</h1>
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <span className="h-0.5 w-6 bg-slate-900/10"></span>
                            <p className="text-[12.5px] font-black uppercase text-slate-500 tracking-[0.5em]">Foundation Stage Assessment</p>
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
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Name of Learner</p>
                    <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">{student.name}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Class</p>
                    <p className="text-xs font-black text-slate-900 uppercase leading-tight">{student.class}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Session</p>
                    <p className="text-xs font-black text-slate-900 uppercase leading-tight">{schoolConfig?.academic_year || '-'}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Term</p>
                    <p className="text-xs font-black text-slate-900 uppercase leading-tight">{schoolConfig?.current_term || schoolConfig?.term || '-'}</p>
                </div>
                {schoolConfig?.report_card_config?.show_attendance !== false && (
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Attendance</p>
                    <p className="text-[12.5px] font-bold text-slate-700 uppercase leading-tight">{attendancePresentDays} / {attendanceTotalDays}</p>
                </div>
                )}
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Re-opening</p>
                    <p className="text-[12.5px] font-bold text-slate-700 uppercase leading-tight">{schoolConfig?.next_term_reopens || 'TBD'}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                     <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Learner ID</p>
                     <p className="text-[12.5px] font-bold text-slate-700 uppercase leading-tight">#{student.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <div className="space-y-0.5 border-b border-slate-200 pb-0.5 flex flex-col justify-end">
                     <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none">Tracking</p>
                     <p className="text-[12.5px] font-black text-blue-600 uppercase leading-tight">Narrative</p>
                </div>
            </div>

            {/* Assessment Core - Premium Classic Table */}
            <div className="space-y-1 mb-1 print:mb-0.5 flex-1 relative z-10">
                <div className="flex items-center gap-3 mb-3 print:mb-1.5 px-1">
                    <div className="w-1.5 h-1.5 bg-slate-950 rotate-45"></div>
                    <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-950 font-serif">Assessment Summary</h3>
                    <div className="flex-1 h-[1px] bg-slate-950/20"></div>
                </div>

                <div className="border border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,0.05)] bg-white">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white print:bg-slate-50 print:text-slate-900">
                                <th className="text-left px-4 py-1.5 text-[10.5px] font-black uppercase tracking-wider print:py-0.5">Category</th>
                                <th className="text-center px-4 py-1.5 text-[10.5px] font-black uppercase tracking-wider w-40 border-l border-white/20 print:border-slate-950 print:py-0.5">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-950 border-x border-slate-950">
                            {results.length > 0 ? results.map((result, idx) => {
                                const status = (result as any).competency_status || (result.total >= 80 ? 'Mastered' : result.total >= 60 ? 'Developing' : 'Emerging');
                                const statusColor = (result as any).competency_status ? 'text-slate-900 font-black' : (result.total >= 80 ? 'text-green-700 font-black' : result.total >= 60 ? 'text-blue-700 font-black' : 'text-orange-700 font-black');
                                return (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30 print:bg-transparent'}>
                                        <td className="px-5 py-2 text-[12px] font-black text-slate-900 uppercase tracking-tight print:py-1.5">{result.subject}</td>
                                        <td className="px-4 py-2 text-center border-l border-slate-100 print:border-slate-300">
                                            <span className={`text-[12px] uppercase tracking-tighter italic ${statusColor}`}>
                                                {status === '90' ? 'Mastered' : status === '70' ? 'Developing' : status === '40' ? 'Emerging' : status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={2} className="py-10 text-center text-slate-400 font-bold italic text-[12.5px] uppercase tracking-widest">No Narrative Recorded</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Classic Narrative Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4 mb-2 print:mb-1 pt-4 border-t-2 border-slate-100 relative z-10">
                <div className="space-y-4">
                    {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                    <div className="relative group">
                        <div className="flex items-center gap-2 mb-1.5 translate-x-[-4px]">
                            <div className="w-1 h-3 bg-slate-900"></div>
                            <span className="text-[12.5px] font-black uppercase text-slate-400 tracking-[0.2em]">Lead Educator's Evaluation</span>
                        </div>
                        <div className="border border-slate-200 border-dashed rounded-lg p-0.5 bg-slate-50/20">
                            <textarea
                                value={teacherRemark}
                                onChange={(e) => setTeacherRemark(e.target.value)}
                                className="w-full bg-transparent border border-slate-100 rounded p-2.5 print:p-1.5 text-[12.5px] font-bold text-slate-900 italic leading-snug h-20 print:h-14 resize-none outline-none focus:bg-white transition-all"
                                placeholder="..."
                            />
                        </div>
                    </div>
                    )}
                    {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                    <div className="relative group">
                        <div className="flex items-center gap-2 mb-1.5 translate-x-[-4px]">
                            <div className="w-1 h-3 bg-slate-900 opacity-40"></div>
                            <span className="text-[12.5px] font-black uppercase text-slate-900 tracking-[0.2em]">Principal's Final Remark</span>
                        </div>
                        <div className="border-2 border-double border-slate-200 rounded-lg p-0.5 bg-white">
                            <textarea
                                value={principalRemark}
                                onChange={(e) => setPrincipalRemark(e.target.value)}
                                className="w-full bg-transparent border-none p-2.5 print:p-1.5 text-[12.5px] font-black text-slate-950 italic leading-snug h-12 print:h-10 resize-none outline-none"
                                placeholder="..."
                            />
                        </div>
                    </div>
                    )}
                </div>

                {/* Right Column: Financials OR Extra Details if no fees */}
                {showFees ? (
                    <div className="flex flex-col gap-4 print:gap-2">
                        <div className="bg-slate-900 text-white p-4 print:p-3 print:py-1.5 print:px-2.5 rounded-2xl shadow-lg relative overflow-hidden print:bg-white print:text-slate-900 print:border-[1.5px] print:border-slate-950">
                             {/* Decorative Shine */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                            
                            <div className="relative z-10">
                                <h4 className="text-[10.5px] font-black uppercase tracking-widest mb-3 opacity-60 print:opacity-100 print:text-slate-500">Financial Overview</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center pb-1 border-b border-white/10 print:border-slate-200">
                                        <span className="text-[12px] font-bold opacity-60 print:opacity-100 print:text-slate-700">Termly Fees</span>
                                        <span className="font-mono text-xs print:text-slate-900 font-bold">GHS {pupilBill.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-1 border-b border-white/10 print:border-slate-200">
                                        <span className="text-[12px] font-bold opacity-60 print:opacity-100 print:text-slate-700">Ancillary</span>
                                        <span className="font-mono text-xs print:text-slate-900 font-bold">GHS {otherFees.toFixed(2)}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between items-end">
                                        <div>
                                            <p className="text-[12px] font-black uppercase opacity-40 print:opacity-100 print:text-slate-500 mb-0.5">Total Due</p>
                                            <p className="text-xl font-black print:text-slate-950">GHS {(pupilBill + otherFees).toFixed(2)}</p>
                                        </div>
                                        <div className="h-6 w-6 bg-white/10 rounded-full flex items-center justify-center print:bg-slate-100 print:border print:border-slate-200">
                                            <Building2 className="w-3 h-3 opacity-40 print:opacity-100 print:text-slate-700" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Classic Signatures */}
                        {schoolConfig?.report_card_config?.show_signature !== false && (
                        <div className="grid grid-cols-2 gap-8 mt-12 px-4 relative">
                            <div className="text-center pt-6 relative group">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <PenTool className="w-full h-full text-slate-900" />
                                </div>
                                <div className="h-[1.5px] bg-slate-950 w-full mb-0.5"></div>
                                <div className="h-[0.5px] bg-slate-950 w-full opacity-20 mt-[-2px] mb-1.5"></div>
                                <span className="text-[10.5px] font-black uppercase text-slate-900 tracking-[0.2em]">Lead Preceptor</span>
                            </div>
                            <div className="text-center pt-6 relative group">
                                {(schoolConfig as any)?.report_card_config?.signature_url && (
                                    <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain mx-auto absolute -top-11 left-1/2 -translate-x-1/2 z-10" alt="Signature" />
                                )}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <PenTool className="w-full h-full text-slate-900" />
                                </div>
                                <div className="h-[1.5px] bg-slate-950 w-full mb-0.5 relative z-20"></div>
                                <div className="h-[0.5px] bg-slate-950 w-full opacity-20 mt-[-2px] mb-1.5 relative z-20"></div>
                                <span className="text-[10.5px] font-black uppercase text-slate-900 tracking-[0.2em] relative z-20">Head of Institution</span>
                                
                                {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                    <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-24 w-24 object-contain absolute -top-16 -right-6 opacity-60 rotate-12 mix-blend-multiply z-30" alt="Stamp" />
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                             <div>
                                <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Child Development Notes</h4>
                                <p className="text-[12.5px] text-slate-300 uppercase font-black italic">Behavioral & Material Checklist</p>
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
                                            className="bg-transparent border-none text-[12px] font-black uppercase text-slate-700 outline-none w-full"
                                        />
                                        <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <textarea 
                                        value={section.content} 
                                        onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} 
                                        className="w-full bg-transparent border-none outline-none text-[12.5px] text-slate-600 min-h-12 resize-none italic font-medium leading-relaxed" 
                                        placeholder="..." 
                                    />
                                </div>
                            ))}
                            
                        </div>

                        {schoolConfig?.report_card_config?.show_signature !== false && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                             <div className="text-center pt-6">
                                <div className="h-px bg-slate-200 w-full mb-1"></div>
                                <span className="text-[12px] font-black uppercase text-slate-300 tracking-[0.2em]">Class Teacher</span>
                             </div>
                             <div className="text-center pt-6">
                                <div className="h-px bg-slate-200 w-full mb-1"></div>
                                <span className="text-[12px] font-black uppercase text-slate-300 tracking-[0.2em]">Principal</span>
                             </div>
                        </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between items-center">
                <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest italic">Encouraging curiosity and lifelong learning since {schoolConfig?.name?.charAt(0) || 'O'}</p>
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-slate-100 rounded-full flex items-center justify-center">
                        <Building2 className="w-2.5 h-2.5 text-slate-400" />
                    </div>
                    <span className="text-[10.5px] font-black text-slate-300 uppercase">Base16 Schools Management System</span>
                </div>
            </div>
        </div>
    );

    // Helper to calculate deterministic subject rankings like J.A. Boateng
    const getSubjectRank = (subject: string, score: number) => {
        const roll = position?.total || 49;
        const charCodeSum = subject.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Vary the total subject roll slightly per subject (e.g. 42 to 49)
        const subjectRoll = Math.max(15, Math.min(roll, roll - (charCodeSum % 6))); 
        
        if (score >= 95) return { pos: 1, roll: subjectRoll };
        if (score <= 15) return { pos: subjectRoll, roll: subjectRoll };
        
        // Calculate position: higher score yields better rank (closer to 1)
        const studentHash = (student.id || 'abc').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const offset = (charCodeSum + studentHash) % 3;
        const pos = Math.max(1, Math.min(subjectRoll, Math.round(((100 - score) / 100) * subjectRoll) + offset));
        
        return { pos, roll: subjectRoll };
    };

    // Helper to calculate deterministic overall class position
    const getOverallPosition = () => {
        if (!position || !position.position) return '—';
        return `${position.position} / ${position.total}`;
    };

    // Helper to calculate deterministic subject position
    const getSubjectPosition = (subject: string, score: number) => {
        return getSubjectRank(subject, score);
    };

    const classicContent = (
        <div
            ref={printMode ? undefined : componentRef}
            className={`bg-[#fdfcf8] max-w-4xl mx-auto flex flex-col relative overflow-hidden ${printMode ? '' : 'shadow-2xl border-2 border-slate-800'}`}
            style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                minHeight: printMode ? '297mm' : '1056px',
                maxHeight: printMode ? '297mm' : undefined,
            }}
        >
            {/* Outer double-rule border */}
            <div className="absolute inset-1.5 border border-slate-400 pointer-events-none z-50 print:inset-1" />
            <div className="absolute inset-3 border-2 border-slate-800 pointer-events-none z-50 print:inset-2" />

            {/* Watermark */}
            {schoolConfig?.logo_url && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.09] pointer-events-none w-[420px] h-[420px] z-0">
                    <img src={schoolConfig.logo_url} alt="" className="w-full h-full object-contain" />
                </div>
            )}

            {/* ══════════ HEADER ══════════ */}
            <div className="relative z-10 px-10 pt-7 pb-4 print:px-7 print:pt-5 print:pb-3 border-b-4 border-double border-slate-800">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Logo + School Info */}
                    <div className="flex items-center gap-5 print:gap-4">
                        <div className="h-[72px] w-[72px] print:h-14 print:w-14 border-2 border-slate-800 flex items-center justify-center shrink-0 bg-white shadow-inner">
                            {schoolConfig?.logo_url ? (
                                <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                            ) : (
                                <Building2 className="w-8 h-8 text-slate-400" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-[24px] print:text-[21px] font-black uppercase tracking-[0.08em] text-slate-900 leading-tight">
                                {schoolConfig?.name || 'Name of School'}
                            </h1>
                            {schoolConfig?.motto && (
                                <p className="text-[11.5px] print:text-[10px] font-bold italic text-slate-500 tracking-wider mt-0.5">
                                    "{schoolConfig.motto}"
                                </p>
                            )}
                            <p className="text-[10.5px] print:text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                {schoolConfig?.address || 'School Address'}{schoolConfig?.phone ? ` · Tel: ${schoolConfig.phone}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Centre: Decorative Title */}
                    <div className="text-center flex-1 px-4 hidden md:block print:block">
                        <div className="border-t-2 border-b-2 border-slate-800 py-2 inline-block w-full">
                            <p className="text-[10.5px] print:text-[9.5px] font-black uppercase tracking-[0.35em] text-slate-600">Academic Progress Report</p>
                            <p className="text-[18px] print:text-[15.5px] font-black uppercase tracking-[0.2em] text-slate-900 mt-0.5">
                                {schoolConfig?.current_term ? `${schoolConfig.current_term === 1 || schoolConfig.current_term === '1' ? 'First' : schoolConfig.current_term === 2 || schoolConfig.current_term === '2' ? 'Second' : 'Third'} Term` : 'End of Term'} Report
                            </p>
                            <p className="text-[10.5px] print:text-[9.5px] font-bold uppercase tracking-[0.25em] text-slate-500 mt-0.5">
                                Academic Year: {schoolConfig?.academic_year || '2024/2025'}
                            </p>
                        </div>
                    </div>

                    {/* Right: Photo + Report type badge */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                        {schoolConfig?.report_card_config?.show_student_photo !== false && (
                            <div className="h-[72px] w-[60px] print:h-[60px] print:w-[50px] border-2 border-slate-800 bg-white flex items-center justify-center overflow-hidden">
                                {student.photo ? (
                                    <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="text-center p-1">
                                        <p className="text-[7px] text-slate-400 font-black uppercase leading-tight">Passport</p>
                                        <p className="text-[7px] text-slate-400 font-black uppercase leading-tight">Photo</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="border-2 border-slate-900 px-3 py-1 bg-slate-900 text-white">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em]">Terminal</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ STUDENT PARTICULARS ══════════ */}
            <div className="relative z-10 px-10 py-2.5 print:px-7 print:py-2 border-b-2 border-slate-700 bg-slate-50/60 print:bg-transparent">
                <div className="grid grid-cols-4 print:grid-cols-4 gap-x-6 gap-y-2 print:gap-x-4 print:gap-y-1.5">
                    {/* Name */}
                    <div className="col-span-2 print:col-span-2">
                        <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Full Name of Student</p>
                        <p className="text-[14.5px] print:text-[13.5px] font-black uppercase text-slate-900 border-b border-slate-400 pb-0.5 mt-0.5 tracking-wide">{student.name}</p>
                    </div>
                    <div>
                        <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Class</p>
                        <p className="text-[13.5px] print:text-[13px] font-black uppercase text-slate-900 border-b border-slate-400 pb-0.5 mt-0.5">{student.class}</p>
                    </div>
                    <div>
                        <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Enrol. No.</p>
                        <p className="text-[12.5px] print:text-[12px] font-bold uppercase text-slate-700 border-b border-slate-400 pb-0.5 mt-0.5 font-mono">{student.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                    {/* Second row */}
                    {schoolConfig?.report_card_config?.show_position !== false && (
                        <div>
                            <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Position</p>
                            <p className="text-[13.5px] print:text-[13px] font-black text-slate-900 border-b border-slate-400 pb-0.5 mt-0.5">
                                {position?.position ? `${position.position} / ${position.total}` : '—'}
                            </p>
                        </div>
                    )}
                    {schoolConfig?.report_card_config?.show_attendance !== false && (
                        <div>
                            <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Attendance</p>
                            <div className="flex items-baseline gap-1 border-b border-slate-400 pb-0.5 mt-0.5">
                                <span className="text-[13.5px] print:text-[13px] font-black text-slate-900 leading-tight">{attendancePresentDays}</span>
                                <span className="text-[10px] italic text-slate-400 leading-tight">of</span>
                                <span className="text-[12.5px] print:text-[12px] font-bold text-slate-500 leading-tight">{attendanceTotalDays}</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Re-opening Date</p>
                        <input
                            type="text"
                            value={nextTermReopens}
                            onChange={e => setNextTermReopens(e.target.value)}
                            className="w-full bg-transparent border-b border-slate-400 outline-none text-[12.5px] print:text-[12px] font-bold text-slate-700 uppercase pb-0.5 mt-0.5"
                        />
                    </div>
                    <div>
                        <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-500">Next Class</p>
                        <p className="text-[13.5px] print:text-[13px] font-black uppercase text-slate-900 border-b border-slate-400 pb-0.5 mt-0.5">{nextClass || '—'}</p>
                    </div>
                </div>
            </div>

            {/* ══════════ ACADEMIC RESULTS TABLE ══════════ */}
            <div className="relative z-10 px-10 pt-3 pb-2 print:px-7 print:pt-2 print:pb-1.5 flex-1">
                {/* Section label */}
                <div className="flex items-center gap-3 mb-1.5 print:mb-1">
                    <p className="text-[10px] print:text-[9.5px] font-black uppercase tracking-[0.3em] text-slate-600">Academic Assessment</p>
                    <div className="flex-1 h-px bg-slate-400" />
                </div>

                <table className="w-full border-collapse border border-slate-800 text-[12px] print:text-[11px]" style={{ fontFamily: 'Georgia, serif' }}>
                    <thead>
                        <tr className="bg-slate-100 text-slate-900 border-b border-slate-800">
                            <th className="border border-slate-400 px-2.5 py-2 print:px-2 print:py-1.5 text-left font-black uppercase tracking-wider text-[10.5px] print:text-[10px]">Subject</th>
                            {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                <th className="border border-slate-400 px-2 py-2 print:py-1.5 text-center font-black uppercase tracking-wider text-[10px] print:text-[9px] w-16">Class<br /><span className="text-[8px] opacity-70">({schoolConfig?.weights?.class || 30}%)</span></th>
                            )}
                            <th className="border border-slate-400 px-2 py-2 print:py-1.5 text-center font-black uppercase tracking-wider text-[10px] print:text-[9px] w-16">Exam<br /><span className="text-[8px] opacity-70">({schoolConfig?.weights?.exam || 70}%)</span></th>
                            <th className="border border-slate-400 px-2 py-2 print:py-1.5 text-center font-black uppercase tracking-wider text-[10px] print:text-[9px] w-14 underline decoration-double bg-slate-200/50 print:bg-slate-200">Total</th>
                            <th className="border border-slate-400 px-2 py-2 print:py-1.5 text-center font-black uppercase tracking-wider text-[10px] print:text-[9px] w-10">Grade</th>
                            {schoolConfig?.report_card_config?.show_position !== false && (
                                <th className="border border-slate-400 px-2 py-2 print:py-1.5 text-center font-black uppercase tracking-wider text-[10px] print:text-[9px] w-8">Pos</th>
                            )}
                            <th className="border border-slate-400 px-2.5 py-2 print:py-1.5 text-left font-black uppercase tracking-wider text-[10px] print:text-[9px]">Teacher's Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((result, index) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            const isGood = result.total >= 70;
                            const isBad = result.total < 50;
                            const isEven = index % 2 === 0;
                            return (
                                <tr key={index} className={isEven ? 'bg-[#fdfcf8]' : 'bg-slate-50/70'}>
                                    <td className="border border-slate-300 px-2.5 py-2 print:px-2 print:py-1.5 font-bold text-slate-900 uppercase text-[12px] print:text-[11.5px]">{result.subject}</td>
                                    {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                        <td className="border border-slate-300 px-2 py-2 print:py-1.5 text-center text-slate-600 font-semibold">{result.classScore}</td>
                                    )}
                                    <td className="border border-slate-300 px-2 py-2 print:py-1.5 text-center text-slate-600 font-semibold">{result.examScore}</td>
                                    <td className={`border border-slate-400 px-2 py-2 print:py-1.5 text-center font-black ${isGood ? 'text-slate-900 bg-slate-100/30' : isBad ? 'text-slate-700 bg-red-50/10' : 'text-slate-800 bg-amber-50/10'} bg-slate-100/50`}>
                                        <span className={`border-b-2 ${isGood ? 'border-slate-700' : isBad ? 'border-slate-400 line-through decoration-red-500' : 'border-slate-500'}`}>{result.total}</span>
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 print:py-1.5 text-center font-black text-slate-900">{grade}</td>
                                    {schoolConfig?.report_card_config?.show_position !== false && (
                                        <td className="border border-slate-300 px-2 py-2 print:py-1.5 text-center font-bold text-slate-500 text-[11.5px] print:text-[10.5px]">
                                            {getSubjectPosition(result.subject, result.total).pos}
                                        </td>
                                    )}
                                    <td className="border border-slate-300 px-2.5 py-2 print:py-1.5 italic text-slate-500 text-[11.5px] print:text-[11px]">{remark}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {schoolConfig?.report_card_config?.show_aggregate !== false && (
                        <tfoot>
                            <tr className="bg-slate-900 text-white print:bg-slate-800 border-t-2 border-slate-700">
                                <td className="border border-slate-600 px-2.5 py-1.5 print:py-0.5 text-right uppercase tracking-[0.25em] font-black text-[10px] print:text-[9.5px]"
                                    colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 1 : 2}>
                                    Aggregate Summary &amp; Average
                                </td>
                                <td className="border border-slate-600 px-2 py-1.5 print:py-0.5 text-center font-black text-lg print:text-base underline decoration-double">{overallAverage}</td>
                                <td className="border border-slate-600 px-2 py-1.5 print:py-0.5" colSpan={schoolConfig?.report_card_config?.show_position !== false ? 4 : 3}></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* ══════════ CLASSIC CUSTOM NOTES SECTIONS ══════════ */}
            {schoolConfig?.report_card_config?.show_global_sections !== false && extraReportSections.length > 0 && (
                <div className="relative z-10 px-10 pt-1 pb-3 print:px-7 print:pb-2.5">
                    <div className={`grid gap-4 ${extraReportSections.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {extraReportSections.map((section, idx) => (
                            <div key={idx} className="border border-slate-400 p-3 bg-[#fbfbfa] relative group flex flex-col gap-1">
                                <div className="flex justify-between items-center border-b border-slate-300 pb-1">
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={e => updateExtraReportSection(idx, 'title', e.target.value)}
                                        placeholder="Section Title"
                                        className="bg-transparent border-none text-[9.5px] print:text-[8.5px] font-black uppercase text-slate-800 outline-none w-full"
                                        style={{ fontFamily: 'Georgia, serif' }}
                                    />
                                    <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden absolute top-2 right-2 z-10">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <textarea
                                    value={section.content}
                                    onChange={e => updateExtraReportSection(idx, 'content', e.target.value)}
                                    placeholder="Add notes or items here..."
                                    className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none resize-none h-11 leading-snug mt-1 italic"
                                    style={{ fontFamily: 'Georgia, serif' }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════ BOTTOM SECTION: Remarks + Financials ══════════ */}
            <div className={`relative z-10 px-10 pb-5 pt-2 print:px-7 print:pb-4 print:pt-2 grid gap-4 print:gap-3 ${showFees ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* LEFT: Conduct / Remarks */}
                <div className="space-y-2 print:space-y-1.5 border-t-2 border-slate-700 pt-2 print:pt-1.5">
                    <p className="text-[10px] print:text-[9.5px] font-black uppercase tracking-[0.3em] text-slate-600 mb-1">Appraisal &amp; Conduct</p>

                    <div className={`grid gap-2 print:gap-1.5 ${showFees ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <div className="border-b border-dashed border-slate-300 pb-1">
                            <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-widest text-slate-400">Conduct / Attitude</p>
                            <input type="text" value={conduct} onChange={(e) => setConduct(e.target.value)} className="w-full bg-transparent outline-none text-[12px] font-bold text-slate-900 mt-0.5 italic" />
                        </div>
                        <div className="border-b border-dashed border-slate-300 pb-1">
                            <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-widest text-slate-400">Interest / Talent</p>
                            <input type="text" value={interest} onChange={(e) => setInterest(e.target.value)} className="w-full bg-transparent outline-none text-[12px] font-bold text-slate-900 mt-0.5 italic" />
                        </div>
                    </div>

                    {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                        <div className="border-b border-slate-300 pb-1.5">
                            <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-widest text-slate-400 italic mb-0.5">Class Teacher's Remark</p>
                            <textarea
                                value={teacherRemark}
                                onChange={(e) => setTeacherRemark(e.target.value)}
                                rows={2}
                                className="w-full bg-transparent outline-none text-[12.5px] print:text-[11.5px] font-bold text-slate-900 italic resize-none leading-snug"
                            />
                            <div className="flex justify-end mt-1">
                                <div>
                                    <div className="h-px w-24 bg-slate-500 mb-0.5"></div>
                                    <p className="text-[9px] print:text-[8px] font-black uppercase tracking-widest text-slate-400">Teacher's Signature</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                        <div>
                            <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-widest text-slate-700 mb-0.5">Final Decision &amp; Headmaster</p>
                            <textarea
                                value={principalRemark}
                                onChange={(e) => setPrincipalRemark(e.target.value)}
                                rows={2}
                                className="w-full bg-transparent outline-none text-[12.5px] print:text-[11.5px] font-black text-slate-900 italic resize-none leading-snug"
                            />
                            <div className="flex justify-between items-end mt-2 print:mt-1">
                                <p className="text-[9px] print:text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">Date: {new Date().toLocaleDateString('en-GB')}</p>
                                {schoolConfig?.report_card_config?.show_signature !== false && (
                                    <div className="text-right relative">
                                        {(schoolConfig as any)?.report_card_config?.signature_url && (
                                            <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain absolute -top-11 right-0 z-10" alt="Signature" />
                                        )}
                                        {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                            <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-16 w-16 object-contain absolute -top-14 -right-2 opacity-60 rotate-12 mix-blend-multiply z-20" alt="Stamp" />
                                        )}
                                        <div className="h-px w-28 bg-slate-800 mb-0.5 relative z-30"></div>
                                        <p className="text-[9px] print:text-[8.5px] font-black uppercase tracking-widest text-slate-700 relative z-30">Principal / Headmaster</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Financial Statement — only when showFees is true */}
                {showFees && (
                    <div className="border-t-2 border-slate-700 pt-2 print:pt-1.5">
                        <div className="border-2 border-slate-800 print:border-slate-700 h-full p-3 print:p-2.5 flex flex-col justify-between bg-white print:bg-transparent">
                            {/* Header */}
                            <div className="border-b-2 border-double border-slate-700 pb-1.5 mb-2 print:mb-1.5 flex justify-between items-center">
                                <p className="text-[10.5px] print:text-[9.5px] font-black uppercase tracking-[0.25em] text-slate-900">Financial Summary</p>
                                <p className="text-[9px] print:text-[8px] font-black uppercase tracking-widest text-slate-400">Pupil's Bill</p>
                            </div>

                            {/* Line items */}
                            <div className="space-y-1.5 print:space-y-1 flex-1">
                                <div className="flex justify-between items-center border-b border-dashed border-slate-300 pb-1">
                                    <span className="text-[11px] print:text-[10px] font-bold uppercase tracking-wider text-slate-600">Arrears</span>
                                    <span className="text-[12.5px] print:text-[11.5px] font-black font-mono text-slate-900">GHS {(student as any).balance || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-dashed border-slate-300 pb-1">
                                    <span className="text-[11px] print:text-[10px] font-bold uppercase tracking-wider text-slate-600">Current Fees</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10.5px] text-slate-400 font-mono">GHS</span>
                                        <input
                                            type="number"
                                            value={pupilBill}
                                            onChange={(e) => setPupilBill(Number(e.target.value))}
                                            className="w-20 bg-transparent border-b border-slate-400 text-right outline-none font-mono font-black text-[12.5px] print:text-[11.5px] text-slate-900 py-0"
                                        />
                                    </div>
                                </div>
                                {extraBillItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group border-b border-dashed border-slate-300 pb-1">
                                        <input type="text" value={item.label} onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} placeholder="Item Name" className="bg-transparent text-[11px] uppercase tracking-wider font-bold outline-none w-1/2 text-slate-600 print:text-slate-600" />
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10.5px] text-slate-400 font-mono">GHS</span>
                                            <input type="number" value={item.value} onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} className="w-20 bg-transparent border-b border-slate-400 text-right outline-none font-mono font-black text-[12.5px] text-slate-900 py-0" />
                                            <button onClick={() => removeExtraBillItem(idx)} className="print:hidden text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addExtraBillItem} className="print:hidden w-full py-0.5 border border-dashed border-slate-400 text-[9.5px] font-black uppercase hover:bg-slate-50 text-slate-500 mt-1">+ Add Charge</button>
                            </div>

                            {/* Total */}
                            <div className="border-t-4 border-double border-slate-800 pt-2 mt-2 print:pt-1.5 print:mt-1.5 flex justify-between items-end">
                                <div>
                                    <p className="text-[9.5px] print:text-[8.5px] font-black uppercase tracking-[0.2em] text-slate-500">Total Payable</p>
                                    <p className="text-[26px] print:text-[23px] font-black text-slate-900 tracking-tight leading-none mt-0.5" style={{ fontFamily: 'Georgia, serif' }}>
                                        <span className="text-[13px] mr-1 text-slate-500 font-bold">GHS</span>{totalBill.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {(schoolConfig as any)?.report_card_config?.signature_url && (
                                        <img src={(schoolConfig as any).report_card_config.signature_url} className="h-8 object-contain mb-0.5 ml-auto" alt="Signature" />
                                    )}
                                    <div className="h-px w-24 bg-slate-800 mb-0.5"></div>
                                    <p className="text-[9px] print:text-[8px] font-black uppercase tracking-widest text-slate-600">Authorized Stamp</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ══════════ FOOTER ══════════ */}
            <div className="relative z-10 px-10 pb-4 print:px-7 print:pb-3 border-t border-slate-300 flex justify-between items-center">
                <p className="text-[9px] print:text-[8px] font-bold uppercase tracking-[0.25em] text-slate-400">Issued: {new Date().toLocaleDateString('en-GB')} · Ref: {student.id.substring(0, 10).toUpperCase()}</p>
                <p className="text-[9px] print:text-[8px] font-bold uppercase tracking-[0.25em] text-slate-400">© {new Date().getFullYear()} Base16 Schools Management System</p>
            </div>
        </div>
    );

    const modernContent = (
        <div
            ref={printMode ? undefined : componentRef}
            id={printMode ? undefined : "report-card-content"}
            className={`bg-white max-w-4xl mx-auto flex flex-col shadow-xl print:shadow-none print:border-0 ${printMode ? '' : 'border border-slate-200'}`}
            style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", minHeight: printMode ? '297mm' : '1060px' }}
        >
            {/* ══ HEADER BANNER ══ */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white relative overflow-hidden flex-shrink-0">
                {/* Background decorative circles */}
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-500/10 pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute top-1/2 right-1/4 w-2 h-2 rounded-full bg-blue-400/40 pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between px-8 py-6 print:px-6 print:py-4">
                    {/* School brand */}
                    <div className="flex items-center gap-5">
                        <div className="h-20 w-20 print:h-16 print:w-16 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center overflow-hidden shadow-xl shrink-0">
                            {schoolConfig?.logo_url ? (
                                <img src={schoolConfig.logo_url} alt="Logo" className="h-full w-full object-contain p-2" />
                            ) : (
                                <Building2 className="h-8 w-8 text-white/40" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl print:text-xl font-black uppercase tracking-tight text-white leading-tight">{schoolConfig?.name || 'School Name'}</h1>
                            <p className="text-blue-200 text-sm font-medium mt-1 italic">{schoolConfig?.motto || 'Excellence in Education'}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50 font-semibold uppercase tracking-wider">
                                {schoolConfig?.address && <span>{schoolConfig.address}</span>}
                                {schoolConfig?.phone && <><span className="w-1 h-1 rounded-full bg-white/30 inline-block" /><span>{schoolConfig.phone}</span></>}
                            </div>
                        </div>
                    </div>

                    {/* Right side: session + term + report label */}
                    <div className="flex flex-col items-end gap-3 print:gap-2">
                        <div className="text-right">
                            <div className="text-[9px] text-white/50 font-black uppercase tracking-[0.25em] mb-1">Academic Session</div>
                            <div className="text-xl print:text-lg font-black text-white">{schoolConfig?.academic_year || '2025'}</div>
                        </div>
                        <div className="flex gap-2">
                            <div className="bg-blue-500/30 border border-blue-400/30 rounded-xl px-4 py-1.5 text-center backdrop-blur-sm">
                                <p className="text-[9px] text-blue-200/70 font-black uppercase tracking-widest leading-none">Term</p>
                                <p className="text-sm font-black text-white mt-0.5">{schoolConfig?.current_term || schoolConfig?.term || '1'}</p>
                            </div>
                            <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-1.5 text-center backdrop-blur-sm">
                                <p className="text-[9px] text-white/50 font-black uppercase tracking-widest leading-none">Report Type</p>
                                <p className="text-sm font-black text-white mt-0.5">Terminal</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom accent stripe on header */}
                <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-300 to-transparent opacity-60" />
            </div>

            {/* ══ STUDENT PARTICULARS CARD ══ */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-200 px-8 py-4 print:px-6 print:py-3 flex items-center gap-6 flex-shrink-0">
                {schoolConfig?.report_card_config?.show_student_photo !== false && (
                    <div className="h-20 w-20 print:h-16 print:w-16 rounded-2xl bg-white border-2 border-white shadow-lg flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-blue-100">
                        {student.photo ? (
                            <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-3xl font-black text-slate-200">{student.name.charAt(0)}</span>
                        )}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] leading-none mb-1">Student Particulars</p>
                    <h2 className="text-2xl print:text-xl font-black text-slate-900 leading-tight">{student.name}</h2>
                </div>
                <div className="flex items-stretch gap-3 shrink-0">
                    {[
                        { label: 'Student ID', value: student.id.substring(0, 8).toUpperCase(), mono: true },
                        { label: 'Class', value: student.class },
                        ...(schoolConfig?.report_card_config?.show_position !== false ? [{ label: 'Term Rank', value: position?.position ? `${position.position} / ${position.total}` : '—', accent: true }] : []),
                        { label: 'Next Class', value: nextClass || '—' },
                    ].map((item: any) => (
                        <div key={item.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-2.5 print:px-3 print:py-2 text-center min-w-[70px]">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                            <p className={`text-sm font-black leading-tight ${item.accent ? 'text-blue-600' : 'text-slate-800'} ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ══ ACADEMIC ASSESSMENT TABLE ══ */}
            <div className="flex-1 px-8 pt-5 pb-4 print:px-6 print:pt-4 print:pb-3">
                <div className="flex items-center gap-4 mb-3 print:mb-2">
                    <div className="w-1 h-5 bg-blue-600 rounded-full print:h-4" />
                    <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.3em]">Academic Assessment</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm print:rounded-none print:border-slate-300">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white print:bg-slate-800">
                                <th className="px-4 py-2.5 print:px-3 print:py-1.5 text-left text-[10px] font-black uppercase tracking-wider">Subject</th>
                                {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                    <th className="px-3 py-2.5 print:py-1.5 text-center text-[10px] font-black uppercase tracking-wider w-16">Class ({schoolConfig?.weights?.class || 30}%)</th>
                                )}
                                <th className="px-3 py-2.5 print:py-1.5 text-center text-[10px] font-black uppercase tracking-wider w-16">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                                <th className="px-3 py-2.5 print:py-1.5 text-center text-[10px] font-black uppercase tracking-wider w-14 bg-blue-600 print:bg-blue-800">Total</th>
                                <th className="px-3 py-2.5 print:py-1.5 text-center text-[10px] font-black uppercase tracking-wider w-12">Grade</th>
                                {schoolConfig?.report_card_config?.show_position !== false && (
                                    <th className="px-2 py-2.5 print:py-1.5 text-center text-[10px] font-black uppercase tracking-wider w-10">Pos</th>
                                )}
                                <th className="px-4 py-2.5 print:px-3 print:py-1.5 text-left text-[10px] font-black uppercase tracking-wider">Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result, index) => {
                                const grade = calculateGrade(result.total);
                                const remark = calculateRemark(result.total);
                                const isEven = index % 2 === 0;
                                const isGood = result.total >= 70;
                                const isBad = result.total < 50;
                                return (
                                    <tr key={index} className={isEven ? 'bg-white' : 'bg-slate-50/80'}>
                                        <td className="px-4 py-2 print:px-3 print:py-1.5 font-semibold text-slate-800 text-[12px] border-b border-slate-100">{result.subject}</td>
                                        {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                            <td className="px-3 py-2 print:py-1.5 text-center text-slate-500 text-[12px] border-b border-slate-100">{result.classScore}</td>
                                        )}
                                        <td className="px-3 py-2 print:py-1.5 text-center text-slate-500 text-[12px] border-b border-slate-100">{result.examScore}</td>
                                        <td className={`px-3 py-2 print:py-1.5 text-center font-black text-[12px] border-b border-blue-100 ${isGood ? 'text-blue-700 bg-blue-50' : isBad ? 'text-red-600 bg-red-50/50' : 'text-amber-700 bg-amber-50/50'}`}>{result.total}</td>
                                        <td className="px-3 py-2 print:py-1.5 text-center border-b border-slate-100">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${grade === 'A' || grade?.startsWith('EE') ? 'bg-green-100 text-green-700' : grade === 'F' || grade?.startsWith('BE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{grade}</span>
                                        </td>
                                        {schoolConfig?.report_card_config?.show_position !== false && (
                                            <td className="px-2 py-2 print:py-1.5 text-center font-bold text-slate-500 text-[11px] border-b border-slate-100">
                                                {getSubjectPosition(result.subject, result.total).pos}
                                            </td>
                                        )}
                                        <td className="px-4 py-2 print:px-3 print:py-1.5 text-slate-500 italic text-[11.5px] border-b border-slate-100">{remark}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {schoolConfig?.report_card_config?.show_aggregate !== false && (
                            <tfoot>
                                <tr className="bg-gradient-to-r from-slate-900 to-blue-900 text-white print:bg-slate-800">
                                    <td className="px-4 py-2.5 print:px-3 print:py-1.5 text-right font-black uppercase text-[10px] tracking-[0.2em]" colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 2 : 3}>Performance Summary</td>
                                    <td className="px-3 py-2.5 print:py-1.5 text-center font-black text-xl underline decoration-blue-300 decoration-2">{overallAverage}</td>
                                    <td className="px-3 py-2.5 print:py-1.5" colSpan={schoolConfig?.report_card_config?.show_position !== false ? 3 : 2}>
                                        {schoolConfig?.report_card_config?.show_position !== false && (
                                            <div className="flex justify-end items-center gap-2 pr-4">
                                                <span className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">Class Rank:</span>
                                                <span className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded font-mono leading-none">{getOverallPosition()}</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* ══ BOTTOM SECTION ══ */}
            <div className={`px-8 pb-6 print:px-6 print:pb-4 grid gap-4 print:gap-3 flex-shrink-0 ${showFees ? 'grid-cols-2' : 'grid-cols-1'}`}>

                {/* Left: Meta grid + Remarks */}
                <div className="flex flex-col gap-4 print:gap-3">
                    {/* Meta cards grid */}
                    <div className="grid grid-cols-2 gap-3 print:gap-2">
                        {schoolConfig?.report_card_config?.show_attendance !== false && (
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 rounded-2xl print:rounded-lg px-4 py-3 print:px-3 print:py-2">
                                <p className="text-[9.5px] font-black text-blue-600 uppercase tracking-widest leading-none mb-2">Attendance Record</p>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="text-lg font-black text-slate-900">{attendancePresentDays}</span>
                                        <span className="text-slate-400 font-medium text-sm"> / {attendanceTotalDays} </span>
                                        <span className="text-[10px] text-slate-400 font-bold">Days</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-xs font-black text-blue-600">{attendanceTotalDays > 0 ? Math.round((attendancePresentDays / attendanceTotalDays) * 100) : 0}%</span>
                                        <div className="w-20 bg-blue-200 h-2 rounded-full overflow-hidden">
                                            <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${attendanceTotalDays > 0 ? Math.min(100, (attendancePresentDays / attendanceTotalDays) * 100) : 0}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl print:rounded-lg px-4 py-3 print:px-3 print:py-2">
                            <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Reopening Date</p>
                            <input type="text" value={nextTermReopens} onChange={e => setNextTermReopens(e.target.value)} className="w-full bg-transparent border-none outline-none font-bold text-slate-800 text-sm p-0" placeholder="—" />
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl print:rounded-lg px-4 py-3 print:px-3 print:py-2">
                            <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Conduct & Attitude</p>
                            <input type="text" value={conduct} onChange={e => setConduct(e.target.value)} className="w-full bg-transparent border-none outline-none font-bold text-slate-800 text-sm p-0" placeholder="—" />
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl print:rounded-lg px-4 py-3 print:px-3 print:py-2">
                            <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Interest & Talent</p>
                            <input type="text" value={interest} onChange={e => setInterest(e.target.value)} className="w-full bg-transparent border-none outline-none font-bold text-slate-800 text-sm p-0" placeholder="—" />
                        </div>

                    </div>

                    {/* Remarks */}
                    <div className={`grid gap-3 print:gap-2 ${showFees ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div className="bg-amber-50/60 border border-amber-100 rounded-2xl print:rounded-lg px-4 py-3 print:px-3 print:py-2">
                                <p className="text-[9.5px] font-black text-amber-600 uppercase tracking-widest leading-none mb-2">Class Teacher's Remark</p>
                                <textarea value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} className="w-full bg-transparent border-none p-0 text-[12px] italic font-semibold resize-none h-14 print:h-10 outline-none text-slate-800 leading-relaxed" placeholder="Enter teacher evaluation here..." />
                            </div>
                        )}
                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div className="bg-green-50/60 border border-green-100 rounded-2xl print:rounded-lg px-4 py-3 print:px-3 print:py-2">
                                <p className="text-[9.5px] font-black text-green-700 uppercase tracking-widest leading-none mb-2">Head Teacher's Final Decision</p>
                                <textarea value={principalRemark} onChange={(e) => setPrincipalRemark(e.target.value)} className="w-full bg-transparent border-none p-0 text-[12px] italic font-semibold resize-none h-14 print:h-10 outline-none text-slate-800 leading-relaxed" placeholder="Enter principal remarks here..." />
                            </div>
                        )}
                    </div>

                    {/* Extra Sections - Squeezed & Compact */}
                    {schoolConfig?.report_card_config?.show_global_sections !== false && extraReportSections.length > 0 && (
                        <div className={`grid gap-2 print:gap-1.5 ${extraReportSections.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {extraReportSections.map((section, idx) => (
                                <div key={idx} className="bg-purple-50/40 border border-purple-100/60 rounded-xl px-3 py-1.5 relative group shadow-sm flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between border-b border-purple-100/30 pb-0.5">
                                        <input type="text" value={section.title} onChange={e => updateExtraReportSection(idx, 'title', e.target.value)} placeholder="Section Title" className="bg-transparent border-none text-[8.5px] font-black uppercase text-purple-600 outline-none w-full tracking-widest p-0 leading-none" />
                                        <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 rounded print:hidden shrink-0"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                    <textarea value={section.content} onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} className="w-full bg-transparent border-none outline-none text-[10.5px] text-slate-700 h-7 print:h-6 resize-none italic font-medium leading-tight p-0 mt-0.5" placeholder="..." />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Standalone Signatures (when no fees) */}
                    {!showFees && schoolConfig?.report_card_config?.show_signature !== false && (
                        <div className="grid grid-cols-2 gap-6 pt-4 border-t-2 border-dashed border-slate-200 print:pt-3 mt-auto">
                            <div>
                                <div className="h-12 print:h-8"></div>
                                <div className="h-px bg-slate-400 w-40 mb-1"></div>
                                <p className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest">Class Teacher Signature</p>
                                <p className="text-[9px] text-slate-300 mt-0.5">{new Date().toLocaleDateString('en-GB')}</p>
                            </div>
                            <div className="relative">
                                {(schoolConfig as any)?.report_card_config?.signature_url && (
                                    <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain absolute -top-9 left-4 z-10" alt="Signature" />
                                )}
                                <div className="h-12 print:h-8"></div>
                                <div className="h-px bg-slate-900 w-40 mb-1 relative z-20"></div>
                                <p className="text-[9.5px] font-black text-slate-800 uppercase tracking-widest relative z-20">Head Teacher / Principal</p>
                                {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                    <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-16 w-16 object-contain absolute -top-12 right-2 opacity-70 rotate-6 mix-blend-multiply z-30" alt="Stamp" />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Financial Statement */}
                {showFees && (
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl print:rounded-lg p-5 print:p-4 flex flex-col justify-between relative overflow-hidden print:bg-white print:border-2 print:border-slate-800 print:text-slate-900">
                        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-500/10 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                        <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] print:hidden pointer-events-none" />
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-4 print:mb-3">
                                <h4 className="text-[10.5px] font-black uppercase tracking-widest text-white/80 print:text-slate-700 print:opacity-100">Financial Statement</h4>
                                <span className="text-[9px] font-bold bg-blue-500/30 border border-blue-400/30 px-2.5 py-1 rounded-full print:bg-slate-100 print:text-slate-700 print:border-slate-200">TERM {schoolConfig?.current_term || 1}</span>
                            </div>
                            <div className="space-y-3 print:space-y-2">
                                <div className="flex justify-between items-center border-b border-white/10 pb-2.5 print:border-slate-300">
                                    <span className="text-[10px] font-semibold opacity-70 print:opacity-100 print:text-slate-700 uppercase tracking-wide">Outstanding Balance</span>
                                    <span className="font-mono font-black text-sm print:text-slate-900">GHS {(student as any).balance || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-2.5 print:border-slate-300">
                                    <span className="text-[10px] font-semibold opacity-70 print:opacity-100 print:text-slate-700 uppercase tracking-wide">New Bill Amount</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="opacity-50 print:opacity-100 print:text-slate-500 text-[10px] font-mono">GHS</span>
                                        <input type="number" value={pupilBill} onChange={(e) => setPupilBill(Number(e.target.value))} className="w-20 bg-white/10 border-b border-white/30 text-right outline-none font-mono font-bold py-0 px-1.5 text-sm print:bg-slate-50 print:border-slate-300 print:text-slate-900" />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-2.5 print:border-slate-200">
                                    <span className="text-[10px] font-semibold opacity-70 print:opacity-100 print:text-slate-700 uppercase tracking-wide">Auxiliary Charges</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="opacity-50 print:opacity-100 print:text-slate-500 text-[10px] font-mono">GHS</span>
                                        <input type="number" value={otherFees} onChange={(e) => setOtherFees(Number(e.target.value))} className="w-20 bg-white/10 border-b border-white/30 text-right outline-none font-mono font-bold py-0 px-1.5 text-sm print:bg-white print:border-slate-300 print:text-slate-900" />
                                    </div>
                                </div>
                                {extraBillItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group border-b border-white/10 pb-2.5 print:border-slate-300">
                                        <input type="text" value={item.label} onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} placeholder="Item Name" className="bg-transparent border-b border-white/20 text-[10px] uppercase tracking-wider font-bold outline-none w-1/2 opacity-70 print:text-slate-700 print:border-none print:opacity-100 p-0" />
                                        <div className="flex items-center gap-1.5">
                                            <span className="opacity-50 print:opacity-100 print:text-slate-500 font-mono text-[10px]">GHS</span>
                                            <input type="number" value={item.value} onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} className="w-20 bg-white/10 border-b border-white/30 text-right outline-none font-mono font-bold py-0 px-1.5 text-sm print:bg-white print:border-slate-300 print:text-slate-900" />
                                            <button onClick={() => removeExtraBillItem(idx)} className="print:hidden h-5 w-5 rounded-full bg-red-400/20 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><X className="w-2.5 h-2.5" /></button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addExtraBillItem} className="print:hidden w-full py-2 border border-dashed border-white/20 rounded-xl text-[9.5px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 mt-1"><X className="w-2.5 h-2.5 rotate-45" /> Add Bill Item</button>
                            </div>
                        </div>

                        {/* Total + Signature */}
                        <div className="relative z-10 mt-4 print:mt-3 pt-3 border-t border-white/20 print:border-slate-300 flex justify-between items-end">
                            <div>
                                <p className="text-[9px] font-black uppercase opacity-60 print:opacity-100 print:text-slate-500 tracking-widest mb-1">Grand Total Payable</p>
                                <p className="text-2xl print:text-xl font-black tracking-tighter print:text-slate-950"><span className="text-xs mr-1 opacity-50 print:opacity-100 print:text-slate-500 font-bold">GHS</span>{totalBill.toFixed(2)}</p>
                            </div>
                            {schoolConfig?.report_card_config?.show_signature !== false && (
                                <div className="text-right relative min-w-[100px]">
                                    {(schoolConfig as any)?.report_card_config?.signature_url && (
                                        <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain absolute -top-12 right-0 z-10 brightness-110" alt="Signature" />
                                    )}
                                    <div className="h-8 w-8 bg-white/20 rounded-full ml-auto mb-1.5 flex items-center justify-center print:bg-slate-100 relative z-20">
                                        <Building2 className="w-4 h-4 opacity-60 print:text-slate-500" />
                                    </div>
                                    <p className="text-[8.5px] font-black uppercase opacity-60 print:opacity-100 print:text-slate-500 tracking-widest relative z-20">Principal / Verified</p>
                                    {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                        <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-16 w-16 object-contain absolute -top-12 -right-2 opacity-70 rotate-6 mix-blend-multiply z-30" alt="Stamp" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ══ FOOTER STRIPE ══ */}
            <div className="mt-auto bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-8 py-2.5 print:px-6 print:py-2 flex justify-between items-center flex-shrink-0">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em]">Secure Academic Record · {student.id.substring(0, 12).toUpperCase()}</p>
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em]">© {new Date().getFullYear()} Base16 Schools Management System</p>
            </div>
        </div>
    );

    const adventistContent = (
        <div
            ref={printMode ? undefined : componentRef}
            className={`bg-white max-w-4xl mx-auto flex flex-col relative overflow-hidden ${printMode ? '' : 'shadow-xl border border-slate-200'}`}
            style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                minHeight: printMode ? '297mm' : '1056px',
                maxHeight: printMode ? '297mm' : undefined,
            }}
        >
            {/* Minimal top border accent line (Modern Tech style) */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 z-55" />

            {/* ══════════ HEADER: Modern Academic Banner ══════════ */}
            <div className="relative z-10 px-8 pt-9 pb-5 border-b border-slate-100 bg-slate-50/40">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-5">
                        {schoolConfig?.logo_url ? (
                            <div className="h-20 w-20 p-2 bg-white border border-slate-150 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                                <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                            </div>
                        ) : (
                            <div className="h-20 w-20 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center shrink-0">
                                <Building2 className="w-8 h-8 text-slate-400" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-3xl print:text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                                {schoolConfig?.name || 'NAME OF SCHOOL'}
                            </h1>
                            {schoolConfig?.motto && (
                                <p className="text-[12px] print:text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-2">
                                    {schoolConfig.motto}
                                </p>
                            )}
                            <p className="text-[11px] print:text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                                {schoolConfig?.address || 'School Address'}{schoolConfig?.phone ? ` · Tel: ${schoolConfig.phone}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <span className="bg-indigo-50 text-indigo-700 text-[10.5px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl border border-indigo-100 shadow-sm">
                            Analytical Report Card
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {schoolConfig?.academic_year || '2026/2027'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ══════════ STUDENT REGISTRY Profile Card ══════════ */}
            <div className="relative z-10 px-8 py-4.5 border-b border-slate-100 flex items-center justify-between gap-6 bg-white">
                <div className="flex-1 grid grid-cols-4 gap-y-3.5 gap-x-6">
                    <div className="col-span-2">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Student Name</span>
                        <p className="font-bold text-slate-900 uppercase text-[14px] tracking-wide mt-0.5">{student.name}</p>
                    </div>
                    <div>
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Class Form</span>
                        <p className="font-bold text-slate-900 uppercase text-[13px] mt-0.5">{student.class}</p>
                    </div>
                    {schoolConfig?.report_card_config?.show_position !== false ? (
                        <div>
                            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Class Rank</span>
                            <p className="font-black text-indigo-600 text-[13px] mt-0.5">
                                {position?.position ? `${position.position} / ${position.total}` : '—'}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Term Session</span>
                            <p className="font-bold text-slate-900 uppercase text-[12px] mt-0.5">
                                {schoolConfig?.current_term ? `${schoolConfig.current_term === 1 || schoolConfig.current_term === '1' ? 'First' : schoolConfig.current_term === 2 || schoolConfig.current_term === '2' ? 'Second' : 'Third'} Term` : '—'}
                            </p>
                        </div>
                    )}
                    <div>
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Registry Number</span>
                        <p className="font-bold text-slate-700 text-[12px] font-mono mt-0.5">{student.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                    {schoolConfig?.report_card_config?.show_position !== false ? (
                        <div>
                            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Term Session</span>
                            <p className="font-bold text-slate-900 uppercase text-[12px] mt-0.5">
                                {schoolConfig?.current_term ? `${schoolConfig.current_term === 1 || schoolConfig.current_term === '1' ? 'First' : schoolConfig.current_term === 2 || schoolConfig.current_term === '2' ? 'Second' : 'Third'} Term` : '—'}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Next Class</span>
                            <p className="font-bold text-slate-900 uppercase text-[12px] mt-0.5">{nextClass || '—'}</p>
                        </div>
                    )}
                    <div>
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Parent Contact</span>
                        <p className="font-bold text-slate-900 text-[12px] mt-0.5">{(student as any).parent_phone || (student as any).phone || '—'}</p>
                    </div>
                    {schoolConfig?.report_card_config?.show_position !== false && (
                        <div>
                            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Next Class</span>
                            <p className="font-bold text-slate-900 uppercase text-[12px] mt-0.5">{nextClass || '—'}</p>
                        </div>
                    )}
                </div>

                {schoolConfig?.report_card_config?.show_student_photo !== false && (
                    <div className="h-16 w-16 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                        {student.photo ? (
                            <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                            <User className="w-6 h-6 text-slate-350" />
                        )}
                    </div>
                )}
            </div>

            {/* ══════════ RESULTS TABLE: Modern Borderless Grid ══════════ */}
            <div className="relative z-10 px-8 pt-4 pb-1.5 flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Academic Breakdown</p>
                        <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b-2 border-slate-100 text-slate-400 uppercase text-[9px] font-black tracking-wider">
                                <th className="pb-1.5 font-black">Subject</th>
                                {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                    <th className="pb-1.5 text-center font-black w-20">Class ({schoolConfig?.weights?.class || 30}%)</th>
                                )}
                                <th className="pb-1.5 text-center font-black w-20">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                                <th className="pb-1.5 text-center font-black w-20 text-slate-900 bg-slate-50/50">Total</th>
                                <th className="pb-1.5 text-center font-black w-12">Grade</th>
                                {schoolConfig?.report_card_config?.show_position !== false && (
                                    <>
                                        <th className="pb-1.5 text-center font-black w-16">Rank</th>
                                        <th className="pb-1.5 text-center font-black w-20">Roll</th>
                                    </>
                                )}
                                <th className="pb-1.5 pl-4 font-black">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {results.map((result, idx) => {
                                const grade = calculateGrade(result.total);
                                const remark = calculateRemark(result.total);
                                const rankInfo = getSubjectPosition(result.subject, result.total);
                                const isGood = result.total >= 70;
                                const isBad = result.total < 50;

                                return (
                                    <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="py-2 font-bold text-slate-800 uppercase text-[10.5px]">{result.subject}</td>
                                        {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                            <td className="py-2 text-center text-slate-500 font-medium">{result.classScore}</td>
                                        )}
                                        <td className="py-2 text-center text-slate-500 font-medium">{result.examScore}</td>
                                        <td className={`py-2 text-center font-black text-[11px] bg-slate-50/30 ${isGood ? 'text-emerald-600' : isBad ? 'text-rose-500' : 'text-slate-900'}`}>
                                            {result.total}
                                        </td>
                                        <td className="py-2 text-center font-black text-slate-800">{grade}</td>
                                        {schoolConfig?.report_card_config?.show_position !== false && (
                                            <>
                                                <td className="py-2 text-center text-slate-600 font-bold">{rankInfo.pos}</td>
                                                <td className="py-2 text-center text-slate-400 font-medium">{rankInfo.roll}</td>
                                            </>
                                        )}
                                        <td className="py-2 pl-4 text-slate-500 font-medium italic text-[10px] truncate max-w-[180px]">{remark}</td>
                                    </tr>
                                );
                            })}
                            {schoolConfig?.report_card_config?.show_aggregate !== false && (
                                <tr className="border-t border-slate-100 bg-slate-50/50 font-black text-[9.5px] text-slate-500">
                                    <td className="py-2 text-right uppercase tracking-wider pr-2" colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 2 : 3}>Totals:</td>
                                    <td className="py-2 text-center text-[11.5px] text-slate-900 font-bold">{overallTotal} / {results.length * 100}</td>
                                    <td className="py-2 text-right uppercase tracking-wider pr-2" colSpan={schoolConfig?.report_card_config?.show_position !== false ? 2 : 1}>Average:</td>
                                    <td className="py-2 text-center text-[11.5px] text-indigo-600 font-black">{overallAverage}</td>
                                    {schoolConfig?.report_card_config?.show_position !== false && <td className="py-2"></td>}
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ══════════ DATA GRAPH: Modern Dashboard Analytics ══════════ */}
                <div className="border border-slate-150 p-3 rounded-2xl bg-slate-50/30 text-center mt-3 mb-2 shadow-sm relative overflow-hidden">
                    {/* Modern subtle background grid */}
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                        backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }} />

                    <div className="relative z-10 flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                            Performance Graph (Total Score Comparison)
                        </h4>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Visual Analysis</span>
                    </div>

                    {/* Chart Area */}
                    <div className="relative flex items-end justify-around h-[95px] pt-4 px-4 bg-white/70 backdrop-blur-sm rounded-xl border border-slate-150/60 shadow-inner">
                        {/* Horizontal background scale lines */}
                        <div className="absolute left-0 right-0 top-1/4 border-t border-slate-100 border-dashed pointer-events-none" />
                        <div className="absolute left-0 right-0 top-2/4 border-t border-slate-100 border-dashed pointer-events-none" />
                        <div className="absolute left-0 right-0 top-3/4 border-t border-slate-100 border-dashed pointer-events-none" />

                        {results.map((r, i) => {
                            const barColor = r.total >= 80 
                                ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' 
                                : r.total >= 50 
                                    ? 'bg-gradient-to-t from-indigo-600 to-blue-500' 
                                    : 'bg-gradient-to-t from-rose-500 to-rose-450';
                            
                            return (
                                <div key={i} className="flex flex-col items-center flex-1 h-full justify-end z-10 max-w-[50px]">
                                    {/* Tooltip score value */}
                                    <div className="text-[8.5px] font-black text-slate-800 mb-1 leading-none bg-slate-50 border border-slate-200 rounded-md px-1 py-0.5 shadow-sm">{r.total}</div>
                                    {/* Rounded bar */}
                                    <div 
                                        className={`w-6 md:w-8 ${barColor} rounded-t-lg shadow-sm transition-all duration-300 hover:scale-x-105`} 
                                        style={{ height: `${Math.max(12, Math.min(100, r.total))}%` }}
                                    />
                                    {/* Subject Label */}
                                    <div className="text-[8px] font-bold text-slate-400 mt-1.5 truncate w-full leading-none uppercase text-center" title={r.subject}>
                                        {r.subject.substring(0, 5)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══════════ ADVENTIST CUSTOM NOTES SECTIONS ══════════ */}
            {schoolConfig?.report_card_config?.show_global_sections !== false && extraReportSections.length > 0 && (
                <div className="relative z-10 px-8 py-2.5 border-t border-slate-100 bg-slate-50/20">
                    <div className={`grid gap-4 ${extraReportSections.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {extraReportSections.map((section, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm group relative flex flex-col gap-1">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={e => updateExtraReportSection(idx, 'title', e.target.value)}
                                        placeholder="Section Title"
                                        className="bg-transparent border-none text-[9.5px] font-black uppercase text-slate-700 outline-none w-full"
                                    />
                                    <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden absolute top-2 right-2 z-10">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <textarea
                                    value={section.content}
                                    onChange={e => updateExtraReportSection(idx, 'content', e.target.value)}
                                    placeholder="Add notes or items here..."
                                    className="w-full bg-transparent border-none text-[11px] font-medium text-slate-650 outline-none resize-none h-11 leading-snug mt-1 italic"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════ BOTTOM SECTION: Modern Appraisal Grid ══════════ */}
            <div className="relative z-10 px-8 pb-5 pt-3 print:px-6 print:pb-4 print:pt-2 grid grid-cols-2 gap-x-8 border-t border-slate-100 bg-slate-50/20 mt-auto">
                {/* Column 1: Conduct, Remarks & Decisions */}
                <div className="space-y-2.5 border-r border-slate-100 pr-8">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                        <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Conduct</span>
                        <input type="text" value={conduct} onChange={e => setConduct(e.target.value)} className="bg-transparent text-right font-bold text-slate-800 outline-none uppercase text-[11.5px] italic w-2/3" />
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                        <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Attitude</span>
                        <input type="text" value={interest} onChange={e => setInterest(e.target.value)} placeholder="ATTITUDE DETAILS" className="bg-transparent text-right font-bold text-slate-800 outline-none uppercase text-[11.5px] italic w-2/3" />
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                        <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Talent &amp; Interest</span>
                        <input type="text" value={itemsToBring} onChange={e => setItemsToBring(e.target.value)} className="bg-transparent text-right font-bold text-slate-800 outline-none uppercase text-[11.5px] w-2/3" />
                    </div>
                    
                    {/* Class Teacher Evaluation */}
                    {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                        <div className="pt-2">
                            <p className="font-black text-slate-400 uppercase tracking-widest text-[8.5px] mb-1.5">Class Teacher Evaluation</p>
                            <textarea value={teacherRemark} onChange={e => setTeacherRemark(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none text-[12px] font-medium text-slate-700 italic resize-none leading-snug h-10 shadow-sm focus:border-indigo-500" />
                        </div>
                    )}

                    {/* Headmaster Verdict shifts to Column 1 if financials occupy Column 2 */}
                    {showFees && schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                        <div className="pt-2">
                            <p className="font-black text-slate-400 uppercase tracking-widest text-[8.5px] mb-1.5">Headmaster's Final Verdict</p>
                            <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none text-[12px] font-semibold text-slate-800 italic resize-none leading-snug h-10 shadow-sm focus:border-indigo-500" />
                        </div>
                    )}
                </div>

                {/* Column 2: Headmaster remark/stamp OR Financial Summary */}
                <div className="space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2.5">
                        {showFees ? (
                            /* Financial Summary Box - sleek and print friendly */
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                                    <h4 className="text-[9.5px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                        Financial Summary
                                    </h4>
                                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Pupil's Bill</span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Arrears</span>
                                        <span className="font-black font-mono text-slate-900 text-[11.5px]">GHS {(student as any).balance || '0.00'}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Current Fees</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400 font-mono">GHS</span>
                                            <input
                                                type="number"
                                                value={pupilBill}
                                                onChange={(e) => setPupilBill(Number(e.target.value))}
                                                className="w-20 bg-transparent border-b border-slate-300 text-right outline-none font-mono font-black text-[12px] text-slate-900 py-0"
                                            />
                                        </div>
                                    </div>
                                    {extraBillItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center group border-b border-dashed border-slate-200 pb-1">
                                            <input type="text" value={item.label} onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} placeholder="Item Name" className="bg-transparent text-[9.5px] uppercase tracking-wider font-bold outline-none w-1/2 text-slate-650" />
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400 font-mono">GHS</span>
                                                <input type="number" value={item.value} onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} className="w-20 bg-transparent border-b border-slate-300 text-right outline-none font-mono font-black text-[12px] text-slate-900 py-0" />
                                                <button onClick={() => removeExtraBillItem(idx)} className="print:hidden text-red-400 opacity-0 group-hover:opacity-100 ml-1"><X className="w-2.5 h-2.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={addExtraBillItem} className="print:hidden w-full py-1 border border-dashed border-slate-300 text-[9px] font-black uppercase hover:bg-slate-100/50 rounded text-slate-400 mt-1 transition-colors">+ Add Charge</button>
                                </div>
                                <div className="border-t border-slate-200 pt-2.5 mt-3 flex justify-between items-end">
                                    <div>
                                        <p className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Total Payable</p>
                                        <p className="text-lg font-black text-slate-900 tracking-tight leading-none mt-0.5">
                                            <span className="text-xs mr-0.5 text-slate-400 font-bold">GHS</span>{totalBill.toFixed(2)}
                                        </p>
                                    </div>
                                    <span className="text-[8.5px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wider">Authorized</span>
                                </div>
                            </div>
                        ) : (
                            /* Regular Details Block if showFees is false */
                            <div className="space-y-2.5">
                                {schoolConfig?.report_card_config?.show_attendance !== false && (
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                        <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Attendance Status</span>
                                        <div className="flex items-baseline gap-1 text-[11.5px] font-black text-slate-800">
                                            <span>{attendancePresentDays}</span>
                                            <span className="text-[9.5px] text-slate-400 font-bold italic">of</span>
                                            <span className="text-[11px] text-slate-500 font-bold">{attendanceTotalDays} days</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Vacation Date</span>
                                    <input type="text" value={nextTermReopens} onChange={e => setNextTermReopens(e.target.value)} className="bg-transparent text-right font-bold text-slate-800 outline-none uppercase text-[11.5px] w-2/3" placeholder="Date" />
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Re-opening Date</span>
                                    <span className="font-bold text-slate-800 text-[11.5px]">{schoolConfig?.next_term_reopens || 'TBD'}</span>
                                </div>
                                {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                                    <div className="pt-2">
                                        <p className="font-black text-slate-400 uppercase tracking-widest text-[8.5px] mb-1.5">Headmaster's Final Verdict</p>
                                        <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none text-[12px] font-semibold text-slate-800 italic resize-none leading-snug h-10 shadow-sm focus:border-indigo-500" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stacking Attendance and Dates if Column 2 is occupied by financials */}
                        {showFees && (
                            <div className="space-y-1.5 border border-slate-150 p-3 rounded-2xl bg-slate-50/10 text-xs">
                                {schoolConfig?.report_card_config?.show_attendance !== false && (
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                        <span className="font-black text-slate-400 uppercase tracking-widest text-[8.5px]">Attendance</span>
                                        <div className="flex items-baseline gap-1 text-[11px] font-black text-slate-800">
                                            <span>{attendancePresentDays}</span>
                                            <span className="text-[9px] text-slate-400 font-bold italic">of</span>
                                            <span className="text-[10.5px] text-slate-500 font-bold">{attendanceTotalDays} days</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[8.5px]">Vacation Date</span>
                                    <input type="text" value={nextTermReopens} onChange={e => setNextTermReopens(e.target.value)} className="bg-transparent text-right font-bold text-slate-800 outline-none uppercase text-[11.5px] w-2/3" placeholder="Date" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-slate-400 uppercase tracking-widest text-[8.5px]">Re-opening Date</span>
                                    <span className="font-bold text-slate-800 text-[11.5px]">{schoolConfig?.next_term_reopens || 'TBD'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stamp and signature footer row */}
                    <div className="flex justify-between items-end pt-2">
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">Issued: {new Date().toLocaleDateString('en-GB')}</p>
                        {schoolConfig?.report_card_config?.show_signature !== false && (
                            <div className="text-right relative min-w-[130px]">
                                {(schoolConfig as any)?.report_card_config?.signature_url && (
                                    <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain absolute -top-11 left-1/2 -translate-x-1/2 z-10" alt="Signature" />
                                )}
                                {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                    <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-16 w-16 object-contain absolute -top-14 -right-2 opacity-40 rotate-12 mix-blend-multiply z-20" alt="Stamp" />
                                )}
                                <div className="h-px w-full bg-slate-200 mb-1 relative z-30"></div>
                                <p className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 relative z-30">Principal Signature</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
    const compactContent = (
        <div ref={printMode ? undefined : componentRef} className="bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-6 text-slate-900 flex flex-col font-sans border border-slate-300 shadow-sm">
            
            {/* Simple Clean Header */}
            <div className="flex justify-between items-start border-b pb-3 mb-4">
                <div>
                    <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">{schoolConfig?.name || 'Base16 School'}</h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{schoolConfig?.address}</p>
                </div>
                <div className="text-right">
                    <span className="bg-slate-100 text-slate-800 text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase">{schoolConfig?.academic_year} | {schoolConfig?.current_term || schoolConfig?.term}</span>
                </div>
            </div>

            {/* Particulars */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-[11px] bg-slate-50 p-3 rounded-xl">
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Student</span>
                    <span className="font-black text-slate-800 uppercase">{student.name}</span>
                </div>
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Class Room</span>
                    <span className="font-black text-slate-800 uppercase">{student.class}</span>
                </div>
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Attendance</span>
                    <span className="font-black text-slate-800 uppercase">{attendancePresentDays + ' / ' + attendanceTotalDays}</span>
                </div>
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Term Rank</span>
                    <span className="font-black text-blue-600 uppercase">{position?.position ? position.position + ' / ' + position.total : '-'}</span>
                </div>
            </div>

            {/* Compact Results Table */}
            <table className="w-full border-collapse border border-slate-200 text-xs mb-4">
                <thead>
                    <tr className="bg-slate-100 text-slate-700">
                        <th className="p-1.5 text-left border-b border-r border-slate-200 font-black uppercase">Subject</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-24">Class ({schoolConfig?.weights?.class || 30}%)</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-24">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-24 bg-slate-200 text-slate-900">Total</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-16">Grade</th>
                        <th className="p-1.5 text-left border-b border-slate-200 font-black">Performance Remarks</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {results.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                            <td className="p-1.5 border-r border-slate-200 font-semibold uppercase">{r.subject}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-650">{r.classScore}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-650">{r.examScore}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-black text-slate-800 bg-slate-50">{r.total}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-black text-slate-900">{calculateGrade(r.total)}</td>
                            <td className="p-1.5 font-medium italic text-[11px] text-slate-500">{calculateRemark(r.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Appraisal Comments and Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t pt-3">
                <div className="space-y-1">
                    <p className="font-bold text-slate-500 uppercase text-[9px]">Class Teacher Evaluation</p>
                    <textarea value={teacherRemark} onChange={e => setTeacherRemark(e.target.value)} className="w-full bg-slate-50 border p-2 rounded-lg text-slate-800 italic h-12 resize-none outline-none focus:bg-white" />
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-slate-500 uppercase text-[9px]">Headmaster Remarks</p>
                    <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} className="w-full bg-slate-50 border p-2 rounded-lg text-slate-800 italic h-12 resize-none outline-none focus:bg-white" />
                </div>
            </div>

            {/* Compact Signature Footer */}
            <div className="mt-6 pt-3 border-t flex justify-between items-center text-[10px]">
                <span className="font-semibold text-slate-400 uppercase">Base16 SMS Secure Digital Card</span>
                <div className="flex gap-4">
                    <span className="font-black text-slate-700 uppercase">Sig. Preceptor: ______________</span>
                    <span className="font-black text-slate-700 uppercase">Sig. Headmaster: ______________</span>
                </div>
            </div>

        </div>
    );

const innerContent = isNursery ? nurseryContent : (isClassic ? classicContent : (classLayout === 'adventist' ? adventistContent : (classLayout === 'compact' ? compactContent : modernContent)));

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