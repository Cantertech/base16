import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    Layers,
    BarChart2,
    HelpCircle,
    FileText,
    Settings as SettingsIcon,
    LogOut,
    Bell,
    Search,
    Banknote,
    TrendingUp,
    ArrowUpRight,
    MessageSquare,
    ClipboardList,
    AlertTriangle,
    Lock,
    Clock,
    CheckCircle,
    Megaphone,
    Calendar,
    X,
    Utensils
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import Students from './Students';
import Teachers from './Teachers';
import Fees from './Fees';
import Exams from './Exams';
import Courses from './Courses';
import Analytics from './Analytics';
import Communication from './Communication';
import HelpCenter from './HelpCenter';
import Settings from './Settings';
import Attendance from './Attendance';
import Timetable from './Timetable';
import Feeding from './Feeding';
import Loading from './Loading';
import { supabase } from '../utils/supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface DashboardProps {
    onLogout: () => void;
    currentUser: {
        id: string;
        school_id: string;
        name: string;
        role: 'admin' | 'teacher';
        photo?: string | null;
        schoolLogo?: string | null;
        subject?: string;
        assignedClass?: string | null;
        classes?: string[];
    };
    isImpersonating?: boolean;
    onExitImpersonation?: () => void;
}

const TeacherDashboardHome = ({ currentUser, setActiveMenu, recentNotices }: any) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Welcome back, {currentUser.name}!</h1>
                    <p className="text-blue-100 mb-6 max-w-xl">Ready to inspire your students today? You have upcoming classes and pending reports to review.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setActiveMenu('Mark Entry & Reports')} className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-sm">Enter Marks</button>
                        <button onClick={() => setActiveMenu('My Students')} className="bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm">View Students</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMenu('Notice Board')}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Bell className="h-6 w-6" /></div>
                        <h3 className="font-bold text-slate-800">Recent Notices</h3>
                    </div>
                    <div className="space-y-3">
                        {recentNotices.length > 0 ? recentNotices.slice(0, 3).map((n: any) => (
                            <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${n.priority === 'Urgent' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{n.priority}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-700 line-clamp-2">{n.title}</p>
                            </div>
                        )) : <p className="text-sm text-slate-400 italic">No recent notices.</p>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle className="h-6 w-6" /></div>
                        <h3 className="font-bold text-slate-800">Quick Actions</h3>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => setActiveMenu('Mark Entry & Reports')} className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3 text-sm font-medium text-slate-600">
                            <FileText className="h-4 w-4 text-slate-400" /> Record Exam Scores
                        </button>
                        <button onClick={() => setActiveMenu('My Students')} className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3 text-sm font-medium text-slate-600">
                            <Users className="h-4 w-4 text-slate-400" /> View Class List
                        </button>
                        <button onClick={() => setActiveMenu('Settings & Profile')} className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3 text-sm font-medium text-slate-600">
                            <SettingsIcon className="h-4 w-4 text-slate-400" /> Update Profile
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Clock className="h-6 w-6" /></div>
                        <h3 className="font-bold text-slate-800">Today's Schedule</h3>
                    </div>
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-3"><Clock className="h-6 w-6 text-slate-300" /></div>
                        <p className="text-sm text-slate-500">No classes scheduled for today.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onLogout, currentUser, isImpersonating, onExitImpersonation }) => {
    const queryClient = useQueryClient();
    const { formatAmount, currency } = useCurrency();
    const [activeMenu, setActiveMenu] = useState('Dashboard');

    // Sidebar Customization State
    const [hiddenMenuItems, setHiddenMenuItems] = useState<string[]>([]);
    useEffect(() => {
        try {
            const saved = localStorage.getItem('orbit_hidden_menus');
            if (saved) setHiddenMenuItems(JSON.parse(saved));
        } catch (e) { console.error('Error loading menu prefs', e); }
    }, []);

    const toggleHiddenMenu = (name: string) => {
        const newHidden = hiddenMenuItems.includes(name)
            ? hiddenMenuItems.filter(i => i !== name)
            : [...hiddenMenuItems, name];
        setHiddenMenuItems(newHidden);
        localStorage.setItem('orbit_hidden_menus', JSON.stringify(newHidden));
    };

    // Welcome Modal State
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    // Subscription State
    const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'warning' | 'suspended'>('active');
    const [daysOverdue, setDaysOverdue] = useState(0);

    // --- Queries ---

    // 1. School Config (Name, Logo, Color, Payment Due, Term Info)
    const { data: schoolConfig, isLoading: configLoading } = useQuery({
        queryKey: ['schoolConfig', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return null;
            const { data: school } = await supabase.from('schools').select('*').eq('id', currentUser.school_id).single();
            return school ? {
                name: school.name,
                motto: school.motto,
                logo: school.logo_url,
                color: school.theme_color || 'blue',
                next_payment_due: school.next_payment_due,
                current_term: school.current_term || 'First Term',
                academic_year: school.academic_year
            } : null;
        },
        enabled: !!currentUser.school_id
    });

    // 2. Dashboard Stats (Counts)
    const { data: stats = { students: 0, teachers: 0, classes: 0, revenue: 0, boys: 0, girls: 0 }, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboardStats', currentUser.school_id, schoolConfig?.current_term, schoolConfig?.academic_year],
        queryFn: async () => {
            if (!currentUser.school_id || !schoolConfig) return { students: 0, teachers: 0, classes: 0, revenue: 0, boys: 0, girls: 0 };

            const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id);
            const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('role', 'teacher');
            const { count: classCount } = await supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id);

            const { count: boysCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('gender', 'Male');
            const { count: girlsCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('gender', 'Female');

            // Revenue - Filter by Term
            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount')
                .eq('school_id', currentUser.school_id)
                .eq('term', schoolConfig.current_term)
                .eq('academic_year', schoolConfig.academic_year);

            const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

            return {
                students: studentCount || 0,
                teachers: teacherCount || 0,
                classes: classCount || 0,
                revenue: totalRevenue,
                boys: boysCount || 0,
                girls: girlsCount || 0
            };
        },
        enabled: !!currentUser.school_id && !!schoolConfig
    });

    // 3. Financial History
    const { data: financialHistory = [] } = useQuery({
        queryKey: ['financialHistory', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return [];
            const { data: transactions } = await supabase.from('transactions').select('amount, date').eq('school_id', currentUser.school_id);

            const historyMap = new Map();
            transactions?.forEach((t: any) => {
                const date = new Date(t.date);
                const month = date.toLocaleString('default', { month: 'short' });
                historyMap.set(month, (historyMap.get(month) || 0) + t.amount);
            });

            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const m = d.toLocaleString('default', { month: 'short' });
                months.push({ month: m, collected: historyMap.get(m) || 0 });
            }
            return months;
        },
        enabled: !!currentUser.school_id
    });

    // 4. Recent Notices
    const { data: recentNotices = [] } = useQuery({
        queryKey: ['recentNotices', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return [];
            const { data: notices } = await supabase.from('notices').select('*').eq('school_id', currentUser.school_id).order('created_at', { ascending: false }).limit(5);
            return notices ? notices.map((n: any) => ({ ...n, priority: n.priority || 'Normal', audience: n.audience || 'All Staff' })) : [];
        },
        enabled: !!currentUser.school_id
    });

    // Combined Loading State
    const loading = configLoading || statsLoading;

    // --- Effects ---

    useEffect(() => {
        // Use the flag passed from Login.tsx
        if ((currentUser as any).isFirstLogin) {
            setShowWelcomeModal(true);
        }
    }, [currentUser]);

    useEffect(() => {
        if (schoolConfig?.next_payment_due) {
            const today = new Date();
            const due = new Date(schoolConfig.next_payment_due);
            // Reset time part for accurate day comparison
            today.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);

            const diffTime = today.getTime() - due.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 7) {
                setSubscriptionStatus('suspended');
            } else if (diffDays > 0) {
                setSubscriptionStatus('warning');
                setDaysOverdue(diffDays);
            } else {
                setSubscriptionStatus('active');
            }
        }
    }, [schoolConfig]);

    const getThemeStyles = (color: string) => {
        const isHex = color?.startsWith('#');
        if (isHex) {
            return {
                bg: '',
                bgLight: '',
                text: '',
                textDark: '',
                border: '',
                ring: 'focus:ring-opacity-50',
                shadow: '',
                custom: {
                    bg: color,
                    bgLight: `${color}15`, // ~8% opacity
                    text: color,
                    textDark: color,
                    border: `${color}33`, // ~20% opacity
                    ring: color,
                    shadow: `${color}33`
                }
            };
        }

        switch (color) {
            case 'purple': return { bg: 'bg-purple-600', bgLight: 'bg-purple-50', text: 'text-purple-600', textDark: 'text-purple-800', border: 'border-purple-200', ring: 'focus:ring-purple-200', shadow: 'shadow-purple-200', custom: null };
            case 'emerald': return { bg: 'bg-emerald-600', bgLight: 'bg-emerald-50', text: 'text-emerald-600', textDark: 'text-emerald-800', border: 'border-emerald-200', ring: 'focus:ring-emerald-200', shadow: 'shadow-emerald-200', custom: null };
            case 'orange': return { bg: 'bg-orange-600', bgLight: 'bg-orange-50', text: 'text-orange-600', textDark: 'text-orange-800', border: 'border-orange-200', ring: 'focus:ring-orange-200', shadow: 'shadow-orange-200', custom: null };
            default: return { bg: 'bg-blue-600', bgLight: 'bg-blue-50', text: 'text-blue-600', textDark: 'text-blue-800', border: 'border-blue-200', ring: 'focus:ring-blue-200', shadow: 'shadow-blue-200', custom: null };
        }
    };

    const theme = getThemeStyles(schoolConfig?.color || 'blue');

    const adminMenuItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Students', icon: Users },
        { name: 'Teachers', icon: GraduationCap },
        { name: 'Timetable', icon: Clock },
        { name: 'Attendance', icon: Calendar },
        { name: 'Fees', icon: Banknote },
        { name: 'Feeding', icon: Utensils },
        { name: 'Exam', icon: FileText },
        { name: 'Classes', icon: Layers },
        { name: 'Analytics', icon: BarChart2 },
        { name: 'Notice', icon: Bell },
        { name: 'Help center', icon: HelpCircle },
        { name: 'Settings', icon: SettingsIcon },
    ];

    const teacherMenuItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Timetable', icon: Clock },
        { name: 'My Students', icon: Users },
        { name: 'Attendance', icon: Calendar },
        { name: 'Mark Entry & Reports', icon: FileText },
        { name: 'Notice Board', icon: Bell },
        { name: 'Settings & Profile', icon: SettingsIcon },
    ];

    const currentMenuItems = (currentUser.role === 'admin' ? adminMenuItems : teacherMenuItems)
        .filter(item => !hiddenMenuItems.includes(item.name) || item.name === 'Settings' || item.name === 'Dashboard' || item.name === 'Settings & Profile');


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                    <p
                        className={`${theme.text} font-bold`}
                        style={theme.custom ? { color: theme.custom.text } : {}}
                    >
                        {formatAmount(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const renderContent = () => {
        if (currentUser.role === 'teacher') {
            switch (activeMenu) {
                case 'Dashboard': return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} recentNotices={recentNotices} />;
                case 'Timetable': return <Timetable currentUser={currentUser} />;
                case 'My Students': return <Students currentUser={currentUser} />;
                case 'Attendance': return <Attendance currentUser={currentUser} />;
                case 'Mark Entry & Reports': return <Exams currentUser={currentUser} />;
                case 'Notice Board': return <Communication currentUser={currentUser} />;
                case 'Settings & Profile': return <Settings onConfigUpdate={() => queryClient.invalidateQueries({ queryKey: ['schoolConfig'] })} currentUser={currentUser} hiddenMenuItems={hiddenMenuItems} toggleHiddenMenu={toggleHiddenMenu} availableMenus={teacherMenuItems} />;
                default: return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} recentNotices={recentNotices} />;
            }
        }
        switch (activeMenu) {
            case 'Students': return <Students currentUser={currentUser} />;
            case 'Teachers': return <Teachers currentUser={currentUser} />;
            case 'Timetable': return <Timetable currentUser={currentUser} />;
            case 'Attendance': return <Attendance currentUser={currentUser} />;
            case 'Fees': return <Fees currentUser={currentUser} />;
            case 'Feeding': return <Feeding currentUser={currentUser} />;
            case 'Exam': return <Exams currentUser={currentUser} />;
            case 'Classes': return <Courses currentUser={currentUser} />;
            case 'Analytics': return <Analytics currentUser={currentUser} />;
            case 'Notice': return <Communication currentUser={currentUser} />;
            case 'Help center': return <HelpCenter currentUser={currentUser} />;
            case 'Settings': return <Settings onConfigUpdate={() => queryClient.invalidateQueries({ queryKey: ['schoolConfig'] })} currentUser={currentUser} hiddenMenuItems={hiddenMenuItems} toggleHiddenMenu={toggleHiddenMenu} availableMenus={adminMenuItems} />;
            default: return (
                <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Dashboard Overview</h1>
                        <p className="text-slate-500 text-xs md:text-sm">Welcome to {schoolConfig?.name || 'Base16'}</p>
                    </div>
                    {/* Stats Cards - Grid optimized for mobile (2cols) vs desktop (4cols) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                        {[
                            { label: 'Total Students', value: stats.students, icon: GraduationCap },
                            { label: 'Teachers', value: stats.teachers, icon: Users },
                            { label: 'Classes', value: stats.classes, icon: Layers },
                            { label: 'Term Revenue', value: formatAmount(stats.revenue), icon: Banknote, isWide: true }
                        ].map((item, idx) => (
                            <div key={idx} className={`bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 hover:shadow-md transition-shadow ${item.isWide ? 'col-span-2 lg:col-span-1' : ''}`}>
                                <div
                                    className={`p-2.5 md:p-4 rounded-lg md:rounded-xl ${theme.bgLight} ${theme.text}`}
                                    style={theme.custom ? { backgroundColor: theme.custom.bgLight, color: theme.custom.text } : {}}
                                >
                                    <item.icon className="h-5 w-5 md:h-6 md:w-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-slate-500 text-[10px] md:text-sm font-medium whitespace-nowrap">{item.label}</p>
                                    <h3 className="text-lg md:text-2xl font-bold text-slate-800 break-words">{item.value}</h3>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                        {/* Revenue Chart */}
                        <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4 md:mb-6">
                                <h3 className="font-bold text-sm md:text-base text-slate-800">Revenue Trend</h3>
                            </div>
                            <div className="h-48 md:h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={financialHistory}>
                                        <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={theme.custom ? theme.custom.bg : "#2563eb"} stopOpacity={0.1} /><stop offset="95%" stopColor={theme.custom ? theme.custom.bg : "#2563eb"} stopOpacity={0} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value) => value >= 1000 ? `${currency.symbol}${(value / 1000).toFixed(0)}k` : `${currency.symbol}${value}`} width={35} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="collected" stroke={theme.custom ? theme.custom.bg : "#2563eb"} strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* Student Composition */}
                        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-sm md:text-base text-slate-800 mb-4 md:mb-6">Student Composition</h3>
                            <div className="flex justify-center mb-6 md:mb-8 relative">
                                <div className="relative h-32 w-32 md:h-48 md:w-48">
                                    <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
                                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" />
                                        <path className="text-blue-500" strokeDasharray={`${stats.students > 0 ? (stats.boys / stats.students) * 100 : 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
                                        <path className="text-pink-500" strokeDasharray={`${stats.students > 0 ? (stats.girls / stats.students) * 100 : 0}, 100`} strokeDashoffset={`-${stats.students > 0 ? (stats.boys / stats.students) * 100 : 0}`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xl md:text-3xl font-bold text-slate-800">{stats.students}</span>
                                        <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider">Total</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 md:space-y-4">
                                <div className="flex justify-between items-center p-2.5 md:p-3 bg-blue-50 rounded-lg md:rounded-xl">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-blue-500"></div>
                                        <span className="text-xs md:text-sm font-medium text-slate-700">Boys</span>
                                    </div>
                                    <span className="font-bold text-sm md:text-base text-slate-800">{stats.boys}</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 md:p-3 bg-pink-50 rounded-lg md:rounded-xl">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-pink-500"></div>
                                        <span className="text-xs md:text-sm font-medium text-slate-700">Girls</span>
                                    </div>
                                    <span className="font-bold text-sm md:text-base text-slate-800">{stats.girls}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    };

    if (subscriptionStatus === 'suspended') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="h-10 w-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Suspended</h1>
                    <p className="text-slate-600 mb-6">
                        Your subscription payment is overdue by more than 7 days. Access to the dashboard has been temporarily locked.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-left">
                        <p className="text-sm font-bold text-slate-700 mb-1">How to reactivate:</p>
                        <p className="text-sm text-slate-500">Please contact the administration to settle your outstanding invoice. Once payment is verified, your account will be instantly reactivated.</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut className="h-4 w-4" /> Logout
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 flex-col md:flex-row">
            {/* Warning Banner */}
            {subscriptionStatus === 'warning' && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-center font-bold text-sm flex items-center justify-center gap-2 shadow-md">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                        Action Required: Your subscription is overdue by {daysOverdue} days. System access will be suspended in {7 - daysOverdue} days.
                    </span>
                </div>
            )}
            <aside className={`w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed h-full z-10 ${subscriptionStatus === 'warning' ? 'mt-9' : ''}`}>
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div
                        className={`h-10 w-10 rounded-xl ${theme.bg} flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200`}
                        style={theme.custom ? { backgroundColor: theme.custom.bg, boxShadow: `0 10px 15px -3px ${theme.custom.shadow}` } : {}}
                    >
                        {schoolConfig?.logo ? <img src={schoolConfig.logo} alt="Logo" className="h-full w-full object-cover rounded-xl" /> : (schoolConfig?.name?.[0] || 'O')}
                    </div>
                    <div><h1 className="font-bold text-lg text-slate-800 tracking-tight">{schoolConfig?.name || 'Base16'}</h1><p className="text-xs text-slate-400 font-medium">School Management</p></div>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    {currentMenuItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveMenu(item.name)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeMenu === item.name ? `${theme.bg} text-white shadow-md shadow-blue-200` : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                            style={activeMenu === item.name && theme.custom ? { backgroundColor: theme.custom.bg, boxShadow: `0 4px 6px -1px ${theme.custom.shadow}` } : {}}
                        >
                            <item.icon className={`h-5 w-5 ${activeMenu === item.name ? 'text-white' : 'text-slate-400'}`} />
                            {item.name}
                        </button>
                    ))}
                    <div className="pt-4 mt-4 border-t border-slate-100"><button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"><LogOut className="h-5 w-5" /> Logout</button></div>
                </nav>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 z-40 flex overflow-x-auto hide-scrollbar items-center px-2 ${isImpersonating ? 'mb-14' : ''}`}>
                <div className="flex w-full items-center gap-1 min-w-max px-2">
                    {currentMenuItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveMenu(item.name)}
                            className={`flex flex-col items-center justify-center gap-1 min-w-[70px] p-2 rounded-xl transition-all ${activeMenu === item.name ? `${theme.text} bg-blue-50` : 'text-slate-400'}`}
                            style={activeMenu === item.name && theme.custom ? { color: theme.custom.text, backgroundColor: theme.custom.bgLight } : {}}
                        >
                            <item.icon className={`h-6 w-6 ${activeMenu === item.name ? 'scale-110' : ''} transition-transform`} />
                            <span className="text-[10px] font-bold whitespace-nowrap">{item.name}</span>
                        </button>
                    ))}
                    <button
                        onClick={onLogout}
                        className="flex flex-col items-center justify-center gap-1 min-w-[70px] p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="h-6 w-6" />
                        <span className="text-[10px] font-bold whitespace-nowrap">Logout</span>
                    </button>
                </div>
            </nav>
            <main className={`flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative ${subscriptionStatus === 'warning' ? 'mt-9' : ''}`}>
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
                    <div className="flex items-center gap-4 md:hidden">
                        <div
                            className={`h-8 w-8 rounded-lg ${theme.bg} flex items-center justify-center text-white font-bold`}
                            style={theme.custom ? { backgroundColor: theme.custom.bg } : {}}
                        >{schoolConfig?.name?.[0] || 'O'}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search students, teachers, or records..."
                                className={`w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-sm ${theme.ring}`}
                                style={theme.custom ? { '--tw-ring-color': theme.custom.ring } as React.CSSProperties : {}}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <Bell className="h-5 w-5" />
                            {recentNotices.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                        </button>
                        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-800">{currentUser.name}</p>
                                <p className="text-xs text-slate-500 font-medium capitalize">{currentUser.role}</p>
                            </div>
                            <div
                                className={`h-10 w-10 rounded-full ${theme.bgLight} flex items-center justify-center border-2 ${theme.border} shadow-sm`}
                                style={theme.custom ? { backgroundColor: theme.custom.bgLight, borderColor: theme.custom.border } : {}}
                            >
                                <span
                                    className={`${theme.text} font-bold text-lg`}
                                    style={theme.custom ? { color: theme.custom.text } : {}}
                                >{currentUser?.name?.charAt(0) || 'U'}</span>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-24 md:pb-8">
                    {loading && !stats.students ? (
                        <Loading type="skeleton" fullScreen={false} />
                    ) : (
                        renderContent()
                    )}
                </div>
            </main>

            {/* Welcome Modal */}
            {showWelcomeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="relative h-32 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                            <div className="absolute top-4 right-4">
                                <button onClick={() => setShowWelcomeModal(false)} className="text-white/70 hover:text-white transition-colors bg-white/10 p-1 rounded-full backdrop-blur-sm">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="text-center">
                                <div className="bg-white p-3 rounded-full inline-block shadow-lg mb-2">
                                    <span className="text-3xl">🚀</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white">Welcome to Base16!</h2>
                            </div>
                        </div>
                        <div className="p-8 text-center">
                            <p className="text-slate-600 mb-6 leading-relaxed">
                                Your school account has been successfully approved and activated! 🎉
                                <br /><br />
                                To help you get started, we've prepared a comprehensive User Manual in the Help Center.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => { setShowWelcomeModal(false); setActiveMenu('Help center'); }}
                                    className="block w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                                >
                                    Open User Manual
                                </button>
                                <button
                                    onClick={() => setShowWelcomeModal(false)}
                                    className="block w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    I'll explore on my own
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Impersonation Banner */}
            {isImpersonating && (
                <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-3 z-50 flex justify-between items-center shadow-lg animate-in slide-in-from-bottom-full duration-300">
                    <div className="flex items-center gap-3 px-4">
                        <div className="bg-white/20 p-1.5 rounded-full animate-pulse">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Super Admin Mode</p>
                            <p className="text-xs text-red-100">You are viewing {schoolConfig?.name || 'this school'} as {currentUser.name}.</p>
                        </div>
                    </div>
                    <button
                        onClick={onExitImpersonation}
                        className="bg-white text-red-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors mr-4 shadow-sm"
                    >
                        Exit Mode
                    </button>
                </div>
            )}
        </div>
    );
};

export default Dashboard;