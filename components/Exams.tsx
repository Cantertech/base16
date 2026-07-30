import React, { useState, useEffect, useRef } from 'react';
import ToastProvider, { useToast } from './Toast';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings,
    Lock, Unlock, PlayCircle, StopCircle, Eye, Send, Users, X, Loader2,
    MessageSquare, Plus, Check, Calendar, PlusCircle, PenTool, Archive, Trash2, ShieldAlert, Upload
} from 'lucide-react';
import ReportCard from './ReportCard';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { ExamsProvider, ExamsContextValue } from './ExamsContext';
import { ExamsTeacherView } from './ExamsTeacherView';
import { ExamSetupPanel } from './ExamSetupPanel';
import { ExamMonitoringPanel } from './ExamMonitoringPanel';
import { ExamPublishingPanel } from './ExamPublishingPanel';

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
        .ilike('term', term?.trim())
        .ilike('academic_year', year?.trim());

    if (className) query = query.ilike('class', className.trim());
    if (subjectName) query = query.ilike('subject', subjectName.trim());

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

const fetchResultsByStudent = async (schoolId: string, studentId: string, term: string, year: string) => {
    const { data, error } = await supabase
        .from('exam_results')
        .select('*, students(name)')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .ilike('term', term)
        .ilike('academic_year', year);

    if (error) {
        console.error('DEBUG: fetchResultsByStudent Error:', error);
        return [];
    }

    return data ? data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.students?.name,
        class: r.class,
        subject: r.subject,
        term: r.term,
        academic_year: r.academic_year,
        classScore: r.class_score,
        exam_score: r.exam_score,
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
        .select('is_class_teacher, class_id, classes(name), subject_id, subjects(name)')
        .eq('teacher_id', teacherId);

    if (!data) return [];
    return data.map((a: any) => ({
        className: a.classes?.name,
        subjectName: a.subjects?.name,
        isClassTeacher: a.is_class_teacher
    }));
};

const fetchStudentRank = async (schoolId: string, studentId: string, term: string, year: string, className: string) => {
    try {
        console.log(`DEBUG Rank Request: studentId=${studentId}, class=${className}, term=${term}, year=${year}`);
        const { data, error } = await supabase.rpc('get_student_class_rank', {
            p_school_id: schoolId,
            p_class: (className || '').trim().toUpperCase(),
            p_term: (term || '').trim().toUpperCase(),
            p_year: (year || '').trim().toUpperCase(),
            p_student_id: studentId
        });
        
        if (error) {
            console.error('DEBUG Rank Error (Supabase):', error);
            return null;
        }

        console.log('DEBUG Rank Raw Data:', data);
        
        if (data && Array.isArray(data) && data.length > 0) {
            const result = data[0];
            return { 
                position: result.student_position, 
                total: result.total_students 
            };
        }
        
        return null;
    } catch (e) {
        console.error('DEBUG Rank Error (Catch):', e);
        return null;
    }
};


const EMPTY_ARRAY: any[] = [];

