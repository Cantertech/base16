import {
    AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Users, AlertCircle, BookOpen, Gift, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';
import { useQuery } from '@tanstack/react-query';

// --- Types ---
interface FinancialMonth {
    month: string;
    expected: number;
    collected: number;
}

interface Student {
    id: string;
    class: string;
    balance: number;
}

interface Result {
    subject: string;
    total: number;
}

interface Referral {
    id: string;
    schoolName: string;
    date: string;
    reward: string;
    status: 'Pending' | 'Paid' | 'Applied';
}

interface AnalyticsProps {
    currentUser?: {
        school_id: string;
    };
}

const Analytics: React.FC<AnalyticsProps> = ({ currentUser }) => {
    const { formatAmount, currency } = useCurrency();
    // --- Queries ---

    // 1. Financial History & Transactions
    const { data: financialHistory = [] } = useQuery({
        queryKey: ['financialAnalytics', currentUser?.school_id],
        queryFn: async () => {
            if (!currentUser?.school_id) return [];

            // Fetch Transactions
            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount, date')
                .eq('school_id', currentUser.school_id);

            // Fetch Debt for Expected Calculation
            const { data: debtData } = await supabase
                .from('students')
                .select('balance')
                .eq('school_id', currentUser.school_id)
                .gt('balance', 0);

            if (!transactions) return [];

            const monthlyData: Record<string, number> = {};
            transactions.forEach((t: any) => {
                const date = new Date(t.date);
                const month = date.toLocaleString('default', { month: 'short' });
                monthlyData[month] = (monthlyData[month] || 0) + t.amount;
            });

            const totalDebt = debtData?.reduce((sum, s) => sum + (s.balance || 0), 0) || 0;
            const currentMonth = new Date().toLocaleString('default', { month: 'short' });
            const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            return monthsOrder.map(m => {
                const collected = monthlyData[m] || 0;
                const expected = m === currentMonth ? (collected + totalDebt) : collected;
                return { month: m, expected, collected };
            });
        },
        enabled: !!currentUser?.school_id,
        initialData: []
    });

    // 2. Student Data (Debtors & Population)
    const { data: studentStats = { debtorData: [], classPopData: [] } } = useQuery({
        queryKey: ['studentAnalytics', currentUser?.school_id],
        queryFn: async () => {
            if (!currentUser?.school_id) return { debtorData: [], classPopData: [] };

            const { data: students } = await supabase
                .from('students')
                .select('class, balance')
                .eq('school_id', currentUser.school_id);

            if (!students) return { debtorData: [], classPopData: [] };

            // Debtor Logic
            let paidCount = 0, partCount = 0, debtCount = 0;
            students.forEach((s: any) => {
                if (s.balance <= 0) paidCount++;
                else if (s.balance < 300) partCount++;
                else debtCount++;
            });

            const debtorData = [
                { name: 'Fully Paid', value: paidCount, color: '#10b981' },
                { name: 'Part Payment', value: partCount, color: '#f59e0b' },
                { name: 'High Debt', value: debtCount, color: '#ef4444' },
            ];

            // Class Population Logic
            const classCounts: Record<string, number> = {};
            students.forEach((s: any) => {
                classCounts[s.class] = (classCounts[s.class] || 0) + 1;
            });

            const classOrder = ['Creche', 'KG 1', 'KG 2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'JHS 1', 'JHS 2', 'JHS 3'];
            const classPopData = classOrder
                .filter(c => classCounts[c] !== undefined)
                .map(c => ({ name: c, students: classCounts[c] || 0 }));

            return { debtorData, classPopData };
        },
        enabled: !!currentUser?.school_id
    });

    // 3. Academic Performance
    const { data: academicData = [] } = useQuery({
        queryKey: ['academicAnalytics', currentUser?.school_id],
        queryFn: async () => {
            if (!currentUser?.school_id) return [];
            const { data: results } = await supabase
                .from('exam_results')
                .select('subject, total')
                .eq('school_id', currentUser.school_id);

            if (!results) return [];

            const subjectStats: Record<string, { total: number, count: number }> = {};
            results.forEach((r: any) => {
                if (!subjectStats[r.subject]) subjectStats[r.subject] = { total: 0, count: 0 };
                subjectStats[r.subject].total += r.total;
                subjectStats[r.subject].count += 1;
            });

            return Object.keys(subjectStats).map(sub => ({
                subject: sub,
                score: Math.round(subjectStats[sub].total / subjectStats[sub].count),
                fullMark: 100
            })).sort((a, b) => b.score - a.score).slice(0, 6);
        },
        enabled: !!currentUser?.school_id
    });

    // 4. Referrals (retired feature — return empty list without hitting nonexistent table)
    const { data: referralHistory = [] } = useQuery({
        queryKey: ['referralAnalytics', currentUser?.school_id],
        queryFn: async () => [] as any[],
        enabled: false
    });

    // 5. Attendance Overview
    const { data: attendanceData = [] } = useQuery({
        queryKey: ['attendanceAnalytics', currentUser?.school_id], // Intentionally not including date in key to keep it simple for now, or could add today
        queryFn: async () => {
            if (!currentUser?.school_id) return [];
            const { data: attendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('school_id', currentUser.school_id)
                .eq('date', new Date().toISOString().split('T')[0]);

            if (!attendance) return [{ name: 'No Data', value: 1, color: '#cbd5e1' }];

            let present = 0, absent = 0, late = 0;
            attendance.forEach((r: any) => {
                if (r.status === 'Present') present++;
                else if (r.status === 'Absent') absent++;
                else if (r.status === 'Late') late++;
            });

            const total = present + absent + late;
            if (total > 0) {
                return [
                    { name: 'Present', value: present, color: '#22c55e' },
                    { name: 'Absent', value: absent, color: '#ef4444' },
                    { name: 'Late', value: late, color: '#eab308' }
                ];
            } else {
                return [{ name: 'No Data', value: 1, color: '#cbd5e1' }];
            }
        },
        enabled: !!currentUser?.school_id
    });

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.name.includes('Rate') || entry.name.includes('Paid') ? entry.value.toLocaleString() : currency && (entry.name.includes('Revenue') || entry.name.includes('Collected')) ? formatAmount(entry.value) : entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 h-full bg-slate-50 overflow-y-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">Analytics & Reports</h1>
                <p className="text-slate-500 text-xs md:text-sm">Real-time insights into your school's performance.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">

                {/* 1. MAIN CHART: Money Trend (Line Chart) */}
                <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                            <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">Monthly Fee Collection (2025)</h3>
                    </div>

                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={financialHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(value) => `${currency.symbol}${value / 1000}k`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Line
                                    type="monotone"
                                    dataKey="expected"
                                    name="Expected Revenue"
                                    stroke="#94a3b8"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="collected"
                                    name="Actual Collected"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. ATTENDANCE OVERVIEW (NEW) */}
                <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                        <div className="bg-green-50 p-2 rounded-lg text-green-600">
                            <Clock className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">Today's Attendance</h3>
                    </div>

                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={attendanceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {attendanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-6">
                            <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold uppercase">Present</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    {attendanceData.find(d => d.name === 'Present')?.value || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Debtor Analysis (Donut Chart) */}
                <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                        <div className="bg-red-50 p-2 rounded-lg text-red-600">
                            <AlertCircle className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">Fee Payment Status</h3>
                    </div>

                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={studentStats.debtorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {studentStats.debtorData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-6">
                            <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold uppercase">Paid</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    {Math.round((studentStats.debtorData[0]?.value / studentStats.debtorData.reduce((a: any, b: any) => a + b.value, 0)) * 100) || 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Class Population (Bar Chart) */}
                <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                        <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                            <Users className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">Students per Class</h3>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={studentStats.classPopData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                                    width={50}
                                />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} content={<CustomTooltip />} />
                                <Bar
                                    dataKey="students"
                                    name="Students"
                                    fill="#8b5cf6"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 5. Academic Performance (Bar Chart - Vertical) */}
                <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                        <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                            <BookOpen className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">Avg Performance</h3>
                    </div>

                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={academicData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="subject"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 100]}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                                <Bar
                                    dataKey="score"
                                    name="Avg Score"
                                    fill="#f97316"
                                    radius={[4, 4, 0, 0]}
                                    barSize={50}
                                >
                                    {academicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.score < 50 ? '#ef4444' : entry.score < 70 ? '#f59e0b' : '#22c55e'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 6. REFERRAL PAYOUTS */}
                <div className="lg:col-span-3 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                            <Gift className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Referral Payouts & History</h3>
                            <p className="text-xs text-slate-500">Track rewards earned from inviting other schools.</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Referred School</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date Paid</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Reward Chosen</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Payout Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {referralHistory.length > 0 ? (
                                    referralHistory.map((ref) => (
                                        <tr key={ref.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-800">{ref.schoolName}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{ref.date}</td>
                                            <td className="px-6 py-4 text-sm text-purple-700 font-medium">{ref.reward}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${ref.status === 'Paid' || ref.status === 'Applied'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {ref.status === 'Paid' || ref.status === 'Applied' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                    {ref.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">
                                            No referrals yet. Share your code to earn rewards!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Analytics;