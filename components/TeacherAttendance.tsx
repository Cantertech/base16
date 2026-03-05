import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Search, Calendar, ChevronLeft, ChevronRight, Clock, UserX, UserCheck } from 'lucide-react';
import Loading from './Loading';

interface TeacherAttendanceProps {
    schoolId: string;
    teachers: any[];
}

const TeacherAttendance: React.FC<TeacherAttendanceProps> = ({ schoolId, teachers }) => {
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');

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
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                    <div className="flex gap-4 items-center">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                        />
                        <button
                            onClick={() => markAllMutation.mutate()}
                            disabled={markAllMutation.isPending}
                            className="px-4 py-2 bg-green-50 text-green-700 font-medium rounded-lg hover:bg-green-100 flex items-center gap-2"
                        >
                            <UserCheck className="h-4 w-4" />
                            Mark All Present
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search teachers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-64 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Teacher</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Actions</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={3} className="p-8"><Loading type="spinner" fullScreen={false} /></td></tr>
                            ) : filteredTeachers.length > 0 ? (
                                filteredTeachers.map(teacher => {
                                    const status = attendanceMap[teacher.id];
                                    return (
                                        <tr key={teacher.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{teacher.name}</div>
                                                <div className="text-xs text-slate-500">{teacher.subject}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => toggleAttendance(teacher.id, status, 'Present')}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === 'Present' ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    >Present</button>
                                                    <button
                                                        onClick={() => toggleAttendance(teacher.id, status, 'Late')}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === 'Late' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    >Late</button>
                                                    <button
                                                        onClick={() => toggleAttendance(teacher.id, status, 'Absent')}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === 'Absent' ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    >Absent</button>
                                                    <button
                                                        onClick={() => toggleAttendance(teacher.id, status, 'On Leave')}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === 'On Leave' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    >On Leave</button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {status ? (
                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${status === 'Present' ? 'text-green-600' : status === 'Late' ? 'text-orange-500' : status === 'Absent' ? 'text-red-500' : 'text-blue-600'}`}>
                                                        {status === 'Present' && <CheckCircle className="h-4 w-4" />}
                                                        {status === 'Absent' && <XCircle className="h-4 w-4" />}
                                                        {(status === 'Late' || status === 'On Leave') && <Clock className="h-4 w-4" />}
                                                        {status}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-sm italic">Not Marked</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr><td colSpan={3} className="p-8 text-center text-slate-500">No teachers found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
};

export default TeacherAttendance;
