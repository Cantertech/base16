import React from 'react';
import {
    Calendar,
    PlusCircle,
    MessageSquare,
    FileText,
    Plus,
    Save,
    Loader2,
    Send,
    ShieldAlert,
    Filter,
    Users,
    Check,
    PenTool,
    X,
    CheckCircle,
    Archive,
    User,
    BookOpen,
    Search,
    TrendingUp
} from 'lucide-react';
import { useExamsContext } from './ExamsContext';
import ReportCard, { toOrdinal } from './ReportCard';
import { Student } from './ExamsTypes';

export const ExamsTeacherView: React.FC = () => {
    const {
        currentUser,
        examConfig,
        currentTerm,
        selectedClass,
        setSelectedClass,
        selectedSubject,
        setSelectedSubject,
        teacherTab,
        setTeacherTab,
        isClassTeacher,
        saveBulkRemarks,
        pendingRemarks,
        saveBulkRemarksMutation,
        pendingChanges,
        saveMarksMutation,
        submitMarksMutation,
        saveMarks,
        handleSubmitMarks,
        activeTool,
        setActiveTool,
        paintBrush,
        setPaintBrush,
        classStudents,
        results,
        handleRemarkChange,
        getExistingCompetency,
        getPendingKey,
        students,
        getPrefilledResults,
        reportResultsRaw,
        schoolInfo,
        localConfig,
        studentRank,
        classRanks,
        schoolId,
        activeModules,
        allReportCards,
        systemAttendanceMap,
        reportStudent,
        setReportStudent,
        getLayoutForClass,
        availableClasses,
        availableSubjects,
        myAssignments,
        setIsLevelArchiveOpen,
        isPresetModalOpen,
        setIsPresetModalOpen,
        newPresetValue,
        setNewPresetValue,
        setUserPresets,
        setConductPresets,
        setInterestPresets,
        conductPresets,
        interestPresets,
        userPresets,
        getExistingScore,
        getGrade,
        handleScoreChange
    } = useExamsContext();

    const isSystemAttendance = (examConfig?.attendance_mode || localConfig?.attendance_mode) === 'system';
    const isNurseryLayout = getLayoutForClass(selectedClass) === 'nursery';

    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<'posAsc' | 'posDesc' | 'scoreDesc' | 'scoreAsc' | 'nameAsc'>('posAsc');

    // Calculate standings/ranks from results
    const standingsRanks = React.useMemo(() => {
        if (!results || results.length === 0) return {};
        
        const totals: Record<string, number> = {};
        results.forEach((r: any) => {
            if (!r.studentId) return;
            if (!totals[r.studentId]) totals[r.studentId] = 0;
            totals[r.studentId] += Number(r.total || 0);
        });

        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const ranks: Record<string, { position: number, total: number }> = {};
        const totalStudents = sorted.length;

        let lastScore = -1;
        let lastRank = 0;

        sorted.forEach(([studentId, score], index) => {
            if (score !== lastScore) {
                lastRank = index + 1;
                lastScore = score;
            }
            ranks[studentId] = { position: lastRank, total: totalStudents };
        });

        return ranks;
    }, [results]);

    const processedStudents = React.useMemo(() => {
        if (!selectedClass) return [];
        let list = [...classStudents];
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(s => s.name.toLowerCase().includes(query));
        }

        list.sort((a, b) => {
            const aResults = results.filter(r => r.studentId === a.id);
            const aTotal = aResults.reduce((sum, r) => sum + (r.total || 0), 0);
            const bResults = results.filter(r => r.studentId === b.id);
            const bTotal = bResults.reduce((sum, r) => sum + (r.total || 0), 0);

            const aRank = standingsRanks[a.id]?.position ?? 99999;
            const bRank = standingsRanks[b.id]?.position ?? 99999;

            if (sortBy === 'posAsc') {
                return aRank - bRank;
            }
            if (sortBy === 'posDesc') {
                return bRank - aRank;
            }
            if (sortBy === 'scoreDesc') {
                return bTotal - aTotal;
            }
            if (sortBy === 'scoreAsc') {
                return aTotal - bTotal;
            }
            if (sortBy === 'nameAsc') {
                return a.name.localeCompare(b.name);
            }
            return 0;
        });

        return list;
    }, [classStudents, searchQuery, sortBy, results, standingsRanks]);

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
    const reportConfig = examConfig?.report_card_config || schoolInfo?.report_card_config;

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
                                    onClick={() => setTeacherTab('standings')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${teacherTab === 'standings' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <TrendingUp className="w-4 h-4" /> Class Standings
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                {/* Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center bg-slate-50">
                    <div className="flex flex-wrap gap-4 w-full lg:w-auto items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                            <select 
                                value={selectedClass} 
                                onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); }} 
                                className="p-3 border border-slate-300 rounded-xl outline-none bg-white w-64 cursor-pointer font-bold shadow-sm focus:ring-4 focus:ring-primary-50 text-sm"
                            >
                                <option value="">-- Select Class --</option>
                                {((currentUser?.role || '').toLowerCase() === 'teacher'
                                    ? (() => {
                                        const distinctClassNames = [...new Set(myAssignments
                                            .filter((a: any) => (teacherTab === 'marks') || a.isClassTeacher)
                                            .map((a: any) => a.className).filter(Boolean))];
                                        return distinctClassNames.map((className: string, i: number) => {
                                            const isLead = myAssignments.some((a: any) => a.isClassTeacher && a.className?.trim().toLowerCase() === className.trim().toLowerCase()) ||
                                                (myAssignments.length === 0 && currentUser?.assignedClass?.trim().toLowerCase() === className.trim().toLowerCase());
                                            return (
                                                <option key={i} value={className}>
                                                    {className} {isLead ? '★ (Class Teacher)' : '(Subject Teacher)'}
                                                </option>
                                            );
                                        });
                                    })()
                                    : availableClasses.map((className: any, i: number) => (
                                        <option key={i} value={className}>{className}</option>
                                    )))}
                            </select>
                        </div>
                        {teacherTab === 'marks' && (
                            <div className="flex flex-wrap gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                    <select 
                                        value={selectedSubject} 
                                        onChange={e => setSelectedSubject(e.target.value)} 
                                        disabled={!selectedClass || availableSubjects.length === 0} 
                                        className="p-3 border border-slate-300 rounded-xl outline-none bg-white w-60 cursor-pointer disabled:opacity-50 font-bold shadow-sm focus:ring-4 focus:ring-primary-50 text-sm"
                                    >
                                        <option value="">
                                            {!selectedClass 
                                                ? '-- Select Class First --' 
                                                : availableSubjects.length === 0 
                                                    ? '-- No Subjects Assigned --' 
                                                    : '-- Select Subject --'}
                                        </option>
                                        {availableSubjects.map((s: any) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {isNurseryLayout && (
                                    <button
                                        onClick={() => setIsLevelArchiveOpen(true)}
                                        className="p-2 px-4 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 h-[46px]"
                                    >
                                        <Archive className="w-3.5 h-3.5" /> Levels
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Visual Role Indicator */}
                        {!!selectedClass && (
                            <div className="pb-1">
                                {isClassTeacher ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold shadow-xs">
                                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                        <span>★ Class Teacher</span>
                                        <span className="text-[11px] font-normal text-emerald-700 hidden xl:inline">• All Subjects, Remarks & Standings</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold shadow-xs">
                                        <span className="flex h-2 w-2 rounded-full bg-blue-500 shrink-0"></span>
                                        <span>Subject Teacher</span>
                                        <span className="text-[11px] font-normal text-blue-700 hidden xl:inline">• Assigned subjects only</span>
                                    </div>
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
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex gap-2">
                                    <div className="relative group/savebtn">
                                        <button
                                            onClick={saveMarks}
                                            disabled={Object.keys(pendingChanges).length === 0 || saveMarksMutation.isPending || submitMarksMutation.isPending}
                                            className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                        >
                                            {saveMarksMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save Draft
                                            {Object.keys(pendingChanges).length > 0 && (
                                                <span className="bg-amber-400 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ml-0.5 animate-pulse">
                                                    {Object.keys(pendingChanges).length}
                                                </span>
                                            )}
                                        </button>
                                        <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 text-white text-[10px] font-medium px-3 py-2 rounded-lg shadow-xl opacity-0 group-hover/savebtn:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                                            Saves your work to the database but <span className="font-black text-amber-300">does not notify</span> the admin. Use this to save progress mid-session.
                                            <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                                        </div>
                                    </div>

                                    <div className="relative group/submitbtn">
                                        <button
                                            onClick={handleSubmitMarks}
                                            disabled={saveMarksMutation.isPending || submitMarksMutation.isPending}
                                            className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                        >
                                            {submitMarksMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            Submit Marks
                                        </button>
                                        <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 text-white text-[10px] font-medium px-3 py-2 rounded-lg shadow-xl opacity-0 group-hover/submitbtn:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                                            Saves and <span className="font-black text-green-300">notifies the admin</span> that you are done. The admin's monitoring board will show "Submitted".
                                            <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[9px] text-slate-400 font-medium text-right leading-tight">
                                    <span className="text-amber-500 font-bold">Save Draft</span> = saves progress &nbsp;·&nbsp; <span className="text-green-600 font-bold">Submit Marks</span> = notifies admin you're done
                                </p>
                            </div>
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
                                        { id: 'attendance_present', label: isSystemAttendance ? 'Attendance ⚡' : 'Attendance' }
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
                            {activeTool === 'attendance_present' && isSystemAttendance ? (
                                <div className="mb-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 rounded-xl border border-emerald-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-lg shrink-0">
                                            ⚡
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 tracking-tight text-xs uppercase flex items-center gap-2">
                                                Attendance Rule: System Sync Active
                                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                                                    Live Register Feed
                                                </span>
                                            </h4>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                Student attendance days are automatically tallied from the Daily Attendance Register. Manual typing is locked.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-white/90 px-3.5 py-2 rounded-lg border border-emerald-200 shadow-xs shrink-0">
                                        <CheckCircle className="w-4 h-4 text-emerald-600" /> Auto-Synced to Report Cards
                                    </div>
                                </div>
                            ) : (
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
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {classStudents.map(student => {
                                    const saved = allReportCards.find((r: any) => r.student_id === student.id);
                                    const pending = pendingRemarks[student.id] || {};
                                    const sysAtt = systemAttendanceMap?.[student.id];

                                    const currentVal = pending[activeTool] ?? saved?.[activeTool] ?? '';
                                    const termTotal = examConfig?.term_total_days || localConfig?.term_total_days || 0;

                                    const studentResults = results.filter(r => r.studentId === student.id);
                                    const totalScore = studentResults.reduce((sum, r) => sum + (r.total || 0), 0);
                                    const rankObj = standingsRanks[student.id] || classRanks[student.id];

                                    return (
                                        <div
                                            key={student.id}
                                            className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between group ${paintBrush && currentVal !== paintBrush && !(activeTool === 'attendance_present' && isSystemAttendance) ? 'hover:border-primary-400 hover:shadow-md cursor-pointer' : ''} ${currentVal || (activeTool === 'attendance_present' && isSystemAttendance) ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 border-dashed'}`}
                                            onClick={(e) => {
                                                if (activeTool === 'attendance_present' && isSystemAttendance) return;
                                                if (paintBrush && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                                                    handleRemarkChange(student.id, activeTool, paintBrush);
                                                }
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h5 className="font-black text-slate-800 text-sm truncate">{student.name}</h5>
                                                        {rankObj?.position ? (
                                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${rankObj.position === 1 ? 'bg-amber-100 text-amber-900 border-amber-300' : rankObj.position === 2 ? 'bg-slate-100 text-slate-800 border-slate-300' : rankObj.position === 3 ? 'bg-orange-100 text-orange-900 border-orange-300' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                                {rankObj.position === 1 ? '🥇 1st' : rankObj.position === 2 ? '🥈 2nd' : rankObj.position === 3 ? '🥉 3rd' : toOrdinal(rankObj.position)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 mt-1">
                                                        <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-widest">{student.id.substring(0, 8)}</span>
                                                        {studentResults.length > 0 && (
                                                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 font-mono">
                                                                Total: <strong className="text-slate-900 font-black">{totalScore}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-50 p-2 rounded-lg border border-slate-100 min-h-[44px] flex items-center justify-between group-hover:bg-primary-50/30 transition-colors mt-2">
                                                {activeTool === 'attendance_present' ? (
                                                    isSystemAttendance ? (
                                                        <div className="flex items-center justify-between w-full bg-emerald-50/80 border border-emerald-200/90 rounded-lg px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                <span className="text-xs font-black text-emerald-950">
                                                                    {sysAtt?.present ?? 0}
                                                                    <span className="text-emerald-700 font-bold"> / {termTotal || sysAtt?.total || '--'} Days</span>
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                                                                {termTotal > 0
                                                                    ? `${Math.round(((sysAtt?.present || 0) / termTotal) * 100)}%`
                                                                    : 'Auto-Synced'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <input
                                                                type="number"
                                                                value={currentVal || ''}
                                                                max={termTotal || 365}
                                                                onChange={(e) => handleRemarkChange(student.id, 'attendance_present', e.target.value)}
                                                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-primary-500"
                                                                placeholder="Present"
                                                            />
                                                            <span className="text-xs font-black text-slate-400">/ {termTotal || '--'}</span>
                                                        </div>
                                                    )
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
                                })}
                                {classStudents.length === 0 && (
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
                            {/* Search and Sort controls */}
                            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="relative w-full sm:w-80">
                                    <input 
                                        type="text" 
                                        placeholder="Search student..." 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-50 transition-all placeholder:text-slate-400"
                                    />
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Search className="w-4 h-4" />
                                    </span>
                                </div>
                                <div className="flex gap-3 items-center w-full sm:w-auto justify-end">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort By</span>
                                    <select 
                                        value={sortBy} 
                                        onChange={e => setSortBy(e.target.value as any)}
                                        className="p-2.5 px-3 border border-slate-200 rounded-xl outline-none bg-white font-bold text-xs text-slate-700 cursor-pointer shadow-sm focus:ring-4 focus:ring-primary-50"
                                    >
                                        <option value="name">Student Name</option>
                                        <option value="totalScore">Total Score</option>
                                        <option value="rank">Class Position</option>
                                    </select>
                                </div>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <table className="min-w-full divide-y divide-slate-150">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Pos</th>
                                            <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                                            <th className="px-6 py-3.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Subjects</th>
                                            <th className="px-6 py-3.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Marks</th>
                                            <th className="px-6 py-3.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Average</th>
                                            <th className="px-6 py-3.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Attendance</th>
                                            <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Remarks Preview</th>
                                            <th className="px-6 py-3.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 bg-white">
                                        {processedStudents.map(student => {
                                            const studentResults = results.filter(r => r.studentId === student.id);
                                            const totalScore = studentResults.reduce((sum, r) => sum + r.total, 0);
                                            const subjCount = studentResults.filter(r => (r.total || 0) > 0 || (r as any).competency_status).length;
                                            const averageScore = subjCount > 0 ? (totalScore / subjCount).toFixed(1) : '—';
                                            const rankObj = classRanks[student.id];
                                            const savedData = allReportCards.find((r: any) => r.student_id === student.id);
                                            const sysAtt = systemAttendanceMap?.[student.id];
                                            const termTotal = examConfig?.term_total_days || localConfig?.term_total_days;
                                            const attendanceStr = isSystemAttendance
                                                ? (sysAtt !== undefined
                                                    ? `${sysAtt.present} / ${termTotal || sysAtt.total || '—'}`
                                                    : (savedData?.attendance_present !== undefined && savedData?.attendance_present !== null 
                                                        ? `${savedData.attendance_present} / ${savedData.attendance_total || termTotal || '—'}`
                                                        : `0 / ${termTotal || '—'}`))
                                                : (savedData?.attendance_present !== undefined && savedData?.attendance_present !== null 
                                                    ? `${savedData.attendance_present} / ${savedData.attendance_total || termTotal || '—'}`
                                                    : '—');

                                            return (
                                                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {rankObj?.position === 1 ? (
                                                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-100 shadow-sm">🥇 1st</span>
                                                        ) : rankObj?.position === 2 ? (
                                                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">🥈 2nd</span>
                                                        ) : rankObj?.position === 3 ? (
                                                            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-850 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-orange-100 shadow-sm">🥉 3rd</span>
                                                        ) : rankObj?.position ? (
                                                            <span className="text-xs font-black text-slate-550">{toOrdinal(rankObj.position)}</span>
                                                        ) : (
                                                            <span className="text-slate-350 text-xs font-bold">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-200/50 shadow-inner flex items-center justify-center">
                                                                {student.photo ? (
                                                                    <img src={student.photo} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <User className="h-4.5 w-4.5 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{student.name}</h4>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">ID: {student.id.substring(0, 6)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold text-slate-650">
                                                        {subjCount}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-black text-slate-800">
                                                        {totalScore}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {averageScore !== '—' ? (
                                                            <span className="text-xs font-black text-primary-700 bg-primary-50 px-2 py-1 rounded-lg border border-primary-100">{averageScore}%</span>
                                                        ) : (
                                                            <span className="text-slate-350 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold text-slate-650">
                                                        {attendanceStr !== '—' ? (
                                                            <span className={`px-2 py-0.5 rounded-md font-mono ${isSystemAttendance ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                                                                {attendanceStr}
                                                                {isSystemAttendance && <span className="ml-1 text-[9px]">⚡</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-350">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs truncate">
                                                        <span className="text-xs font-semibold text-slate-600 italic block truncate" title={savedData?.teacher_remark || ''}>
                                                            {savedData?.teacher_remark || <span className="text-slate-300 not-italic">No remark yet</span>}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <button
                                                            onClick={() => setReportStudent(student)}
                                                            className="inline-flex items-center gap-1.5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg hover:bg-primary-600 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm border-none"
                                                        >
                                                            <FileText className="w-3 h-3" /> Report
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Grid/List View */}
                            <div className="md:hidden space-y-3.5">
                                {processedStudents.map(student => {
                                    const studentResults = results.filter(r => r.studentId === student.id);
                                    const totalScore = studentResults.reduce((sum, r) => sum + r.total, 0);
                                    const rankObj = classRanks[student.id];
                                    const savedData = allReportCards.find((r: any) => r.student_id === student.id);
                                    const sysAtt = systemAttendanceMap?.[student.id];
                                    const termTotal = examConfig?.term_total_days || localConfig?.term_total_days;
                                    const attendanceStr = isSystemAttendance
                                        ? (sysAtt !== undefined
                                            ? `${sysAtt.present} / ${termTotal || sysAtt.total || '—'}`
                                            : (savedData?.attendance_present !== undefined && savedData?.attendance_present !== null 
                                                ? `${savedData.attendance_present} / ${savedData.attendance_total || termTotal || '—'}`
                                                : `0 / ${termTotal || '—'}`))
                                        : (savedData?.attendance_present !== undefined && savedData?.attendance_present !== null 
                                            ? `${savedData.attendance_present} / ${savedData.attendance_total || termTotal || '—'}`
                                            : '—');

                                    return (
                                        <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-200/50 shadow-inner flex items-center justify-center">
                                                        {student.photo ? (
                                                            <img src={student.photo} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <User className="h-4.5 w-4.5 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{student.name}</h4>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">ID: {student.id.substring(0, 6)}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    {rankObj?.position === 1 ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-100 shadow-sm">🥇 1st</span>
                                                    ) : rankObj?.position === 2 ? (
                                                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">🥈 2nd</span>
                                                    ) : rankObj?.position === 3 ? (
                                                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-850 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-orange-100 shadow-sm">🥉 3rd</span>
                                                    ) : rankObj?.position ? (
                                                        <span className="text-xs font-black text-slate-550">{toOrdinal(rankObj.position)}</span>
                                                    ) : (
                                                        <span className="text-slate-350 text-xs font-bold">—</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Score</span>
                                                    <span className="text-sm font-black text-slate-800">{totalScore}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Attendance</span>
                                                    <span className={`text-xs font-bold ${isSystemAttendance ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                        {attendanceStr}
                                                        {isSystemAttendance && attendanceStr !== '—' && <span className="ml-1 text-[9px]">⚡</span>}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setReportStudent(student)}
                                                className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-900 hover:bg-primary-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md cursor-pointer border-none"
                                            >
                                                <FileText className="w-3.5 h-3.5" /> View Report
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {processedStudents.length === 0 && (
                                <div className="p-16 text-center text-slate-400 font-bold border-4 border-dashed border-slate-100 rounded-3xl bg-white/50">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="w-8 h-8 text-slate-300" />
                                        <p>No students found matching "{searchQuery}"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                ) : teacherTab === 'standings' ? (
                    (!selectedClass) ? (
                        <div className="p-12 text-center text-slate-500 bg-white border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                            <BookOpen className="w-12 h-12 text-slate-300" />
                            <p className="text-lg font-medium">Please select a Class to view standings.</p>
                        </div>
                    ) : (
                        <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50/50">
                            {/* Search and Sort controls */}
                            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="relative w-full sm:w-80">
                                    <input 
                                        type="text" 
                                        placeholder="Search student..." 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl outline-none text-xs font-semibold text-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-50 transition-all"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Search className="w-3.5 h-3.5" />
                                    </span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center w-full sm:w-auto">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Sort Position:</span>
                                    <select 
                                        value={sortBy} 
                                        onChange={e => setSortBy(e.target.value as any)}
                                        className="w-full sm:w-auto p-2.5 px-3 border border-slate-300 rounded-xl outline-none bg-white font-bold text-xs text-slate-700 cursor-pointer shadow-sm focus:ring-4 focus:ring-primary-50"
                                    >
                                        <option value="posAsc">Position: 1st to Last (Ascending)</option>
                                        <option value="posDesc">Position: Last to 1st (Descending)</option>
                                        <option value="scoreDesc">Total Score: High to Low</option>
                                        <option value="scoreAsc">Total Score: Low to High</option>
                                        <option value="nameAsc">Name: A-Z</option>
                                    </select>
                                </div>
                            </div>

                            {/* Desktop Standings Table View */}
                            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-150 table-auto">
                                    <thead className="bg-slate-50/80">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Position</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Student Name</th>
                                            <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Total Score</th>
                                            <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Average</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 bg-white">
                                        {processedStudents.map(student => {
                                            const studentResults = results.filter(r => r.studentId === student.id);
                                            const totalScore = studentResults.reduce((sum, r) => sum + (r.total || 0), 0);
                                            const subjCount = studentResults.filter(r => (r.total || 0) > 0 || (r as any).competency_status).length;
                                            const averageScore = subjCount > 0 ? (totalScore / subjCount).toFixed(1) : '—';
                                            const rankObj = standingsRanks[student.id];

                                            return (
                                                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-2.5 whitespace-nowrap">
                                                        {rankObj?.position === 1 ? (
                                                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-100 shadow-sm">🥇 1st</span>
                                                        ) : rankObj?.position === 2 ? (
                                                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">🥈 2nd</span>
                                                        ) : rankObj?.position === 3 ? (
                                                            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-850 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-orange-100 shadow-sm">🥉 3rd</span>
                                                        ) : rankObj?.position ? (
                                                            <span className="text-xs font-black text-slate-550">{toOrdinal(rankObj.position)}</span>
                                                        ) : (
                                                            <span className="text-slate-350 text-xs font-bold">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2.5 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-slate-50 overflow-hidden shrink-0 border border-slate-200/50 shadow-inner flex items-center justify-center">
                                                                {student.photo ? (
                                                                    <img src={student.photo} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <User className="h-4.5 w-4.5 text-slate-450" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{student.name}</h4>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">ID: {student.id.substring(0, 6)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-2.5 whitespace-nowrap text-center text-sm font-black text-slate-800">
                                                        {totalScore}
                                                    </td>
                                                    <td className="px-6 py-2.5 whitespace-nowrap text-center">
                                                        {averageScore !== '—' ? (
                                                            <span className="text-xs font-black text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">{averageScore}%</span>
                                                        ) : (
                                                            <span className="text-slate-350 text-xs">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Standings Grid/List View */}
                            <div className="md:hidden space-y-3.5">
                                {processedStudents.map((student, idx) => {
                                    const studentResults = results.filter(r => r.studentId === student.id);
                                    const totalScore = studentResults.reduce((sum, r) => sum + (r.total || 0), 0);
                                    const subjCount = studentResults.filter(r => (r.total || 0) > 0 || (r as any).competency_status).length;
                                    const averageScore = subjCount > 0 ? (totalScore / subjCount).toFixed(1) : '—';
                                    const rankObj = standingsRanks[student.id];

                                    return (
                                        <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                                            {/* Rank Indicator */}
                                            <div className="absolute top-0 right-0">
                                                {rankObj?.position === 1 ? (
                                                    <div className="bg-amber-100 text-amber-800 text-[10px] font-black px-3 py-1 rounded-bl-xl border-l border-b border-amber-200 shadow-sm">🥇 1st Place</div>
                                                ) : rankObj?.position === 2 ? (
                                                    <div className="bg-slate-100 text-slate-800 text-[10px] font-black px-3 py-1 rounded-bl-xl border-l border-b border-slate-200 shadow-sm">🥈 2nd Place</div>
                                                ) : rankObj?.position === 3 ? (
                                                    <div className="bg-orange-100 text-orange-850 text-[10px] font-black px-3 py-1 rounded-bl-xl border-l border-b border-orange-200 shadow-sm">🥉 3rd Place</div>
                                                ) : rankObj?.position ? (
                                                    <div className="bg-slate-50 text-slate-500 text-[10px] font-black px-3 py-1 rounded-bl-xl border-l border-b border-slate-200 shadow-sm">{toOrdinal(rankObj.position)} Place</div>
                                                ) : null}
                                            </div>

                                            <div className="flex items-center gap-3 pt-2">
                                                <div className="h-10 w-10 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-200/50 shadow-inner flex items-center justify-center">
                                                    {student.photo ? (
                                                        <img src={student.photo} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <User className="h-5 w-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 pr-16">
                                                    <h4 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{student.name}</h4>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">ID: {student.id.substring(0, 6)}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                                                <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Score</span>
                                                    <span className="text-xl font-black text-slate-800 leading-none">{totalScore}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Average</span>
                                                    {averageScore !== '—' ? (
                                                        <span className="text-xl font-black text-primary-700 leading-none">{averageScore}%</span>
                                                    ) : (
                                                        <span className="text-slate-350 text-xl font-bold leading-none">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {processedStudents.length === 0 && (
                                <div className="p-12 text-center text-slate-455 font-bold border border-dashed border-slate-200 bg-white rounded-2xl mt-4">
                                    <p>No matching student records found</p>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    (!selectedClass || !selectedSubject) ? (
                        <div className="p-12 text-center text-slate-500 bg-white border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                            <BookOpen className="w-12 h-12 text-slate-300" />
                            {!selectedClass ? (
                                <p className="text-lg font-medium text-slate-600">Please select a Class to view or enter marks.</p>
                            ) : availableSubjects.length === 0 ? (
                                <div className="max-w-md">
                                    <p className="text-lg font-bold text-slate-700">No subjects assigned for you in this class.</p>
                                    <p className="text-sm text-slate-400 mt-1">If you teach this class, please ask your school administrator to assign your subject(s) in Courses & Classes.</p>
                                </div>
                            ) : (
                                <p className="text-lg font-medium text-slate-600">Please select a Subject from the dropdown above to start entering marks.</p>
                            )}
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
                                                                        className="w-20 p-2 text-center border rounded-md outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-3 text-center">
                                                                <input
                                                                    type="number"
                                                                    value={dispExam || ''}
                                                                    onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                                                                    className="w-20 p-2 text-center border rounded-md outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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

                {/* Global Floating Action Button & Modal */}
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
                                    {activeTool === 'attendance_present' && isSystemAttendance ? (
                                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
                                            <strong className="block font-bold text-sm mb-1 text-emerald-900 flex items-center gap-1.5">
                                                <span>⚡</span> System Sync Mode Active
                                            </strong>
                                            Attendance days are automatically calculated from the school's Daily Attendance Register. Presets and manual brush assignments are disabled in this mode.
                                        </div>
                                    ) : (
                                        (activeTool === 'performance_status' ?
                                            (reportConfig?.class_settings?.[selectedClass]?.qualitative_levels?.length > 0 ?
                                                reportConfig.class_settings[selectedClass].qualitative_levels :
                                                ['Mastered', 'Developing', 'Emerging']
                                            ) :
                                            activeTool === 'attendance_present' ?
                                                [
                                                    String(examConfig?.term_total_days || localConfig?.term_total_days || 60),
                                                    String(Math.max(1, (examConfig?.term_total_days || localConfig?.term_total_days || 60) - 1)),
                                                    String(Math.max(1, (examConfig?.term_total_days || localConfig?.term_total_days || 60) - 2)),
                                                    String(Math.max(1, (examConfig?.term_total_days || localConfig?.term_total_days || 60) - 3)),
                                                    String(Math.max(1, (examConfig?.term_total_days || localConfig?.term_total_days || 60) - 5)),
                                                    String(Math.max(1, Math.round((examConfig?.term_total_days || localConfig?.term_total_days || 60) * 0.9)))
                                                ].filter((v, i, a) => a.indexOf(v) === i) :
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
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {reportStudent && (
                <ReportCard
                    student={students.find(s => s.id === reportStudent.id)!}
                    results={getPrefilledResults(reportStudent, reportResultsRaw)}
                    layout={getLayoutForClass(reportStudent.class)}
                    schoolConfig={{
                        ...schoolInfo,
                        ...localConfig,
                        report_card_config: {
                            ...(schoolInfo?.report_card_config || {}),
                            ...(localConfig?.report_card_config || {})
                        },
                        term_total_days: localConfig?.term_total_days
                    }}
                    onClose={() => setReportStudent(null)}
                    position={studentRank || standingsRanks[reportStudent.id] || classRanks[reportStudent.id] || null}
                    schoolId={schoolId}
                    activeModules={activeModules}
                    printMode={false}
                    savedReportData={allReportCards.find((r: any) => r.student_id === reportStudent.id)}
                />
            )}
        </div>
    );
};
