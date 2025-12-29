import React, { useState, useEffect } from 'react';
import {
    Calendar, CheckCircle, XCircle, Search, Utensils,
    Filter, ChevronDown, CheckSquare, Plus, DollarSign,
    AlertCircle, Save
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';

interface Student {
    id: string;
    name: string;
    class: string;
    feeding_credit: number;
}

interface FeedingProps {
    currentUser: any;
}

const Feeding: React.FC<FeedingProps> = ({ currentUser }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState('');
    const [classes, setClasses] = useState<string[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [feedingMap, setFeedingMap] = useState<Record<string, boolean>>({});
    const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showOnlyDefaulters, setShowOnlyDefaulters] = useState(false); // "Present but Not Paid"

    // Bulk / Advance Payment
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkStudent, setBulkStudent] = useState<Student | null>(null);
    const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkAmount, setBulkAmount] = useState('0');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, [currentUser]);

    useEffect(() => {
        if (selectedClass) {
            fetchData();
        }
    }, [selectedClass, selectedDate]);

    const fetchClasses = async () => {
        if (!currentUser?.school_id) return;
        const { data } = await supabase.from('classes').select('name').eq('school_id', currentUser.school_id).order('name');
        if (data) {
            setClasses(data.map(c => c.name));
            if (!selectedClass && data.length > 0) setSelectedClass(data[0].name);
        }
    };

    const fetchData = async () => {
        if (!currentUser?.school_id || !selectedClass) return;
        setLoading(true);
        try {
            // 1. Fetch Students
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, name, class')
                .eq('school_id', currentUser.school_id)
                .eq('class', selectedClass)
                .order('name');

            if (studentsData) setStudents(studentsData);

            // 2. Fetch Feeding Logs for Date
            const { data: feedingData } = await supabase
                .from('feeding_logs')
                .select('student_id')
                .eq('school_id', currentUser.school_id)
                .eq('date', selectedDate);

            const fMap: Record<string, boolean> = {};
            feedingData?.forEach((r: any) => fMap[r.student_id] = true);
            setFeedingMap(fMap);

            // 3. Fetch Attendance for Date (to check who is Present)
            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('student_id, status')
                .eq('school_id', currentUser.school_id)
                .eq('date', selectedDate);

            const aMap: Record<string, string> = {};
            attendanceData?.forEach((r: any) => aMap[r.student_id] = r.status);
            setAttendanceMap(aMap);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleFeeding = async (student: Student) => {
        const isPaid = feedingMap[student.id];
        const newStatus = !isPaid;

        // Optimistic UI update
        setFeedingMap(prev => ({ ...prev, [student.id]: newStatus }));

        try {
            if (newStatus) {
                // Mark as Paid
                await supabase.from('feeding_logs').upsert({
                    school_id: currentUser.school_id,
                    student_id: student.id,
                    date: selectedDate,
                    status: 'PAID',
                    amount: 0 // Track default amount?
                });
            } else {
                // Remove Paid status
                await supabase.from('feeding_logs').delete()
                    .eq('student_id', student.id)
                    .eq('date', selectedDate);
            }
        } catch (error) {
            console.error("Error toggling feeding:", error);
            // Revert on error
            setFeedingMap(prev => ({ ...prev, [student.id]: isPaid }));
        }
    };

    const markAllPaid = async () => {
        if (!confirm('Mark all displayed students as PAID for today?')) return;
        setProcessing(true);
        try {
            const updates = students.map(s => ({
                school_id: currentUser.school_id,
                student_id: s.id,
                date: selectedDate,
                status: 'PAID'
            }));

            const { error } = await supabase.from('feeding_logs').upsert(updates, { onConflict: 'student_id,date' });
            if (error) throw error;

            // Update UI
            const newMap = { ...feedingMap };
            students.forEach(s => newMap[s.id] = true);
            setFeedingMap(newMap);
        } catch (e) {
            alert('Error marking all paid');
        } finally {
            setProcessing(false);
        }
    };

    // Bulk / Advance Payment Handler
    const handleBulkPayment = async () => {
        if (!bulkStudent || !bulkStartDate || !bulkEndDate) return;
        setProcessing(true);
        try {
            // Generate dates between start and end
            const dates = [];
            let curr = new Date(bulkStartDate);
            const end = new Date(bulkEndDate);

            while (curr <= end) {
                dates.push(new Date(curr).toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }

            const inserts = dates.map(date => ({
                school_id: currentUser.school_id,
                student_id: bulkStudent.id,
                date: date,
                status: 'PAID',
                amount: 0 // Could store bulkAmount / count
            }));

            const { error } = await supabase.from('feeding_logs').upsert(inserts, { onConflict: 'student_id,date' });
            if (error) throw error;

            alert(`Successfully marked ${dates.length} days as paid for ${bulkStudent.name}`);
            setShowBulkModal(false);
            fetchData(); // Refresh to see changes if range includes today
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    // Filter Logic
    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const isPresent = attendanceMap[s.id] === 'Present';
        const isPaid = feedingMap[s.id];

        if (showOnlyDefaulters) {
            // Came (Present) but Didn't Pay
            return matchesSearch && isPresent && !isPaid;
        }
        return matchesSearch;
    });

    return (
        <div className="p-4 md:p-8 space-y-6 h-full flex flex-col pb-20 md:pb-0 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Utensils className="h-6 w-6 text-orange-500" /> Feeding Management
                    </h1>
                    <p className="text-slate-500 text-sm">Track daily feeding payments and entitlements.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <select
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
                    >
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>
            </div>

            {/* Actions & Stats */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="relative flex-1 mr-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowOnlyDefaulters(!showOnlyDefaulters)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${showOnlyDefaulters
                            ? 'bg-red-100 text-red-700 border border-red-200 shadow-inner'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <AlertCircle className="h-4 w-4" />
                        {showOnlyDefaulters ? 'Showing Defaulters' : 'Show Defaulters'}
                    </button>

                    <button
                        onClick={markAllPaid}
                        disabled={processing}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 shadow-sm flex items-center gap-2"
                    >
                        <CheckSquare className="h-4 w-4" /> Mark All Paid
                    </button>
                </div>
            </div>

            {/* Student List */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[600px] md:min-h-0">
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="p-8"><Loading type="skeleton" fullScreen={false} /></div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500 uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Student</th>
                                    <th className="px-6 py-4 text-center">Paid Feeding?</th>
                                    <th className="px-6 py-4 text-center">Attendance</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map(student => {
                                        const isPaid = feedingMap[student.id];
                                        const attStatus = attendanceMap[student.id] || 'Not Marked';

                                        return (
                                            <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-800">{student.name}</p>
                                                    <p className="text-xs text-slate-500">{student.class}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleFeeding(student)}
                                                        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${isPaid ? 'bg-green-500' : 'bg-slate-200'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`${isPaid ? 'translate-x-9' : 'translate-x-1'
                                                                } inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm`}
                                                        />
                                                        <span className={`absolute text-[10px] font-bold ${isPaid ? 'left-2 text-white' : 'right-2 text-slate-500'}`}>
                                                            {isPaid ? 'YES' : 'NO'}
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${attStatus === 'Present' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        attStatus === 'Absent' ? 'bg-red-50 text-red-700 border-red-100' :
                                                            'bg-slate-100 text-slate-500 border-slate-200'
                                                        }`}>
                                                        {attStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setBulkStudent(student);
                                                            setShowBulkModal(true);
                                                        }}
                                                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center justify-end gap-1 ml-auto"
                                                    >
                                                        <Calendar className="h-3 w-3" /> Pay Advance
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500">
                                            No students found matching filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Advance Payment Modal */}
            {showBulkModal && bulkStudent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Advance Payment</h3>
                        <p className="text-sm text-slate-500 mb-6">Mark feeding as PAID for {bulkStudent.name} for a date range.</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={bulkStartDate}
                                        onChange={e => setBulkStartDate(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={bulkEndDate}
                                        onChange={e => setBulkEndDate(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex gap-2">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>This will mark the student as PAID for every day in the selected range (inclusive).</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowBulkModal(false)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkPayment}
                                    disabled={processing}
                                    className="flex-1 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                                >
                                    {processing ? 'Processing...' : 'Confirm Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Feeding;
