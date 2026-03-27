import React, { useState, useEffect, useRef } from 'react';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings,
    Lock, Unlock, PlayCircle, StopCircle, Eye, Send, Users, X, Loader2,
    MessageSquare, Plus, Check, Calendar, PlusCircle, PenTool
} from 'lucide-react';
import ReportCard from './ReportCard';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';

// --- Types ---
interface Result {
    id: string;
    studentId: string;
    studentName: string;
    class: string;
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
    photo?: string;
    parent_phone?: string;
    parent_name?: string;
    admission_no?: string;
    pin?: string;
    balance?: number;
}

interface ExamsProps {
    currentUser?: {
        id: string;
        school_id: string;
        role: 'admin' | 'teacher';
        name: string;
        assignedClass?: string;
    };
    activeModules?: string[];
}

// --- Fetch Functions ---
const fetchSchoolInfo = async (schoolId: string) => {
    const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).single();
    if (error) throw error;
    return {
        name: data.name,
        logo_url: data.logo_url,
        address: data.address,
        phone: data.phone,
        email: data.email,
        motto: data.motto,
        exam_config: data.exam_config
    };
};

const GRADING_PRESETS = {
    STANDARD: [
        { grade: "A", min: 80, max: 100, remark: "Excellent", points: 4.0 },
        { grade: "B", min: 70, max: 79, remark: "Very Good", points: 3.0 },
        { grade: "C", min: 60, max: 69, remark: "Good", points: 2.0 },
        { grade: "D", min: 50, max: 59, remark: "Credit", points: 1.0 },
        { grade: "E", min: 40, max: 49, remark: "Pass", points: 0.5 },
        { grade: "F", min: 0, max: 39, remark: "Fail", points: 0 }
    ],
    COMPETENCY: [
        { grade: "EE1", min: 90, max: 100, remark: "Exceeding Expectations (High)", points: 4.0 },
        { grade: "EE2", min: 75, max: 89, remark: "Exceeding Expectations (Low)", points: 3.5 },
        { grade: "ME1", min: 58, max: 74, remark: "Meeting Expectations (High)", points: 3.0 },
        { grade: "ME2", min: 41, max: 57, remark: "Meeting Expectations (Low)", points: 2.5 },
        { grade: "AE1", min: 31, max: 40, remark: "Approaching Expectations (High)", points: 2.0 },
        { grade: "AE2", min: 21, max: 30, remark: "Approaching Expectations (Low)", points: 1.5 },
        { grade: "BE1", min: 11, max: 20, remark: "Below Expectations (High)", points: 1.0 },
        { grade: "BE2", min: 0, max: 10, remark: "Below Expectations (Low)", points: 0.5 }
    ]
};

const fetchExamConfig = async (schoolId: string, schoolDataConfig: any) => {
    const { data: configData } = await supabase.from('exam_config').select('*').eq('school_id', schoolId).maybeSingle();

    // Default Config


    let baseConfig = {
        exam_name: "End of Term 1 Exam",
        current_term: "First Term",
        next_term_reopens: "",
        academic_year: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        status: 'SETUP',
        mark_entry_enabled: true,
        target_classes: [] as string[],
        target_subjects: [] as string[],
        weights: { class: 30, exam: 70 },
        grading_type: 'STANDARD',
        grading: GRADING_PRESETS.STANDARD,
        ...schoolDataConfig
    };

    if (configData) {
        // Use spread to get all saved values, then override specific derived ones
        baseConfig = {
            ...baseConfig,
            ...configData
        };
        if (configData.mark_entry_enabled !== undefined) baseConfig.mark_entry_enabled = configData.mark_entry_enabled;
        if (baseConfig.mark_entry_enabled) baseConfig.status = 'OPEN';
        else if (!baseConfig.mark_entry_enabled && baseConfig.status === 'OPEN') baseConfig.status = 'LOCKED';
    }

    return baseConfig;
};

const fetchClasses = async (schoolId: string) => {
    const { data } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
    return data ? data.map(c => c.name) : [];
};

const fetchSubjects = async (schoolId: string) => {
    const { data } = await supabase.from('subjects').select('name').eq('school_id', schoolId).order('name');
    return data ? data.map(s => s.name) : [];
};

const fetchStudents = async (schoolId: string) => {
    const { data } = await supabase.from('students').select('*').eq('school_id', schoolId);
    return data ? data.map((s: any) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        attendance: 100, // Mock
        photo: s.photo_url,
        parent_phone: s.parent_phone,
        parent_name: s.parent_name,
        admission_no: s.admission_no,
        pin: s.pin,
        balance: s.balance
    })) as Student[] : [];
};

const fetchResults = async (schoolId: string, term: string, year: string) => {
    const { data } = await supabase
        .from('exam_results')
        .select('*, students(name)')
        .eq('school_id', schoolId)
        .eq('term', term)
        .eq('academic_year', year);

    return data ? data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.students?.name || 'Unknown',
        class: r.class,
        subject: r.subject,
        classScore: r.class_score,
        examScore: r.exam_score,
        total: r.total
    })) as Result[] : [];
};

const fetchSubmissionOverview = async (schoolId: string, term: string, year: string) => {
    const { data, error } = await supabase.rpc('get_exam_submission_overview_v3', {
        p_school_id: schoolId,
        p_term: term,
        p_year: year
    });
    if (error) throw error;
    return data || [];
};

const fetchReleasedClasses = async (schoolId: string, term: string) => {
    const { data } = await supabase
        .from('exam_report_status')
        .select('class_name')
        .eq('school_id', schoolId)
        .eq('status', 'Released')
        .eq('term', term);
    return data ? data.map(r => r.class_name.trim().toLowerCase()) : [];
};

const fetchTeacherAssignments = async (teacherId: string) => {
    const { data } = await supabase
        .from('teacher_assignments')
        .select('is_class_teacher, classes(name), subjects(name)')
        .eq('teacher_id', teacherId);

    if (!data) return [];
    return data.map((a: any) => ({
        className: a.classes?.name,
        subjectName: a.subjects?.name,
        isClassTeacher: a.is_class_teacher
    }));
};

const fetchStudentRank = async (schoolId: string, studentId: string, term: string, year: string, className: string) => {
    const { data } = await supabase.rpc('get_student_class_rank', {
        p_school_id: schoolId,
        p_class: className,
        p_term: term,
        p_year: year,
        p_student_id: studentId
    });
    return data ? { position: data.position, total: data.total_students } : null;
};


