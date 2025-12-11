import React, { useEffect, useState } from 'react';
import { 
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Users, AlertCircle, BookOpen, Gift, CheckCircle, Clock } from 'lucide-react';

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

const Analytics: React.FC = () => {
    const [financialData, setFinancialData] = useState<FinancialMonth[]>([]);
    const [debtorData, setDebtorData] = useState<any[]>([]);
    const [classPopData, setClassPopData] = useState<any[]>([]);
    const [academicData, setAcademicData] = useState<any[]>([]);
    const [referralHistory, setReferralHistory] = useState<Referral[]>([]);

    useEffect(() => {
        // 1. Load Financial History
        const storedHistory = localStorage.getItem('schoolhub_financial_history');
        if (storedHistory) {
            setFinancialData(JSON.parse(storedHistory));
        }

        // 2. Process Student Data for Debtors & Population
        const storedStudents = localStorage.getItem('schoolhub_students');
        if (storedStudents) {
            const students: Student[] = JSON.parse(storedStudents);
            
            // Debtor Logic
            let paidCount = 0;
            let partCount = 0;
            let debtCount = 0;

            students.forEach(s => {
                if (s.balance === 0) paidCount++;
                else if (s.balance < 300) partCount++; // Assuming < 300 is partial
                else debtCount++;
            });

            setDebtorData([
                { name: 'Fully Paid', value: paidCount, color: '#10b981' }, // Emerald-500
                { name: 'Part Payment', value: partCount, color: '#f59e0b' }, // Amber-500
                { name: 'High Debt', value: debtCount, color: '#ef4444' }, // Red-500
            ]);

            // Class Population Logic
            const classCounts: Record<string, number> = {};
            students.forEach(s => {
                classCounts[s.class] = (classCounts[s.class] || 0) + 1;
            });

            // Sort logic: custom sort to keep classes in order if needed, or simple object entries
            const classOrder = ['Creche', 'KG 1', 'KG 2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'JHS 1', 'JHS 2', 'JHS 3'];
            const popChartData = classOrder
                .filter(c => classCounts[c] !== undefined) // Only show classes with students for cleaner chart
                .map(c => ({
                    name: c,
                    students: classCounts[c] || 0
                }));
            
            setClassPopData(popChartData);
        }

        // 3. Process Academic Performance
        const storedResults = localStorage.getItem('schoolhub_results');
        if (storedResults) {
            const results: Result[] = JSON.parse(storedResults);
            const subjectStats: Record<string, { total: number, count: number }> = {};
            
            results.forEach(r => {
                if (!subjectStats[r.subject]) subjectStats[r.subject] = { total: 0, count: 0 };
                subjectStats[r.subject].total += r.total;
                subjectStats[r.subject].count += 1;
            });

            const acaChartData = Object.keys(subjectStats).map(sub => ({
                subject: sub,
                score: Math.round(subjectStats[sub].total / subjectStats[sub].count),
                fullMark: 100
            })).slice(0, 6); // Take top 6 for display if too many
            
            setAcademicData(acaChartData);
        }

        // 4. Load Referral History
        const storedReferrals = localStorage.getItem('schoolhub_referrals');
        if (storedReferrals) {
            setReferralHistory(JSON.parse(storedReferrals));
        }

    }, []);

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-8 space-y-8 h-full bg-slate-50 overflow-y-auto">
            
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Analytics & Reports</h1>
                <p className="text-slate-500 text-sm">Real-time insights into your school's performance.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. MAIN CHART: Money Trend (Line Chart) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Monthly Fee Collection (2025)</h3>
                    </div>
                    
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={financialData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
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
                                    tickFormatter={(value) => `₵${value/1000}k`} 
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Area 
                                    type="monotone" 
                                    dataKey="expected" 
                                    name="Expected Revenue" 
                                    stroke="#94a3b8" 
                                    strokeDasharray="5 5" 
                                    fill="none" 
                                    strokeWidth={2}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="collected" 
                                    name="Actual Collected" 
                                    stroke="#2563eb" 
                                    fillOpacity={1} 
                                    fill="url(#colorCollected)" 
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Debtor Analysis (Donut Chart) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-red-50 p-2 rounded-lg text-red-600">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Fee Payment Status</h3>
                    </div>

                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={debtorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {debtorData.map((entry, index) => (
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
                                <p className="text-xs text-slate-400 font-bold uppercase">Paid</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    {Math.round((debtorData[0]?.value / debtorData.reduce((a,b) => a + b.value, 0)) * 100) || 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Class Population (Bar Chart) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                            <Users className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Students per Class</h3>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={classPopData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
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

                {/* 4. Academic Performance (Bar Chart - Vertical) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Average Subject Performance</h3>
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

                {/* 5. REFERRAL PAYOUTS (NEW) */}
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
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
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                    ref.status === 'Paid' || ref.status === 'Applied' 
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