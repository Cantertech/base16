import React, { useState, useEffect } from 'react';
import {
    Calendar, Clock, Plus, Trash2, Edit2, User, BookOpen,
    ChevronLeft, ChevronRight, School, Filter, Loader2,
    MapPin, Search, CheckCircle2, X
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
    activity_name?: string;
    classes?: { name: string };
    subjects?: { name: string };
    teachers?: { name: string };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Timetable: React.FC<TimetableProps> = ({ currentUser }) => {
    const queryClient = useQueryClient();
    const schoolId = currentUser?.school_id;

    // View State
    const [viewMode, setViewMode] = useState<'class' | 'teacher'>(
        currentUser.role === 'admin' ? 'class' : 'teacher'
    );
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [activeDay, setActiveDay] = useState(
        DAYS.includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }))
            ? new Date().toLocaleDateString('en-US', { weekday: 'long' })
            : 'Monday'
    );

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
        room_number: '',
        activity_name: ''
    });

    // --- Queries ---
    const { data: classes = [] } = useQuery({
        queryKey: ['timetableClasses', schoolId],
        queryFn: async () => {
            const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name');
            return data || [];
        },
        enabled: !!schoolId
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['timetableSubjects', schoolId],
        queryFn: async () => {
            const { data } = await supabase.from('subjects').select('*').eq('school_id', schoolId).order('name');
            return data || [];
        },
        enabled: !!schoolId
    });

    const { data: teachersList = [] } = useQuery({
        queryKey: ['timetableTeachers', schoolId],
        queryFn: async () => {
            const { data } = await supabase.from('profiles').select('id, name:full_name').eq('role', 'teacher').eq('school_id', schoolId).order('full_name');
            return data || [];
        },
        enabled: !!schoolId
    });

    const { data: schoolConfig } = useQuery({
        queryKey: ['schoolTermConfig', schoolId],
        queryFn: async () => {
            const { data } = await supabase.from('schools').select('current_term, academic_year').eq('id', schoolId).single();
            return data;
        },
        enabled: !!schoolId
    });

    const { data: timetableData = [], isLoading: timetableLoading } = useQuery({
        queryKey: ['timetable', viewMode, viewMode === 'class' ? selectedClassId : currentUser.id, schoolConfig?.current_term, schoolConfig?.academic_year],
        queryFn: async () => {
            let query = supabase.from('timetable_entries').select(`
                *,
                classes(name),
                subjects(name),
                teachers:teacher_id(name:full_name)
            `);

            if (viewMode === 'class') {
                if (!selectedClassId) return [];
                query = query.eq('class_id', selectedClassId);
            } else {
                if (!currentUser.id) return [];
                query = query.eq('teacher_id', currentUser.id);
            }

            if (schoolConfig?.current_term) query = query.eq('term', schoolConfig.current_term);
            if (schoolConfig?.academic_year) query = query.eq('academic_year', schoolConfig.academic_year);

            const { data, error } = await query.order('start_time');
            if (error) throw error;
            return data as TimetableEntry[] || [];
        },
        enabled: (viewMode === 'class' ? !!selectedClassId : !!currentUser.id) && !!schoolConfig
    });

    const { data: allSchoolEntries = [] } = useQuery({
        queryKey: ['allSchoolTimetable', schoolId, schoolConfig?.current_term, schoolConfig?.academic_year],
        queryFn: async () => {
            const { data } = await supabase
                .from('timetable_entries')
                .select('*, classes(name), teachers:teacher_id(name:full_name)')
                .eq('school_id', schoolId)
                .eq('term', schoolConfig?.current_term)
                .eq('academic_year', schoolConfig?.academic_year);
            return data || [];
        },
        enabled: !!schoolId && !!schoolConfig
    });

    const checkConflicts = (newEntry: any) => {
        const overlaps = (s1: string, e1: string, s2: string, e2: string) => {
            return s1 < e2 && s2 < e1;
        };

        const conflicts = allSchoolEntries.filter((entry: any) => {
            // Skip the entry itself if editing
            if (editingEntry && entry.id === editingEntry.id) return false;

            // Only check same day
            if (entry.day_of_week !== newEntry.day_of_week) return false;

            // Check for time overlap
            if (!overlaps(entry.start_time, entry.end_time, newEntry.start_time, newEntry.end_time)) return false;

            // 1. Teacher Conflict
            if (newEntry.teacher_id && entry.teacher_id === newEntry.teacher_id) {
                return { type: 'Teacher', name: entry.teachers?.name || 'Teacher', cls: entry.classes?.name };
            }

            // 2. Room Conflict
            if (newEntry.room_number && entry.room_number === newEntry.room_number) {
                return { type: 'Room', name: entry.room_number, cls: entry.classes?.name };
            }

            // 3. Class Conflict (Same class can't have two things at once)
            if (entry.class_id === newEntry.class_id) {
                return { type: 'Class', name: entry.classes?.name };
            }

            return false;
        });

        // The filter returns the entry if it's truthy, but filter expects a boolean. 
        // Let's refine to return the specific conflict reason.
        for (const entry of allSchoolEntries) {
            if (editingEntry && entry.id === editingEntry.id) continue;
            if (entry.day_of_week !== newEntry.day_of_week) continue;
            if (!overlaps(entry.start_time, entry.end_time, newEntry.start_time, newEntry.end_time)) continue;

            if (newEntry.teacher_id && entry.teacher_id === newEntry.teacher_id)
                return `Teacher Conflict: ${entry.teachers?.name || 'Teacher'} is already busy with ${entry.classes?.name} at this time.`;

            if (newEntry.room_number && entry.room_number === newEntry.room_number)
                return `Room Conflict: Room ${entry.room_number} is occupied by ${entry.classes?.name} at this time.`;

            if (entry.class_id === newEntry.class_id)
                return `Class Conflict: This class already has a session scheduled at this time.`;
        }

        return null;
    };

    // Auto-select first class for admin
    useEffect(() => {
        if (currentUser.role === 'admin' && classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, currentUser, selectedClassId]);

    // --- Mutations ---
    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (editingEntry) {
                const { error } = await supabase.from('timetable_entries').update(payload).eq('id', editingEntry.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('timetable_entries').insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable'] });
            setIsModalOpen(false);
            setEditingEntry(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('timetable_entries').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timetable'] })
    });

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Weekly Timetable</h1>
                    <p className="text-slate-400 text-sm font-medium">Full schedule management and conflict checking</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-slate-50 p-1 rounded-xl flex shadow-sm border border-slate-100">
                        <button
                            onClick={() => setViewMode('teacher')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'teacher' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                        >
                            Teacher
                        </button>
                        <button
                            onClick={() => setViewMode('class')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'class' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                        >
                            Class
                        </button>
                    </div>

                    {(currentUser.role === 'admin' || viewMode === 'class') && (
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-slate-400 shadow-sm transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select Class</option>
                            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}

                    {currentUser.role === 'admin' && (
                        <button
                            onClick={() => {
                                setEditingEntry(null);
                                setFormData({
                                    day_of_week: activeDay,
                                    start_time: '08:00',
                                    end_time: '09:00',
                                    type: 'Lesson',
                                    subject_id: '',
                                    teacher_id: '',
                                    room_number: '',
                                    activity_name: ''
                                });
                                setIsModalOpen(true);
                            }}
                            disabled={!selectedClassId && viewMode === 'class'}
                            className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Full Weekly Grid */}
            <div className="hidden md:grid grid-cols-5 gap-4">
                {DAYS.map(day => (
                    <div key={day} className="flex-1 flex flex-col min-h-[600px]">
                        <div className="text-center py-4 bg-slate-50 border-x border-t border-slate-100 rounded-t-2xl">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{day}</h3>
                        </div>
                        <div className="flex-1 bg-slate-50/20 border border-slate-100 p-2 space-y-2 rounded-b-2xl overflow-y-auto max-h-[700px]">
                            {timetableData
                                .filter(t => t.day_of_week === day)
                                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                .map((entry) => (
                                    <div
                                        key={entry.id}
                                        onClick={() => {
                                            if (currentUser.role === 'admin') {
                                                setEditingEntry(entry);
                                                setFormData({
                                                    day_of_week: entry.day_of_week,
                                                    start_time: entry.start_time,
                                                    end_time: entry.end_time,
                                                    type: entry.type as any,
                                                    subject_id: entry.subject_id || '',
                                                    teacher_id: entry.teacher_id || '',
                                                    room_number: entry.room_number || '',
                                                    activity_name: entry.activity_name || ''
                                                });
                                                setIsModalOpen(true);
                                            }
                                        }}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer group relative shadow-sm hover:shadow-md ${entry.type === 'Lesson' ? 'bg-white border-slate-100 hover:border-blue-200' :
                                            entry.type === 'Break' ? 'bg-orange-50/50 border-orange-100/50' :
                                                'bg-slate-100/30 border-slate-100'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-start">
                                                <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
                                                {currentUser.role === 'admin' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('Delete entry?')) deleteMutation.mutate(entry.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <h4 className="text-xs font-black text-slate-800 leading-tight uppercase tracking-tight">
                                                {entry.subjects?.name || entry.activity_name || entry.type}
                                            </h4>
                                            <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold truncate">
                                                <User className="h-2.5 w-2.5 text-slate-300" />
                                                {viewMode === 'teacher' ? entry.classes?.name : entry.teachers?.name || 'Unassigned'}
                                            </div>
                                            {entry.room_number && (
                                                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium italic">
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    Room {entry.room_number}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            {timetableData.filter(t => t.day_of_week === day).length === 0 && (
                                <div className="py-12 text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] italic opacity-40">
                                    No Session
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {DAYS.map(day => (
                        <button
                            key={day}
                            onClick={() => setActiveDay(day)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 ${activeDay === day ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                        >
                            {day}
                        </button>
                    ))}
                </div>

                {timetableLoading ? (
                    <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin text-slate-200 mx-auto" /></div>
                ) : !selectedClassId && viewMode === 'class' ? (
                    <div className="py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-widest">Select a class first</div>
                ) : (
                    <div className="space-y-3">
                        {timetableData.filter(t => t.day_of_week === activeDay).length > 0 ? (
                            timetableData
                                .filter(t => t.day_of_week === activeDay)
                                .map((entry) => (
                                    <div key={entry.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                        <div className="w-16 flex flex-col items-center border-r border-slate-50 pr-4">
                                            <span className="text-[10px] font-black text-slate-800">{entry.start_time.slice(0, 5)}</span>
                                            <span className="text-[10px] font-bold text-slate-300">{entry.end_time.slice(0, 5)}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{entry.subjects?.name || entry.activity_name}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold">{entry.teachers?.name || entry.classes?.name}</p>
                                        </div>
                                        {currentUser.role === 'admin' && (
                                            <button onClick={() => {
                                                setEditingEntry(entry);
                                                setFormData({ day_of_week: entry.day_of_week, start_time: entry.start_time, end_time: entry.end_time, type: entry.type as any, subject_id: entry.subject_id || '', teacher_id: entry.teacher_id || '', room_number: entry.room_number || '', activity_name: entry.activity_name || '' });
                                                setIsModalOpen(true);
                                            }} className="p-2 text-slate-300"><Edit2 className="h-4 w-4" /></button>
                                        )}
                                    </div>
                                ))
                        ) : (
                            <div className="py-12 text-center text-slate-300 italic text-xs font-bold">No sessions scheduled</div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 flex justify-between items-center border-b border-slate-50 bg-slate-50/50">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{editingEntry ? 'Edit Session' : 'New Session'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white transition-colors group"><X className="h-4 w-4 text-slate-400 group-hover:text-slate-900" /></button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const payload = { school_id: currentUser.school_id, class_id: selectedClassId, day_of_week: formData.day_of_week, start_time: formData.start_time, end_time: formData.end_time, type: formData.type, subject_id: formData.type === 'Lesson' ? formData.subject_id || null : null, teacher_id: formData.type === 'Lesson' ? formData.teacher_id || null : null, room_number: formData.room_number, activity_name: formData.type === 'Other' ? formData.activity_name : null, term: schoolConfig?.current_term, academic_year: schoolConfig?.academic_year };
                            const conflictError = checkConflicts(payload);
                            if (conflictError) { alert(conflictError); return; }
                            saveMutation.mutate(payload);
                        }} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Day</label>
                                    <select value={formData.day_of_week} onChange={e => setFormData({ ...formData, day_of_week: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all">
                                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all">
                                        {['Lesson', 'Break', 'Assembly', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                                    <input type="time" required value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                                    <input type="time" required value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all" />
                                </div>
                            </div>

                            {formData.type === 'Lesson' && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject / Course</label>
                                        <select required value={formData.subject_id} onChange={e => setFormData({ ...formData, subject_id: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all">
                                            <option value="">Choose Course</option>
                                            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Teacher</label>
                                        <select value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all">
                                            <option value="">Auto-Assign / None</option>
                                            {teachersList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Room / Venue (Optional)</label>
                                <input type="text" placeholder="e.g. Lab 1, Room 10" value={formData.room_number} onChange={e => setFormData({ ...formData, room_number: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-slate-100 transition-all" />
                            </div>

                            <button type="submit" disabled={saveMutation.isPending} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all mt-4 disabled:opacity-50 shadow-xl shadow-slate-200">
                                {saveMutation.isPending ? 'Processing...' : editingEntry ? 'Update Schedule' : 'Create Session'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Timetable;
