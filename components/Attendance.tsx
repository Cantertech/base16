import React, { useState, useEffect } from 'react';
import {
    Calendar, CheckCircle, XCircle, Clock, Save,
    Search, Filter, Users, ChevronLeft, ChevronRight,
    BarChart2, PieChart as PieIcon, TrendingUp
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

interface Student {
    id: string;
    name: string;
    class: string;
    photo?: string;
}

interface AttendanceRecord {
    student_id: string;
    status: 'Present' | 'Absent' | 'Late';
}

interface AttendanceProps {
    currentUser?: {
        school_id: string;
        role: 'admin' | 'teacher';
        assignedClass?: string | null;
    };
}

const Attendance: React.FC<AttendanceProps> = ({ currentUser }) => {
    // --- Shared State ---
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // --- Admin State (Stats) ---
    const [dailyStats, setDailyStats] = useState<any[]>([]);
    const [classStats, setClassStats] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);

    // --- Teacher State (Marking) ---
    const [selectedClass, setSelectedClass] = useState(currentUser?.assignedClass || '');
    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});
    const [loadingMarking, setLoadingMarking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [classes, setClasses] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // --- View/Verify Section State (Bottom) ---
    const [viewClass, setViewClass] = useState<string>(''); // Default empty to force selection
    const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
    const [viewResults, setViewResults] = useState<{ name: string, status: string, id: string }[]>([]);
    const [viewLoading, setViewLoading] = useState(false);

    // --- Monthly View State ---
    const [viewMode, setViewMode] = useState<'mark' | 'monthly'>('mark');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [monthlyData, setMonthlyData] = useState<Record<string, Record<number, string>>>({});
    const [loadingMonthly, setLoadingMonthly] = useState(false);

    useEffect(() => {
        console.log("Attendance Effect Triggered:", {
            role: currentUser?.role,
            assigned: currentUser?.assignedClass,
            selectedClass,
            schoolId: currentUser?.school_id
        });

        if (currentUser?.role === 'admin') {
            fetchClasses(); // Ensure Admin (and Teacher) fetches classes
            fetchAdminStats();
        } else {
            // Teacher Mode
            fetchClasses(); // Always fetch lists for the bottom dropdown

            if (currentUser?.assignedClass && selectedClass !== currentUser.assignedClass) {
                setSelectedClass(currentUser.assignedClass);
            }

            if (selectedClass) {
                if (viewMode === 'mark') {
                    fetchMarkingData();
                } else {
                    fetchMonthlyAttendance();
                }
            }
        }
    }, [currentUser, selectedDate, selectedClass, viewMode, selectedMonth]);

    // --- ADMIN LOGIC ---
    const fetchAdminStats = async () => {
        if (!currentUser?.school_id) return;
        setLoadingStats(true);
        try {
            // 1. Overall Daily Stats (Pie Chart Data)
            const { data: allAttendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('school_id', currentUser.school_id)
                .eq('date', selectedDate);

            const present = allAttendance?.filter(a => a.status === 'Present').length || 0;
            const absent = allAttendance?.filter(a => a.status === 'Absent').length || 0;
            const late = allAttendance?.filter(a => a.status === 'Late').length || 0;

            setDailyStats([
                { name: 'Present', value: present, color: '#16a34a' },
                { name: 'Absent', value: absent, color: '#dc2626' },
                { name: 'Late', value: late, color: '#ca8a04' }
            ]);

            // 2. Class-wise Breakdown (Bar Chart Data)
            const { data: classAttendance } = await supabase
                .from('attendance')
                .select('class, status')
                .eq('school_id', currentUser.school_id)
                .eq('date', selectedDate);

            const classMap: Record<string, any> = {};
            classAttendance?.forEach((r: any) => {
                if (!classMap[r.class]) classMap[r.class] = { name: r.class, Present: 0, Absent: 0, Late: 0 };
                classMap[r.class][r.status]++;
            });

            setClassStats(Object.values(classMap));

        } catch (error) {
            console.error('Error fetching admin stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    // --- TEACHER LOGIC ---
    const fetchClasses = async () => {
        if (!currentUser?.school_id) return;
        const { data } = await supabase.from('classes').select('name').eq('school_id', currentUser.school_id).order('name');
        if (data) {
            setClasses(data.map(c => c.name));
            if (!selectedClass && data.length > 0) setSelectedClass(data[0].name);
        }
    };

    const fetchMarkingData = async () => {
        if (!currentUser?.school_id || !selectedClass) return;
        setLoadingMarking(true);
        try {
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, name, class')
                .eq('school_id', currentUser.school_id)
                .eq('class', selectedClass)
                .order('name');

            if (studentsData) setStudents(studentsData);

            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('student_id, status')
                .eq('school_id', currentUser.school_id)
                .eq('class', selectedClass)
                .eq('date', selectedDate);

            const newMap: Record<string, 'Present' | 'Absent' | 'Late'> = {};
            if (attendanceData) {
                attendanceData.forEach((r: any) => newMap[r.student_id] = r.status);
            }
            setAttendanceMap(newMap);
        } catch (error) {
            console.error('Error fetching marking data:', error);
        } finally {
            setLoadingMarking(false);
        }
    };

    const fetchMonthlyAttendance = async () => {
        if (!currentUser?.school_id || !selectedClass) return;
        setLoadingMonthly(true);
        try {
            // 1. Get Students (Ensure list is up to date)
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, name, class')
                .eq('school_id', currentUser.school_id)
                .eq('class', selectedClass)
                .order('name');

            if (studentsData) setStudents(studentsData);

            // 2. Get Dates Range
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = `${selectedMonth}-01`;
            // Calculate last day of month
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${selectedMonth}-${lastDay}`;

            // 3. Get Attendance
            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('student_id, date, status')
                .eq('school_id', currentUser.school_id)
                .eq('class', selectedClass)
                .gte('date', startDate)
                .lte('date', endDate);

            // 4. Transform to Map: student_id -> day_number -> status
            const map: Record<string, Record<number, string>> = {};
            attendanceData?.forEach((r: any) => {
                if (!map[r.student_id]) map[r.student_id] = {};
                const day = parseInt(r.date.split('-')[2]); // Extract day part
                map[r.student_id][day] = r.status;
            });
            setMonthlyData(map);

        } catch (error) {
            console.error('Error fetching monthly data:', error);
        } finally {
            setLoadingMonthly(false);
        }
    };

    const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
        setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status: 'Present' | 'Absent') => {
        const newMap = { ...attendanceMap };
        students.forEach(s => newMap[s.id] = status);
        setAttendanceMap(newMap);
    };

    const saveAttendance = async () => {
        if (!currentUser?.school_id) return;
        setSaving(true);
        try {
            const upsertData = Object.entries(attendanceMap).map(([studentId, status]) => ({
                school_id: currentUser.school_id,
                student_id: studentId,
                date: selectedDate,
                class: selectedClass,
                status: status
            }));

            if (upsertData.length === 0) return;

            const { error } = await supabase
                .from('attendance')
                .upsert(upsertData, { onConflict: 'student_id,date' });

            if (error) throw error;
            alert('Attendance saved successfully!');
            // Refresh admin stats if needed (though they are separated)
        } catch (error: any) {
            console.error('Error saving attendance:', error);
            alert('Failed to save attendance.');
        } finally {
            setSaving(false);
        }
    };

    const fetchViewResults = async () => {
        if (!currentUser?.school_id || !viewClass) return;
        setViewLoading(true);
        try {
            // Get students of that class
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, name')
                .eq('school_id', currentUser.school_id)
                .eq('class', viewClass)
                .order('name');

            // Get attendance
            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('student_id, status')
                .eq('school_id', currentUser.school_id)
                .eq('class', viewClass)
                .eq('date', viewDate);

            const statusMap: Record<string, string> = {};
            attendanceData?.forEach((r: any) => statusMap[r.student_id] = r.status);

            const results = studentsData?.map((s: any) => ({
                id: s.id,
                name: s.name,
                status: statusMap[s.id] || 'Not Marked'
            })) || [];

            setViewResults(results);
        } catch (e) { console.error(e); }
        finally { setViewLoading(false); }
    };


    // --- RENDER: ADMIN VIEW ---
    if (currentUser?.role === 'admin') {
        const totalMarked = dailyStats.reduce((sum, item) => sum + item.value, 0);

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

                {loadingStats ? (
                    <Loading type="skeleton" fullScreen={false} />
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                            <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                                <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-full"><Users className="h-5 w-5 md:h-6 md:w-6" /></div>
                                <div><p className="text-[10px] md:text-sm font-medium text-slate-500">Total Marked</p><h3 className="text-lg md:text-2xl font-bold text-slate-800">{totalMarked}</h3></div>
                            </div>
                            {dailyStats.map((stat) => (
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
                            {/* Class Breakdown (Bar Chart) */}
                            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart2 className="h-5 w-5 text-slate-400" /> Class Performance</h3>
                                <div className="h-80">
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
                                                {dailyStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Center Text */}
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-3xl font-bold text-slate-800">{attendanceMap && (
                                            (dailyStats.find(s => s.name === 'Present')?.value || 0) / (totalMarked || 1) * 100
                                        ).toFixed(0)}%</span>
                                        <span className="text-xs text-slate-400 uppercase">Present</span>
                                    </div>
                                </div>
                                <div className="space-y-3 mt-4">
                                    {dailyStats.map(stat => (
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

                {/* Bottom Verification Section (Admin) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-6 mb-20 mx-4 md:mx-0">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                        <Search className="h-4 w-4 text-slate-400" /> Verify Attendance Records
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <select
                            value={viewClass}
                            onChange={e => setViewClass(e.target.value)}
                            className="p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                            <option value="">Select Class to View</option>
                            {/* Admin needs to fetch classes? Use 'viewClass' directly if mapped */}
                            {/* Note: classes state is for Teacher view logic, Admin might not have it populated via fetchClasses(). 
                            Admin View relies on 'classStats' maybe? Or we need to fetch all classes for Admin too.
                            For now, let's assume Admin might not see dropdown options if 'classes' is empty. 
                            I'll add a fetchClasses call for Admin in useEffect to be safe.
                        */}
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                            type="date"
                            value={viewDate}
                            onChange={e => setViewDate(e.target.value)}
                            className="p-2 text-sm border border-slate-200 rounded-lg outline-none bg-white"
                        />
                        <button
                            onClick={fetchViewResults}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900"
                        >
                            View Records
                        </button>
                    </div>

                    {viewClass && (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-medium sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Student</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewLoading ? (
                                        <tr><td colSpan={2} className="p-4 text-center"><Loading type="spinner" fullScreen={false} message="" /></td></tr>
                                    ) : viewResults.length > 0 ? (
                                        viewResults.map(r => (
                                            <tr key={r.id}>
                                                <td className="px-4 py-2 font-medium text-slate-700">{r.name}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'Present' ? 'bg-green-100 text-green-700' :
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
                                        <tr><td colSpan={2} className="p-4 text-center text-slate-400">No records found. Click 'View Records'.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- RENDER: TEACHER VIEW (Marking) ---
    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Calculate quick stats for the sticky header
    const presentCount = Object.values(attendanceMap).filter(s => s === 'Present').length;
    const absentCount = Object.values(attendanceMap).filter(s => s === 'Absent').length;
    const lateCount = Object.values(attendanceMap).filter(s => s === 'Late').length;

    // Helper for generating days in month
    const getDaysInMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    };

    return (
        <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] w-full flex flex-col bg-slate-50 md:bg-white md:rounded-3xl md:border border-slate-200 md:shadow-sm relative overflow-hidden group">
            {/* 1. Top Header & Controls */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 py-4 md:px-6 z-20 shrink-0">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                                Class Attendance
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={() => setViewMode('mark')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'mark' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                    Daily Marking
                                </button>
                                <button
                                    onClick={() => setViewMode('monthly')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                    Monthly Register
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {!currentUser?.assignedClass && (
                                <div className="relative group w-full md:w-auto">
                                    <select
                                        value={selectedClass}
                                        onChange={e => setSelectedClass(e.target.value)}
                                        className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 pr-8 font-medium transition-all hover:bg-slate-200 cursor-pointer"
                                    >
                                        <option value="">Select Class</option>
                                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none">
                                        <ChevronRight className="h-4 w-4 text-slate-400 rotate-90" />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 border border-slate-200 w-full md:w-auto">
                                <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                                {viewMode === 'mark' ? (
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 p-0 w-full"
                                    />
                                ) : (
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 p-0 w-full"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Bar (Only for Marking Mode) */}
                    {viewMode === 'mark' && (
                        <div className="mt-4 grid grid-cols-4 gap-2 md:w-1/2 lg:w-1/3">
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                                <span className="block text-lg font-black text-slate-700">{students.length}</span>
                            </div>
                            <div className="bg-green-50/50 border border-green-100 rounded-lg p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[10px] font-bold text-green-600 uppercase tracking-wider">Pres</span>
                                <span className="block text-lg font-black text-green-700">{presentCount}</span>
                            </div>
                            <div className="bg-red-50/50 border border-red-100 rounded-lg p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[10px] font-bold text-red-600 uppercase tracking-wider">Abs</span>
                                <span className="block text-lg font-black text-red-700">{absentCount}</span>
                            </div>
                            <div className="bg-yellow-50/50 border border-yellow-100 rounded-lg p-2 text-center transition-transform hover:scale-105">
                                <span className="block text-[10px] font-bold text-yellow-600 uppercase tracking-wider">Late</span>
                                <span className="block text-lg font-black text-yellow-700">{lateCount}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Scrollable Main Content Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-32">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* --- VIEW MODE: MARKING --- */}
                    {viewMode === 'mark' ? (
                        <>
                            {/* Search & Bulk Actions */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Find student..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium transition-all outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => markAll('Present')}
                                    className="w-full sm:w-auto px-4 py-2 bg-emerald-50 text-emerald-600 text-sm font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="h-4 w-4" /> Mark All Present
                                </button>
                            </div>

                            {/* Students List */}
                            {loadingMarking ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-slate-200 animate-pulse rounded-2xl"></div>)}
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Users className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900">No students found</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm">Try adjusting your search or select a different class from the dropdown above.</p>
                                </div>
                            ) : (
                                // Card Grid Layout (Unified for Mobile/Desktop for simplicity and aesthetics)
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredStudents.map(student => {
                                        const status = attendanceMap[student.id];
                                        return (
                                            <div key={student.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-100 transition-all group duration-300">
                                                <div className="flex justify-between items-start mb-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg shadow-inner">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 text-base leading-tight">{student.name}</h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono border border-slate-200">
                                                                    {student.id.substring(0, 6)}
                                                                </span>
                                                                {status && (
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${status === 'Present' ? 'text-green-600' :
                                                                        status === 'Absent' ? 'text-red-600' : 'text-yellow-600'
                                                                        }`}>
                                                                        • {status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <button
                                                        onClick={() => handleStatusChange(student.id, 'Present')}
                                                        className={`relative overflow-hidden py-2.5 rounded-xl text-xs font-bold transition-all border group/btn ${status === 'Present'
                                                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-transparent shadow-lg shadow-green-500/30 ring-2 ring-green-100'
                                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1 relative z-10">
                                                            <CheckCircle className={`h-4 w-4 ${status === 'Present' ? 'animate-bounce-short' : ''}`} />
                                                            <span>Present</span>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => handleStatusChange(student.id, 'Late')}
                                                        className={`relative overflow-hidden py-2.5 rounded-xl text-xs font-bold transition-all border group/btn ${status === 'Late'
                                                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white border-transparent shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-100'
                                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1 relative z-10">
                                                            <Clock className={`h-4 w-4 ${status === 'Late' ? 'animate-pulse' : ''}`} />
                                                            <span>Late</span>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => handleStatusChange(student.id, 'Absent')}
                                                        className={`relative overflow-hidden py-2.5 rounded-xl text-xs font-bold transition-all border group/btn ${status === 'Absent'
                                                            ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-transparent shadow-lg shadow-red-500/30 ring-2 ring-red-100'
                                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1 relative z-10">
                                                            <XCircle className={`h-4 w-4 ${status === 'Absent' ? 'animate-pulse' : ''}`} />
                                                            <span>Absent</span>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        // --- VIEW MODE: MONTHLY REGISTER ---
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[70vh]">
                            {loadingMonthly ? (
                                <div className="p-12 flex justify-center"><Loading type="spinner" fullScreen={false} message="Loading monthly register..." /></div>
                            ) : (
                                <div className="overflow-auto custom-scrollbar flex-1 relative">
                                    <table className="border-collapse w-full">
                                        <thead>
                                            <tr>
                                                <th className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 p-3 min-w-[200px] text-left text-xs font-bold text-slate-600 uppercase tracking-wider shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                                    Student
                                                </th>
                                                {Array.from({ length: getDaysInMonth() }).map((_, i) => (
                                                    <th key={i} className="min-w-[40px] border-b border-slate-200 p-2 text-center text-xs font-medium text-slate-400">
                                                        {i + 1}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((student, idx) => (
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
                                                                            dayStatus === 'Absent' ? 'bg-red-500' :
                                                                                'bg-yellow-500'
                                                                            }`}></div>
                                                                        {/* Tooltip */}
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
                                            {filteredStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={getDaysInMonth() + 1} className="p-8 text-center text-slate-400 italic">
                                                        No students found for this class.
                                                    </td>
                                                </tr>
                                            )}
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

                    {/* Expandable Verification Section (Hidden in Monthly Mode to focus on table) */}
                    {viewMode === 'mark' && (
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
                                <ChevronRight className="h-4 w-4 text-slate-400 transform transition-transform group-hover:rotate-90 group-active:translate-y-1" />
                            </button>

                            <div id="verify-section" className="hidden mt-4 bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-top-4">
                                <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">Verification Mode</h3>
                                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                    <div className="relative group w-full">
                                        <select
                                            value={viewClass}
                                            onChange={e => setViewClass(e.target.value)}
                                            className="appearance-none w-full p-3 pl-4 pr-10 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium transition-all"
                                        >
                                            <option value="">Select Class</option>
                                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90" />
                                    </div>
                                    <input
                                        type="date"
                                        value={viewDate}
                                        onChange={e => setViewDate(e.target.value)}
                                        className="p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium transition-all"
                                    />
                                    <button
                                        onClick={fetchViewResults}
                                        className="px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-800/20 whitespace-nowrap"
                                    >
                                        View Records
                                    </button>
                                </div>

                                {viewClass && (
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-bold sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-6 py-4">Student</th>
                                                    <th className="px-6 py-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {viewLoading ? (
                                                    <tr><td colSpan={2} className="p-8 text-center"><Loading type="spinner" fullScreen={false} message="" /></td></tr>
                                                ) : viewResults.length > 0 ? (
                                                    viewResults.map((r, idx) => (
                                                        <tr key={r.id} className="hover:bg-white transition-colors">
                                                            <td className="px-6 py-4 font-bold text-slate-700">{r.name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${r.status === 'Present' ? 'bg-green-100 text-green-700' :
                                                                    r.status === 'Absent' ? 'bg-red-100 text-red-700' :
                                                                        r.status === 'Late' ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-slate-200 text-slate-500'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'Present' ? 'bg-green-500' : r.status === 'Absent' ? 'bg-red-500' : r.status === 'Late' ? 'bg-yellow-500' : 'bg-slate-400'}`}></span>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan={2} className="p-8 text-center text-slate-400 italic">No records found. Select a class and date, then click 'View Records'.</td></tr>
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

            {/* 3. Footer - Fixed Save Bar (Only hide in Monthly Mode) */}
            {viewMode === 'mark' && (
                <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 p-4 z-30 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            {Object.keys(attendanceMap).length > 0
                                ? `${Object.keys(attendanceMap).length} students marked`
                                : 'Ready to mark'
                            }
                        </div>
                        <button
                            onClick={saveAttendance}
                            disabled={saving}
                            className="w-full md:w-auto md:ml-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    <span>Save Attendance</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
