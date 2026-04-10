import React, { useState, useEffect, useRef } from 'react';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings,
    Lock, Unlock, PlayCircle, StopCircle, Eye, Send, Users, X, Loader2,
    MessageSquare, Plus, Check, Calendar, PlusCircle, PenTool, Archive, Trash2, ShieldAlert
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
        exam_config: data.exam_config,
        report_card_config: data.report_card_config
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
        attendance_mode: 'manual',
        term_total_days: 0,
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
    const { data, error } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name', { ascending: true });
    if (error) throw error;
    return data ? data.map(c => c.name) : [];
};

const fetchSubjects = async (schoolId: string) => {
    const { data, error } = await supabase.from('subjects').select('name').eq('school_id', schoolId).order('name', { ascending: true });
    if (error) throw error;
    return data ? data.map(s => s.name) : [];
};

const fetchStudents = async (schoolId: string, assignedClasses: string[] = []) => {
    // Robust column projection: only select what is strictly needed for the Exams interface
    // Loading thousands of full student objects at once is what causes the "works for some, not for others" issue
    let query = supabase.from('students')
        .select('id, name, class, photo_url, parent_phone, parent_name, admission_no, pin, balance')
        .eq('school_id', schoolId)
        .limit(5000);

    // We fetch all active students for the school and filter locally 
    // to handle inconsistencies in class name casing or trailing spaces
    const { data, error } = await query;
    if (error) {
        console.error("Critical: Failed to fetch students", error);
        throw error;
    }

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

const fetchResults = async (schoolId: string, term: string, year: string, className?: string, subjectName?: string) => {
    let query = supabase
        .from('exam_results')
        .select('*, students(name)')
        .eq('school_id', schoolId)
        .eq('term', (term || '').trim().toUpperCase())
        .eq('academic_year', (year || '').trim().toUpperCase());

    if (className) {
        query = query.eq('class', className.trim().toUpperCase());
    }
    if (subjectName) {
        query = query.eq('subject', subjectName.trim().toUpperCase());
    }

    const { data, error } = await query.limit(10000);

    if (error) {
        console.error('DEBUG: fetchResults Error:', error);
    }
    console.log(`DEBUG: fetchResults returned ${data?.length || 0} rows.`);

    return data ? data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.students?.name || 'Unknown',
        class: r.class,
        subject: r.subject,
        classScore: r.class_score,
        exam_score: r.exam_score, // keep both for internal usage if needed
        examScore: r.exam_score,
        total: r.total,
        competency_status: r.competency_status
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
        .select('is_class_teacher, class_name, subject_name, class_id, classes(name), subject_id, subjects(name)')
        .eq('teacher_id', teacherId);

    if (!data) return [];
    return data.map((a: any) => ({
        className: a.classes?.name || a.class_name,
        subjectName: a.subjects?.name || a.subject_name,
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
    const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number; competencyStatus?: string }>>({});
    const isAdmin = (currentUser?.role || '').toLowerCase().includes('admin');
    const [teacherTab, setTeacherTab] = useState<'marks' | 'remarks'>('marks');
    const [activeTool, setActiveTool] = useState<'teacher_remark' | 'conduct' | 'interest' | 'performance_status'>('teacher_remark');
    const [paintBrush, setPaintBrush] = useState<string>('');
    const [userPresets, setUserPresets] = useState<string[]>([]);
    const [conductPresets, setConductPresets] = useState<string[]>(["Excellent", "Very Good", "Satisfactory", "Good", "Fair", "Needs Improvement"]);
    const [interestPresets, setInterestPresets] = useState<string[]>(["Reading / Comm.", "Mathematics", "Science & Tech", "Arts / Creatives", "Sports / Athletics", "Music"]);
    const [newPresetValue, setNewPresetValue] = useState("");
    const [pendingRemarks, setPendingRemarks] = useState<Record<string, Record<string, any>>>({});
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [releaseModalData, setReleaseModalData] = useState<{ className: string, studentCount: number, validPhones: number } | null>(null);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);
    const [isLevelArchiveOpen, setIsLevelArchiveOpen] = useState(false);
    const [newLevelName, setNewLevelName] = useState("");
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

    const { data: allClassesData = [] } = useQuery({
        queryKey: ['classNames', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId
    });

    const { data: allSubjects = [] } = useQuery({
        queryKey: ['subjectNames', schoolId],
        queryFn: () => fetchSubjects(schoolId!),
        enabled: !!schoolId
    });

    // Fetch Class/Subject assignments for teachers (Robustness improvement)
    const { data: myAssignments = [] } = useQuery({
        queryKey: ['teacherAssignments', currentUser?.id, schoolId],
        queryFn: async () => {
            if (!currentUser?.id || !schoolId) return [];

            // 1. Fetch raw assignments (no joins for max reliability)
            const { data: assignmentsData } = await supabase
                .from('teacher_assignments')
                .select('*')
                .eq('teacher_id', currentUser.id);

            // 2. Fetch primary record from teachers table
            const { data: teacherRow } = await supabase
                .from('teachers')
                .select('assigned_class, subject')
                .eq('id', currentUser.id)
                .maybeSingle();

            // 3. Fetch lookups for names (robust mapping)
            const [{ data: lookupClasses }, { data: lookupSubjects }] = await Promise.all([
                supabase.from('classes').select('id, name').eq('school_id', schoolId),
                supabase.from('subjects').select('id, name').eq('school_id', schoolId)
            ]);

            const classMap = new Map(lookupClasses?.map(c => [c.id, c.name]) || []);
            const subjectMap = new Map(lookupSubjects?.map(s => [s.id, s.name]) || []);

            const combined = new Map<string, any>();

            // Process text assignment from teachers table (Main Class Teacher role)
            if (teacherRow?.assigned_class) {
                const className = teacherRow.assigned_class.trim();
                combined.set(`${className}-null`, {
                    className,
                    subjectName: teacherRow.subject || null,
                    isClassTeacher: true
                });
            }

            // Process entries from teacher_assignments (Both roles)
            assignmentsData?.forEach((a: any) => {
                const className = (classMap.get(a.class_id) || a.class_name || '').trim();
                const subjectName = (subjectMap.get(a.subject_id) || a.subject_name || '').trim();

                if (className) {
                    const key = `${className}-${subjectName || 'null'}`;
                    const existing = combined.get(key);

                    combined.set(key, {
                        className,
                        subjectName: subjectName || null,
                        isClassTeacher: a.is_class_teacher || existing?.isClassTeacher || false
                    });

                    // If this assignment marks them as a class teacher, 
                    // ensure a "base" class record exists too
                    if (a.is_class_teacher) {
                        const baseKey = `${className}-null`;
                        const existingBase = combined.get(baseKey);
                        combined.set(baseKey, {
                            className,
                            subjectName: existingBase?.subjectName || null,
                            isClassTeacher: true
                        });
                    }
                }
            });

            // Process profile fallback
            if (currentUser.assignedClass && !combined.has(`${currentUser.assignedClass.trim()}-null`)) {
                const className = currentUser.assignedClass.trim();
                combined.set(`${className}-null`, {
                    className,
                    subjectName: null,
                    isClassTeacher: true
                });
            }

            return Array.from(combined.values());
        },
        enabled: !!currentUser?.id && !!schoolId,
        staleTime: 60 * 1000
    });

    const { data: students = [], isLoading: isLoadingStudents, isError: isStudentError, refetch: refetchStudents } = useQuery<Student[]>({
        queryKey: ['students', schoolId, myAssignments.map(a => a.className).join('|')],
        queryFn: async () => {
            const assignedClassList = [...new Set(myAssignments.map((a: any) => a.className).filter(Boolean))] as string[];

            // Critical Robustness Check: If a teacher is logged in but assignments haven't loaded yet,
            // return empty array instead of accidentally fetching "all school students"
            if (currentUser?.role === 'teacher' && assignedClassList.length === 0) {
                // Wait briefly for assignments if they are still loading in background
                return [];
            }

            const allStudents = await fetchStudents(schoolId!, []);

            // Performance and Robustness: Filter locally for teachers using normalized names
            if ((currentUser?.role || '').toLowerCase() === 'teacher') {
                const assignedSet = new Set(assignedClassList.map(c => c.trim().toLowerCase()));
                return allStudents.filter(s => s.class && assignedSet.has(s.class.trim().toLowerCase()));
            }

            return allStudents;
        },
        enabled: !!schoolId && (currentUser?.role !== 'teacher' || myAssignments.length > 0), // Only enable once classes are known
        staleTime: 5 * 60 * 1000,
        retry: 3
    });

    // Fetches dependent on Config
    const currentTerm = examConfig?.current_term || 'First Term';
    const currentYear = examConfig?.academic_year || new Date().getFullYear().toString();

    useEffect(() => {
        console.log('DEBUG: Exam Environment State:', {
            schoolId,
            currentTerm,
            currentYear,
            hasConfig: !!examConfig,
            markEntryEnabled: examConfig?.mark_entry_enabled
        });
    }, [schoolId, currentTerm, currentYear, examConfig]);

    const { data: results = [] } = useQuery({
        queryKey: ['examResults', schoolId, currentTerm?.toUpperCase(), currentYear?.toUpperCase(), selectedClass?.toUpperCase(), selectedSubject?.toUpperCase()],
        queryFn: () => fetchResults(
            schoolId!, 
            currentTerm?.toUpperCase(), 
            currentYear?.toUpperCase(),
            (currentUser?.role === 'teacher' ? selectedClass : undefined), 
            (currentUser?.role === 'teacher' ? selectedSubject : undefined)
        ),
        enabled: !!schoolId && !!examConfig,
        staleTime: 5 * 60 * 1000
    });

    const { data: submissionOverview = [] } = useQuery({
        queryKey: ['submissionOverview', schoolId, currentTerm, currentYear],
        queryFn: () => fetchSubmissionOverview(schoolId!, currentTerm, currentYear),
        enabled: !!schoolId && !!examConfig && ((currentUser?.role || '').toLowerCase().includes('admin'))
    });

    const { data: allAssignments = [] } = useQuery({
        queryKey: ['allAssignments', schoolId],
        queryFn: async () => {
            if (!schoolId) return [];

            // 1. Fetch from teacher_assignments (Specific assignments)
            const { data: q1 } = await supabase
                .from('teacher_assignments')
                .select('class_name, classes(name), subject_name, subjects(name), teachers(name), teacher(name)')
                .eq('school_id', schoolId);

            // 2. Fetch from subject_assignments (Standard school config)
            const { data: q2 } = await supabase
                .from('subject_assignments')
                .select('classes(name), subjects(name), teachers(name), teacher(name)')
                .eq('school_id', schoolId);

            // 3. Fetch from teachers table (Primary class teacher assignments)
            const { data: q3 } = await supabase
                .from('teachers')
                .select('name, assigned_class, subject')
                .eq('school_id', schoolId);

            const combined: any[] = [];

            // Helper to handle singleton arrays from joins
            const getVal = (v: any) => (Array.isArray(v) ? v[0] : v);

            // Add Specific Teacher Assignments
            q1?.forEach((d: any) => {
                const cls = getVal(d.classes);
                const subj = getVal(d.subjects);
                const tObj = getVal(d.teachers) || getVal(d.teacher);
                combined.push({
                    class_name: cls?.name || d.class_name,
                    subject_name: subj?.name || d.subject_name,
                    teacher_name: tObj?.name
                });
            });

            // Add Subject Assignments mappings
            q2?.forEach((d: any) => {
                const cls = getVal(d.classes);
                const subj = getVal(d.subjects);
                const tObj = getVal(d.teachers) || getVal(d.teacher);
                if (tObj) {
                    combined.push({
                        class_name: cls?.name,
                        subject_name: subj?.name,
                        teacher_name: tObj.name
                    });
                }
            });

            // Add Primary Class Teachers Mapping
            q3?.forEach((d: any) => {
                if (d.assigned_class) {
                    combined.push({
                        class_name: d.assigned_class,
                        subject_name: d.subject || null, // Might be NULL for generic class teacher
                        teacher_name: d.name
                    });
                }
            });

            return combined.filter(c => c.teacher_name);
        },
        enabled: !!schoolId && ((currentUser?.role || '').toLowerCase().includes('admin'))
    });

    const { data: releasedClasses = [] } = useQuery({
        queryKey: ['releasedClasses', schoolId, currentTerm],
        queryFn: () => fetchReleasedClasses(schoolId!, currentTerm),
        enabled: !!schoolId && !!examConfig && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
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
    const availableClasses: string[] = Array.isArray(localConfig?.target_classes)
        ? localConfig.target_classes
        : (localConfig?.target_classes || '').split(',').map((c: string) => c.trim()).filter(Boolean);

    // Calculate if user has Class Teacher privileges for the current class
    const isClassTeacher = (currentUser?.role || '').toLowerCase().includes('admin') ||
        (currentUser?.assignedClass?.trim().toLowerCase() === selectedClass.trim().toLowerCase()) ||
        myAssignments.some((a: any) => a.isClassTeacher && (a.className?.trim().toLowerCase() === selectedClass?.trim().toLowerCase()));

    // Auto-switch away from protected tabs if access is lost (e.g. switched to a class where only a subject teacher)
    useEffect(() => {
        if (!isClassTeacher && (teacherTab === 'remarks' || teacherTab === 'reports')) {
            setTeacherTab('marks');
        }
    }, [isClassTeacher, teacherTab]);

    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

    useEffect(() => {
        if (currentUser?.role === 'teacher') {
            // Teacher: filter subjects
            if (selectedClass) {
                const classAssignment = myAssignments.filter((a: any) => a.className === selectedClass);
                const isClassTeacher = (currentUser?.role || '').toLowerCase().includes('admin') ||
                    (currentUser?.assignedClass?.trim().toLowerCase() === selectedClass.trim().toLowerCase()) ||
                    classAssignment.some((a: any) => a.isClassTeacher);

                if (isClassTeacher) {
                    // Class teacher: see ALL subjects assigned to this class specifically
                    const classSubjs = [...new Set(subjectAssignments
                        .filter((sa: any) => sa.classes?.name?.trim().toLowerCase() === selectedClass.trim().toLowerCase())
                        .map((sa: any) => sa.subjects?.name)
                        .filter(Boolean))];

                    if (classSubjs.length > 0) {
                        setAvailableSubjects(classSubjs);
                    } else if (examConfig?.target_subjects && examConfig.target_subjects.length > 0) {
                        setAvailableSubjects(examConfig.target_subjects);
                    } else {
                        setAvailableSubjects(allSubjects);
                    }
                } else {
                    const mySubjs = [...new Set(classAssignment.map((a: any) => a.subjectName).filter(Boolean))];
                    setAvailableSubjects(mySubjs);
                }
            }
        } else if ((currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && allSubjects.length > 0) {
            // Admin: Filter by class if selected, otherwise show all subjs in config or school
            if (selectedClass) {
                const classAssigned = subjectAssignments
                    .filter((sa: any) => sa.classes?.name?.trim().toLowerCase() === selectedClass.trim().toLowerCase())
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

    // Removed global reset effect to allow subject-to-subject mark entry before saving.
    // Persistence is handled by composite keys in pendingChanges.

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
            console.log("MUTATING EXAM CONFIG:", newConfig);
            const { error } = await supabase.rpc('save_exam_config', {
                p_school_id: schoolId,
                p_config: newConfig
            });
            if (error) {
                console.error("RPC ERROR:", error);
                throw error;
            }
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

    const submitMarksMutation = useMutation({
        mutationFn: async ({ className, subjectName }: { className: string, subjectName: string }) => {
            const { error } = await supabase.rpc('submit_exam_marks_v3', {
                p_school_id: schoolId,
                p_class: className,
                p_subject: subjectName,
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

    const clearMarksMutation = useMutation({
        mutationFn: async ({ className, subjectName }: { className: string, subjectName: string }) => {
            const cleanSubj = (subjectName || '').trim().toUpperCase();
            const cleanTerm = (currentTerm || '').trim().toUpperCase();
            const cleanYear = (currentYear || '').trim().toUpperCase();
            const studentIds = classStudents.map(s => s.id);

            console.log("NUCLEAR OVERWRITE & DELETE START", { subject: cleanSubj, students: studentIds.length });

            // 1. FORCE OVERWRITE TO ZERO (Saves even if Delete fails)
            // This is the fallback: if we can't delete the row, we at least make it zero.
            const resetDatas = studentIds.map(sid => ({
                school_id: schoolId,
                student_id: sid,
                class: className.trim().toUpperCase(),
                subject: cleanSubj,
                term: cleanTerm,
                academic_year: cleanYear,
                class_score: 0,
                exam_score: 0,
                competency_status: 'Reset'
            }));

            const { error: upsertError } = await supabase
                .from('exam_results')
                .upsert(resetDatas, { onConflict: 'student_id,class,subject,term,academic_year' });

            console.log("ZERO-OVERWRITE RESULT:", { error: upsertError });

            // 2. SURGICAL DELETE (Try to remove them entirely)
            const recordsToDelete = results.filter((r: Result) =>
                r.class?.trim().toUpperCase() === className.trim().toUpperCase() &&
                r.subject?.trim().toUpperCase() === cleanSubj
            );
            const idsToDelete = recordsToDelete.map(r => r.id);

            if (idsToDelete.length > 0) {
                const { error: delErr, count } = await supabase
                    .from('exam_results')
                    .delete({ count: 'exact' })
                    .in('id', idsToDelete);
                console.log("ID-DELETE RESULT:", { error: delErr, count });
            }

            // 3. CLEAR STATUS
            const statusTargets = ['exam_submissions', 'submission_status', 'submission_overview', 'exam_submission_overview'];
            for (const table of statusTargets) {
                await supabase.from(table).delete().eq('school_id', schoolId).ilike('subject_name', `%${cleanSubj}%`).ilike('term', `%${cleanTerm}%`);
                if (studentIds.length > 0) {
                    await supabase.from(table).delete().eq('school_id', schoolId).in('student_id', studentIds).ilike('subject', `%${cleanSubj}%`).ilike('term', `%${cleanTerm}%`);
                }
            }

            try { await supabase.rpc('unsubmit_exam_marks', { p_school_id: schoolId, p_class: className, p_subject: cleanSubj, p_term: cleanTerm }); } catch (e) { }
        },
        onSuccess: async () => {
            queryClient.setQueryData(['examResults', schoolId, currentTerm, currentYear], () => []);
            await queryClient.invalidateQueries({ queryKey: ['examResults'] });
            await queryClient.invalidateQueries({ queryKey: ['submissionOverview'] });
            await queryClient.refetchQueries({ queryKey: ['examResults'] });
            await queryClient.refetchQueries({ queryKey: ['submissionOverview'] });
            alert("Subject marks successfully cleared and reset to zero.");
        },
        onError: (e: any) => {
            console.error("Reset Failed:", e);
            alert("Reset Error: " + e.message);
        }
    });

    const sendResultNotifications = async (className: string) => {
        try {
            const cleanPhone = (p: string) => p?.replace(/\s+/g, '') || '';
            const PORTAL_LINK = 'https://base16.sixzones.com/login';

            // 1. Get recipients
            const targetStudents = (students as Student[]).filter(s => s.class === className && s.parent_phone);

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
                        clientId: (import.meta as any).env.VITE_HUBTEL_CLIENT_ID,
                        clientSecret: (import.meta as any).env.VITE_HUBTEL_CLIENT_SECRET,
                        senderId: (import.meta as any).env.VITE_HUBTEL_SENDER_ID
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
            const formattedUpdates = updates.map(u => ({
                ...u,
                class: u.class?.trim().toUpperCase(),
                subject: u.subject?.trim().toUpperCase(),
                term: u.term?.trim().toUpperCase(),
                academic_year: u.academic_year?.trim().toUpperCase()
            }));

            const { data, error: resultError } = await supabase
                .from('exam_results')
                .upsert(formattedUpdates, { onConflict: 'student_id,class,subject,term,academic_year' })
                .select();

            if (resultError) throw resultError;
            return data;
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
        queryKey: ['reportCards', schoolId, currentTerm, currentYear],
        queryFn: async () => {
            if (!schoolId || !currentTerm || !currentYear) return [];
            const { data, error } = await supabase
                .from('student_report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('term', currentTerm)
                .eq('academic_year', currentYear);

            if (error) {
                console.error("Supabase Fetch Error:", error);
            }
            return data || [];
        },
        enabled: !!schoolId && !!examConfig,
        staleTime: 1 * 60 * 1000
    });

    const saveBulkRemarksMutation = useMutation({
        mutationFn: async (updates: any[]) => {
            const { error } = await supabase.rpc('save_student_reports_bulk', {
                p_reports: updates
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reportCards', schoolId, currentTerm, currentYear] });
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

    const reportConfig = examConfig?.report_card_config || schoolInfo?.report_card_config;
    const getLayoutForClass = (className: string) => {
        if (!className || !reportConfig) return reportConfig?.layout || 'modern';
        const layouts = reportConfig.class_layouts || {};

        // 1. Direct match (Fastest)
        if (layouts[className]) return layouts[className];

        const searchTerm = className.trim().toLowerCase();
        // 2. Case-insensitive exact trim match
        const exactKey = Object.keys(layouts).find(k => k.trim().toLowerCase() === searchTerm);
        if (exactKey) return layouts[exactKey];

        // 3. Fuzzy match (Robust: handle "Class 6" matching "Class 6 Green")
        const fuzzyKey = Object.keys(layouts).find(k => {
            const kLow = k.trim().toLowerCase();
            return searchTerm.startsWith(kLow) || kLow.startsWith(searchTerm);
        });
        if (fuzzyKey) return layouts[fuzzyKey];

        return reportConfig.layout || 'modern';
    };
    const isNurseryLayout = getLayoutForClass(selectedClass) === 'nursery';

    const saveBulkRemarks = () => {
        if (!selectedClass) return alert("Select Class");
        const cleanClass = (selectedClass || '').trim().toUpperCase();
        const cleanTerm = (currentTerm || '').trim().toUpperCase();
        const cleanYear = (currentYear || '').trim().toUpperCase();

        const updates = Object.entries(pendingRemarks).map(([studentId, val]: [string, any]) => {
            const sr = allReportCards.find((r: any) => r.student_id === studentId);
            return {
                school_id: schoolId || null,
                student_id: studentId || null,
                class: selectedClass || '',
                term: currentTerm || '',
                academic_year: currentYear || '',
                teacher_remark: val.teacher_remark ?? sr?.teacher_remark ?? null,
                principal_remark: sr?.principal_remark ?? null,
                promotion_status: sr?.promotion_status ?? null,
                position: sr?.position_in_class ?? 0,
                total_students: sr?.total_students ?? 0,
                attendance_present: val.attendance_present ?? sr?.attendance_present ?? null,
                attendance_total: val.attendance_total ?? sr?.attendance_total ?? (localConfig?.term_total_days || null),
                conduct: val.conduct ?? sr?.conduct ?? null,
                interest: val.interest ?? sr?.interest ?? null,
                pupil_bill: sr?.pupil_bill ?? null,
                other_fees: sr?.other_fees ?? null,
                items_to_bring: sr?.items_to_bring ?? null,
                next_term_reopens: sr?.next_term_reopens ?? null,
                extra_bill_items: sr?.extra_bill_items ?? [],
                extra_report_sections: sr?.extra_report_sections ?? []
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
        console.log("HANDLESAVECONFIG - FINAL PAYLOAD:", finalConfig);
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

    const getPendingKey = (studentId: string, className = selectedClass, subjectName = selectedSubject) => `${studentId}|${className}|${subjectName}`;

    const handleScoreChange = (studentId: string, field: 'classScore' | 'examScore' | 'competencyStatus', value: string) => {
        if (!studentId) {
            console.error(`DEBUG Error: handleScoreChange called with missing studentId! Field: ${field}, Value: ${value}`);
            return;
        }
        const key = getPendingKey(studentId);

        if (field === 'competencyStatus') {
            console.log(`DEBUG Input: Captured competency change for Student ${studentId.substring(0, 8)}: ${value}`);
            setPendingChanges(prev => {
                const current = prev[key] || {
                    classScore: getExistingScore(studentId, 'classScore'),
                    examScore: getExistingScore(studentId, 'examScore'),
                    competencyStatus: getExistingCompetency(studentId)
                };
                return {
                    ...prev,
                    [key]: { ...current, competencyStatus: value }
                };
            });
            return;
        }

        let numValue = Number(value);
        const maxClass = examConfig?.weights?.class || 30;
        const maxExam = examConfig?.weights?.exam || 70;

        if (field === 'classScore' && numValue > maxClass) numValue = maxClass;
        if (field === 'examScore' && numValue > maxExam) numValue = maxExam;
        if (numValue < 0) numValue = 0;

        setPendingChanges(prev => {
            const current = prev[key] || {
                classScore: getExistingScore(studentId, 'classScore'),
                examScore: getExistingScore(studentId, 'examScore'),
                competencyStatus: getExistingCompetency(studentId)
            };
            return {
                ...prev,
                [key]: { ...current, [field]: numValue }
            };
        });
    };

    const getExistingCompetency = (studentId: string) => {
        const cleanClass = (selectedClass || '').trim().toLowerCase();
        const cleanSubj = (selectedSubject || '').trim().toLowerCase();
        const cleanStudentId = (studentId || '').trim().toLowerCase();

        // Robust match: filter all and pick the best one (prefer non-empty)
        const matches = results.filter((r: Result) =>
            (r.studentId || '').trim().toLowerCase() === cleanStudentId &&
            (r.class || '').trim().toLowerCase() === cleanClass &&
            (r.subject || '').trim().toLowerCase() === cleanSubj
        );

        if (matches.length === 0) return '';
        const best = matches.find(m => (m as any).competency_status) || matches[0];
        return (best as any).competency_status || '';
    };

    const getExistingScore = (studentId: string, field: 'classScore' | 'examScore') => {
        const cleanClass = (selectedClass || '').trim().toLowerCase();
        const cleanSubj = (selectedSubject || '').trim().toLowerCase();
        const cleanStudentId = (studentId || '').trim().toLowerCase();

        // Handle duplicates by choosing the record that actually has marks (higher total)
        const matches = results.filter((r: Result) =>
            (r.studentId || '').trim().toLowerCase() === cleanStudentId &&
            (r.class || '').trim().toLowerCase() === cleanClass &&
            (r.subject || '').trim().toLowerCase() === cleanSubj
        );

        if (matches.length === 0) return 0;

        // Sort: Prioritize records with a higher total score to bypass "ghost" empty records
        const bestMatch = matches.sort((a, b) => (b.total || 0) - (a.total || 0))[0];
        const val = bestMatch[field];

        // Ensure we handle non-numeric strings correctly during transitions
        const numVal = Number(val);
        const isActuallyNumber = !isNaN(numVal) && (val as any) !== '' && (val as any) !== null;

        const isCompetencyMode = examConfig?.grading_type?.trim().toLowerCase().includes('competency') ||
            examConfig?.grading_type?.trim().toLowerCase().includes('numeracy');

        if (!isActuallyNumber && !isCompetencyMode) {
            return 0; // Return zero for text-based grades like "MASTERED" when in numeric mode
        }

        return isActuallyNumber ? numVal : val || 0;
    };

    const saveMarks = async () => {
        const updates = Object.entries(pendingChanges).map(([key, val]: [string, any]) => {
            const [studentId, className, subjectName] = key.split('|');
            return {
                school_id: schoolId,
                student_id: studentId,
                class: (className || '').trim().toUpperCase(),
                subject: (subjectName || '').trim().toUpperCase(),
                term: (currentTerm || '').trim().toUpperCase(),
                academic_year: (currentYear || '').trim().toUpperCase(),
                class_score: val.classScore,
                exam_score: val.examScore,
                competency_status: val.competencyStatus
            };
        });

        if (updates.length > 0) {
            saveMarksMutation.mutate(updates);
        } else {
            queryClient.invalidateQueries({ queryKey: ['examResults', schoolId] });
        }
    };

    const handleSubmitMarks = async () => {
        if (!selectedClass || !selectedSubject) return alert("Select Class and Subject");

        if (Object.keys(pendingChanges).length > 0) {
            const updates = Object.entries(pendingChanges).map(([key, val]: [string, any]) => {
                const [studentId, className, subjectName] = key.split('|');
                return {
                    school_id: schoolId,
                    student_id: studentId,
                    class: (className || '').trim().toUpperCase(),
                    subject: (subjectName || '').trim().toUpperCase(),
                    term: (currentTerm || '').trim().toUpperCase(),
                    academic_year: (currentYear || '').trim().toUpperCase(),
                    class_score: val.classScore,
                    exam_score: val.examScore,
                    competency_status: val.competencyStatus
                };
            });
            await saveMarksMutation.mutateAsync(updates);
        }

        if (!confirm(`Submit marks for ${selectedSubject} (${selectedClass})? This signals you are done.`)) return;
        submitMarksMutation.mutate({ className: selectedClass, subjectName: selectedSubject });
    };

    const handleResetSubjectMarks = (className: string, subjectName: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete all marks for ${subjectName} in ${className}? This is used to "wipe" the subject for re-entry if the grading system was changed. This action cannot be undone.`)) return;
        clearMarksMutation.mutate({ className, subjectName });
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
    const classStudents = students.filter(s =>
        s.class?.trim().toLowerCase() === (selectedClass || '').trim().toLowerCase()
    );

    const getPrefilledResults = (student: any) => {
        if (!student) return [];

        // 1. Get existing results for this student
        const studentResults = results.filter((r: Result) => r.studentId === student.id);

        // 3. Combine and De-duplicate by subject name
        // We use a Map to ensure only one entry per subject.
        const resultsMap = new Map<string, any>();

        // Helper to normalize subject keys aggressively (removes hidden chars/extra spaces)
        const normalizeSubjKey = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

        // Identify all expected subjects for this student's class
        const studentClass = (student.class || selectedClass || '').trim().toLowerCase();
        const classSubjectsList = subjectAssignments
            .filter((sa: any) => (sa.classes?.name || '').trim().toLowerCase() === studentClass)
            .map((sa: any) => sa.subjects?.name)
            .filter(Boolean);

        const classSubjSet = new Set(classSubjectsList.map(s => normalizeSubjKey(s)));

        // First, add existing results IF they are part of the current class subjects
        studentResults.forEach(r => {
            const normalized = normalizeSubjKey(r.subject);
            if (r.subject && classSubjSet.has(normalized)) {
                const existing = resultsMap.get(normalized);
                // Keep the record with actual marks (higher total)
                if (!existing || (r.total || 0) > (existing.total || 0)) {
                    resultsMap.set(normalized, r);
                }
            }
        });

        // Then, ensure all class subjects are represented (prefill with 0 if missing)
        classSubjectsList.forEach(originalSubjName => {
            const normalized = normalizeSubjKey(originalSubjName);
            if (!resultsMap.has(normalized)) {
                resultsMap.set(normalized, {
                    id: `temp-${normalized}-${student.id}`,
                    studentId: student.id,
                    studentName: student.name,
                    class: student.class,
                    subject: originalSubjName,
                    classScore: 0,
                    examScore: 0,
                    total: 0
                });
            }
        });

        return Array.from(resultsMap.values());
    };

    // --- TEACHER VIEW (FOR ASSIGNED SUBJECTS) ---
    if ((currentUser?.role || '').toLowerCase() === 'teacher') {
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

                    {!!selectedClass && (
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
                            <button
                                onClick={() => setTeacherTab('marks')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${teacherTab === 'marks' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <PlusCircle className="w-4 h-4" /> Mark Entry
                            </button>
                            {isClassTeacher && (
                                <>
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
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                    {/* Toolbar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center bg-slate-50">
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                                <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); }} className="p-3 border border-slate-300 rounded-xl outline-none bg-white w-56 cursor-pointer font-bold shadow-sm focus:ring-4 focus:ring-primary-50">
                                    <option value="">-- Select Class --</option>
                                    {((currentUser?.role || '').toLowerCase() === 'teacher'
                                        ? [...new Set(myAssignments
                                            .filter((a: any) => (teacherTab === 'marks') || a.isClassTeacher)
                                            .map((a: any) => a.className).filter(Boolean))]
                                        : availableClasses).map((className: any, i: number) => (
                                            <option key={i} value={className}>{className}</option>
                                        ))}
                                </select>
                            </div>
                            {teacherTab === 'marks' && (
                                <div className="flex gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!selectedClass} className="p-3 border border-slate-300 rounded-xl outline-none bg-white w-56 cursor-pointer disabled:opacity-50 font-bold shadow-sm focus:ring-4 focus:ring-primary-50">
                                            <option value="">-- Select Subject --</option>
                                            {availableSubjects.map((s: any) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    {isNurseryLayout && (
                                        <button
                                            onClick={() => setIsLevelArchiveOpen(true)}
                                            className="p-2 px-4 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 h-[42px]"
                                        >
                                            <Archive className="w-3.5 h-3.5" /> Levels
                                        </button>
                                    )}
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
                            {teacherTab === 'marks' && !((currentUser?.role || '').toLowerCase().includes('admin')) && (
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

                    {(teacherTab === 'remarks' || teacherTab === 'reports') && !isClassTeacher ? (
                        <div className="flex-1 flex items-center justify-center bg-slate-50 p-12 overflow-hidden min-h-[600px]">
                            <div className="text-center max-w-sm">
                                <ShieldAlert className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Access Restricted</h3>
                                <p className="text-slate-500 text-sm font-medium">Only the designated Class Teacher is authorized to manage remarks and clinical reports for this class.</p>
                                <button onClick={() => setTeacherTab('marks')} className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg">Return to Mark Entry</button>
                            </div>
                        </div>
                    ) : teacherTab === 'remarks' ? (
                        <div className="flex-1 flex flex-col min-h-[600px] bg-slate-50 relative pb-28">
                            {/* Top Bar: Target Field */}
                            <div className="bg-white border-b border-slate-200 p-3 md:p-4 sticky top-0 z-20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-black text-slate-800 tracking-tight mb-2 uppercase text-[10px] hidden md:block">1. Select Target Field</h4>
                                    <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1 max-w-md">
                                        {[
                                            { id: 'teacher_remark', label: 'Remarks' },
                                            { id: 'conduct', label: 'Conduct' },
                                            { id: 'interest', label: 'Interest' },
                                            ...(examConfig.attendance_mode === 'manual' ? [{ id: 'attendance_present', label: 'Attendance' }] : [])
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
                                        const termTotal = examConfig?.term_total_days || 0;

                                        return (
                                            <div
                                                key={student.id}
                                                className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between group ${paintBrush && currentVal !== paintBrush ? 'hover:border-primary-400 hover:shadow-md cursor-pointer' : ''} ${currentVal ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}
                                                onClick={(e) => {
                                                    // Only handle if clicking the card, not the input inside
                                                    if (paintBrush && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                                                        handleRemarkChange(student.id, activeTool, paintBrush);
                                                    }
                                                }}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-sm">{student.name}</h5>
                                                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block">{student.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-50 p-2 rounded-lg border border-slate-100 min-h-[44px] flex items-center justify-between group-hover:bg-primary-50/30 transition-colors mt-2">
                                                    {activeTool === 'attendance_present' ? (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <input
                                                                type="number"
                                                                value={currentVal || ''}
                                                                max={termTotal}
                                                                onChange={(e) => handleRemarkChange(student.id, 'attendance_present', e.target.value)}
                                                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-primary-500"
                                                                placeholder="Present"
                                                            />
                                                            <span className="text-xs font-black text-slate-400">/ {termTotal || '--'}</span>
                                                        </div>
                                                    ) : activeTool === 'teacher_remark' ? (
                                                        <textarea
                                                            value={currentVal || ''}
                                                            onChange={(e) => handleRemarkChange(student.id, 'teacher_remark', e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-primary-500 min-h-[44px] resize-none"
                                                            placeholder="Enter remark..."
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={currentVal || ''}
                                                            onChange={(e) => handleRemarkChange(student.id, activeTool, e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-primary-500"
                                                            placeholder={`Enter ${activeTool.replace('_', ' ')}...`}
                                                        />
                                                    )}
                                                    {paintBrush && currentVal !== paintBrush && (
                                                        <div className="w-6 h-6 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                            <Check className="w-3 h-3 text-primary-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}                                    {classStudents.length === 0 && (
                                        <div className="col-span-full p-16 text-center text-slate-400 font-bold border-4 border-dashed border-slate-100 rounded-xl bg-white/50">
                                            {!selectedClass ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Filter className="w-8 h-8 text-slate-300" />
                                                    <p>Select a class to view students</p>
                                                </div>
                                            ) : !myAssignments.some(a => a.className.trim().toLowerCase() === selectedClass.trim().toLowerCase()) && (currentUser?.role || '').toLowerCase() === 'teacher' ? (
                                                <div className="flex flex-col items-center gap-2 text-orange-400">
                                                    <ShieldAlert className="w-8 h-8" />
                                                    <p>Assignment Check Failed: You don't appear to be assigned to {selectedClass}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-black px-4">Contact your school administrator to verify your class/subject records</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="w-8 h-8 text-slate-300" />
                                                    <p>No students found in {selectedClass}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : teacherTab === 'reports' ? (
                        (!selectedClass) ? (
                            <div className="p-12 text-center text-slate-500 bg-white border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                                <BookOpen className="w-12 h-12 text-slate-300" />
                                <p className="text-lg font-medium">Please select a Class to view reports.</p>
                            </div>
                        ) : (
                            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {classStudents.map(student => {
                                        const totalScore = results
                                            .filter(r => r.studentId === student.id)
                                            .reduce((sum, r) => sum + r.total, 0);
                                        const subjCount = results.filter(r => r.studentId === student.id).length;

                                        return (
                                            <div
                                                key={student.id}
                                                className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-primary-500/10 hover:border-primary-200 transition-all duration-300 flex flex-col justify-between"
                                            >
                                                <div className="flex items-center gap-4 mb-5">
                                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                                        {student.photo ? (
                                                            <img src={student.photo} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="bg-primary-50 w-full h-full flex items-center justify-center">
                                                                <User className="h-7 w-7 text-primary-300" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight group-hover:text-primary-700 transition-colors">{student.name}</h4>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-widest">ID: {student.id.substring(0, 6)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 mb-5">
                                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Marks</p>
                                                        <p className="text-sm font-black text-slate-700">{totalScore}</p>
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subjects</p>
                                                        <p className="text-sm font-black text-slate-700">{subjCount}</p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setReportStudent(student)}
                                                    className="w-full py-3 flex items-center justify-center gap-2 bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-primary-600 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-200 hover:shadow-primary-100 cursor-pointer"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> View Full Report
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {classStudents.length === 0 && (
                                        <div className="col-span-full p-16 text-center text-slate-400 font-bold border-4 border-dashed border-slate-100 rounded-3xl bg-white/50">
                                            {!selectedClass ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Filter className="w-8 h-8 text-slate-300" />
                                                    <p>Select a class to view students</p>
                                                </div>
                                            ) : !myAssignments.some(a => a.className.trim().toLowerCase() === selectedClass.trim().toLowerCase()) && (currentUser?.role || '').toLowerCase() === 'teacher' ? (
                                                <div className="flex flex-col items-center gap-2 text-orange-400">
                                                    <ShieldAlert className="w-8 h-8" />
                                                    <p>Assignment Check Failed: You don't appear to be assigned to {selectedClass}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-black px-4">Contact your school administrator to verify your class/subject records</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="w-8 h-8 text-slate-300" />
                                                    <p>No students found in {selectedClass}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
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
                                    {isNurseryLayout ? (
                                        <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
                                            {classStudents.map(student => {
                                                const currentVal = getExistingCompetency(student.id);
                                                const pending = pendingChanges[getPendingKey(student.id)];
                                                const dispVal = pending?.competencyStatus ?? currentVal;

                                                return (
                                                    <button
                                                        key={student.id}
                                                        onClick={() => {
                                                            if (paintBrush) {
                                                                handleScoreChange(student.id, 'competencyStatus', paintBrush);
                                                                handleScoreChange(student.id, 'classScore', '0');
                                                                handleScoreChange(student.id, 'examScore', '0');
                                                            }
                                                        }}
                                                        className={`text-left p-6 rounded-[2rem] border-2 transition-all flex flex-col justify-between group relative min-h-[140px] ${paintBrush && dispVal !== paintBrush ? 'hover:border-primary-400 hover:shadow-2xl hover:-translate-y-1 cursor-pointer active:scale-95' : 'cursor-default'} ${dispVal ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 border-dashed'} ${dispVal === paintBrush && paintBrush ? 'ring-8 ring-primary-50 border-primary-500 bg-primary-50/10' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="min-w-0 flex-1">
                                                                <h5 className="font-black text-slate-800 text-base uppercase tracking-tight truncate">{student.name}</h5>
                                                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-widest mt-1 inline-block">ID: {student.id.substring(0, 8)}</span>
                                                            </div>
                                                            {paintBrush && dispVal === paintBrush && (
                                                                <div className="h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                                                                    <Check className="w-4 h-4 stroke-[4px]" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${dispVal ? 'bg-primary-50/50 border border-primary-100 shadow-sm' : 'bg-white/50 border border-slate-100'}`}>
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-black leading-none ${dispVal ? 'text-primary-800' : 'text-slate-800'}`}>
                                                                    {dispVal || 'No performance status'}
                                                                </span>
                                                            </div>
                                                            {!paintBrush && !dispVal && (
                                                                <div className="text-[10px] font-black text-primary-500/50 uppercase tracking-tighter">Use Brush Tool →</div>
                                                            )}
                                                            {paintBrush && dispVal !== paintBrush && (
                                                                <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-sm">
                                                                    <Check className="w-4 h-4 text-primary-500 stroke-[3px]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="hidden md:block overflow-x-auto">
                                            {isAdmin && (
                                                <div className="bg-amber-50 p-4 border-b border-amber-100 flex items-center justify-center gap-2">
                                                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                                                    <span className="text-xs font-black text-amber-700 uppercase tracking-widest">Read-Only Mode (Administrator)</span>
                                                </div>
                                            )}
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
                                                    {(() => {
                                                        const ids = classStudents.map(s => s.id);
                                                        const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
                                                        if (duplicates.length > 0) {
                                                            console.warn("DEBUG Warning: Duplicate Student IDs found in this class:", duplicates);
                                                        }
                                                        return null;
                                                    })()}
                                                    {classStudents.map(student => {
                                                        const savedClass = getExistingScore(student.id, 'classScore');
                                                        const savedExam = getExistingScore(student.id, 'examScore');
                                                        const pending = pendingChanges[getPendingKey(student.id)];
                                                        const dispClass = pending?.classScore ?? savedClass;
                                                        const dispExam = pending?.examScore ?? savedExam;
                                                        const total = dispClass + dispExam;
                                                        const grade = getGrade(total);
                                                        return (
                                                            <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-6 py-3 font-medium text-slate-900">{student.name}</td>
                                                                {examConfig.grading_type !== 'COMPETENCY' && (
                                                                    <td className="px-6 py-3 text-center">
                                                                        <input
                                                                            type="number"
                                                                            value={dispClass || ''}
                                                                            onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                                                                            readOnly={isAdmin}
                                                                            className={`w-20 p-2 text-center border rounded-md outline-none ${isAdmin ? 'bg-slate-50 border-transparent text-slate-500 font-bold' : 'focus:border-primary-500 focus:ring-1 focus:ring-primary-500'}`}
                                                                        />
                                                                    </td>
                                                                )}
                                                                <td className="px-6 py-3 text-center">
                                                                    <input
                                                                        type="number"
                                                                        value={dispExam || ''}
                                                                        onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                                        readOnly={isAdmin}
                                                                        className={`w-20 p-2 text-center border rounded-md outline-none ${isAdmin ? 'bg-slate-50 border-transparent text-slate-500 font-bold' : 'focus:border-primary-500 focus:ring-1 focus:ring-primary-500'}`}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3 text-center font-bold">{total}</td>
                                                                <td className="px-6 py-3 text-center"><span className="font-bold text-slate-600">{grade}</span></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {classStudents.length === 0 && (
                                        <div className="p-20 text-center text-slate-400 font-bold border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50">
                                            {!selectedClass ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Filter className="w-8 h-8 text-slate-300" />
                                                    <p>Select a class to view subjects and students</p>
                                                </div>
                                            ) : !myAssignments.some(a => a.className.trim().toLowerCase() === selectedClass.trim().toLowerCase()) && (currentUser?.role || '').toLowerCase() === 'teacher' ? (
                                                <div className="flex flex-col items-center gap-2 text-orange-400">
                                                    <ShieldAlert className="w-8 h-8" />
                                                    <p>Access Mismatch: You are not assigned to {selectedClass}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-black">Verify your assignments in the Staff Directory</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="w-8 h-8 text-slate-300" />
                                                    <p>No students found in {selectedClass}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Bulk Paintbrush Info Panel for Marks tab */}
                                    {isNurseryLayout && paintBrush && (
                                        <div className="p-4 bg-primary-50 border-t border-primary-100 flex items-center justify-between sticky bottom-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-lg">
                                                    <PenTool className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Active Brush</p>
                                                    <p className="text-sm font-black text-slate-800">{paintBrush}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setPaintBrush('')}
                                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        classStudents.forEach(s => {
                                                            handleScoreChange(s.id, 'competencyStatus', paintBrush);
                                                            handleScoreChange(s.id, 'classScore', '0');
                                                            handleScoreChange(s.id, 'examScore', '0');
                                                        });
                                                        setPaintBrush('');
                                                    }}
                                                    className="px-6 py-2 bg-primary-600 text-white text-xs font-black uppercase rounded-lg shadow-lg hover:bg-primary-700 transition-all"
                                                >
                                                    Apply to All Students
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-5 p-4 bg-slate-50/50">
                                    {classStudents.map(student => {
                                        const pendingKey = getPendingKey(student.id);
                                        const pending = pendingChanges[pendingKey];
                                        const savedClass = getExistingScore(student.id, 'classScore');
                                        const savedExam = getExistingScore(student.id, 'examScore');
                                        const currentCompetency = getExistingCompetency(student.id);

                                        const dispClass = pending?.classScore ?? savedClass;
                                        const dispExam = pending?.examScore ?? savedExam;
                                        const dispCompetency = pending?.competencyStatus ?? currentCompetency;
                                        const total = dispClass + dispExam;
                                        const grade = getGrade(total);

                                        return (
                                            <div
                                                key={student.id}
                                                className={`p-5 bg-white rounded-2xl border-2 transition-all ${paintBrush ? 'border-primary-200 ring-4 ring-primary-50 ring-offset-0 shadow-lg scale-[1.02] cursor-cell' : 'border-slate-200 shadow-sm'}`}
                                                onClick={() => {
                                                    if (paintBrush && isNurseryLayout) {
                                                        handleScoreChange(student.id, 'competencyStatus', paintBrush);
                                                        handleScoreChange(student.id, 'classScore', '0');
                                                        handleScoreChange(student.id, 'examScore', '0');
                                                    }
                                                }}
                                            >
                                                <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-4">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-black text-slate-800 uppercase tracking-tight truncate text-sm">{student.name}</h4>
                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-widest mt-1 inline-block">ID: {student.id.substring(0, 6)}</span>
                                                    </div>
                                                    {!isNurseryLayout && (
                                                        <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                                                            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-lg shadow-sm">{total}</div>
                                                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Grade {grade}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 gap-4">
                                                    {isNurseryLayout ? (
                                                        <div className="space-y-3">
                                                            {paintBrush ? (
                                                                <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-between min-h-[100px] group ${dispCompetency === paintBrush ? 'bg-primary-50 border-primary-500' : 'bg-slate-50 border-slate-100 active:border-primary-400'}`}>
                                                                    <div className="flex items-center gap-3 py-2">
                                                                        <span className={`text-lg font-black ${dispCompetency === paintBrush ? 'text-primary-900' : 'text-slate-800'}`}>
                                                                            {dispCompetency === '90' ? 'Mastered' :
                                                                                dispCompetency === '70' ? 'Developing' :
                                                                                    dispCompetency === '40' ? 'Emerging' :
                                                                                        (dispCompetency || 'None')}
                                                                        </span>
                                                                        {dispCompetency !== paintBrush && (
                                                                            <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center animate-bounce-slow">
                                                                                <Check className="w-4 h-4 text-primary-500 stroke-[3px]" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${dispCompetency === paintBrush ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                                        {dispCompetency === paintBrush ? `✓ ${paintBrush}` : `Tap to Set: ${paintBrush}`}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    <select
                                                                        value={['90', '70', '40', '0', ''].includes(dispCompetency) ? dispCompetency : 'custom'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (val === 'custom') {
                                                                                handleScoreChange(student.id, 'competencyStatus', 'Improving...');
                                                                            } else {
                                                                                handleScoreChange(student.id, 'competencyStatus', val);
                                                                                handleScoreChange(student.id, 'examScore', '0');
                                                                            }
                                                                            handleScoreChange(student.id, 'classScore', '0');
                                                                        }}
                                                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-black text-slate-800 shadow-sm"
                                                                    >
                                                                        <option value="">Select Level...</option>
                                                                        {(reportConfig?.class_settings?.[selectedClass]?.qualitative_levels || []).map((level: string, lIdx: number) => (
                                                                            <option key={lIdx} value={level}>{level}</option>
                                                                        ))}
                                                                        {(!reportConfig?.class_settings?.[selectedClass]?.qualitative_levels || reportConfig?.class_settings?.[selectedClass]?.qualitative_levels.length === 0) && (
                                                                            <>
                                                                                <option value="Mastered">Mastered (Confident)</option>
                                                                                <option value="Developing">Developing (Steady)</option>
                                                                                <option value="Emerging">Emerging (Beginning)</option>
                                                                            </>
                                                                        )}
                                                                        <option value="custom">Custom Status...</option>
                                                                        <option value="0">Not Assessed</option>
                                                                    </select>
                                                                    {(!['90', '70', '40', 'Mastered', 'Developing', 'Emerging', '0', ''].includes(dispCompetency) || dispCompetency === 'Improving...') && (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Enter custom status..."
                                                                            value={dispCompetency}
                                                                            onChange={(e) => handleScoreChange(student.id, 'competencyStatus', e.target.value)}
                                                                            className="w-full p-4 bg-white border-2 border-primary-100 rounded-xl text-sm font-bold text-primary-700 shadow-sm shadow-primary-50/50"
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {examConfig.grading_type !== 'COMPETENCY' && (
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between items-center px-1">
                                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Class ({examConfig.weights?.class || 30})</label>
                                                                    </div>
                                                                    <input
                                                                        type="number"
                                                                        value={dispClass || ''}
                                                                        onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                                                                        className="w-full p-3 text-center font-black text-lg bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-50 outline-none transition-all"
                                                                        placeholder="-"
                                                                    />
                                                                </div>
                                                            )}
                                                            <div className={examConfig.grading_type === 'COMPETENCY' ? 'col-span-2' : 'space-y-1.5'}>
                                                                <div className="flex justify-between items-center px-1">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exam ({examConfig.weights?.exam || 70})</label>
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    value={dispExam || ''}
                                                                    onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                                    className="w-full p-3 text-center font-black text-lg bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-50 outline-none transition-all"
                                                                    placeholder="-"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {classStudents.length === 0 && (
                                        <div className="text-center text-slate-400 py-16 px-6 font-bold bg-white rounded-[2rem] border-4 border-dashed border-slate-50">
                                            {!selectedClass ? (
                                                <p>Please select a class</p>
                                            ) : !myAssignments.some(a => a.className.trim().toLowerCase() === selectedClass.trim().toLowerCase()) && (currentUser?.role || '').toLowerCase() === 'teacher' ? (
                                                <div className="space-y-2">
                                                    <ShieldAlert className="w-6 h-6 mx-auto text-orange-300" />
                                                    <p className="text-sm">Assignment Required: {selectedClass}</p>
                                                </div>
                                            ) : (
                                                <p>No students found in {selectedClass}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )
                    )}

                    {/* Global Floating Action Button & Modal (available for marks-nursery or remarks) */}
                    {(teacherTab === 'remarks' || (teacherTab === 'marks' && isNurseryLayout && !!selectedSubject)) && (
                        <button
                            onClick={() => {
                                if (teacherTab === 'marks' && isNurseryLayout) setActiveTool('performance_status');
                                setIsPresetModalOpen(true);
                            }}
                            className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-primary-600 text-white p-4 rounded-full shadow-2xl shadow-primary-500/50 hover:bg-primary-700 hover:scale-105 transition-all z-40 flex items-center justify-center group animate-bounce-slow border-2 border-white/20"
                        >
                            <PenTool className="w-7 h-7" />
                            <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
                                Open {teacherTab === 'marks' ? 'Assessment' : 'Brush'} Palette
                            </span>
                        </button>
                    )}

                    {isPresetModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-end md:items-center justify-center p-4 backdrop-blur-sm transition-opacity" onClick={(e) => { if (e.target === e.currentTarget) setIsPresetModalOpen(false); }}>
                            <div className="bg-white w-full max-w-sm rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh] mb-4 md:mb-0">
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
                                        {(activeTool === 'performance_status' ?
                                            (reportConfig?.class_settings?.[selectedClass]?.qualitative_levels?.length > 0 ?
                                                reportConfig.class_settings[selectedClass].qualitative_levels :
                                                ['Mastered', 'Developing', 'Emerging']
                                            ) :
                                            (activeTool === 'teacher_remark' ? allPresets : activeTool === 'conduct' ? conductPresets : interestPresets)
                                        ).map((preset: string, idx: number) => (
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

                {reportStudent && (
                    <ReportCard
                        student={students.find(s => s.id === reportStudent.id)!}
                        results={getPrefilledResults(reportStudent)}
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
                    <button onClick={() => { setActiveTab('monitoring'); setSelectedClass(''); }} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                        <ClipboardCheck className="w-4 h-4" /> <span className="hidden sm:inline">2. Submission Tracking</span><span className="sm:hidden">Status</span>
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

                        {/* Attendance Source Toggle */}
                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 px-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:border-primary-100 group">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-primary-500" />
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Attendance Settings</h4>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Choose how attendance figures are populated on report cards</p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                    {localConfig.attendance_mode === 'manual' && (
                                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">Total Term Days:</label>
                                            <input
                                                type="number"
                                                value={localConfig.term_total_days || 0}
                                                onChange={e => setLocalConfig({ ...localConfig, term_total_days: Number(e.target.value) })}
                                                className="w-16 p-1 border border-slate-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-primary-600 outline-none"
                                            />
                                        </div>
                                    )}
                                    <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1 w-full sm:w-auto">
                                        {[
                                            { id: 'manual', label: 'Manual' },
                                            { id: 'system', label: 'Attendance Table' }
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                onClick={() => setLocalConfig({ ...localConfig, attendance_mode: mode.id as any })}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-1 sm:flex-none ${localConfig.attendance_mode === mode.id ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-300'}`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
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
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${currentLayout === 'nursery' ? 'bg-blue-100 text-blue-700' :
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
                                                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${currentLayout === layout.id
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

            {/* Step 2: Submission Tracking */}
            {activeTab === 'monitoring' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Submission Monitoring</h3>
                        <p className="text-sm text-slate-500 font-medium tracking-wide italic">Click a class to see subjects, then click a subject to view submitted marks.</p>
                    </div>

                    <div className="space-y-3">
                        {availableClasses.map((className: string) => {
                            // Primary source should be the school's configured subject-to-class assignments
                            const classConf = (subjectAssignments || []).filter((sa: any) => {
                                const cls = Array.isArray(sa.classes) ? sa.classes[0] : sa.classes;
                                return cls?.name?.trim().toLowerCase() === className.trim().toLowerCase();
                            });

                            const classSubs = classConf.map(sa => {
                                const subj = Array.isArray(sa.subjects) ? sa.subjects[0] : sa.subjects;
                                const subjName = subj?.name;
                                // Find all teachers assigned to this specific pair (Class Teacher + Subject Teachers)
                                const teachers = (allAssignments || []).filter((a: any) =>
                                    a.class_name?.trim().toLowerCase() === className.trim().toLowerCase() &&
                                    (
                                        a.subject_name?.trim().toLowerCase() === subjName?.trim().toLowerCase() ||
                                        a.subject_name === null // Map class teachers to all subjects for oversight
                                    )
                                ).map((a: any) => a.teacher_name).filter(Boolean);

                                const teacherLabel = teachers.length > 0 ? [...new Set(teachers)].join(', ') : 'Unassigned';

                                // Find current submission status
                                const statusEntry = (submissionOverview || []).find((s: any) =>
                                    s.class_name?.trim().toLowerCase() === className.trim().toLowerCase() &&
                                    s.subject_name?.trim().toLowerCase() === subjName?.trim().toLowerCase()
                                );

                                return {
                                    subject_name: subjName,
                                    status: statusEntry?.status || 'Pending',
                                    teacherName: teacherLabel
                                };
                            });

                            const submittedCount = classSubs.filter((s: any) => s.status === 'Submitted').length;
                            const totalCount = classSubs.length || 0;
                            const isClassExpanded = expandedMonitoringClass === className;

                            return (
                                <div key={className} className={`bg-white rounded-2xl border transition-all ${isClassExpanded ? 'border-primary-200 shadow-md ring-4 ring-primary-50/50' : 'border-slate-200 shadow-sm hover:border-primary-100 hover:shadow-md'}`}>
                                    {/* Class Header (The "Drop Down" trigger) */}
                                    <button
                                        onClick={() => {
                                            setExpandedMonitoringClass(isClassExpanded ? null : className);
                                            setSelectedClass(className);
                                            setSelectedSubject('');
                                        }}
                                        className={`w-full p-5 flex items-center justify-between text-left group ${isClassExpanded ? 'border-b border-primary-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black transition-all ${isClassExpanded ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600'}`}>
                                                <Users className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg">{className}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${submittedCount === totalCount && totalCount > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {submittedCount} / {totalCount} Done
                                                    </span>
                                                    {isClassExpanded && <span className="text-[10px] font-black text-primary-500 uppercase animate-pulse">Select a subject below</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${isClassExpanded ? 'rotate-180 bg-primary-50 text-primary-600' : 'bg-slate-50 text-slate-300'}`}>
                                            <ChevronDown className="w-5 h-5" />
                                        </div>
                                    </button>

                                    {/* Subject List (The "Dropped Down" content) */}
                                    {isClassExpanded && (
                                        <div className="p-4 bg-slate-50/50 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {classSubs.map((sub: any, idx: number) => {
                                                    const isSubSubmitted = sub.status === 'Submitted';
                                                    const isSelected = selectedSubject === sub.subject_name;

                                                    return (
                                                        <div key={idx} className="flex flex-col gap-2">
                                                            <button
                                                                onClick={() => setSelectedSubject(isSelected ? '' : sub.subject_name)}
                                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected ? 'bg-white border-primary-500 shadow-lg -translate-y-1' : 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-md shadow-sm'}`}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`h-3 w-3 rounded-full shrink-0 shadow-sm ${isSubSubmitted ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                                                                    <div className="min-w-0">
                                                                        <span className="font-black text-slate-800 text-xs block truncate uppercase tracking-tight">{sub.subject_name}</span>
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{sub.teacherName}</p>
                                                                    </div>
                                                                </div>
                                                                <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${isSubSubmitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                    {isSubSubmitted ? 'Submitted' : sub.status}
                                                                </div>
                                                            </button>

                                                            {/* Nested Results Preview */}
                                                            {isSelected && (
                                                                <div className="lg:col-span-full bg-white rounded-2xl border border-primary-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 mt-2">
                                                                    <div className="bg-primary-50 p-3 border-b border-primary-100 flex items-center justify-between">
                                                                        <span className="text-[10px] font-black text-primary-700 uppercase tracking-widest flex items-center gap-2">
                                                                            <ShieldAlert className="w-3.5 h-3.5" /> Read-Only Mark Sheet - {sub.subject_name}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleResetSubjectMarks(className, sub.subject_name)}
                                                                                className="text-[9px] font-black uppercase px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" /> Reset Marks
                                                                            </button>
                                                                            <button onClick={() => setSelectedSubject('')} className="p-1 hover:bg-primary-100 rounded text-primary-500"><X className="w-4 h-4" /></button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                                                        <table className="w-full text-left border-collapse">
                                                                            <thead className="bg-slate-50 sticky top-0 z-10">
                                                                                <tr>
                                                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Student Name</th>
                                                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 w-24">Class</th>
                                                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 w-24">Exam</th>
                                                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-800 uppercase tracking-widest text-center border-b border-slate-100 w-24 font-bold">Total</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100">
                                                                                {classStudents.map(student => {
                                                                                    const savedClass = getExistingScore(student.id, 'classScore');
                                                                                    const savedExam = getExistingScore(student.id, 'examScore');
                                                                                    const total = savedClass + savedExam;
                                                                                    return (
                                                                                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                                                            <td className="px-5 py-2.5 font-bold text-slate-700 text-[11px] uppercase truncate">{student.name}</td>
                                                                                            <td className="px-5 py-2.5 text-center"><span className="text-[11px] font-black text-slate-400">{savedClass}</span></td>
                                                                                            <td className="px-5 py-2.5 text-center"><span className="text-[11px] font-black text-slate-400">{savedExam}</span></td>
                                                                                            <td className="px-5 py-2.5 text-center"><span className="text-[11px] font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">{total}</span></td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                        {classStudents.length === 0 && (
                                                                            <div className="p-10 text-center text-slate-300 font-black uppercase text-[10px] italic">No students found</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {availableClasses.length === 0 && (
                            <div className="p-20 text-center bg-white rounded-3xl border-4 border-dashed border-slate-100">
                                <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-400">No Target Classes Found</h3>
                                <p className="text-sm text-slate-300">Set up your target classes in the Configuration tab first.</p>
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
                                            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded">
                                                {(students as Student[]).filter(s => s.class?.trim().toLowerCase() === cls.trim().toLowerCase()).length} Students
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setViewingClassList(cls); setSelectedClass(cls); }} className="flex-1 py-2 text-xs font-bold text-primary-700 bg-primary-50 rounded hover:bg-primary-100 transition-colors">View Reports</button>
                                            <button
                                                onClick={() => {
                                                    const classCount = (students as Student[]).filter(s => s.class?.trim().toLowerCase() === cls.trim().toLowerCase()).length;
                                                    const phoneCount = (students as Student[]).filter(s => s.class?.trim().toLowerCase() === cls.trim().toLowerCase() && s.parent_phone && s.parent_phone.length >= 9).length;
                                                    setReleaseModalData({ className: cls, studentCount: classCount, validPhones: phoneCount });
                                                }}
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
                                    {(students as Student[]).filter(s => s.class?.trim().toLowerCase() === viewingClassList?.trim().toLowerCase()).map((student) => (
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
                        results={getPrefilledResults(reportStudent)}
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
                            {(students as Student[]).filter(s => s.class === viewingClassList).map((student) => {
                                // Optionally recalculate rank inline if we could, but right now we pass null or fetch it
                                // For bulk print, rank isn't strictly requested per single report, or it may default to '-'
                                // If needed, we'd pre-calculate an array of ranks.
                                return (
                                    <ReportCard
                                        key={student.id}
                                        student={student}
                                        results={getPrefilledResults(student)}
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
            {isLevelArchiveOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Status Archive</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{selectedClass} Custom Levels</p>
                            </div>
                            <button onClick={() => setIsLevelArchiveOpen(false)} className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newLevelName}
                                        onChange={e => setNewLevelName(e.target.value)}
                                        placeholder="Add new level (e.g. Excellent)"
                                        className="flex-1 p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-primary-400"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newLevelName) {
                                                const currentLevels = localConfig?.report_card_config?.class_settings?.[selectedClass]?.qualitative_levels || [];
                                                const updatedLevels = [...currentLevels, newLevelName];
                                                const newConf = {
                                                    ...localConfig,
                                                    report_card_config: {
                                                        ...localConfig.report_card_config,
                                                        class_settings: {
                                                            ...(localConfig.report_card_config?.class_settings || {}),
                                                            [selectedClass]: {
                                                                ...(localConfig.report_card_config?.class_settings?.[selectedClass] || {}),
                                                                qualitative_levels: updatedLevels
                                                            }
                                                        }
                                                    }
                                                };
                                                setLocalConfig(newConf);
                                                saveConfigMutation.mutate(newConf);
                                                setNewLevelName('');
                                            }
                                        }}
                                        className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
                                    >
                                        <PlusCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                    {(localConfig?.report_card_config?.class_settings?.[selectedClass]?.qualitative_levels || []).map((lvl: string, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                                            <span className="text-sm font-bold text-slate-700">{lvl}</span>
                                            <button
                                                onClick={() => {
                                                    const currentLevels = localConfig?.report_card_config?.class_settings?.[selectedClass]?.qualitative_levels || [];
                                                    const updatedLevels = currentLevels.filter((_: any, i: number) => i !== idx);
                                                    const newConf = {
                                                        ...localConfig,
                                                        report_card_config: {
                                                            ...localConfig.report_card_config,
                                                            class_settings: {
                                                                ...(localConfig.report_card_config?.class_settings || {}),
                                                                [selectedClass]: {
                                                                    ...(localConfig.report_card_config?.class_settings?.[selectedClass] || {}),
                                                                    qualitative_levels: updatedLevels
                                                                }
                                                            }
                                                        }
                                                    };
                                                    setLocalConfig(newConf);
                                                    saveConfigMutation.mutate(newConf);
                                                }}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {(!localConfig?.report_card_config?.class_settings?.[selectedClass]?.qualitative_levels || localConfig.report_card_config.class_settings[selectedClass].qualitative_levels.length === 0) && (
                                        <div className="text-center py-10">
                                            <Archive className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No custom levels yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                These levels will appear in your dropdown for <span className="text-slate-900">{selectedClass}</span>.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
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