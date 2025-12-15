import React, { useState, useEffect } from 'react';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings
} from 'lucide-react';
import ReportCard from './ReportCard';
import ReviewModal from './ReviewModal';
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
}

interface Submission {
    id: string;
    class: string;
    subject: string;
    status: 'Pending' | 'Submitted' | 'Approved' | 'Rejected';
    teacherName: string;
    submittedDate?: string;
}

interface ExamsProps {
    currentUser?: {
        id: string;
        school_id: string;
        role: 'admin' | 'teacher';
        name: string;
    };
}

// --- Main Component ---
const Exams: React.FC<ExamsProps> = ({ currentUser }) => {
    // Admin Tabs: 'config', 'questions', 'approval'
    // Teacher Tabs: 'entry', 'history' (Defaulting to 'entry' for teacher view)
    const [activeTab, setActiveTab] = useState<'config' | 'questions' | 'approval'>('approval');

    // Approval View Sub-tabs
    const [approvalView, setApprovalView] = useState<'queue' | 'reports'>('queue');

    const [schoolConfig, setSchoolConfig] = useState<any>({});

    // Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);

    // Teacher Assignments State
    const [myAssignments, setMyAssignments] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

    // Mark Entry / Filter State
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Editing State
    const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number }>>({});

    // Modals
    const [reportStudent, setReportStudent] = useState<Student | null>(null);
    const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null);

    // --- Config Logic ---
    const defaultExamConfig = {
        current_term: "First Term",
        academic_year: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        weights: { class: 30, exam: 70 },
        grading: [
            { grade: "A", min: 80, max: 100, remark: "Excellent" },
            { grade: "B", min: 70, max: 79, remark: "Very Good" },
            { grade: "C", min: 60, max: 69, remark: "Good" },
            { grade: "D", min: 50, max: 59, remark: "Credit" },
            { grade: "E", min: 40, max: 49, remark: "Pass" },
            { grade: "F", min: 0, max: 39, remark: "Fail" }
        ]
    };

    const [examConfig, setExamConfig] = useState<any>(defaultExamConfig);

    // Load Data
    useEffect(() => {
        fetchData();
    }, []);

    // Effect to update options based on selection
    useEffect(() => {
        if (currentUser?.role === 'teacher' && myAssignments.length > 0) {
            // Update available subjects based on selected class
            if (selectedClass) {
                const classAssignment = myAssignments.filter(a => a.className === selectedClass);
                const isClassTeacher = classAssignment.some(a => a.isClassTeacher);

                if (isClassTeacher) {
                    setAvailableSubjects(allSubjects.map(s => s.name));
                } else {
                    const assignedSubjects = classAssignment.map(a => a.subjectName).filter(Boolean);
                    setAvailableSubjects(assignedSubjects);
                }
            }
        }
    }, [selectedClass, myAssignments, allSubjects]);

    const fetchData = async () => {
        // 1. Fetch Students
        try {
            const { data: studentsData, error: stError } = await supabase.from('students').select('*');
            if (stError) throw stError;
            if (studentsData) {
                setStudents(studentsData.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    class: s.class,
                    attendance: 100 // Mock for now
                })));
            }
        } catch (e: any) {
            console.error('Error fetching students:', e.message);
        }

        // 2. Fetch Results
        try {
            const { data: resultsData, error: resError } = await supabase
                .from('exam_results')
                .select('*, students(name)');

            if (resError) throw resError;
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
        } catch (e: any) {
            console.error('Error fetching results:', e.message);
        }

        // 3. Fetch Submissions
        try {
            const { data: submissionsData, error: subError } = await supabase
                .from('exam_submissions')
                .select('*');

            if (subError) throw subError;

            if (submissionsData) {
                // Fetch teacher profiles manually to avoid join issues
                // Filter for valid UUIDs only to prevent 400 errors if bad data exists
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

                const rawTeacherIds = [...new Set(submissionsData.map((s: any) => s.teacher_id).filter(Boolean))];
                const validTeacherIds = rawTeacherIds.filter(id => uuidRegex.test(id));

                if (rawTeacherIds.length !== validTeacherIds.length) {
                    console.warn('Found invalid teacher IDs in submissions:', rawTeacherIds.filter(id => !uuidRegex.test(id)));
                }

                let teacherMap: Record<string, string> = {};

                if (validTeacherIds.length > 0) {
                    try {
                        const { data: teachers, error: teacherError } = await supabase
                            .from('profiles')
                            .select('id, full_name')
                            .in('id', validTeacherIds);

                        if (teacherError) {
                            console.error('Error fetching teacher profiles:', teacherError);
                        } else if (teachers) {
                            teachers.forEach((t: any) => {
                                teacherMap[t.id] = t.full_name;
                            });
                        }
                    } catch (err: any) {
                        console.error('Exception fetching teacher profiles:', err);
                    }
                }

                setSubmissions(submissionsData.map((s: any) => ({
                    id: s.id,
                    class: s.class,
                    subject: s.subject,
                    status: s.status,
                    teacherName: teacherMap[s.teacher_id] || 'Unknown',
                    submittedDate: s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : undefined
                })));
            }
        } catch (e: any) {
            console.error('Error fetching submissions:', e.message);
        }

        // 4. Fetch Teacher Assignments (Teacher only)
        if (currentUser?.role === 'teacher') {
            try {
                // Fetch All Subjects first (robustness)
                const { data: subjects } = await supabase.from('subjects').select('name');
                if (subjects) setAllSubjects(subjects);

                // Try fetching assignments
                const { data: assignments, error: assignError } = await supabase
                    .from('teacher_assignments')
                    .select('is_class_teacher, classes(name), subjects(name)')
                    .eq('teacher_id', currentUser.id);

                if (assignError) throw assignError;

                if (assignments) {
                    const normalized = assignments.map((a: any) => ({
                        className: a.classes?.name,
                        subjectName: a.subjects?.name,
                        isClassTeacher: a.is_class_teacher
                    }));
                    setMyAssignments(normalized);

                    // Set Classes
                    const distinctClasses = [...new Set(normalized.map(a => a.className).filter(Boolean))];
                    if (distinctClasses.length > 0) {
                        setAvailableClasses(distinctClasses);
                        if (!selectedClass) setSelectedClass(distinctClasses[0]);
                    } else {
                        // Fallback if no classes assigned/found
                        setAvailableClasses([]);
                    }
                }
            } catch (e: any) {
                console.error('Error fetching teacher assignments:', e.message);
                // Fallback to basic list if error (e.g., table missing)
                setAvailableClasses(['JHS 1', 'JHS 2']);
            }
        } else {
            // Admin: Fetch Real Classes & Subjects
            const fetchAdminData = async () => {
                try {
                    // Classes
                    const { data: classesData, error: classError } = await supabase
                        .from('classes')
                        .select('name')
                        .order('name');

                    if (classError) throw classError;

                    if (classesData && classesData.length > 0) {
                        const classNames = classesData.map(c => c.name);
                        setAvailableClasses(classNames);
                        if (!selectedClass || !classNames.includes(selectedClass)) {
                            setSelectedClass(classNames[0]);
                        }
                    } else {
                        setAvailableClasses(['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4']);
                    }

                    // Subjects
                    const { data: subjectsData, error: subjError } = await supabase
                        .from('subjects')
                        .select('name')
                        .order('name');

                    if (subjError) throw subjError;

                    if (subjectsData && subjectsData.length > 0) {
                        const subjectNames = [...new Set(subjectsData.map(s => s.name))];
                        setAvailableSubjects(subjectNames);
                        if (!selectedSubject || !subjectNames.includes(selectedSubject)) {
                            setSelectedSubject(subjectNames[0]);
                        }
                    } else {
                        setAvailableSubjects(['Mathematics', 'English Language', 'Integrated Science', 'Social Studies', 'ICT', 'RME']);
                    }
                } catch (err: any) {
                    console.error("Error fetching admin data:", err.message);
                    // Fallbck
                    setAvailableClasses(['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4']);
                    setAvailableSubjects(['Mathematics', 'English Language', 'Integrated Science', 'Social Studies', 'ICT', 'RME']);
                }
            };
            fetchAdminData();
        }

        // 5. Fetch School Config (Admin only)
        if (currentUser?.role === 'admin') {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
                    if (profile?.school_id) {
                        const { data: schoolData, error: scError } = await supabase
                            .from('schools')
                            .select('*')
                            .eq('id', profile.school_id)
                            .single();

                        if (scError) throw scError;

                        if (schoolData) {
                            if (schoolData.exam_config) {
                                setExamConfig(schoolData.exam_config);
                            }
                            setSchoolConfig({
                                name: schoolData.name,
                                logo_url: schoolData.logo_url,
                                address: schoolData.address,
                                phone: schoolData.phone,
                                email: schoolData.email,
                                motto: schoolData.motto,
                                ...schoolData.exam_config
                            });
                        }
                    }
                }
            } catch (e: any) {
                console.error('Error fetching school config:', e.message);
            }
        }
    };

    const handleSaveConfig = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get school_id from profile if not passed in props (fallback)
            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            if (!profile?.school_id) return;

            const { error } = await supabase
                .from('schools')
                .update({ exam_config: examConfig })
                .eq('id', profile.school_id);

            if (error) throw error;
            alert('Exam configuration saved successfully!');
        } catch (error: any) {
            console.error('Error saving config:', error);
            alert('Failed to save configuration.');
        }
    };

    // --- Mark Entry Logic (Teacher) ---
    const handleScoreChange = (studentId: string, field: 'classScore' | 'examScore', value: string) => {
        let numValue = Number(value);
        // Use dynamic weights if available, else defaults
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
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single();

            if (!profile?.school_id) throw new Error('No school associated with user');

            // 1. Prepare Results for Upsert
            const updates = Object.entries(pendingChanges).map(([studentId, val]: [string, { classScore: number; examScore: number }]) => {
                return {
                    school_id: profile.school_id,
                    student_id: studentId,
                    class: selectedClass,
                    subject: selectedSubject,
                    class_score: val.classScore,
                    exam_score: val.examScore
                };
            });

            if (updates.length > 0) {
                const { error: resultError } = await supabase
                    .from('exam_results')
                    .upsert(updates, { onConflict: 'student_id,class,subject' });

                if (resultError) throw resultError;
            }

            // 2. Update Submission Status
            const submissionData = {
                school_id: profile.school_id,
                class: selectedClass,
                subject: selectedSubject,
                teacher_id: user.id,
                status: 'Submitted',
                submitted_at: new Date().toISOString()
            };

            const { error: subError } = await supabase
                .from('exam_submissions')
                .upsert(submissionData, { onConflict: 'school_id,class,subject' });

            if (subError) throw subError;

            // 3. Refresh & Reset
            fetchData();
            setPendingChanges({});
            alert('Marks saved and submitted for review!');

        } catch (error: any) {
            console.error('Error saving marks:', error);
            alert(`Failed to save marks: ${error.message}`);
        }
    };

    const getGrade = (total: number) => {
        // Use dynamic grading if available
        if (examConfig.grading) {
            const grade = examConfig.grading.find((g: any) => total >= g.min && total <= g.max);
            return grade ? grade.grade : 'F';
        }
        // Fallback
        if (total >= 80) return 'A';
        if (total >= 70) return 'B';
        if (total >= 60) return 'C';
        if (total >= 50) return 'D';
        return 'F';
    };

    // --- Admin Approval Logic ---
    const handleApproveSubmission = async () => {
        if (!reviewSubmission) return;
        try {
            const { error } = await supabase
                .from('exam_submissions')
                .update({ status: 'Approved' })
                .eq('id', reviewSubmission.id);

            if (error) throw error;

            fetchData();
            setReviewSubmission(null);
            alert(`${reviewSubmission.class} ${reviewSubmission.subject} results approved!`);
        } catch (error: any) {
            console.error('Error approving submission:', error);
            alert(`Failed to approve: ${error.message}`);
        }
    };

    const handleRejectSubmission = async (reason: string) => {
        if (!reviewSubmission) return;
        try {
            // Ideally we'd store the reason somewhere, maybe add a 'rejection_reason' column to submissions
            const { error } = await supabase
                .from('exam_submissions')
                .update({ status: 'Rejected' })
                .eq('id', reviewSubmission.id);

            if (error) throw error;

            fetchData();
            setReviewSubmission(null);
            alert(`Submission rejected. Teacher notified.`);
        } catch (error: any) {
            console.error('Error rejecting submission:', error);
            alert(`Failed to reject: ${error.message}`);
        }
    };

    // --- Report Generation Helper ---
    const getClassApprovalStatus = (className: string) => {
        const classSubs = submissions.filter(s => s.class === className);
        const approved = classSubs.filter(s => s.status === 'Approved');
        return {
            total: classSubs.length,
            approved: approved.length,
            isFullyApproved: classSubs.length > 0 && classSubs.length === approved.length
        };
    };

    // --- Filtered Lists ---
    const classStudents = students.filter(s => s.class === selectedClass);
    const filteredStudents = classStudents.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- TEACHER VIEW ---
    if (currentUser?.role === 'teacher') {
        return (
            <div className="p-8 space-y-8 h-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Mark Entry</h1>
                        <p className="text-slate-500 text-sm">Enter student marks and submit for approval.</p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center bg-slate-50">
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-32">
                                    {availableClasses.length > 0 ? (
                                        availableClasses.map(c => <option key={c} value={c}>{c}</option>)
                                    ) : (
                                        <option value="">No Classes Assigned</option>
                                    )}
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
                        <button onClick={saveMarks} disabled={Object.keys(pendingChanges).length === 0} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all disabled:opacity-50">
                            <Save className="h-4 w-4" /> Save & Submit
                        </button>
                    </div>
                    {/* Teacher Grid */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase w-1/3">Student Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Class ({examConfig.weights?.class || 30})</th>
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
                                            <td className="px-6 py-3 text-center"><input type="number" value={dispClass || ''} onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)} className="w-20 p-2 text-center border rounded-md" /></td>
                                            <td className="px-6 py-3 text-center"><input type="number" value={dispExam || ''} onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)} className="w-20 p-2 text-center border rounded-md" /></td>
                                            <td className="px-6 py-3 text-center font-bold">{total}</td>
                                            <td className="px-6 py-3 text-center"><span className="font-bold text-slate-600">{grade}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- ADMIN VIEW ---
    const approvalStatus = getClassApprovalStatus(selectedClass);

    return (
        <div className="p-8 space-y-8 relative h-full">
            {/* Admin Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Exam Management</h1>
                    <p className="text-slate-500 text-sm">Configure exams, manage approvals, and print reports.</p>
                </div>

                {/* Admin Tabs */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex gap-2 ${activeTab === 'config' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Settings className="h-4 w-4" /> Config
                    </button>
                    <button onClick={() => setActiveTab('questions')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex gap-2 ${activeTab === 'questions' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                        <BookOpen className="h-4 w-4" /> Question Bank
                    </button>
                    <button onClick={() => setActiveTab('approval')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex gap-2 ${activeTab === 'approval' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <ClipboardCheck className="h-4 w-4" /> Results & Approval
                    </button>
                </div>
            </div>

            {/* Tab 1: Config */}
            {activeTab === 'config' && (
                <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Academic Session</h3>
                            <button onClick={handleSaveConfig} className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors flex items-center gap-2">
                                <Save className="h-4 w-4" /> Save Configuration
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Current Academic Year</label>
                                <input
                                    type="text"
                                    value={examConfig.academic_year}
                                    onChange={e => setExamConfig({ ...examConfig, academic_year: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                    placeholder="e.g. 2024/2025"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Current Term</label>
                                <select
                                    value={examConfig.current_term}
                                    onChange={e => setExamConfig({ ...examConfig, current_term: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                                >
                                    <option>First Term</option>
                                    <option>Second Term</option>
                                    <option>Third Term</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Assessment Weights</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Class Score (%)</label>
                                <input
                                    type="number"
                                    value={examConfig.weights.class}
                                    onChange={e => setExamConfig({ ...examConfig, weights: { ...examConfig.weights, class: Number(e.target.value) } })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Score (%)</label>
                                <input
                                    type="number"
                                    value={examConfig.weights.exam}
                                    onChange={e => setExamConfig({ ...examConfig, weights: { ...examConfig.weights, exam: Number(e.target.value) } })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Total must equal 100%.</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Grading System</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Grade</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Min Score</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Max Score</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Remark</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {examConfig.grading.map((g: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 font-bold">{g.grade}</td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={g.min}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].min = Number(e.target.value);
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-16 p-1 border border-slate-300 rounded text-center"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={g.max}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].max = Number(e.target.value);
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-16 p-1 border border-slate-300 rounded text-center"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={g.remark}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].remark = e.target.value;
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-full p-1 border border-slate-300 rounded"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'questions' && (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-bold text-slate-600">Question Bank</h3>
                    <p>Upload questions for CBT (Computer Based Tests) here.</p>
                </div>
            )}

            {/* Tab 3: Results & Approval (The Core Workflow) */}
            {activeTab === 'approval' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                    {/* Toggle Queue / Reports */}
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setApprovalView('queue')}
                            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${approvalView === 'queue' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Submission Queue
                        </button>
                        <button
                            onClick={() => setApprovalView('reports')}
                            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${approvalView === 'reports' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Report Card Center
                        </button>
                    </div>

                    {approvalView === 'queue' ? (
                        /* VIEW 1: SUBMISSION QUEUE */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {submissions.map(sub => (
                                <div
                                    key={sub.id}
                                    className={`bg-white p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${sub.status === 'Submitted' ? 'border-orange-200 ring-1 ring-orange-100 cursor-pointer' : 'border-slate-200'
                                        }`}
                                    onClick={() => sub.status === 'Submitted' && setReviewSubmission(sub)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${sub.status === 'Pending' ? 'bg-slate-100 text-slate-500' :
                                            sub.status === 'Submitted' ? 'bg-orange-100 text-orange-700' :
                                                sub.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {sub.status}
                                        </span>
                                        {sub.status === 'Submitted' && <Clock className="h-4 w-4 text-orange-400" />}
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg">{sub.subject}</h3>
                                    <p className="text-slate-500 text-sm font-medium mb-4">{sub.class}</p>

                                    <div className="text-xs text-slate-400 border-t border-slate-50 pt-3 flex justify-between items-center">
                                        <span>{sub.teacherName}</span>
                                        {sub.submittedDate && <span>{sub.submittedDate}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* VIEW 3: REPORT CARD CENTER */
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search student for report..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                    />
                                </div>
                                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-full sm:w-40">
                                    {availableClasses.length > 0 ? (
                                        availableClasses.map(c => <option key={c} value={c}>{c}</option>)
                                    ) : (
                                        <option value="">No Classes</option>
                                    )}
                                </select>
                            </div>

                            {/* Approval Warning Banner */}
                            {!approvalStatus.isFullyApproved && (
                                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-center gap-3">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <span className="font-bold">Note:</span> Not all subjects for {selectedClass} have been approved. Report cards generated now may be incomplete.
                                    </div>
                                </div>
                            )}
                            {/* Student List */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student Name</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Attendance</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStudents.length > 0 ? filteredStudents.map(student => (
                                                <tr key={student.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-800">{student.name}</p>
                                                        <p className="text-xs text-slate-500">{student.id}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">{student.attendance}%</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setReportStudent(student)}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-600 transition-colors"
                                                        >
                                                            <FileText className="h-3 w-3" /> View Report
                                                        </button>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={3} className="p-8 text-center text-slate-500">No students found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- MODALS --- */}

            {/* Review Modal (View 2) */}
            {
                reviewSubmission && (
                    <ReviewModal
                        submission={reviewSubmission}
                        results={results.filter(r => r.class === reviewSubmission.class && r.subject === reviewSubmission.subject)}
                        onClose={() => setReviewSubmission(null)}
                        onApprove={handleApproveSubmission}
                        onReject={handleRejectSubmission}
                    />
                )
            }

            {/* Report Card Modal */}
            {
                reportStudent && (
                    <ReportCard
                        student={reportStudent}
                        results={results.filter(r => r.studentId === reportStudent.id)}
                        schoolConfig={schoolConfig}
                        onClose={() => setReportStudent(null)}
                    />
                )
            }

        </div >
    );
};

export default Exams;