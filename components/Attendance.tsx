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
                fetchMarkingData();
            }
        }
    }, [currentUser, selectedDate, selectedClass]);

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

    return (

        <div className="p-4 md:p-8 space-y-4 md:space-y-6 h-full flex flex-col pb-20 md:pb-0 overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">Mark Attendance</h1>
                    <p className="text-slate-500 text-xs md:text-sm">
                        {selectedClass ? `Marking for Class: ${selectedClass}` : 'Select a class to mark'}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-start md:items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    {/* Only show selector if teacher has NO assigned class */}
                    {!currentUser?.assignedClass && (
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value)}
                            className="w-full sm:w-auto p-2 border-b sm:border-b-0 sm:border-r border-slate-200 outline-none bg-transparent font-medium text-slate-700 text-sm"
                        >
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                    <div className="flex items-center gap-2 px-2 w-full sm:w-auto">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="w-full sm:w-auto outline-none bg-transparent font-medium text-slate-700 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Teacher Stats (Compact Mobile) */}
            {/* Teacher Stats (Ultra Compact Mobile) */}
            <div className="flex flex-row items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col items-center justify-center w-1/3 border-r border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Present</span>
                    <span className="text-sm font-bold text-green-600">{Object.values(attendanceMap).filter(s => s === 'Present').length}</span>
                </div>
                <div className="flex flex-col items-center justify-center w-1/3 border-r border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Absent</span>
                    <span className="text-sm font-bold text-red-600">{Object.values(attendanceMap).filter(s => s === 'Absent').length}</span>
                </div>
                <div className="flex flex-col items-center justify-center w-1/3">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Total</span>
                    <span className="text-sm font-bold text-slate-800">{students.length}</span>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                    />
                </div>
                <div className="flex flex-row gap-2 w-full sm:w-auto">
                    <button onClick={() => markAll('Present')} className="flex-1 sm:flex-none px-3 py-2 bg-green-50 text-green-700 font-medium rounded-lg hover:bg-green-100 transition-colors text-xs md:text-sm whitespace-nowrap">
                        Mark All Present
                    </button>
                    <button
                        onClick={saveAttendance}
                        disabled={saving}
                        className="flex-1 sm:flex-none px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 text-xs md:text-sm whitespace-nowrap"
                    >
                        <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* List / Cards */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-0 md:p-0">

                    {/* Mobile Grid View */}
                    <div className="md:hidden grid grid-cols-2 gap-2 p-2">
                        {loadingMarking ? (
                            <Loading type="skeleton" fullScreen={false} />
                        ) : filteredStudents.length > 0 ? (
                            filteredStudents.map(student => {
                                const status = attendanceMap[student.id];
                                return (
                                    <div key={student.id} className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-[10px] border border-slate-200">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 text-xs truncate">{student.name}</p>
                                                <p className="text-[9px] text-slate-500 truncate">{student.id.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            <button
                                                onClick={() => handleStatusChange(student.id, 'Present')}
                                                className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all text-[10px] font-medium ${status === 'Present' ? 'bg-green-600 text-white border-green-600' : 'bg-slate-50 text-slate-500 border-slate-100'
                                                    }`}
                                            >
                                                <CheckCircle className="h-3 w-3 mb-0.5" /> Pres
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(student.id, 'Absent')}
                                                className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all text-[10px] font-medium ${status === 'Absent' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 text-slate-500 border-slate-100'
                                                    }`}
                                            >
                                                <XCircle className="h-3 w-3 mb-0.5" /> Abs
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(student.id, 'Late')}
                                                className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all text-[10px] font-medium ${status === 'Late' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-slate-50 text-slate-500 border-slate-100'
                                                    }`}
                                            >
                                                <Clock className="h-3 w-3 mb-0.5" /> Late
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-slate-500 p-8 text-sm">No students found.</div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <table className="w-full text-left border-collapse hidden md:table">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Mark Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingMarking ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12">
                                        <Loading type="skeleton" fullScreen={false} />
                                    </td>
                                </tr>
                            ) : filteredStudents.length > 0 ? (
                                filteredStudents.map(student => {
                                    const status = attendanceMap[student.id];
                                    return (
                                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{student.name}</p>
                                                        <p className="text-xs text-slate-500">{student.id.substring(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleStatusChange(student.id, 'Present')} className={`flex items-center gap-1 px-4 py-2 rounded-lg border transition-all ${status === 'Present' ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-105' : 'bg-white text-slate-500 hover:bg-green-50'}`}><CheckCircle className="h-4 w-4" /> Present</button>
                                                    <button onClick={() => handleStatusChange(student.id, 'Absent')} className={`flex items-center gap-1 px-4 py-2 rounded-lg border transition-all ${status === 'Absent' ? 'bg-red-600 text-white border-red-600 shadow-md transform scale-105' : 'bg-white text-slate-500 hover:bg-red-50'}`}><XCircle className="h-4 w-4" /> Absent</button>
                                                    <button onClick={() => handleStatusChange(student.id, 'Late')} className={`flex items-center gap-1 px-4 py-2 rounded-lg border transition-all ${status === 'Late' ? 'bg-yellow-500 text-white border-yellow-500 shadow-md transform scale-105' : 'bg-white text-slate-500 hover:bg-yellow-50'}`}><Clock className="h-4 w-4" /> Late</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={2} className="p-8 text-center text-slate-500 font-medium">No students found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Verification Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
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
};

export default Attendance;
