import re

file_path = r"c:\Users\silas\Desktop\orbit\components\Exams.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the Teacher View block
# We look for the start: // --- TEACHER VIEW (FOR ASSIGNED SUBJECTS) ---
# down to the start of ADMIN VIEW: // --- ADMIN VIEW ---
teacher_pattern = r"(// --- TEACHER VIEW \(FOR ASSIGNED SUBJECTS\) ---\s+if \(\(currentUser\?.role \|\| ''\).toLowerCase\(\) === 'teacher'\) \{[\s\S]*?\n\s+\}\s+)(// --- ADMIN VIEW ---)"

def teacher_repl(match):
    return "// --- TEACHER VIEW (FOR ASSIGNED SUBJECTS) ---\n    // Refactored to separate component\n\n    " + match.group(2)

new_content, count1 = re.subn(teacher_pattern, teacher_repl, content)
print(f"Teacher view replacements: {count1}")

# 2. Define the context value and replace the admin view return statement
# The admin view return starts with:
# if (!localConfig && (activeTab === 'setup')) return <Loader2 className="animate-spin" />;
#
# return (
#     <div className="p-4 md:p-8 space-y-4 md:space-y-8 relative h-full pb-20 md:pb-0 overflow-y-auto">
# ...
# down to the end of ExamsInner:
#         </div>
#     );
# };
#
# const ReleaseConfigModal = ...

# Let's find: if (!localConfig && (activeTab === 'setup')) return <Loader2 className="animate-spin" />;
# and replace everything from that line to the end of the ExamsInner function.
# The ExamsInner function ends right before "const ReleaseConfigModal" or similar.

admin_start_str = "if (!localConfig && (activeTab === 'setup')) return <Loader2 className=\"animate-spin\" />;"
admin_end_str = "};\n\nconst ReleaseConfigModal"

start_idx = new_content.find(admin_start_str)
end_idx = new_content.find(admin_end_str)

if start_idx != -1 and end_idx != -1:
    before_admin = new_content[:start_idx]
    after_admin = new_content[end_idx:]
    
    # Let's insert the context provider wrap and modular panels rendering
    modular_admin_block = """const contextValue: ExamsContextValue = {
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
        resetSubjectMarksMutation,
        handleSaveConfig,
        handleConfirmRelease,
        handleSubmitMarks,
        handleResetSubjectMarks,
        saveMarks,
        saveBulkRemarks,
        handleScoreChange,
        handleRemarkChange,
        handleNurseryCompetencyChange,
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
        currentYear,
        customLevels,
        setCustomLevels
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
                            <button onClick={() => { setActiveTab('monitoring'); setSelectedClass(''); }} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                <ClipboardCheck className="w-4 h-4" /> <span className="hidden sm:inline">2. Submission Tracking</span><span className="sm:hidden">Status</span>
                            </button>
                            <div className="w-px bg-slate-300 my-2 mx-1 hidden sm:block"></div>
                            <button onClick={() => setActiveTab('publishing')} className={`flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'publishing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Send className="w-4 h-4" /> <span className="hidden sm:inline">3. Publish & Reports</span><span className="sm:hidden">Publish</span>
                            </button>
                        </div>
                    </div>

                    {/* Modular Panels */}
                    <ExamSetupPanel />
                    <ExamMonitoringPanel />
                    <ExamPublishingPanel />
                </div>
            )}

            {/* Hidden Bulk Print Container */}
            {isBulkPrinting && viewingClassList && (
                <div style={{ display: 'none' }}>
                    <div ref={bulkPrintRef} className="print:block">
                        {(students as Student[]).filter(s => s.class === viewingClassList).map((student) => (
                            <ReportCard
                                key={student.id}
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
"""
    new_content = before_admin + modular_admin_block + after_admin
    print("Admin view replaced successfully!")
else:
    print(f"Error: indices not found: start={start_idx}, end={end_idx}")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Exams.tsx refactored successfully!")
