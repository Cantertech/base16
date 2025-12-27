import React, { useState, useEffect } from 'react';
import {
    Search, FileText, CheckCircle, Save, Printer,
    BarChart2, Filter, ChevronDown, User, ArrowRight,
    ClipboardCheck, AlertCircle, Clock, BookOpen, Settings,
    Lock, Unlock, PlayCircle, StopCircle
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
    // Admin Tabs: 'manage', 'reports'
    const [activeTab, setActiveTab] = useState<'manage' | 'reports'>('manage');

    // Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [results, setResults] = useState<Result[]>([]);

    // Config Data
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

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
        academic_year: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        status: 'SETUP', // SETUP, OPEN, LOCKED
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
                    // Class teacher sees all subjects configured for the exam
                    setAvailableSubjects(examConfig.target_subjects || []);
                } else {
                    const assignedSubjects = classAssignment.map(a => a.subjectName).filter(Boolean);
                    setAvailableSubjects(assignedSubjects);
                }
            }
        }
    }, [selectedClass, myAssignments, examConfig]);

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

                    // 2. Fetch Classes & Subjects (for Config)
                    const { data: classesData } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
                    if (classesData) setAvailableClasses(classesData.map(c => c.name));

                    const { data: subjectsData } = await supabase.from('subjects').select('name').eq('school_id', schoolId).order('name');
                    if (subjectsData) setAvailableSubjects(subjectsData.map(s => s.name));

                    // 3. Fetch Students
                    const { data: studentsData } = await supabase.from('students').select('*').eq('school_id', schoolId);
                    if (studentsData) {
                        setStudents(studentsData.map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            class: s.class,
                            attendance: 100 // Mock
                        })));
                    }

                    // 4. Fetch Results (Filtered by current term/year)
                    const currentTerm = (schoolData?.exam_config?.current_term) || 'First Term';
                    const currentYear = (schoolData?.exam_config?.academic_year) || '2024/2025';

                    const { data: resultsData } = await supabase
                        .from('exam_results')
                        .select('*, students(name)')
                        .eq('school_id', schoolId)
                        .eq('term', currentTerm)
                        .eq('academic_year', currentYear);

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
                }
            }

            // 5. Fetch Teacher Assignments (Teacher only)
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
        }
    };

    const handleSaveConfig = async (newConfig: any = examConfig) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
            const schoolId = currentUser?.school_id || profile?.school_id;
            if (!schoolId) return;

            const { error } = await supabase
                .from('schools')
                .update({ exam_config: newConfig })
                .eq('id', schoolId);

            if (error) throw error;

            setExamConfig(newConfig);
            fetchData(); // Reload data to ensure we see results for the new config
            alert('Exam configuration updated successfully!');
        } catch (error: any) {
            console.error('Error saving config:', error);
            alert('Failed to save configuration.');
        }
    };

    const handleStatusChange = async (newStatus: 'OPEN' | 'LOCKED') => {
        const confirmMsg = newStatus === 'OPEN'
            ? "Are you sure you want to OPEN marks entry? Teachers will be able to edit scores."
            : "Are you sure you want to LOCK marks entry? Teachers will no longer be able to edit scores.";

        if (confirm(confirmMsg)) {
            const newConfig = { ...examConfig, status: newStatus };
            await handleSaveConfig(newConfig);
        }
    };

    // --- Mark Entry Logic (Teacher) ---
    const handleScoreChange = (studentId: string, field: 'classScore' | 'examScore', value: string) => {
        if (examConfig.status !== 'OPEN' && currentUser?.role !== 'admin') return; // Double check

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
            alert('Marks saved successfully!');

        } catch (error: any) {
            console.error('Error saving marks:', error);
            alert(`Failed to save marks: ${error.message}`);
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

    // --- TEACHER VIEW ---
    if (currentUser?.role === 'teacher') {
        const isLocked = examConfig.status !== 'OPEN';

        if (examConfig.status === 'SETUP') {
            return (
                <div className="p-12 text-center h-full flex flex-col items-center justify-center">
                    <div className="bg-yellow-50 p-6 rounded-full mb-4">
                        <Settings className="h-12 w-12 text-yellow-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Exam Configuration in Progress</h2>
                    <p className="text-slate-500 max-w-md">
                        The administrator is currently setting up the exam. Please check back later when marks entry is enabled.
                    </p>
                </div>
            );
        }

        return (
            <div className="p-8 space-y-8 h-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Mark Entry</h1>
                        <p className="text-slate-500 text-sm">
                            {examConfig.exam_name} • {examConfig.current_term}
                        </p>
                    </div>
                    {isLocked && (
                        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm">
                            <Lock className="h-4 w-4" /> Marks Entry Closed
                        </div>
                    )}
                    {!isLocked && (
                        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm">
                            <Unlock className="h-4 w-4" /> Marks Entry Open
                        </div>
                    )}
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
                                        <option value="">No Classes</option>
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
                        {!isLocked && (
                            <button onClick={saveMarks} disabled={Object.keys(pendingChanges).length === 0} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all disabled:opacity-50">
                                <Save className="h-4 w-4" /> Save Changes
                            </button>
                        )}
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
                                            <td className="px-6 py-3 text-center">
                                                <input
                                                    type="number"
                                                    disabled={isLocked}
                                                    value={dispClass || ''}
                                                    onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                                                    className="w-20 p-2 text-center border rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <input
                                                    type="number"
                                                    disabled={isLocked}
                                                    value={dispExam || ''}
                                                    onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                    className="w-20 p-2 text-center border rounded-md disabled:bg-slate-100 disabled:text-slate-500"
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
                </div>
            </div>
        );
    }

    // --- ADMIN VIEW ---
    return (
        <div className="p-8 space-y-8 relative h-full">
            {/* Admin Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Exam Management</h1>
                    <p className="text-slate-500 text-sm">Configure exams, manage access, and generate reports.</p>
                </div>

                {/* Admin Tabs */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex gap-2 ${activeTab === 'manage' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Settings className="h-4 w-4" /> Manage Exam
                    </button>
                    <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex gap-2 ${activeTab === 'reports' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <FileText className="h-4 w-4" /> Report Card Centre
                    </button>
                </div>
            </div>

            {/* Tab 1: Manage Exam (Setup Phase) */}
            {activeTab === 'manage' && (
                <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                    {/* Status Control Panel */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Exam Status</h3>
                            <div className="flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full ${examConfig.status === 'OPEN' ? 'bg-green-500 animate-pulse' :
                                    examConfig.status === 'LOCKED' ? 'bg-red-500' : 'bg-yellow-500'
                                    }`}></span>
                                <span className="font-medium text-slate-600">
                                    {examConfig.status === 'OPEN' ? 'Marks Entry OPEN' :
                                        examConfig.status === 'LOCKED' ? 'Marks Entry LOCKED' : 'Setup Phase'}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleStatusChange('OPEN')}
                                disabled={examConfig.status === 'OPEN'}
                                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                            >
                                <PlayCircle className="h-5 w-5" /> Enable Marks Entry
                            </button>
                            <button
                                onClick={() => handleStatusChange('LOCKED')}
                                disabled={examConfig.status === 'LOCKED'}
                                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                            >
                                <StopCircle className="h-5 w-5" /> Stop Marks Entry
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Basic Config */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Exam Details</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
                                <input
                                    type="text"
                                    value={examConfig.exam_name}
                                    onChange={e => setExamConfig({ ...examConfig, exam_name: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                    placeholder="e.g. End of Term 1 Exam"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
                                    <input
                                        type="text"
                                        value={examConfig.academic_year}
                                        onChange={e => setExamConfig({ ...examConfig, academic_year: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
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

                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-slate-700 mb-3">Assessment Weights</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Class Score (%)</label>
                                        <input
                                            type="number"
                                            value={examConfig.weights.class}
                                            onChange={e => setExamConfig({ ...examConfig, weights: { ...examConfig.weights, class: Number(e.target.value) } })}
                                            className="w-full p-2 border border-slate-300 rounded-lg"
                                        />
                                    </div>
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
                    </div>

                    {/* Grading System */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Grading System</h3>
                                <p className="text-sm text-slate-500">Choose a template or customize the ranges manually.</p>
                            </div>
                            <select
                                value={examConfig.grading_type || 'STANDARD'}
                                onChange={(e) => {
                                    const type = e.target.value as 'STANDARD' | 'COMPETENCY';
                                    if (confirm('Changing the grading system will overwrite current manual edits. Continue?')) {
                                        setExamConfig({
                                            ...examConfig,
                                            grading_type: type,
                                            grading: gradingPresets[type]
                                        });
                                    }
                                }}
                                className="p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700"
                            >
                                <option value="STANDARD">Standard Grading (A-F)</option>
                                <option value="COMPETENCY">Competency Based (EE-BE)</option>
                            </select>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Grade / Code</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Min Score</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Max Score</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Remark / Meaning</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {examConfig.grading.map((g: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={g.grade}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].grade = e.target.value;
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-20 p-1 border border-slate-300 rounded font-bold text-slate-700"
                                                />
                                            </td>
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
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={g.points || 0}
                                                    onChange={e => {
                                                        const newGrading = [...examConfig.grading];
                                                        newGrading[idx].points = Number(e.target.value);
                                                        setExamConfig({ ...examConfig, grading: newGrading });
                                                    }}
                                                    className="w-16 p-1 border border-slate-300 rounded text-center text-slate-500"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={() => handleSaveConfig()} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-lg">
                            <Save className="h-5 w-5" /> Save All Settings
                        </button>
                    </div>
                </div>
            )}

            {/* Tab 2: Report Card Centre */}
            {activeTab === 'reports' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Student Reports</h3>
                            <div className="flex gap-4">
                                <select
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="p-2 border border-slate-300 rounded-lg outline-none bg-white min-w-[150px]"
                                >
                                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search student..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Class</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Subjects Taken</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map(student => {
                                            const studentResults = results.filter(r => r.studentId === student.id);
                                            return (
                                                <tr key={student.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                                                    <td className="px-6 py-4 text-slate-600">{student.class}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                                                            {studentResults.length} Subjects
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setReportStudent(student)}
                                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1 justify-end ml-auto"
                                                        >
                                                            <FileText className="h-4 w-4" /> Generate Report
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                No students found in {selectedClass}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Card Modal */}
            {reportStudent && (
                <ReportCard
                    student={reportStudent}
                    results={results.filter(r => r.studentId === reportStudent.id)}
                    onClose={() => setReportStudent(null)}
                    schoolConfig={{
                        ...schoolInfo,
                        academic_year: examConfig.academic_year,
                        term: examConfig.current_term,
                        grading: examConfig.grading
                    }}
                />
            )}
        </div>
    );
};

export default Exams;