// --- Main Component ---
const Exams: React.FC<ExamsProps> = ({ currentUser, activeModules }) => {
    const queryClient = useQueryClient();

    // Admin Tabs: 'setup', 'monitoring', 'publishing'
    const [activeTab, setActiveTab] = useState<'setup' | 'monitoring' | 'publishing'>('setup');


    // UI/Filter State
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingClassList, setViewingClassList] = useState<string | null>(null);
    const [expandedMonitoringClass, setExpandedMonitoringClass] = useState<string | null>(null);
    const [viewingSubmission, setViewingSubmission] = useState<any>(null);
    const [reportStudent, setReportStudent] = useState<Student | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number }>>({});
    const [teacherTab, setTeacherTab] = useState<'marks' | 'remarks'>('marks');
    const [activeTool, setActiveTool] = useState<'teacher_remark' | 'conduct' | 'interest'>('teacher_remark');
    const [paintBrush, setPaintBrush] = useState<string>('');
    const [userPresets, setUserPresets] = useState<string[]>([]);
    const [conductPresets, setConductPresets] = useState<string[]>(["Excellent", "Very Good", "Satisfactory", "Good", "Fair", "Needs Improvement"]);
    const [interestPresets, setInterestPresets] = useState<string[]>(["Reading / Comm.", "Mathematics", "Science & Tech", "Arts / Creatives", "Sports / Athletics", "Music"]);
    const [newPresetValue, setNewPresetValue] = useState("");
    const [pendingRemarks, setPendingRemarks] = useState<Record<string, Record<string, any>>>({});
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [releaseModalData, setReleaseModalData] = useState<{ className: string, studentCount: number, validPhones: number } | null>(null);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);
    const bulkPrintRef = useRef<HTMLDivElement>(null);



    const schoolId = currentUser?.school_id;

    // --- Queries ---
    const { data: schoolInfo, isLoading: isSchoolInfoLoading } = useQuery({
        queryKey: ['schoolInfo', schoolId],
        queryFn: () => fetchSchoolInfo(schoolId!),
        enabled: !!schoolId
    });

    const { data: subjectAssignments = [] } = useQuery({
        queryKey: ['subjectAssignments', schoolId],
        queryFn: async () => {
            const { data } = await supabase
                .from('subject_assignments')
                .select('class_id, classes(name), subject_id, subjects(name)')
                .eq('school_id', schoolId);
            return data || [];
        },
        enabled: !!schoolId
    });

    const { data: examConfig, isLoading: isConfigLoading } = useQuery({
        queryKey: ['examConfig', schoolId],
        queryFn: () => fetchExamConfig(schoolId!, schoolInfo?.exam_config),
        enabled: !!schoolId && !!schoolInfo
    });

    const { data: availableClasses = [] } = useQuery({
        queryKey: ['classNames', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId
    });

    const { data: allSubjects = [] } = useQuery({
        queryKey: ['subjectNames', schoolId],
        queryFn: () => fetchSubjects(schoolId!),
        enabled: !!schoolId
    });

    const { data: students = [] } = useQuery({
        queryKey: ['students', schoolId],
        queryFn: () => fetchStudents(schoolId!),
        enabled: !!schoolId,
        staleTime: 5 * 60 * 1000
    });

    // Fetches dependent on Config
    const currentTerm = examConfig?.current_term || 'First Term';
    const currentYear = examConfig?.academic_year || new Date().getFullYear().toString();

    const { data: results = [] } = useQuery({
        queryKey: ['examResults', schoolId, currentTerm, currentYear],
        queryFn: () => fetchResults(schoolId!, currentTerm, currentYear),
        enabled: !!schoolId && !!examConfig,
        staleTime: 5 * 60 * 1000
    });

    const { data: submissionOverview = [] } = useQuery({
        queryKey: ['submissionOverview', schoolId, currentTerm, currentYear],
        queryFn: () => fetchSubmissionOverview(schoolId!, currentTerm, currentYear),
        enabled: !!schoolId && !!examConfig && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
    });

    const { data: releasedClasses = [] } = useQuery({
        queryKey: ['releasedClasses', schoolId, currentTerm],
        queryFn: () => fetchReleasedClasses(schoolId!, currentTerm),
        enabled: !!schoolId && !!examConfig && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
    });

    const { data: myAssignments = [] } = useQuery({
        queryKey: ['teacherAssignments', currentUser?.id],
        queryFn: () => fetchTeacherAssignments(currentUser?.id!),
        enabled: !!currentUser?.id && currentUser?.role === 'teacher'
    });

    const { data: studentRank } = useQuery({
        queryKey: ['studentRank', schoolId, reportStudent?.id, currentTerm, currentYear],
        queryFn: () => fetchStudentRank(schoolId!, reportStudent!.id, currentTerm, currentYear, reportStudent!.class),
        enabled: !!schoolId && !!reportStudent && !!examConfig
    });

    // --- Derived State (Teachers) ---
    // Local Config State (Moved here to fix scoping issue)
    const [localConfig, setLocalConfig] = useState<any>(null);
    useEffect(() => {
        if (examConfig) setLocalConfig(examConfig);
    }, [examConfig]);

    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

    useEffect(() => {
        if (currentUser?.role === 'teacher' && myAssignments.length > 0) {
            // Teacher: filter subjects
            if (selectedClass) {
                const classAssignment = myAssignments.filter((a: any) => a.className === selectedClass);
                const isClassTeacher = classAssignment.some((a: any) => a.isClassTeacher);

                if (isClassTeacher) {
                    // Class teacher: see target subjects or all subjects
                    if (examConfig?.target_subjects && examConfig.target_subjects.length > 0) {
                        setAvailableSubjects(examConfig.target_subjects);
                    } else {
                        setAvailableSubjects(allSubjects);
                    }
                } else {
                    setAvailableSubjects(classAssignment.map((a: any) => a.subjectName).filter(Boolean));
                }
            }
        } else if (allSubjects.length > 0) {
            // Admin: Filter by class if selected, otherwise show all subjs in config or school
            if (selectedClass) {
                const classAssigned = subjectAssignments
                    .filter((sa: any) => sa.classes?.name === selectedClass)
                    .map((sa: any) => sa.subjects?.name)
                    .filter(Boolean);
                
                if (classAssigned.length > 0) {
                    setAvailableSubjects(classAssigned);
                } else if (examConfig?.target_subjects && examConfig.target_subjects.length > 0) {
                    setAvailableSubjects(examConfig.target_subjects);
                } else {
                    setAvailableSubjects(allSubjects);
                }
            } else {
                if (examConfig?.target_subjects && examConfig.target_subjects.length > 0) {
                    setAvailableSubjects(examConfig.target_subjects);
                } else {
                    setAvailableSubjects(allSubjects);
                }
            }
        }
    }, [selectedClass, myAssignments, examConfig, allSubjects, currentUser]);

    // Auto-select class for teacher if not set
    useEffect(() => {
        if (currentUser?.role === 'teacher' && myAssignments.length > 0 && !selectedClass) {
            const distinctClasses = [...new Set(myAssignments.map((a: any) => a.className).filter(Boolean))];
            if (distinctClasses.length > 0) setSelectedClass(distinctClasses[0] as string);
        } else if (currentUser?.role !== 'teacher' && availableClasses.length > 0 && !selectedClass) {
            setSelectedClass(availableClasses[0]);
        }
    }, [myAssignments, availableClasses, currentUser, selectedClass]);


    // --- Mutations ---
    const saveConfigMutation = useMutation({
        mutationFn: async (newConfig: any) => {
            const { error } = await supabase.rpc('save_exam_config', {
                p_school_id: schoolId,
                p_config: newConfig
            });
            if (error) throw error;
            return newConfig;
        },
        onSuccess: (newConfig) => {
            queryClient.invalidateQueries({ queryKey: ['examConfig', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['schoolInfo', schoolId] }); // Config is also in school info json
            // Refetch results as term/year might have changed
            queryClient.invalidateQueries({ queryKey: ['examResults', schoolId] });
            alert('Exam configuration saved successfully!');
        },
        onError: (error: any) => {
            alert(`Failed to save configuration: ${error.message}`);
        }
    });

    const toggleMarkEntryMutation = useMutation({
        mutationFn: async (enable: boolean) => {
            const { error } = await supabase.rpc('toggle_mark_entry', { target_school_id: schoolId, enable });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['examConfig', schoolId] });
        },
        onError: (error: any) => {
            alert("Failed to update status");
        }
    });

    const sendResultNotifications = async (className: string) => {
        try {
            const cleanPhone = (p: string) => p?.replace(/\s+/g, '') || '';
            const PORTAL_LINK = 'https://base16.sixzones.com/login';

            // 1. Get recipients
            const targetStudents = students.filter(s => s.class === className && s.parent_phone);

            if (targetStudents.length === 0) return; // No parents to notify

            // 2. Prepare Data
            const recipientsData = targetStudents.map(s => ({
                phone: cleanPhone(s.parent_phone!),
                vars: {
                    '{Parent Name}': s.parent_name || 'Parent',
                    '{Student Name}': s.name,
                    '{Student ID}': s.admission_no || s.id.substring(0, 8).toUpperCase(),
                    '{PIN}': s.pin || 'N/A',
                    '{Total Score}': 'CHECK PORTAL',
                    '{Link}': PORTAL_LINK
                }
            })).filter(r => r.phone.length >= 9);

            if (recipientsData.length === 0) return;

            const message = "Good news {Parent Name}! {Student Name}'s results are out. Total Score: {Total Score}. View details here: {Link}";
            const finalMessage = schoolInfo?.name ? `${schoolInfo.name}\n${message}` : message;

            // 3. Send SMS
            const { error } = await supabase.functions.invoke('send-sms', {
                body: {
                    recipients: recipientsData,
                    message: finalMessage,
                    hubtelKeys: {
                        clientId: import.meta.env.VITE_HUBTEL_CLIENT_ID,
                        clientSecret: import.meta.env.VITE_HUBTEL_CLIENT_SECRET,
                        senderId: import.meta.env.VITE_HUBTEL_SENDER_ID
                    }
                }
            });

            if (error) throw error;

            // 4. Billing & Logging
            await supabase.rpc('deduct_sms_credits', { p_school_id: schoolId, p_count: recipientsData.length });

            await supabase.from('message_logs').insert({
                school_id: schoolId,
                date: new Date().toISOString().split('T')[0],
                type: 'Result Notification',
                recipient: `Parents of ${className}`,
                content: message,
                status: 'Delivered'
            });

            // success (silent)
        } catch (err) {
            console.error("Failed to send result notifications:", err);
            alert("Results released, but failed to send SMS notifications. Please check your SMS balance.");
        }
    };

    const publishResultsMutation = useMutation({
        mutationFn: async (className: string) => {
            const { error } = await supabase.rpc('publish_class_results', {
                target_school_id: schoolId,
                target_class: className,
                p_term: currentTerm
            });
            if (error) throw error;
            return className;
        },
        // We'll manually update releasedClasses via cache invalidation or update
        onSuccess: (className) => {
            queryClient.invalidateQueries({ queryKey: ['releasedClasses', schoolId] });
            // Notification is now handled by the UI handler manually if selected
        },
        onError: (error: any) => {
            alert(`Failed to publish results: ${error.message}`);
        }
    });

    const saveMarksMutation = useMutation({
        mutationFn: async (updates: any[]) => {
            const { error: resultError } = await supabase
                .from('exam_results')
                .upsert(updates, { onConflict: 'student_id,class,subject,term,academic_year' });
            if (resultError) throw resultError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['examResults', schoolId] });
            setPendingChanges({});
        },
        onError: (error: any) => {
            alert(`Failed to save marks: ${error.message}`);
        }
    });

    const { data: allReportCards = [] } = useQuery({
        queryKey: ['reportCards', schoolId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('student_report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('term', currentTerm)
                .eq('academic_year', currentYear);

            if (error) {
                console.error("Supabase Fetch Error:", error);
                alert("Database Read Error: " + error.message);
            }
            return data || [];
        },
        enabled: !!schoolId,
        staleTime: 5 * 60 * 1000
    });

    const saveBulkRemarksMutation = useMutation({
        mutationFn: async (updates: any[]) => {
            const { error } = await supabase.rpc('save_student_reports_bulk', {
                p_reports: updates
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reportCards', schoolId] });
            setPendingRemarks({});
            alert("Remarks saved successfully!");
        },
        onError: (e: any) => {
            alert("Failed to save remarks: " + e.message);
        }
    });

    const handleRemarkChange = (studentId: string, field: string, value: any) => {
        setPendingRemarks(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [field]: value
            }
        }));
    };

    const saveBulkRemarks = () => {
        if (!selectedClass) return alert("Select Class");
        const updates = Object.entries(pendingRemarks).map(([studentId, val]: [string, any]) => {
            const sr = allReportCards.find((r: any) => r.student_id === studentId);
            return {
                school_id: schoolId,
                student_id: studentId,
                class: selectedClass,
                term: currentTerm,
                academic_year: currentYear,
                teacher_remark: val.teacher_remark ?? sr?.teacher_remark,
                principal_remark: sr?.principal_remark,
                conduct: val.conduct ?? sr?.conduct,
                interest: val.interest ?? sr?.interest,
                attendance_present: sr?.attendance_present ?? 0,
                attendance_total: sr?.attendance_total ?? (localConfig?.term_total_days || 0)
            };
        });
        if (updates.length > 0) {
            saveBulkRemarksMutation.mutate(updates);
        }
    };

    const remarkPresets = localConfig?.remark_presets || [
        "Excellent performance, keep it up.",
        "Very Good performance.",
        "Good performance.",
        "Can do better with more focus.",
        "Consistent and hardworking.",
        "Needs to participate more in class.",
        "Satisfactory progress."
    ];
    const allPresets = [...remarkPresets, ...userPresets];

    const submitMarksMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('submit_exam_marks_v3', {
                p_school_id: schoolId,
                p_class: selectedClass,
                p_subject: selectedSubject,
                p_term: currentTerm,
                p_year: currentYear
            });
            if (error) throw error;
        },
        onSuccess: () => {
            alert("Marks submitted successfully to Admin.");
            queryClient.invalidateQueries({ queryKey: ['submissionOverview', schoolId] });
        },
        onError: (e: any) => {
            alert("Submission failed: " + e.message);
        }
    });


    // --- Handlers ---
    const handleSaveConfig = (newConfig?: any) => {
        const configToSave = newConfig || examConfig;

        // Validation: Ensure grading ranges do not overlap
        if (configToSave.grading && Array.isArray(configToSave.grading)) {
            const sorted = [...configToSave.grading].sort((a, b) => a.min - b.min);
            for (let i = 0; i < sorted.length; i++) {
                const current = sorted[i];

                // 1. Min should be <= Max
                if (current.min > current.max) {
                    alert(`Invalid range for grade ${current.grade}: Min score (${current.min}) cannot be greater than Max score (${current.max}).`);
                    return;
                }

                // 2. Check overlap with next
                if (i < sorted.length - 1) {
                    const next = sorted[i + 1];
                    if (current.max >= next.min) {
                        alert(`Overlapping grading ranges detected! Grade ${current.grade} (up to ${current.max}) overlaps with Grade ${next.grade} (from ${next.min}). Please fix the score ranges.`);
                        return;
                    }
                }
            }
        }

        // Validation: Weights must add to exactly 100
        const totalWeight = (configToSave.weights?.class || 0) + (configToSave.weights?.exam || 0);
        if (totalWeight !== 100) {
            alert(`Class and Exam scores must add up to exactly 100%! Current total: ${totalWeight}%`);
            return;
        }

        // Auto-select ALL classes and subjects
        const finalConfig = {
            ...configToSave,
            target_classes: availableClasses,
            target_subjects: allSubjects
        };
        saveConfigMutation.mutate(finalConfig);
    };
    const toggleMarkEntry = (enable: boolean) => toggleMarkEntryMutation.mutate(enable);

    const handleConfirmRelease = async (className: string, sendSms: boolean) => {
        try {
            await publishResultsMutation.mutateAsync(className);
            if (sendSms) {
                await sendResultNotifications(className);
                alert(`Results released & notifications sent to parents!`);
            } else {
                alert(`Results released successfully!`);
            }
            setReleaseModalData(null);
        } catch (e) {
            // Error alert handled by mutation onError or sendResultNotifications catch
        }
    };

    // Deprecated but keeping for reference if needed, functionality moved to handleConfirmRelease
    const publishResults = (className: string) => { };

    const handleScoreChange = (studentId: string, field: 'classScore' | 'examScore', value: string) => {
        let numValue = Number(value);
        const maxClass = examConfig?.weights?.class || 30;
        const maxExam = examConfig?.weights?.exam || 70;

        if (field === 'classScore' && numValue > maxClass) numValue = maxClass;
        if (field === 'examScore' && numValue > maxExam) numValue = maxExam;
        if (numValue < 0) numValue = 0;

        setPendingChanges(prev => {
            const current = prev[studentId] || {
                classScore: getExistingScore(studentId, 'classScore'),
                examScore: getExistingScore(studentId, 'examScore')
            };
            return {
                ...prev,
                [studentId]: { ...current, [field]: numValue }
            };
        });
    };

    const getExistingScore = (studentId: string, field: 'classScore' | 'examScore') => {
        const res = results.find((r: Result) =>
            r.studentId === studentId &&
            r.class === selectedClass &&
            r.subject === selectedSubject
        );
        return res ? res[field] : 0;
    };

    const saveMarks = async () => {
        const updates = Object.entries(pendingChanges).map(([studentId, val]: [string, { classScore: number; examScore: number }]) => {
            return {
                school_id: schoolId,
                student_id: studentId,
                class: selectedClass,
                subject: selectedSubject,
                term: currentTerm,
                academic_year: currentYear,
                class_score: val.classScore,
                exam_score: val.examScore
            };
        });
        if (updates.length > 0) {
            saveMarksMutation.mutate(updates);
        } else {
            // Just refresh if no changes
            queryClient.invalidateQueries({ queryKey: ['examResults', schoolId] });
        }
    };

    const handleSubmitMarks = async () => {
        if (!selectedClass || !selectedSubject) return alert("Select Class and Subject");

        if (Object.keys(pendingChanges).length > 0) {
            await saveMarksMutation.mutateAsync(
                Object.entries(pendingChanges).map(([studentId, val]: [string, { classScore: number; examScore: number }]) => ({
                    school_id: schoolId,
                    student_id: studentId,
                    class: selectedClass,
                    subject: selectedSubject,
                    term: currentTerm,
                    academic_year: currentYear,
                    class_score: val.classScore,
                    exam_score: val.examScore
                }))
            );
        }

        if (!confirm(`Submit marks for ${selectedSubject} (${selectedClass})? This signals you are done.`)) return;
        submitMarksMutation.mutate();
    };

    const getGrade = (total: number) => {
        if (examConfig?.grading) {
            const grade = examConfig.grading.find((g: any) => total >= g.min && total <= g.max);
            return grade ? grade.grade : 'F';
        }
        return 'F';
    };

    const handleBulkPrintTrigger = useReactToPrint({
        contentRef: bulkPrintRef,
        documentTitle: `Bulk_Reports_${viewingClassList}`,
        onBeforeGetContent: () => {
            // Delay to allow async attendance / report states to load
            setIsBulkPrinting(true);
            return new Promise<void>(resolve => setTimeout(resolve, 2000));
        },
        onAfterPrint: () => {
            setIsBulkPrinting(false);
        }
    } as any);

    const triggerBulkPrint = () => {
        setIsBulkPrinting(true);
        // slight UI delay to render the hidden elements before react-to-print grabs it
        setTimeout(handleBulkPrintTrigger, 300);
    };

    // --- Loading State ---
    if (isSchoolInfoLoading || isConfigLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Loading exam environment...</p>
            </div>
        );
    }

    // --- Render Filtered Lists ---
    const classStudents = students.filter(s => s.class === selectedClass);

    // --- TEACHER VIEW ---
    if (currentUser?.role === 'teacher') {
        const isClassTeacher = myAssignments.some((a: any) => a.isClassTeacher && a.className === selectedClass);
        return (
            <div className="p-4 md:p-8 space-y-4 md:space-y-6 h-full pb-20 md:pb-0 overflow-y-auto bg-slate-50/30">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Academic Hub</h1>
                        <p className="text-slate-500 text-sm flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> {examConfig?.exam_name} • {currentTerm}
                        </p>
                    </div>

                    {isClassTeacher && !!selectedClass && (
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
                            <button
                                onClick={() => setTeacherTab('marks')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${teacherTab === 'marks' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <PlusCircle className="w-4 h-4" /> Mark Entry
                            </button>
                            <button
                                onClick={() => setTeacherTab('remarks')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${teacherTab === 'remarks' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <MessageSquare className="w-4 h-4" /> Remarks & Conduct
                            </button>
                            <button
                                onClick={() => setTeacherTab('reports')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${teacherTab === 'reports' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <FileText className="w-4 h-4" /> Class Reports
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                    {/* Toolbar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center bg-slate-50">
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                                <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); }} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-32 cursor-pointer font-bold">
                                    <option value="">-- Class --</option>
                                    {myAssignments.map((a: any, i: number) => <option key={i} value={a.className}>{a.className}</option>)}
                                </select>
                            </div>
                            {teacherTab === 'marks' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!selectedClass} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-48 cursor-pointer disabled:opacity-50">
                                        <option value="">Select Subject</option>
                                        {availableSubjects.map((s: any) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {teacherTab === 'remarks' && (
                                <button
                                    onClick={saveBulkRemarks}
                                    disabled={Object.keys(pendingRemarks).length === 0 || saveBulkRemarksMutation.isPending}
                                    className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {saveBulkRemarksMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Remarks
                                </button>
                            )}
                            {teacherTab === 'marks' && (
                                <>
                                    <button
                                        onClick={saveMarks}
                                        disabled={Object.keys(pendingChanges).length === 0 || saveMarksMutation.isPending || submitMarksMutation.isPending}
                                        className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        {saveMarksMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
                                    </button>
                                    <button
                                        onClick={handleSubmitMarks}
                                        disabled={saveMarksMutation.isPending || submitMarksMutation.isPending}
                                        className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        Submit Marks
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {teacherTab === 'remarks' ? (
                        <div className="flex-1 flex flex-col min-h-[600px] bg-slate-50 relative pb-28">
                            {/* Top Bar: Target Field */}
                            <div className="bg-white border-b border-slate-200 p-3 md:p-4 sticky top-0 z-20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-black text-slate-800 tracking-tight mb-2 uppercase text-[10px] hidden md:block">1. Select Target Field</h4>
                                    <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1 max-w-md">
                                        {[
                                            { id: 'teacher_remark', label: 'Remarks' },
                                            { id: 'conduct', label: 'Conduct' },
                                            { id: 'interest', label: 'Interest' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => { setActiveTool(t.id as any); setPaintBrush(''); }}
                                                className={`flex-1 text-[10px] whitespace-nowrap font-bold py-1.5 px-3 rounded uppercase tracking-wider transition-all ${activeTool === t.id ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="hidden md:flex flex-col items-end">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Brush</p>
                                    <p className="font-bold text-primary-600 truncate max-w-[250px]">{paintBrush || 'None'}</p>
                                </div>
                            </div>

                            {/* Main Content: Student Grid */}
                            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                                <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div>
                                        <h4 className="font-black text-slate-800 tracking-tight uppercase text-[10px] mb-1">2. Tap a Student to Assign</h4>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                                            Current Brush: <span className="text-primary-600 border border-primary-100 bg-primary-50 px-2 py-1 rounded max-w-[200px] truncate block">{paintBrush || 'None'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!paintBrush) return;
                                            classStudents.forEach(s => handleRemarkChange(s.id, activeTool, paintBrush));
                                        }}
                                        disabled={!paintBrush || classStudents.length === 0}
                                        className="text-[10px] font-black uppercase bg-slate-800 text-white px-4 py-2.5 rounded shadow-sm hover:bg-slate-900 transition-colors disabled:opacity-50"
                                    >
                                        Assign to All Students
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {classStudents.map(student => {
                                        const saved = allReportCards.find((r: any) => r.student_id === student.id);
                                        const pending = pendingRemarks[student.id] || {};

                                        const currentVal = pending[activeTool] ?? saved?.[activeTool] ?? '';

                                        return (
                                            <button
                                                key={student.id}
                                                onClick={() => {
                                                    if (paintBrush) handleRemarkChange(student.id, activeTool, paintBrush);
                                                }}
                                                className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between group ${paintBrush && currentVal !== paintBrush ? 'hover:border-primary-400 hover:shadow-md cursor-pointer' : ''} ${currentVal ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-sm">{student.name}</h5>
                                                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block">{student.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-50 p-2 rounded-lg border border-slate-100 min-h-[44px] flex items-center justify-between group-hover:bg-primary-50/30 transition-colors mt-2">
                                                    <span className={`text-xs font-bold leading-tight ${currentVal ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                                                        {currentVal || `No ${activeTool.replace('_', ' ')}`}
                                                    </span>
                                                    {paintBrush && currentVal !== paintBrush && (
                                                        <div className="w-6 h-6 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                            <Check className="w-3 h-3 text-primary-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {classStudents.length === 0 && <div className="col-span-full p-8 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-xl">No students found.</div>}
                                </div>
                            </div>

                            {/* Floating Action Button */}
                            <button
                                onClick={() => setIsPresetModalOpen(true)}
                                className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-primary-600 text-white p-4 rounded-full shadow-2xl shadow-primary-500/50 hover:bg-primary-700 hover:scale-105 transition-all z-40 flex items-center justify-center group animate-bounce-slow border-2 border-white/20"
                            >
                                <PenTool className="w-7 h-7" />
                                <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
                                    Open Brush Palette
                                </span>
                            </button>

                            {/* Preset Modal */}
                            {isPresetModalOpen && (
                                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-end md:items-center justify-center p-4 backdrop-blur-sm transition-opacity" onClick={(e) => { if (e.target === e.currentTarget) setIsPresetModalOpen(false); }}>
                                    <div className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh] mb-4 md:mb-0">
                                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                            <div>
                                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">Brush Palette</h3>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">Select a value for {activeTool.replace('_', ' ')}</p>
                                            </div>
                                            <button onClick={() => setIsPresetModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                                        </div>

                                        <div className="p-5 flex-1 overflow-y-auto">
                                            <div className="flex gap-2 shrink-0 mb-6">
                                                <input
                                                    type="text"
                                                    value={newPresetValue}
                                                    onChange={e => setNewPresetValue(e.target.value)}
                                                    placeholder="Type custom here..."
                                                    className="flex-1 text-xs border border-slate-200 rounded-xl p-3 outline-none focus:border-primary-400 font-bold bg-slate-50"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && newPresetValue) {
                                                            if (activeTool === 'teacher_remark') setUserPresets(p => [...p, newPresetValue]);
                                                            if (activeTool === 'conduct') setConductPresets(p => [...p, newPresetValue]);
                                                            if (activeTool === 'interest') setInterestPresets(p => [...p, newPresetValue]);
                                                            setPaintBrush(newPresetValue);
                                                            setNewPresetValue('');
                                                            setIsPresetModalOpen(false);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (newPresetValue) {
                                                            if (activeTool === 'teacher_remark') setUserPresets(p => [...p, newPresetValue]);
                                                            if (activeTool === 'conduct') setConductPresets(p => [...p, newPresetValue]);
                                                            if (activeTool === 'interest') setInterestPresets(p => [...p, newPresetValue]);
                                                            setPaintBrush(newPresetValue);
                                                            setNewPresetValue('');
                                                            setIsPresetModalOpen(false);
                                                        }
                                                    }}
                                                    className="bg-slate-800 text-white px-4 rounded-xl shrink-0 hover:bg-slate-900 transition-colors"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="space-y-3 pb-4">
                                                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest pl-1 mb-3">Available Presets</h4>
                                                {(activeTool === 'teacher_remark' ? allPresets : activeTool === 'conduct' ? conductPresets : interestPresets).map((preset, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            setPaintBrush(preset);
                                                            setIsPresetModalOpen(false);
                                                        }}
                                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all group hover:-translate-y-0.5 ${paintBrush === preset ? 'border-primary-500 bg-primary-50 shadow-sm relative' : 'border-slate-100 hover:border-primary-300 hover:shadow-md bg-white'}`}
                                                    >
                                                        <span className={`text-sm font-bold leading-tight block pr-8 ${paintBrush === preset ? 'text-primary-800' : 'text-slate-600 group-hover:text-slate-900'}`}>{preset}</span>
                                                        {paintBrush === preset && <CheckCircle className="w-5 h-5 text-primary-500 absolute right-4 top-1/2 -translate-y-1/2" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : teacherTab === 'reports' ? (
                        (!selectedClass) ? (
                            <div className="p-12 text-center text-slate-500 bg-white border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                                <BookOpen className="w-12 h-12 text-slate-300" />
                                <p className="text-lg font-medium">Please select a Class to view reports.</p>
                            </div>
                        ) : (
                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {classStudents.map(student => (
                                        <div key={student.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {student.photo ? <img src={student.photo} className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-slate-400" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 line-clamp-1">{student.name}</h4>
                                                    <span className="text-xs font-bold text-slate-400">ID: {student.id.substring(0, 8)}...</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setReportStudent(student)}
                                                className="w-full py-2.5 flex items-center justify-center gap-2 bg-primary-50 text-primary-600 font-bold text-sm rounded-lg border border-primary-100 hover:bg-primary-600 hover:text-white transition-colors cursor-pointer"
                                            >
                                                <FileText className="w-4 h-4" /> View Report
                                            </button>
                                        </div>
                                    ))}
                                    {classStudents.length === 0 && <div className="col-span-full p-8 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-xl">No students found.</div>}
                                </div>
                            </div>
                        )
                    ) : (
                        (!selectedClass || !selectedSubject) ? (
                            <div className="p-12 text-center text-slate-500 bg-white border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                                <BookOpen className="w-12 h-12 text-slate-300" />
                                <p className="text-lg font-medium">Please select a Class and Subject to start entering marks.</p>
                            </div>
                        ) : (
                            <>
                                {/* Teacher Grid (Desktop) */}
                                <div className="hidden md:block overflow-x-auto bg-white border border-slate-200 border-t-0 rounded-b-xl shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-white border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase w-1/3">Student Name</th>
                                                {examConfig.grading_type !== 'COMPETENCY' && (
                                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Class ({examConfig.weights?.class || 30})</th>
                                                )}
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Exam ({examConfig.weights?.exam || 70})</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Total</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-24">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {classStudents.map(student => {
                                                const savedClass = getExistingScore(student.id, 'classScore');
                                                const savedExam = getExistingScore(student.id, 'examScore');
                                                const pending = pendingChanges[student.id];
                                                const dispClass = pending?.classScore ?? savedClass;
                                                const dispExam = pending?.examScore ?? savedExam;
                                                const total = dispClass + dispExam;
                                                const grade = getGrade(total);
                                                return (
                                                    <tr key={student.id} className="hover:bg-slate-50">
                                                        <td className="px-6 py-3 font-medium text-slate-900">{student.name}</td>
                                                        {examConfig.grading_type !== 'COMPETENCY' && (
                                                            <td className="px-6 py-3 text-center">
                                                                <input
                                                                    type="number"
                                                                    value={dispClass || ''}
                                                                    onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                                                                    className="w-20 p-2 text-center border rounded-md disabled:bg-slate-100 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                value={dispExam || ''}
                                                                onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                                className="w-20 p-2 text-center border rounded-md disabled:bg-slate-100 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3 text-center font-bold">{total}</td>
                                                        <td className="px-6 py-3 text-center"><span className="font-bold text-slate-600">{grade}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {classStudents.length === 0 && <div className="p-12 text-center text-slate-400 italic">No students found in {selectedClass}.</div>}
                                </div>
                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-4 p-4 bg-slate-50 border-t border-slate-200">
                                    {classStudents.map(student => {
                                        const savedClass = getExistingScore(student.id, 'classScore');
                                        const savedExam = getExistingScore(student.id, 'examScore');
                                        const pending = pendingChanges[student.id];
                                        const dispClass = pending?.classScore ?? savedClass;
                                        const dispExam = pending?.examScore ?? savedExam;
                                        const total = dispClass + dispExam;
                                        const grade = getGrade(total);

                                        return (
                                            <div key={student.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{student.name}</h4>
                                                        <span className="text-xs text-slate-500">ID: {student.id.substring(0, 8)}...</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-2xl font-black text-slate-800">{total}</span>
                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600`}>Grade {grade}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {examConfig.grading_type !== 'COMPETENCY' && (
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Class ({examConfig.weights?.class || 30})</label>
                                                            <input
                                                                type="number"
                                                                value={dispClass || ''}
                                                                onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                                                                className="w-full p-2.5 text-center font-bold text-lg border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className={examConfig.grading_type === 'COMPETENCY' ? 'col-span-2' : ''}>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Exam ({examConfig.weights?.exam || 70})</label>
                                                        <input
                                                            type="number"
                                                            value={dispExam || ''}
                                                            onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                            className="w-full p-2.5 text-center font-bold text-lg border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {classStudents.length === 0 && <div className="text-center text-slate-400 py-8 italic">No students found.</div>}
                                </div>
                            </>
                        )
                    )}
                </div>

                {reportStudent && (
                    <ReportCard
                        student={students.find(s => s.id === reportStudent.id)!}
                        results={results.filter((r: Result) => r.studentId === reportStudent.id)}
                        schoolConfig={{
                            ...schoolInfo,
                            ...examConfig,
                        }}
                        onClose={() => setReportStudent(null)}
                        position={studentRank}
                        schoolId={schoolId}
                        activeModules={activeModules}
                        printMode={false}
                        savedReportData={allReportCards.find((r: any) => r.student_id === reportStudent.id)}
                    />
                )}
            </div>
        );
    }

    // --- ADMIN VIEW ---
    // Mock update for setExamConfig for UI forms
    const setUiExamConfig = (newConf: any) => {
        // This is a bit tricky with React Query since examConfig is immutable from query
        // We'll update the cache optimistically or use a local state buffer if we wanted full form editing
        // simpler is to just call mutation on save, but for inputs we need local state.
        // Effectively `examConfig` from useQuery is read-only.
        // We should copy it to a local state on load?
        // Yes, let's do that.
    };

    // We need local state for the configuration form to be editable before saving


    if (!localConfig && (activeTab === 'setup')) return <Loader2 className="animate-spin" />;

    return (
        <div className="p-4 md:p-8 space-y-4 md:space-y-8 relative h-full pb-20 md:pb-0 overflow-y-auto">
            {/* Admin Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Exam Centre</h1>
                    <p className="text-slate-500 text-sm">Manage assessments, monitor entry, and publish results.</p>
                </div>

                {/* Flow Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-lg w-full md:w-auto overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('setup')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'setup' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Settings className="w-4 h-4" /> <span className="hidden sm:inline">1. Configuration</span><span className="sm:hidden">Setup</span>
                    </button>
                    <div className="w-px bg-slate-300 my-2 mx-1 hidden sm:block"></div>
                    <button onClick={() => setActiveTab('monitoring')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                        <ClipboardCheck className="w-4 h-4" /> <span className="hidden sm:inline">2. Mark Entry</span><span className="sm:hidden">Entry</span>
                    </button>
                    <div className="w-px bg-slate-300 my-2 mx-1 hidden sm:block"></div>
                    <button onClick={() => setActiveTab('publishing')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'publishing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Send className="w-4 h-4" /> <span className="hidden sm:inline">3. Publish & Reports</span><span className="sm:hidden">Publish</span>
                    </button>
                </div>
            </div>

            {/* Step 1: Configuration */}
            {activeTab === 'setup' && localConfig && (
                <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Exam Setup Details</h3>
                        <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
                                <input type="text" value={localConfig.exam_name} onChange={e => setLocalConfig({ ...localConfig, exam_name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Term & Academic Year</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select value={localConfig.current_term} onChange={e => setLocalConfig({ ...localConfig, current_term: e.target.value })} className="flex-1 p-3 border border-slate-300 rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-primary-600">
                                        <option>First Term</option> <option>Second Term</option> <option>Third Term</option>
                                    </select>
                                    <input type="text" value={localConfig.academic_year} onChange={e => setLocalConfig({ ...localConfig, academic_year: e.target.value })} className="flex-1 p-3 border border-slate-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary-600" placeholder="e.g. 2023/2024" />
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Class Score Weight (%)</label>
                                    <input
                                        type="number"
                                        min="0" max="100"
                                        value={localConfig.weights?.class || 0}
                                        onChange={e => {
                                            const val = Math.max(0, Math.min(100, Number(e.target.value)));
                                            setLocalConfig({ ...localConfig, weights: { class: val, exam: 100 - val } });
                                        }}
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all font-bold text-lg text-center"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Exam Score Weight (%)</label>
                                    <input
                                        type="number"
                                        min="0" max="100"
                                        value={localConfig.weights?.exam || 0}
                                        onChange={e => {
                                            const val = Math.max(0, Math.min(100, Number(e.target.value)));
                                            setLocalConfig({ ...localConfig, weights: { class: 100 - val, exam: val } });
                                        }}
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all font-bold text-lg text-center"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Weights must add up to exactly 100%
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-700">Grading Scheme</h4>
                                <select
                                    value={localConfig.grading_type || 'STANDARD'}
                                    onChange={(e) => {
                                        const type = e.target.value as 'STANDARD' | 'COMPETENCY';
                                        setLocalConfig({
                                            ...localConfig,
                                            grading_type: type,
                                            grading: GRADING_PRESETS[type]
                                        });
                                    }}
                                    className="text-xs border border-slate-200 rounded p-1 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                    <option value="STANDARD">Standard (A-F)</option>
                                    <option value="COMPETENCY">Competency (EE-BE)</option>
                                </select>
                            </div>
                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {/* Desktop Header */}
                                <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest pl-1">
                                    <div className="col-span-2 text-center">Grade</div>
                                    <div className="col-span-3 text-center">Score Range</div>
                                    <div className="col-span-5">Remark / Description</div>
                                    <div className="col-span-1 text-center">GP</div>
                                    <div className="col-span-1 text-center">Del</div>
                                </div>

                                {localConfig.grading?.map((g: any, idx: number) => (
                                    <div key={idx} className="bg-white md:bg-transparent p-4 md:p-0 rounded-2xl border md:border-0 border-slate-200 shadow-sm md:shadow-none relative space-y-4 md:space-y-0 md:grid md:grid-cols-12 md:gap-2 md:text-xs md:items-center">
                                        
                                        {/* Grade Label (Mobile only) */}
                                        <div className="md:hidden flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level {idx + 1}</span>
                                           <button
                                                onClick={() => {
                                                    const newGrading = localConfig.grading.filter((_: any, i: number) => i !== idx);
                                                    setLocalConfig({ ...localConfig, grading: newGrading });
                                                }}
                                                className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Desktop & Mobile Inputs */}
                                        <div className="md:col-span-2 flex flex-col md:block">
                                            <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Grade</label>
                                            <input type="text" value={g.grade} placeholder="e.g. A1" onChange={(e) => {
                                                const newGrading = [...localConfig.grading];
                                                newGrading[idx] = { ...newGrading[idx], grade: e.target.value };
                                                setLocalConfig({ ...localConfig, grading: newGrading });
                                            }} className="w-full p-2 bg-slate-50 md:bg-white border border-slate-200 rounded-lg font-black text-center focus:border-primary-500 focus:ring-4 focus:ring-primary-50 focus:bg-white transition-all outline-none" />
                                        </div>

                                        <div className="md:col-span-3 flex flex-col md:block">
                                            <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Score Range (Min - Max)</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" value={g.min} placeholder="Min" onChange={(e) => {
                                                    const newGrading = [...localConfig.grading];
                                                    newGrading[idx] = { ...newGrading[idx], min: Number(e.target.value) };
                                                    setLocalConfig({ ...localConfig, grading: newGrading });
                                                }} className="w-full p-2 bg-slate-50 md:bg-white border border-slate-200 rounded-lg text-center font-bold focus:border-primary-500 focus:ring-4 focus:ring-primary-50 focus:bg-white transition-all outline-none" />
                                                <span className="text-slate-300 font-bold">-</span>
                                                <input type="number" value={g.max} placeholder="Max" onChange={(e) => {
                                                    const newGrading = [...localConfig.grading];
                                                    newGrading[idx] = { ...newGrading[idx], max: Number(e.target.value) };
                                                    setLocalConfig({ ...localConfig, grading: newGrading });
                                                }} className="w-full p-2 bg-slate-50 md:bg-white border border-slate-200 rounded-lg text-center font-bold focus:border-primary-500 focus:ring-4 focus:ring-primary-50 focus:bg-white transition-all outline-none" />
                                            </div>
                                        </div>

                                        <div className="md:col-span-5 flex flex-col md:block">
                                            <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Remark / Description</label>
                                            <input type="text" value={g.remark} placeholder="Remarks..." onChange={(e) => {
                                                const newGrading = [...localConfig.grading];
                                                newGrading[idx] = { ...newGrading[idx], remark: e.target.value };
                                                setLocalConfig({ ...localConfig, grading: newGrading });
                                            }} className="w-full p-2 bg-slate-50 md:bg-white border border-slate-200 rounded-lg font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-50 focus:bg-white transition-all outline-none" />
                                        </div>

                                        <div className="md:col-span-1 flex flex-col md:block">
                                            <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">GP</label>
                                            <input type="number" step="0.1" value={g.points} onChange={(e) => {
                                                const newGrading = [...localConfig.grading];
                                                newGrading[idx] = { ...newGrading[idx], points: Number(e.target.value) };
                                                setLocalConfig({ ...localConfig, grading: newGrading });
                                            }} className="w-full p-2 bg-slate-50 md:bg-white border border-slate-200 rounded-lg text-center font-bold focus:border-primary-500 focus:ring-4 focus:ring-primary-50 focus:bg-white transition-all outline-none" placeholder="GP" title="Grade Points" />
                                        </div>

                                        <div className="hidden md:flex md:col-span-1 justify-center">
                                            <button
                                                onClick={() => {
                                                    const newGrading = localConfig.grading.filter((_: any, i: number) => i !== idx);
                                                    setLocalConfig({ ...localConfig, grading: newGrading });
                                                }}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const newGrading = [...(localConfig.grading || []), { grade: "", min: 0, max: 0, remark: "", points: 0 }];
                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                    }}
                                    className="w-full py-4 mt-2 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:border-primary-300 hover:text-primary-500 hover:bg-white hover:shadow-sm transition-all flex items-center justify-center gap-2"
                                >
                                    <PlusCircle className="w-4 h-4" /> Add Grade Level
                                </button>
                            </div>

                        </div>



                        <div className="pt-6 border-t border-slate-100 space-y-6">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-black uppercase text-slate-800 tracking-tight">Report Card Defaults</h4>
                                <span className="bg-primary-50 text-primary-700 text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Customizable</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total Attendance Days</label>
                                    <input 
                                        type="number" 
                                        value={localConfig.term_total_days || ''} 
                                        onChange={e => setLocalConfig({ ...localConfig, term_total_days: Number(e.target.value) })} 
                                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary-100 outline-none transition-all font-bold" 
                                        placeholder="e.g. 75"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Next Term Reopens</label>
                                    <input 
                                        type="text" 
                                        value={localConfig.next_term_reopens || ''} 
                                        onChange={e => setLocalConfig({ ...localConfig, next_term_reopens: e.target.value })} 
                                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary-100 outline-none transition-all font-bold" 
                                        placeholder="e.g. 15th Jan, 2024"
                                    />
                                </div>
                                <div className="md:col-span-2 pt-6 border-t border-slate-100">
                                    <div className="flex justify-between items-end mb-6">
                                        <div>
                                            <h4 className="text-sm font-black uppercase text-slate-800 tracking-wider">Class Layout Assignments</h4>
                                            <p className="text-[10px] text-slate-400 font-medium">Assign a specific report card design to each class individually.</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-400">
                                                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div> Standard
                                            </span>
                                            <span className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-400">
                                                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div> Classic
                                            </span>
                                            <span className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-400">
                                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div> Nursery
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[...availableClasses].sort().map(className => {
                                            const currentLayout = localConfig?.report_card_config?.class_layouts?.[className] || 'modern';
                                            return (
                                                <div key={className} className="bg-white border-2 border-slate-100 rounded-2xl p-4 shadow-sm hover:border-primary-100 transition-all group">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-[10px] font-black uppercase text-slate-700 truncate tracking-widest">{className}</span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            currentLayout === 'nursery' ? 'bg-blue-100 text-blue-700' :
                                                            currentLayout === 'classic_tabular' ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-primary-100 text-primary-700'
                                                        }`}>
                                                            {currentLayout === 'modern' ? 'Standard' : currentLayout === 'classic_tabular' ? 'Classic' : 'Nursery'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl">
                                                        {[
                                                            { id: 'modern', icon: 'M', color: 'primary' },
                                                            { id: 'classic_tabular', icon: 'C', color: 'indigo' },
                                                            { id: 'nursery', icon: 'N', color: 'blue' }
                                                        ].map(layout => (
                                                            <button
                                                                key={layout.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentMap = localConfig?.report_card_config?.class_layouts || {};
                                                                    setLocalConfig({
                                                                        ...localConfig,
                                                                        report_card_config: {
                                                                            ...(localConfig.report_card_config || {}),
                                                                            class_layouts: {
                                                                                ...currentMap,
                                                                                [className]: layout.id
                                                                            }
                                                                        }
                                                                    });
                                                                }}
                                                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${
                                                                    currentLayout === layout.id
                                                                    ? `bg-${layout.color}-600 text-white shadow-md shadow-${layout.color}-100`
                                                                    : 'text-slate-400 hover:bg-white hover:text-slate-600'
                                                                }`}
                                                            >
                                                                <span className="text-[10px]">{layout.icon}</span>
                                                                <span className="text-[7px] leading-none">
                                                                    {layout.id === 'modern' ? 'Std' : layout.id === 'classic_tabular' ? 'Cls' : 'Nur'}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-6 flex flex-col items-center gap-2 p-4 bg-primary-50/50 rounded-2xl border border-primary-100">
                                        <p className="text-[10px] text-primary-700 font-bold uppercase tracking-wider text-center">Batch Layout Actions</p>
                                        <div className="flex gap-2">
                                            {['modern', 'classic_tabular', 'nursery'].map(layoutId => (
                                                <button
                                                    key={layoutId}
                                                    type="button"
                                                    onClick={() => {
                                                        const newMap: any = {};
                                                        availableClasses.forEach(c => newMap[c] = layoutId);
                                                        setLocalConfig({
                                                            ...localConfig,
                                                            report_card_config: {
                                                                ...(localConfig.report_card_config || {}),
                                                                class_layouts: newMap
                                                            }
                                                        });
                                                    }}
                                                    className="bg-white px-3 py-1.5 rounded-lg border border-primary-100 text-[9px] font-black uppercase text-primary-600 hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    Set All to {layoutId === 'modern' ? 'Standard' : layoutId === 'classic_tabular' ? 'Classic' : 'Nursery'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Global Report Card Sections</label>
                                            <p className="text-[10px] text-slate-400 font-medium">Add sections that will appear on ALL students' report cards (e.g. Items to Buy, Physical Notes, etc.)</p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const sections = [...(localConfig.global_report_sections || []), { title: '', content: '' }];
                                                setLocalConfig({ ...localConfig, global_report_sections: sections });
                                            }}
                                            className="flex items-center gap-1.5 bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-all font-black text-[10px] uppercase shadow-sm"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Global Section
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(localConfig.global_report_sections || []).map((section: any, idx: number) => (
                                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group">
                                                <button 
                                                    onClick={() => {
                                                        const sections = localConfig.global_report_sections.filter((_: any, i: number) => i !== idx);
                                                        setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                    }}
                                                    className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                                <div className="space-y-3">
                                                    <input 
                                                        type="text" 
                                                        value={section.title} 
                                                        onChange={e => {
                                                            const sections = [...localConfig.global_report_sections];
                                                            sections[idx].title = e.target.value;
                                                            setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                        }}
                                                        placeholder="Section Title (e.g. Items to Buy)"
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] font-black uppercase text-primary-600 outline-none focus:bg-white focus:border-primary-300"
                                                    />
                                                    <textarea 
                                                        value={section.content} 
                                                        onChange={e => {
                                                            const sections = [...localConfig.global_report_sections];
                                                            sections[idx].content = e.target.value;
                                                            setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                        }}
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-medium h-20 resize-none outline-none focus:bg-white focus:border-primary-300"
                                                        placeholder="Default content for all students..."
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {(!localConfig.global_report_sections || localConfig.global_report_sections.length === 0) && (
                                            <div className="md:col-span-2 p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                                                <p className="text-xs font-bold text-slate-300 italic uppercase">No global sections added yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={() => handleSaveConfig(localConfig)} disabled={saveConfigMutation.isPending} className="w-full md:w-auto bg-primary-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-200 hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                                {saveConfigMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Monitoring */}
            {activeTab === 'monitoring' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Submission Monitoring</h3>
                        <p className="text-sm text-slate-500 font-medium tracking-wide">Select a class below to view subject-wise mark entry progress.</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100 italic">
                        {availableClasses.map((className: string) => {
                            const classSubs = submissionOverview.filter((s: any) => s.class_name === className);
                            const submittedCount = classSubs.filter((s: any) => s.status === 'Submitted').length;
                            const totalCount = classSubs.length || 0;
                            const progress = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;
                            const isExpanded = expandedMonitoringClass === className;

                            return (
                                <div key={className} className="flex flex-col">
                                    <button
                                        onClick={() => setExpandedMonitoringClass(isExpanded ? null : className)}
                                        className={`w-full p-5 flex flex-col md:flex-row md:items-center justify-between text-left hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center font-black text-xs md:text-sm shadow-sm ${progress === 100 ? 'bg-green-100 text-green-700' : 'bg-primary-50 text-primary-600'}`}>
                                                {progress}%
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 uppercase tracking-tight text-base md:text-lg">{className}</h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                                                    {submittedCount} / {totalCount} Subjects Done
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 mt-4 md:mt-0">
                                            <div className="hidden lg:block w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary-500 transition-all duration-700" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'rotate-180 bg-slate-200 text-slate-800' : 'bg-slate-50 text-slate-400'}`}>
                                                <ChevronDown className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="bg-slate-50/50 p-6 md:p-8 animate-in slide-in-from-top-4 duration-300">
                                            <div className="space-y-6">
                                                {/* Summary Counts */}
                                                <div className="flex gap-4">
                                                    <div className="flex-1 bg-green-50 p-3 rounded-xl border border-green-100">
                                                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Submitted</p>
                                                        <p className="text-xl font-black text-green-700">{submittedCount}</p>
                                                    </div>
                                                    <div className="flex-1 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pending</p>
                                                        <p className="text-xl font-black text-amber-700">{totalCount - submittedCount}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {classSubs.map((sub: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`shrink-0 h-2 w-2 rounded-full ${sub.status === 'Submitted' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                                <span className="font-bold text-slate-700 text-xs truncate italic">{sub.subject_name}</span>
                                                            </div>
                                                            <span className={`shrink-0 text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md ${sub.status === 'Submitted' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                {sub.status || 'Pending'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {classSubs.length === 0 && (
                                                        <div className="col-span-full p-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-2xl">
                                                            No subjects found for this class.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {availableClasses.length === 0 && (
                            <div className="col-span-full p-20 text-center bg-white rounded-3xl border-4 border-dashed border-slate-100">
                                <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-400">No Target Classes Set Up</h3>
                                <p className="text-sm text-slate-300">Target classes will appear here once configured in the Setup tab.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 3: Publishing */}
            {activeTab === 'publishing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Class Reports</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {availableClasses.map((cls: string) => {
                                const isReleased = releasedClasses.includes(cls.trim().toLowerCase());
                                return (
                                    <div key={cls} className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 transition-all bg-slate-50 hover:bg-white group">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-slate-900">{cls}</h4>
                                            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded">{students.filter(s => s.class === cls).length} Students</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setViewingClassList(cls); setSelectedClass(cls); }} className="flex-1 py-2 text-xs font-bold text-primary-700 bg-primary-50 rounded hover:bg-primary-100 transition-colors">View Reports</button>
                                            <button
                                                onClick={() => setReleaseModalData({ className: cls, studentCount: students.filter(s => s.class === cls).length, validPhones: students.filter(s => s.class === cls && s.parent_phone && s.parent_phone.length >= 9).length })}
                                                disabled={isReleased || publishResultsMutation.isPending}
                                                className={`flex-1 py-2 text-xs font-bold text-white rounded transition-colors flex items-center justify-center gap-1 ${isReleased ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'}`}
                                            >
                                                {isReleased ? <><CheckCircle className="w-3 h-3" /> Released</> : <><Send className="w-3 h-3" /> Release</>}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {
                releaseModalData && (
                    <ReleaseConfigModal
                        data={releaseModalData}
                        onClose={() => setReleaseModalData(null)}
                        onConfirm={handleConfirmRelease}
                        isProcessing={publishResultsMutation.isPending}
                    />
                )}

            {/* Conditional Modals */}
            {
                viewingClassList && (
                    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div><h3 className="font-bold text-lg text-slate-800">Students in {viewingClassList}</h3></div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={triggerBulkPrint}
                                        disabled={isBulkPrinting}
                                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {isBulkPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                        {isBulkPrinting ? "Generating..." : "Bulk Print Reports"}
                                    </button>
                                    <button onClick={() => setViewingClassList(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto bg-slate-50/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {students.filter(s => s.class === viewingClassList).map((student) => (
                                        <div key={student.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-primary-300 cursor-pointer" onClick={() => setReportStudent(student)}>
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-slate-100 overflow-hidden">{student.photo ? <img src={student.photo} className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-slate-400 m-auto mt-3" />}</div>
                                                <div><h4 className="font-bold text-slate-800">{student.name}</h4></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {
                reportStudent && (
                    <ReportCard
                        student={students.find(s => s.id === reportStudent.id)!}
                        results={(() => {
                            const studentResults = results.filter((r: Result) => r.studentId === reportStudent.id);
                            
                            // Prefill subjects for the class that don't have results entered yet
                            const classSubjects = subjectAssignments
                                .filter((sa: any) => sa.classes?.name === reportStudent.class)
                                .map((sa: any) => sa.subjects?.name)
                                .filter(Boolean);
                            
                            if (classSubjects.length === 0) return studentResults;

                            const fullResults = [...studentResults];
                            classSubjects.forEach(subjName => {
                                if (!fullResults.some(r => r.subject === subjName)) {
                                    fullResults.push({
                                        id: `temp-${subjName}`,
                                        studentId: reportStudent.id,
                                        studentName: reportStudent.name,
                                        class: reportStudent.class,
                                        subject: subjName,
                                        classScore: 0,
                                        examScore: 0,
                                        total: 0
                                    });
                                }
                            });
                            return fullResults;
                        })()}
                        schoolConfig={{
                            ...schoolInfo,
                            ...examConfig,
                        }}
                        onClose={() => setReportStudent(null)}
                        position={studentRank}
                        schoolId={schoolId}
                        printMode={false}
                        savedReportData={allReportCards.find((r: any) => r.student_id === reportStudent.id)}
                    />
                )}

            {/* Hidden Bulk Print Container */}
            {
                isBulkPrinting && viewingClassList && (
                    <div style={{ display: 'none' }}>
                        <div ref={bulkPrintRef} className="print:block">
                            {students.filter(s => s.class === viewingClassList).map((student) => {
                                // Optionally recalculate rank inline if we could, but right now we pass null or fetch it
                                // For bulk print, rank isn't strictly requested per single report, or it may default to '-'
                                // If needed, we'd pre-calculate an array of ranks.
                                return (
                                    <ReportCard
                                        key={student.id}
                                        student={student}
                                        results={(() => {
                                            const studentResults = results.filter((r: Result) => r.studentId === student.id);
                                            
                                            // Prefill for bulk print as well
                                            const classSubjects = subjectAssignments
                                                .filter((sa: any) => sa.classes?.name === student.class)
                                                .map((sa: any) => sa.subjects?.name)
                                                .filter(Boolean);
                                            
                                            if (classSubjects.length === 0) return studentResults;

                                            const fullResults = [...studentResults];
                                            classSubjects.forEach(subjName => {
                                                if (!fullResults.some(r => r.subject === subjName)) {
                                                    fullResults.push({
                                                        id: `temp-${subjName}`,
                                                        studentId: student.id,
                                                        studentName: student.name,
                                                        class: student.class,
                                                        subject: subjName,
                                                        classScore: 0,
                                                        examScore: 0,
                                                        total: 0
                                                    });
                                                }
                                            });
                                            return fullResults;
                                        })()}
                                        schoolConfig={{
                                            ...schoolInfo,
                                            ...examConfig,
                                        }}
                                        onClose={() => { }}
                                        schoolId={schoolId}
                                        printMode={true}
                                        savedReportData={allReportCards.find((r: any) => r.student_id === student.id)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
        </div >
    );
};

const ReleaseConfigModal = ({ data, onClose, onConfirm, isProcessing }: any) => {
    const [sendSms, setSendSms] = useState(true);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Release Results</h3>
                    <p className="text-slate-500 text-sm">Configure release options for <span className="font-bold text-slate-700">{data.className}</span>.</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <p className="text-sm text-blue-800">
                            Releasing results will make them visible to students and parents on the portal immediately.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-700 text-sm">Send SMS Notification</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={sendSms} onChange={e => setSendSms(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            </label>
                        </div>

                        {sendSms && (
                            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Recipients (Valid Phones):</span>
                                    <span className="font-bold text-slate-800">{data.validPhones} / {data.studentCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Est. SMS Cost:</span>
                                    <span className="font-bold text-slate-800">{data.validPhones} units</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm transition-colors">Cancel</button>
                    <button
                        onClick={() => onConfirm(data.className, sendSms)}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isProcessing ? 'Processing...' : 'Confirm Release'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Exams;