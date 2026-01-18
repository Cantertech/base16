import React, { useState, useEffect } from 'react';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings,
    Lock, Unlock, PlayCircle, StopCircle, Eye, Send, Users, X, Loader2
} from 'lucide-react';
import ReportCard from './ReportCard';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
}

interface ExamsProps {
    currentUser?: {
        id: string;
        school_id: string;
        role: 'admin' | 'teacher';
        name: string;
        assignedClass?: string;
    };
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

const fetchExamConfig = async (schoolId: string, schoolDataConfig: any) => {
    const { data: configData } = await supabase.from('exam_config').select('*').eq('school_id', schoolId).single();

    // Default Config
    const gradingPresets = {
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
        grading: gradingPresets.STANDARD,
        ...schoolDataConfig
    };

    if (configData) {
        if (configData.current_term) baseConfig.current_term = configData.current_term;
        if (configData.academic_year) baseConfig.academic_year = configData.academic_year;
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
        photo: s.photo_url
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
const Exams: React.FC<ExamsProps> = ({ currentUser }) => {
    const queryClient = useQueryClient();

    // Admin Tabs: 'setup', 'monitoring', 'publishing'
    const [activeTab, setActiveTab] = useState<'setup' | 'monitoring' | 'publishing'>('setup');


    // UI/Filter State
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingClassList, setViewingClassList] = useState<string | null>(null);
    const [viewingSubmission, setViewingSubmission] = useState<any>(null);
    const [reportStudent, setReportStudent] = useState<Student | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number }>>({});



    const schoolId = currentUser?.school_id;

    // --- Queries ---
    const { data: schoolInfo, isLoading: isSchoolInfoLoading } = useQuery({
        queryKey: ['schoolInfo', schoolId],
        queryFn: () => fetchSchoolInfo(schoolId!),
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
        enabled: !!schoolId
    });

    // Fetches dependent on Config
    const currentTerm = examConfig?.current_term || 'First Term';
    const currentYear = examConfig?.academic_year || new Date().getFullYear().toString();

    const { data: results = [] } = useQuery({
        queryKey: ['examResults', schoolId, currentTerm, currentYear],
        queryFn: () => fetchResults(schoolId!, currentTerm, currentYear),
        enabled: !!schoolId && !!examConfig
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
            // Admin: see all subjects involved in exam (or just all subjects)
            if (examConfig?.target_subjects && examConfig.target_subjects.length > 0) {
                setAvailableSubjects(examConfig.target_subjects);
            } else {
                setAvailableSubjects(allSubjects);
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['releasedClasses', schoolId] });
            alert(`Results released successfully!`);
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
    const handleSaveConfig = (newConfig?: any) => saveConfigMutation.mutate(newConfig || examConfig);
    const toggleMarkEntry = (enable: boolean) => toggleMarkEntryMutation.mutate(enable);

    const publishResults = (className: string) => {
        if (!confirm(`Are you sure you want to release results for ${className}? This will notify all parents.`)) return;
        publishResultsMutation.mutate(className);
    };

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
        return (
            <div className="p-4 md:p-8 space-y-4 md:space-y-8 h-full pb-20 md:pb-0 overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Mark Entry</h1>
                        <p className="text-slate-500 text-sm">
                            {examConfig?.exam_name} • {currentTerm}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Current Year: {currentYear || 'Not Set'}
                        </p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center bg-slate-50">
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-32">
                                    {myAssignments.map((a: any, i: number) => <option key={i} value={a.className}>{a.className}</option>)}
                                    {myAssignments.length === 0 && <option value="">No Classes</option>}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-48">
                                    <option value="">Select Subject</option>
                                    {availableSubjects.map((s: any) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={saveMarks}
                                disabled={Object.keys(pendingChanges).length === 0 || saveMarksMutation.isPending || submitMarksMutation.isPending}
                                className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-slate-800 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saveMarksMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saveMarksMutation.isPending ? 'Saving...' : 'Save Draft'}
                            </button>
                            <button
                                onClick={handleSubmitMarks}
                                disabled={saveMarksMutation.isPending || submitMarksMutation.isPending}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitMarksMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                {submitMarksMutation.isPending ? 'Submitting...' : 'Submit to Admin'}
                            </button>
                        </div>
                    </div>

                    {(!selectedClass || !selectedSubject) ? (
                        <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm mt-4 flex flex-col items-center justify-center gap-3">
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
                            {/* Mobile Card View (Omitted for brevity - same logic as desktop) */}
                        </>
                    )}
                </div>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Term & Year</label>
                                <div className="flex gap-2">
                                    <select value={localConfig.current_term} onChange={e => setLocalConfig({ ...localConfig, current_term: e.target.value })} className="flex-1 p-2.5 border border-slate-300 rounded-lg bg-white">
                                        <option>First Term</option> <option>Second Term</option> <option>Third Term</option>
                                    </select>
                                    <input type="text" value={localConfig.academic_year} onChange={e => setLocalConfig({ ...localConfig, academic_year: e.target.value })} className="flex-1 p-2.5 border border-slate-300 rounded-lg" placeholder="Year" />
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs text-slate-500 mb-1">Class Score (%)</label><input type="number" value={localConfig.weights?.class || 0} onChange={e => setLocalConfig({ ...localConfig, weights: { ...localConfig.weights, class: Number(e.target.value) } })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
                                <div><label className="block text-xs text-slate-500 mb-1">Exam Score (%)</label><input type="number" value={localConfig.weights?.exam || 0} onChange={e => setLocalConfig({ ...localConfig, weights: { ...localConfig.weights, exam: Number(e.target.value) } })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Classes & Subjects</h3>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Participating Classes</label>
                                    <div className="h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                        {availableClasses.map((cls: string) => (
                                            <label key={cls} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                                <input type="checkbox" checked={localConfig.target_classes?.includes(cls)} onChange={(e) => {
                                                    const current = localConfig.target_classes || [];
                                                    const updated = e.target.checked ? [...current, cls] : current.filter((c: string) => c !== cls);
                                                    setLocalConfig({ ...localConfig, target_classes: updated });
                                                }} className="rounded text-primary-600" />
                                                <span className="text-sm text-slate-700">{cls}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Subjects Tested</label>
                                    <div className="h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                        {allSubjects.map((subj: string) => ( // Use allSubjects here for master list
                                            <label key={subj} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                                <input type="checkbox" checked={localConfig.target_subjects?.includes(subj)} onChange={(e) => {
                                                    const current = localConfig.target_subjects || [];
                                                    const updated = e.target.checked ? [...current, subj] : current.filter((s: string) => s !== subj);
                                                    setLocalConfig({ ...localConfig, target_subjects: updated });
                                                }} className="rounded text-primary-600" />
                                                <span className="text-sm text-slate-700">{subj}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={() => handleSaveConfig(localConfig)} disabled={saveConfigMutation.isPending} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-primary-700 transition-all flex items-center gap-2">
                                {saveConfigMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Monitoring */}
            {activeTab === 'monitoring' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Users className="w-4 h-4" /> Teacher Submissions Overview</h3></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Class</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Teacher</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Last Updated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {submissionOverview.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No submission data available yet.</td></tr>
                                    ) : (
                                        submissionOverview.map((sub: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50 cursor-pointer group" onClick={() => setViewingSubmission(sub)}>
                                                <td className="px-6 py-3 font-medium text-slate-900 group-hover:text-primary-600 transition-colors">{sub.class_name}</td>
                                                <td className="px-6 py-3 text-slate-600">{sub.subject_name}</td>
                                                <td className="px-6 py-3 text-slate-600">{sub.teacher_name || 'Unassigned'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sub.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{sub.status || 'Pending'}</span>
                                                </td>
                                                <td className="px-6 py-3 text-right text-xs text-slate-500">{sub.updated_at ? new Date(sub.updated_at).toLocaleDateString() : '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                                            <button onClick={() => publishResults(cls)} disabled={isReleased || publishResultsMutation.isPending} className={`flex-1 py-2 text-xs font-bold text-white rounded transition-colors flex items-center justify-center gap-1 ${isReleased ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'}`}>
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

            {/* Conditional Modals */}
            {viewingClassList && (
                <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div><h3 className="font-bold text-lg text-slate-800">Students in {viewingClassList}</h3></div>
                            <button onClick={() => setViewingClassList(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-6 h-6" /></button>
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
                />
            )}
        </div>
    );
};

export default Exams;