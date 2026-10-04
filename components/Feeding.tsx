import React, { useState, useEffect } from 'react';
import {
    Calendar, CheckCircle, XCircle, Search, Utensils,
    Filter, ChevronDown, CheckSquare, Plus, DollarSign,
    AlertCircle, Save, BarChart2, Settings, X, Trash2
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

    const role = (currentUser?.role || '').toLowerCase();
    const isAdmin = role.includes('admin') || role.includes('director') || role.includes('head');

    if (isAdmin) {
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

        if (assignedClassNames.length > 0) {
            return assignedClassNames;
        }

        // Fallback to all classes if no specific assignments
        const { data } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
        return data ? data.map(c => c.name) : [];
    }
    return [];
};

const fetchStudents = async (schoolId: string, className: string) => {
    const { data } = await supabase
        .from('students')
        .select('id, name, class, feeding_credit')
        .eq('school_id', schoolId)
        .eq('class', className)
        .order('name');
    return data || [];
};

const fetchFeedingLogs = async (schoolId: string, inputDate: string) => {
    try {
        const { data, error } = await supabase
            .from('feeding_logs')
            .select('*')
            .eq('school_id', schoolId)
            .eq('date', inputDate);

        if (error) {
            console.warn("fetchFeedingLogs query warning:", error);
            return {};
        }

        const map: Record<string, any> = {};
        data?.forEach((r: any) => map[r.student_id] = r);
        return map;
    } catch {
        return {};
    }
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
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [recordingStudent, setRecordingStudent] = useState<any>(null);
    const [customAmount, setCustomAmount] = useState<string>('');

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
            try {
                // 1. Try relational query
                const { data, error } = await supabase
                    .from('feeding_logs')
                    .select('date, amount, amount_paid, fee_amount, student_id, students(id, name, class)')
                    .eq('school_id', schoolId)
                    .gte('date', analysisStartDate)
                    .lte('date', analysisEndDate)
                    .eq('status', 'PAID');

                if (!error && data) {
                    return data.map((d: any) => ({
                        ...d,
                        student: Array.isArray(d.students) ? d.students[0] : (d.students || { id: d.student_id })
                    }));
                }

                // 2. Fallback: flat select and map with students
                const { data: flatLogs } = await supabase
                    .from('feeding_logs')
                    .select('date, amount, amount_paid, fee_amount, student_id')
                    .eq('school_id', schoolId)
                    .gte('date', analysisStartDate)
                    .lte('date', analysisEndDate)
                    .eq('status', 'PAID');

                const sIds = [...new Set((flatLogs || []).map((l: any) => l.student_id))];
                let sMap: Record<string, any> = {};
                if (sIds.length > 0) {
                    const { data: stList } = await supabase
                        .from('students')
                        .select('id, name, class')
                        .in('id', sIds);
                    stList?.forEach((st: any) => { sMap[st.id] = st; });
                }

                return (flatLogs || []).map((l: any) => ({
                    ...l,
                    student: sMap[l.student_id] || { id: l.student_id, name: 'Student', class: 'N/A' }
                }));
            } catch (err) {
                console.warn("feedingAnalysis query caught error:", err);
                return [];
            }
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
            // Use log.amount_paid for revenue
            const AmtPaid = Number(log.amount_paid || 0);
            const FeeAmt = Number(log.fee_amount || 0);

            studentStats[studentId].total += AmtPaid;
            studentStats[studentId].totalFees += FeeAmt;
            studentStats[studentId].overall += (AmtPaid + FeeAmt);

            totalMeals += 1;
            totalRevenue += AmtPaid;
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

    const recordFeedingMutation = useMutation({
        mutationFn: async ({ student, amountPaid, isDebt = false }: { student: any, amountPaid: number, isDebt?: boolean }) => {
            const totalDue = pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0);

            // 1. Record in feeding_logs
            const { error: logError } = await supabase.from('feeding_logs').upsert({
                school_id: schoolId,
                student_id: student.id,
                date: selectedDate,
                status: isDebt ? 'DEBT' : (amountPaid >= totalDue ? 'PAID' : 'PARTIAL'),
                amount: totalDue,
                amount_paid: amountPaid,
                fee_amount: configCollectFees ? configDailyFeeAmount : 0
            }, { onConflict: 'student_id,date' });

            if (logError) throw logError;

            // 2. Update Student Balance (Wallet)
            // If they paid GH₵ 5 but it cost GH₵ 5 -> 0 change to credit
            // If they paid GH₵ 10 but it cost GH₵ 5 -> +5 to credit
            // If they paid GH₵ 0 but it cost GH₵ 5 -> -5 to credit
            const balanceChange = amountPaid - totalDue;
            const newCredit = (student.feeding_credit || 0) + balanceChange;

            const { error: studentError } = await supabase
                .from('students')
                .update({ feeding_credit: newCredit })
                .eq('id', student.id);

            if (studentError) throw studentError;

            return { studentId: student.id, newCredit };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            setShowRecordModal(false);
            setRecordingStudent(null);
            setCustomAmount('');
        },
        onError: (err: any) => {
            alert('Error recording feeding: ' + err.message);
        }
    });

    const deleteFeedingMutation = useMutation({
        mutationFn: async (student: any) => {
            // Revert the credit before deleting
            const log = feedingMap[student.id];
            if (!log) return;

            const balanceToRevert = log.amount - (log.amount_paid || 0);
            const newCredit = (student.feeding_credit || 0) + balanceToRevert;

            await supabase.from('students').update({ feeding_credit: newCredit }).eq('id', student.id);
            await supabase.from('feeding_logs').delete().eq('id', log.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
        }
    });

    const markAllPaidMutation = useMutation({
        mutationFn: async () => {
            const totalDue = pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0);
            const updates = students.map((s: any) => ({
                school_id: schoolId,
                student_id: s.id,
                date: selectedDate,
                status: 'PAID',
                amount: totalDue,
                amount_paid: totalDue,
                fee_amount: configCollectFees ? configDailyFeeAmount : 0
            }));
            const { error } = await supabase.from('feeding_logs').upsert(updates, { onConflict: 'student_id,date' });
            if (error) throw error;

            // Note: In a real large-scale app, we'd use a single RPC to update all balances.
            // For now, we'll suggest clicking individually for balance tracking if precision is needed,
            // or we can implement the multi-balance update here.
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            alert('All displayed students marked as PAID.');
        },
        onError: () => alert('Error marking all paid')
    });

    const bulkPaymentMutation = useMutation({
        mutationFn: async ({ student, start, end }: { student: any, start: string, end: string }) => {
            const totalDuePerDay = pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0);

            // Generate school day dates (skip weekends)
            const dates = [];
            let curr = new Date(start);
            const endDateObj = new Date(end);

            while (curr <= endDateObj) {
                const day = curr.getDay();
                // 0 is Sunday, 6 is Saturday - only include school days Monday-Friday
                if (day !== 0 && day !== 6) {
                    dates.push(new Date(curr).toISOString().split('T')[0]);
                }
                curr.setDate(curr.getDate() + 1);
            }

            const inserts = dates.map(date => ({
                school_id: schoolId,
                student_id: student.id,
                date: date,
                status: 'PAID',
                amount: totalDuePerDay,
                amount_paid: totalDuePerDay, // Assuming full payment for advance
                fee_amount: configCollectFees ? configDailyFeeAmount : 0
            }));

            const { error } = await supabase.from('feeding_logs').upsert(inserts, { onConflict: 'student_id,date' });
            if (error) throw error;

            // Advance payment doesn't change wallet balance if it's considered "Paid upfront outside wallet"
            // OR we can say it's paid, so balance remains same.

            return dates.length;
        },
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: ['feedingLogs', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
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
    const openRecordModal = (student: Student) => {
        setRecordingStudent(student);
        setShowRecordModal(true);
    };

    const handleRecordSubmit = (amount: number, isDebt: boolean = false) => {
        if (!recordingStudent) return;
        recordFeedingMutation.mutate({ student: recordingStudent, amountPaid: amount, isDebt });
    };

    const removeFeedingRecord = (student: any) => {
        if (!confirm('Are you sure you want to remove this record? This will also revert the wallet balance.')) return;
        deleteFeedingMutation.mutate(student);
    };

    const markAllPaid = () => {
        if (!confirm('Mark all displayed students as PAID for today?')) return;
        markAllPaidMutation.mutate();
    };

    const handleBulkPayment = () => {
        if (!bulkStudent || !bulkStartDate || !bulkEndDate) return;
        bulkPaymentMutation.mutate({
            student: bulkStudent,
            start: bulkStartDate,
            end: bulkEndDate
        });
    };

    // Filter Logic
    const filteredStudents = students.filter((s: any) => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const isPresent = attendanceMap[s.id] === 'Present';
        const log = feedingMap[s.id];

        if (showOnlyDefaulters) {
            // Came (Present) but Didn't Pay Full
            const totalDue = pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0);
            const isFullyPaid = log && (log.amount_paid || 0) >= totalDue;
            return matchesSearch && isPresent && !isFullyPaid;
        }
        return matchesSearch;
    }).sort((a: any, b: any) => {
        // Sort: Defaulters (Present but not paid) first, then by name
        const totalDue = pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0);

        const aIsDefaulter = attendanceMap[a.id] === 'Present' && (!feedingMap[a.id] || feedingMap[a.id].amount_paid < totalDue);
        const bIsDefaulter = attendanceMap[b.id] === 'Present' && (!feedingMap[b.id] || feedingMap[b.id].amount_paid < totalDue);

        if (aIsDefaulter && !bIsDefaulter) return -1;
        if (!aIsDefaulter && bIsDefaulter) return 1;

        return a.name.localeCompare(b.name);
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
                                                const log = feedingMap[student.id];
                                                const attStatus = attendanceMap[student.id] || 'Not Marked';
                                                const totalDue = pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0);
                                                const walletBalance = student.feeding_credit || 0;

                                                return (
                                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${walletBalance < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {student.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-800">{student.name}</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">{student.class}</span>
                                                                        <span className={`text-[10px] font-black ${walletBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                            Wallet: GH₵ {walletBalance.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {log ? (
                                                                <div className="flex flex-col items-center gap-1 group">
                                                                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 border-2 ${log.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                        log.status === 'PARTIAL' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                            'bg-red-50 text-red-700 border-red-200'
                                                                        }`}>
                                                                        {log.status === 'PAID' ? <CheckCircle className="h-3 w-3" /> :
                                                                            log.status === 'PARTIAL' ? <DollarSign className="h-3 w-3" /> :
                                                                                <XCircle className="h-3 w-3" />}
                                                                        {log.status} (GH₵ {log.amount_paid?.toFixed(2)})
                                                                    </div>
                                                                    <button
                                                                        onClick={() => removeFeedingRecord(student)}
                                                                        className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        Reset
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openRecordModal(student)}
                                                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-orange-600 hover:text-white transition-all border border-slate-200"
                                                                >
                                                                    Record Daily
                                                                </button>
                                                            )}
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
                                                            <div className="flex flex-col items-end gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setBulkStudent(student);
                                                                        setShowBulkModal(true);
                                                                    }}
                                                                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                                                >
                                                                    <Calendar className="h-3 w-3" /> Advance
                                                                </button>
                                                            </div>
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

                    {/* Debtors Section */}
                    <div className="bg-white border-2 border-red-100 rounded-3xl shadow-xl overflow-hidden mt-8">
                        <div className="p-6 border-b border-red-50 flex justify-between items-center bg-red-50/10">
                            <div>
                                <h3 className="font-black text-red-800 flex items-center gap-2 uppercase tracking-tight">
                                    <AlertCircle className="h-5 w-5" />
                                    Feeding Debtors Only
                                </h3>
                                <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest">Students with negative wallet balances</p>
                            </div>
                            <div className="bg-red-600 text-white px-4 py-2 rounded-2xl font-black text-sm shadow-lg shadow-red-100 flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Total Debt: GH₵ {Math.abs(students.filter(s => (s.feeding_credit || 0) < 0).reduce((sum, s) => sum + (Number(s.feeding_credit) || 0), 0)).toFixed(2)}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-4">Student Name</th>
                                        <th className="px-6 py-4">Class</th>
                                        <th className="px-6 py-4 text-right">Owed Amount</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {students.filter(s => (s.feeding_credit || 0) < 0).length === 0 ? (
                                        <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic font-medium">No feeding debtors found! Everyone is up to date.</td></tr>
                                    ) : (
                                        students.filter(s => (s.feeding_credit || 0) < 0)
                                            .sort((a, b) => (Number(a.feeding_credit) || 0) - (Number(b.feeding_credit) || 0))
                                            .map((s: any) => (
                                                <tr key={s.id} className="hover:bg-red-50/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                                                                {s.name.charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-slate-800">{s.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black uppercase text-slate-600">{s.class}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-red-600">
                                                        GH₵ {Math.abs(s.feeding_credit).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => { setViewMode('collection'); setSelectedClass(s.class); setSearchTerm(s.name); }}
                                                            className="px-3 py-1.5 bg-slate-100 hover:bg-orange-600 hover:text-white text-[10px] font-black text-slate-600 rounded-lg uppercase tracking-widest transition-all"
                                                        >
                                                            Open Account
                                                        </button>
                                                    </td>
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

            {/* Daily Feeding Record Modal */}
            {showRecordModal && recordingStudent && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-orange-600 p-6 text-white text-center relative">
                            <button
                                onClick={() => setShowRecordModal(false)}
                                className="absolute right-4 top-4 hover:bg-white/20 p-1.5 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <div className="h-20 w-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                                <Utensils className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-xl font-black">{recordingStudent.name}</h3>
                            <p className="text-orange-100 text-sm font-bold uppercase tracking-wider">{recordingStudent.class}</p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Due Today</p>
                                    <p className="text-lg font-black text-slate-800">
                                        GH₵ {(pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0)).toFixed(2)}
                                    </p>
                                </div>
                                <div className={`p-4 rounded-2xl border ${recordingStudent.feeding_credit < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${recordingStudent.feeding_credit < 0 ? 'text-red-400' : 'text-green-400'}`}>Current Wallet</p>
                                    <p className={`text-lg font-black ${recordingStudent.feeding_credit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        GH₵ {(recordingStudent.feeding_credit || 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleRecordSubmit(pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0))}
                                    disabled={recordFeedingMutation.isPending}
                                    className="w-full py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 group"
                                >
                                    <CheckSquare className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    FULL PAYMENT (GH₵ {(pricePerMeal + (configCollectFees ? configDailyFeeAmount : 0)).toFixed(2)})
                                </button>

                                <button
                                    onClick={() => handleRecordSubmit(0, true)}
                                    disabled={recordFeedingMutation.isPending}
                                    className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 group"
                                >
                                    <AlertCircle className="h-5 w-5 group-hover:scale-110 transition-transform text-orange-400" />
                                    MARK AS DEBT (GH₵ 0.00)
                                </button>

                                <div className="relative pt-4 overflow-hidden">
                                    <div className="absolute top-4 left-0 right-0 border-t border-slate-100 italic text-[10px] text-slate-300 text-center uppercase tracking-widest bg-white w-20 mx-auto z-10">OR</div>
                                    <div className="pt-6">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">GH₵</span>
                                                <input
                                                    type="number"
                                                    placeholder="Partial amount..."
                                                    value={customAmount}
                                                    onChange={e => setCustomAmount(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none text-lg font-black text-slate-800 transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleRecordSubmit(Number(customAmount))}
                                                disabled={!customAmount || recordFeedingMutation.isPending}
                                                className="bg-orange-600 text-white px-6 rounded-2xl font-black hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-100"
                                            >
                                                PAY
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
