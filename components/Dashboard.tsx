import React, { useEffect, useState } from 'react';
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
    Clock,
    CheckCircle,
    Megaphone
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
import { supabase } from '../utils/supabaseClient';

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
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, currentUser }) => {
    const [schoolConfig, setSchoolConfig] = useState<any>(null);
    const [activeMenu, setActiveMenu] = useState('Dashboard');

    // Real Data State
    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        classes: 0,
        revenue: 0,
        boys: 0,
        girls: 0
    });
    const [financialHistory, setFinancialHistory] = useState<any[]>([]);

    // Header State
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [recentNotices, setRecentNotices] = useState<any[]>([]);

    const loadConfig = async () => {
        if (!currentUser.school_id) return;

        const { data: school } = await supabase
            .from('schools')
            .select('*')
            .eq('id', currentUser.school_id)
            .single();

        if (school) {
            setSchoolConfig({
                name: school.name,
                motto: school.motto,
                logo: school.logo_url,
                color: school.theme_color || 'blue'
            });
        }
    };

    const fetchDashboardData = async () => {
        if (!currentUser.school_id) return;

        try {
            // 1. Counts
            const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id);
            const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('role', 'teacher');
            const { count: classCount } = await supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id);

            // 2. Gender Stats
            const { count: boysCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('gender', 'Male');
            const { count: girlsCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('gender', 'Female');

            // 3. Financials (Revenue)
            // Fetch transactions for this term/semester. For now, just fetch all 'income' type transactions.
            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount, date, type')
                .eq('school_id', currentUser.school_id)
                .eq('type', 'tuition_payment'); // Assuming this is the type for revenue

            const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

            // 4. Financial History (Group by Month)
            // Mocking history based on total revenue for now, or processing transactions
            const historyMap = new Map();
            transactions?.forEach(t => {
                const date = new Date(t.date);
                const month = date.toLocaleString('default', { month: 'short' });
                historyMap.set(month, (historyMap.get(month) || 0) + t.amount);
            });

            // Fill in last 6 months
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const m = d.toLocaleString('default', { month: 'short' });
                months.push({ month: m, collected: historyMap.get(m) || 0 });
            }

            setStats({
                students: studentCount || 0,
                teachers: teacherCount || 0,
                classes: classCount || 0,
                revenue: totalRevenue,
                boys: boysCount || 0,
                girls: girlsCount || 0
            });

            setFinancialHistory(months);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    };

    const fetchNotices = async () => {
        if (!currentUser.school_id) return;
        const { data } = await supabase
            .from('notices')
            .select('*')
            .eq('school_id', currentUser.school_id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (data) {
            setRecentNotices(data.map(n => ({
                id: n.id,
                title: n.title,
                message: n.content,
                priority: n.type === 'Urgent' ? 'Urgent' : 'Normal',
                date: new Date(n.created_at).toLocaleDateString()
            })));
        }
    };

    useEffect(() => {
        loadConfig();
        fetchDashboardData();
        fetchNotices();
    }, [currentUser]);

    const getThemeStyles = () => {
        const color = schoolConfig?.color || 'blue';
        switch (color) {
            case 'maroon': return {
                bgLight: 'bg-red-50',
                bg: 'bg-red-800',
                text: 'text-red-800',
                textDark: 'text-red-900',
                border: 'border-red-200',
                ring: 'focus:ring-red-100',
                shadow: 'shadow-red-900/20'
            };
            case 'green': return {
                bgLight: 'bg-green-50',
                bg: 'bg-green-600',
                text: 'text-green-600',
                textDark: 'text-green-700',
                border: 'border-green-200',
                ring: 'focus:ring-green-100',
                shadow: 'shadow-green-900/20'
            };
            case 'purple': return {
                bgLight: 'bg-purple-50',
                bg: 'bg-purple-600',
                text: 'text-purple-600',
                textDark: 'text-purple-700',
                border: 'border-purple-200',
                ring: 'focus:ring-purple-100',
                shadow: 'shadow-purple-900/20'
            };
            case 'orange': return {
                bgLight: 'bg-orange-50',
                bg: 'bg-orange-600',
                text: 'text-orange-600',
                textDark: 'text-orange-700',
                border: 'border-orange-200',
                ring: 'focus:ring-orange-100',
                shadow: 'shadow-orange-900/20'
            };
            default: return {
                bgLight: 'bg-blue-50',
                bg: 'bg-blue-600',
                text: 'text-blue-600',
                textDark: 'text-blue-700',
                border: 'border-blue-200',
                ring: 'focus:ring-blue-100',
                shadow: 'shadow-blue-900/20'
            };
        }
    };

    const theme = getThemeStyles();

    const adminMenuItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Students', icon: Users },
        { name: 'Teachers', icon: GraduationCap },
        { name: 'Fees', icon: Banknote },
        { name: 'Exam', icon: FileText },
        { name: 'Classes', icon: Layers },
        { name: 'Analytics', icon: BarChart2 },
        { name: 'Notice', icon: Bell },
        { name: 'Help center', icon: HelpCircle },
        { name: 'Settings', icon: SettingsIcon },
    ];

    const teacherMenuItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'My Students', icon: Users },
        { name: 'Mark Entry & Reports', icon: FileText },
        { name: 'Notice Board', icon: Bell },
        { name: 'Settings & Profile', icon: SettingsIcon },
    ];

    const currentMenuItems = currentUser.role === 'admin' ? adminMenuItems : teacherMenuItems;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                    <p className={`${theme.text} font-bold`}>
                        ₵{payload[0].value.toLocaleString()}
                    </p>
                </div>
            );
        }
        return null;
    };

    // --- COMPONENT RENDERER ---
    const renderContent = () => {
        // 1. TEACHER ROUTES
        if (currentUser.role === 'teacher') {
            switch (activeMenu) {
                case 'Dashboard':
                    return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} recentNotices={recentNotices} />;
                case 'My Students':
                    return <Students currentUser={currentUser} />;
                case 'Mark Entry & Reports':
                    return <Exams currentUser={currentUser} />;
                case 'Notice Board':
                    return <Communication currentUser={currentUser} />;
                case 'Settings & Profile':
                    return <Settings onConfigUpdate={loadConfig} currentUser={currentUser} />;
                default:
                    return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} recentNotices={recentNotices} />;
            }
        }

        // 2. ADMIN ROUTES
        switch (activeMenu) {
            case 'Students': return <Students />;
            case 'Teachers': return <Teachers />;
            case 'Fees': return <Fees />;
            case 'Exam': return <Exams currentUser={currentUser} />;
            case 'Classes': return <Courses />;
            case 'Analytics': return <Analytics currentUser={currentUser} />;
            case 'Notice': return <Communication currentUser={currentUser} />;
            case 'Help center': return <HelpCenter currentUser={currentUser} />;
            case 'Settings': return <Settings onConfigUpdate={loadConfig} currentUser={currentUser} />;
            default:
                return (
                    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
                            <p className="text-slate-500 text-sm">Welcome to {schoolConfig?.name || 'Orbit'}</p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.text}`}>
                                    <GraduationCap className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">Total Students</p>
                                    <h3 className="text-2xl font-bold text-slate-800">{stats.students}</h3>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.text}`}>
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">Teachers</p>
                                    <h3 className="text-2xl font-bold text-slate-800">{stats.teachers}</h3>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.text}`}>
                                    <Banknote className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">Term Revenue</p>
                                    <h3 className="text-2xl font-bold text-slate-800">₵{stats.revenue.toLocaleString()}</h3>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.text}`}>
                                    <Layers className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">Classes</p>
                                    <h3 className="text-2xl font-bold text-slate-800">{stats.classes}</h3>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Revenue Chart */}
                            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-slate-800">Revenue Trend</h3>
                                    <select className="bg-slate-50 border-none text-sm text-slate-600 rounded-lg p-2 focus:ring-0 cursor-pointer hover:bg-slate-100 transition-colors">
                                        <option>Last 6 Months</option>
                                        <option>This Year</option>
                                    </select>
                                </div>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={financialHistory}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => value >= 1000 ? `₵${(value / 1000).toFixed(1)}k` : `₵${value}`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="collected" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Student Composition */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-800 mb-6">Student Composition</h3>
                                <div className="flex justify-center mb-8 relative">
                                    <div className="relative h-48 w-48">
                                        <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
                                            {/* Background Circle */}
                                            <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" />
                                            {/* Boys Circle (Blue) */}
                                            <path className="text-blue-500" strokeDasharray={`${stats.students > 0 ? (stats.boys / stats.students) * 100 : 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
                                            {/* Girls Circle (Pink) - Offset by Boys % */}
                                            <path className="text-pink-500" strokeDasharray={`${stats.students > 0 ? (stats.girls / stats.students) * 100 : 0}, 100`} strokeDashoffset={`-${stats.students > 0 ? (stats.boys / stats.students) * 100 : 0}`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-bold text-slate-800">{stats.students}</span>
                                            <span className="text-xs text-slate-500 uppercase tracking-wider">Total</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                            <span className="text-sm font-medium text-slate-700">Boys</span>
                                        </div>
                                        <span className="font-bold text-slate-800">{stats.boys}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-pink-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3 w-3 rounded-full bg-pink-500"></div>
                                            <span className="text-sm font-medium text-slate-700">Girls</span>
                                        </div>
                                        <span className="font-bold text-slate-800">{stats.girls}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Admit Student', icon: Users, color: 'bg-blue-600', action: () => setActiveMenu('Students') },
                                { label: 'Collect Fees', icon: Banknote, color: 'bg-emerald-600', action: () => setActiveMenu('Fees') },
                                { label: 'Add Expense', icon: ArrowUpRight, color: 'bg-orange-600', action: () => setActiveMenu('Analytics') },
                                { label: 'Full Report', icon: FileText, color: 'bg-purple-600', action: () => setActiveMenu('Exam') },
                            ].map((action, i) => (
                                <button
                                    key={i}
                                    onClick={action.action}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col items-center gap-3 group"
                                >
                                    <div className={`p-3 rounded-full ${action.color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">{action.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            {/* --- SIDEBAR --- */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col h-full shadow-sm z-30">
                <div className="h-20 flex items-center px-8 border-b border-slate-100">
                    <div className={`h-10 w-10 ${theme.bg} rounded-xl flex items-center justify-center shadow-lg ${theme.shadow} mr-3`}>
                        {schoolConfig?.logo ? (
                            <img src={schoolConfig.logo} alt="Logo" className="h-6 w-6 object-contain" />
                        ) : (
                            <LayoutDashboard className="h-6 w-6 text-white" />
                        )}
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-slate-800 tracking-tight">{schoolConfig?.name || 'Orbit'}</h1>
                        <p className="text-xs text-slate-500">{schoolConfig?.motto || 'School Management'}</p>
                    </div>
                </div>

                <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
                    {currentMenuItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveMenu(item.name)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeMenu === item.name
                                ? `${theme.bgLight} ${theme.textDark} font-bold shadow-sm`
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <item.icon className={`h-5 w-5 ${activeMenu === item.name ? theme.text : 'text-slate-400 group-hover:text-slate-600'}`} />
                            <span>{item.name}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 md:ml-0 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-20 flex-shrink-0">
                    <div className="flex items-center">
                        <h2 className="text-xl font-bold text-slate-800 hidden sm:block">
                            Welcome Back, {(currentUser.name || 'User').split(' ')[0]} 👋
                        </h2>
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* Search */}
                        <div className="relative hidden lg:block">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none w-64 text-slate-600"
                            />
                        </div>

                        {/* Icons */}
                        <div className="flex items-center space-x-4">

                            {/* Notification Bell */}
                            <div className="relative">
                                <button
                                    onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsProfileOpen(false); }}
                                    className="relative p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-500 transition-colors outline-none"
                                >
                                    <Bell className="h-5 w-5" />
                                    {recentNotices.length > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>}
                                </button>

                                {/* Dropdown */}
                                {isNotificationsOpen && (
                                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase">Notifications</h3>
                                            <button
                                                className="text-xs text-blue-600 cursor-pointer hover:underline font-medium"
                                                onClick={() => { setActiveMenu(currentUser.role === 'admin' ? 'Notice' : 'Notice Board'); setIsNotificationsOpen(false); }}
                                            >
                                                View All
                                            </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto">
                                            {recentNotices.length > 0 ? recentNotices.map((notice: any) => (
                                                <div
                                                    key={notice.id}
                                                    className="p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                                                    onClick={() => { setActiveMenu(currentUser.role === 'admin' ? 'Notice' : 'Notice Board'); setIsNotificationsOpen(false); }}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${notice.priority === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {notice.priority}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">{notice.date}</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{notice.title}</p>
                                                    <p className="text-xs text-slate-500 line-clamp-2">{notice.message}</p>
                                                </div>
                                            )) : (
                                                <div className="p-8 text-center text-slate-400 text-sm">No new notifications</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Profile Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotificationsOpen(false); }}
                                    className={`h-10 w-10 bg-slate-100 rounded-full overflow-hidden border border-slate-200 focus:ring-2 ${theme.ring} transition-all outline-none`}
                                >
                                    {currentUser?.photo ? (
                                        <img src={currentUser.photo} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className={`h-full w-full flex items-center justify-center ${theme.bgLight} ${theme.textDark} font-bold`}>
                                            {(currentUser?.name || 'U').charAt(0)}
                                        </div>
                                    )}
                                </button>

                                {/* Dropdown */}
                                {isProfileOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                            <p className="font-bold text-slate-800 text-sm truncate">{currentUser?.name || 'User'}</p>
                                            <p className="text-xs text-slate-500 capitalize">{currentUser?.role}</p>
                                        </div>
                                        <div className="p-1">
                                            {currentUser.role === 'admin' && (
                                                <button
                                                    onClick={() => { setActiveMenu('Settings'); setIsProfileOpen(false); }}
                                                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                                                >
                                                    <SettingsIcon className="h-4 w-4" /> Settings
                                                </button>
                                            )}
                                            <button
                                                onClick={onLogout}
                                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <LogOut className="h-4 w-4" /> Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-slate-50">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

// --- Sub-component: Teacher Dashboard Home ---
const TeacherDashboardHome = ({ currentUser, setActiveMenu, recentNotices }: { currentUser: any, setActiveMenu: (m: string) => void, recentNotices: any[] }) => {
    // Mock Counts based on the prompt
    const pendingMarks = 3;
    const approvalCount = 1;
    const latestNotice = recentNotices && recentNotices.length > 0 ? recentNotices[0] : null;
    const assignedClasses = currentUser.classes || [currentUser.assignedClass || 'No Classes Assigned'];

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Teacher Dashboard</h1>
                <p className="text-slate-500 text-sm">Overview for {currentUser.name}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* CARD A: Pending Marks */}
                <div
                    onClick={() => setActiveMenu('Mark Entry & Reports')}
                    className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-50 rounded-xl text-red-600 group-hover:bg-red-100 transition-colors">
                            <ClipboardList className="h-8 w-8" />
                        </div>
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full animate-pulse">Action Needed</span>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-800 mb-1">{pendingMarks}</h3>
                    <p className="font-bold text-slate-700">Subjects Need Scores</p>
                    <p className="text-xs text-slate-500 mt-2">Deadline approaching for Term 1</p>
                </div>

                {/* CARD B: Submitted for Approval */}
                <div
                    onClick={() => setActiveMenu('Mark Entry & Reports')}
                    className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors">
                            <CheckCircle className="h-8 w-8" />
                        </div>
                        <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">In Review</span>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-800 mb-1">{approvalCount}</h3>
                    <p className="font-bold text-slate-700">Report Awaiting Review</p>
                    <p className="text-xs text-slate-500 mt-2">Submitted to Admin</p>
                </div>

                {/* CARD C: Your Classes */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <Layers className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-slate-800">Your Classes</h3>
                    </div>
                    <ul className="space-y-3">
                        {assignedClasses.map((cls: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                {cls}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* CARD D: Latest Notice */}
            {latestNotice && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-4">
                    <div className="bg-white p-2 rounded-full shadow-sm text-orange-500 flex-shrink-0">
                        <Megaphone className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-orange-800 text-lg mb-1">Latest Notice: {latestNotice.title}</h3>
                        <p className="text-orange-900 font-medium">{latestNotice.message}</p>
                        <p className="text-orange-700/70 text-xs mt-1">Posted by Admin • {latestNotice.date}</p>
                    </div>
                </div>
            )}
            {!latestNotice && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex items-start gap-4">
                    <div className="bg-white p-2 rounded-full shadow-sm text-slate-500 flex-shrink-0">
                        <Megaphone className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1">No New Notices</h3>
                        <p className="text-slate-700 font-medium">There are no new notices at the moment.</p>
                        <p className="text-slate-500/70 text-xs mt-1">Check back later for updates.</p>
                    </div>
                </div>
            )}

        </div>
    );
}

export default Dashboard;