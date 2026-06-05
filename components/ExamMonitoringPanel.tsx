import React from 'react';
import {
    Users,
    ChevronDown,
    ShieldAlert,
    Trash2,
    X
} from 'lucide-react';
import { useExamsContext } from './ExamsContext';

export const ExamMonitoringPanel: React.FC = () => {
    const {
        activeTab,
        availableClasses,
        subjectAssignments,
        allAssignments,
        submissionOverview,
        expandedMonitoringClass,
        setExpandedMonitoringClass,
        setSelectedClass,
        selectedSubject,
        setSelectedSubject,
        handleResetSubjectMarks,
        classStudents,
        getExistingScore
    } = useExamsContext();

    if (activeTab !== 'monitoring') return null;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-6">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Submission Monitoring</h3>
                <p className="text-sm text-slate-500 font-medium tracking-wide italic">Click a class to see subjects, then click a subject to view submitted marks.</p>
            </div>

            <div className="space-y-3">
                {availableClasses.map((className: string) => {
                    const classConf = (subjectAssignments || []).filter((sa: any) => {
                        const cls = Array.isArray(sa.classes) ? sa.classes[0] : sa.classes;
                        return cls?.name?.trim().toLowerCase() === className.trim().toLowerCase();
                    });

                    const classSubs = classConf.map(sa => {
                        const subj = Array.isArray(sa.subjects) ? sa.subjects[0] : sa.subjects;
                        const subjName = subj?.name;
                        const teachers = (allAssignments || []).filter((a: any) =>
                            a.class_name?.trim().toLowerCase() === className.trim().toLowerCase() &&
                            (
                                a.subject_name?.trim().toLowerCase() === subjName?.trim().toLowerCase() ||
                                a.subject_name === null
                            )
                        ).map((a: any) => a.teacher_name).filter(Boolean);

                        const teacherLabel = teachers.length > 0 ? [...new Set(teachers)].join(', ') : 'Unassigned';
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
                            {/* Class Header */}
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

                            {/* Subject List */}
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
    );
};
