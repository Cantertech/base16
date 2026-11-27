import React, { useState, useEffect } from 'react';
import {
    Users, BookOpen, Layers, Edit, Trash2, Plus,
    MoreHorizontal, Search, CheckSquare, Square, X, Check, FastForward, Loader2, RotateCcw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';

// --- Types ---
interface ClassItem {
    id: string;
    name: string;
    section?: string;
    studentCount: number;
    teacherId?: string | null;
    teacherName?: string;
}

interface SubjectItem {
    id: string;
    name: string;
    code: string;
    type: 'Core' | 'Elective';
    classes: string[]; // Array of Class Names
}

interface CoursesProps {
    currentUser?: {
        id: string;
        school_id: string;
        role: 'admin' | 'teacher';
    };
}

// --- Fetch Functions ---
const fetchClasses = async (schoolId: string) => {
    // 1. Fetch Classes
    const { data: classesData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

    if (classError) throw classError;

    // 2. Fetch Students for real-time counts
    const { data: studentsData } = await supabase
        .from('students')
        .select('class, class_id')
        .eq('school_id', schoolId);

    const studentCounts: Record<string, number> = {};
    studentsData?.forEach((s: any) => {
        if (s.class_id) {
            studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
        }
        if (s.class) {
            studentCounts[s.class] = (studentCounts[s.class] || 0) + 1;
        }
    });

    // 3. Fetch Class Teachers from teacher_assignments (master_schema_v1.sql standard)
    const { data: assignmentsData, error: assignError } = await supabase
        .from('teacher_assignments')
        .select(`
            class_id,
            teacher_id,
            is_class_teacher,
            profiles:teacher_id (id, full_name, email)
        `)
        .eq('school_id', schoolId)
        .eq('is_class_teacher', true);

    if (assignError) {
        console.warn('Notice fetching class teacher assignments:', assignError);
    }

    const classTeachers: Record<string, { id: string; name: string }> = {};
    assignmentsData?.forEach((ta: any) => {
        const prof = Array.isArray(ta.profiles) ? ta.profiles[0] : ta.profiles;
        const teacherName = prof?.full_name || prof?.email;
        if (ta.class_id && teacherName) {
            classTeachers[ta.class_id] = { id: ta.teacher_id, name: teacherName };
        }
    });

    return (classesData || []).map((c: any) => {
        const teacherInfo = classTeachers[c.id] || classTeachers[c.name];
        return {
            id: c.id,
            name: c.name,
            section: c.section,
            studentCount: studentCounts[c.id] || studentCounts[c.name] || 0,
            teacherId: teacherInfo?.id || null,
            teacherName: teacherInfo?.name || 'Unassigned'
        };
    }) as ClassItem[];
};

const fetchTeachers = async (schoolId: string) => {
    // 1. Fetch teacher profiles (master_schema_v1.sql standard)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .order('full_name', { ascending: true });

    return (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email || 'Teacher'
    })).sort((a, b) => a.name.localeCompare(b.name));
};

const fetchSubjects = async (schoolId: string) => {
    // 1. Fetch Subjects from master_schema_v1.sql
    const { data: subjectsData, error: subjectError } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

    if (subjectError) throw subjectError;

    // 2. Fetch Assignments from subject_assignments table
    const subjectClassMap: Record<string, Set<string>> = {};

    try {
        const { data: saData, error: saError } = await supabase
            .from('subject_assignments')
            .select(`
                subject_id,
                classes:class_id (id, name)
            `)
            .eq('school_id', schoolId);

        if (!saError && saData) {
            saData.forEach((a: any) => {
                const clsObj = Array.isArray(a.classes) ? a.classes[0] : a.classes;
                const clsName = clsObj?.name;
                if (a.subject_id && clsName) {
                    if (!subjectClassMap[a.subject_id]) {
                        subjectClassMap[a.subject_id] = new Set();
                    }
                    subjectClassMap[a.subject_id].add(clsName);
                }
            });
        }
    } catch (e) {
        console.warn('Notice fetching subject_assignments:', e);
    }

    // 3. Also merge from teacher_assignments (if teachers are already assigned)
    try {
        const { data: assignmentsData } = await supabase
            .from('teacher_assignments')
            .select(`
                subject_id,
                classes:class_id (id, name)
            `)
            .eq('school_id', schoolId)
            .not('subject_id', 'is', null);

        assignmentsData?.forEach((a: any) => {
            const clsObj = Array.isArray(a.classes) ? a.classes[0] : a.classes;
            const clsName = clsObj?.name;
            if (a.subject_id && clsName) {
                if (!subjectClassMap[a.subject_id]) {
                    subjectClassMap[a.subject_id] = new Set();
                }
                subjectClassMap[a.subject_id].add(clsName);
            }
        });
    } catch (_) {}



    return (subjectsData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code || '',
        type: s.type || 'Core',
        classes: Array.from(subjectClassMap[s.id] || [])
    })) as SubjectItem[];
};

