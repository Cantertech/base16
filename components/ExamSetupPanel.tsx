import ReportCard from './ReportCard';
import React, { useState } from 'react';
import {
    AlertCircle,
    Calendar,
    X,
    PlusCircle,
    Upload,
    Loader2,
    CheckCircle,
    Plus,
    Save,
    Settings,
    Award,
    Layers,
    Image as ImageIcon,
    FileText,
    Search,
    LayoutTemplate,
    Lock,
    User,
    Table2,
    Camera,
    Hash,
    CalendarCheck,
    MessageSquare,
    GraduationCap,
    BarChart3,
    PenLine,
    NotebookText
} from 'lucide-react';
import { useExamsContext } from './ExamsContext';


const MOCK_PREVIEW_STUDENT = {
    id: "preview-123",
    name: "Osei Bonsu Eden Obeng",
    class: "Class 5B",
    attendance: 70
};

const MOCK_PREVIEW_RESULTS = [
    { subject: "English Language", classScore: 39, examScore: 23, total: 62 },
    { subject: "History", classScore: 38, examScore: 20, total: 58 },
    { subject: "Creative Art", classScore: 43, examScore: 39, total: 82 },
    { subject: "Computing", classScore: 40, examScore: 38, total: 78 },
    { subject: "Mathematics", classScore: 22, examScore: 19, total: 41 }
];

