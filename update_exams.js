const fs = require('fs');

const path = 'c:/Users/silas/Desktop/orbit/components/Exams.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Icons
if (!content.includes('MessageSquare')) {
    content = content.replace(/import \{([^}]+)\} from 'lucide-react';/, (match, p1) => {
        return `import {${p1}, MessageSquare, Plus, Check, CheckCircle} from 'lucide-react';`;
    });
}

// 2. Add Hooks for Teacher Assignment
const hookDecl = `    const [teacherTab, setTeacherTab] = useState<'marks' | 'remarks'>('marks');
    const [activeTool, setActiveTool] = useState<'teacher_remark'|'conduct'|'interest'>('teacher_remark');
    const [paintBrush, setPaintBrush] = useState<string>('');
    const [userPresets, setUserPresets] = useState<string[]>([]);
    const [conductPresets, setConductPresets] = useState<string[]>(["Excellent", "Very Good", "Satisfactory", "Good", "Fair", "Needs Improvement"]);
    const [interestPresets, setInterestPresets] = useState<string[]>(["Reading / Comm.", "Mathematics", "Science & Tech", "Arts / Creatives", "Sports / Athletics", "Music"]);
    const [newPresetValue, setNewPresetValue] = useState("");
    const [pendingRemarks, setPendingRemarks] = useState<Record<string, Record<string, any>>>({});
`;
content = content.replace(
    /const \[pendingChanges, setPendingChanges\] = useState<Record<string, \{ classScore: number; examScore: number \}>\>\(\{\}\);/,
    `const [pendingChanges, setPendingChanges] = useState<Record<string, { classScore: number; examScore: number }>>({});\n${hookDecl}`
);

// 3. Add Mutation and fetch for Reports (needed for remarks)
const reportHooks = `    // Reports for remarks
    const { data: allReportCards = [] } = useQuery({
        queryKey: ['reportCards', schoolId],
        queryFn: async () => {
            const { data } = await supabase
                .from('student_reports')
                .select('*')
                .eq('school_id', schoolId)
                .eq('term', currentTerm)
                .eq('academic_year', currentYear);
            return data || [];
        },
        enabled: !!schoolId
    });

    const saveBulkRemarksMutation = useMutation({
        mutationFn: async (updates: any[]) => {
            const { error } = await supabase.rpc('save_student_reports_bulk', {
                payload: updates
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reportCards', schoolId] });
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

    const saveBulkRemarks = () => {
        if (!selectedClass) return alert("Select Class");
        const updates = Object.entries(pendingRemarks).map(([studentId, val]: [string, any]) => {
            const sr = allReportCards.find((r: any) => r.student_id === studentId);
            return {
                p_school_id: schoolId,
                p_student_id: studentId,
                p_term: currentTerm,
                p_year: currentYear,
                p_teacher_remark: val.teacher_remark ?? sr?.teacher_remark,
                p_head_remark: sr?.head_remark,
                p_conduct: val.conduct ?? sr?.conduct,
                p_interest: val.interest ?? sr?.interest,
                p_attendance_present: sr?.attendance_present ?? 0,
                p_attendance_total: sr?.attendance_total ?? (localConfig?.term_total_days || 0),
                p_promoted_to: sr?.promoted_to
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
`;

content = content.replace(
    /const handleSubmitMarks = /g,
    `${reportHooks}    const handleSubmitMarks = `
);