const Courses: React.FC<CoursesProps> = ({ currentUser }) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'classes' | 'subjects'>('classes');
    const [schoolId, setSchoolId] = useState<string | null>(null);

    // Modals
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
    const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
    const [selectedFilterClass, setSelectedFilterClass] = useState<string>('All Classes');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // grid = group by class
    const [searchTerm, setSearchTerm] = useState('');
    const [lastPromotion, setLastPromotion] = useState<any>(null);
    const [isReverting, setIsReverting] = useState(false);

    useEffect(() => {
        if (!schoolId) return;
        try {
            const raw = localStorage.getItem(`base16_last_promotion_${schoolId}`);
            setLastPromotion(raw ? JSON.parse(raw) : null);
        } catch {
            setLastPromotion(null);
        }
    }, [schoolId, isPromotionModalOpen]);

    const handleRevertPromotion = async () => {
        if (!schoolId || !lastPromotion?.previousStates?.length) return;
        const confirmed = window.confirm(
            `Revert last bulk promotion (${lastPromotion.count} students from ${lastPromotion.sourceClass} → ${lastPromotion.targetClass})?`
        );
        if (!confirmed) return;

        setIsReverting(true);
        try {
            // Group by previous (class, class_id, status) to minimize queries
            const groups: Record<string, { class: string; class_id: string | null; status: string; ids: string[] }> = {};
            for (const prev of lastPromotion.previousStates) {
                const key = `${prev.class}|${prev.class_id || ''}|${prev.status || 'Active'}`;
                if (!groups[key]) {
                    groups[key] = {
                        class: prev.class,
                        class_id: prev.class_id || null,
                        status: prev.status || 'Active',
                        ids: []
                    };
                }
                groups[key].ids.push(prev.id);
            }

            for (const g of Object.values(groups)) {
                const { error } = await supabase
                    .from('students')
                    .update({ class: g.class, class_id: g.class_id, status: g.status })
                    .eq('school_id', schoolId)
                    .in('id', g.ids);
                if (error) throw error;
            }

            localStorage.removeItem(`base16_last_promotion_${schoolId}`);
            setLastPromotion(null);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['classes'] }),
                queryClient.invalidateQueries({ queryKey: ['students'] }),
            ]);
            alert(`Reverted ${lastPromotion.count} students back to ${lastPromotion.sourceClass}.`);
        } catch (err: any) {
            alert(`Failed to revert promotion: ${err.message}`);
        } finally {
            setIsReverting(false);
        }
    };

    // Initialize School ID
    useEffect(() => {
        const init = async () => {
            if (currentUser?.school_id) {
                setSchoolId(currentUser.school_id);
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
                    if (profile?.school_id) {
                        setSchoolId(profile.school_id);
                    }
                }
            }
        };
        init();
    }, [currentUser]);

    // Queries
    const { data: classes = [] } = useQuery({
        queryKey: ['classes', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId,
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects', schoolId],
        queryFn: () => fetchSubjects(schoolId!),
        enabled: !!schoolId,
    });

    const { data: allTeachers = [] } = useQuery({
        queryKey: ['teachersList', schoolId],
        queryFn: () => fetchTeachers(schoolId!),
        enabled: !!schoolId,
    });

    const filteredSubjects = subjects.filter(s => {
        const matchesClass = selectedFilterClass === 'All Classes' || s.classes.includes(selectedFilterClass);
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.code.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesClass && matchesSearch;
    });

    // Mutations - Classes
    const saveClassMutation = useMutation({
        mutationFn: async (classData: Partial<ClassItem> & { newTeacherId?: string | null }) => {
            if (!schoolId) throw new Error('No school ID');
            const targetClassName = classData.name?.trim();
            const targetSection = classData.section?.trim() || null;
            let classId = editingClass?.id;

            const payload = {
                school_id: schoolId,
                name: targetClassName,
                section: targetSection
            };

            if (classId) {
                const oldName = editingClass?.name;
                const { error } = await supabase
                    .from('classes')
                    .update(payload)
                    .eq('id', classId);
                if (error) throw error;

                // Cascade rename to student records and related tables
                if (oldName && targetClassName && oldName !== targetClassName) {
                    await supabase
                        .from('students')
                        .update({ class: targetClassName })
                        .eq('school_id', schoolId)
                        .eq('class', oldName);

                    await supabase
                        .from('fee_structure')
                        .update({ target_class: targetClassName })
                        .eq('school_id', schoolId)
                        .eq('target_class', oldName);

                    await supabase
                        .from('attendance')
                        .update({ class: targetClassName })
                        .eq('school_id', schoolId)
                        .eq('class', oldName);
                }
            } else {
                const { data, error } = await supabase
                    .from('classes')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                classId = data.id;
            }

            if (!classId) throw new Error('Failed to resolve class ID');

            // Update Class Teacher in teacher_assignments (master_schema_v1.sql standard)
            if (classData.newTeacherId !== undefined) {
                // Remove previous class teacher assignment for this class
                await supabase
                    .from('teacher_assignments')
                    .delete()
                    .eq('school_id', schoolId)
                    .eq('class_id', classId)
                    .eq('is_class_teacher', true);

                // Assign new class teacher if selected
                if (classData.newTeacherId) {
                    await supabase
                        .from('teacher_assignments')
                        .insert({
                            school_id: schoolId,
                            teacher_id: classData.newTeacherId,
                            class_id: classId,
                            subject_id: null,
                            is_class_teacher: true
                        });
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classes', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['teachersList', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['feeStructure', schoolId] });
            setIsClassModalOpen(false);
            setEditingClass(null);
        },
        onError: (error: any) => {
            console.error('Error saving class:', error);
            alert(`Failed to save class: ${error.message}`);
        }
    });

    const deleteClassMutation = useMutation({
        mutationFn: async (id: string) => {
            // Delete teacher assignments for this class
            await supabase
                .from('teacher_assignments')
                .delete()
                .eq('class_id', id);

            // Delete from classes (cascades in master_schema_v1.sql)
            const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classes', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] });
        },
        onError: (error: any) => {
            console.error('Error deleting class:', error);
            alert(`Failed to delete class: ${error.message}`);
        }
    });

    // Mutations - Subjects
    const saveSubjectMutation = useMutation({
        mutationFn: async (subjectData: Partial<SubjectItem>) => {
            if (!schoolId) throw new Error('No school ID');
            let subjectId = subjectData.id || editingSubject?.id;

            // 1. Upsert Subject in master_schema_v1.sql
            const payload = {
                school_id: schoolId,
                name: subjectData.name?.trim(),
                code: subjectData.code?.trim().toUpperCase(),
                type: subjectData.type || 'Core'
            };

            if (subjectId) {
                const { error } = await supabase
                    .from('subjects')
                    .update(payload)
                    .eq('id', subjectId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('subjects')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                subjectId = data.id;
            }

            if (!subjectId) throw new Error('Failed to resolve subject ID');

            // 2. Manage Class Assignments via subject_assignments table
            const targetClassNames = subjectData.classes || [];
            const targetClasses = classes.filter(c => targetClassNames.includes(c.name));
            const targetClassIds = new Set(targetClasses.map(c => c.id));

            // Fetch existing subject assignments
            const { data: existingAssignments } = await supabase
                .from('subject_assignments')
                .select('id, class_id')
                .eq('school_id', schoolId)
                .eq('subject_id', subjectId);

            const existingClassIds = new Set((existingAssignments || []).map(a => a.class_id));

            // Remove assignments for classes that were deselected
            const toDelete = (existingAssignments || []).filter(a => !targetClassIds.has(a.class_id));
            if (toDelete.length > 0) {
                const deleteIds = toDelete.map(a => a.id);
                await supabase
                    .from('subject_assignments')
                    .delete()
                    .in('id', deleteIds);
            }

            // For newly selected classes, link directly in subject_assignments table
            const toAddClasses = targetClasses.filter(c => !existingClassIds.has(c.id));
            if (toAddClasses.length > 0) {
                const newRows = toAddClasses.map(cls => ({
                    school_id: schoolId,
                    class_id: cls.id,
                    subject_id: subjectId
                }));
                const { error: insErr } = await supabase
                    .from('subject_assignments')
                    .insert(newRows);
                if (insErr) {
                    console.error('Error inserting subject_assignments:', insErr);
                    throw insErr;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] });
            setIsSubjectModalOpen(false);
            setEditingSubject(null);
        },
        onError: (error: any) => {
            console.error('Error saving subject:', error);
            alert(`Failed to save subject: ${error.message}`);
        }
    });

    const deleteSubjectMutation = useMutation({
        mutationFn: async (id: string) => {
            // 1. Delete assignments in subject_assignments & teacher_assignments
            try { await supabase.from('subject_assignments').delete().eq('subject_id', id); } catch (_) {}
            try { await supabase.from('teacher_assignments').delete().eq('subject_id', id); } catch (_) {}

            // 2. Safe cleanup of legacy tables if they exist
            try { await supabase.from('timetable_entries').delete().eq('subject_id', id); } catch (_) {}

            // 3. Delete Subject (cascades in master_schema_v1.sql)
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] });
        },
        onError: (error: any) => {
            console.error('Error deleting subject:', error);
            alert(`Failed to delete subject: ${error.message}`);
        }
    });

    // Handlers
    const handleSaveClass = (data: Partial<ClassItem>) => saveClassMutation.mutate(data);
    const handleDeleteClass = (id: string) => {
        if (confirm('Are you sure? This will remove the class structure.')) deleteClassMutation.mutate(id);
    };

    const handleSaveSubject = (data: Partial<SubjectItem>) => saveSubjectMutation.mutate(data);
    const handleDeleteSubject = (id: string) => {
        if (confirm('Delete this subject? This action cannot be undone.')) deleteSubjectMutation.mutate(id);
    };

    return (
        <div className="p-4 md:p-8 space-y-4 md:space-y-8 relative h-full pb-20 md:pb-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Course Management</h1>
                    <p className="text-slate-500 text-sm">Define the school structure and curriculum.</p>
                </div>

                <div className="flex w-full md:w-auto bg-white p-1 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('classes')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex justify-center items-center gap-2 whitespace-nowrap ${activeTab === 'classes' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers className="h-4 w-4" /> Manage Classes
                    </button>
                    <button
                        onClick={() => setActiveTab('subjects')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all flex justify-center items-center gap-2 whitespace-nowrap ${activeTab === 'subjects' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BookOpen className="h-4 w-4" /> Manage Subjects
                    </button>
                </div>
            </div>

            {/* --- TAB 1: CLASSES --- */}
            {activeTab === 'classes' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                        <div className="text-sm font-medium text-slate-600 hidden sm:block">
                            Organize your school's classes and sections.
                        </div>
                        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                            {lastPromotion && (
                                <button
                                    onClick={handleRevertPromotion}
                                    disabled={isReverting}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100 font-bold text-sm shadow-xs transition-colors disabled:opacity-60"
                                    title={`Revert ${lastPromotion.count} students from ${lastPromotion.targetClass} back to ${lastPromotion.sourceClass}`}
                                >
                                    {isReverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                    <span>Undo Promotion ({lastPromotion.sourceClass})</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsPromotionModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold text-sm shadow-md transition-colors"
                            >
                                <FastForward className="h-4 w-4 text-indigo-400" /> <span className="hidden sm:inline">Bulk Promotion</span><span className="sm:hidden">Promote</span>
                            </button>
                            <button
                                onClick={() => { setEditingClass(null); setIsClassModalOpen(true); }}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold text-sm shadow-md transition-colors"
                            >
                                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add New Class</span><span className="sm:hidden">Add</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {classes.map(cls => (
                            <div key={cls.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                <div className="h-2 bg-primary-600 w-full"></div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg text-slate-800">
                                            {cls.name} {cls.section && <span className="text-slate-400 font-normal">({cls.section})</span>}
                                        </h3>
                                        <div className="bg-slate-50 p-1.5 rounded-lg text-slate-400 group-hover:text-primary-600 transition-colors">
                                            <Layers className="h-5 w-5" />
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <Users className="h-4 w-4 text-slate-400" />
                                            <span>{cls.studentCount} Students</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <BookOpen className="h-4 w-4 text-slate-400" />
                                            <span className="truncate">Class Teacher: {cls.teacherName || 'Unassigned'}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4 border-t border-slate-50">
                                        <button
                                            onClick={() => { setEditingClass(cls); setIsClassModalOpen(true); }}
                                            className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClass(cls.id)}
                                            className="py-2 px-3 text-xs font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Empty State for Add */}
                        <button
                            onClick={() => { setEditingClass(null); setIsClassModalOpen(true); }}
                            className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-8 text-slate-400 hover:border-primary-400 hover:text-primary-600 hover:bg-slate-50 transition-all min-h-[200px]"
                        >
                            <Plus className="h-8 w-8 mb-2" />
                            <span className="font-medium text-sm">Create Class Level</span>
                        </button>
                    </div>
                </div>
            )}

            {/* --- TAB 2: SUBJECTS --- */}
            {activeTab === 'subjects' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                                <div className="space-y-1 w-full md:w-48">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter By Class</label>
                                    <select
                                        value={selectedFilterClass}
                                        onChange={(e) => setSelectedFilterClass(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold focus:ring-2 focus:ring-primary-600 outline-none transition-all"
                                    >
                                        <option value="All Classes">All Classes</option>
                                        {classes.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button
                                    onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-bold text-xs shadow-sm transition-all"
                                >
                                    <Layers className="h-4 w-4" /> {viewMode === 'list' ? 'Grouped View' : 'Table View'}
                                </button>
                                <button
                                    onClick={() => { setEditingSubject(null); setIsSubjectModalOpen(true); }}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold text-xs shadow-md transition-colors"
                                >
                                    <Plus className="h-4 w-4" /> Add Subject
                                </button>
                            </div>
                        </div>

                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search across all subjects..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full text-sm"
                            />
                        </div>
                    </div>

                    {/* Grouped View (Grid of Classes) */}
                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
                            {(selectedFilterClass === 'All Classes' ? classes : classes.filter(c => c.name === selectedFilterClass)).map(cls => (
                                <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                                        <div>
                                            <h3 className="font-black text-xs uppercase tracking-widest">{cls.name}</h3>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Curriculum Overview</p>
                                        </div>
                                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                                            <Layers className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="space-y-2">
                                            {filteredSubjects.filter(s => s.classes.includes(cls.name)).length > 0 ? (
                                                filteredSubjects.filter(s => s.classes.includes(cls.name)).map(subject => (
                                                    <div key={subject.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm">{subject.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{subject.code} • {subject.type}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => { setEditingSubject(subject); setIsSubjectModalOpen(true); }}
                                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 bg-white rounded-lg shadow-sm border border-slate-200 transition-all"
                                                            >
                                                                <Edit className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                    <p className="text-xs text-slate-400 italic">No subjects assigned</p>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedFilterClass(cls.name);
                                                setEditingSubject(null);
                                                setIsSubjectModalOpen(true);
                                            }}
                                            className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:border-primary-500 hover:text-primary-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus className="h-3 w-3" /> Assign Subject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewMode === 'list' && (
                        <>
                            {/* Mobile Subjects Card View */}
                            <div className="md:hidden space-y-4">
                                {filteredSubjects
                                    .map(subject => (
                                        <div key={subject.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{subject.name}</h3>
                                                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{subject.code}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${subject.type === 'Core' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {subject.type}
                                                </span>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Assigned Classes</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {subject.classes.length > 0 ? subject.classes.map((c, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 border border-slate-200 rounded-[4px] text-xs text-slate-600 bg-white shadow-sm">
                                                            {c}
                                                        </span>
                                                    )) : (
                                                        <span className="text-xs text-slate-400 italic">No classes assigned</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-3 border-t border-slate-50">
                                                <button
                                                    onClick={() => { setEditingSubject(subject); setIsSubjectModalOpen(true); }}
                                                    className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSubject(subject.id)}
                                                    className="py-1.5 px-3 text-xs font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Desktop Subjects Table View */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hidden md:block">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Subject Name</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Code</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Assigned Classes</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredSubjects
                                            .map(subject => (
                                                <tr key={subject.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-800">{subject.name}</td>
                                                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{subject.code}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${subject.type === 'Core' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {subject.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {subject.classes.slice(0, 4).map((c, i) => (
                                                                <span key={i} className="px-1.5 py-0.5 border border-slate-200 rounded text-xs text-slate-600 bg-white">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                            {subject.classes.length > 4 && (
                                                                <span className="px-1.5 py-0.5 rounded text-xs text-slate-500 bg-slate-100">
                                                                    +{subject.classes.length - 4} more
                                                                </span>
                                                            )}
                                                            {subject.classes.length === 0 && <span className="text-xs text-slate-400 italic">No classes assigned</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                        <button
                                                            onClick={() => { setEditingSubject(subject); setIsSubjectModalOpen(true); }}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSubject(subject.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* --- MODALS --- */}
            {isClassModalOpen && (
                <AddClassModal
                    existingData={editingClass}
                    onClose={() => setIsClassModalOpen(false)}
                    onSave={handleSaveClass}
                />
            )}

            {isSubjectModalOpen && (
                <AddSubjectModal
                    existingData={editingSubject}
                    availableClasses={classes.map(c => c.name)}
                    allSubjects={subjects}
                    defaultClass={selectedFilterClass !== 'All Classes' ? selectedFilterClass : ''}
                    onClose={() => setIsSubjectModalOpen(false)}
                    onSave={handleSaveSubject}
                />
            )}

            {isPromotionModalOpen && (
                <BulkPromotionModal
                    classes={classes}
                    schoolId={schoolId!}
                    onClose={() => setIsPromotionModalOpen(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['classes', schoolId] });
                        setIsPromotionModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

// --- Sub-components: Modals ---

const AddClassModal = ({ existingData, onClose, onSave }: any) => {
    const [name, setName] = useState(existingData?.name || '');
    const [section, setSection] = useState(existingData?.section || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, section });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">{existingData ? 'Edit Class' : 'Add New Class'}</h3>
                    <button onClick={onClose} type="button" className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Class Name</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Primary 4"
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Section (Optional)</label>
                        <input
                            type="text"
                            value={section}
                            onChange={e => setSection(e.target.value)}
                            placeholder="e.g. A"
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                        />
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 leading-relaxed">
                        Teachers are assigned when adding or editing teacher profiles in the <strong>Teachers</strong> section.
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold">Save Class</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddSubjectModal = ({ existingData, availableClasses, allSubjects, defaultClass, onClose, onSave }: any) => {
    const [name, setName] = useState(existingData?.name || '');
    const [code, setCode] = useState(existingData?.code || '');
    const [type, setType] = useState(existingData?.type || 'Core');
    const [selectedClasses, setSelectedClasses] = useState<string[]>(existingData?.classes || (defaultClass ? [defaultClass] : []));
    const [suggestedId, setSuggestedId] = useState<string | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const suggestions = allSubjects?.filter((s: SubjectItem) =>
        s.name.toLowerCase().includes(name.toLowerCase()) &&
        s.id !== existingData?.id
    ).slice(0, 5);

    const selectSuggestion = (s: SubjectItem) => {
        setName(s.name);
        setCode(s.code);
        setType(s.type);
        setSuggestedId(s.id);
        // Merge existing classes with current selection
        setSelectedClasses([...new Set([...selectedClasses, ...s.classes])]);
        setShowSuggestions(false);
    };

    const toggleClass = (className: string) => {
        if (selectedClasses.includes(className)) {
            setSelectedClasses(selectedClasses.filter(c => c !== className));
        } else {
            setSelectedClasses([...selectedClasses, className]);
        }
    };

    const selectAllClasses = () => {
        if (selectedClasses.length === availableClasses.length) {
            setSelectedClasses([]);
        } else {
            setSelectedClasses([...availableClasses]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: existingData?.id || suggestedId, name, code, type, classes: selectedClasses });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                    <h3 className="font-bold text-lg text-slate-800">{existingData ? 'Edit Subject' : 'Add New Subject'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subject Name</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setShowSuggestions(true); }}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder="e.g. Mathematics"
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                        />
                        {showSuggestions && name.length > 1 && suggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                                {suggestions.map((s: SubjectItem) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => selectSuggestion(s)}
                                        className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center"
                                    >
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">{s.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono italic">Assigned to: {s.classes.join(', ')}</p>
                                        </div>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">Assign Classes</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code</label>
                            <input
                                required
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="e.g. MTH"
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                            >
                                <option value="Core">Core</option>
                                <option value="Elective">Elective</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-slate-700">Assigned Classes</label>
                            <button 
                                type="button" 
                                onClick={selectAllClasses}
                                className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700"
                            >
                                {selectedClasses.length === availableClasses.length ? 'Clear All' : 'Select All'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-48 overflow-y-auto scrollbar-thin">
                            {availableClasses.length > 0 ? availableClasses.map((cls: string) => (
                                <button
                                    key={cls}
                                    type="button"
                                    onClick={() => toggleClass(cls)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${selectedClasses.includes(cls)
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'bg-white border border-slate-100 text-slate-600 hover:border-primary-300'
                                        }`}
                                >
                                    {selectedClasses.includes(cls) ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                                    <span className="truncate">{cls}</span>
                                </button>
                            )) : (
                                <p className="text-xs text-slate-400 col-span-3">No classes available.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                    <button onClick={handleSubmit} type="button" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold">Save Subject</button>
                </div>
            </div>
        </div>
    );
};

export const BulkPromotionModal = ({ classes, schoolId, onClose, onSuccess }: any) => {
    const [sourceClass, setSourceClass] = useState('');
    const [targetClass, setTargetClass] = useState('');
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [repeatedStudents, setRepeatedStudents] = useState<Set<string>>(new Set());

    // studentId -> selected action/class
    const [actions, setActions] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!sourceClass) {
            setStudents([]);
            setActions({});
            setRepeatedStudents(new Set());
            return;
        }

        const fetchStudents = async () => {
            setIsLoading(true);
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, name, admission_no, class')
                .eq('school_id', schoolId)
                .eq('class', sourceClass)
                .order('name');
            setStudents(studentsData || []);

            // Check if any students are marked to repeat based on saved report cards
            const studentIds = (studentsData || []).map(s => s.id);
            const repeatedSet = new Set<string>();

            if (studentIds.length > 0) {
                const { data: reports } = await supabase
                    .from('student_report_cards')
                    .select('student_id, next_class')
                    .in('student_id', studentIds);

                if (reports) {
                    reports.forEach(r => {
                        if (r.next_class && r.next_class.trim().toUpperCase() === sourceClass.trim().toUpperCase()) {
                            repeatedSet.add(r.student_id);
                        }
                    });
                }
            }

            setRepeatedStudents(repeatedSet);

            const newActions: Record<string, string> = {};
            (studentsData || []).forEach(s => {
                if (repeatedSet.has(s.id)) {
                    newActions[s.id] = sourceClass; // Default to Repeat
                } else if (targetClass) {
                    newActions[s.id] = targetClass; // Default to promote target
                }
            });
            setActions(newActions);
            setIsLoading(false);
        };
        fetchStudents();
    }, [sourceClass, schoolId]);

    // Handle target class change: auto-update everyone currently set to the OLD target class
    useEffect(() => {
        if (!targetClass || students.length === 0) return;
        setActions(prev => {
            const next = { ...prev };
            students.forEach(s => {
                if (repeatedStudents.has(s.id)) return; // Keep repeated students repeated!
                // If they haven't been manually set to something else, point to new target
                if (!next[s.id] || next[s.id] === prev['__lastTarget']) {
                    next[s.id] = targetClass;
                }
            });
            next['__lastTarget'] = targetClass; // secret key to track what we bulk updated to
            return next;
        });
    }, [targetClass, students, repeatedStudents]);

    const handleActionChange = (id: string, newClass: string) => {
        setActions(prev => ({ ...prev, [id]: newClass }));
    };

    const handleSave = async () => {
        if (students.length === 0) return;
        setIsSaving(true);
        try {
            // Save snapshot for 1-click Undo before applying promotion
            const updates = payloadGen();
            const affectedIds = new Set(updates.flatMap(u => u.ids));
            const previousStates = students
                .filter(s => affectedIds.has(s.id))
                .map(s => ({
                    id: s.id,
                    class: s.class || sourceClass,
                    class_id: s.class_id || null,
                    status: s.status || 'Active'
                }));
            if (previousStates.length > 0) {
                localStorage.setItem(
                    `base16_last_promotion_${schoolId}`,
                    JSON.stringify({
                        timestamp: new Date().toISOString(),
                        sourceClass,
                        targetClass,
                        count: previousStates.length,
                        previousStates
                    })
                );
            }

            // Group updates by target class mapping for efficiency
            for (const item of updates) {
                if (item.newClass === 'Graduated') {
                    await supabase.from('students')
                        .update({ status: 'Graduated', class: 'Graduated', class_id: null })
                        .in('id', item.ids);
                } else {
                    const matchedClass = classes.find((c: any) => c.name === item.newClass);
                    await supabase.from('students')
                        .update({ 
                            class: item.newClass, 
                            class_id: matchedClass?.id || null 
                        })
                        .in('id', item.ids);
                }
            }
            alert('Bulk promotion completed successfully!');
            onSuccess();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to promote: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const payloadGen = () => {
        const groups: Record<string, string[]> = {};
        Object.entries(actions).forEach(([id, target]) => {
            if (id === '__lastTarget') return;
            const targetStr = target as string;
            if (!groups[targetStr]) groups[targetStr] = [];
            groups[targetStr].push(id);
        });
        return Object.entries(groups).map(([newClass, ids]) => ({ newClass, ids }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <FastForward className="w-5 h-5 text-indigo-600" /> Bulk Student Promotion
                        </h3>
                        <p className="text-xs text-slate-500">Move students from one class to another at the end of the year.</p>
                    </div>
                    <button onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Step 1: Select Source Class</label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-700"
                            value={sourceClass}
                            onChange={e => setSourceClass(e.target.value)}
                            disabled={isSaving}
                        >
                            <option value="">-- Choose Class to Promote From --</option>
                            {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Step 2: Default Target Class</label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-indigo-700"
                            value={targetClass}
                            onChange={e => setTargetClass(e.target.value)}
                            disabled={!sourceClass || isSaving}
                        >
                            <option value="">-- Choose Default Destination --</option>
                            {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                            <option value="Graduated">Mark as Graduated</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            Loading students...
                        </div>
                    ) : students.length > 0 ? (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Student Name</th>
                                        <th className="px-4 py-3 font-semibold">ID</th>
                                        <th className="px-4 py-3 font-semibold w-1/3">Action / Next Class</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {students.map(student => (
                                        <tr key={student.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-800">{student.name}</td>
                                            <td className="px-4 py-3 text-slate-500 font-mono">{student.admission_no || student.id.substring(0, 8)}</td>
                                            <td className="px-4 py-2">
                                                <select
                                                    className={`w-full p-1.5 border rounded-md text-sm outline-none font-medium ${actions[student.id] === sourceClass ? 'bg-orange-50 text-orange-700 border-orange-200' : actions[student.id] === 'Graduated' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                                                    value={actions[student.id] || targetClass || ''}
                                                    onChange={(e) => handleActionChange(student.id, e.target.value)}
                                                    disabled={isSaving}
                                                >
                                                    {classes.map((c: any) => <option key={c.id} value={c.name}>Promote/Move to {c.name}</option>)}
                                                    <option value={sourceClass}>Repeat {sourceClass}</option>
                                                    <option value="Graduated">Graduate / Leave</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : sourceClass ? (
                        <div className="py-12 text-center text-slate-500 font-medium">No students found in {sourceClass}.</div>
                    ) : (
                        <div className="py-12 text-center text-slate-400">Select a Source Class to begin.</div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 flex-shrink-0 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || students.length === 0 || !sourceClass}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {isSaving ? 'Processing...' : `Confirm Promotion (${students.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Courses;
