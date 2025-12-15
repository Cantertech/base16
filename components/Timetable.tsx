import React, { useState, useEffect } from 'react';
import {
    Calendar, Clock, Plus, Trash2, Edit2, User, BookOpen,
    ChevronLeft, ChevronRight, School, Filter
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface TimetableProps {
    currentUser: any;
}

interface TimetableEntry {
    id: string;
    class_id: string;
    subject_id?: string;
    teacher_id?: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    type: 'Lesson' | 'Break' | 'Assembly' | 'Other';
    room_number?: string;
    // Joins
    classes?: { name: string };
    subjects?: { name: string };
    teachers?: { name: string };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Timetable: React.FC<TimetableProps> = ({ currentUser }) => {
    const [viewMode, setViewMode] = useState<'class' | 'teacher'>(
        currentUser.role === 'admin' ? 'class' : 'teacher'
    );
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [timetableData, setTimetableData] = useState<TimetableEntry[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [teachersList, setTeachersList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
    const [formData, setFormData] = useState({
        day_of_week: 'Monday',
        start_time: '08:00',
        end_time: '09:00',
        type: 'Lesson',
        subject_id: '',
        teacher_id: '',
        room_number: ''
    });

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        if (viewMode === 'class' && selectedClassId) {
            fetchClassTimetable(selectedClassId);
        } else if (viewMode === 'teacher' && currentUser.id) {
            fetchTeacherTimetable(currentUser.id);
        }
    }, [viewMode, selectedClassId, currentUser.id]);

    const fetchMetadata = async () => {
        try {
            const { data: cls } = await supabase.from('classes').select('*').order('name');
            if (cls) {
                setClasses(cls);
                // Auto-select first class for admin
                if (currentUser.role === 'admin' && cls.length > 0 && !selectedClassId) {
                    setSelectedClassId(cls[0].id);
                }
            }

            const { data: sub } = await supabase.from('subjects').select('*').order('name');
            if (sub) setSubjects(sub);

            // Fetch teachers from profiles or teachers table depending on architecture
            // Using profiles for now as it's more standard for auth linkage, fall back to teachers table if needed
            const { data: tch } = await supabase
                .from('profiles')
                .select('id, name:full_name')
                .eq('role', 'teacher')
                .order('full_name');
            if (tch) setTeachersList(tch);

        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    };

    const fetchClassTimetable = async (classId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('timetable_entries')
                .select(`
                    *,
                    classes(name),
                    subjects(name),
                    teachers:teacher_id(name:full_name) 
                `) // note: teachers alias assumes linkage to profiles or teachers table. 
                // Based on schema script: teacher_id references profiles(id)
                .eq('class_id', classId)
                .order('start_time');

            if (error) throw error;
            setTimetableData(data || []);
        } catch (error) {
            console.error('Error fetching class timetable:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeacherTimetable = async (teacherId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('timetable_entries')
                .select(`
                    *,
                    classes(name),
                    subjects(name)
                `)
                .eq('teacher_id', teacherId)
                .order('start_time');

            if (error) throw error;
            setTimetableData(data || []);
        } catch (error) {
            console.error('Error fetching teacher timetable:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this entry?')) return;
        try {
            const { error } = await supabase.from('timetable_entries').delete().eq('id', id);
            if (error) throw error;
            // Refresh
            if (viewMode === 'class') fetchClassTimetable(selectedClassId);
            else fetchTeacherTimetable(currentUser.id);
        } catch (error) {
            console.error('Error deleting entry:', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                school_id: currentUser.school_id,
                class_id: selectedClassId,
                day_of_week: formData.day_of_week,
                start_time: formData.start_time,
                end_time: formData.end_time,
                type: formData.type,
                subject_id: formData.type === 'Lesson' ? formData.subject_id || null : null,
                teacher_id: formData.type === 'Lesson' ? formData.teacher_id || null : null,
                room_number: formData.room_number
            };

            if (editingEntry) {
                const { error } = await supabase
                    .from('timetable_entries')
                    .update(payload)
                    .eq('id', editingEntry.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('timetable_entries')
                    .insert([payload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingEntry(null);
            fetchClassTimetable(selectedClassId);
        } catch (error: any) {
            console.error('Error saving timetable entry:', error);
            alert('Failed to save entry: ' + error.message);
        }
    };

    const openAddModal = (day?: string) => {
        setEditingEntry(null);
        setFormData({
            day_of_week: day || 'Monday',
            start_time: '08:00',
            end_time: '09:00',
            type: 'Lesson',
            subject_id: '',
            teacher_id: '',
            room_number: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (entry: TimetableEntry) => {
        setEditingEntry(entry);
        setFormData({
            day_of_week: entry.day_of_week,
            start_time: entry.start_time,
            end_time: entry.end_time,
            type: entry.type as any,
            subject_id: entry.subject_id || '',
            teacher_id: entry.teacher_id || '',
            room_number: entry.room_number || ''
        });
        setIsModalOpen(true);
    };

    // --- Render Helpers ---

    const getEntriesForDay = (day: string) => {
        return timetableData.filter(t => t.day_of_week === day);
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="h-6 w-6 text-primary-600" />
                        Class Timetable
                    </h1>
                    <p className="text-slate-500">Manage and view weekly schedules</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {currentUser.role === 'teacher' && (
                        <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                            <button
                                onClick={() => setViewMode('teacher')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'teacher' ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                My Schedule
                            </button>
                            <button
                                onClick={() => setViewMode('class')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'class' ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Class View
                            </button>
                        </div>
                    )}

                    {(currentUser.role === 'admin' || viewMode === 'class') && (
                        <div className="relative">
                            <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm min-w-[150px]"
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {currentUser.role === 'admin' && viewMode === 'class' && (
                        <button
                            onClick={() => openAddModal()}
                            disabled={!selectedClassId}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="h-4 w-4" />
                            Add Entry
                        </button>
                    )}
                </div>
            </div>

            {/* Timetable Grid */}
            {!selectedClassId && viewMode === 'class' ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <School className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-600">No Class Selected</h3>
                    <p className="text-slate-400">Please select a class to view its timetable</p>
                </div>
            ) : (
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[1000px] grid grid-cols-5 gap-4">
                        {DAYS.map(day => (
                            <div key={day} className="flex flex-col gap-3">
                                {/* Day Header */}
                                <div className="bg-white p-3 rounded-lg border-t-4 border-primary-500 shadow-sm text-center sticky top-0 z-10">
                                    <h3 className="font-bold text-slate-800">{day}</h3>
                                    <p className="text-xs text-slate-400">{getEntriesForDay(day).length} slots</p>
                                </div>

                                {/* Slots */}
                                <div className="space-y-3 min-h-[500px] bg-slate-100/50 p-2 rounded-lg">
                                    {getEntriesForDay(day).map(entry => (
                                        <div
                                            key={entry.id}
                                            className={`p-3 rounded-lg border shadow-sm relative group transition-all hover:shadow-md ${entry.type === 'Break' ? 'bg-orange-50 border-orange-200' :
                                                entry.type === 'Assembly' ? 'bg-purple-50 border-purple-200' :
                                                    'bg-white border-slate-200'
                                                }`}
                                        >
                                            {/* Time Badge */}
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                                                    {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                                                </span>

                                                {currentUser.role === 'admin' && (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditModal(entry)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                                                            <Edit2 className="h-3 w-3" />
                                                        </button>
                                                        <button onClick={() => handleDelete(entry.id)} className="p-1 hover:bg-red-100 rounded text-red-500">
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            {entry.type === 'Lesson' ? (
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm mb-1">{entry.subjects?.name || 'Unknown Subject'}</h4>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <User className="h-3 w-3" />
                                                        <span>{entry.teachers?.name ? entry.teachers.name.split(' ')[0] : 'No Teacher'}</span>
                                                    </div>
                                                    {viewMode === 'teacher' && entry.classes && (
                                                        <div className="flex items-center gap-1.5 text-xs text-primary-600 font-medium mt-1">
                                                            <School className="h-3 w-3" />
                                                            <span>{entry.classes.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-2">
                                                    <span className={`text-sm font-bold ${entry.type === 'Break' ? 'text-orange-600' : 'text-purple-600'
                                                        }`}>
                                                        {entry.type}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Empty State / Add Button */}
                                    {getEntriesForDay(day).length === 0 && (
                                        <div className="text-center py-8 opacity-50">
                                            <p className="text-xs text-slate-400 italic">No entries</p>
                                        </div>
                                    )}

                                    {currentUser.role === 'admin' && viewMode === 'class' && (
                                        <button
                                            onClick={() => openAddModal(day)}
                                            className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-primary-400 hover:text-primary-600 hover:bg-white transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                        >
                                            <Plus className="h-3 w-3" /> Add Slot
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">
                                {editingEntry ? 'Edit Timetable Entry' : 'Add New Entry'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <Plus className="h-6 w-6 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Day</label>
                                    <select
                                        required
                                        value={formData.day_of_week}
                                        onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                    >
                                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                    <select
                                        required
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                    >
                                        {['Lesson', 'Break', 'Assembly', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.start_time}
                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.end_time}
                                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                    />
                                </div>
                            </div>

                            {formData.type === 'Lesson' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                        <select
                                            required
                                            value={formData.subject_id}
                                            onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                                            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                        >
                                            <option value="">Select Subject</option>
                                            {subjects.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teacher (Optional)</label>
                                        <select
                                            value={formData.teacher_id}
                                            onChange={e => setFormData({ ...formData, teacher_id: e.target.value })}
                                            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                        >
                                            <option value="">No Teacher Assgined</option>
                                            {teachersList.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors mt-4"
                            >
                                {editingEntry ? 'Update Entry' : 'Add Entry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Timetable;