// --- Main Component ---
const ExamsInner: React.FC<ExamsProps> = ({ currentUser, activeModules }) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Admin Tabs: 'setup', 'publishing'
    const [activeTab, setActiveTab] = useState<'setup' | 'publishing'>('setup');
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);


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
    const [teacherTab, setTeacherTab] = useState<'marks' | 'remarks' | 'standings'>('marks');
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

    const { data: subjectAssignmentsData } = useQuery({
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
    const subjectAssignments = subjectAssignmentsData || EMPTY_ARRAY;

    const { data: examConfig, isLoading: isConfigLoading } = useQuery({
        queryKey: ['examConfig', schoolId],
        queryFn: () => fetchExamConfig(schoolId!, schoolInfo?.exam_config),
        enabled: !!schoolId && !!schoolInfo
    });

    const { data: allClassesDataRaw } = useQuery({
        queryKey: ['classNames', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId
    });
    const allClassesData = allClassesDataRaw || EMPTY_ARRAY;

    const { data: allSubjectsData } = useQuery({
        queryKey: ['subjectNames', schoolId],
        queryFn: () => fetchSubjects(schoolId!),
        enabled: !!schoolId
    });
    const allSubjects = allSubjectsData || EMPTY_ARRAY;

    // Fetch Class/Subject assignments for teachers (Robustness improvement)
    const { data: myAssignmentsData } = useQuery({
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

            return Array.from(combined.values()).map(a => ({
                ...a,
                className: a.className.trim().toUpperCase(),
                subjectName: a.subjectName ? a.subjectName.trim().toUpperCase() : null
            }));
        },
        enabled: !!currentUser?.id && !!schoolId,
        staleTime: 60 * 1000
    });
    const myAssignments = myAssignmentsData || EMPTY_ARRAY;

    const { data: studentsDataRaw, isLoading: isLoadingStudents, isError: isStudentError, refetch: refetchStudents } = useQuery<Student[]>({
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
    const students = studentsDataRaw || EMPTY_ARRAY;

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

    const { data: resultsData } = useQuery({
        queryKey: ['examResults', schoolId, currentTerm?.toUpperCase(), currentYear?.toUpperCase(), selectedClass?.toUpperCase()],
        queryFn: () => fetchResults(
            schoolId!, 
            currentTerm?.toUpperCase(), 
            currentYear?.toUpperCase(),
            selectedClass, 
            undefined // Fetch all subjects for the class to support summaries/reports
        ),
        enabled: !!schoolId && !!examConfig && !!selectedClass,
        staleTime: 5 * 60 * 1000
    });
    const results = resultsData || EMPTY_ARRAY;

    if (results.length > 0 && selectedClass && selectedSubject) {
        console.log(`DEBUG Results: Found ${results.length} records for ${selectedClass}. Checking for ${selectedSubject}...`);
    }

    const { data: reportResultsRawData } = useQuery({
        queryKey: ['reportResults', schoolId, reportStudent?.id, currentTerm?.toUpperCase(), currentYear?.toUpperCase()],
        queryFn: () => fetchResultsByStudent(schoolId!, reportStudent!.id, currentTerm?.toUpperCase(), currentYear?.toUpperCase()),
        enabled: !!schoolId && !!reportStudent && !!currentTerm && !!currentYear
    });
    const reportResultsRaw = reportResultsRawData || EMPTY_ARRAY;

    // Dedicated query for Class-wide results (used for bulk printing/class reports)
    const { data: classResultsRawData } = useQuery({
        queryKey: ['classResults', schoolId, viewingClassList, currentTerm?.toUpperCase(), currentYear?.toUpperCase()],
        queryFn: () => fetchResults(
            schoolId!, 
            currentTerm?.toUpperCase(), 
            currentYear?.toUpperCase(), 
            viewingClassList, 
            undefined
        ),
        enabled: !!schoolId && !!viewingClassList && !!currentTerm && !!currentYear
    });
    const classResultsRaw = classResultsRawData || EMPTY_ARRAY;

    const { data: submissionOverviewData } = useQuery({
        queryKey: ['submissionOverview', schoolId, currentTerm, currentYear],
        queryFn: () => fetchSubmissionOverview(schoolId!, currentTerm, currentYear),
        enabled: !!schoolId && !!examConfig && ((currentUser?.role || '').toLowerCase().includes('admin')),
        refetchInterval: 30 * 1000, // Poll every 30s so admin sees teacher submissions without a reload
        staleTime: 0,
    });
    const submissionOverview = submissionOverviewData || EMPTY_ARRAY;

    const { data: allAssignmentsDataRaw } = useQuery({
        queryKey: ['allAssignments', schoolId],
        queryFn: async () => {
            if (!schoolId) return [];

            // 1. Fetch from teacher_assignments (Specific assignments)
            const { data: q1 } = await supabase
                .from('teacher_assignments')
                .select('classes(name), subjects(name), teachers(name)')
                .eq('school_id', schoolId);

            // 2. Fetch from subject_assignments (Standard school config)
            const { data: q2 } = await supabase
                .from('subject_assignments')
                .select('classes(name), subjects(name)')
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
                const tObj = getVal(d.teachers);
                combined.push({
                    class_name: cls?.name,
                    subject_name: subj?.name,
                    teacher_name: tObj?.name
                });
            });

            // Add Subject Assignments mappings
            q2?.forEach((d: any) => {
                const cls = getVal(d.classes);
                const subj = getVal(d.subjects);
                // q2 in this schema doesn't have a teacher, so we skip teacher_name assignment here
                // or it will be filtered out as intended if we only want mapped teachers.
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
    const allAssignments = allAssignmentsDataRaw || EMPTY_ARRAY;

    const { data: releasedClassesData } = useQuery({
        queryKey: ['releasedClasses', schoolId, currentTerm],
        queryFn: () => fetchReleasedClasses(schoolId!, currentTerm),
        enabled: !!schoolId && !!examConfig && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
    });
    const releasedClasses = releasedClassesData || EMPTY_ARRAY;

    // Calculate class-wide ranks for bulk printing
    const classRanks = React.useMemo(() => {
        if (!classResultsRaw || classResultsRaw.length === 0) return {};
        
        // Group by studentId and calculate totals
        const totals: Record<string, number> = {};
        classResultsRaw.forEach((r: any) => {
            if (!r.studentId) return;
            if (!totals[r.studentId]) totals[r.studentId] = 0;
            totals[r.studentId] += Number(r.total || 0);
        });

        // Sort by total score descending
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const ranks: Record<string, { position: number, total: number }> = {};
        const totalStudents = sorted.length;

        let lastScore = -1;
        let lastRank = 0;

        sorted.forEach(([studentId, score], index) => {
            if (score !== lastScore) {
                lastRank = index + 1; // Standard competition ranking (1, 2, 2, 4...)
                lastScore = score;
            }
            ranks[studentId] = { position: lastRank, total: totalStudents };
        });

        return ranks;
    }, [classResultsRaw]);

    const { data: studentRank } = useQuery({
        queryKey: ['studentRank', schoolId, reportStudent?.id, currentTerm?.toUpperCase(), currentYear?.toUpperCase(), reportStudent?.class?.toUpperCase()],
        queryFn: async () => {
            const res = await fetchStudentRank(
                schoolId!, 
                reportStudent!.id, 
                currentTerm?.toUpperCase(), 
                currentYear?.toUpperCase(), 
                reportStudent!.class?.toUpperCase() || ''
            );
            console.log("DEBUG: Student Rank Response:", res);
            return res;
        },
        enabled: !!schoolId && !!reportStudent && !!currentTerm && !!currentYear,
        staleTime: 5 * 60 * 1000
    });

    // --- Derived State (Teachers) ---
    // Local Config State (Moved here to fix scoping issue)
    const [localConfig, setLocalConfig] = useState<any>(null);
    useEffect(() => {
        if (examConfig) setLocalConfig(examConfig);
    }, [examConfig]);
    const availableClasses: string[] = allClassesData && allClassesData.length > 0
        ? allClassesData
        : (Array.isArray(localConfig?.target_classes)
            ? localConfig.target_classes
            : (localConfig?.target_classes || '').split(',').map((c: string) => c.trim()).filter(Boolean));

    // Calculate if user has Class Teacher privileges for the current class
    const isClassTeacher = (currentUser?.role || '').toLowerCase().includes('admin') ||
        (currentUser?.assignedClass?.trim().toLowerCase() === selectedClass.trim().toLowerCase()) ||
        myAssignments.some((a: any) => a.isClassTeacher && (a.className?.trim().toLowerCase() === selectedClass?.trim().toLowerCase()));

    // Auto-switch away from protected tabs if access is lost (e.g. switched to a class where only a subject teacher)
    useEffect(() => {
        if (!isClassTeacher && (teacherTab === 'remarks' || teacherTab === 'standings')) {
            setTeacherTab('marks');
        }
    }, [isClassTeacher, teacherTab]);

    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

    useEffect(() => {
        if (currentUser?.role === 'teacher') {
            // Teacher: filter subjects
            if (selectedClass) {
                const classAssignment = myAssignments.filter((a: any) => a.className?.trim().toUpperCase() === selectedClass.trim().toUpperCase());
                const isClassTeacher = (currentUser?.role || '').toLowerCase().includes('admin') ||
                    (currentUser?.assignedClass?.trim().toUpperCase() === selectedClass.trim().toUpperCase()) ||
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

    // FIX 1: Auto-select subject for teachers who only teach one subject in the selected class
    useEffect(() => {
        if (currentUser?.role !== 'teacher' || !selectedClass || selectedSubject) return;
        // Find subjects this teacher is specifically assigned to for this class
        const assignedSubjects = myAssignments
            .filter((a: any) => a.className?.trim().toUpperCase() === selectedClass.trim().toUpperCase() && a.subjectName)
            .map((a: any) => a.subjectName as string);
        if (assignedSubjects.length === 1) {
            setSelectedSubject(assignedSubjects[0]);
        } else if (assignedSubjects.length === 0 && availableSubjects.length === 1) {
            // Fallback: only one subject available for class
            setSelectedSubject(availableSubjects[0]);
        }
    }, [currentUser, selectedClass, selectedSubject, myAssignments, availableSubjects]);

    // FIX 2: beforeunload guard — warn if there are unsaved marks or remarks
    useEffect(() => {
        const hasUnsaved = Object.keys(pendingChanges).length > 0 || Object.keys(pendingRemarks).length > 0;
        if (!hasUnsaved) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [pendingChanges, pendingRemarks]);


    // --- Mutations ---
    const saveConfigMutation = useMutation({
        mutationFn: async (newConfig: any) => {
            console.log("MUTATING EXAM CONFIG - FINAL PAYLOAD:", JSON.stringify(newConfig, null, 2));
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
            // Instantly update the local query cache to trigger immediate UI reflection without reload
            queryClient.setQueryData(['examConfig', schoolId], newConfig);
            queryClient.setQueryData(['schoolInfo', schoolId], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    exam_config: newConfig,
                    report_card_config: newConfig.report_card_config || old.report_card_config
                };
            });

            // Set localConfig state directly to reflect it instantly in UI without requiring refresh
            setLocalConfig(newConfig);

            queryClient.invalidateQueries({ queryKey: ['examConfig', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['schoolInfo', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['examResults'] });
            queryClient.invalidateQueries({ queryKey: ['reportCards'] });
            toast('success', 'Configuration Saved', 'Exam configuration saved successfully!');
        },
        onError: (error: any) => {
            toast('error', 'Save Failed', error.message);
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
            toast('error', 'Update Failed', 'Could not update mark entry status. Please try again.');
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
            toast('success', 'Marks Submitted', 'Your marks have been submitted to the admin.');
            queryClient.invalidateQueries({ queryKey: ['submissionOverview', schoolId] });
        },
        onError: (e: any) => {
            toast('error', 'Submission Failed', e.message);
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
            toast('success', 'Marks Cleared', 'Subject marks have been reset to zero.');
        },
        onError: (e: any) => {
            console.error("Reset Failed:", e);
            toast('error', 'Reset Failed', e.message);
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
            toast('warning', 'Results Released', 'Results released, but SMS notifications failed. Check your SMS balance.');
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
            toast('error', 'Publish Failed', error.message);
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
            toast('error', 'Save Failed', error.message);
        }
    });

    const { data: allReportCardsData } = useQuery({
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
    const allReportCards = allReportCardsData || EMPTY_ARRAY;

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
            toast('success', 'Remarks Saved', 'All remarks have been saved successfully.');
        },
        onError: (e: any) => {
            toast('error', 'Save Failed', e.message);
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
        if (!selectedClass) { toast('warning', 'No Class Selected', 'Please select a class before saving remarks.'); return; }
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
    const [isUploadingImage, setIsUploadingImage] = useState<string | null>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'signature_url' | 'stamp_url') => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploadingImage(fieldName);
            
            // 1. Process Image (Resize & Minify)
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 350; 
                        const scale = MAX_WIDTH / img.width;
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scale;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/png', 0.8));
                    };
                    img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
            });

            // 2. Convert Base64 back to Blob for storage upload
            const response = await fetch(base64);
            const blob = await response.blob();

            // 3. Upload to Supabase Storage
            const fileExt = 'png';
            const fileName = `${schoolId}/${fieldName}_${Date.now()}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from('student-photos') // Reusing available bucket from schema
                .upload(fileName, blob, { upsert: true, contentType: 'image/png' });

            if (error) throw error;

            // 4. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('student-photos')
                .getPublicUrl(fileName);

            // 5. Update Config
            setLocalConfig((prev: any) => ({
                ...prev,
                report_card_config: {
                    ...(prev?.report_card_config || {}),
                    [fieldName]: publicUrl
                }
            }));

            toast('success', 'Upload Successful', `${fieldName === 'signature_url' ? 'Signature' : 'Stamp'} uploaded successfully!`);
        } catch (err: any) {
            console.error("Upload error:", err);
            toast('error', 'Upload Failed', err.message);
        } finally {
            setIsUploadingImage(null);
        }
    };

    const handleSaveConfig = (newConfig?: any) => {
        const configToSave = newConfig || examConfig;

        // Validation: Ensure grading ranges do not overlap
        if (configToSave.grading && Array.isArray(configToSave.grading)) {
            const sorted = [...configToSave.grading].sort((a, b) => a.min - b.min);
            for (let i = 0; i < sorted.length; i++) {
                const current = sorted[i];

                // 1. Min should be <= Max
                if (current.min > current.max) {
                    toast('error', 'Invalid Range', `Grade ${current.grade}: Min score (${current.min}) cannot be greater than Max score (${current.max}).`);
                    return;
                }

                // 2. Check overlap with next
                if (i < sorted.length - 1) {
                    const next = sorted[i + 1];
                    if (current.max >= next.min) {
                        toast('error', 'Overlapping Ranges', `Grade ${current.grade} (up to ${current.max}) overlaps with Grade ${next.grade} (from ${next.min}). Please fix the score ranges.`);
                        return;
                    }
                }
            }
        }

        // Validation: Weights must add to exactly 100
        const totalWeight = (configToSave.weights?.class || 0) + (configToSave.weights?.exam || 0);
        if (totalWeight !== 100) {
            toast('error', 'Invalid Weights', `Class and Exam scores must add up to exactly 100%. Current total: ${totalWeight}%.`);
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
                toast('success', 'Results Released', 'Results released & SMS notifications sent to parents!');
            } else {
                toast('success', 'Results Released', `Results published successfully for ${className}.`);
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
        const cleanClass = (selectedClass || '').trim().toUpperCase();
        const cleanSubj = (selectedSubject || '').trim().toUpperCase();
        const cleanStudentId = (studentId || '').trim();

        const match = results.find(r => {
            const rStudentId = (r.studentId || '').trim();
            const rSubj = (r.subject || '').trim().toUpperCase();
            const rClass = (r.class || '').trim().toUpperCase();
            
            return rStudentId === cleanStudentId && rSubj === cleanSubj && rClass === cleanClass;
        });

        if (match) {
            const status = (match as any).competency_status || '';
            console.log(`DEBUG [CompetencyCheck]: MATCH FOUND for ${studentId} -> ${status}`);
            return status;
        }
        return '';
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
        if (!selectedClass || !selectedSubject) {
            toast('warning', 'Selection Required', 'Please select both a Class and Subject before submitting.');
            return;
        }

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

    const getPrefilledResults = (student: any, sourceResults?: Result[]) => {
        if (!student) return [];

        // 1. Get existing results for this student from the provided source or global results
        const baseResults = sourceResults || results;
        const studentResults = baseResults.filter((r: Result) => r.studentId === student.id);

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
    // Refactored to separate component

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


    const contextValue: ExamsContextValue = {
        currentUser,
        schoolId,
        isAdmin,
        activeModules,
        schoolInfo,
        examConfig,
        localConfig,
        setLocalConfig,
        students,
        results,
        submissionOverview,
        releasedClasses,
        subjectAssignments,
        allAssignments,
        myAssignments,
        allReportCards,
        availableClasses,
        availableSubjects,
        classStudents,
        isClassTeacher,
        selectedClass,
        setSelectedClass,
        selectedSubject,
        setSelectedSubject,
        expandedMonitoringClass,
        setExpandedMonitoringClass,
        viewingClassList,
        setViewingClassList,
        reportStudent,
        setReportStudent,
        releaseModalData,
        setReleaseModalData,
        isBulkPrinting,
        isLevelArchiveOpen,
        setIsLevelArchiveOpen,
        newLevelName,
        setNewLevelName,
        isUploadingImage,
        pendingChanges,
        setPendingChanges,
        pendingRemarks,
        setPendingRemarks,
        teacherTab,
        setTeacherTab,
        activeTool,
        setActiveTool,
        paintBrush,
        setPaintBrush,
        userPresets,
        setUserPresets,
        conductPresets,
        setConductPresets,
        interestPresets,
        setInterestPresets,
        newPresetValue,
        setNewPresetValue,
        isPresetModalOpen,
        setIsPresetModalOpen,
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        saveConfigMutation,
        toggleMarkEntryMutation,
        publishResultsMutation,
        saveMarksMutation,
        submitMarksMutation,
        saveBulkRemarksMutation,
        resetSubjectMarksMutation: clearMarksMutation,
        handleSaveConfig,
        handleConfirmRelease,
        handleSubmitMarks,
        handleResetSubjectMarks,
        saveMarks,
        saveBulkRemarks,
        handleScoreChange,
        handleRemarkChange,
        getExistingScore,
        getExistingCompetency,
        getGrade,
        getPendingKey,
        getLayoutForClass,
        handleImageUpload,
        getPrefilledResults,
        triggerBulkPrint,
        bulkPrintRef,
        reportResultsRaw,
        classResultsRaw,
        studentRank,
        classRanks,
        currentTerm,
        currentYear
    };

    if (!localConfig && (activeTab === 'setup')) return <Loader2 className="animate-spin" />;

    return (
        <ExamsProvider value={contextValue}>
            {((currentUser?.role || '').toLowerCase() === 'teacher') ? (
                <ExamsTeacherView />
            ) : (
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
                            <button onClick={() => setActiveTab('publishing')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'publishing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Send className="w-4 h-4" /> <span className="hidden sm:inline">2. Publish & Reports</span><span className="sm:hidden">Publish</span>
                            </button>
                        </div>
                    </div>

                    {/* Modular Panels */}
                    <ExamSetupPanel />
                    <ExamPublishingPanel />
                </div>
            )}

            {/* Hidden Bulk Print Container */}
            {isBulkPrinting && viewingClassList && (
                <div style={{ display: 'none' }}>
                    <div ref={bulkPrintRef} className="print:block">
                        <style dangerouslySetInnerHTML={{__html: `
                            @media print {
                                .print-page-wrapper {
                                    page-break-after: right !important;
                                    break-after: right !important;
                                    display: block !important;
                                    width: 100% !important;
                                }
                                .print-page-wrapper:last-child {
                                    page-break-after: avoid !important;
                                    break-after: avoid !important;
                                }
                            }
                        `}} />
                        {(students as Student[]).filter(s => s.class === viewingClassList).map((student) => (
                            <div key={student.id} className="print-page-wrapper">
                                <ReportCard
                                    student={student}
                                    results={getPrefilledResults(student, classResultsRaw)}
                                    schoolConfig={{
                                        ...schoolInfo,
                                        ...localConfig,
                                        term_total_days: localConfig?.term_total_days
                                    }}
                                    onClose={() => { }}
                                    position={classRanks[student.id] || null}
                                    schoolId={schoolId}
                                    activeModules={activeModules}
                                    printMode={true}
                                    savedReportData={allReportCards.find((rc: any) => rc.student_id === student.id)}
                                />
                            </div>
                        ))}
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
        </ExamsProvider>
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

// Wrap ExamsInner with ToastProvider so useToast() works inside
const Exams: React.FC<ExamsProps> = (props) => (
    <ToastProvider>
        <ExamsInner {...props} />
    </ToastProvider>
);

export default Exams;