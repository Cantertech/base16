import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    CheckCircle, XCircle, Search, Calendar, ChevronLeft, ChevronRight, 
    Clock, UserX, UserCheck, BarChart3, PieChart as PieIcon, TrendingUp,
    RotateCcw, Sparkles
} from 'lucide-react';
import Loading from './Loading';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface TeacherAttendanceProps {
    schoolId: string;
    teachers: any[];
}

const TeacherAttendance: React.FC<TeacherAttendanceProps> = ({ schoolId, teachers }) => {
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Unmarked'>('All');
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsMonth, setStatsMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // 1. Daily Attendance Query
    const { data: attendanceMap = {}, isLoading } = useQuery({
        queryKey: ['teacherAttendance', schoolId, selectedDate],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('teacher_attendance')
                .select('teacher_id, status, notes')
                .eq('school_id', schoolId)
                .eq('date', selectedDate);

            if (error) {
                console.warn('Teacher attendance query notice:', error.message);
                return {};
            }
            const map: Record<string, string> = {};
            data?.forEach((r: any) => {
                if (r.teacher_id) map[r.teacher_id] = r.status;
            });
            return map;
        },
        enabled: !!schoolId
    });

    // 2. Monthly Analytics Query
    const { data: monthlyStats, isLoading: statsLoading } = useQuery({
        queryKey: ['teacherMonthlyStats', schoolId, statsMonth],
        queryFn: async () => {
            const startStr = `${statsMonth}-01`;
            const [y, m] = statsMonth.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const endStr = `${statsMonth}-${lastDay < 10 ? '0' + lastDay : lastDay}`;

            const { data, error } = await supabase
                .from('teacher_attendance')
                .select('teacher_id, status, date')
                .eq('school_id', schoolId)
                .gte('date', startStr)
                .lte('date', endStr);

            if (error) {
                console.warn('Monthly attendance stats notice:', error.message);
                return { pieData: [], dailyData: [], teacherStats: {} };
            }

            // Process stats
            const statusCounts: Record<string, number> = { Present: 0, Late: 0, Absent: 0, 'On Leave': 0 };
            const teacherStats: Record<string, any> = {};

            data?.forEach((r: any) => {
                if (statusCounts[r.status] !== undefined) {
                    statusCounts[r.status]++;
                }
                if (!teacherStats[r.teacher_id]) {
                    teacherStats[r.teacher_id] = { Present: 0, Late: 0, Absent: 0, 'On Leave': 0, total: 0 };
                }
                if (teacherStats[r.teacher_id][r.status] !== undefined) {
                    teacherStats[r.teacher_id][r.status]++;
                }
                teacherStats[r.teacher_id].total++;
            });

            const pieData = Object.entries(statusCounts).map(([name, value]) => ({
                name,
                value,
                color: name === 'Present' ? '#16a34a' : name === 'Late' ? '#f59e0b' : name === 'Absent' ? '#ef4444' : '#3b82f6'
            }));

            // Daily chart data
            const dailyMap: Record<string, any> = {};
            data?.forEach((r: any) => {
                const day = r.date.split('-')[2];
                if (!dailyMap[r.date]) dailyMap[r.date] = { date: day, Present: 0, Late: 0, Absent: 0 };
                if (r.status !== 'On Leave' && dailyMap[r.date][r.status] !== undefined) {
                    dailyMap[r.date][r.status]++;
                }
            });
            const dailyData = Object.values(dailyMap).sort((a: any, b: any) => Number(a.date) - Number(b.date));

            return { pieData, dailyData, teacherStats };
        },
        enabled: showStatsModal && !!schoolId
    });

    // 3. Mark Single Attendance Mutation
    const markAttendanceMutation = useMutation({
        mutationFn: async ({ teacherId, status }: { teacherId: string, status: string }) => {
            if (status === 'None') {
                const { error } = await supabase
                    .from('teacher_attendance')
                    .delete()
                    .eq('school_id', schoolId)
                    .eq('teacher_id', teacherId)
                    .eq('date', selectedDate);
                if (error) throw error;
                return { teacherId, status: null };
            }
            let { error } = await supabase
                .from('teacher_attendance')
                .upsert({
                    school_id: schoolId,
                    teacher_id: teacherId,
                    date: selectedDate,
                    status: status
                }, { onConflict: 'school_id,teacher_id,date' });

            if (error && error.message?.includes('conflict')) {
                const retry = await supabase
                    .from('teacher_attendance')
                    .upsert({
                        school_id: schoolId,
                        teacher_id: teacherId,
                        date: selectedDate,
                        status: status
                    }, { onConflict: 'teacher_id,date' });
                if (retry.error) throw retry.error;
            } else if (error) {
                throw error;
            }
            return { teacherId, status };
        },
        onMutate: async ({ teacherId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
            const previousMap = queryClient.getQueryData<Record<string, string>>(['teacherAttendance', schoolId, selectedDate]);

            queryClient.setQueryData<Record<string, string>>(['teacherAttendance', schoolId, selectedDate], (old: any) => {
                const newMap = { ...old };
                if (status === 'None') delete newMap[teacherId];
                else newMap[teacherId] = status;
                return newMap;
            });
            return { previousMap };
        },
        onError: (err: any, _vars, context: any) => {
            queryClient.setQueryData(['teacherAttendance', schoolId, selectedDate], context?.previousMap);
            alert(`Failed to save attendance: ${err.message || 'Please verify database schema'}`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['teacherMonthlyAttendanceForPayroll', schoolId] });
        }
    });

    // 4. Mark All Present Mutation
    const markAllMutation = useMutation({
        mutationFn: async () => {
            const inserts = teachers.map(t => ({
                school_id: schoolId,
                teacher_id: t.id,
                date: selectedDate,
                status: 'Present'
            }));
            let { error } = await supabase
                .from('teacher_attendance')
                .upsert(inserts, { onConflict: 'school_id,teacher_id,date' });
            if (error && error.message?.includes('conflict')) {
                const retry = await supabase
                    .from('teacher_attendance')
                    .upsert(inserts, { onConflict: 'teacher_id,date' });
                if (retry.error) throw retry.error;
            } else if (error) {
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['teacherMonthlyAttendanceForPayroll', schoolId] });
        },
        onError: (err: any) => {
            alert(`Failed to mark all: ${err.message}`);
        }
    });

    // 5. Clear All Attendance for the Day Mutation
    const clearAllMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('teacher_attendance')
                .delete()
                .eq('school_id', schoolId)
                .eq('date', selectedDate);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['teacherMonthlyAttendanceForPayroll', schoolId] });
        },
        onError: (err: any) => {
            alert(`Failed to clear day attendance: ${err.message}`);
        }
    });

    // Date Navigation Helpers
    const changeDate = (days: number) => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + days);
        setSelectedDate(current.toISOString().split('T')[0]);
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const toggleAttendance = (teacherId: string, currentStatus: string | undefined, newStatus: string) => {
        if (currentStatus === newStatus) {
            markAttendanceMutation.mutate({ teacherId, status: 'None' }); // Toggle off
        } else {
            markAttendanceMutation.mutate({ teacherId, status: newStatus });
        }
    };

    // Attendance stats for today
    const counts = {
        total: teachers.length,
        present: teachers.filter(t => attendanceMap[t.id] === 'Present').length,
        late: teachers.filter(t => attendanceMap[t.id] === 'Late').length,
        absent: teachers.filter(t => attendanceMap[t.id] === 'Absent').length,
        onLeave: teachers.filter(t => attendanceMap[t.id] === 'On Leave' || attendanceMap[t.id] === 'Half Day').length,
        unmarked: teachers.filter(t => !attendanceMap[t.id]).length
    };

    // Filter teachers list
    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.subject && t.subject.toLowerCase().includes(searchQuery.toLowerCase()));
        const status = attendanceMap[t.id];

        let matchesStatus = true;
        if (statusFilter === 'Present') matchesStatus = status === 'Present';
        else if (statusFilter === 'Late') matchesStatus = status === 'Late';
        else if (statusFilter === 'Absent') matchesStatus = status === 'Absent';
        else if (statusFilter === 'On Leave') matchesStatus = status === 'On Leave' || status === 'Half Day';
        else if (statusFilter === 'Unmarked') matchesStatus = !status;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20 md:pb-0">
            {/* Top Quick Status Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <button
                    onClick={() => setStatusFilter('All')}
                    className={`p-4 rounded-xl border text-left transition-all ${statusFilter === 'All' ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20' : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'}`}
                >
                    <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'All' ? 'text-slate-300' : 'text-slate-400'}`}>Total Staff</p>
                    <p className="text-2xl font-black mt-1">{counts.total}</p>
                </button>

                <button
                    onClick={() => setStatusFilter('Present')}
                    className={`p-4 rounded-xl border text-left transition-all ${statusFilter === 'Present' ? 'bg-green-600 text-white border-green-600 shadow-md ring-2 ring-green-500/20' : 'bg-white text-slate-800 border-slate-200 hover:border-green-300'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'Present' ? 'text-green-100' : 'text-green-600'}`}>Present</p>
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    </div>
                    <p className="text-2xl font-black mt-1">{counts.present}</p>
                </button>

                <button
                    onClick={() => setStatusFilter('Late')}
                    className={`p-4 rounded-xl border text-left transition-all ${statusFilter === 'Late' ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20' : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'Late' ? 'text-amber-100' : 'text-amber-600'}`}>Late</p>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <p className="text-2xl font-black mt-1">{counts.late}</p>
                </button>

                <button
                    onClick={() => setStatusFilter('Absent')}
                    className={`p-4 rounded-xl border text-left transition-all ${statusFilter === 'Absent' ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-600/20' : 'bg-white text-slate-800 border-slate-200 hover:border-red-300'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'Absent' ? 'text-red-100' : 'text-red-600'}`}>Absent</p>
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    </div>
                    <p className="text-2xl font-black mt-1">{counts.absent}</p>
                </button>

                <button
                    onClick={() => setStatusFilter('On Leave')}
                    className={`p-4 rounded-xl border text-left transition-all ${statusFilter === 'On Leave' ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/20' : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'On Leave' ? 'text-blue-100' : 'text-blue-600'}`}>On Leave</p>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    </div>
                    <p className="text-2xl font-black mt-1">{counts.onLeave}</p>
                </button>

                <button
                    onClick={() => setStatusFilter('Unmarked')}
                    className={`p-4 rounded-xl border text-left transition-all ${statusFilter === 'Unmarked' ? 'bg-slate-500 text-white border-slate-500 shadow-md ring-2 ring-slate-500/20' : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'Unmarked' ? 'text-slate-100' : 'text-slate-400'}`}>Unmarked</p>
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    </div>
                    <p className="text-2xl font-black mt-1">{counts.unmarked}</p>
                </button>
            </div>

            {/* Date Picker & Action Controls */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
                    {/* Date Selector with Next / Prev Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => changeDate(-1)}
                            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"
                            title="Previous Day"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm font-semibold text-slate-800"
                            />
                        </div>
                        <button
                            onClick={() => changeDate(1)}
                            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"
                            title="Next Day"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        {!isToday && (
                            <button
                                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                className="px-3 py-2 text-xs font-bold text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                            >
                                Today
                            </button>
                        )}
                    </div>

                    {/* Batch Actions & Search */}
                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                        <button
                            onClick={() => markAllMutation.mutate()}
                            disabled={markAllMutation.isPending || counts.present === counts.total}
                            className="px-4 py-2 bg-green-600 text-white font-bold text-xs rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                        >
                            <UserCheck className="h-4 w-4" />
                            Mark All Present
                        </button>

                        {counts.total - counts.unmarked > 0 && (
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to clear attendance for this date?')) {
                                        clearAllMutation.mutate();
                                    }
                                }}
                                disabled={clearAllMutation.isPending}
                                className="px-3 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                                title="Reset Day"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Clear
                            </button>
                        )}

                        <button
                            onClick={() => setShowStatsModal(true)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 flex items-center justify-center gap-2 border border-indigo-100 transition-colors"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                        </button>

                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 focus:outline-none w-full text-xs font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Teacher Attendance Roster */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 flex justify-center">
                        <Loading type="spinner" fullScreen={false} />
                    </div>
                ) : filteredTeachers.length > 0 ? (
                    <>
                        {/* Desktop View Table */}
                        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Teacher / Staff</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Mark Attendance</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Daily Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTeachers.map(teacher => {
                                        const status = attendanceMap[teacher.id];
                                        return (
                                            <tr key={teacher.id} className="hover:bg-slate-50/60 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs border border-slate-200">
                                                            {teacher.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">{teacher.name}</div>
                                                            <div className="text-xs text-slate-400 font-medium">
                                                                {teacher.subject ? `${teacher.subject} • ` : ''}{teacher.assigned_class ? `Class: ${teacher.assigned_class}` : 'Staff Member'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-1.5">
                                                        {(['Present', 'Late', 'Absent', 'On Leave'] as const).map((s) => (
                                                            <button
                                                                key={s}
                                                                onClick={() => toggleAttendance(teacher.id, status, s)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${status === s
                                                                    ? s === 'Present' ? 'bg-green-600 text-white border-green-700 shadow-md ring-2 ring-green-500/20'
                                                                        : s === 'Late' ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
                                                                            : s === 'Absent' ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-600/20'
                                                                                : 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-600/20'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                                    }`}
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {status ? (
                                                        <span className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full ${status === 'Present' ? 'bg-green-50 text-green-700' : status === 'Late' ? 'bg-amber-50 text-amber-700' : status === 'Absent' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                                            {status === 'Present' && <CheckCircle className="h-3 w-3" />}
                                                            {status === 'Absent' && <XCircle className="h-3 w-3" />}
                                                            {(status === 'Late' || status === 'On Leave') && <Clock className="h-3 w-3" />}
                                                            {status}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic font-medium">Unmarked</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View Cards */}
                        <div className="md:hidden grid grid-cols-1 gap-3">
                            {filteredTeachers.map(teacher => {
                                const status = attendanceMap[teacher.id];
                                return (
                                    <div key={teacher.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs border border-slate-200">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">{teacher.name}</h4>
                                                    <p className="text-xs text-slate-400">{teacher.subject || 'Staff Member'}</p>
                                                </div>
                                            </div>
                                            {status ? (
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${status === 'Present' ? 'bg-green-100 text-green-700' : status === 'Late' ? 'bg-amber-100 text-amber-700' : status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {status}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 italic">Unmarked</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            {(['Present', 'Late', 'Absent', 'On Leave'] as const).map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => toggleAttendance(teacher.id, status, s)}
                                                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${status === s
                                                        ? s === 'Present' ? 'bg-green-600 text-white border-green-700 ring-2 ring-green-500/20'
                                                            : s === 'Late' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-500/20'
                                                                : s === 'Absent' ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-600/20'
                                                                    : 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-600/20'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 active:bg-slate-100'
                                                        }`}
                                                >
                                                    {s === 'Present' && <CheckCircle className="h-3 w-3" />}
                                                    {s === 'Absent' && <XCircle className="h-3 w-3" />}
                                                    {(s === 'Late' || s === 'On Leave') && <Clock className="h-3 w-3" />}
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
                        <UserX className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-bold">No teachers match this filter</p>
                        <p className="text-xs text-slate-400 mt-1">Try switching to 'All' or clearing your search query.</p>
                    </div>
                )}
            </div>

            {/* Attendance Analytics Modal */}
            {showStatsModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                                    Staff Attendance Analytics
                                </h3>
                                <p className="text-xs text-slate-500">Monthly attendance recap and punctuality metrics</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="month"
                                    value={statsMonth}
                                    onChange={e => setStatsMonth(e.target.value)}
                                    className="p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button 
                                    onClick={() => setShowStatsModal(false)} 
                                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                                >
                                    <XCircle className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {statsLoading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <Loading type="spinner" fullScreen={false} />
                                </div>
                            ) : (
                                <>
                                    {/* Monthly Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-green-50/60 border border-green-100 p-5 rounded-2xl flex items-center gap-4">
                                            <div className="p-3.5 bg-green-600 text-white rounded-xl shadow-md">
                                                <TrendingUp className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Attendance Rate</p>
                                                <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                                                    {monthlyStats?.pieData[0]?.value ? Math.round((monthlyStats.pieData[0].value / Math.max(1, monthlyStats.pieData.reduce((s: any, c: any) => s + c.value, 0))) * 100) : 0}%
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50/60 border border-amber-100 p-5 rounded-2xl flex items-center gap-4">
                                            <div className="p-3.5 bg-amber-500 text-white rounded-xl shadow-md">
                                                <Clock className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Total Late Marks</p>
                                                <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                                                    {monthlyStats?.pieData.find((p: any) => p.name === 'Late')?.value || 0}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50/60 border border-indigo-100 p-5 rounded-2xl flex items-center gap-4">
                                            <div className="p-3.5 bg-indigo-600 text-white rounded-xl shadow-md">
                                                <Sparkles className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Active Staff</p>
                                                <h4 className="text-2xl font-black text-slate-900 mt-0.5">{teachers.length}</h4>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Charts Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                                                <PieIcon className="h-4 w-4 text-indigo-600" /> Status Distribution
                                            </h4>
                                            <div className="h-60">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={monthlyStats?.pieData}
                                                            innerRadius={55}
                                                            outerRadius={80}
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                        >
                                                            {monthlyStats?.pieData.map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip />
                                                        <Legend verticalAlign="bottom" height={36} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                                                <Calendar className="h-4 w-4 text-indigo-600" /> Daily Present vs Absent
                                            </h4>
                                            <div className="h-60">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={monthlyStats?.dailyData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="date" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Bar dataKey="Present" fill="#16a34a" stackId="a" />
                                                        <Bar dataKey="Late" fill="#f59e0b" stackId="a" />
                                                        <Bar dataKey="Absent" fill="#ef4444" stackId="a" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Individual Teacher Attendance Table */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                            <h4 className="font-bold text-slate-800 text-sm">Individual Staff Monthly Breakdown</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-3.5">Teacher</th>
                                                        <th className="px-6 py-3.5 text-center">Present</th>
                                                        <th className="px-6 py-3.5 text-center">Late</th>
                                                        <th className="px-6 py-3.5 text-center">Absent</th>
                                                        <th className="px-6 py-3.5 text-right">Attendance Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-sm">
                                                    {teachers.map(teacher => {
                                                        const ts = monthlyStats?.teacherStats[teacher.id] || { Present: 0, Late: 0, Absent: 0, total: 0 };
                                                        const rate = ts.total > 0 ? Math.round((ts.Present / ts.total) * 100) : 0;
                                                        return (
                                                            <tr key={teacher.id} className="hover:bg-slate-50/60 transition-colors">
                                                                <td className="px-6 py-3.5 font-bold text-slate-800">{teacher.name}</td>
                                                                <td className="px-6 py-3.5 text-center text-green-600 font-bold">{ts.Present}</td>
                                                                <td className="px-6 py-3.5 text-center text-amber-600 font-bold">{ts.Late}</td>
                                                                <td className="px-6 py-3.5 text-center text-red-600 font-bold">{ts.Absent}</td>
                                                                <td className="px-6 py-3.5 text-right font-black text-slate-900">{rate}%</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherAttendance;
