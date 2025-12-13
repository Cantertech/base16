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

    // Mark Entry / Filter State
    const [selectedClass, setSelectedClass] = useState('JHS 1');
    const [selectedSubject, setSelectedSubject] = useState('Mathematics');
    const [searchQuery, setSearchQuery] = useState('');

    // Editing State
    const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number }>>({});

    // Modals
    const [reportStudent, setReportStudent] = useState<Student | null>(null);
    const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null);

    // Load Data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch Students
            const { data: studentsData } = await supabase.from('students').select('*');
            if (studentsData) {
                setStudents(studentsData.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    class: s.class,
                    attendance: 100 // Mock for now
                })));
            }

            // Fetch Results
            const { data: resultsData } = await supabase.from('exam_results').select('*, students(name)');
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

            // Fetch Submissions
            const { data: submissionsData, error: subError } = await supabase
                .from('exam_submissions')
                .select('*');

            if (subError) throw subError;

            if (submissionsData) {
                // Fetch teacher profiles manually to avoid join issues
                const teacherIds = [...new Set(submissionsData.map((s: any) => s.teacher_id).filter(Boolean))];
                let teacherMap: Record<string, string> = {};

                if (teacherIds.length > 0) {
                    const { data: teachers } = await supabase
                        .from('profiles')
                        .select('id, name')
                        .in('id', teacherIds);

                    if (teachers) {
                        teachers.forEach((t: any) => {
                            teacherMap[t.id] = t.name;
                        });
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

        } catch (error) {
            console.error('Error fetching exam data:', error);
        }
    };

    // --- Mark Entry Logic (Teacher) ---
    const handleScoreChange = (studentId: string, field: 'classScore' | 'examScore', value: string) => {
        let numValue = Number(value);
        if (field === 'classScore' && numValue > 30) numValue = 30;
        if (field === 'examScore' && numValue > 70) numValue = 70;
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
            const updates = Object.entries(pendingChanges).map(([studentId, val]) => {
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
                                    {['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-48">
                                    {['Mathematics', 'English Language', 'Integrated Science', 'Social Studies', 'ICT', 'RME'].map(s => <option key={s} value={s}>{s}</option>)}
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
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Class (30)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center w-32">Exam (70)</th>
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
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex gap-2 ${activeTab === 'config' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
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
                                    {['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {/* Approval Warning Banner */}
                            {!approvalStatus.isFullyApproved && (
                                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-center gap-3">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <span className="font-bold">Pending Approvals:</span> Report cards for {selectedClass} cannot be generated yet.
                                        Only {approvalStatus.approved} out of {approvalStatus.total} subjects have been approved by the Admin.
                                    </div>
                                </div>
                            )}

                            {/* Student List */}
                            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${!approvalStatus.isFullyApproved ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student</th>
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
                    )}
                </div>
            )}

            {/* Placeholders for Tab 1 & 2 */}
            {activeTab === 'config' && (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-bold text-slate-600">Exam Configuration</h3>
                    <p>Create new exams, set date ranges, and manage term weights here.</p>
                </div>
            )}
            {activeTab === 'questions' && (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-bold text-slate-600">Question Bank</h3>
                    <p>Upload questions for CBT (Computer Based Tests) here.</p>
                </div>
            )}

            {/* --- MODALS --- */}

            {/* Review Modal (View 2) */}
            {reviewSubmission && (
                <ReviewModal
                    submission={reviewSubmission}
                    results={results.filter(r => r.class === reviewSubmission.class && r.subject === reviewSubmission.subject)}
                    onClose={() => setReviewSubmission(null)}
                    onApprove={handleApproveSubmission}
                    onReject={handleRejectSubmission}
                />
            )}

            {/* Report Card Modal */}
            {reportStudent && (
                <ReportCard
                    student={reportStudent}
                    results={results.filter(r => r.studentId === reportStudent.id)}
                    schoolConfig={schoolConfig}
                    onClose={() => setReportStudent(null)}
                />
            )}

        </div>
    );
};

export default Exams;