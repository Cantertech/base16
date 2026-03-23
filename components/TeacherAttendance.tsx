import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Search, Calendar, ChevronLeft, ChevronRight, Clock, UserX, UserCheck, BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';
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
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsMonth, setStatsMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const { data: attendanceMap = {}, isLoading } = useQuery({
        queryKey: ['teacherAttendance', schoolId, selectedDate],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('teacher_attendance')
                .select('teacher_id, status')
                .eq('school_id', schoolId)
                .eq('date', selectedDate);

            if (error) throw error;
            const map: Record<string, string> = {};
            data?.forEach((r: any) => map[r.teacher_id] = r.status);
            return map;
        },
        enabled: !!schoolId
    });

    const { data: monthlyStats, isLoading: statsLoading } = useQuery({
        queryKey: ['teacherMonthlyStats', schoolId, statsMonth],
        queryFn: async () => {
            const startStr = `${statsMonth}-01`;
            const [y, m] = statsMonth.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const endStr = `${statsMonth}-${lastDay}`;

            const { data, error } = await supabase
                .from('teacher_attendance')
                .select('teacher_id, status, date')
                .eq('school_id', schoolId)
                .gte('date', startStr)
                .lte('date', endStr);

            if (error) throw error;

            // Process stats
            const statusCounts: Record<string, number> = { Present: 0, Late: 0, Absent: 0, 'On Leave': 0 };
            const teacherStats: Record<string, any> = {};

            data?.forEach((r: any) => {
                statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
                if (!teacherStats[r.teacher_id]) {
                    teacherStats[r.teacher_id] = { Present: 0, Late: 0, Absent: 0, 'On Leave': 0, total: 0 };
                }
                teacherStats[r.teacher_id][r.status]++;
                teacherStats[r.teacher_id].total++;
            });

            const pieData = Object.entries(statusCounts).map(([name, value]) => ({
                name,
                value,
                color: name === 'Present' ? '#16a34a' : name === 'Late' ? '#ca8a04' : name === 'Absent' ? '#dc2626' : '#2563eb'
            }));

            // Daily chart data
            const dailyMap: Record<string, any> = {};
            data?.forEach(r => {
                if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date.split('-')[2], Present: 0, Late: 0, Absent: 0 };
                if (r.status !== 'On Leave') dailyMap[r.date][r.status]++;
            });
            const dailyData = Object.values(dailyMap).sort((a: any, b: any) => Number(a.date) - Number(b.date));

            return { pieData, dailyData, teacherStats };
        },
        enabled: showStatsModal && !!schoolId
    });

    const markAttendanceMutation = useMutation({
        mutationFn: async ({ teacherId, status }: { teacherId: string, status: string }) => {
            if (status === 'None') {
                await supabase.from('teacher_attendance').delete().eq('teacher_id', teacherId).eq('date', selectedDate);
                return { teacherId, status: null };
            }
            const { error } = await supabase.from('teacher_attendance').upsert({
                school_id: schoolId,
                teacher_id: teacherId,
                date: selectedDate,
                status: status
            }, { onConflict: 'school_id,teacher_id,date' });
            if (error) throw error;
            return { teacherId, status };
        },
        onMutate: async ({ teacherId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
            const previousMap = queryClient.getQueryData(['teacherAttendance', schoolId, selectedDate]);

            queryClient.setQueryData(['teacherAttendance', schoolId, selectedDate], (old: any) => {
                const newMap = { ...old };
                if (status === 'None') delete newMap[teacherId];
                else newMap[teacherId] = status;
                return newMap;
            });
            return { previousMap };
        },
        onError: (err, variables, context: any) => {
            queryClient.setQueryData(['teacherAttendance', schoolId, selectedDate], context.previousMap);
            alert('Failed to mark attendance');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
        }
    });

    const markAllMutation = useMutation({
        mutationFn: async () => {
            const inserts = filteredTeachers.map(t => ({
                school_id: schoolId,
                teacher_id: t.id,
                date: selectedDate,
                status: 'Present'
            }));
            const { error } = await supabase.from('teacher_attendance').upsert(inserts, { onConflict: 'school_id,teacher_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacherAttendance', schoolId, selectedDate] });
            alert("All displayed teachers marked as Present!");
        }
    });

    const filteredTeachers = teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const toggleAttendance = (teacherId: string, currentStatus: string | undefined, newStatus: string) => {
        if (currentStatus === newStatus) {
            markAttendanceMutation.mutate({ teacherId, status: 'None' }); // Toggle off
        } else {
            markAttendanceMutation.mutate({ teacherId, status: newStatus });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20 md:pb-0">
            <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none w-full text-sm font-medium"
                            />
                        </div>
                        <button
                            onClick={() => markAllMutation.mutate()}
                            disabled={markAllMutation.isPending}
                            className="px-4 py-2 bg-green-50 text-green-700 font-bold rounded-lg hover:bg-green-100 flex items-center justify-center gap-2 border border-green-100 transition-colors whitespace-nowrap"
                        >
                            <UserCheck className="h-4 w-4" />
                            Mark All Present
                        </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => setShowStatsModal(true)}
                            className="px-4 py-2 bg-primary-50 text-primary-700 font-bold rounded-lg hover:bg-primary-100 flex items-center justify-center gap-2 border border-primary-100 transition-colors"
                        >
                            <BarChart3 className="h-4 w-4" />
                            View Analytics
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search teachers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 flex justify-center"><Loading type="spinner" fullScreen={false} /></div>
                ) : filteredTeachers.length > 0 ? (
                    <>
                        {/* Desktop View Table */}
                        <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Teacher</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTeachers.map(teacher => {
                                        const status = attendanceMap[teacher.id];
                                        return (
                                            <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{teacher.name}</div>
                                                    <div className="text-xs text-slate-500 font-medium">{teacher.subject || 'Generic Staff'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-1.5">
                                                        {['Present', 'Late', 'Absent', 'On Leave'].map((s) => (
                                                            <button
                                                                key={s}
                                                                onClick={() => toggleAttendance(teacher.id, status, s)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${status === s
                                                                    ? s === 'Present' ? 'bg-green-600 text-white border-green-700 shadow-md'
                                                                        : s === 'Late' ? 'bg-orange-500 text-white border-orange-600 shadow-md'
                                                                            : s === 'Absent' ? 'bg-red-500 text-white border-red-600 shadow-md'
                                                                                : 'bg-blue-600 text-white border-blue-700 shadow-md'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {status ? (
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full ${status === 'Present' ? 'bg-green-50 text-green-600' : status === 'Late' ? 'bg-orange-50 text-orange-600' : status === 'Absent' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {status}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic font-medium">Not Marked</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View Cards */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {filteredTeachers.map(teacher => {
                                const status = attendanceMap[teacher.id];
                                return (
                                    <div key={teacher.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{teacher.name}</h4>
                                                <p className="text-xs text-slate-500 font-medium">{teacher.subject || 'Generic Staff'}</p>
                                            </div>
                                            {status ? (
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${status === 'Present' ? 'bg-green-100 text-green-700' : status === 'Late' ? 'bg-orange-100 text-orange-700' : status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {status}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 italic">Unmarked</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Present', 'Late', 'Absent', 'On Leave'].map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => toggleAttendance(teacher.id, status, s)}
                                                    className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${status === s
                                                        ? s === 'Present' ? 'bg-green-600 text-white border-green-700 ring-2 ring-green-500/20'
                                                            : s === 'Late' ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-500/20'
                                                                : s === 'Absent' ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-500/20'
                                                                    : 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/20'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 active:bg-slate-100'
                                                        }`}
                                                >
                                                    {s === 'Present' && <CheckCircle className="h-3.5 w-3.5" />}
                                                    {s === 'Absent' && <XCircle className="h-3.5 w-3.5" />}
                                                    {(s === 'Late' || s === 'On Leave') && <Clock className="h-3.5 w-3.5" />}
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
                        <p className="text-slate-500 font-medium">No teachers found matching your search.</p>
                    </div>
                )}
            </div>

            {/* Stats Modal */}
            {showStatsModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-primary-600" />
                                    Attendance Analytics
                                </h3>
                                <p className="text-sm text-slate-500">Monthly staff patterns and performance</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input
                                    type="month"
                                    value={statsMonth}
                                    onChange={e => setStatsMonth(e.target.value)}
                                    className="p-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <button onClick={() => setShowStatsModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                                    <XCircle className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {statsLoading ? (
                                <div className="h-64 flex items-center justify-center"><Loading type="spinner" fullScreen={false} /></div>
                            ) : (
                                <>
                                    {/* Summary Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                            <div className="p-4 bg-green-50 text-green-600 rounded-xl">
                                                <TrendingUp className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Avg. Presence</p>
                                                <h4 className="text-2xl font-black text-slate-800">
                                                    {monthlyStats?.pieData[0]?.value ? Math.round((monthlyStats.pieData[0].value / monthlyStats.pieData.reduce((s: any, c: any) => s + c.value, 0)) * 100) : 0}%
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                            <div className="p-4 bg-orange-50 text-orange-600 rounded-xl">
                                                <Clock className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Total Latencies</p>
                                                <h4 className="text-2xl font-black text-slate-800">{monthlyStats?.pieData.find((p: any) => p.name === 'Late')?.value || 0}</h4>
                                            </div>
                                        </div>
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                            <div className="p-4 bg-primary-50 text-primary-600 rounded-xl">
                                                <UserCheck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Active Staff</p>
                                                <h4 className="text-2xl font-black text-slate-800">{teachers.length}</h4>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Status Distribution */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                            <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><PieIcon className="h-4 w-4" /> Status Distribution</h4>
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={monthlyStats?.pieData}
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={5}
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

                                        {/* Daily Trend */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                            <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Calendar className="h-4 w-4" /> Daily Trends</h4>
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={monthlyStats?.dailyData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="date" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Bar dataKey="Present" fill="#16a34a" stackId="a" />
                                                        <Bar dataKey="Late" fill="#ca8a04" stackId="a" />
                                                        <Bar dataKey="Absent" fill="#dc2626" stackId="a" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Individual Table */}
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-slate-50 bg-slate-50/30">
                                            <h4 className="font-bold text-slate-800">Staff Monthly Recap</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-4">Teacher</th>
                                                        <th className="px-6 py-4 text-center">Present</th>
                                                        <th className="px-6 py-4 text-center">Late</th>
                                                        <th className="px-6 py-4 text-center">Absent</th>
                                                        <th className="px-6 py-4 text-right">Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {teachers.map(teacher => {
                                                        const ts = monthlyStats?.teacherStats[teacher.id] || { Present: 0, Late: 0, Absent: 0, total: 0 };
                                                        const rate = ts.total > 0 ? Math.round((ts.Present / ts.total) * 100) : 0;
                                                        return (
                                                            <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-6 py-4 font-bold text-slate-700">{teacher.name}</td>
                                                                <td className="px-6 py-4 text-center text-green-600 font-bold">{ts.Present}</td>
                                                                <td className="px-6 py-4 text-center text-orange-600 font-bold">{ts.Late}</td>
                                                                <td className="px-6 py-4 text-center text-red-600 font-bold">{ts.Absent}</td>
                                                                <td className="px-6 py-4 text-right font-black text-slate-900">{rate}%</td>
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
