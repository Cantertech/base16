import React, { useState, useEffect } from 'react';
import {
    Calendar, CheckCircle, XCircle, Search, Utensils,
    Filter, ChevronDown, CheckSquare, Plus, DollarSign,
    AlertCircle, Save, BarChart2, Settings
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Student {
    id: string;
    name: string;
    class: string;
    feeding_credit: number;
}

interface FeedingProps {
    currentUser: any;
}

// --- Fetch Functions ---

const fetchClasses = async (currentUser: any) => {
    const schoolId = currentUser?.school_id;
    if (!schoolId) return [];

    if (currentUser?.role === 'admin') {
        const { data } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
        return data ? data.map(c => c.name) : [];
    }

    if (currentUser?.id) {
        const { data: assignments } = await supabase
            .from('teacher_assignments')
            .select('classes(name)')
            .eq('teacher_id', currentUser.id);

        let assignedClassNames: string[] = [];

        if (assignments && assignments.length > 0) {
            assignedClassNames = assignments.map((a: any) => a.classes?.name).filter(Boolean);
        }

        if (assignedClassNames.length === 0 && currentUser.assignedClass) {
            assignedClassNames = [currentUser.assignedClass];
        }

        return assignedClassNames;
    }
    return [];
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

const fetchFeedingLogs = async (schoolId: string, inputDate: string) => {
    const { data } = await supabase
        .from('feeding_logs')
        .select('student_id')
        .eq('school_id', schoolId)
        .eq('date', inputDate);

    const map: Record<string, boolean> = {};
    data?.forEach((r: any) => map[r.student_id] = true);
    return map;
};

const fetchDailyAttendance = async (schoolId: string, inputDate: string) => {
    const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('date', inputDate);

    const map: Record<string, string> = {};
    data?.forEach((r: any) => map[r.student_id] = r.status);
    return map;
};


const Feeding: React.FC<FeedingProps> = ({ currentUser }) => {
    const queryClient = useQueryClient();
    const schoolId = currentUser?.school_id;

    // Local State (Collection)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showOnlyDefaulters, setShowOnlyDefaulters] = useState(false);

    // Bulk / Advance Payment Modal State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkStudent, setBulkStudent] = useState<Student | null>(null);
    const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Analysis State
    const [viewMode, setViewMode] = useState<'collection' | 'analysis' | 'config'>('collection');
    const [analysisStartDate, setAnalysisStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); // Start of month
    const [analysisEndDate, setAnalysisEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [analysisClass, setAnalysisClass] = useState('');
    const [pricePerMeal, setPricePerMeal] = useState(5); // Default, can be changed by user
    const [analysisSearch, setAnalysisSearch] = useState('');

    // Config State
    const [configFee, setConfigFee] = useState(5);
    const [configTeachers, setConfigTeachers] = useState(false);
    const [configCollectFees, setConfigCollectFees] = useState(false);
    const [configDailyFeeAmount, setConfigDailyFeeAmount] = useState(0);

    // --- Queries ---

    const { data: schoolConfig } = useQuery({
        queryKey: ['schoolSettings', schoolId, 'feeding'],
        queryFn: async () => {
            const { data } = await supabase.from('schools').select('feeding_fee_amount, teachers_can_collect_feeding, collect_daily_fees, daily_fee_amount').eq('id', schoolId).single();
            return data;
        },
        enabled: !!schoolId
    });

    useEffect(() => {
        if (schoolConfig) {
            if (schoolConfig.feeding_fee_amount) {
                setPricePerMeal(Number(schoolConfig.feeding_fee_amount));
                setConfigFee(Number(schoolConfig.feeding_fee_amount));
            }
            setConfigTeachers(schoolConfig.teachers_can_collect_feeding || false);
            setConfigCollectFees(schoolConfig.collect_daily_fees || false);
            setConfigDailyFeeAmount(Number(schoolConfig.daily_fee_amount || 0));
        }
    }, [schoolConfig]);

    const { data: classes = [] } = useQuery({
        queryKey: ['classNames', schoolId, currentUser?.id],
        queryFn: () => fetchClasses(currentUser),
        enabled: !!schoolId
    });

    const { data: students = [], isLoading: studentsLoading } = useQuery({
        queryKey: ['students', schoolId, selectedClass],
        queryFn: () => fetchStudents(schoolId, selectedClass),
        enabled: !!schoolId && !!selectedClass && viewMode === 'collection'
    });

    const { data: feedingMap = {} } = useQuery({
        queryKey: ['feedingLogs', schoolId, selectedDate],
        queryFn: () => fetchFeedingLogs(schoolId, selectedDate),
        enabled: !!schoolId && viewMode === 'collection'
    });

    const { data: attendanceMap = {} } = useQuery({
        queryKey: ['dailyAttendance', schoolId, selectedDate],
        queryFn: () => fetchDailyAttendance(schoolId, selectedDate),
        enabled: !!schoolId && viewMode === 'collection'
    });

    // Analysis Query
    const { data: analysisData = [], isLoading: isAnalysisLoading } = useQuery({
        queryKey: ['feedingAnalysis', schoolId, analysisStartDate, analysisEndDate],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feeding_logs')
                .select('date, amount, fee_amount, student:students(id, name, class)')
                .eq('school_id', schoolId)
                .gte('date', analysisStartDate)
                .lte('date', analysisEndDate)
                .eq('status', 'PAID');

            if (error) throw error;
            return data || [];
        },
        enabled: !!schoolId && viewMode === 'analysis'
    });

    // Process Analysis Data
    const processedAnalysis = React.useMemo(() => {
        const studentStats: Record<string, { name: string, class: string, count: number, total: number, totalFees: number, overall: number }> = {};
        let totalMeals = 0;
        let totalRevenue = 0;
        let totalFees = 0;

        analysisData.forEach((log: any) => {
            const studentId = log.student?.id;
            const studentName = log.student?.name || 'Unknown';
            const studentClass = log.student?.class || 'Unknown';

            // Filter by class if selected
            if (analysisClass && studentClass !== analysisClass) return;
            // Filter by search
            if (analysisSearch && !studentName.toLowerCase().includes(analysisSearch.toLowerCase())) return;

            if (!studentStats[studentId]) {
                studentStats[studentId] = { name: studentName, class: studentClass, count: 0, total: 0, totalFees: 0, overall: 0 };
            }

            studentStats[studentId].count += 1;
            // Use log.amount if > 0, else use pricePerMeal
            const Amt = log.amount > 0 ? Number(log.amount) : pricePerMeal;
            const FeeAmt = Number(log.fee_amount || 0);

            studentStats[studentId].total += Amt;
            studentStats[studentId].totalFees += FeeAmt;
            studentStats[studentId].overall += (Amt + FeeAmt);

            totalMeals += 1;
            totalRevenue += Amt;
            totalFees += FeeAmt;
        });

        return {
            students: Object.values(studentStats).sort((a, b) => b.overall - a.overall),
            totalMeals,
            totalRevenue,
            totalFees,
            overallTotal: totalRevenue + totalFees
        };
    }, [analysisData, analysisClass, analysisSearch, pricePerMeal]);


    // Initial Class Selection
    useEffect(() => {
        if (!selectedClass && classes.length > 0) {
            setSelectedClass(classes[0]);
        }
    }, [classes, selectedClass]);


    // --- Mutations ---

    const toggleFeedingMutation = useMutation({
        mutationFn: async ({ studentId, isPaid }: { studentId: string, isPaid: boolean }) => {
            if (isPaid) {
                // It was paid, now toggle to unpaid (delete)
                await supabase.from('feeding_logs').delete()
                    .eq('student_id', studentId)
                    .eq('date', selectedDate);
            } else {
                // It was unpaid, now toggle to paid (upsert)
                await supabase.from('feeding_logs').upsert({
                    school_id: schoolId,
                    student_id: studentId,
                    date: selectedDate,
                    status: 'PAID',
                    amount: pricePerMeal,
                    fee_amount: configCollectFees ? configDailyFeeAmount : 0
                });
            }
        },
        onMutate: async ({ studentId, isPaid }) => {
            // Cancel refetches
            await queryClient.cancelQueries({ queryKey: ['feedingLogs', schoolId, selectedDate] });

            // Snapshot
            const previousMap = queryClient.getQueryData(['feedingLogs', schoolId, selectedDate]);

            // Optimistic Update
            queryClient.setQueryData(['feedingLogs', schoolId, selectedDate], (old: Record<string, boolean> = {}) => {
                const newMap = { ...old };
                if (isPaid) delete newMap[studentId]; // Become unpaid
                else newMap[studentId] = true; // Become paid
                return newMap;
            });

            return { previousMap };
        },
        onError: (err, newTodo, context: any) => {
            queryClient.setQueryData(['feedingLogs', schoolId, selectedDate], context.previousMap);
            alert('Error updating feeding status');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId, selectedDate] });
        }
    });

    const markAllPaidMutation = useMutation({
        mutationFn: async () => {
            const updates = students.map((s: any) => ({
                school_id: schoolId,
                student_id: s.id,
                date: selectedDate,
                status: 'PAID',
                amount: pricePerMeal,
                fee_amount: configCollectFees ? configDailyFeeAmount : 0
            }));
            const { error } = await supabase.from('feeding_logs').upsert(updates, { onConflict: 'student_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId, selectedDate] });
            alert('All displayed students marked as PAID.');
        },
        onError: () => alert('Error marking all paid')
    });

    const bulkPaymentMutation = useMutation({
        mutationFn: async ({ studentId, start, end }: { studentId: string, start: string, end: string }) => {
            // Generate dates
            const dates = [];
            let curr = new Date(start);
            const endDateObj = new Date(end);

            while (curr <= endDateObj) {
                dates.push(new Date(curr).toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }

            const inserts = dates.map(date => ({
                school_id: schoolId,
                student_id: studentId,
                date: date,
                status: 'PAID',
                amount: pricePerMeal,
                fee_amount: configCollectFees ? configDailyFeeAmount : 0
            }));

            const { error } = await supabase.from('feeding_logs').upsert(inserts, { onConflict: 'student_id,date' });
            if (error) throw error;
            return dates.length;
        },
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId] }); // Invalidate loosely or specifically
            alert(`Successfully marked ${count} days as paid.`);
            setShowBulkModal(false);
        },
        onError: (error: any) => alert('Error: ' + error.message)
    });

    const updateConfigMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('schools')
                .update({
                    feeding_fee_amount: configFee,
                    teachers_can_collect_feeding: configTeachers,
                    collect_daily_fees: configCollectFees,
                    daily_fee_amount: configDailyFeeAmount
                })
                .eq('id', schoolId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId, 'feeding'] });
            alert('Feeding configuration saved successfully!');
        },
        onError: (err: any) => alert('Error saving configuration: ' + err.message)
    });


    // --- Handlers ---

    const toggleFeeding = (student: Student) => {
        const isPaid = feedingMap[student.id];
        toggleFeedingMutation.mutate({ studentId: student.id, isPaid: !!isPaid });
    };

    const markAllPaid = () => {
        if (!confirm('Mark all displayed students as PAID for today?')) return;
        markAllPaidMutation.mutate();
    };

    const handleBulkPayment = () => {
        if (!bulkStudent || !bulkStartDate || !bulkEndDate) return;
        bulkPaymentMutation.mutate({
            studentId: bulkStudent.id,
            start: bulkStartDate,
            end: bulkEndDate
        });
    };

    // Filter Logic
    const filteredStudents = students.filter((s: any) => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const isPresent = attendanceMap[s.id] === 'Present';
        const isPaid = feedingMap[s.id];

        if (showOnlyDefaulters) {
            // Came (Present) but Didn't Pay
            return matchesSearch && isPresent && !isPaid;
        }
        return matchesSearch;
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));

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

                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('collection')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'collection' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Collection
                    </button>
                    <button
                        onClick={() => setViewMode('analysis')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'analysis' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChart2 className="w-4 h-4" /> Analysis
                    </button>
                    {currentUser?.role === 'admin' && (
                        <button
                            onClick={() => setViewMode('config')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'config' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Settings className="w-4 h-4" /> Config
                        </button>
                    )}
                </div>
            </div>

            {viewMode === 'collection' ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                            <select
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                {classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
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
                                disabled={markAllPaidMutation.isPending}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 shadow-sm flex items-center gap-2"
                            >
                                <CheckSquare className="h-4 w-4" /> Mark All Paid
                            </button>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[600px] md:min-h-0">
                        <div className="overflow-y-auto flex-1">
                            {studentsLoading ? (
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
                                            filteredStudents.map((student: any) => {
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
                </>
            ) : viewMode === 'analysis' ? (
                // Analysis View
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                                <input type="date" value={analysisStartDate} onChange={e => setAnalysisStartDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                                <input type="date" value={analysisEndDate} onChange={e => setAnalysisEndDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter Class</label>
                                <select value={analysisClass} onChange={e => setAnalysisClass(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                                    <option value="">All Classes</option>
                                    {classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost Per Meal</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">¢</span>
                                    <input type="number" min="0" value={pricePerMeal} onChange={e => setPricePerMeal(Number(e.target.value))} className="w-full p-2 pl-7 border border-slate-300 rounded-lg text-sm font-bold text-slate-800" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg lg:col-span-2 flex flex-col justify-between">
                            <div>
                                <p className="opacity-80 font-medium mb-1">Total Overall Revenue</p>
                                <h2 className="text-4xl font-black">GH¢ {processedAnalysis.overallTotal.toLocaleString()}</h2>
                            </div>
                            <div className="mt-4 flex gap-4 text-sm opacity-90 border-t border-white/20 pt-4">
                                <div>
                                    <span className="block text-xs opacity-70">Feeding</span>
                                    <strong className="text-lg">GH¢ {processedAnalysis.totalRevenue.toLocaleString()}</strong>
                                </div>
                                <div>
                                    <span className="block text-xs opacity-70">Daily Fees</span>
                                    <strong className="text-lg">GH¢ {processedAnalysis.totalFees.toLocaleString()}</strong>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between lg:col-span-2">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-slate-500 font-medium mb-1">Total Meals Served</p>
                                    <h2 className="text-4xl font-bold text-slate-800">{processedAnalysis.totalMeals}</h2>
                                    <p className="text-xs text-green-600 mt-2 font-bold px-2 py-1 bg-green-50 rounded-lg inline-block">100% Paid</p>
                                </div>
                                <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                                    <Utensils className="h-8 w-8" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-700">Detailed Report</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search student..."
                                    value={analysisSearch}
                                    onChange={e => setAnalysisSearch(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white border-b border-slate-200 text-xs text-slate-500 uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-3">Student Name</th>
                                        <th className="px-6 py-3">Class</th>
                                        <th className="px-6 py-3 text-center">Meals Count</th>
                                        <th className="px-6 py-3 text-right">Feeding</th>
                                        <th className="px-6 py-3 text-right">Fees</th>
                                        <th className="px-6 py-3 text-right">Overall</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {processedAnalysis.students.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No records found for this period.</td></tr>
                                    ) : (
                                        processedAnalysis.students.map((record: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-slate-800">{record.name}</td>
                                                <td className="px-6 py-3 text-slate-500 text-sm">{record.class}</td>
                                                <td className="px-6 py-3 text-center font-bold text-slate-700">{record.count}</td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-600">GH¢ {record.total.toFixed(2)}</td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-600">GH¢ {record.totalFees.toFixed(2)}</td>
                                                <td className="px-6 py-3 text-right font-bold text-green-600 bg-green-50/30">GH¢ {record.overall.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : viewMode === 'config' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-6 pb-6 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Settings className="h-5 w-5 text-orange-500" />
                            Feeding Configuration
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Manage global feeding settings for your school.</p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); updateConfigMutation.mutate(); }} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Cost Per Meal (GH¢)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-400 font-medium">GH¢</span>
                                </div>
                                <input
                                    type="number"
                                    value={configFee}
                                    onChange={e => setConfigFee(Number(e.target.value))}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-700 font-bold"
                                    step="0.01"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                                Used to calculate total revenue in analysis automatically.
                            </p>
                        </div>

                        <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 flex items-center gap-4 cursor-pointer hover:bg-orange-50 transition-colors" onClick={() => setConfigTeachers(!configTeachers)}>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-800">Teacher Collection Access</h3>
                                <p className="text-xs text-slate-500 mt-1">Allow teachers to mark students as PAID from their dashboards.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={configTeachers}
                                    readOnly
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <div className="flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors p-2 rounded-lg" onClick={() => setConfigCollectFees(!configCollectFees)}>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-slate-800">Collect Daily Fees Alongside Feeding</h3>
                                    <p className="text-xs text-slate-500 mt-1">Record a fixed daily fee amount whenever feeding is marked as paid.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={configCollectFees}
                                        readOnly
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>

                            {configCollectFees && (
                                <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Daily Fee Amount (GH¢)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-400 font-medium">GH¢</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={configDailyFeeAmount}
                                            onChange={e => setConfigDailyFeeAmount(Number(e.target.value))}
                                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-700 font-bold"
                                            step="0.01"
                                            required={configCollectFees}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">This amount will be added to the overall totals during collection.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={updateConfigMutation.isPending}
                                className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                                {!updateConfigMutation.isPending && <Save className="h-4 w-4" />}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            {/* Advance Payment Modal (Global) */}
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
                                    disabled={bulkPaymentMutation.isPending}
                                    className="flex-1 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                                >
                                    {bulkPaymentMutation.isPending ? 'Processing...' : 'Confirm Payment'}
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
