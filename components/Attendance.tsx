import React, { useState, useEffect } from 'react';
import {
    Calendar, CheckCircle, XCircle, Clock, Save,
    Search, Users, ChevronLeft, ChevronRight,
    BarChart2, PieChart as PieIcon,
    ArrowLeft, UserCheck, AlertCircle, FileText, UserX
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
interface Student {
    id: string;
    name: string;
    class: string;
    photo?: string;
}

interface AttendanceProps {
    currentUser?: {
        id: string;
        school_id: string;
        role: 'admin' | 'teacher';
        assignedClass?: string | null;
    };
    theme?: any;
}

// --- Fetch Functions ---

const fetchClasses = async (schoolId: string) => {
    const { data } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
    return data ? data.map(c => c.name) : [];
};

const fetchSchoolConfig = async (schoolId: string) => {
    const { data } = await supabase.from('schools').select('current_term, academic_year').eq('id', schoolId).single();
    return data;
};

const fetchAdminStats = async (schoolId: string, date: string) => {
    // 1. Overall Daily Stats
    const { data: allAttendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('school_id', schoolId)
        .eq('date', date);

    const present = allAttendance?.filter(a => a.status === 'Present').length || 0;
    const absent = allAttendance?.filter(a => a.status === 'Absent').length || 0;
    const late = allAttendance?.filter(a => a.status === 'Late').length || 0;

    const dailyStats = [
        { name: 'Present', value: present, color: '#16a34a' },
        { name: 'Absent', value: absent, color: '#dc2626' },
        { name: 'Late', value: late, color: '#ca8a04' }
    ];

    // 2. Class-wise Breakdown
    const { data: classAttendance } = await supabase
        .from('attendance')
        .select('class, status')
        .eq('school_id', schoolId)
        .eq('date', date);

    const classMap: Record<string, any> = {};
    classAttendance?.forEach((r: any) => {
        if (!classMap[r.class]) classMap[r.class] = { name: r.class, Present: 0, Absent: 0, Late: 0 };
        classMap[r.class][r.status]++;
    });

    const classStats = Object.values(classMap);
    return { dailyStats, classStats };
};

const fetchStudents = async (schoolId: string, className: string) => {
    const { data } = await supabase
        .from('students')
        .select('id, name, class')
        .eq('school_id', schoolId)
        .eq('class', className)
        .order('name');
    return data || [];
};

const fetchAttendance = async (schoolId: string, className: string, date: string) => {
    const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('class', className)
        .eq('date', date);

    const map: Record<string, 'Present' | 'Absent' | 'Late'> = {};
    if (data) {
        data.forEach((r: any) => map[r.student_id] = r.status);
    }
    return map;
};

const fetchMonthlyAttendance = async (schoolId: string, className: string, monthStr: string) => {
    // 1. Get Dates Range
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = `${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${monthStr}-${lastDay}`;

    // 2. Get Attendance
    const { data: attendanceData } = await supabase
        .from('attendance')
        .select('student_id, date, status')
        .eq('school_id', schoolId)
        .eq('class', className)
        .gte('date', startDate)
        .lte('date', endDate);

    // 3. Transform to Map: student_id -> day_number -> status
    const map: Record<string, Record<number, string>> = {};
    attendanceData?.forEach((r: any) => {
        if (!map[r.student_id]) map[r.student_id] = {};
        const day = parseInt(r.date.split('-')[2]);
        map[r.student_id][day] = r.status;
    });
    return map;
};

const fetchViewResults = async (schoolId: string, className: string, date: string) => {
    if (!className) return [];

    // Get students of that class
    const { data: studentsData } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('class', className)
        .order('name');

    // Get attendance
    const { data: attendanceData } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('class', className)
        .eq('date', date);

    const statusMap: Record<string, string> = {};
    attendanceData?.forEach((r: any) => statusMap[r.student_id] = r.status);

    return studentsData?.map((s: any) => ({
        id: s.id,
        name: s.name,
        status: statusMap[s.id] || 'Not Marked'
    })) || [];
};


const Attendance: React.FC<AttendanceProps> = ({ currentUser, theme }) => {
    const queryClient = useQueryClient();
    const schoolId = currentUser?.school_id;

    // Default theme fallback if not provided
    const activeTheme = theme || {
        bg: 'bg-slate-800',
        text: 'text-slate-800',
        bgLight: 'bg-slate-100',
        custom: null
    };

    // --- Shared State ---
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // --- Teacher State ---
    const [selectedClass, setSelectedClass] = useState(currentUser?.assignedClass || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [attendanceMap, setAttendanceMap] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});

    // --- Monthly View State ---
    const [viewMode, setViewMode] = useState<'mark' | 'monthly'>('mark');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // --- Verification View State ---
    const [viewClass, setViewClass] = useState<string>('');
    const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);


    // --- Queries ---

    // 1. Classes List
    const { data: classes = [] } = useQuery({
        queryKey: ['classNames', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId
    });

    const { data: schoolConfig } = useQuery({
        queryKey: ['schoolTermConfig', schoolId],
        queryFn: () => fetchSchoolConfig(schoolId!),
        enabled: !!schoolId
    });

    // 2. Admin Stats
    const { data: adminStats, isLoading: statsLoading } = useQuery({
        queryKey: ['adminAttendanceStats', schoolId, selectedDate],
        queryFn: () => fetchAdminStats(schoolId!, selectedDate),
        enabled: !!schoolId && currentUser?.role === 'admin'
    });
    const dailyStats = adminStats?.dailyStats || [];
    const classStats = adminStats?.classStats || [];

    // 3. Students List (for currently selected class)
    const { data: students = [], isLoading: studentsLoading } = useQuery({
        queryKey: ['students', schoolId, selectedClass],
        queryFn: () => fetchStudents(schoolId!, selectedClass),
        enabled: !!schoolId && !!selectedClass
    });

    // 4. Marking Data (Existing attendance for selected class/date)
    const { data: fetchedAttendanceMap } = useQuery({
        queryKey: ['attendanceMarking', schoolId, selectedClass, selectedDate],
        queryFn: () => fetchAttendance(schoolId!, selectedClass, selectedDate),
        enabled: !!schoolId && !!selectedClass && viewMode === 'mark'
    });

    // 5. Monthly Data
    const { data: monthlyData = {}, isLoading: monthlyLoading } = useQuery({
        queryKey: ['attendanceMonthly', schoolId, selectedClass, selectedMonth],
        queryFn: () => fetchMonthlyAttendance(schoolId!, selectedClass, selectedMonth),
        enabled: !!schoolId && !!selectedClass && viewMode === 'monthly'
    });

    // 6. View Results (Verification)
    const { data: viewResults = [], isLoading: viewLoading } = useQuery({
        queryKey: ['attendanceVerification', schoolId, viewClass, viewDate],
        queryFn: () => fetchViewResults(schoolId!, viewClass, viewDate),
        enabled: !!schoolId && !!viewClass && !!viewDate
    });

    const { data: teacherClasses = [] } = useQuery({
        queryKey: ['teacherAttendanceClasses', currentUser?.id],
        queryFn: async () => {
            if (!currentUser?.id) return [];

            const { data: assignments } = await supabase
                .from('teacher_assignments')
                .select('classes(name)')
                .eq('teacher_id', currentUser.id);

            const assigned = assignments?.map((a: any) => a.classes?.name).filter(Boolean) || [];
            if (currentUser.assignedClass && !assigned.includes(currentUser.assignedClass)) {
                assigned.push(currentUser.assignedClass);
            }
            return assigned;
        },
        enabled: !!currentUser?.id && currentUser?.role === 'teacher'
    });


    // --- Side Effects ---
    // Update local attendanceMap when fetched data changes OR when students change (to reset)
    useEffect(() => {
        if (fetchedAttendanceMap) {
            setAttendanceMap(fetchedAttendanceMap);
        } else {
            setAttendanceMap({});
        }
    }, [fetchedAttendanceMap, selectedClass, selectedDate]);

    // Initial class selection
    useEffect(() => {
        if (!selectedClass) {
            if (currentUser?.assignedClass) {
                setSelectedClass(currentUser.assignedClass);
            } else if (currentUser?.role === 'teacher' && teacherClasses.length > 0) {
                setSelectedClass(teacherClasses[0]);
            } else if (currentUser?.role === 'admin' && classes.length > 0) {
                setSelectedClass(classes[0]);
            }
        }
    }, [classes, teacherClasses, currentUser, selectedClass]);

    useEffect(() => {
        if (!viewClass && classes.length > 0) {
            setViewClass(classes[0]);
        }
    }, [classes, viewClass]);


    // --- Mutations ---
    const saveAttendanceMutation = useMutation({
        mutationFn: async (currentMap: Record<string, string>) => {
            const upsertData = Object.entries(currentMap).map(([studentId, status]) => ({
                school_id: schoolId,
                student_id: studentId,
                date: selectedDate,
                class: selectedClass,
                status: status,
                term: schoolConfig?.current_term,
                academic_year: schoolConfig?.academic_year
            }));
            if (upsertData.length === 0) return;

            const { error } = await supabase
                .from('attendance')
                .upsert(upsertData, { onConflict: 'student_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            alert('Attendance saved successfully!');
            queryClient.invalidateQueries({ queryKey: ['adminAttendanceStats', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['attendanceMonthly', schoolId] });
        },
        onError: (error: any) => {
            alert('Failed to save attendance.');
        }
    });


    // --- Handlers ---
    const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
        setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status: 'Present' | 'Absent') => {
        const newMap = { ...attendanceMap };
        students.forEach((s: any) => newMap[s.id] = status);
        setAttendanceMap(newMap);
    };

    const saveAttendance = () => {
        saveAttendanceMutation.mutate(attendanceMap);
    };

    // --- Helpers ---
    const getDaysInMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    };

    const filteredStudents = students
        .filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

    const totalMarked = dailyStats.reduce((sum: number, item: any) => sum + item.value, 0);

    // --- RENDER: ADMIN VIEW ---
    if (currentUser?.role === 'admin') {
        return (
            <div className="p-4 md:p-8 space-y-6 h-full overflow-y-auto pb-20 md:pb-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Attendance Overview</h1>
                        <p className="text-slate-500 text-sm">Attendance statistics for {new Date(selectedDate).toDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-transparent outline-none font-medium text-slate-700"
                        />
                    </div>
                </div>

                {statsLoading ? (
                    <Loading type="skeleton" fullScreen={false} />
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                            <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                                <div className={`p-2 md:p-3 rounded-full ${activeTheme.bgLight} ${activeTheme.text}`} style={activeTheme.custom ? { backgroundColor: activeTheme.custom.bgLight, color: activeTheme.custom.text } : {}}>
                                    <Users className="h-5 w-5 md:h-6 md:w-6" />
                                </div>
                                <div><p className="text-[10px] md:text-sm font-medium text-slate-500">Total Marked</p><h3 className="text-lg md:text-2xl font-bold text-slate-800">{totalMarked}</h3></div>
                            </div>
                            {dailyStats.map((stat: any) => (
                                <div key={stat.name} className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                                    <div className="p-2 md:p-3 rounded-full" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                                        {stat.name === 'Present' ? <CheckCircle className="h-5 w-5 md:h-6 md:w-6" /> : stat.name === 'Absent' ? <XCircle className="h-5 w-5 md:h-6 md:w-6" /> : <Clock className="h-5 w-5 md:h-6 md:w-6" />}
                                    </div>
                                    <div><p className="text-[10px] md:text-sm font-medium text-slate-500">{stat.name}</p><h3 className="text-lg md:text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</h3></div>
                                </div>
                            ))}
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Verification Section */}
                            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Search className="h-5 w-5 text-slate-400" /> Verify Class Attendance</h3>
                                <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
                                    <select
                                        value={viewClass}
                                        onChange={e => setViewClass(e.target.value)}
                                        className="p-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50"
                                    >
                                        <option value="">Select Class to View</option>
                                        {classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input
                                        type="date"
                                        value={viewDate}
                                        onChange={e => setViewDate(e.target.value)}
                                        className="p-2.5 text-sm border border-slate-200 rounded-xl outline-none bg-slate-50"
                                    />
                                </div>

                                {viewClass && (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-medium sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3">Student</th>
                                                    <th className="px-4 py-3 text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {viewLoading ? (
                                                    <tr><td colSpan={2} className="p-8 text-center"><Loading type="spinner" fullScreen={false} message="" /></td></tr>
                                                ) : viewResults.length > 0 ? (
                                                    viewResults.map((r: any) => (
                                                        <tr key={r.id}>
                                                            <td className="px-4 py-3 font-medium text-slate-700">{r.name}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`px-2.5 py-1 rounded inline-block text-xs font-bold ${r.status === 'Present' ? 'bg-green-100 text-green-700' :
                                                                    r.status === 'Absent' ? 'bg-red-100 text-red-700' :
                                                                        r.status === 'Late' ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan={2} className="p-8 text-center text-slate-400">No records found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Overall Pie Chart */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><PieIcon className="h-5 w-5 text-slate-400" /> Overall Distribution</h3>
                                <div className="h-64 flex justify-center items-center relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={dailyStats}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {dailyStats.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-3xl font-bold text-slate-800">{currentTotalMarked(dailyStats) > 0 ? (
                                            (dailyStats.find((s: any) => s.name === 'Present')?.value || 0) / (totalMarked || 1) * 100
                                        ).toFixed(0) : 0}%</span>
                                        <span className="text-xs text-slate-400 uppercase">Present</span>
                                    </div>
                                </div>
                                <div className="space-y-3 mt-4">
                                    {dailyStats.map((stat: any) => (
                                        <div key={stat.name} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div>
                                                <span className="text-slate-600">{stat.name}</span>
                                            </div>
                                            <span className="font-bold text-slate-700">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-6 mb-20 mx-4 md:mx-0">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart2 className="h-5 w-5 text-slate-400" /> Class Performance</h3>
                    <div className="h-80 bg-white p-4 rounded-xl border border-slate-200">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={classStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Legend />
                                <Bar dataKey="Present" fill="#16a34a" radius={[4, 4, 0, 0]} stackId="a" />
                                <Bar dataKey="Late" fill="#ca8a04" radius={[4, 4, 0, 0]} stackId="a" />
                                <Bar dataKey="Absent" fill="#dc2626" radius={[4, 4, 0, 0]} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: TEACHER VIEW (Marking) ---
    const presentCount = Object.values(attendanceMap).filter(s => s === 'Present').length;
    const absentCount = Object.values(attendanceMap).filter(s => s === 'Absent').length;
    const lateCount = Object.values(attendanceMap).filter(s => s === 'Late').length;

    return (
        <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] w-full flex flex-col bg-slate-50 md:bg-white md:rounded-3xl md:border border-slate-200 md:shadow-sm relative overflow-hidden group">
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 py-4 md:px-6 z-20 shrink-0">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div>
                            <h1
                                className={`text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${activeTheme.custom ? '' : 'from-slate-800 to-slate-600'}`}
                                style={activeTheme.custom ? { backgroundImage: `linear-gradient(to right, ${activeTheme.custom.text}, ${activeTheme.custom.textDark})`, color: 'transparent', WebkitBackgroundClip: 'text' } : {}}
                            >
                                Class Attendance
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={() => setViewMode('mark')}
                                    className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold transition-all ${viewMode === 'mark' ? `${activeTheme.bg} text-white shadow-md` : 'text-slate-500 hover:bg-slate-100'}`}
                                    style={viewMode === 'mark' && activeTheme.custom ? { backgroundColor: activeTheme.custom.bg } : {}}
                                >
                                    Daily Marking
                                </button>
                                <button
                                    onClick={() => setViewMode('monthly')}
                                    className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold transition-all ${viewMode === 'monthly' ? `${activeTheme.bg} text-white shadow-md` : 'text-slate-500 hover:bg-slate-100'}`}
                                    style={viewMode === 'monthly' && activeTheme.custom ? { backgroundColor: activeTheme.custom.bg } : {}}
                                >
                                    Monthly Register
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            {(currentUser?.role === 'admin' || (currentUser?.role === 'teacher' && teacherClasses.length > 0)) && (
                                <div className="relative group flex-1 sm:w-48 lg:w-auto">
                                    <select
                                        value={selectedClass}
                                        onChange={e => setSelectedClass(e.target.value)}
                                        className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 pr-8 font-bold transition-all hover:bg-slate-200 cursor-pointer"
                                    >
                                        <option value="">Select Class</option>
                                        {currentUser?.role === 'teacher' ? (
                                            teacherClasses.map((c: string) => <option key={c} value={c}>{c}</option>)
                                        ) : (
                                            classes.map((c: string) => <option key={c} value={c}>{c}</option>)
                                        )}
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none">
                                        <ChevronRight className="h-4 w-4 text-slate-400 rotate-90" />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 border border-slate-200 flex-1 sm:w-44 lg:w-auto">
                                <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                                {viewMode === 'mark' ? (
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 p-0 w-full"
                                    />
                                ) : (
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 p-0 w-full"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {viewMode === 'mark' && (
                        <div className="mt-4 grid grid-cols-4 gap-2 lg:w-1/3">
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 md:p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                                <span className="block text-sm md:text-lg font-black text-slate-700">{students.length}</span>
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded-lg p-1.5 md:p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[8px] md:text-[10px] font-bold text-green-600 uppercase tracking-wider">Pres</span>
                                <span className="block text-sm md:text-lg font-black text-green-700">{presentCount}</span>
                            </div>
                            <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 md:p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[8px] md:text-[10px] font-bold text-red-600 uppercase tracking-wider">Abs</span>
                                <span className="block text-sm md:text-lg font-black text-red-700">{absentCount}</span>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-1.5 md:p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[8px] md:text-[10px] font-bold text-yellow-600 uppercase tracking-wider">Late</span>
                                <span className="block text-sm md:text-lg font-black text-yellow-700">{lateCount}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className={`flex-1 ${viewMode === 'monthly' ? 'overflow-hidden flex flex-col pb-6' : 'overflow-y-auto pb-32 md:pb-6'} px-4 md:px-6 py-6`}>
                <div className={`${viewMode === 'monthly' ? 'h-full flex flex-col' : 'max-w-7xl mx-auto space-y-6'}`}>
                    {viewMode === 'mark' ? (
                        <>
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Find student..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => markAll('Present')}
                                    className="w-full sm:w-auto px-4 py-2 bg-emerald-50 text-emerald-600 text-sm font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="h-4 w-4" /> Mark All Present
                                </button>
                            </div>

                            {studentsLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-slate-200 animate-pulse rounded-2xl"></div>)}
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Users className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900">No students found</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm">Try different filters or select a class.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredStudents.map((student: any, idx: number) => {
                                                    const status = attendanceMap[student.id];
                                                    return (
                                                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-slate-400 text-xs w-4">{idx + 1}.</span>
                                                                    <div>
                                                                        <p className="font-bold text-slate-700 text-sm">{student.name}</p>
                                                                        <p className="text-xs text-slate-400 font-mono">{student.id.substring(0, 6)}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {['Present', 'Late', 'Absent'].map(s => (
                                                                        <button
                                                                            key={s}
                                                                            onClick={() => handleStatusChange(student.id, s as any)}
                                                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${status === s
                                                                                ? s === 'Present' ? 'bg-green-100 text-green-700 border-green-200 ring-2 ring-green-500/20'
                                                                                    : s === 'Late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 ring-2 ring-yellow-500/20'
                                                                                        : 'bg-red-100 text-red-700 border-red-200 ring-2 ring-red-500/20'
                                                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                                                }`}
                                                                        >
                                                                            {s}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="md:hidden space-y-4">
                                        {filteredStudents.map((student: any, idx: number) => {
                                            const status = attendanceMap[student.id];
                                            return (
                                                <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold text-slate-300">{idx + 1}</span>
                                                            <div>
                                                                <p className="font-bold text-slate-800">{student.name}</p>
                                                                <p className="text-[10px] text-slate-400 font-mono">{student.id.substring(0, 6)}</p>
                                                            </div>
                                                        </div>
                                                        {status && (
                                                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${status === 'Present' ? 'bg-green-100 text-green-700' : status === 'Late' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                                {status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {['Present', 'Late', 'Absent'].map(s => (
                                                            <button
                                                                key={s}
                                                                onClick={() => handleStatusChange(student.id, s as any)}
                                                                className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${status === s
                                                                    ? s === 'Present' ? 'bg-green-600 text-white border-green-700'
                                                                        : s === 'Late' ? 'bg-yellow-500 text-white border-yellow-600'
                                                                            : 'bg-red-600 text-white border-red-700'
                                                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                    }`}
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full w-full">
                            {monthlyLoading ? (
                                <div className="p-12 flex justify-center"><Loading type="spinner" fullScreen={false} message="Loading monthly register..." /></div>
                            ) : (
                                <div className="overflow-auto custom-scrollbar flex-1 relative w-full">
                                    <table className="border-collapse w-full">
                                        <thead>
                                            <tr>
                                                <th className="sticky left-0 top-0 z-40 bg-white border-b border-r border-slate-200 p-3 min-w-[200px] text-left text-xs font-bold text-slate-600 uppercase tracking-wider shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                                    Student
                                                </th>
                                                {Array.from({ length: getDaysInMonth() }).map((_, i) => (
                                                    <th key={i} className="sticky top-0 z-30 bg-white min-w-[40px] border-b border-slate-200 p-2 text-center text-xs font-medium text-slate-400">
                                                        {i + 1}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((student: any, idx: number) => (
                                                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 p-3 text-sm font-bold text-slate-700 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-400 font-normal w-5">{idx + 1}.</span>
                                                            {student.name}
                                                        </div>
                                                    </td>
                                                    {Array.from({ length: getDaysInMonth() }).map((_, i) => {
                                                        const dayStatus = monthlyData[student.id]?.[i + 1];
                                                        return (
                                                            <td key={i} className="border-b border-slate-100 p-2 text-center">
                                                                {dayStatus ? (
                                                                    <div className="flex justify-center group/tooltip relative">
                                                                        <div className={`w-3 h-3 rounded-full ${dayStatus === 'Present' ? 'bg-green-500' :
                                                                            dayStatus === 'Absent' ? 'bg-red-500' : 'bg-yellow-500'
                                                                            }`}></div>
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-30">
                                                                            {dayStatus}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-200 text-xs">•</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <div className="border-t border-slate-100 p-3 bg-slate-50 text-xs text-slate-400 flex items-center justify-end gap-4">
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Present</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Absent</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Late</div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'mark' && currentUser?.role !== 'teacher' && (
                        <div className="pt-8 border-t border-slate-200/50">
                            <button
                                onClick={() => {
                                    const el = document.getElementById('verify-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all text-left group"
                            >
                                <span className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                                    <Search className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                    Verify Past Attendance Records
                                </span>
                                <ChevronRight className="h-4 w-4 text-slate-400 transform transition-transform group-hover:rotate-90" />
                            </button>

                            <div id="verify-section" className="hidden mt-4 bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-xl animate-in fade-in slide-in-from-top-4">
                                <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase">Verification Mode</h3>
                                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                    <select
                                        value={viewClass}
                                        onChange={e => setViewClass(e.target.value)}
                                        className="w-full p-3 text-sm border border-slate-200 rounded-xl bg-slate-50"
                                    >
                                        <option value="">Select Class</option>
                                        {classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input
                                        type="date"
                                        value={viewDate}
                                        onChange={e => setViewDate(e.target.value)}
                                        className="p-3 text-sm border border-slate-200 rounded-xl bg-slate-50"
                                    />
                                </div>

                                {viewClass && (
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-bold sticky top-0">
                                                <tr>
                                                    <th className="px-6 py-4">Student</th>
                                                    <th className="px-6 py-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {viewLoading ? (
                                                    <tr><td colSpan={2} className="p-8 text-center"><Loading type="spinner" fullScreen={false} /></td></tr>
                                                ) : viewResults.length > 0 ? (
                                                    viewResults.map((r: any) => (
                                                        <tr key={r.id}>
                                                            <td className="px-6 py-4 font-bold text-slate-700">{r.name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${r.status === 'Present' ? 'bg-green-100 text-green-700' : r.status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan={2} className="p-8 text-center text-slate-400">No records found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'mark' && (
                <div className="shrink-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 p-4 z-30 shadow-lg">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            {Object.keys(attendanceMap).length > 0 ? `${Object.keys(attendanceMap).length} students marked` : 'Ready to mark'}
                        </div>
                        <button
                            onClick={saveAttendance}
                            disabled={saveAttendanceMutation.isPending}
                            className="w-full md:w-auto md:ml-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl disabled:opacity-70 flex items-center justify-center gap-2.5"
                        >
                            {saveAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

function currentTotalMarked(dailyStats: any[]) {
    return dailyStats.reduce((sum: number, item: any) => sum + item.value, 0);
}

export default Attendance;
