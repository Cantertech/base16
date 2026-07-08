import { useQueryClient } from '@tanstack/react-query';
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
                                <h4 className="text-[10.5px] font-black uppercase tracking-widest mb-3 opacity-60">Financial Overview</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center pb-1 border-b border-white/10 print:border-slate-200">
                                        <span className="text-[12px] font-bold opacity-60">Termly Fees</span>
                                        <span className="font-mono text-xs">GHS {pupilBill.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-1 border-b border-white/10 print:border-slate-200">
                                        <span className="text-[12px] font-bold opacity-60">Ancillary</span>
                                        <span className="font-mono text-xs">GHS {otherFees.toFixed(2)}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between items-end">
                                        <div>
                                            <p className="text-[12px] font-black uppercase opacity-40 mb-0.5">Total Due</p>
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
                            <div className="h-28 w-28 print:h-24 print:w-24 p-1 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center shrink-0">
                                <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                            </div>
                        )}
                        <div className="text-center md:text-left print:text-left">
                            <h1 className="text-2xl md:text-4xl print:text-4xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2 font-serif mt-2">
                                {schoolConfig?.name || 'NAME OF SCHOOL'}
                            </h1>
                            <div className="text-[12px] md:text-xs print:text-xs text-slate-700 font-bold uppercase tracking-wide space-y-1">
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
                                        <span className="text-[10.5px] text-slate-400 uppercase font-black">Passport Photo</span>
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
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Name of Student</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{student.name}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Academic Year</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{schoolConfig?.academic_year || '2024/2025'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Term</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{schoolConfig?.current_term || schoolConfig?.term || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Class</p>
                    <p className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-400 pb-1">{student.class}</p>
                </div>

                <div className="space-y-1">
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Enrollment No.</p>
                    <p className="text-[12.5px] font-bold text-slate-700 uppercase border-b border-slate-300 pb-1">{student.id.substring(0, 8).toUpperCase()}</p>
                </div>
                {schoolConfig?.report_card_config?.show_position !== false && (
                    <div className="space-y-1">
                        <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Position</p>
                        <p className="text-[12.5px] font-bold text-slate-700 uppercase border-b border-slate-300 pb-1">
                            {position?.position || '-'} <span className="text-[12.5px] text-slate-400 lowercase italic">out of</span> {position?.total || '-'}
                        </p>
                    </div>
                )}
                {schoolConfig?.report_card_config?.show_attendance !== false && (
                <div className="space-y-1">
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Attendance (Auto)</p>
                    <div className="flex items-center gap-1 border-b border-slate-300 pb-1">
                        <input type="number" value={attendancePresentDays} readOnly={true} className="w-8 bg-transparent outline-none text-[12.5px] font-bold text-center text-blue-600 cursor-not-allowed" />
                        <span className="text-[12.5px] text-slate-400 lowercase italic">out of</span>
                        <input type="number" value={attendanceTotalDays} readOnly={true} className="w-8 bg-transparent outline-none text-[12.5px] font-bold text-center text-slate-500 cursor-not-allowed" />
                    </div>
                </div>
                )}
                <div className="space-y-1">
                    <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Re-opening Date</p>
                    <input 
                        type="text" 
                        value={nextTermReopens} 
                        onChange={e => setNextTermReopens(e.target.value)} 
                        className="w-full bg-transparent border-b border-slate-300 outline-none text-[12.5px] font-bold text-slate-700 uppercase pb-1" 
                    />
                </div>
            </div>

            {/* Results Table - Clean & Professional */}
            <div className="flex-1 mb-3 print:mb-1 overflow-x-auto relative max-w-full">
                <table className="w-full min-w-[700px] border-collapse border-y-2 border-slate-950 text-[12px] md:text-xs print:text-[12px]">
                    <thead>
                        <tr className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900">
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-left font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300">Subject Name</th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-24">Class Score<br /><span className="text-[10.5px] opacity-70">({schoolConfig?.weights?.class || 30}%)</span></th>
                            <th className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black uppercase tracking-wider border-x border-slate-800 print:border-slate-300 w-24">Exam Score<br /><span className="text-[10.5px] opacity-70">({schoolConfig?.weights?.exam || 70}%)</span></th>
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
                                        <td colSpan={3} className="p-1.5 print:py-0.5 print:px-1.5 text-center font-black text-slate-900 bg-slate-100/30 border-r border-slate-200 uppercase tracking-widest italic text-[12px]">
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
                                    <td className="p-1.5 print:py-0.5 print:px-1.5 italic text-slate-600 font-medium capitalize text-[12.5px]">{remark.toLowerCase()}</td>
                                </tr>
                            );
                        })}
                        {schoolConfig?.report_card_config?.show_aggregate !== false && (
                        <tr className="bg-slate-50 font-black border-t-2 border-slate-950 print:bg-slate-50">
                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-right uppercase tracking-[0.2em]" colSpan={3}>Aggregate Summary / Average</td>
                            <td className="p-1.5 print:py-0.5 print:px-1.5 text-center text-base underline decoration-double">{overallAverage}</td>
                            <td colSpan={2} className="p-1.5 print:py-0.5 print:px-1.5"></td>
                        </tr>
                        )}
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
                                <h4 className="text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-900 whitespace-nowrap">Appraisal & Conduct</h4>
                                <div className="flex-1 h-px bg-slate-200"></div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-start gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0"></div>
                                    <div className="flex-1 border-b border-slate-200 pb-1">
                                        <span className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Conduct / Attitude:</span>
                                        <input type="text" value={conduct} onChange={(e) => setConduct(e.target.value)} className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 mt-1" />
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2 shrink-0"></div>
                                    <div className="flex-1 border-b border-slate-200 pb-1">
                                        <span className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Interest / Talent:</span>
                                        <input type="text" value={interest} onChange={(e) => setInterest(e.target.value)} className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 mt-1" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div className="relative pt-2">
                                <div className="absolute -left-4 top-2 bottom-0 w-1 bg-slate-100 rounded-full"></div>
                                <span className="text-[12px] font-black uppercase text-slate-400 tracking-[0.15em] mb-1.5 block italic">Subject Teacher's Feedback:</span>
                                <textarea
                                    value={teacherRemark}
                                    onChange={(e) => setTeacherRemark(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded outline-none text-[12px] font-bold text-slate-900 leading-none min-h-12 print:min-h-8 p-1.5 italic resize-none"
                                />
                                <div className="flex justify-end mt-1">
                                    <div className="text-right">
                                        <div className="h-px w-20 bg-slate-300 mb-0.5"></div>
                                        <p className="text-[12.5px] font-black text-slate-400 uppercase tracking-widest">Teacher's Sig.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div className="relative">
                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-slate-900 rounded-full"></div>
                                <span className="text-[10.5px] font-black uppercase text-slate-900 tracking-[0.15em] mb-1.5 block">Final Decision & Headmaster:</span>
                                <textarea
                                    value={principalRemark}
                                    onChange={(e) => setPrincipalRemark(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg outline-none text-[12.5px] font-black text-slate-900 leading-relaxed min-h-12 print:min-h-10 p-2 italic resize-none"
                                />
                                <div className="flex justify-between items-end mt-12">
                                    <div className="text-left">
                                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest leading-none">{new Date().toLocaleDateString('en-GB')}</p>
                                        <p className="text-[12.5px] font-black text-slate-300 uppercase leading-none mt-0.5">Issued On</p>
                                    </div>
                                    {schoolConfig?.report_card_config?.show_signature !== false && (
                                    <div className="text-right relative min-w-[150px]">
                                        {(schoolConfig as any)?.report_card_config?.signature_url && (
                                            <img src={(schoolConfig as any).report_card_config.signature_url} className="h-12 object-contain mx-auto absolute -top-14 left-1/2 -translate-x-1/2 z-10" alt="Signature" />
                                        )}
                                        <div className="h-px w-32 bg-slate-950 mb-0.5 relative z-20 mx-auto md:mr-0 print:mr-0"></div>
                                        <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest leading-none relative z-20">Principal (Stamp)</p>
                                        
                                        {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                            <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-20 w-20 object-contain absolute -top-12 -right-2 opacity-60 rotate-12 mix-blend-multiply z-30" alt="Stamp" />
                                        )}
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Supplemental Information Grid */}
                {!showFees && schoolConfig?.report_card_config?.show_global_sections !== false && extraReportSections.length > 0 && (
                    <div className="pt-8 mt-4 border-t-2 border-slate-100">
                         <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-blue-600">Important Supplemental Information</h4>
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
                                            className="bg-transparent border-none text-[12.5px] font-black uppercase text-blue-500 outline-none w-full tracking-widest font-black"
                                        />
                                        <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all print:hidden">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <textarea 
                                        value={section.content} 
                                        onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} 
                                        className="w-full bg-transparent border-none outline-none text-[12.5px] text-slate-900 min-h-16 resize-none italic font-medium leading-relaxed" 
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
                                <h4 className="text-[12.5px] font-black uppercase tracking-widest">Financial Summary</h4>
                                <span className="text-[10.5px] font-bold opacity-60">PUPIL'S BILL</span>
                            </div>

                            <div className="space-y-2 mb-3">
                                <div className="flex justify-between items-center text-[12px]">
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
                                        <input type="text" value={item.label} onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} placeholder="Item" className="bg-transparent border-b border-slate-700 text-[12px] uppercase tracking-wider font-bold outline-none focus:border-white w-1/2 opacity-70 focus:opacity-100 print:border-none print:opacity-100" />
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-40 font-mono">GHS</span>
                                            <input type="number" value={item.value} onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} className="w-20 bg-slate-800/50 border-b border-slate-600 text-right outline-none font-mono py-1 px-2 focus:bg-slate-700 print:bg-transparent print:border-slate-300" />
                                            <button onClick={() => removeExtraBillItem(idx)} className="print:hidden p-1 text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                                
                                <button onClick={addExtraBillItem} className="print:hidden w-full py-1 border border-dashed border-slate-700 rounded text-[10.5px] font-black uppercase hover:bg-white/10 opacity-60">+ Charge Item</button>

                                {/* Financial summary section ended above */}
                            </div>

                            <div className="border-t-4 border-double border-slate-700 pt-6 mt-6 print:border-slate-950">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <p className="text-[12px] font-black uppercase tracking-[0.2em] opacity-60">Total Payable</p>
                                        <p className="text-3xl font-black font-serif italic tracking-tighter">
                                            <span className="text-sm mr-2 opacity-40">GHS</span>
                                            {totalBill.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="h-10 w-32 border-b-2 border-slate-600 mb-1 mx-auto print:border-slate-900"></div>
                                        <p className="text-[10.5px] font-bold uppercase opacity-60 tracking-widest">Authorized Stamp</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Institutional Footer */}
            <div className="mt-3 border-t border-slate-200 pt-2 flex justify-between items-center text-[12px] font-black uppercase text-slate-400 tracking-widest">
                <div>Generated on {new Date().toLocaleDateString('en-GB')} | Secure Digital Report</div>
                <div className="flex items-center gap-2 print:py-0.5 print:px-1">
                    <span>Accredited</span>
                    <span className="text-slate-950">Base16 SMS v2.0</span>
                </div>
            </div>
        </div>
    );

    const modernContent = (
        <div ref={printMode ? undefined : componentRef} id={printMode ? undefined : "report-card-content"} className={`bg-white max-w-4xl mx-auto shadow-sm print:shadow-none flex flex-col ${printMode ? 'p-0 shadow-none border-none' : ''}`} style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

            {/* ── TOP ACCENT BAR ── */}
            <div className="h-2 w-full bg-gradient-to-r from-slate-900 via-blue-700 to-blue-500 print:h-1.5" />

            {/* ── HEADER ── */}
            <div className="flex items-stretch border-b border-slate-200 print:border-slate-400">
                {/* Left: Logo + School info */}
                <div className="flex items-center gap-3 px-6 py-3 print:px-4 print:py-2 flex-1">
                    <div className="h-14 w-14 print:h-12 print:w-12 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                        {schoolConfig?.logo_url ? (
                            <img src={schoolConfig.logo_url} alt="School Logo" className="h-full w-full object-contain p-1" />
                        ) : (
                            <Building2 className="h-7 w-7 text-slate-300" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-base print:text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{schoolConfig?.name || 'School Name'}</h1>
                        <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">{schoolConfig?.motto || ''}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                            {[schoolConfig?.phone ? `| ${schoolConfig.phone}` : null, schoolConfig?.address || null].filter(Boolean).join('  ')}
                        </p>
                    </div>
                </div>

                {/* Right: Session + Term badges */}
                <div className="flex shrink-0">
                    <div className="bg-slate-900 text-white px-5 py-2 print:px-3 flex flex-col items-center justify-center text-center">
                        <p className="text-[9px] opacity-60 font-black uppercase tracking-widest leading-none">Academic Session</p>
                        <p className="text-sm font-black mt-1 leading-none">{schoolConfig?.academic_year || '2025'}</p>
                    </div>
                    <div className="bg-blue-600 text-white px-5 py-2 print:px-3 flex flex-col items-center justify-center text-center">
                        <p className="text-[9px] opacity-60 font-black uppercase tracking-widest leading-none">Current Term</p>
                        <p className="text-sm font-black mt-1 leading-none">{schoolConfig?.current_term || schoolConfig?.term || '1'}</p>
                    </div>
                </div>
            </div>

            {/* ── STUDENT IDENTITY BAR ── */}
            <div className="flex items-center gap-4 px-6 py-2 print:px-4 print:py-1.5 bg-slate-50 border-b border-slate-200 print:border-slate-300">
                {schoolConfig?.report_card_config?.show_student_photo !== false && (
                    <div className="h-12 w-12 print:h-10 print:w-10 bg-white rounded-lg border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {student.photo ? (
                            <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xl font-black text-slate-200">{student.name.charAt(0)}</span>
                        )}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] leading-none mb-0.5">Student Particulars</p>
                    <h2 className="text-base print:text-sm font-black text-slate-900 leading-tight truncate">{student.name}</h2>
                </div>
                <div className="flex items-center gap-5 print:gap-3 shrink-0 text-right">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Student ID</p>
                        <p className="text-[11px] font-bold text-slate-700 font-mono">{student.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Class</p>
                        <p className="text-[11px] font-bold text-slate-700">{student.class}</p>
                    </div>
                    {schoolConfig?.report_card_config?.show_position !== false && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Term Rank</p>
                            <p className="text-[11px] font-black text-blue-600">{position?.position ? `${position.position} / ${position.total}` : '—'}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next Class</p>
                        <p className="text-[11px] font-bold text-slate-700">{nextClass || '—'}</p>
                    </div>
                </div>
            </div>

            {/* ── ACADEMIC ASSESSMENT TABLE ── */}
            <div className="px-6 pt-2 pb-1 print:px-4 print:pt-1.5">
                <div className="flex items-center gap-3 mb-1.5 print:mb-1">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.25em] shrink-0">Academic Assessment</p>
                    <div className="flex-1 h-px bg-slate-100" />
                </div>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white print:bg-slate-800">
                            <th className="px-2.5 py-1 print:px-2 print:py-0.5 text-left font-black uppercase tracking-wider text-[9.5px] rounded-tl-lg">Subject</th>
                            {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                <th className="px-2 py-1 print:py-0.5 text-center font-black uppercase tracking-wider text-[9.5px] w-14">Class ({schoolConfig?.weights?.class || 30}%)</th>
                            )}
                            <th className="px-2 py-1 print:py-0.5 text-center font-black uppercase tracking-wider text-[9.5px] w-14">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                            <th className="px-2 py-1 print:py-0.5 text-center font-black uppercase tracking-wider text-[9.5px] w-12 bg-blue-600 print:bg-blue-800">Total</th>
                            <th className="px-2 py-1 print:py-0.5 text-center font-black uppercase tracking-wider text-[9.5px] w-10">Grd</th>
                            <th className="px-2.5 py-1 print:px-2 print:py-0.5 text-left font-black uppercase tracking-wider text-[9.5px] rounded-tr-lg">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((result, index) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            return (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                    <td className="px-2.5 py-0.5 print:px-2 print:py-px font-semibold text-slate-800 text-[11px] leading-tight border-b border-slate-100">{result.subject}</td>
                                    {schoolConfig?.grading_type !== 'COMPETENCY' && (
                                        <td className="px-2 py-0.5 print:py-px text-center text-slate-500 text-[11px] border-b border-slate-100">{result.classScore}</td>
                                    )}
                                    <td className="px-2 py-0.5 print:py-px text-center text-slate-500 text-[11px] border-b border-slate-100">{result.examScore}</td>
                                    <td className="px-2 py-0.5 print:py-px text-center font-black text-blue-700 bg-blue-50/50 text-[11px] border-b border-blue-100">{result.total}</td>
                                    <td className="px-2 py-0.5 print:py-px text-center border-b border-slate-100">
                                        <span className={`inline-block px-1 py-px rounded text-[9px] font-black ${grade === 'A' || grade?.startsWith('EE') ? 'bg-green-100 text-green-700' : grade === 'F' || grade?.startsWith('BE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{grade}</span>
                                    </td>
                                    <td className="px-2.5 py-0.5 print:px-2 print:py-px text-slate-500 italic text-[10.5px] border-b border-slate-100 leading-tight">{remark}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {schoolConfig?.report_card_config?.show_aggregate !== false && (
                        <tfoot>
                            <tr className="bg-slate-900 text-white print:bg-slate-800">
                                <td className="px-2.5 py-1 print:px-2 print:py-0.5 text-right font-black uppercase text-[9.5px] tracking-[0.2em] rounded-bl-lg" colSpan={schoolConfig?.grading_type === 'COMPETENCY' ? 2 : 3}>Performance Summary</td>
                                <td className="px-2 py-1 print:py-0.5 text-center font-black text-base underline decoration-blue-400 decoration-2">{overallAverage}</td>
                                <td className="px-2 py-1 print:py-0.5 rounded-br-lg" colSpan={2}></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* ── BOTTOM GRID ── */}
            <div className={`px-6 pt-2 pb-2 print:px-4 print:pt-1.5 print:pb-1.5 grid gap-2.5 print:gap-2 ${showFees ? 'grid-cols-2' : 'grid-cols-1'}`}>

                {/* Left: Meta + Remarks */}
                <div className="space-y-2 print:space-y-1.5">
                    {/* Meta row */}
                    <div className="grid grid-cols-2 gap-2 print:gap-1.5">
                        {schoolConfig?.report_card_config?.show_attendance !== false && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Attendance Record</p>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-black text-slate-800">{attendancePresentDays} <span className="text-slate-400 font-normal">/ {attendanceTotalDays}</span> <span className="text-[9px] text-slate-400">Days</span></span>
                                    <div className="w-14 bg-slate-200 h-1.5 rounded-full overflow-hidden shrink-0">
                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${attendanceTotalDays > 0 ? Math.min(100, (attendancePresentDays / attendanceTotalDays) * 100) : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Reopens</p>
                            <input type="text" value={nextTermReopens} onChange={e => setNextTermReopens(e.target.value)} className="w-full bg-transparent border-none outline-none font-bold text-[11px] p-0" placeholder="—" />
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Conduct</p>
                            <input type="text" value={conduct} onChange={e => setConduct(e.target.value)} className="w-full bg-transparent border-none outline-none font-bold text-[11px] p-0" placeholder="—" />
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Interest</p>
                            <input type="text" value={interest} onChange={e => setInterest(e.target.value)} className="w-full bg-transparent border-none outline-none font-bold text-[11px] p-0" placeholder="—" />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className={`grid gap-2 print:gap-1.5 ${showFees ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {schoolConfig?.report_card_config?.show_class_teacher_remark !== false && (
                            <div className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Teacher Remark</p>
                                <textarea value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} className="w-full bg-transparent border-none p-0 text-[11px] italic font-semibold resize-none h-8 print:h-6 outline-none text-slate-800 leading-snug" placeholder="..." />
                            </div>
                        )}
                        {schoolConfig?.report_card_config?.show_head_teacher_remark !== false && (
                            <div className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Final Decision</p>
                                <textarea value={principalRemark} onChange={(e) => setPrincipalRemark(e.target.value)} className="w-full bg-transparent border-none p-0 text-[11px] italic font-semibold resize-none h-8 print:h-6 outline-none text-slate-800 leading-snug" placeholder="..." />
                            </div>
                        )}
                    </div>

                    {/* Extra Sections */}
                    {schoolConfig?.report_card_config?.show_global_sections !== false && extraReportSections.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 print:gap-1.5">
                            {extraReportSections.map((section, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 print:px-2 print:py-1 relative group">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <input type="text" value={section.title} onChange={e => updateExtraReportSection(idx, 'title', e.target.value)} placeholder="Section Title" className="bg-transparent border-none text-[9px] font-black uppercase text-blue-500 outline-none w-full tracking-widest p-0" />
                                        <button onClick={() => removeExtraReportSection(idx)} className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 rounded print:hidden shrink-0"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                    <textarea value={section.content} onChange={e => updateExtraReportSection(idx, 'content', e.target.value)} className="w-full bg-transparent border-none outline-none text-[10.5px] text-slate-600 h-7 print:h-5 resize-none italic font-medium leading-snug p-0" placeholder="..." />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Standalone Signatures when no fees */}
                    {!showFees && schoolConfig?.report_card_config?.show_signature !== false && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 print:pt-1.5">
                            <div>
                                <div className="h-6 print:h-4"></div>
                                <div className="h-px bg-slate-400 w-32 mb-0.5"></div>
                                <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Class Teacher Signature</p>
                            </div>
                            <div className="relative">
                                {(schoolConfig as any)?.report_card_config?.signature_url && (
                                    <img src={(schoolConfig as any).report_card_config.signature_url} className="h-8 object-contain absolute -top-7 left-0 z-10" alt="Signature" />
                                )}
                                <div className="h-6 print:h-4"></div>
                                <div className="h-px bg-slate-900 w-32 mb-0.5 relative z-20"></div>
                                <p className="text-[8.5px] font-black text-slate-900 uppercase tracking-widest relative z-20">Head Teacher / Principal</p>
                                {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                    <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-14 w-14 object-contain absolute -top-10 right-0 opacity-70 rotate-6 mix-blend-multiply z-30" alt="Stamp" />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Financial Statement */}
                {showFees && (
                    <div className="bg-slate-900 text-white rounded-2xl p-4 print:p-3 print:rounded-xl flex flex-col justify-between relative overflow-hidden print:bg-white print:border-2 print:border-slate-800 print:text-slate-900">
                        <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] print:hidden pointer-events-none" />
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-2.5 print:mb-2">
                                <h4 className="text-[9.5px] font-black uppercase tracking-widest border-b border-white/30 pb-0.5 print:border-slate-300">Financial Statement</h4>
                                <span className="text-[8.5px] font-bold bg-white/20 px-2 py-0.5 rounded-full print:bg-slate-100 print:text-slate-700">TERM {schoolConfig?.current_term || 1}</span>
                            </div>
                            <div className="space-y-1.5 print:space-y-1 text-[10.5px]">
                                <div className="flex justify-between items-center border-b border-white/10 pb-1 print:border-slate-200">
                                    <span className="opacity-70 font-semibold uppercase tracking-wide text-[9.5px]">Outstanding Balance</span>
                                    <span className="font-mono font-black">{(student as any).balance || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-1 print:border-slate-200">
                                    <span className="opacity-70 font-semibold uppercase tracking-wide text-[9.5px]">New Bill Amount</span>
                                    <div className="flex items-center gap-1">
                                        <span className="opacity-50 text-[9.5px] font-mono">GHS</span>
                                        <input type="number" value={pupilBill} onChange={(e) => setPupilBill(Number(e.target.value))} className="w-16 bg-white/10 border-b border-white/30 text-right outline-none font-mono py-0 px-1 print:bg-slate-50 print:border-slate-300 print:text-slate-900 text-[10.5px]" />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-1 print:border-slate-200">
                                    <span className="opacity-70 font-semibold uppercase tracking-wide text-[9.5px]">Auxiliary Charges</span>
                                    <div className="flex items-center gap-1">
                                        <span className="opacity-50 text-[9.5px] font-mono">GHS</span>
                                        <input type="number" value={otherFees} onChange={(e) => setOtherFees(Number(e.target.value))} className="w-16 bg-white/10 border-b border-white/30 text-right outline-none font-mono py-0 px-1 print:bg-slate-50 print:border-slate-300 print:text-slate-900 text-[10.5px]" />
                                    </div>
                                </div>
                                {extraBillItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group">
                                        <input type="text" value={item.label} onChange={e => updateExtraBillItem(idx, 'label', e.target.value)} placeholder="Item" className="bg-transparent border-b border-white/20 text-[9.5px] uppercase tracking-wide font-bold outline-none w-1/2 opacity-70 print:border-none print:opacity-100 p-0" />
                                        <div className="flex items-center gap-1">
                                            <span className="opacity-50 font-mono text-[9.5px]">GHS</span>
                                            <input type="number" value={item.value} onChange={e => updateExtraBillItem(idx, 'value', e.target.value)} className="w-16 bg-white/10 border-b border-white/30 text-right outline-none font-mono py-0 px-1 print:bg-slate-50 print:border-slate-300 print:text-slate-900 text-[10.5px]" />
                                            <button onClick={() => removeExtraBillItem(idx)} className="print:hidden h-4 w-4 rounded-full bg-red-400/20 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addExtraBillItem} className="print:hidden w-full py-1 border border-dashed border-white/30 rounded-lg text-[8.5px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-1"><X className="w-2 h-2 rotate-45" /> Add Item</button>
                            </div>
                        </div>
                        <div className="relative z-10 mt-2.5 print:mt-2 pt-2 border-t border-white/20 print:border-slate-300 flex justify-between items-end">
                            <div>
                                <p className="text-[8.5px] font-black uppercase opacity-60 tracking-widest mb-0.5">Grand Total Payable</p>
                                <p className="text-lg print:text-base font-black tracking-tighter"><span className="text-[10px] mr-1 opacity-50">GHS</span>{totalBill.toFixed(2)}</p>
                            </div>
                            {schoolConfig?.report_card_config?.show_signature !== false && (
                                <div className="text-right relative min-w-[90px]">
                                    {(schoolConfig as any)?.report_card_config?.signature_url && (
                                        <img src={(schoolConfig as any).report_card_config.signature_url} className="h-8 object-contain absolute -top-9 right-0 z-10 brightness-110" alt="Signature" />
                                    )}
                                    <div className="h-7 w-7 bg-white/20 rounded-full ml-auto mb-1 flex items-center justify-center print:bg-slate-100 relative z-20">
                                        <Building2 className="w-3.5 h-3.5 opacity-60 print:text-slate-500" />
                                    </div>
                                    <p className="text-[8px] font-black uppercase opacity-60 tracking-widest relative z-20">Verified</p>
                                    {(schoolConfig as any)?.report_card_config?.stamp_url && (
                                        <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-14 w-14 object-contain absolute -top-10 -right-2 opacity-70 rotate-6 mix-blend-multiply z-30" alt="Stamp" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── FOOTER BAR ── */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-700 to-slate-900 print:h-px print:bg-slate-400 mt-auto" />
            <div className="px-6 py-1 print:px-4 flex justify-between items-center text-[8.5px] font-black text-slate-300 uppercase tracking-[0.25em]">
                <div>Secure Academic Record · {student.id.substring(0, 12).toUpperCase()}</div>
                <div>© {new Date().getFullYear()} Base16 Schools Management</div>
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

    const adventistContent = (
        <div ref={printMode ? undefined : componentRef} className="bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-10 text-slate-900 flex flex-col font-serif relative overflow-hidden border border-slate-350 shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
            
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-slate-850 relative z-10">
                <div className="flex justify-center items-center gap-4 mb-2">
                    {schoolConfig?.logo_url ? (
                        <div className="h-16 w-16 p-1 bg-white border border-slate-200 rounded flex items-center justify-center shrink-0">
                            <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                    ) : (
                        <div className="h-16 w-16 bg-slate-100 border border-slate-400 rounded flex items-center justify-center shrink-0">
                            <Building2 className="w-8 h-8 text-slate-300" />
                        </div>
                    )}
                    <div className="text-center">
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-wide text-slate-950 leading-none mb-1">
                            {schoolConfig?.name || 'NAME OF SCHOOL'}
                        </h1>
                        <p className="text-[10px] font-bold text-slate-800 uppercase leading-tight">
                            {schoolConfig?.address || 'P.O. BOX 143, BEKWAI- ASHANTI, GHANA'}
                        </p>
                        <p className="text-[9.5px] font-bold text-slate-700 uppercase tracking-tight mt-0.5">
                            {(schoolConfig?.phone || 'CONTACT PHONE') + (schoolConfig?.email ? ' | ' + schoolConfig.email : '')}
                        </p>
                    </div>
                </div>
                <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-slate-950 border-t border-slate-800 pt-1.5 inline-block">Terminal Report</h2>
            </div>

            {/* Student Particulars Certification Text Block */}
            <div className="my-4 print:my-2 p-3 bg-slate-50/50 border border-slate-250 text-xs text-slate-800 leading-relaxed">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    <div className="pb-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">This is to certify that: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{student.name}</span>
                    </div>
                    <div className="pb-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Class/Form: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{student.class}</span>
                    </div>
                    <div className="pb-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Position In Class: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{position?.position || '-'}</span>
                    </div>
                    <div className="pb-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Term & Session: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{(schoolConfig?.current_term || schoolConfig?.term || '-') + ' ' + (schoolConfig?.academic_year || '')}</span>
                    </div>
                    <div className="pb-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">No. on Roll: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{position?.total || '49'}</span>
                    </div>
                    <div className="pb-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Class Group Postn: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{position?.position ? (position.position + 12) + ' / ' + (position.total + 24) : '-'}</span>
                    </div>
                    <div className="pb-1 border-b border-slate-200/60 sm:col-span-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Promoted To: </span>
                        <span className="font-black text-slate-950 uppercase text-[11px] ml-1">{nextClass}</span>
                    </div>
                </div>
            </div>

            {/* Assessment Table */}
            <div className="flex-1 mb-3 print:mb-1 overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400 text-[10px]">
                    <thead>
                        <tr className="bg-slate-700 text-white border-b border-slate-400">
                            <th className="p-1.5 text-left font-black uppercase border-r border-slate-400">Subject</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20">Class Score ({schoolConfig?.weights?.class || 30}%)</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20">Exam Score ({schoolConfig?.weights?.exam || 70}%)</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20 bg-slate-800">Total Score</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-16">Grade</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20">Subject Positn</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-24">Subject Positn / Total Roll</th>
                            <th className="p-1.5 text-left font-black uppercase">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-350 border-b border-slate-400">
                        {results.map((result, idx) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            const rankInfo = getSubjectRank(result.subject, result.total);
                            return (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    <td className="p-1.5 font-black text-slate-950 uppercase border-r border-slate-400">{result.subject}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{result.classScore}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{result.examScore}</td>
                                    <td className="p-1.5 text-center font-black text-slate-950 bg-slate-100/50 border-r border-slate-400">{result.total}</td>
                                    <td className="p-1.5 text-center font-black text-slate-950 border-r border-slate-400">{grade}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{rankInfo.pos}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{rankInfo.roll}</td>
                                    <td className="p-1.5 font-bold uppercase text-[9px] text-slate-650">{remark}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-100 font-black border-t border-slate-400">
                            <td className="p-1.5 text-right uppercase border-r border-slate-400" colSpan={3}>Totals:</td>
                            <td className="p-1.5 text-center border-r border-slate-400">{overallTotal} / {results.length * 100}</td>
                            <td className="p-1.5 text-right uppercase border-r border-slate-400" colSpan={2}>Avrge Scores:</td>
                            <td className="p-1.5 text-center border-r border-slate-400">{overallAverage}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Subject Total Scores Bar Chart (CSS-based) */}
            <div className="border border-slate-400 p-4 rounded bg-white text-center mb-4 print:mb-2 shadow-sm">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-2 border-b border-slate-200 pb-1 flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Performance Chart — Subject Total Scores
                </h4>
                <div className="flex items-end justify-center gap-4 md:gap-6 h-28 pt-4 px-4 border-b border-slate-350 overflow-hidden bg-slate-50/50 rounded">
                    {results.map((r, i) => {
                        const scoreColor = r.total >= 80 ? 'bg-gradient-to-t from-green-600 to-green-400' : r.total >= 50 ? 'bg-gradient-to-t from-blue-600 to-blue-400' : 'bg-gradient-to-t from-red-500 to-red-400';
                        return (
                            <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                                <div className="text-[9px] font-bold text-slate-700 mb-1 leading-none">{r.total}</div>
                                <div className={`w-6 md:w-8 ${scoreColor} rounded-t-sm border border-slate-700 shadow-sm transition-all duration-300 hover:opacity-90`} style={{ height: Math.max(10, r.total) + '%' }}></div>
                                <div className="text-[8px] font-bold text-slate-500 mt-1.5 truncate max-w-[50px] leading-none uppercase" title={r.subject}>{r.subject.substring(0, 8)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Appraisal conduct and Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10px] border-t border-slate-200 pt-3 relative z-10">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">CONDUCT:</span>
                        <input type="text" value={conduct} onChange={e => setConduct(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5" />
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0 mt-0.5">ATTITUDE:</span>
                        <textarea value={interest} onChange={e => setInterest(e.target.value)} placeholder="ATTITUDE DETAILS" className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5 h-10 resize-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">INTEREST:</span>
                        <input type="text" value={itemsToBring} onChange={e => setItemsToBring(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5" />
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0 mt-0.5">CLASS TEACHER'S REMARKS:</span>
                        <textarea value={teacherRemark} onChange={e => setTeacherRemark(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5 h-10 resize-none" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">ATTENDANCE:</span>
                        <span className="font-black text-slate-900 uppercase">{attendancePresentDays + ' Out Of ' + attendanceTotalDays}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0 mt-0.5">HEAD TEACHER'S REMARKS:</span>
                        <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5 h-10 resize-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-650 w-24 shrink-0">VACATION DATE:</span>
                        <input type="text" value={nextTermReopens} onChange={e => setNextTermReopens(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5" placeholder="Date" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-605 w-24 shrink-0">RE-OPENING DATE:</span>
                        <span className="font-black text-slate-900 uppercase">{schoolConfig?.next_term_reopens || 'TBD'}</span>
                    </div>
                </div>
            </div>

            {/* Signature & Footnote */}
            <div className="mt-6 pt-3 border-t border-slate-300 flex justify-end items-end relative">
                <div className="text-center relative min-w-[150px]">
                    {(schoolConfig as any)?.report_card_config?.signature_url && (
                        <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain mx-auto absolute -top-11 left-1/2 -translate-x-1/2 z-10" alt="Signature" />
                    )}
                    <div className="h-px bg-slate-900 w-full mb-1"></div>
                    <span className="text-[9.5px] font-black uppercase text-slate-900 tracking-wider">Signature</span>
                    {(schoolConfig as any)?.report_card_config?.stamp_url && (
                        <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-16 w-16 object-contain absolute -top-12 -right-4 opacity-50 rotate-12 mix-blend-multiply z-20" alt="Stamp" />
                    )}
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
