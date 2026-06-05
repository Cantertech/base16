import React from 'react';
import {
    CheckCircle,
    Clock,
    FileText,
    Send,
    Loader2,
    X,
    Printer,
    User,
    ChevronDown,
    Trash2,
    ShieldAlert,
    ClipboardCheck
} from 'lucide-react';
import { useExamsContext } from './ExamsContext';
import ReportCard from './ReportCard';
import { Student } from './ExamsTypes';

export const ExamPublishingPanel: React.FC = () => {
    const {
        activeTab,
        availableClasses,
        releasedClasses,
        subjectAssignments,
        submissionOverview,
        students,
        viewingClassList,
        setViewingClassList,
        setSelectedClass,
        setReleaseModalData,
        releaseModalData,
        publishResultsMutation,
        isBulkPrinting,
        triggerBulkPrint,
        setReportStudent,
        reportStudent,
        getPrefilledResults,
        reportResultsRaw,
        schoolInfo,
        localConfig,
        schoolId,
        activeModules,
        studentRank,
        handleConfirmRelease,
        allReportCards,
        allAssignments,
        expandedMonitoringClass,
        setExpandedMonitoringClass,
        selectedSubject,
        setSelectedSubject,
        handleResetSubjectMarks,
        classStudents,
        getExistingScore
    } = useExamsContext();

    if (activeTab !== 'publishing') return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Report Card Publishing</h3>
                    <p className="text-sm text-slate-500 font-medium tracking-wide">Manage report publication state and view final report cards.</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Released</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Pending</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {availableClasses.map((cls: string) => {
                    const isReleased = releasedClasses.includes(cls.trim().toLowerCase());

                    // Compute submission progress for this class
                    const classConf = (subjectAssignments || []).filter((sa: any) => {
                        const cl = Array.isArray(sa.classes) ? sa.classes[0] : sa.classes;
                        return cl?.name?.trim().toLowerCase() === cls.trim().toLowerCase();
                    });

                    const classSubs = classConf.map((sa: any) => {
                        const subj = Array.isArray(sa.subjects) ? sa.subjects[0] : sa.subjects;
                        const subjName = subj?.name;
                        const teachers = (allAssignments || []).filter((a: any) =>
                            a.class_name?.trim().toLowerCase() === cls.trim().toLowerCase() &&
                            (
                                a.subject_name?.trim().toLowerCase() === subjName?.trim().toLowerCase() ||
                                a.subject_name === null
                            )
                        ).map((a: any) => a.teacher_name).filter(Boolean);

                        const teacherLabel = teachers.length > 0 ? [...new Set(teachers)].join(', ') : 'Unassigned';
                        const statusEntry = (submissionOverview || []).find((s: any) =>
                            s.class_name?.trim().toLowerCase() === cls.trim().toLowerCase() &&
                            s.subject_name?.trim().toLowerCase() === subjName?.trim().toLowerCase()
                        );

                        return {
                            subject_name: subjName,
                            status: statusEntry?.status || 'Pending',
                            teacherName: teacherLabel
                        };
                    });

                    const totalSubjects = classSubs.length;
                    const submittedSubjects = classSubs.filter((s: any) => s.status === 'Submitted').length;
                    const progressPct = totalSubjects > 0 ? Math.round((submittedSubjects / totalSubjects) * 100) : 0;
                    const allSubmitted = totalSubjects > 0 && submittedSubjects === totalSubjects;
                    const studentCount = (students as Student[]).filter(s => s.class?.trim().toLowerCase() === cls.trim().toLowerCase()).length;

                    return (
                        <div
                            key={cls}
                            className={`relative rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 flex flex-col
                                ${isReleased
                                    ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-green-100'
                                    : 'border-slate-200 bg-white hover:border-primary-200 hover:shadow-md'
                                }`}
                        >
                            {/* Status ribbon */}
                            <div className={`px-5 py-3 flex items-center justify-between ${isReleased ? 'bg-green-100/60' : 'bg-slate-50'}`}>
                                <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">{cls}</h4>
                                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 ${isReleased ? 'bg-green-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                    {isReleased ? <><CheckCircle className="w-3 h-3" /> Released</> : <><Clock className="w-3 h-3" /> Pending</>}
                                </span>
                            </div>

                            <div className="p-5 flex-1 flex flex-col gap-4">
                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Students</p>
                                        <p className="text-lg font-black text-slate-700">{studentCount}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subjects</p>
                                        <p className="text-lg font-black text-slate-700">{totalSubjects}</p>
                                    </div>
                                    <div className={`rounded-xl p-2.5 text-center border ${allSubmitted ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Submitted</p>
                                        <p className={`text-lg font-black ${allSubmitted ? 'text-green-600' : 'text-amber-600'}`}>{submittedSubjects}/{totalSubjects}</p>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mark Entry Progress</span>
                                        <span className={`text-[9px] font-black ${allSubmitted ? 'text-green-600' : 'text-amber-600'}`}>{progressPct}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${allSubmitted ? 'bg-green-500' : progressPct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                    {!allSubmitted && totalSubjects > 0 && (
                                        <p className="text-[9px] text-amber-600 font-bold mt-1">
                                            {totalSubjects - submittedSubjects} subject{totalSubjects - submittedSubjects !== 1 ? 's' : ''} still pending
                                        </p>
                                    )}
                                    {allSubmitted && !isReleased && (
                                        <p className="text-[9px] text-green-600 font-bold mt-1">✓ All subjects submitted — ready to release</p>
                                    )}
                                </div>

                                {/* Track Submissions Accordion */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const isExpanded = expandedMonitoringClass === cls;
                                        setExpandedMonitoringClass(isExpanded ? null : cls);
                                        setSelectedClass(cls);
                                        setSelectedSubject('');
                                    }}
                                    className="w-full py-2 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm border border-primary-100"
                                >
                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                    {expandedMonitoringClass === cls ? "Hide Submissions" : "Track Submissions"}
                                </button>

                                {expandedMonitoringClass === cls && (
                                    <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-3 space-y-2 mt-1 animate-in slide-in-from-top-1 duration-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subject Status</p>
                                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                            {classSubs.map((sub: any, idx: number) => {
                                                const isSubSubmitted = sub.status === 'Submitted';
                                                const isSelected = selectedSubject === sub.subject_name;

                                                return (
                                                    <div key={idx} className="flex flex-col gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSubject(isSelected ? '' : sub.subject_name)}
                                                            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${isSelected ? 'bg-white border-primary-500 shadow-sm' : 'bg-white border-slate-200 hover:border-primary-300'}`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isSubSubmitted ? 'bg-green-500' : 'bg-amber-400'}`} />
                                                                <div className="min-w-0">
                                                                    <span className="font-bold text-slate-800 text-[10px] block truncate uppercase tracking-tight">{sub.subject_name}</span>
                                                                    <p className="text-[8px] font-bold text-slate-400 truncate uppercase tracking-wider">{sub.teacherName}</p>
                                                                </div>
                                                            </div>
                                                            <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isSubSubmitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                {isSubSubmitted ? 'Submitted' : sub.status}
                                                            </div>
                                                        </button>

                                                        {/* Sub-results preview table */}
                                                        {isSelected && (
                                                            <div className="bg-white rounded-lg border border-primary-100 shadow-md overflow-hidden p-2 text-xs">
                                                                <div className="bg-primary-50/50 p-1.5 border-b border-primary-50 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-primary-700">
                                                                    <span>Read-Only Sheet</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleResetSubjectMarks(cls, sub.subject_name)}
                                                                        className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 font-black"
                                                                    >
                                                                        <Trash2 className="w-2.5 h-2.5" /> Reset
                                                                    </button>
                                                                </div>
                                                                <div className="max-h-[150px] overflow-y-auto mt-1">
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead>
                                                                            <tr className="border-b border-slate-100">
                                                                                <th className="py-1 text-[8px] font-black text-slate-400 uppercase">Student</th>
                                                                                <th className="py-1 text-[8px] font-black text-slate-400 uppercase text-center w-12">Exam</th>
                                                                                <th className="py-1 text-[8px] font-black text-slate-800 uppercase text-center w-12">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {classStudents.map(student => {
                                                                                const savedClass = getExistingScore(student.id, 'classScore');
                                                                                const savedExam = getExistingScore(student.id, 'examScore');
                                                                                const total = savedClass + savedExam;
                                                                                return (
                                                                                    <tr key={student.id}>
                                                                                        <td className="py-1 text-[9px] uppercase font-medium text-slate-600 truncate max-w-[80px]">{student.name}</td>
                                                                                        <td className="py-1 text-center text-[9px] text-slate-400">{savedExam}</td>
                                                                                        <td className="py-1 text-center text-[9px] font-bold text-primary-600">{total}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 mt-auto">
                                    <button
                                        onClick={() => { setViewingClassList(cls); setSelectedClass(cls); }}
                                        className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <FileText className="w-3.5 h-3.5" /> View Reports
                                    </button>
                                    <button
                                        onClick={() => {
                                            const classCount = (students as Student[]).filter(s => s.class?.trim().toLowerCase() === cls.trim().toLowerCase()).length;
                                            const phoneCount = (students as Student[]).filter(s => s.class?.trim().toLowerCase() === cls.trim().toLowerCase() && s.parent_phone && s.parent_phone.length >= 9).length;
                                            setReleaseModalData({ className: cls, studentCount: classCount, validPhones: phoneCount });
                                        }}
                                        disabled={isReleased || publishResultsMutation.isPending}
                                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm
                                            ${isReleased
                                                ? 'bg-green-100 text-green-600 cursor-not-allowed'
                                                : allSubmitted
                                                    ? 'bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 active:scale-95 shadow-primary-200'
                                                    : 'bg-slate-800 text-white hover:bg-slate-900'
                                            }`}
                                    >
                                        {isReleased
                                            ? <><CheckCircle className="w-3.5 h-3.5" /> Released</>
                                            : publishResultsMutation.isPending
                                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Releasing...</>
                                                : <><Send className="w-3.5 h-3.5" /> Release Results</>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {availableClasses.length === 0 && (
                    <div className="col-span-full p-20 text-center bg-white rounded-3xl border-4 border-dashed border-slate-100">
                        <Send className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-400">No Classes Configured</h3>
                        <p className="text-sm text-slate-300 mt-1">Set up your target classes in the Configuration tab first.</p>
                    </div>
                )}
            </div>

            {releaseModalData && (
                <ReleaseConfigModal
                    data={releaseModalData}
                    onClose={() => setReleaseModalData(null)}
                    onConfirm={handleConfirmRelease}
                    isProcessing={publishResultsMutation.isPending}
                />
            )}

            {/* Conditional Modals */}
            {viewingClassList && (
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

            {reportStudent && (
                <ReportCard
                    student={students.find(s => s.id === reportStudent.id)!}
                    results={getPrefilledResults(reportStudent, reportResultsRaw)}
                    schoolConfig={{
                        ...schoolInfo,
                        ...localConfig,
                        term_total_days: localConfig?.term_total_days
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
};

// Internal Helper Modal (Extracted to keep panel clean)
interface ReleaseConfigModalProps {
    data: { className: string; studentCount: number; validPhones: number };
    onClose: () => void;
    onConfirm: (className: string, sendSms: boolean) => void;
    isProcessing: boolean;
}

const ReleaseConfigModal: React.FC<ReleaseConfigModalProps> = ({ data, onClose, onConfirm, isProcessing }) => {
    const [sendSms, setSendSms] = React.useState(true);

    return (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600">
                        <Send className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Release Report Cards</h3>
                        <p className="text-xs text-slate-400">{data.className}</p>
                    </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                    <p>Releasing publishes report cards to the parent portal. You can choose to notify parents via SMS.</p>
                    <div className="flex justify-between font-bold pt-1 text-slate-700">
                        <span>Total Students:</span>
                        <span>{data.studentCount}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-700">
                        <span>Valid Contacts:</span>
                        <span>{data.validPhones} / {data.studentCount}</span>
                    </div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={sendSms}
                        onChange={(e) => setSendSms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <div className="text-xs">
                        <p className="font-bold text-slate-700">Send SMS Alerts to Parents</p>
                        <p className="text-slate-400 mt-0.5">Sends a download link to parents with valid contact numbers.</p>
                    </div>
                </label>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(data.className, sendSms)}
                        disabled={isProcessing}
                        className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-primary-100"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};
