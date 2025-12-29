import React, { useState, useEffect } from 'react';
import {
    Users, BookOpen, Layers, Edit, Trash2, Plus,
    MoreHorizontal, Search, CheckSquare, Square, X, Check
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

// --- Types ---
interface ClassItem {
    id: string;
    name: string;
    section?: string;
    studentCount: number;
    teacherId?: string | null; // Stores Teacher Name for display
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

const Courses: React.FC<CoursesProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'classes' | 'subjects'>('classes');

    // Data State
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);

    const [schoolId, setSchoolId] = useState<string | null>(null);

    // Modals
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
    const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);

    // Load Data
    useEffect(() => {
        const init = async () => {
            if (currentUser?.school_id) {
                setSchoolId(currentUser.school_id);
                fetchData(currentUser.school_id);
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
                    if (profile?.school_id) {
                        setSchoolId(profile.school_id);
                        fetchData(profile.school_id);
                    }
                }
            }
        };
        init();
    }, [currentUser]);

    const fetchData = async (sId: string) => {
        try {
            // 1. Fetch Classes
            const { data: classesData, error: classError } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', sId);

            if (classError) throw classError;

            // 2. Fetch Students for counts
            const { data: studentsData } = await supabase
                .from('students')
                .select('class')
                .eq('school_id', sId);

            const studentCounts: Record<string, number> = {};
            studentsData?.forEach((s: any) => {
                if (s.class) {
                    studentCounts[s.class] = (studentCounts[s.class] || 0) + 1;
                }
            });

            // 3. Fetch Teachers for assignment
            const { data: teachersData } = await supabase
                .from('teachers')
                .select('name, assigned_class')
                .eq('school_id', sId);

            const classTeachers: Record<string, string> = {};
            teachersData?.forEach((t: any) => {
                if (t.assigned_class) {
                    classTeachers[t.assigned_class] = t.name;
                }
            });

            const loadedClasses: ClassItem[] = classesData.map((c: any) => ({
                id: c.id,
                name: c.name,
                section: c.section,
                studentCount: studentCounts[c.name] || 0,
                teacherId: classTeachers[c.name] || 'Unassigned'
            }));
            setClasses(loadedClasses);

            // 2. Fetch Subjects
            const { data: subjectsData, error: subjectError } = await supabase
                .from('subjects')
                .select('*')
                .eq('school_id', sId);

            if (subjectError) throw subjectError;

            // 3. Fetch Assignments
            const { data: assignmentsData, error: assignError } = await supabase
                .from('subject_assignments')
                .select('subject_id, classes(name)')
                .eq('school_id', sId);

            if (assignError) throw assignError;

            // Map assignments to subjects
            const loadedSubjects: SubjectItem[] = subjectsData.map((s: any) => {
                const assignedClasses = assignmentsData
                    .filter((a: any) => a.subject_id === s.id && a.classes)
                    .map((a: any) => a.classes.name);

                return {
                    id: s.id,
                    name: s.name,
                    code: s.code,
                    type: s.type,
                    classes: [...new Set(assignedClasses)] // Unique names
                };
            });
            setSubjects(loadedSubjects);

        } catch (error) {
            console.error('Error fetching courses data:', error);
        }
    };

    // --- Handlers: Classes ---
    const handleSaveClass = async (classData: Partial<ClassItem>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            let targetSchoolId = currentUser?.school_id;

            if (!targetSchoolId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single();
                targetSchoolId = profile?.school_id;
            }

            if (!targetSchoolId) throw new Error('No school associated with user');

            const payload = {
                school_id: targetSchoolId,
                name: classData.name,
                section: classData.section
            };

            if (editingClass) {
                // Update
                const { error } = await supabase
                    .from('classes')
                    .update(payload)
                    .eq('id', editingClass.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('classes')
                    .insert(payload);
                if (error) throw error;
            }

            if (targetSchoolId) fetchData(targetSchoolId);
            setIsClassModalOpen(false);
            setEditingClass(null);
        } catch (error: any) {
            console.error('Error saving class:', error);
            alert(`Failed to save class: ${error.message}`);
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm('Are you sure? This will remove the class structure.')) return;
        try {
            const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            if (schoolId) fetchData(schoolId);
        } catch (error: any) {
            console.error('Error deleting class:', error);
            alert(`Failed to delete class: ${error.message}`);
        }
    };

    // --- Handlers: Subjects ---
    const handleSaveSubject = async (subjectData: Partial<SubjectItem>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            let targetSchoolId = currentUser?.school_id;

            if (!targetSchoolId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single();
                targetSchoolId = profile?.school_id;
            }

            if (!targetSchoolId) throw new Error('No school associated with user');

            let subjectId = editingSubject?.id;

            // 1. Upsert Subject
            const payload = {
                school_id: targetSchoolId,
                name: subjectData.name,
                code: subjectData.code,
                type: subjectData.type
            };

            if (editingSubject) {
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

            if (!subjectId) throw new Error('Failed to get subject ID');

            // 2. Handle Assignments
            // First, delete existing assignments for this subject
            const { error: delError } = await supabase
                .from('subject_assignments')
                .delete()
                .eq('subject_id', subjectId);

            if (delError) throw delError;

            // Then, insert new assignments
            if (subjectData.classes && subjectData.classes.length > 0) {
                // We need to map class names back to IDs
                // This is a bit inefficient, but since we have `classes` state, we can find IDs
                const assignments = subjectData.classes.map((className: string) => {
                    const cls = classes.find(c => c.name === className);
                    if (cls) {
                        return {
                            school_id: targetSchoolId,
                            subject_id: subjectId,
                            class_id: cls.id
                        };
                    }
                    return null;
                }).filter(Boolean);

                if (assignments.length > 0) {
                    const { error: assignError } = await supabase
                        .from('subject_assignments')
                        .insert(assignments);

                    if (assignError) throw assignError;
                }
            }

            if (targetSchoolId) fetchData(targetSchoolId);
            setIsSubjectModalOpen(false);
            setEditingSubject(null);

        } catch (error: any) {
            console.error('Error saving subject:', error);
            alert(`Failed to save subject: ${error.message}`);
        }
    };

    const handleDeleteSubject = async (id: string) => {
        if (!confirm('Delete this subject? This action cannot be undone.')) return;
        try {
            // 1. Delete assignments first (Foreign Key Constraint)
            const { error: assignError } = await supabase
                .from('subject_assignments')
                .delete()
                .eq('subject_id', id);

            if (assignError) throw assignError;

            // 2. Delete timetable entries (Foreign Key Constraint)
            const { error: timetableError } = await supabase
                .from('timetable_entries')
                .delete()
                .eq('subject_id', id);

            if (timetableError) throw timetableError;

            // 3. Delete teacher assignments (Foreign Key Constraint)
            const { error: teacherError } = await supabase
                .from('teacher_assignments')
                .delete()
                .eq('subject_id', id);

            if (teacherError) throw teacherError;

            // 4. Delete the subject
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', id);

            if (error) throw error;
            if (schoolId) fetchData(schoolId);
        } catch (error: any) {
            console.error('Error deleting subject:', error);
            alert(`Failed to delete subject: ${error.message}`);
        }
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
                    <div className="flex justify-end">
                        <button
                            onClick={() => { setEditingClass(null); setIsClassModalOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold text-sm shadow-md transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Add New Class
                        </button>
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
                                            <span className="truncate">Teacher: {cls.teacherId || 'Unassigned'}</span>
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
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                        <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full md:w-64 text-sm"
                            />
                        </div>
                        <button
                            onClick={() => { setEditingSubject(null); setIsSubjectModalOpen(true); }}
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold text-sm shadow-md transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Add Subject
                        </button>
                    </div>

                    {/* Mobile Subjects Card View */}
                    <div className="md:hidden space-y-4">
                        {subjects.map(subject => (
                            <div key={subject.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-slate-800">{subject.name}</h3>
                                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{subject.code}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${subject.type === 'Core' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                        }`}>
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
                                {subjects.map(subject => (
                                    <tr key={subject.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{subject.name}</td>
                                        <td className="px-6 py-4 font-mono text-sm text-slate-600">{subject.code}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${subject.type === 'Core' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
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
                    onClose={() => setIsSubjectModalOpen(false)}
                    onSave={handleSaveSubject}
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
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold">Save Class</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddSubjectModal = ({ existingData, availableClasses, onClose, onSave }: any) => {
    const [name, setName] = useState(existingData?.name || '');
    const [code, setCode] = useState(existingData?.code || '');
    const [type, setType] = useState(existingData?.type || 'Core');
    const [selectedClasses, setSelectedClasses] = useState<string[]>(existingData?.classes || []);

    const toggleClass = (className: string) => {
        if (selectedClasses.includes(className)) {
            setSelectedClasses(selectedClasses.filter(c => c !== className));
        } else {
            setSelectedClasses([...selectedClasses, className]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, code, type, classes: selectedClasses });
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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subject Name</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Mathematics"
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                        />
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
                        <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Classes</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                            {availableClasses.length > 0 ? availableClasses.map((cls: string) => (
                                <button
                                    key={cls}
                                    type="button"
                                    onClick={() => toggleClass(cls)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${selectedClasses.includes(cls)
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'
                                        }`}
                                >
                                    {selectedClasses.includes(cls) ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                                    {cls}
                                </button>
                            )) : (
                                <p className="text-xs text-slate-400 col-span-3">No classes available. Create classes first.</p>
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

export default Courses;