// Fallback in case handleSubmitMarks doesn't match for injection
if (!content.includes('saveBulkRemarksMutation')) {
    content = content.replace(
        /const submitMarksMutation = useMutation\(\{/g,
        `${reportHooks}    const submitMarksMutation = useMutation({`
    );
}


// 4. Update the Teacher UI
const oldTeacherView = `    // --- TEACHER VIEW ---
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
                                className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save
                            </button>
                            <button
                                onClick={handleSubmitMarks}
                                disabled={saveMarksMutation.isPending || submitMarksMutation.isPending}
                                className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                Submit Marks
                            </button>
                        </div>
                    </div>

                    {(!selectedClass || !selectedSubject) ? (
                        <div className="p-12 text-center text-slate-500">
                            Select both Class and Subject to start entering marks
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto">`;

const newTeacherView = `    // --- TEACHER VIEW ---
    if (currentUser?.role === 'teacher') {
        const isClassTeacher = myAssignments.some((a: any) => a.isClassTeacher && a.className === selectedClass);
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

                    {isClassTeacher && !!selectedClass && (
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
                            <button
                                onClick={() => setTeacherTab('marks')}
                                className={\`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 \${teacherTab === 'marks' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}\`}
                            >
                                <PlusCircle className="w-4 h-4" /> Mark Entry
                            </button>
                            <button
                                onClick={() => setTeacherTab('remarks')}
                                className={\`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 \${teacherTab === 'remarks' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}\`}
                            >
                                <MessageSquare className="w-4 h-4" /> Remarks & Conduct
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                    {/* Toolbar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center bg-slate-50">
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                                <select value={selectedClass} onChange={e => {setSelectedClass(e.target.value); setSelectedSubject('');}} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-32 cursor-pointer font-bold">
                                    <option value="">-- Class --</option>
                                    {myAssignments.map((a: any, i: number) => <option key={i} value={a.className}>{a.className}</option>)}
                                </select>
                            </div>
                            {teacherTab === 'marks' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!selectedClass} className="p-2 border border-slate-300 rounded-lg outline-none bg-white w-48 cursor-pointer disabled:opacity-50">
                                        <option value="">Select Subject</option>
                                        {availableSubjects.map((s: any) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {teacherTab === 'remarks' ? (
                                <button
                                    onClick={saveBulkRemarks}
                                    disabled={Object.keys(pendingRemarks).length === 0 || saveBulkRemarksMutation.isPending}
                                    className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save Remarks
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={saveMarks}
                                        disabled={Object.keys(pendingChanges).length === 0 || saveMarksMutation.isPending || submitMarksMutation.isPending}
                                        className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Save
                                    </button>
                                    <button
                                        onClick={handleSubmitMarks}
                                        disabled={saveMarksMutation.isPending || submitMarksMutation.isPending}
                                        className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        Submit Marks
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {teacherTab === 'remarks' ? (
                        <div className="flex-1 flex flex-col md:flex-row min-h-[600px] bg-slate-50 relative">
                            {/* Left Panel: The Preset Pool */}
                            <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-[400px] md:h-auto overflow-y-auto shrink-0 shadow-sm z-10">
                                <div className="p-4 border-b border-slate-100 bg-slate-50 sticky top-0">
                                    <h4 className="font-black text-slate-800 tracking-tight mb-3 uppercase text-xs">1. Select Target Field</h4>
                                    <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1">
                                        {[
                                            { id: 'teacher_remark', label: 'Remarks' },
                                            { id: 'conduct', label: 'Conduct' },
                                            { id: 'interest', label: 'Interest' }
                                        ].map(t => (
                                            <button 
                                                key={t.id} 
                                                onClick={() => { setActiveTool(t.id as any); setPaintBrush(''); }}
                                                className={\`flex-1 text-[10px] font-bold py-1.5 rounded uppercase tracking-wider transition-all \${activeTool === t.id ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-200/50'}\`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="p-4 flex-1">
                                    <h4 className="font-black text-slate-800 tracking-tight mb-3 uppercase text-xs flex justify-between items-center">
                                        2. Choose a Value
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4 border-l-2 border-primary-400 pl-2">
                                        Click a preset below to equip it, then tap students to assign.
                                    </p>
                                    
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            type="text" 
                                            value={newPresetValue}
                                            onChange={e => setNewPresetValue(e.target.value)}
                                            placeholder="Type custom here..."
                                            className="flex-1 text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary-400 max-w-full"
                                            onKeyDown={e => {
                                                if(e.key === 'Enter' && newPresetValue) {
                                                    if(activeTool === 'teacher_remark') setUserPresets(p => [...p, newPresetValue]);
                                                    if(activeTool === 'conduct') setConductPresets(p => [...p, newPresetValue]);
                                                    if(activeTool === 'interest') setInterestPresets(p => [...p, newPresetValue]);
                                                    setPaintBrush(newPresetValue);
                                                    setNewPresetValue('');
                                                }
                                            }}
                                        />
                                        <button 
                                            onClick={() => {
                                                if(newPresetValue) {
                                                    if(activeTool === 'teacher_remark') setUserPresets(p => [...p, newPresetValue]);
                                                    if(activeTool === 'conduct') setConductPresets(p => [...p, newPresetValue]);
                                                    if(activeTool === 'interest') setInterestPresets(p => [...p, newPresetValue]);
                                                    setPaintBrush(newPresetValue);
                                                    setNewPresetValue('');
                                                }
                                            }}
                                            className="bg-slate-800 text-white p-2 rounded shrink-0"
                                        >
                                            <Plus className="w-4 h-4"/>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {(activeTool === 'teacher_remark' ? allPresets : activeTool === 'conduct' ? conductPresets : interestPresets).map((preset, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => setPaintBrush(preset)}
                                                className={\`w-full text-left p-3 rounded-xl border-2 transition-all \${paintBrush === preset ? 'border-primary-500 bg-primary-50/50 shadow-sm relative' : 'border-slate-100 hover:border-slate-300 bg-white'}\`}
                                            >
                                                <span className={\`text-xs font-bold leading-tight block pr-6 \${paintBrush === preset ? 'text-primary-800' : 'text-slate-600'}\`}>{preset}</span>
                                                {paintBrush === preset && <CheckCircle className="w-4 h-4 text-primary-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right Panel: Student Grid */}
                            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h4 className="font-black text-slate-800 tracking-tight uppercase text-xs mb-1">3. Tap to Assign</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            Active Brush: <span className="text-primary-600 border border-primary-200 bg-primary-50 px-2 py-0.5 rounded ml-1 max-w-[200px] truncate inline-block align-bottom">{paintBrush || 'None'}</span>
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if(!paintBrush) return;
                                            classStudents.forEach(s => handleRemarkChange(s.id, activeTool, paintBrush));
                                        }}
                                        disabled={!paintBrush || classStudents.length === 0}
                                        className="text-[10px] font-black uppercase bg-slate-800 text-white px-3 py-1.5 rounded shadow-sm hover:bg-slate-900 transition-colors disabled:opacity-50"
                                    >
                                        Assign to All
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {classStudents.map(student => {
                                        const saved = allReportCards.find((r: any) => r.student_id === student.id);
                                        const pending = pendingRemarks[student.id] || {};
                                        
                                        const currentVal = pending[activeTool] ?? saved?.[activeTool] ?? '';
                                        
                                        return (
                                            <button 
                                                key={student.id}
                                                onClick={() => {
                                                    if(paintBrush) handleRemarkChange(student.id, activeTool, paintBrush);
                                                }}
                                                className={\`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between group \${paintBrush && currentVal !== paintBrush ? 'hover:border-primary-400 hover:shadow-md cursor-pointer' : ''} \${currentVal ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed'}\`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-sm">{student.name}</h5>
                                                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{student.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-50 p-2 rounded border border-slate-100 min-h-[40px] flex items-center justify-between group-hover:bg-primary-50/30 transition-colors">
                                                    <span className={\`text-xs font-bold leading-tight \${currentVal ? 'text-slate-600' : 'text-slate-400 italic'}\`}>
                                                        {currentVal || \`No \${activeTool.replace('_', ' ')}\`}
                                                    </span>
                                                    {paintBrush && currentVal !== paintBrush && (
                                                        <div className="w-6 h-6 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Check className="w-3 h-3 text-primary-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : ( 
                        (!selectedClass || !selectedSubject) ? (
                            <div className="p-12 text-center text-slate-500">
                                Select both Class and Subject to start entering marks
                            </div>
                        ) : (
                            <>
                                <div className="hidden md:block overflow-x-auto">`;

content = content.replace(oldTeacherView, newTeacherView);

fs.writeFileSync(path, content);
console.log("Successfully updated Exams.tsx");
