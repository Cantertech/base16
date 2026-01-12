import React, { useState, useEffect } from 'react';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings,
    Lock, Unlock, PlayCircle, StopCircle, Eye, Send, Users, X, Loader2
} from 'lucide-react';
import ReportCard from './ReportCard';
import { supabase } from '../utils/supabaseClient';

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

// --- Main Component ---
const Exams: React.FC<ExamsProps> = ({ currentUser }) => {
    // Admin Tabs: 'setup', 'monitoring', 'publishing'
    const [activeTab, setActiveTab] = useState<'setup' | 'monitoring' | 'publishing'>('setup');

    // Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [submissionOverview, setSubmissionOverview] = useState<any[]>([]);

    // --- RELEASE STATUS STATE ---
    const [releasedClasses, setReleasedClasses] = useState<string[]>([]);

    // Config Data
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);

    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [allSubjects, setAllSubjects] = useState<string[]>([]); // Master list of subjects

    // Teacher Assignments State
    const [myAssignments, setMyAssignments] = useState<any[]>([]);

    // Mark Entry / Filter State
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Editing State
    const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number }>>({});

    // Modals
    const [reportStudent, setReportStudent] = useState<Student | null>(null);
    // --- New State for Report Flow ---
    const [viewingClassList, setViewingClassList] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState<string | null>(null);
    const [viewingSubmission, setViewingSubmission] = useState<any>(null);
    const [studentRank, setStudentRank] = useState<{ position: number, total: number } | null>(null);

    // --- Loading States ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);


    // --- Config Logic ---
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

    const defaultExamConfig = {
        exam_name: "End of Term 1 Exam",
        current_term: "First Term",
        next_term_reopens: "", // New Field for Reopening Date
        academic_year: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        status: 'SETUP', // SETUP, OPEN, LOCKED
        mark_entry_enabled: true,
        target_classes: [] as string[],
        target_subjects: [] as string[],
        weights: { class: 30, exam: 70 },
        grading_type: 'STANDARD',
        grading: gradingPresets.STANDARD
    };

    const [examConfig, setExamConfig] = useState<any>(defaultExamConfig);
    const [schoolInfo, setSchoolInfo] = useState<any>({});

    // Load Data
    useEffect(() => {
        fetchData();
    }, []);

    // Effect to update options based on selection (Teacher)
    useEffect(() => {
        if (currentUser?.role === 'teacher' && myAssignments.length > 0) {
            // Update available subjects based on selected class
            if (selectedClass) {
                const classAssignment = myAssignments.filter(a => a.className === selectedClass);
                const isClassTeacher = classAssignment.some(a => a.isClassTeacher);

                if (isClassTeacher) {
                    // Class teacher sees subjects configured for exam, OR all subjects if not restricted
                    if (examConfig.target_subjects && examConfig.target_subjects.length > 0) {
                        setAvailableSubjects(examConfig.target_subjects);
                    } else {
                        setAvailableSubjects(allSubjects);
                    }
                } else {
                    const assignedSubjects = classAssignment.map(a => a.subjectName).filter(Boolean);
                    setAvailableSubjects(assignedSubjects);
                }
            }
        }
    }, [selectedClass, myAssignments, examConfig, allSubjects]);

    // Fetch Rank Effect
    useEffect(() => {
        if (reportStudent && currentUser?.school_id) {
            const fetchRank = async () => {
                const { data, error } = await supabase.rpc('get_student_class_rank', {
                    p_school_id: currentUser.school_id,
                    p_class: reportStudent.class,
                    p_term: examConfig.current_term,
                    p_year: examConfig.academic_year,
                    p_student_id: reportStudent.id
                });
                if (data) {
                    setStudentRank({ position: data.position, total: data.total_students });
                }
            };
            fetchRank();
        } else {
            setStudentRank(null);
        }
    }, [reportStudent, currentUser?.school_id, examConfig.current_term, examConfig.academic_year]);

    const fetchData = async () => {
        try {
            // 1. Fetch School Config & Exam Config
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
                const schoolId = currentUser?.school_id || profile?.school_id;

                if (schoolId) {
                    const { data: schoolData, error: scError } = await supabase
                        .from('schools')
                        .select('*')
                        .eq('id', schoolId)
                        .single();

                    if (scError) throw scError;

                    if (schoolData) {
                        setSchoolInfo({
                            name: schoolData.name,
                            logo_url: schoolData.logo_url,
                            address: schoolData.address,
                            phone: schoolData.phone,
                            email: schoolData.email,
                            motto: schoolData.motto
                        });

                        if (schoolData.exam_config) {
                            setExamConfig({ ...defaultExamConfig, ...schoolData.exam_config });
                        }
                    }

                    // 1b. Fetch Exam Config Table (Source of Truth for Toggle & synced fields)
                    const { data: configData } = await supabase.from('exam_config').select('*').eq('school_id', schoolId).single();

                    let effectiveTerm = schoolData?.exam_config?.current_term || 'First Term';
                    let effectiveYear = schoolData?.exam_config?.academic_year || new Date().getFullYear() + "/" + (new Date().getFullYear() + 1);
                    let effectiveEnabled = schoolData?.exam_config?.mark_entry_enabled || false;

                    if (configData) {
                        // Start with what was likely synced, but trust the TABLE for these specific fields if present
                        // Use table data for synced fields, but fallback to JSON config for year if missing in table
                        if (configData.current_term) effectiveTerm = configData.current_term;
                        // academic_year might not exist in exam_config table, so only update if present and truthy
                        if (configData.academic_year) effectiveYear = configData.academic_year;
                        if (configData.mark_entry_enabled !== undefined) effectiveEnabled = configData.mark_entry_enabled;

                        setExamConfig(prev => ({
                            ...prev,
                            mark_entry_enabled: effectiveEnabled,
                            current_term: effectiveTerm,
                            academic_year: effectiveYear
                        }));
                    }


                    // 2. Fetch Classes & Subjects (for Config)
                    const { data: classesData } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
                    if (classesData) setAvailableClasses(classesData.map(c => c.name));

                    const { data: subjectsData } = await supabase.from('subjects').select('name').eq('school_id', schoolId).order('name');
                    if (subjectsData) {
                        const subs = subjectsData.map(s => s.name);
                        setAvailableSubjects(subs);
                        setAllSubjects(subs);
                    }

                    // 3. Fetch Students
                    const { data: studentsData } = await supabase.from('students').select('*').eq('school_id', schoolId);
                    if (studentsData) {
                        setStudents(studentsData.map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            class: s.class,
                            attendance: 100, // Mock
                            photo: s.photo_url
                        })));
                    }

                    // 4. Fetch Results (Filtered by EFFECTIVE term/year)
                    const { data: resultsData } = await supabase
                        .from('exam_results')
                        .select('*, students(name)')
                        .eq('school_id', schoolId)
                        .eq('term', effectiveTerm)
                        .eq('academic_year', effectiveYear);

                    if (resultsData) {
                        setResults(resultsData.map((r: any) => ({
                            id: r.id,
                            studentId: r.student_id,
                            studentName: r.students?.name || 'Unknown',
                            class: r.class,
                            subject: r.subject,
                            classScore: r.class_score,
                            examScore: r.exam_score,
                            total: r.total
                        })));
                    }

                    // 5a. Fetch Submission Overview (Admin)
                    if ((currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && schoolId) {
                        const { data: subs, error: subError } = await supabase.rpc('get_exam_submission_overview_v3', {
                            p_school_id: schoolId,
                            p_term: effectiveTerm,
                            p_year: effectiveYear
                        });
                        if (subError) console.error("Submission Overview Error:", subError);
                        if (subs) setSubmissionOverview(subs);

                        // 5b. Fetch Released Classes Status
                        const { data: releasedData } = await supabase
                            .from('exam_report_status')
                            .select('class_name')
                            .eq('school_id', schoolId)
                            .eq('status', 'Released')
                            .eq('term', effectiveTerm); // Check for current term specifically

                        if (releasedData) {
                            // Normalize to handle potential case/whitespace issues from DB
                            setReleasedClasses(releasedData.map(r => r.class_name.trim().toLowerCase()));
                        }
                    }
                }
            }

            // 6. Fetch Teacher Assignments (Teacher only)
            if (currentUser?.role === 'teacher') {
                const { data: assignments } = await supabase
                    .from('teacher_assignments')
                    .select('is_class_teacher, classes(name), subjects(name)')
                    .eq('teacher_id', currentUser.id);

                if (assignments) {
                    const normalized = assignments.map((a: any) => ({
                        className: a.classes?.name,
                        subjectName: a.subjects?.name,
                        isClassTeacher: a.is_class_teacher
                    }));
                    setMyAssignments(normalized);

                    // Set Initial Class Selection
                    const distinctClasses = [...new Set(normalized.map(a => a.className).filter(Boolean))];
                    if (distinctClasses.length > 0 && !selectedClass) {
                        setSelectedClass(distinctClasses[0]);
                    }
                }
            } else {
                // Admin default selection
                if (!selectedClass && availableClasses.length > 0) setSelectedClass(availableClasses[0]);
            }

        } catch (e: any) {
            console.error('Error fetching data:', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConfig = async (newConfig: any = examConfig) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            const schoolId = currentUser?.school_id || profile?.school_id;
            if (!schoolId) return;

            // Use RPC to save to both schools table (JSON) and exam_config table (Columns)
            const { error } = await supabase.rpc('save_exam_config', {
                p_school_id: schoolId,
                p_config: newConfig
            });

            if (error) throw error;

            setExamConfig(newConfig);
            // Reload data to ensure results match new term/year
            fetchData();
            alert('Exam configuration saved successfully!');
        } catch (error: any) {
            console.error('Error saving config:', error);
            alert(`Failed to save configuration: ${error.message}`);
        }
    };

    // --- New Toggle Logic ---
    const toggleMarkEntry = async (enable: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            const schoolId = currentUser?.school_id || profile?.school_id;

            const { error } = await supabase.rpc('toggle_mark_entry', { target_school_id: schoolId, enable });
            if (error) throw error;

            setExamConfig(prev => ({ ...prev, mark_entry_enabled: enable, status: enable ? 'OPEN' : 'LOCKED' }));
            // Also update legacy config for backward compatibility
            handleSaveConfig({ ...examConfig, status: enable ? 'OPEN' : 'LOCKED' });

        } catch (e: any) {
            console.error("Error toggling entry:", e);
            alert("Failed to update status");
        }
    };

    const publishResults = async (className: string) => {
        if (!confirm(`Are you sure you want to release results for ${className}? This will notify all parents.`)) return;

        setIsPublishing(className);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            const schoolId = currentUser?.school_id || profile?.school_id;

            const { error } = await supabase.rpc('publish_class_results', {
                target_school_id: schoolId,
                target_class: className,
                p_term: examConfig.current_term
            });

            if (error) throw error;

            // Optimistically update released state
            setReleasedClasses(prev => [...prev, className.trim().toLowerCase()]);

            alert(`Results for ${className} have been released successfully!`);

        } catch (e: any) {
            console.error("Error publishing:", e, e.details);
            alert(`Failed to publish results: ${e.message}`);
        } finally {
            setIsPublishing(null);
        }
    }


    // --- Mark Entry Logic (Teacher) ---
    const handleScoreChange = (studentId: string, field: 'classScore' | 'examScore', value: string) => {
        // Restriction removed: Entry is always open
        // if (!examConfig.mark_entry_enabled && currentUser?.role !== 'admin') return;

        let numValue = Number(value);
        const maxClass = examConfig.weights?.class || 30;
        const maxExam = examConfig.weights?.exam || 70;

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
        const res = results.find(r =>
            r.studentId === studentId &&
            r.class === selectedClass &&
            r.subject === selectedSubject
        );
        return res ? res[field] : 0;
    };

    const saveMarks = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            const schoolId = currentUser?.school_id || profile?.school_id;
            if (!schoolId) throw new Error('No school associated with user');

            // Prepare Results for Upsert
            const updates = Object.entries(pendingChanges).map(([studentId, val]: [string, { classScore: number; examScore: number }]) => {
                return {
                    school_id: schoolId,
                    student_id: studentId,
                    class: selectedClass,
                    subject: selectedSubject,
                    term: examConfig.current_term,
                    academic_year: examConfig.academic_year,
                    class_score: val.classScore,
                    exam_score: val.examScore
                };
            });

            if (updates.length > 0) {
                const { error: resultError } = await supabase
                    .from('exam_results')
                    .upsert(updates, { onConflict: 'student_id,class,subject,term,academic_year' });

                if (resultError) throw resultError;
            }

            // Refresh & Reset
            fetchData();
            setPendingChanges({});
            // alert('Marks saved successfully!'); // Removed alert for smoother UX
        } catch (error: any) {
            console.error('Error saving marks:', error);
            alert(`Failed to save marks: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const getGrade = (total: number) => {
        if (examConfig.grading) {
            const grade = examConfig.grading.find((g: any) => total >= g.min && total <= g.max);
            return grade ? grade.grade : 'F';
        }
        return 'F';
    };

    // --- Filtered Lists ---
    const classStudents = students.filter(s => s.class === selectedClass);
    const filteredStudents = classStudents.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmitMarks = async () => {
        if (!selectedClass || !selectedSubject) return alert("Select Class and Subject");

        // Auto-save: If there are unsaved changes, save them first!
        if (Object.keys(pendingChanges).length > 0) {
            await saveMarks();
        }

        if (!confirm(`Submit marks for ${selectedSubject} (${selectedClass})? This signals you are done.`)) return;

        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            const schoolId = currentUser?.school_id || profile?.school_id;

            const { error } = await supabase.rpc('submit_exam_marks_v3', {
                p_school_id: schoolId,
                p_class: selectedClass,
                p_subject: selectedSubject,
                p_term: examConfig.current_term,
                p_year: examConfig.academic_year
            });

            if (error) throw error;
            alert("Marks submitted successfully to Admin.");
        } catch (e: any) {
            console.error(e);
            alert("Submission failed: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- TEACHER VIEW ---
    if (currentUser?.role === 'teacher') {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Loading exam data...</p>
                </div>
            );
        }

        return (
            <div className="p-4 md:p-8 space-y-4 md:space-y-8 h-full pb-20 md:pb-0 overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Mark Entry</h1>
                        <p className="text-slate-500 text-sm">
                            {examConfig.exam_name} • {examConfig.current_term}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Current Year: {examConfig.academic_year || 'Not Set'}
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
                                    {myAssignments.map((a, i) => <option key={i} value={a.className}>{a.className}</option>)}
                                    {myAssignments.length === 0 && <option value="">No Classes</option>}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-48">
                                    <option value="">Select Subject</option>
                                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={saveMarks}
                                disabled={Object.keys(pendingChanges).length === 0 || isSaving || isSubmitting}
                                className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-slate-800 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {isSaving ? 'Saving...' : 'Save Draft'}
                            </button>
                            <button
                                onClick={handleSubmitMarks}
                                disabled={isSaving || isSubmitting}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                {isSubmitting ? 'Submitting...' : 'Submit to Admin'}
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

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-slate-100 bg-white border border-slate-200 border-t-0 rounded-b-xl shadow-sm">
                                {classStudents.map(student => {
                                    const savedClass = getExistingScore(student.id, 'classScore');
                                    const savedExam = getExistingScore(student.id, 'examScore');
                                    const pending = pendingChanges[student.id];
                                    const dispClass = pending?.classScore ?? savedClass;
                                    const dispExam = pending?.examScore ?? savedExam;
                                    const total = dispClass + dispExam;
                                    const grade = getGrade(total);
                                    return (
                                        <div key={student.id} className="p-4 bg-white">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">Total: {total}</span>
                                                    <span className={`text-[10px] font-bold mt-1 uppercase ${grade === 'F' ? 'text-red-500' : 'text-green-600'}`}>Grade: {grade}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {examConfig.grading_type !== 'COMPETENCY' && (
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class ({examConfig.weights?.class || 30})</label>
                                                        <input
                                                            type="number"
                                                            value={dispClass || ''}
                                                            onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                                                            className="w-full p-3 border border-slate-200 rounded-lg text-center font-bold text-slate-800 text-lg focus:border-primary-500 outline-none"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                )}
                                                <div className={examConfig.grading_type === 'COMPETENCY' ? 'col-span-2' : ''}>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Exam ({examConfig.weights?.exam || 70})</label>
                                                    <input
                                                        type="number"
                                                        value={dispExam || ''}
                                                        onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                        className="w-full p-3 border border-slate-200 rounded-lg text-center font-bold text-slate-800 text-lg focus:border-primary-500 outline-none"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {classStudents.length === 0 && <div className="p-8 text-center text-slate-400 italic text-sm">No students in this class yet.</div>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // --- ADMIN VIEW ---
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
                    <button
                        onClick={() => setActiveTab('setup')}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'setup' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Settings className="w-4 h-4" /> <span className="hidden sm:inline">1. Configuration</span><span className="sm:hidden">Setup</span>
                    </button>
                    <div className="w-px bg-slate-300 my-2 mx-1 hidden sm:block"></div>
                    <button
                        onClick={() => setActiveTab('monitoring')}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ClipboardCheck className="w-4 h-4" /> <span className="hidden sm:inline">2. Mark Entry</span><span className="sm:hidden">Entry</span>
                    </button>
                    <div className="w-px bg-slate-300 my-2 mx-1 hidden sm:block"></div>
                    <button
                        onClick={() => setActiveTab('publishing')}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'publishing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Send className="w-4 h-4" /> <span className="hidden sm:inline">3. Publish & Reports</span><span className="sm:hidden">Publish</span>
                    </button>
                </div>
            </div>

            {/* Step 1: Configuration */}
            {activeTab === 'setup' && (
                <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Exam Setup Details</h3>
                        <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
                                <input
                                    type="text"
                                    value={examConfig.exam_name}
                                    onChange={e => setExamConfig({ ...examConfig, exam_name: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Term & Year</label>
                                <div className="flex gap-2">
                                    <select
                                        value={examConfig.current_term}
                                        onChange={e => setExamConfig({ ...examConfig, current_term: e.target.value })}
                                        className="flex-1 p-2.5 border border-slate-300 rounded-lg bg-white"
                                    >
                                        <option>First Term</option>
                                        <option>Second Term</option>
                                        <option>Third Term</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={examConfig.academic_year}
                                        onChange={e => setExamConfig({ ...examConfig, academic_year: e.target.value })}
                                        className="flex-1 p-2.5 border border-slate-300 rounded-lg"
                                        placeholder="Year"
                                    />
                                </div>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Next Term Reopens</label>
                                <input
                                    type="date"
                                    value={examConfig.next_term_reopens || ''}
                                    onChange={e => setExamConfig({ ...examConfig, next_term_reopens: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                />
                            </div>
                        </div>

                        {/* Assessment Weights */}
                        <div className="pt-4 border-t border-slate-100">
                            <h4 className="text-sm font-bold text-slate-700 mb-3">Assessment Weights</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {examConfig.grading_type !== 'COMPETENCY' && (
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Class Score (%)</label>
                                        <input
                                            type="number"
                                            value={examConfig.weights.class}
                                            onChange={e => setExamConfig({ ...examConfig, weights: { ...examConfig.weights, class: Number(e.target.value) } })}
                                            className="w-full p-2 border border-slate-300 rounded-lg"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Exam Score (%)</label>
                                    <input
                                        type="number"
                                        value={examConfig.weights.exam}
                                        onChange={e => setExamConfig({ ...examConfig, weights: { ...examConfig.weights, exam: Number(e.target.value) } })}
                                        className="w-full p-2 border border-slate-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Target Selection */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Classes & Subjects</h3>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Participating Classes</label>
                                <div className="h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                    {availableClasses.map(cls => (
                                        <label key={cls} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={examConfig.target_classes?.includes(cls)}
                                                onChange={(e) => {
                                                    const current = examConfig.target_classes || [];
                                                    const updated = e.target.checked
                                                        ? [...current, cls]
                                                        : current.filter((c: string) => c !== cls);
                                                    setExamConfig({ ...examConfig, target_classes: updated });
                                                }}
                                                className="rounded text-primary-600"
                                            />
                                            <span className="text-sm text-slate-700">{cls}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Subjects Tested</label>
                                <div className="h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                    {availableSubjects.map(subj => (
                                        <label key={subj} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={examConfig.target_subjects?.includes(subj)}
                                                onChange={(e) => {
                                                    const current = examConfig.target_subjects || [];
                                                    const updated = e.target.checked
                                                        ? [...current, subj]
                                                        : current.filter((s: string) => s !== subj);
                                                    setExamConfig({ ...examConfig, target_subjects: updated });
                                                }}
                                                className="rounded text-primary-600"
                                            />
                                            <span className="text-sm text-slate-700">{subj}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Grading System */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Grading System</h3>
                                    <p className="text-sm text-slate-500">Choose a template or customize.</p>
                                </div>
                                <select
                                    value={examConfig.grading_type || 'STANDARD'}
                                    onChange={(e) => {
                                        const type = e.target.value as 'STANDARD' | 'COMPETENCY';
                                        if (confirm('Changing the grading system will update the assessment weights. Continue?')) {
                                            let newWeights = examConfig.weights;
                                            // Competency Based = 100% Exam (Theory), 0% Class
                                            if (type === 'COMPETENCY') {
                                                newWeights = { class: 0, exam: 100 };
                                            } else {
                                                newWeights = { class: 30, exam: 70 };
                                            }

                                            setExamConfig({
                                                ...examConfig,
                                                grading_type: type,
                                                grading: gradingPresets[type],
                                                weights: newWeights
                                            });
                                        }
                                    }}
                                    className="p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700"
                                >
                                    <option value="STANDARD">Standard Grading (A-F)</option>
                                    <option value="COMPETENCY">Competency Based (EE-BE)</option>
                                </select>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-12 gap-2 px-2 text-xs font-bold text-slate-500 uppercase">
                                    <div className="col-span-2">Grade</div>
                                    <div className="col-span-2">Min</div>
                                    <div className="col-span-2">Max</div>
                                    <div className="col-span-6">Remark</div>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {examConfig.grading.map((g: any, idx: number) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={g.grade}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].grade = e.target.value;
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-full p-1.5 text-center font-bold border border-slate-300 rounded focus:border-primary-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={g.min}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].min = Number(e.target.value);
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-full p-1.5 text-center border border-slate-300 rounded focus:border-primary-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={g.max}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].max = Number(e.target.value);
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-full p-1.5 text-center border border-slate-300 rounded focus:border-primary-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-6">
                                                <input
                                                    type="text"
                                                    value={g.remark}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].remark = e.target.value;
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-full p-1.5 border border-slate-300 rounded focus:border-primary-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={() => handleSaveConfig()}
                            className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-primary-700 transition-all flex items-center gap-2"
                        >
                            <Save className="w-5 h-5" /> Save Configuration
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Monitoring & Entry Status */}
            {activeTab === 'monitoring' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                    {/* Control Panel REMOVED as per request - Entry Always Open */}

                    {/* Teacher Submission Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Teacher Submissions Overview
                            </h3>
                        </div>
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
                                    {/* Mock Data for visual structure if empty */}
                                    {submissionOverview.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                                No submission data available yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        submissionOverview.map((sub, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 cursor-pointer group" onClick={() => setViewingSubmission(sub)}>
                                                <td className="px-6 py-3 font-medium text-slate-900 group-hover:text-primary-600 transition-colors">{sub.class_name}</td>
                                                <td className="px-6 py-3 text-slate-600">{sub.subject_name}</td>
                                                <td className="px-6 py-3 text-slate-600">{sub.teacher_name || 'Unassigned'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sub.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {sub.status || 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right text-xs text-slate-500">
                                                    {sub.updated_at ? new Date(sub.updated_at).toLocaleDateString() : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Admin Review Grid (Conditionally Rendered) */}
                    {viewingSubmission && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Reviewing: {viewingSubmission.subject_name} ({viewingSubmission.class_name})
                                </h3>
                                <button onClick={() => setViewingSubmission(null)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="overflow-x-auto p-4">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase w-1/3">Student Name</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Class</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Exam</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Total</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-24">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* Filter students for the viewed class */}
                                        {students.filter(s => s.class === viewingSubmission.class_name).map(student => {
                                            // Helper to get score for this SPECIFIC subject/class even if state selectedClass differs
                                            const res = results.find(r =>
                                                r.studentId === student.id &&
                                                r.class === viewingSubmission.class_name &&
                                                r.subject === viewingSubmission.subject_name
                                            );
                                            const classSc = res?.classScore || 0;
                                            const examSc = res?.examScore || 0;
                                            const total = classSc + examSc;

                                            // Grade Check
                                            const grade = examConfig.grading ? (examConfig.grading.find((g: any) => total >= g.min && total <= g.max)?.grade || 'F') : 'F';

                                            return (
                                                <tr key={student.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-3 font-medium text-slate-900">{student.name}</td>
                                                    <td className="px-6 py-3 text-center">{classSc}</td>
                                                    <td className="px-6 py-3 text-center">{examSc}</td>
                                                    <td className="px-6 py-3 text-center font-bold">{total}</td>
                                                    <td className="px-6 py-3 text-center"><span className="font-bold text-slate-600">{grade}</span></td>
                                                </tr>
                                            );
                                        })}
                                        {students.filter(s => s.class === viewingSubmission.class_name).length === 0 && <tr><td colSpan={5} className="p-4 text-center">No students found</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Publishing */}
            {activeTab === 'publishing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Class Reports</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {availableClasses.map(cls => {
                                const isReleased = releasedClasses.includes(cls.trim().toLowerCase());
                                return (
                                    <div key={cls} className="p-4 border border-slate-200 rounded-lg hover:border-primary-300 transition-all bg-slate-50 hover:bg-white group">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-slate-900">{cls}</h4>
                                            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded">
                                                {students.filter(s => s.class === cls).length} Students
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setViewingClassList(cls);
                                                    setSelectedClass(cls);
                                                }}
                                                className="flex-1 py-2 text-xs font-bold text-primary-700 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
                                            >
                                                View Reports
                                            </button>
                                            <button
                                                onClick={() => publishResults(cls)}
                                                disabled={isPublishing === cls || isReleased}
                                                className={`flex-1 py-2 text-xs font-bold text-white rounded transition-colors flex items-center justify-center gap-1 ${isPublishing === cls
                                                    ? 'bg-slate-500 cursor-not-allowed'
                                                    : isReleased
                                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                        : 'bg-slate-800 hover:bg-slate-900'
                                                    }`}
                                            >
                                                {isPublishing === cls ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Publishing...
                                                    </>
                                                ) : isReleased ? (
                                                    <>
                                                        <CheckCircle className="w-3 h-3" /> Released
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-3 h-3" /> Release
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Class List Modal */}
                    {viewingClassList && (
                        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl flex flex-col">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">Students in {viewingClassList}</h3>
                                        <p className="text-xs text-slate-500">Select a student to view their full report card.</p>
                                    </div>
                                    <button
                                        onClick={() => setViewingClassList(null)}
                                        className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto bg-slate-50/50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {students.filter(s => s.class === viewingClassList).map((student) => (
                                            <div key={student.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all group cursor-pointer" onClick={() => setReportStudent(student)}>
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100">
                                                        {student.photo ? (
                                                            <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <User className="h-6 w-6 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 group-hover:text-primary-700 transition-colors">{student.name}</h4>
                                                        <span className="text-xs text-slate-500">ID: {student.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                                    <span className="text-xs font-medium text-slate-500">
                                                        Status: <span className="text-green-600">Active</span>
                                                    </span>
                                                    <button className="text-xs font-bold text-primary-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                        View Report <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {students.filter(s => s.class === viewingClassList).length === 0 && (
                                        <div className="text-center py-12 text-slate-400">
                                            No students found in this class.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Report Preview Modal (Individual) */}
                    {reportStudent && (
                        <ReportCard
                            student={students.find(s => s.id === reportStudent.id)!}
                            results={results.filter(r => r.studentId === reportStudent.id)}
                            schoolConfig={{
                                ...schoolInfo,
                                ...examConfig,
                                grading: examConfig.grading // Ensure grading is explicitly passed if needed
                            }}
                            onClose={() => setReportStudent(null)}
                            position={studentRank}
                            schoolId={currentUser?.school_id}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default Exams;