const GRADING_PRESETS = {
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

export const ExamSetupPanel: React.FC = () => {
    const {
        activeTab,
        localConfig,
        setLocalConfig,
        isUploadingImage,
        handleImageUpload,
        availableClasses,
        handleSaveConfig,
        saveConfigMutation
    } = useExamsContext();

    const [activeSubTab, setActiveSubTab] = useState<'general' | 'grading' | 'design' | 'layouts' | 'branding' | 'global'>('general');
    const [classSearchQuery, setClassSearchQuery] = useState('');
    const [previewLayout, setPreviewLayout] = useState<string | null>(null);

    if (activeTab !== 'setup' || !localConfig) return null;

    const filteredClasses = [...availableClasses]
        .sort()
        .filter(cls => cls.toLowerCase().includes(classSearchQuery.toLowerCase()));

    const subTabs = [
        { id: 'general', label: 'General & Weights', icon: Settings },
        { id: 'grading', label: 'Grading Scales', icon: Award },
        { id: 'design', label: 'Exams Report Design', icon: FileText },
        { id: 'layouts', label: 'Class Layouts', icon: Layers },
        { id: 'branding', label: 'Signature & Stamp', icon: ImageIcon },
        { id: 'global', label: 'Report Config', icon: LayoutTemplate }
    ] as const;

    const renderPanelHeader = (title: string, description: string, extraActions?: React.ReactNode) => (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div>
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                {extraActions}
                <button 
                    onClick={() => handleSaveConfig(localConfig)} 
                    disabled={saveConfigMutation.isPending} 
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                    {saveConfigMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                    Save Changes
                </button>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Main Setup Card with Tabbed Sidebar Layout */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row min-h-[600px]">
                
                {/* Sidebar Sub-Tabs */}
                <div className="w-full md:w-64 bg-slate-50/75 border-b md:border-b-0 md:border-r border-slate-200 p-4 space-y-1 shrink-0 md:sticky md:top-24 self-start rounded-t-2xl md:rounded-t-none md:rounded-l-2xl">
                    <span className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">Settings Navigation</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-col gap-1.5 pb-1 md:pb-0">
                        {subTabs.map(tab => {
                            const IconComponent = tab.icon;
                            const isActive = activeSubTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveSubTab(tab.id)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all w-full text-left ${
                                        isActive 
                                            ? 'bg-primary-55 text-primary-650 shadow-sm border border-primary-100/50 font-bold' 
                                            : 'text-slate-650 hover:bg-slate-200/50 hover:text-slate-900'
                                    }`}
                                >
                                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Sub-Tab Panel Content */}
                <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
                    
                    {/* General & Weights Sub-Tab */}
                    {activeSubTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {renderPanelHeader('General Information', 'Academic session metadata and grade composition weights.')}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Exam Name</label>
                                    <input 
                                        type="text" 
                                        value={localConfig.exam_name || ''} 
                                        onChange={e => setLocalConfig({ ...localConfig, exam_name: e.target.value })} 
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-slate-800 text-sm font-semibold"
                                        placeholder="e.g. End of Term Examination"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Term & Academic Year</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={localConfig.current_term || ''} 
                                            onChange={e => setLocalConfig({ ...localConfig, current_term: e.target.value })} 
                                            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-slate-800 text-sm font-semibold"
                                        >
                                            <option>First Term</option> 
                                            <option>Second Term</option> 
                                            <option>Third Term</option>
                                        </select>
                                        <input 
                                            type="text" 
                                            value={localConfig.academic_year || ''} 
                                            onChange={e => setLocalConfig({ ...localConfig, academic_year: e.target.value })} 
                                            className="w-1/2 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-slate-800 text-sm font-semibold text-center" 
                                            placeholder="e.g. 2023/2024" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 space-y-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assessment Weights</h4>
                                    <p className="text-xs text-slate-500">Define how class assessments and final examinations contribute to the student's cumulative grade.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 max-w-md">
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class Score (%)</label>
                                        <input
                                            type="number"
                                            min="0" max="100"
                                            value={localConfig.weights?.class || 0}
                                            onChange={e => {
                                                const val = Math.max(0, Math.min(100, Number(e.target.value)));
                                                setLocalConfig({ ...localConfig, weights: { class: val, exam: 100 - val } });
                                            }}
                                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-bold text-lg text-center bg-white"
                                        />
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exam Score (%)</label>
                                        <input
                                            type="number"
                                            min="0" max="100"
                                            value={localConfig.weights?.exam || 0}
                                            onChange={e => {
                                                const val = Math.max(0, Math.min(100, Number(e.target.value)));
                                                setLocalConfig({ ...localConfig, weights: { class: 100 - val, exam: val } });
                                            }}
                                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-bold text-lg text-center bg-white"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-primary-500" /> Assessment weights must add up to exactly 100%.
                                </p>
                            </div>

                            <div className="pt-6 border-t border-slate-100 space-y-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Attendance Rules</h4>
                                    <p className="text-xs text-slate-500">Determine whether attendance days are sourced from a database table or typed manually.</p>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-primary-500" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">Attendance Data Feed</p>
                                            <p className="text-xs text-slate-400">Toggle method for fetching total attendance metrics.</p>
                                        </div>
                                    </div>

                                    <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1 shrink-0">
                                        {[
                                            { id: 'manual', label: 'Manual Input' },
                                            { id: 'system', label: 'System Sync' }
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                onClick={() => setLocalConfig({ ...localConfig, attendance_mode: mode.id as any })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    localConfig.attendance_mode === mode.id 
                                                        ? 'bg-primary-600 text-white shadow-sm' 
                                                        : 'text-slate-650 hover:text-slate-900'
                                                }`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Grading Scales Sub-Tab */}
                    {activeSubTab === 'grading' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {renderPanelHeader('Grading Scheme & Benchmarks', 'Configure numeric boundaries and performance labels.', (
                                <div className="flex items-center gap-2 mr-2">
                                    <span className="text-xs font-bold text-slate-550 uppercase tracking-wider">Select Schema:</span>
                                    <select
                                        value={localConfig.grading_type || 'STANDARD'}
                                        onChange={(e) => {
                                            const type = e.target.value as 'STANDARD' | 'COMPETENCY';
                                            setLocalConfig({
                                                ...localConfig,
                                                grading_type: type,
                                                grading: GRADING_PRESETS[type]
                                            });
                                        }}
                                        className="text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold outline-none"
                                    >
                                        <option value="STANDARD">Standard (A-F)</option>
                                        <option value="COMPETENCY">Competency (EE-BE)</option>
                                    </select>
                                </div>
                            ))}

                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-2 text-center">Grade</div>
                                    <div className="col-span-3 text-center">Score Range (Min - Max)</div>
                                    <div className="col-span-5">Remark / Description</div>
                                    <div className="col-span-1 text-center">GP</div>
                                    <div className="col-span-1 text-center">Action</div>
                                </div>

                                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto bg-white">
                                    {localConfig.grading?.map((g: any, idx: number) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center text-sm">
                                            <div className="col-span-2">
                                                <input 
                                                    type="text" 
                                                    value={g.grade} 
                                                    placeholder="A" 
                                                    onChange={(e) => {
                                                        const newGrading = [...localConfig.grading];
                                                        newGrading[idx] = { ...newGrading[idx], grade: e.target.value };
                                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                                    }} 
                                                    className="w-full p-2 border border-slate-200 rounded-lg font-bold text-center text-slate-800 bg-white focus:border-primary-500 outline-none" 
                                                />
                                            </div>

                                            <div className="col-span-3 flex items-center gap-1.5">
                                                <input 
                                                    type="number" 
                                                    value={g.min} 
                                                    placeholder="Min" 
                                                    onChange={(e) => {
                                                        const newGrading = [...localConfig.grading];
                                                        newGrading[idx] = { ...newGrading[idx], min: Number(e.target.value) };
                                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                                    }} 
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-700 bg-white focus:border-primary-500 outline-none" 
                                                />
                                                <span className="text-slate-300 font-bold">-</span>
                                                <input 
                                                    type="number" 
                                                    value={g.max} 
                                                    placeholder="Max" 
                                                    onChange={(e) => {
                                                        const newGrading = [...localConfig.grading];
                                                        newGrading[idx] = { ...newGrading[idx], max: Number(e.target.value) };
                                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                                    }} 
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-700 bg-white focus:border-primary-500 outline-none" 
                                                />
                                            </div>

                                            <div className="col-span-5">
                                                <input 
                                                    type="text" 
                                                    value={g.remark} 
                                                    placeholder="e.g. Excellent Work" 
                                                    onChange={(e) => {
                                                        const newGrading = [...localConfig.grading];
                                                        newGrading[idx] = { ...newGrading[idx], remark: e.target.value };
                                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                                    }} 
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-700 bg-white focus:border-primary-500 outline-none" 
                                                />
                                            </div>

                                            <div className="col-span-1">
                                                <input 
                                                    type="number" 
                                                    step="0.1" 
                                                    value={g.points} 
                                                    onChange={(e) => {
                                                        const newGrading = [...localConfig.grading];
                                                        newGrading[idx] = { ...newGrading[idx], points: Number(e.target.value) };
                                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                                    }} 
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-750 bg-white focus:border-primary-500 outline-none" 
                                                    placeholder="GP" 
                                                />
                                            </div>

                                            <div className="col-span-1 flex justify-center">
                                                <button
                                                    onClick={() => {
                                                        const newGrading = localConfig.grading.filter((_: any, i: number) => i !== idx);
                                                        setLocalConfig({ ...localConfig, grading: newGrading });
                                                    }}
                                                    className="p-1.5 text-slate-450 hover:text-red-650 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const newGrading = [...(localConfig.grading || []), { grade: "", min: 0, max: 0, remark: "", points: 0 }];
                                    setLocalConfig({ ...localConfig, grading: newGrading });
                                }}
                                className="w-full py-3 border border-dashed border-slate-350 hover:border-primary-500 rounded-xl text-xs font-semibold text-slate-500 hover:text-primary-700 hover:bg-primary-50/20 transition-all flex items-center justify-center gap-1.5"
                            >
                                <PlusCircle className="w-4 h-4" /> Add Custom Grade Level
                            </button>
                        </div>
                    )}

                    {/* Class Layouts Sub-Tab */}
                    {activeSubTab === 'layouts' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {renderPanelHeader('Class Report Layout Routing', 'Route specific report template layouts to target classes.', (
                                <div className="flex items-center gap-2 mr-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batch Assign:</span>
                                    {['modern', 'classic_tabular', 'nursery', 'adventist', 'compact'].map(layoutId => (
                                        <button
                                            key={layoutId}
                                            type="button"
                                            onClick={() => {
                                                const newMap: any = {};
                                                availableClasses.forEach(c => newMap[c] = layoutId);
                                                setLocalConfig({
                                                    ...localConfig,
                                                    report_card_config: {
                                                        ...(localConfig.report_card_config || {}),
                                                        class_layouts: newMap
                                                    }
                                                });
                                            }}
                                            className="bg-slate-100 hover:bg-primary-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:text-primary-700 transition-all"
                                        >
                                            {layoutId === 'modern' ? 'Standard' : (layoutId === 'classic_tabular' ? 'Classic' : (layoutId === 'nursery' ? 'Nursery' : (layoutId === 'adventist' ? 'Chart' : 'Minimalist')))}
                                        </button>
                                    ))}
                                </div>
                            ))}

                            {/* Search bar inside Layout routing */}
                            <div className="relative">
                                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filter by class name..."
                                    value={classSearchQuery}
                                    onChange={e => setClassSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm font-medium"
                                />
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-4">Class Room</div>
                                    <div className="col-span-8">Assigned Template Layout</div>
                                </div>

                                <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto bg-white">
                                    {filteredClasses.length > 0 ? (
                                        filteredClasses.map(className => {
                                            const currentLayout = localConfig?.report_card_config?.class_layouts?.[className] || 'modern';
                                            return (
                                                <div key={className} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center text-sm hover:bg-slate-50/50">
                                                    <div className="col-span-4 font-bold text-slate-800">
                                                        {className}
                                                    </div>
                                                    <div className="col-span-8 flex gap-2">
                                                        {[
                                                            { id: 'modern', label: 'Standard' },
                                                            { id: 'classic_tabular', label: 'Classic' },
                                                            { id: 'nursery', label: 'Nursery' },
                                                            { id: 'adventist', label: 'Chart' },
                                                            { id: 'compact', label: 'Minimal' }
                                                        ].map(layout => {
                                                            const isSelected = currentLayout === layout.id;
                                                            return (
                                                                <button
                                                                    key={layout.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const currentMap = localConfig?.report_card_config?.class_layouts || {};
                                                                        setLocalConfig({
                                                                            ...localConfig,
                                                                            report_card_config: {
                                                                                ...(localConfig.report_card_config || {}),
                                                                                class_layouts: {
                                                                                    ...currentMap,
                                                                                    [className]: layout.id
                                                                                }
                                                                            }
                                                                        });
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                                        isSelected 
                                                                            ? 'bg-primary-50 border-primary-300 text-primary-750 font-bold' 
                                                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    {layout.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs font-medium">
                                            No matching classes found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Exams Report Design Sub-Tab */}
                    {activeSubTab === 'design' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {renderPanelHeader('Exams Report Design', 'Choose a default layout template for student terminal report cards.')}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {[
                                    { id: 'modern', name: 'Standard Modern', desc: 'Clean sans-serif fonts, blue/slate brand highlights, rounded status badges.', badge: 'Standard' },
                                    { id: 'classic_tabular', name: 'Classic Tabular', desc: 'Traditional institutional layout, high-contrast black borders, classic layout grid.', badge: 'Classic' },
                                    { id: 'nursery', name: 'Nursery Narrative', desc: 'Georgia serif fonts, narrative developmental milestones, decorative corner frames.', badge: 'Nursery' },
                                    { id: 'adventist', name: 'Chart-Integrated Classic', desc: 'Inspired by J.A. Boateng. Features dynamic horizontal bar charts mapping subject scores.', badge: 'New/Chart' },
                                    { id: 'compact', name: 'Compact Minimalist', desc: 'High-contrast grid lines, minimalist layout structure optimized to fit single-page print constraints.', badge: 'Minimalist' }
                                ].map(template => {
                                    const isSelected = (localConfig?.report_card_config?.layout || 'modern') === template.id;
                                    return (
                                        <button
                                            key={template.id}
                                            type="button"
                                            onClick={() => {
                                                setLocalConfig({
                                                    ...localConfig,
                                                    report_card_config: {
                                                        ...(localConfig.report_card_config || {}),
                                                        layout: template.id
                                                    }
                                                });
                                            }}
                                            className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between h-44 group ${
                                                isSelected 
                                                    ? 'bg-primary-50/30 border-primary-500 shadow-sm' 
                                                    : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/30'
                                            }`}
                                        >
                                            <div className="space-y-2 w-full">
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        isSelected ? 'bg-primary-100 text-primary-750' : 'bg-slate-100 text-slate-650'
                                                    }`}>
                                                        {template.badge}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="w-2.5 h-2.5 bg-primary-600 rounded-full"></span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-primary-650 transition-colors">{template.name}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-snug">{template.desc}</p>
                                            </div>
                                            <div className="w-full mt-2 space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewLayout(template.id);
                                                    }}
                                                    className="w-full py-1.5 border border-slate-300 hover:border-primary-500 hover:text-primary-600 text-[10px] font-black uppercase rounded-xl text-center transition-all bg-white"
                                                >
                                                    Preview Design
                                                </button>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center block">
                                                    {isSelected ? 'Active Default Layout' : 'Click Card to Set Default'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Branding Sub-Tab */}
                    {activeSubTab === 'branding' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {renderPanelHeader('Branding & School Metadata', 'Configure signature, seal and academic default dates.')}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Total Attendance Days</label>
                                    <input
                                        type="number"
                                        value={localConfig.term_total_days || ''}
                                        onChange={e => setLocalConfig({ ...localConfig, term_total_days: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-slate-850 text-sm font-semibold"
                                        placeholder="e.g. 75"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Next Term Reopens</label>
                                    <input
                                        type="text"
                                        value={localConfig.next_term_reopens || ''}
                                        onChange={e => setLocalConfig({ ...localConfig, next_term_reopens: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-slate-855 text-sm font-semibold"
                                        placeholder="e.g. 15th Jan, 2024"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Headmaster Default Remarks</label>
                                <textarea
                                    value={localConfig.report_card_config?.headmaster_decision || localConfig.headmaster_decision || ''}
                                    onChange={e => setLocalConfig({ 
                                        ...localConfig, 
                                        report_card_config: { 
                                            ...(localConfig.report_card_config || {}), 
                                            headmaster_decision: e.target.value 
                                        } 
                                    })}
                                    className="w-full p-4 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm font-semibold h-20 resize-none"
                                    placeholder="e.g. Promoted to Next Class..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                {/* Signature Section */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Headmaster Signature</label>
                                        {localConfig.report_card_config?.signature_url && (
                                            <button 
                                                onClick={() => setLocalConfig({...localConfig, report_card_config: {...localConfig.report_card_config, signature_url: null}})}
                                                className="text-xs font-semibold text-red-500 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 hover:border-primary-450 hover:bg-slate-50/50 rounded-2xl cursor-pointer transition-all overflow-hidden relative">
                                        {isUploadingImage === 'signature_url' ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary-500 mb-2" />
                                                <span className="text-xs font-semibold text-slate-400">Uploading...</span>
                                            </div>
                                        ) : localConfig.report_card_config?.signature_url ? (
                                            <img src={localConfig.report_card_config.signature_url} alt="Signature" className="h-full w-full object-contain p-4 contrast-125" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center">
                                                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                                                <p className="text-xs font-semibold text-slate-500">Upload Signature Image</p>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'signature_url')} />
                                    </label>
                                </div>

                                {/* Stamp Section */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">School Stamp or Seal</label>
                                        {localConfig.report_card_config?.stamp_url && (
                                            <button 
                                                onClick={() => setLocalConfig({...localConfig, report_card_config: {...localConfig.report_card_config, stamp_url: null}})}
                                                className="text-xs font-semibold text-red-500 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 hover:border-indigo-450 hover:bg-slate-50/50 rounded-2xl cursor-pointer transition-all overflow-hidden relative">
                                        {isUploadingImage === 'stamp_url' ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary-500 mb-2" />
                                                <span className="text-xs font-semibold text-slate-400">Uploading...</span>
                                            </div>
                                        ) : localConfig.report_card_config?.stamp_url ? (
                                            <img src={localConfig.report_card_config.stamp_url} alt="School Stamp" className="h-full w-full object-contain p-4 grayscale contrast-150" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center">
                                                <CheckCircle className="w-6 h-6 text-slate-400 mb-2" />
                                                <p className="text-xs font-semibold text-slate-500">Upload Stamp Image</p>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'stamp_url')} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Report Configuration Sub-Tab */}
                    {activeSubTab === 'global' && (() => {
                        const rcConfig = localConfig?.report_card_config || {};

                        const setRcFlag = (key: string, value: boolean) => {
                            setLocalConfig({
                                ...localConfig,
                                report_card_config: {
                                    ...rcConfig,
                                    [key]: value
                                }
                            });
                        };

                        const isOn = (key: string) => rcConfig[key] !== false;

                        // iOS-style toggle button component
                        const Toggle = ({ flagKey, locked }: { flagKey: string; locked?: boolean }) => {
                            const on = isOn(flagKey);
                            return (
                                <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => !locked && setRcFlag(flagKey, !on)}
                                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${
                                        locked
                                            ? 'cursor-not-allowed bg-primary-500 opacity-60'
                                            : on
                                                ? 'bg-primary-600 shadow-inner shadow-primary-800/30 cursor-pointer'
                                                : 'bg-slate-200 cursor-pointer hover:bg-slate-300'
                                    }`}
                                    aria-checked={on}
                                    role="switch"
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ${
                                            on ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            );
                        };

                        type SectionRow = {
                            icon: React.ElementType;
                            iconBg: string;
                            label: string;
                            description: string;
                            flagKey: string;
                            locked?: boolean;
                        };

                        const lockedSections: SectionRow[] = [
                            {
                                icon: User,
                                iconBg: 'bg-blue-100 text-blue-600',
                                label: 'Student Identity',
                                description: 'Student name, class, enrollment number and academic period.',
                                flagKey: 'student_identity',
                                locked: true
                            },
                            {
                                icon: Table2,
                                iconBg: 'bg-indigo-100 text-indigo-600',
                                label: 'Subject Marks Table',
                                description: 'Full table of subjects with class scores, exam scores, totals, grades and remarks.',
                                flagKey: 'marks_table',
                                locked: true
                            },
                        ];

                        const optionalSections: SectionRow[] = [
                            {
                                icon: Camera,
                                iconBg: 'bg-violet-100 text-violet-600',
                                label: 'Student Photo',
                                description: 'Show the student\'s passport photo on the report card header.',
                                flagKey: 'show_student_photo'
                            },
                            {
                                icon: Hash,
                                iconBg: 'bg-amber-100 text-amber-600',
                                label: 'Class Position & Rank',
                                description: 'Display the student\'s overall rank within their class (e.g. 3rd out of 48).',
                                flagKey: 'show_position'
                            },
                            {
                                icon: CalendarCheck,
                                iconBg: 'bg-green-100 text-green-600',
                                label: 'Attendance Record',
                                description: 'Show number of days present out of total school days in the term.',
                                flagKey: 'show_attendance'
                            },
                            {
                                icon: BarChart3,
                                iconBg: 'bg-cyan-100 text-cyan-600',
                                label: 'Overall Average & GPA',
                                description: 'Show the aggregate score, overall average percentage and Grade Point Average.',
                                flagKey: 'show_aggregate'
                            },
                            {
                                icon: MessageSquare,
                                iconBg: 'bg-orange-100 text-orange-600',
                                label: 'Class Teacher Remark',
                                description: 'Include a freeform comment from the subject or class teacher.',
                                flagKey: 'show_class_teacher_remark'
                            },
                            {
                                icon: GraduationCap,
                                iconBg: 'bg-red-100 text-red-600',
                                label: 'Head Teacher / Principal Remark',
                                description: 'Include the headmaster\'s final decision and endorsement field.',
                                flagKey: 'show_head_teacher_remark'
                            },
                            {
                                icon: PenLine,
                                iconBg: 'bg-slate-100 text-slate-600',
                                label: 'Signature & Official Stamp',
                                description: 'Show the principal\'s uploaded signature image and school stamp on the report.',
                                flagKey: 'show_signature'
                            },
                            {
                                icon: NotebookText,
                                iconBg: 'bg-teal-100 text-teal-600',
                                label: 'Custom Notices & Sections',
                                description: 'Append school-defined sections like term notices, items to buy, or prospectus.',
                                flagKey: 'show_global_sections'
                            },
                        ];

                        const SectionCard = ({ s }: { s: SectionRow }) => (
                            <div
                                key={s.flagKey}
                                onClick={() => !s.locked && setRcFlag(s.flagKey, !isOn(s.flagKey))}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                                    s.locked
                                        ? 'border-slate-100 bg-slate-50/50 cursor-default select-none'
                                        : isOn(s.flagKey)
                                            ? 'border-primary-100 bg-primary-50/40 hover:bg-primary-50/70 cursor-pointer shadow-sm shadow-primary-100'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer'
                                }`}
                            >
                                {/* Icon pill */}
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
                                    <s.icon className="w-5 h-5" />
                                </div>

                                {/* Label & description */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-bold truncate ${
                                            s.locked ? 'text-slate-500' : isOn(s.flagKey) ? 'text-slate-900' : 'text-slate-600'
                                        }`}>{s.label}</p>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{s.description}</p>
                                </div>

                                {/* Toggle or Locked Indicator */}
                                <div onClick={e => e.stopPropagation()}>
                                    {s.locked ? (
                                        <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm">
                                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Always On</span>
                                        </div>
                                    ) : (
                                        <Toggle flagKey={s.flagKey} />
                                    )}
                                </div>
                            </div>
                        );

                        return (
                            <div className="space-y-8 animate-in fade-in duration-200">
                                {renderPanelHeader(
                                    'Report Card Configuration',
                                    'Control exactly what appears on every student report card. Required sections cannot be removed.',
                                )}

                                {/* Core / Locked Sections */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Sections — Always Included</span>
                                    </div>
                                    <div className="space-y-2">
                                        {lockedSections.map(s => <SectionCard key={s.flagKey} s={s} />)}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-slate-100" />

                                {/* Optional Sections */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <LayoutTemplate className="w-3.5 h-3.5 text-primary-500" />
                                        <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Optional Sections — Toggle On / Off</span>
                                    </div>
                                    <div className="space-y-2">
                                        {optionalSections.map(s => <SectionCard key={s.flagKey} s={s} />)}
                                    </div>
                                </div>

                                {/* Custom Sections Editor — only shown when show_global_sections is ON */}
                                {isOn('show_global_sections') && (
                                    <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Custom Notices & Sections</p>
                                                <p className="text-xs text-slate-500">Content areas appended to all report cards (e.g. term notices, items to buy).</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sections = [...(localConfig.global_report_sections || []), { title: '', content: '' }];
                                                    setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                }}
                                                className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 px-3.5 py-1.5 rounded-xl transition-all font-semibold text-xs uppercase tracking-wider"
                                            >
                                                <Plus className="w-4 h-4" /> Add Section
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {(localConfig.global_report_sections || []).map((section: any, idx: number) => (
                                                <div key={idx} className="bg-teal-50/50 border border-teal-100 p-4 rounded-2xl space-y-3 relative group">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Notice #{idx + 1}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const sections = localConfig.global_report_sections.filter((_: any, i: number) => i !== idx);
                                                                setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                            }}
                                                            className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" /> Remove
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={section.title}
                                                            onChange={e => {
                                                                const sections = [...localConfig.global_report_sections];
                                                                sections[idx].title = e.target.value;
                                                                setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                            }}
                                                            placeholder="Section Title (e.g. Items to Buy)"
                                                            className="w-full bg-white border border-teal-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                                                        />
                                                        <textarea
                                                            value={section.content}
                                                            onChange={e => {
                                                                const sections = [...localConfig.global_report_sections];
                                                                sections[idx].content = e.target.value;
                                                                setLocalConfig({ ...localConfig, global_report_sections: sections });
                                                            }}
                                                            className="w-full bg-white border border-teal-200 rounded-lg p-2 text-xs font-medium h-24 resize-none outline-none focus:border-teal-500 text-slate-700"
                                                            placeholder="Default instruction or content..."
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            {(!localConfig.global_report_sections || localConfig.global_report_sections.length === 0) && (
                                                <div className="md:col-span-2 p-10 border-2 border-dashed border-teal-200 rounded-2xl text-center">
                                                    <NotebookText className="w-8 h-8 text-teal-200 mx-auto mb-2" />
                                                    <p className="text-sm font-semibold text-slate-400 italic">No custom sections yet. Click &quot;Add Section&quot; to add a notice or prospectus.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                </div>
            </div>
            {previewLayout && (
                <ReportCard
                    student={MOCK_PREVIEW_STUDENT}
                    results={MOCK_PREVIEW_RESULTS}
                    onClose={() => setPreviewLayout(null)}
                    schoolConfig={{
                        name: localConfig.exam_name || "Orbit Academy",
                        logo_url: localConfig.report_card_config?.stamp_url || "",
                        current_term: localConfig.current_term,
                        academic_year: localConfig.academic_year,
                        grading: localConfig.grading,
                        grading_type: localConfig.grading_type,
                        report_card_config: {
                            layout: previewLayout,
                            show_position: true,
                            show_attendance: true,
                            show_class_teacher_remark: true,
                            show_head_teacher_remark: true,
                            show_student_photo: true
                        }
                    }}
                    position={{ position: 33, total: 49 }}
                    schoolId="preview-school"
                />
            )}
        </div>
    );
};
