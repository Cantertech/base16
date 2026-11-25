import React, { useEffect, useState, lazy, Suspense } from 'react';
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
    Utensils,
    History,
    ChevronRight,
    Download,
    UserCheck,
    Sparkles,
    Zap,
    Bot,
    Send,
    CreditCard,
    Plus,
    RefreshCw,
    Minimize2,
    Trash2
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
const Students = lazy(() => import('./Students'));
const Teachers = lazy(() => import('./Teachers'));
const Fees = lazy(() => import('./Fees'));
const Exams = lazy(() => import('./Exams'));
const Courses = lazy(() => import('./Courses'));
const Analytics = lazy(() => import('./Analytics'));
const Communication = lazy(() => import('./Communication'));
const HelpCenter = lazy(() => import('./HelpCenter'));
const Settings = lazy(() => import('./Settings'));
const Attendance = lazy(() => import('./Attendance'));
const Timetable = lazy(() => import('./Timetable'));
const Feeding = lazy(() => import('./Feeding'));
const MyPayroll = lazy(() => import('./MyPayroll'));
const ModuleLockGate = lazy(() => import('./ModuleLockGate'));
import Loading from './Loading';
import { supabase } from '../utils/supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useInstall } from '../contexts/InstallContext';


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

const TeacherDashboardHome = ({ currentUser, setActiveMenu, recentNotices, assignments = [] }: any) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Welcome back, {currentUser.name}!</h1>
                    <p className="text-blue-100 mb-6 max-w-xl">Ready to inspire your students today? You have {assignments.length || 0} active class assignments to manage.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setActiveMenu('Mark Entry & Reports')} className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-sm text-sm">Enter Marks</button>
                        <button onClick={() => setActiveMenu('My Students')} className="bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm text-sm">View Students</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Assignments Section */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Layers className="h-6 w-6" /></div>
                            <div>
                                <h3 className="font-bold text-slate-800">My Assignments</h3>
                                <p className="text-xs text-slate-500">Classes and subjects assigned to you</p>
                            </div>
                        </div>
                    </div>
                    {assignments.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {assignments.map((assignment: any, idx: number) => (
                                <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-150 hover:border-blue-200 hover:shadow-md transition-all group flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs font-black text-slate-800 shadow-xs">
                                                {assignment.className}
                                            </div>
                                            {assignment.isClassTeacher ? (
                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-200 shadow-xs">
                                                    ★ Class Teacher
                                                </span>
                                            ) : (
                                                <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-blue-200 shadow-xs">
                                                    Subject Teacher
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-base mb-1 group-hover:text-blue-600 transition-colors">
                                            {assignment.isClassTeacher 
                                                ? (assignment.subjectName ? `${assignment.subjectName} (Class Lead)` : 'Class Lead (All Subjects)')
                                                : (assignment.subjectName || 'Assigned Subject')}
                                        </h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            {assignment.isClassTeacher
                                                ? 'Full access to all subjects, terminal remarks, attendance & class standings.'
                                                : `Mark entry permissions for ${assignment.subjectName || 'your assigned subject'}.`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 mt-5 pt-3 border-t border-slate-200/60">
                                        <button onClick={() => setActiveMenu('Mark Entry & Reports')} className="text-xs font-black text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider">
                                            ENTER MARKS →
                                        </button>
                                        {assignment.isClassTeacher && (
                                            <button onClick={() => setActiveMenu('Attendance')} className="text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors uppercase tracking-wider">
                                                ATTENDANCE
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-500">No classes assigned yet.</p>
                            <p className="text-xs text-slate-400 mt-1">Contact your admin to assign classes to your profile.</p>
                        </div>
                    )}
                </div>

                {/* Notices Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Bell className="h-6 w-6" /></div>
                        <h3 className="font-bold text-slate-800">School Notices</h3>
                    </div>
                    <div className="space-y-4">
                        {recentNotices.length > 0 ? recentNotices.slice(0, 3).map((n: any) => (
                            <div key={n.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveMenu('Notice Board')}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${n.priority === 'Urgent' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{n.priority}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{new Date(n.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{n.title}</p>
                            </div>
                        )) : (
                            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-xs text-slate-400 italic">No recent notices.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onLogout, currentUser, isImpersonating, onExitImpersonation }) => {
    const queryClient = useQueryClient();
    const { formatAmount, currency } = useCurrency();
    const { isInstallable, showInstallPrompt } = useInstall();
    const [activeMenu, setActiveMenu] = useState('Dashboard');

    // Sidebar Customization State
    const [hiddenMenuItems, setHiddenMenuItems] = useState<string[]>([]);
    useEffect(() => {
        try {
            const saved = localStorage.getItem('base16_hidden_menus');
            if (saved) setHiddenMenuItems(JSON.parse(saved));
        } catch (e) { console.error('Error loading menu prefs', e); }
    }, []);

    const toggleHiddenMenu = (name: string) => {
        const newHidden = hiddenMenuItems.includes(name)
            ? hiddenMenuItems.filter(i => i !== name)
            : [...hiddenMenuItems, name];
        setHiddenMenuItems(newHidden);
        localStorage.setItem('base16_hidden_menus', JSON.stringify(newHidden));
    };

    // Welcome Modal State
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    // Notifications Dropdown State
    const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

    // Global Search State
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Profile Dropdown State
    const [showProfileMenu, setShowProfileMenu] = useState(false);

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

            if (school) {
                // If academic_year or current_term is missing on school, check academic_terms table
                let term = school.current_term;
                let year = school.academic_year;

                if (!term || !year) {
                    const { data: activeTerm } = await supabase
                        .from('academic_terms')
                        .select('term, academic_year')
                        .eq('school_id', currentUser.school_id)
                        .eq('is_current', true)
                        .maybeSingle();

                    if (activeTerm) {
                        term = term || activeTerm.term;
                        year = year || activeTerm.academic_year;
                    }
                }

                const currentYearNum = new Date().getFullYear();
                const defaultYear = `${currentYearNum}/${currentYearNum + 1}`;

                const config = {
                    name: school.name,
                    motto: school.motto,
                    logo: school.logo_url,
                    color: school.brand_color || school.theme_color || 'blue',
                    next_payment_due: school.next_payment_due,
                    current_term: term || 'First Term',
                    academic_year: year || defaultYear,
                    teachers_can_collect_feeding: school.teachers_can_collect_feeding || false,
                    feeding_fee_amount: school.feeding_fee_amount || 5,
                    report_card_config: school.report_card_config,
                    status: school.status || 'active',
                    created_at: school.created_at,
                    wallet_balance: school.wallet_balance || 0,
                    email: school.email || ''
                };
                // Cache the config to prevent flashing on reload
                localStorage.setItem(`base16_school_config_${currentUser.school_id}`, JSON.stringify(config));
                return config;
            }
            return null;
        },
        initialData: () => {
            // Try to load from cache immediately to prevent theme flash
            try {
                const saved = localStorage.getItem(`base16_school_config_${currentUser.school_id}`);
                return saved ? JSON.parse(saved) : undefined;
            } catch (e) {
                return undefined;
            }
        },
        enabled: !!currentUser.school_id
    });

    // 1.2 Active Subscription Query
    const { data: activeSub } = useQuery({
        queryKey: ['activeSubscription', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return null;
            const { data } = await supabase.from('school_subscriptions').select('*').eq('school_id', currentUser.school_id).maybeSingle();
            return data || null;
        },
        enabled: !!currentUser.school_id
    });

    // 1.3 Free Trial & Module Lock Calculations
    const hasCreatedAt = !!schoolConfig?.created_at;
    const schoolCreatedAt = hasCreatedAt ? new Date(schoolConfig.created_at) : new Date(0);
    const daysSinceCreation = Math.floor((new Date().getTime() - schoolCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const trialDaysLeft = hasCreatedAt ? Math.max(0, 7 - daysSinceCreation) : 0;
    const isTrialActive = hasCreatedAt && trialDaysLeft > 0;

    const isModuleUnlocked = (moduleCode: string) => {
        if (isTrialActive) return true; // All modules unlocked during 7-Day Free Trial!
        const unlocked: string[] = activeSub?.unlocked_modules || [];
        return unlocked.includes(moduleCode) || activeSub?.plan_type === 'full_suite' || activeSub?.plan_type === 'all';
    };

    // 1.5 Global Search Query
    const { data: searchResults = { students: [], teachers: [] } } = useQuery({
        queryKey: ['globalSearch', currentUser.school_id, globalSearchTerm],
        queryFn: async () => {
            if (!globalSearchTerm || globalSearchTerm.length < 2) return { students: [], teachers: [] };

            const [studentsRes, teachersRes] = await Promise.all([
                supabase.from('students').select('id, name, class, gender, photo_url').eq('school_id', currentUser.school_id).ilike('name', `%${globalSearchTerm}%`).limit(5),
                supabase.from('profiles').select('id, full_name, role').eq('school_id', currentUser.school_id).eq('role', 'teacher').ilike('full_name', `%${globalSearchTerm}%`).limit(5)
            ]);

            return {
                students: studentsRes.data || [],
                teachers: teachersRes.data || []
            };
        },
        enabled: globalSearchTerm.length > 1
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
        enabled: !!currentUser.school_id && !!schoolConfig && currentUser.role === 'admin'
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
        enabled: !!currentUser.school_id && currentUser.role === 'admin'
    });

    /* Hide payslips for now
    const { data: hasPayslips = false } = useQuery({
        queryKey: ['checkPayslips', currentUser.id],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('payroll_records')
                .select('*', { count: 'exact', head: true })
                .eq('teacher_id', currentUser.id)
                .eq('status', 'Paid');
            if (error) return false;
            return (count || 0) > 0;
        },
        enabled: currentUser.role === 'teacher'
    });
    */
    const hasPayslips = false; // Forced to false to hide menu

    // 4. Recent Notices / Notifications (master_schema_v1.sql standard)
    const { data: recentNotices = [] } = useQuery({
        queryKey: ['recentNotices', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return [];
            try {
                // 1. Fetch from app_notifications (master_schema_v1.sql)
                const { data: notifications, error } = await supabase
                    .from('app_notifications')
                    .select('*')
                    .eq('school_id', currentUser.school_id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!error && notifications && notifications.length > 0) {
                    return notifications.map((n: any) => ({
                        id: n.id,
                        title: n.title,
                        message: n.message,
                        date: n.created_at ? n.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        priority: n.category === 'Urgent' ? 'Urgent' : 'Normal',
                        audience: n.target_audience || 'All Staff'
                    }));
                }
            } catch (_) {}

            return [];
        },
        enabled: !!currentUser.school_id
    });

    // 5. Active Modules (Full suite enabled for all registered schools)
    const activeModules = ['revenue_guard', 'academic_engine', 'daily_tracker', 'prestige_pack', 'complete_bundle'];

    // 6. AI Operational Intelligence Context
    const { data: aiContext, isLoading: aiLoading, refetch: refetchAiContext } = useQuery({
        queryKey: ['schoolAiContext', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return null;
            try {
                const { data, error } = await supabase.rpc('get_school_ai_context', { p_school_id: currentUser.school_id });
                if (error) {
                    console.warn('get_school_ai_context warning:', error.message);
                    return null;
                }
                return data;
            } catch (err) {
                return null;
            }
        },
        enabled: !!currentUser.school_id && currentUser.role === 'admin'
    });

    // Copilot State (baseAI)
    const [copilotQuery, setCopilotQuery] = useState('');
    const [copilotResponse, setCopilotResponse] = useState<string | null>(null);
    const [isAskingCopilot, setIsAskingCopilot] = useState(false);
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
    const [aiChatMessages, setAiChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
        {
            sender: 'ai',
            text: `👋 Hello! I am **baseAI**, your school intelligence co-pilot. Ask me anything about fees, student attendance, exams, or draft instant SMS announcements.`,
            time: 'Just now'
        }
    ]);

    const handleAskCopilot = async (customPrompt?: string) => {
        const queryText = (customPrompt || copilotQuery).trim();
        if (!queryText) return;

        // Open the pop-up/side panel
        setIsAIPanelOpen(true);

        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setAiChatMessages(prev => [...prev, { sender: 'user', text: queryText, time: currentTime }]);
        setCopilotQuery('');

        setIsAskingCopilot(true);
        setCopilotResponse(null);

        const envAgentUrl = (import.meta as any).env?.VITE_AI_AGENT_URL;
        const agentEndpoint = (envAgentUrl && envAgentUrl.startsWith('https://')) ? envAgentUrl : '/api/chat';

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(agentEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
                },
                body: JSON.stringify({
                    message: queryText,
                    school_id: currentUser.school_id,
                    school_name: schoolConfig?.name || 'Orbit School',
                    current_term: schoolConfig?.current_term || 'First Term',
                    academic_year: schoolConfig?.academic_year || '2025/2026',
                    user_role: currentUser.role
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.response) {
                    setCopilotResponse(data.response);
                    setAiChatMessages(prev => [...prev, {
                        sender: 'ai',
                        text: data.response,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        actions: data.actions || [],
                        smsApproval: data.sms_approval || null
                    }]);
                    setIsAskingCopilot(false);
                    return;
                }
            }
        } catch (err) {
            console.info('FastAPI Agent Endpoint unreachable, executing local smart tool fallback:', err);
        }

        // Local Smart Tool Fallback Engine
        setTimeout(() => {
            const lower = queryText.toLowerCase();
            let reply = '';
            let actions: any[] = [];
            let smsApproval: any = null;

            const currencySym = currency?.symbol || 'GH₵';
            const totalDebt = aiContext?.financials?.total_outstanding_fees ?? topDefaulters.reduce((acc: number, s: any) => acc + (s.balance || 0), 0);
            const debtorCount = aiContext?.financials?.total_debtors ?? topDefaulters.length;
            const topDebtorClass = aiContext?.financials?.classes_owing_most?.[0]?.class || (topDefaulters[0]?.class ?? 'Various classes');

            if (lower === 'hi' || lower === 'hii' || lower === 'hello' || lower === 'hey' || lower.startsWith('hi ') || lower.startsWith('hello ') || lower.startsWith('hey ')) {
                reply = `👋 **Hello! How can I assist you today?**\n\nI am **baseAI**, your intelligent co-pilot for ${schoolConfig?.name || 'Orbit'}.\n\nYou can ask me questions about:\n• **Student Records & Attendance**\n• **Fee Balances & Arrears**\n• **Exam Scores & Class Performance**\n• **Orbit Navigation & System Settings**\n\nOr click any quick shortcut below!`;
                actions = [
                    { label: '⚡ Which class owes most?', menu: 'Fees' },
                    { label: '📱 Draft Fee Reminder SMS', menu: 'Notice' },
                    { label: '📚 Check Exam Marks', menu: 'Exam' }
                ];
            } else if (lower.includes('sms') || lower.includes('draft') || lower.includes('send') || lower.includes('reminder')) {
                reply = `📱 **I have prepared an SMS reminder draft for your approval:**\n\nPlease review the text and recipient group below, then click **Approve & Send** to broadcast.`;
                smsApproval = {
                    action_type: 'sms_approval_request',
                    recipient_group: 'Parents of Owing Students',
                    total_recipients: debtorCount || 10,
                    message_text: `Dear Parent, this is an official reminder from ${schoolConfig?.name || 'Orbit School'}. Please settle your ward's fee balance before terminal examination clearance.`
                };
            } else if (lower.includes('fee') || lower.includes('debt') || lower.includes('owe') || lower.includes('money') || lower.includes('balance')) {
                reply = `📊 **Financial Diagnostic & Arrears Analysis:**\n\n• **Outstanding Balance:** ${currencySym} ${Number(totalDebt).toLocaleString()}\n• **Students in Arrears:** ${debtorCount} students currently have unpaid balances.\n• **Most Affected Class:** **${topDebtorClass}** has the highest fee arrears.\n\n💡 **Executive Recommendation:** Send an instant SMS reminder to parents with outstanding balances before the exam cutoff date.`;
                actions = [
                    { label: '👉 Manage Fees', menu: 'Fees' },
                    { label: '📱 Broadcast SMS', menu: 'Notice' }
                ];
            } else if (lower.includes('exam') || lower.includes('mark') || lower.includes('grade') || lower.includes('academic') || lower.includes('score')) {
                const pendingMarksCount = aiContext?.academics?.pending_mark_submissions?.length || 0;
                const avgScore = averagePerformance || '74.5';
                reply = `📚 **Academic Operations Pulse:**\n\n• **Term Academic Average:** ${avgScore}%\n• **Pending Mark Submissions:** ${pendingMarksCount > 0 ? `${pendingMarksCount} subject sheets are still awaiting teacher mark entry.` : 'All assigned class marks are up-to-date.'}\n\n💡 **Action:** Head to the **Exam & Reports** tab to finalize marks and generate GES terminal report cards.`;
                actions = [{ label: '📚 Open Exams', menu: 'Exam' }];
            } else if (lower.includes('attendance') || lower.includes('present') || lower.includes('absent')) {
                const presentCount = attendanceStats?.present || 0;
                const totalRecorded = attendanceStats?.total_recorded || stats.students || 0;
                const pct = totalRecorded > 0 ? ((presentCount / totalRecorded) * 100).toFixed(0) : '0';
                reply = `📅 **Daily Attendance Overview:**\n\n• **Present Today:** ${presentCount} students (${pct}% rate)\n• **Late:** ${attendanceStats?.late || 0} students\n• **Staff Presence:** ${teacherAttendanceStats?.present || 0} of ${teacherAttendanceStats?.total || stats.teachers} teachers clocked in.\n\n💡 Morning rolls are live in the Attendance module.`;
                actions = [{ label: '📅 Attendance Module', menu: 'Attendance' }];
            } else {
                reply = `✦ **baseAI Executive Summary:**\n\n• **Active Session:** ${schoolConfig?.current_term || 'First Term'} • ${schoolConfig?.academic_year || '2025/2026'}\n• **Enrolled Students:** ${stats.students} (${stats.boys} Boys, ${stats.girls} Girls)\n• **Total Staff:** ${stats.teachers} Teachers\n• **Revenue Collected This Term:** ${currencySym} ${Number(stats.revenue).toLocaleString()}\n\nAll core school systems are running smoothly. Click any quick shortcut below to manage admissions, billing, or terminal exams.`;
                actions = [
                    { label: '🎓 Students', menu: 'Students' },
                    { label: '💳 Fees', menu: 'Fees' },
                    { label: '📚 Exams', menu: 'Exam' }
                ];
            }

            setCopilotResponse(reply);
            setAiChatMessages(prev => [...prev, {
                sender: 'ai',
                text: reply,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                actions: actions,
                smsApproval: smsApproval
            }]);
            setIsAskingCopilot(false);
        }, 400);
    };

    const handleApproveSms = async (smsPayload: any, msgIndex: number) => {
        try {
            await supabase.from('app_notifications').insert([{
                school_id: currentUser.school_id,
                title: `Broadcast to ${smsPayload.recipient_group || 'Parents'}`,
                message: smsPayload.message_text,
                category: 'Urgent',
                target_audience: smsPayload.recipient_group || 'Parents'
            }]);

            queryClient.invalidateQueries({ queryKey: ['recentNotices'] });

            setAiChatMessages(prev => prev.map((m, i) => {
                if (i === msgIndex && m.smsApproval) {
                    return { ...m, smsApproval: { ...m.smsApproval, status: 'sent' } };
                }
                return m;
            }));
        } catch (err: any) {
            alert("Failed to send SMS: " + err.message);
        }
    };

    // 5.5 Teacher Assignments (New Robust Context)
    const { data: teacherAssignments = [] } = useQuery({
        queryKey: ['myAssignments', currentUser.id, currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.id || !currentUser.school_id) return [];

            // 1. Fetch from teacher_assignments (master_schema_v1.sql standard)
            const { data: assignmentsData } = await supabase
                .from('teacher_assignments')
                .select('is_class_teacher, class_id, classes (name), subject_id, subjects (name)')
                .eq('teacher_id', currentUser.id)
                .eq('school_id', currentUser.school_id);

            const combined = new Map<string, any>();

            // Process formal assignments
            assignmentsData?.forEach((a: any) => {
                const cls = Array.isArray(a.classes) ? a.classes[0] : a.classes;
                const subj = Array.isArray(a.subjects) ? a.subjects[0] : a.subjects;
                const className = (cls?.name || a.class_name || '').trim();
                const subjectName = (subj?.name || a.subject_name || '').trim();

                if (className) {
                    const key = `${className.toLowerCase()}-${subjectName ? subjectName.toLowerCase() : 'null'}`;
                    
                    combined.set(key, {
                        className,
                        subjectName: subjectName || null,
                        isClassTeacher: Boolean(a.is_class_teacher)
                    });

                    // Ensure base record for class teacher
                    if (a.is_class_teacher) {
                        const baseKey = `${className.toLowerCase()}-null`;
                        combined.set(baseKey, {
                            className,
                            subjectName: null,
                            isClassTeacher: true
                        });
                    }
                }
            });

            // Process legacy profile fallback ONLY if no assignments exist in teacher_assignments
            if ((!assignmentsData || assignmentsData.length === 0) && currentUser.assignedClass) {
                const className = currentUser.assignedClass.trim();
                const baseKey = `${className.toLowerCase()}-null`;
                combined.set(baseKey, {
                    className,
                    subjectName: null,
                    isClassTeacher: true
                });
            }

            return Array.from(combined.values());
        },
        enabled: !!currentUser.id
    });

    // 6. Top Defaulters (Fees)
    const { data: topDefaulters = [] } = useQuery({
        queryKey: ['topDefaulters', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return [];
            const { data } = await supabase
                .from('students')
                .select('id, name, class, balance, photo_url')
                .eq('school_id', currentUser.school_id)
                .gt('balance', 0)
                .order('balance', { ascending: false })
                .limit(5);
            return data || [];
        },
        enabled: !!currentUser.school_id && currentUser.role === 'admin' && (activeModules.includes('revenue_guard') || activeModules.includes('complete_bundle'))
    });

    // 7. Teacher Attendance Stats for Today
    const { data: teacherAttendanceStats = { present: 0, total: 0 } } = useQuery({
        queryKey: ['teacherAttendanceStats', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return { present: 0, total: 0 };
            const today = new Date().toISOString().split('T')[0];
            const { data: tAttendance } = await supabase.from('teacher_attendance').select('status').eq('school_id', currentUser.school_id).eq('date', today);
            const { count: tTotal } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', currentUser.school_id).eq('role', 'teacher');
            const present = tAttendance?.filter(a => a.status === 'Present' || a.status === 'Late').length || 0;
            return { present, total: tTotal || 0 };
        },
        enabled: !!currentUser.school_id && currentUser.role === 'admin'
    });

    // 7. Student Today's Attendance Stats
    const { data: attendanceStats = { present: 0, absent: 0, late: 0, total_recorded: 0 } } = useQuery({
        queryKey: ['attendanceStats', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return { present: 0, absent: 0, late: 0, total_recorded: 0 };

            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            const { data } = await supabase
                .from('attendance')
                .select('status')
                .eq('school_id', currentUser.school_id)
                .eq('date', today);

            const recordStats = { present: 0, absent: 0, late: 0, total_recorded: 0 };

            if (data) {
                data.forEach(record => {
                    recordStats.total_recorded++;
                    if (record.status === 'Present') recordStats.present++;
                    else if (record.status === 'Absent') recordStats.absent++;
                    else if (record.status === 'Late') recordStats.late++;
                });
            }

            return recordStats;
        },
        enabled: !!currentUser.school_id && (activeModules.includes('daily_tracker') || activeModules.includes('complete_bundle'))
    });

    // 8. Academic Performance Average Structure
    const { data: averagePerformance = null } = useQuery({
        queryKey: ['averagePerformance', currentUser.school_id, schoolConfig?.current_term, schoolConfig?.academic_year],
        queryFn: async () => {
            if (!currentUser.school_id || !schoolConfig?.current_term) return null;

            const { data: results } = await supabase
                .from('exam_results')
                .select('total')
                .eq('school_id', currentUser.school_id)
                .eq('term', schoolConfig.current_term)
                .eq('academic_year', schoolConfig.academic_year);

            if (!results || results.length === 0) return null;

            const totalSum = results.reduce((sum: number, r: any) => sum + (Number(r.total) || 0), 0);
            return (totalSum / results.length).toFixed(1);
        },
        enabled: !!currentUser.school_id && !!schoolConfig && (activeModules.includes('academic_engine') || activeModules.includes('complete_bundle'))
    });

    // 8b. Class-level Performance Breakdown (for bar chart)
    const { data: classPerformance = [] } = useQuery({
        queryKey: ['classPerformance', currentUser.school_id, schoolConfig?.current_term, schoolConfig?.academic_year],
        queryFn: async () => {
            if (!currentUser.school_id || !schoolConfig?.current_term) return [];
            const { data: results } = await supabase
                .from('exam_results')
                .select('class, total')
                .eq('school_id', currentUser.school_id)
                .eq('term', schoolConfig.current_term)
                .eq('academic_year', schoolConfig.academic_year)
                .not('total', 'is', null);

            if (!results || results.length === 0) return [];

            const classMap = new Map<string, { sum: number; count: number }>();
            results.forEach((r: any) => {
                const cls = r.class || r.class_name || 'Unknown';
                const existing = classMap.get(cls) || { sum: 0, count: 0 };
                classMap.set(cls, { sum: existing.sum + (Number(r.total) || 0), count: existing.count + 1 });
            });

            return Array.from(classMap.entries())
                .map(([cls, { sum, count }]) => ({ class: cls, avg: Math.round(sum / count) }))
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 8);
        },
        enabled: !!currentUser.school_id && !!schoolConfig && currentUser.role === 'admin'
    });

    // 9. Enrollment Growth Stats

    const { data: enrollmentStats = { currentTerm: 0, lastTerm: 0, growth: 0 } } = useQuery({
        queryKey: ['enrollmentStats', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return { currentTerm: 0, lastTerm: 0, growth: 0 };

            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(now.getDate() - 60);

            const { count: currentCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentUser.school_id)
                .gte('created_at', thirtyDaysAgo.toISOString());

            const { count: lastCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentUser.school_id)
                .gte('created_at', sixtyDaysAgo.toISOString())
                .lt('created_at', thirtyDaysAgo.toISOString());

            const current = currentCount || 0;
            const last = lastCount || 0;
            const growth = last === 0 ? current * 100 : Math.round(((current - last) / last) * 100);

            return { currentTerm: current, lastTerm: last, growth };
        },
        enabled: !!currentUser.school_id && currentUser.role === 'admin'
    });

    // 10. Revenue Growth Stats
    const { data: revenueGrowthStats = { growth: 0 } } = useQuery({
        queryKey: ['revenueGrowthStats', currentUser.school_id],
        queryFn: async () => {
            if (!currentUser.school_id) return { growth: 0 };

            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(now.getDate() - 60);

            const { data: currentPeriod } = await supabase
                .from('transactions')
                .select('amount')
                .eq('school_id', currentUser.school_id)
                .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

            const { data: lastPeriod } = await supabase
                .from('transactions')
                .select('amount')
                .eq('school_id', currentUser.school_id)
                .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
                .lt('date', thirtyDaysAgo.toISOString().split('T')[0]);

            const current = currentPeriod?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
            const last = lastPeriod?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

            const growth = last === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - last) / last) * 100);

            return { growth };
        },
        enabled: !!currentUser.school_id && currentUser.role === 'admin'
    });

    // Combined Loading State
    const loading = configLoading || statsLoading;

    // --- Session Management State ---
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [targetTerm, setTargetTerm] = useState('First Term');
    const [targetYear, setTargetYear] = useState(new Date().getFullYear() + '/' + (new Date().getFullYear() + 1));
    const [showConfirmSwitch, setShowConfirmSwitch] = useState(false);
    const [copyFeesState, setCopyFeesState] = useState(false);
    const [carryForwardState, setCarryForwardState] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);

    // Reset target defaults when modal opens
    useEffect(() => {
        if (showSessionModal && schoolConfig) {
            // Default to next logical term
            const terms = ['First Term', 'Second Term', 'Third Term'];
            const nextIdx = (terms.indexOf(schoolConfig.current_term) + 1) % 3;
            setTargetTerm(terms[nextIdx]);
            setTargetYear(schoolConfig.academic_year); // Default to current year for continuity
            setShowConfirmSwitch(false); // Reset confirmation step
            setCopyFeesState(false); // Reset checkbox
            setCarryForwardState(false);
        }
    }, [showSessionModal, schoolConfig]);

    // Force Setup if no term is set (Onboarding)
    useEffect(() => {
        if (schoolConfig && !schoolConfig.current_term) {
            setShowSessionModal(true);
        }
    }, [schoolConfig]);

    const startNewTermMutation = useMutation({
        mutationFn: async ({ term, year, copyFees, carryForward }: { term: string, year: string, copyFees: boolean, carryForward: boolean }) => {
            let rpcSucceeded = false;
            try {
                const { error } = await supabase.rpc('admin_switch_academic_term', {
                    p_school_id: currentUser.school_id,
                    p_new_term: term,
                    p_new_year: year,
                    p_copy_fee_structure: copyFees,
                    p_roll_over_arrears: carryForward
                });
                if (!error) rpcSucceeded = true;
            } catch (e) {
                console.warn('admin_switch_academic_term RPC not found or errored, using direct table sync fallback:', e);
            }

            if (!rpcSucceeded) {
                // Direct DB updates fallback:
                // 1. Update schools table
                const { error: schoolErr } = await supabase
                    .from('schools')
                    .update({
                        current_term: term,
                        academic_year: year
                    })
                    .eq('id', currentUser.school_id);

                if (schoolErr) throw schoolErr;

                // 2. Sync academic_terms table
                await supabase
                    .from('academic_terms')
                    .update({ is_current: false })
                    .eq('school_id', currentUser.school_id);

                const { data: existingTerm } = await supabase
                    .from('academic_terms')
                    .select('id')
                    .eq('school_id', currentUser.school_id)
                    .eq('term', term)
                    .eq('academic_year', year)
                    .maybeSingle();

                if (existingTerm) {
                    await supabase
                        .from('academic_terms')
                        .update({ is_current: true })
                        .eq('id', existingTerm.id);
                } else {
                    await supabase
                        .from('academic_terms')
                        .insert([
                            {
                                school_id: currentUser.school_id,
                                academic_year: year,
                                term: term,
                                is_current: true,
                                is_locked: false,
                                total_days: 65
                            }
                        ]);
                }
                // 3. Handle 'Copy Fee Structure' if selected
                if (copyFees && schoolConfig?.current_term && schoolConfig?.academic_year) {
                    try {
                        const { data: previousFees } = await supabase
                            .from('fee_structure')
                            .select('name, amount, target_class')
                            .eq('school_id', currentUser.school_id)
                            .eq('term', schoolConfig.current_term)
                            .eq('academic_year', schoolConfig.academic_year);

                        if (previousFees && previousFees.length > 0) {
                            const newFees = previousFees.map(f => ({
                                school_id: currentUser.school_id,
                                name: f.name,
                                amount: f.amount,
                                target_class: f.target_class,
                                term: term,
                                academic_year: year
                            }));

                            await supabase.from('fee_structure').insert(newFees);

                            // Apply fee amounts to student balances
                            for (const fee of newFees) {
                                if (fee.target_class) {
                                    const { data: classStudents } = await supabase
                                        .from('students')
                                        .select('id, balance')
                                        .eq('school_id', currentUser.school_id)
                                        .eq('class', fee.target_class);

                                    if (classStudents) {
                                        for (const st of classStudents) {
                                            await supabase
                                                .from('students')
                                                .update({ balance: (st.balance || 0) + Number(fee.amount) })
                                                .eq('id', st.id);
                                        }
                                    }
                                } else {
                                    // Applies to all students
                                    const { data: allStudents } = await supabase
                                        .from('students')
                                        .select('id, balance')
                                        .eq('school_id', currentUser.school_id);

                                    if (allStudents) {
                                        for (const st of allStudents) {
                                            await supabase
                                                .from('students')
                                                .update({ balance: (st.balance || 0) + Number(fee.amount) })
                                                .eq('id', st.id);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Error copying fee structure:', err);
                    }
                }

                // 4. Handle 'Carry Forward Arrears'
                // If carryForward is false, reset non-debt balances or reset existing balances
                if (!carryForward && !copyFees) {
                    try {
                        await supabase
                            .from('students')
                            .update({ balance: 0 })
                            .eq('school_id', currentUser.school_id);
                    } catch (err) {
                        console.error('Error resetting arrears:', err);
                    }
                }
            }
        },
        onSuccess: () => {
            // Clear cached school config so UI re-renders immediately with the new term/year
            localStorage.removeItem(`base16_school_config_${currentUser.school_id}`);
            queryClient.invalidateQueries({ queryKey: ['schoolConfig', currentUser.school_id] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['feeStructure'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['averagePerformance'] });

            setShowSessionModal(false);
            setShowBillingModal(true);
        },
        onError: (err: any) => alert("Error switching academic session: " + err.message)
    });

    // --- Effects ---

    useEffect(() => {
        // Use the flag passed from Login.tsx
        if ((currentUser as any).isFirstLogin) {
            setShowWelcomeModal(true);
        }
    }, [currentUser]);

    useEffect(() => {
        if (schoolConfig) {
            // Suspensions are now purely based on the school's status column (set by super admin)
            if ((schoolConfig as any).status === 'suspended') {
                setSubscriptionStatus('suspended');
            } else {
                setSubscriptionStatus('active');
            }
        }
    }, [schoolConfig]);

    const getThemeStyles = (color: string) => {
        let normalized = color || 'blue';
        if (normalized === 'green') normalized = '#059669';
        if (normalized === 'maroon') normalized = '#991b1b';
        if (normalized === 'purple') normalized = '#7e22ce';
        if (normalized === 'blue') normalized = '#2563eb';

        const isHex = normalized?.startsWith('#');
        if (isHex) {
            return {
                bg: '',
                bgLight: '',
                text: '',
                textDark: '',
                border: '',
                ring: 'focus:ring-opacity-50',
                shadow: '',
                hex: normalized,
                custom: {
                    bg: normalized,
                    bgLight: `${normalized}15`,
                    text: normalized,
                    textDark: normalized,
                    border: `${normalized}33`,
                    ring: normalized,
                    shadow: `${normalized}33`
                }
            };
        }

        switch (normalized) {
            case 'purple': return { bg: 'bg-purple-600', bgLight: 'bg-purple-50', text: 'text-purple-600', textDark: 'text-purple-800', border: 'border-purple-200', ring: 'focus:ring-purple-200', shadow: 'shadow-purple-200', hex: '#7e22ce', custom: null };
            case 'emerald': case 'green': return { bg: 'bg-emerald-600', bgLight: 'bg-emerald-50', text: 'text-emerald-600', textDark: 'text-emerald-800', border: 'border-emerald-200', ring: 'focus:ring-emerald-200', shadow: 'shadow-emerald-200', hex: '#059669', custom: null };
            case 'orange': return { bg: 'bg-orange-600', bgLight: 'bg-orange-50', text: 'text-orange-600', textDark: 'text-orange-800', border: 'border-orange-200', ring: 'focus:ring-orange-200', shadow: 'shadow-orange-200', hex: '#ea580c', custom: null };
            case 'maroon': return { bg: 'bg-red-800', bgLight: 'bg-red-50', text: 'text-red-800', textDark: 'text-red-900', border: 'border-red-200', ring: 'focus:ring-red-200', shadow: 'shadow-red-200', hex: '#991b1b', custom: null };
            default: return { bg: 'bg-blue-600', bgLight: 'bg-blue-50', text: 'text-blue-600', textDark: 'text-blue-800', border: 'border-blue-200', ring: 'focus:ring-blue-200', shadow: 'shadow-blue-200', hex: '#2563eb', custom: null };
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
        { name: 'Install App', icon: Download },
    ];

    const teacherMenuItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Timetable', icon: Clock },
        { name: 'My Students', icon: Users },
        { name: 'Attendance', icon: Calendar },
        ...(schoolConfig?.teachers_can_collect_feeding ? [{ name: 'Feeding', icon: Utensils }] : []),
        // ...(hasPayslips ? [{ name: 'My Payroll', icon: Banknote }] : []),
        { name: 'Mark Entry & Reports', icon: FileText },
        { name: 'Notice Board', icon: Bell },
        { name: 'Settings & Profile', icon: SettingsIcon },
        { name: 'Install App', icon: Download },
    ];

    const allowedMenuItems = (currentUser.role === 'admin' ? adminMenuItems : teacherMenuItems)
        .filter(item => {
            if (item.name === 'Install App' && !isInstallable) return false;
            return true;
        });

    const currentMenuItems = allowedMenuItems.filter(item => {
        // Check if the menu is hidden via Menu Customization settings
        const isHiddenFromSettings = hiddenMenuItems.includes(item.name) &&
            !['Settings', 'Dashboard', 'Settings & Profile', 'Install App'].includes(item.name);

        return !isHiddenFromSettings;
    });
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
                case 'Dashboard': return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} recentNotices={recentNotices} assignments={teacherAssignments} />;
                case 'Timetable': return <Timetable currentUser={currentUser} />;
                case 'My Students': return <Students currentUser={currentUser} />;
                case 'Attendance': return <Attendance currentUser={currentUser} theme={theme} />;
                case 'Feeding': return <Feeding currentUser={currentUser} />;
                // case 'My Payroll': return <MyPayroll currentUser={currentUser} />;
                case 'Mark Entry & Reports': return <Exams currentUser={currentUser} activeModules={activeModules} />;
                case 'Notice Board': return <Communication currentUser={currentUser} />;
                case 'Settings & Profile': return <Settings onConfigUpdate={() => queryClient.invalidateQueries({ queryKey: ['schoolConfig'] })} currentUser={currentUser} hiddenMenuItems={hiddenMenuItems} toggleHiddenMenu={toggleHiddenMenu} availableMenus={allowedMenuItems} />;
                default: return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} recentNotices={recentNotices} assignments={teacherAssignments} />;
            }
        }
        switch (activeMenu) {
            case 'Students': return <Students currentUser={currentUser} />;
            case 'Teachers': return <Teachers currentUser={currentUser} />;
            case 'Timetable': return <Timetable currentUser={currentUser} />;
            case 'Attendance':
                if (!isModuleUnlocked('daily_operations')) {
                    return (
                        <ModuleLockGate
                            moduleCode="daily_operations"
                            moduleName="Operations, Staff & Feeding"
                            subtitle="Attendance, Teacher Payroll & Canteen Tracker"
                            price={100}
                            badge="Operations"
                            features={[
                                'Daily Student & Teacher Attendance Tracking',
                                'Monthly Teacher Payroll & Absence Deductions',
                                'Instant Teacher Payslip Generator',
                                'Daily Canteen & Feeding Fee Tracker'
                            ]}
                            schoolId={currentUser.school_id}
                            schoolName={schoolConfig?.name}
                            schoolEmail={schoolConfig?.email}
                            walletBalance={schoolConfig?.wallet_balance || 0}
                            onUnlocked={() => queryClient.invalidateQueries({ queryKey: ['activeSubscription', currentUser.school_id] })}
                        />
                    );
                }
                return <Attendance currentUser={currentUser} theme={theme} />;
            case 'Fees':
                if (!isModuleUnlocked('revenue_guard')) {
                    return (
                        <ModuleLockGate
                            moduleCode="revenue_guard"
                            moduleName="Revenue & Finance Guard"
                            subtitle="Fee Structures, Invoicing, Receipts & Debtors"
                            price={120}
                            badge="Finance"
                            features={[
                                'Student Fee Ledgers & Automated Invoicing',
                                'Instant Thermal POS & A4 Printable Receipts',
                                'Defaulters Tracking & Fee Deficit Analysis',
                                'Cash & Mobile Money Transaction Logging'
                            ]}
                            schoolId={currentUser.school_id}
                            schoolName={schoolConfig?.name}
                            schoolEmail={schoolConfig?.email}
                            walletBalance={schoolConfig?.wallet_balance || 0}
                            onUnlocked={() => queryClient.invalidateQueries({ queryKey: ['activeSubscription', currentUser.school_id] })}
                        />
                    );
                }
                return <Fees currentUser={currentUser} />;
            case 'Feeding': return <Feeding currentUser={currentUser} />;
            case 'Exam':
                if (!isModuleUnlocked('academic_engine')) {
                    return (
                        <ModuleLockGate
                            moduleCode="academic_engine"
                            moduleName="Academic Engine"
                            subtitle="Terminal Exams, Broadsheets & Report Cards"
                            price={70}
                            badge="Academics"
                            features={[
                                'Terminal Exams & CA Grading (30/70 & 50/50)',
                                'Auto Class Positions & Broadsheet Compilation',
                                'Prestige Terminal Report Cards (Customizable)',
                                'Batch PDF Generation & Instant Print Export'
                            ]}
                            schoolId={currentUser.school_id}
                            schoolName={schoolConfig?.name}
                            schoolEmail={schoolConfig?.email}
                            walletBalance={schoolConfig?.wallet_balance || 0}
                            onUnlocked={() => queryClient.invalidateQueries({ queryKey: ['activeSubscription', currentUser.school_id] })}
                        />
                    );
                }
                return <Exams currentUser={currentUser} activeModules={activeModules} />;
            case 'Classes': return <Courses currentUser={currentUser} />;
            case 'Analytics': return <Analytics currentUser={currentUser} />;
            case 'Notice':
                if (!isModuleUnlocked('parent_portal')) {
                    return (
                        <ModuleLockGate
                            moduleCode="parent_portal"
                            moduleName="Parent Portal & Notices"
                            subtitle="Online Parent Access, Reports & Notice Board"
                            price={80}
                            badge="Parents"
                            features={[
                                'Secure Parent Student Access Link',
                                'Online Terminal Report Card Viewer',
                                'Live Student Fee Balance & Payment Status',
                                'Digital School Notice Board & Announcements'
                            ]}
                            schoolId={currentUser.school_id}
                            schoolName={schoolConfig?.name}
                            schoolEmail={schoolConfig?.email}
                            walletBalance={schoolConfig?.wallet_balance || 0}
                            onUnlocked={() => queryClient.invalidateQueries({ queryKey: ['activeSubscription', currentUser.school_id] })}
                        />
                    );
                }
                return <Communication currentUser={currentUser} />;
            case 'Help center': return <HelpCenter currentUser={currentUser} />;
            case 'Settings': return <Settings onConfigUpdate={() => queryClient.invalidateQueries({ queryKey: ['schoolConfig'] })} currentUser={currentUser} hiddenMenuItems={hiddenMenuItems} toggleHiddenMenu={toggleHiddenMenu} availableMenus={allowedMenuItems} />;
            default: return (
                <div className="p-3 md:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* ── 1. COMPACT HERO BANNER ───────────────────────────────────────── */}
                    <div
                        className="relative overflow-hidden rounded-2xl p-3.5 md:p-4 text-white shadow-md"
                        style={{ background: `linear-gradient(135deg, ${theme.hex} 0%, ${theme.hex}dd 60%, ${theme.hex}aa 100%)` }}
                    >
                        {/* Ambient decorative lighting */}
                        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />

                        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {schoolConfig?.logo ? (
                                    <img src={schoolConfig.logo} alt="School Logo" className="h-10 w-10 rounded-xl object-cover border border-white/40 shadow-sm" />
                                ) : (
                                    <div className="h-10 w-10 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center text-white font-black text-lg shadow-sm">
                                        {schoolConfig?.name?.[0] || 'O'}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-base md:text-lg font-black tracking-tight">{schoolConfig?.name || 'Orbit School'}</h1>
                                        <span className="bg-white/20 backdrop-blur-sm border border-white/25 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            {schoolConfig?.current_term || 'First Term'}
                                        </span>
                                        <span className="bg-white/20 backdrop-blur-sm border border-white/25 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            {schoolConfig?.academic_year || '2025/2026'}
                                        </span>
                                        <span className="flex items-center gap-1 bg-emerald-400/30 border border-emerald-300/40 text-emerald-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Live
                                        </span>
                                    </div>
                                    <p className="text-white/80 text-xs font-medium truncate max-w-md mt-0.5">{schoolConfig?.motto || 'School Management Dashboard'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowSessionModal(true)}
                                    className="bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                                >
                                    <Clock className="h-3.5 w-3.5" /> Manage Term
                                </button>
                                <button
                                    onClick={() => setIsAIPanelOpen(true)}
                                    className="bg-white text-slate-900 text-xs font-black px-3 py-1.5 rounded-xl transition-all hover:bg-white/95 flex items-center gap-1.5 shadow-sm"
                                    style={{ color: theme.hex }}
                                >
                                    <Sparkles className="h-3.5 w-3.5" /> Ask baseAI
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── 2. COMPACT STAT CARDS WITH EMBEDDED MINI-GRAPHS ─────────────────── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Card 1: Students + Sparkline */}
                        <div
                            onClick={() => setActiveMenu('Students')}
                            className="bg-white rounded-2xl p-3 md:p-3.5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${theme.hex}18`, color: theme.hex }}>
                                        <GraduationCap className="h-4 w-4" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Students</span>
                                </div>
                                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{stats.students}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">{stats.boys} Boys · {stats.girls} Girls</p>
                            </div>
                            <div className="w-16 h-10 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={[{v: 10}, {v: 15}, {v: 22}, {v: stats.students || 30}]}>
                                        <Area type="monotone" dataKey="v" stroke={theme.hex} fill={`${theme.hex}20`} strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Card 2: Staff Presence Ring */}
                        <div
                            onClick={() => setActiveMenu('Teachers')}
                            className="bg-white rounded-2xl p-3 md:p-3.5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                                        <Users className="h-4 w-4" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Staff Members</span>
                                </div>
                                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{stats.teachers}</p>
                                <p className="text-[10px] text-purple-600 font-bold mt-1 truncate">
                                    {teacherAttendanceStats.total > 0 ? `${teacherAttendanceStats.present}/${teacherAttendanceStats.total} Clocked In` : 'Teachers Active'}
                                </p>
                            </div>
                            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                                    <circle
                                        cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray={`${teacherAttendanceStats.total > 0 ? (teacherAttendanceStats.present / teacherAttendanceStats.total) * 88 : 88} 88`}
                                    />
                                </svg>
                                <span className="absolute text-[9px] font-black text-purple-700">
                                    {teacherAttendanceStats.total > 0 ? `${Math.round((teacherAttendanceStats.present / teacherAttendanceStats.total) * 100)}%` : '100%'}
                                </span>
                            </div>
                        </div>

                        {/* Card 3: Academic Pulse Gauge */}
                        <div
                            onClick={() => setActiveMenu('Exam')}
                            className="bg-white rounded-2xl p-3 md:p-3.5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Academic Avg.</span>
                                </div>
                                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{averagePerformance ? `${averagePerformance}%` : 'Pending'}</p>
                                <p className="text-[10px] text-amber-600 font-bold mt-1 truncate">
                                    {averagePerformance ? (Number(averagePerformance) >= 70 ? '★ High Score' : 'Active Grading') : 'Awaiting Marks'}
                                </p>
                            </div>
                            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                                    <circle
                                        cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray={`${averagePerformance ? (Number(averagePerformance) / 100) * 88 : 45} 88`}
                                    />
                                </svg>
                                <span className="absolute text-[9px] font-black text-amber-700">
                                    {averagePerformance ? `${Math.round(Number(averagePerformance))}%` : '--'}
                                </span>
                            </div>
                        </div>

                        {/* Card 4: Revenue + Mini Bar Chart */}
                        <div
                            onClick={() => setActiveMenu('Fees')}
                            className="bg-white rounded-2xl p-3 md:p-3.5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                                        <Banknote className="h-4 w-4" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Term Revenue</span>
                                </div>
                                <p className="text-lg md:text-xl font-black text-slate-900 leading-none truncate">{formatAmount(stats.revenue)}</p>
                                <p className="text-[10px] text-emerald-600 font-bold mt-1 truncate">
                                    {topDefaulters.length > 0 ? `${topDefaulters.length} in arrears` : 'All Fees Cleared'}
                                </p>
                            </div>
                            <div className="w-14 h-10 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={financialHistory.slice(-4)}>
                                        <Bar dataKey="collected" fill="#10b981" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* ── 3. COMPACT QUICK ACTION BAR ─────────────────────────────────────── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {[
                            { label: 'Record Payment', sub: 'Issue receipt', icon: CreditCard, color: '#10b981', bg: '#f0fdf4', menu: 'Fees' },
                            { label: 'New Admission', sub: 'Enroll student', icon: Plus, color: theme.hex, bg: `${theme.hex}12`, menu: 'Students' },
                            { label: 'Enter Marks', sub: 'Exams & reports', icon: FileText, color: '#8b5cf6', bg: '#f5f3ff', menu: 'Exam' },
                            { label: 'Broadcast SMS', sub: 'Alert parents', icon: MessageSquare, color: '#f59e0b', bg: '#fffbeb', menu: 'Notice' },
                        ].map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveMenu(action.menu)}
                                className="bg-white hover:bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-2.5 text-left group"
                            >
                                <div className="p-1.5 rounded-lg shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: action.bg, color: action.color }}>
                                    <action.icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{action.label}</p>
                                    <p className="text-[9px] text-slate-400 font-medium truncate">{action.sub}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* ── 4. MAIN CHARTS (NOW VISIBLE RIGHT IN FIRST VIEW!) ─────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Revenue Area Chart — takes 3 cols */}
                        <div className="lg:col-span-3 bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-sm md:text-base text-slate-800">Monthly Revenue Trend</h3>
                                    <p className="text-[11px] text-slate-400">Collections over the last 6 months</p>
                                </div>
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-slate-600 bg-slate-100">
                                    {schoolConfig?.academic_year || 'This Year'}
                                </span>
                            </div>
                            <div className="h-48 md:h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={financialHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                        <defs>
                                            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme.hex} stopOpacity={0.18} />
                                                <stop offset="95%" stopColor={theme.hex} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${currency.symbol}${(v / 1000).toFixed(0)}k` : `${currency.symbol}${v}`} width={38} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="collected" stroke={theme.hex} strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGrad)" dot={{ fill: theme.hex, r: 3, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Class Performance Horizontal Bar — takes 2 cols */}
                        <div className="lg:col-span-2 bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-sm md:text-base text-slate-800">Class Performance</h3>
                                    <p className="text-[11px] text-slate-400">Class score breakdown</p>
                                </div>
                                <button onClick={() => setActiveMenu('Exam')} className="text-[10px] font-bold px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">View All</button>
                            </div>
                            {classPerformance.length > 0 ? (
                                <div className="flex-1 space-y-2.5">
                                    {classPerformance.map((item: any, i: number) => {
                                        const pct = Math.min(item.avg, 100);
                                        const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                                        return (
                                            <div key={i}>
                                                <div className="flex justify-between text-[11px] font-semibold mb-1">
                                                    <span className="text-slate-700 truncate max-w-[110px]">{item.class}</span>
                                                    <span style={{ color }} className="font-black">{item.avg}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${pct}%`, backgroundColor: color }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    <BarChart2 className="h-7 w-7 text-slate-300 mb-1" />
                                    <p className="text-xs font-bold text-slate-600">No marks yet</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Averages appear once marks are submitted.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 5. CHARTS ROW 2: Demographics Pie + Attendance + Academic Avg ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Demographics Donut */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="font-bold text-xs md:text-sm text-slate-800">Demographics</h3>
                                    <p className="text-[10px] text-slate-400">Gender ratio</p>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">Ratio</span>
                            </div>
                            <div className="flex-1 relative flex items-center justify-center" style={{ minHeight: 140 }}>
                                <ResponsiveContainer width="100%" height={140}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Boys', value: stats.boys || 0 },
                                                { name: 'Girls', value: stats.girls || 0 }
                                            ]}
                                            innerRadius={44}
                                            outerRadius={60}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            <Cell fill={theme.hex} />
                                            <Cell fill="#ec4899" />
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: any, name: any) => [`${value} (${stats.students > 0 ? Math.round((Number(value) / stats.students) * 100) : 0}%)`, name]}
                                            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 11 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xl font-black text-slate-800">{stats.students}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.hex }} />
                                        <span className="text-xs font-bold text-slate-700">Boys</span>
                                    </div>
                                    <span className="font-black text-xs text-slate-900">{stats.boys}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-xl bg-pink-50/60 border border-pink-100">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full bg-pink-500" />
                                        <span className="text-xs font-bold text-pink-700">Girls</span>
                                    </div>
                                    <span className="font-black text-xs text-pink-900">{stats.girls}</span>
                                </div>
                            </div>
                        </div>

                        {/* Today's Attendance */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="font-bold text-xs md:text-sm text-slate-800">Today's Attendance</h3>
                                    <p className="text-[10px] text-slate-400">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                </div>
                                <button onClick={() => setActiveMenu('Attendance')} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Details</button>
                            </div>
                            {attendanceStats.total_recorded > 0 ? (
                                <div className="flex-1 flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
                                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                                <circle
                                                    cx="18" cy="18" r="15.9" fill="none"
                                                    stroke="#10b981" strokeWidth="3" strokeLinecap="round"
                                                    strokeDasharray={`${(attendanceStats.present / attendanceStats.total_recorded) * 100} 100`}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-base font-black text-slate-800">{Math.round((attendanceStats.present / attendanceStats.total_recorded) * 100)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="font-semibold text-slate-500">Present</span>
                                                <span className="font-black text-emerald-600">{attendanceStats.present}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="font-semibold text-slate-500">Late</span>
                                                <span className="font-black text-amber-500">{attendanceStats.late}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="font-semibold text-slate-500">Absent</span>
                                                <span className="font-black text-red-500">{attendanceStats.absent}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 bg-blue-50/60 rounded-xl p-2 border border-blue-100 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <UserCheck className="h-3 w-3 text-blue-500" />
                                            <span className="text-[11px] font-bold text-slate-700">Staff In</span>
                                        </div>
                                        <span className="text-xs font-black text-blue-700">{teacherAttendanceStats.present} / {teacherAttendanceStats.total}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    <Calendar className="h-6 w-6 text-slate-300 mb-1" />
                                    <p className="text-xs font-bold text-slate-600">Not recorded yet</p>
                                </div>
                            )}
                        </div>

                        {/* Academic Performance */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="font-bold text-xs md:text-sm text-slate-800">Academic Avg.</h3>
                                    <p className="text-[10px] text-slate-400">{schoolConfig?.current_term || 'This term'}</p>
                                </div>
                                <button onClick={() => setActiveMenu('Exam')} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Exams</button>
                            </div>
                            {averagePerformance ? (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="relative w-28 h-28">
                                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                            <circle
                                                cx="18" cy="18" r="15.9" fill="none"
                                                stroke={Number(averagePerformance) >= 75 ? '#10b981' : Number(averagePerformance) >= 50 ? '#f59e0b' : '#ef4444'}
                                                strokeWidth="3" strokeLinecap="round"
                                                strokeDasharray={`${averagePerformance} 100`}
                                                style={{ transition: 'stroke-dasharray 1s ease-out' }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-black text-slate-800">{averagePerformance}%</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Average</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    <FileText className="h-6 w-6 text-slate-300 mb-1" />
                                    <p className="text-xs font-bold text-slate-600">No grades yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 6. BOTTOM ROW: Top Defaulters + Notices ────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
                        {/* Top Defaulters */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col max-h-72">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-xs md:text-sm text-slate-800 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Top Fee Defaulters
                                </h3>
                                <button onClick={() => setActiveMenu('Fees')} className="text-[10px] font-bold px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Manage Fees</button>
                            </div>
                            {topDefaulters.length > 0 ? (
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {topDefaulters.map((student: any) => (
                                        <div key={student.id} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-orange-50/50 transition-colors rounded-xl border border-slate-100 cursor-pointer group" onClick={() => setActiveMenu('Fees')}>
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs overflow-hidden border border-orange-200 shrink-0">
                                                    {student.photo_url ? <img src={student.photo_url} className="w-full h-full object-cover" /> : student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-xs line-clamp-1 group-hover:text-orange-600 transition-colors">{student.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{student.class}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="block font-black text-red-500 text-xs">{formatAmount(student.balance)}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-red-400 bg-red-50 px-1.5 py-0.2 rounded-full inline-block">Overdue</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200">
                                    <CheckCircle className="h-6 w-6 text-emerald-500 mb-1" />
                                    <p className="text-xs font-bold text-slate-700">All fees cleared!</p>
                                </div>
                            )}
                        </div>

                        {/* School Notices */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex flex-col max-h-72">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-xs md:text-sm text-slate-800 flex items-center gap-1.5">
                                    <Bell className="h-3.5 w-3.5 text-blue-500" /> Recent Notices
                                </h3>
                                <button onClick={() => setActiveMenu('Notice')} className="text-[10px] font-bold px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Notice Board</button>
                            </div>
                            {recentNotices.length > 0 ? (
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {recentNotices.slice(0, 5).map((n: any) => (
                                        <div key={n.id} className="p-2.5 bg-slate-50 hover:bg-blue-50/50 transition-colors rounded-xl border border-slate-100 cursor-pointer group" onClick={() => setActiveMenu('Notice')}>
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${n.priority === 'Urgent' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {n.priority}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium shrink-0">{new Date(n.date || n.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 mt-1 line-clamp-1 group-hover:text-blue-700 transition-colors">{n.title}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    <Megaphone className="h-6 w-6 text-slate-300 mb-1" />
                                    <p className="text-xs font-bold text-slate-600">No recent notices</p>
                                </div>
                            )}
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

    const parseInlineMarkdown = (text: string) => {
        if (!text) return text;
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return <strong key={idx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                return <em key={idx} className="italic text-slate-800">{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        const lines = text.split('\n');
        return lines.map((line, lineIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

            if (trimmed.startsWith('###')) {
                return (
                    <h4 key={lineIdx} className="font-bold text-sm text-slate-900 mt-2 mb-1 border-b border-slate-100 pb-0.5">
                        {parseInlineMarkdown(trimmed.replace(/^###\s*/, ''))}
                    </h4>
                );
            }

            if (trimmed.startsWith('##')) {
                return (
                    <h3 key={lineIdx} className="font-extrabold text-base text-slate-900 mt-2.5 mb-1 tracking-tight">
                        {parseInlineMarkdown(trimmed.replace(/^##\s*/, ''))}
                    </h3>
                );
            }

            if (trimmed.startsWith('#')) {
                return (
                    <h2 key={lineIdx} className="font-black text-lg text-slate-900 mt-3 mb-1.5 tracking-tight text-blue-700">
                        {parseInlineMarkdown(trimmed.replace(/^#\s*/, ''))}
                    </h2>
                );
            }

            if (trimmed.startsWith('>')) {
                const quoteContent = trimmed.substring(1).trim();
                return (
                    <div key={lineIdx} className="my-2 p-2.5 bg-blue-50/80 border-l-4 border-blue-500 rounded-r-xl italic text-slate-700 text-xs shadow-2xs">
                        {parseInlineMarkdown(quoteContent)}
                    </div>
                );
            }

            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const cells = trimmed.split('|').filter(c => c.trim() !== '');
                if (trimmed.includes('---')) {
                    return <div key={lineIdx} className="border-b border-slate-200 my-1" />;
                }
                return (
                    <div key={lineIdx} className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg my-1 text-xs font-mono">
                        {cells.map((cell, cIdx) => (
                            <div key={cIdx} className="flex-1 font-semibold text-slate-700">
                                {parseInlineMarkdown(cell.trim())}
                            </div>
                        ))}
                    </div>
                );
            }

            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('* ')) {
                const bulletContent = trimmed.replace(/^([•\-\*])\s*/, '').trim();
                return (
                    <div key={lineIdx} className="flex items-start gap-2 my-1 text-xs text-slate-700">
                        <span className="text-blue-600 font-bold shrink-0 mt-0.5">•</span>
                        <span className="flex-1 leading-relaxed">{parseInlineMarkdown(bulletContent)}</span>
                    </div>
                );
            }

            if (/^\d+\.\s/.test(trimmed)) {
                const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
                if (numMatch) {
                    return (
                        <div key={lineIdx} className="flex items-start gap-2 my-1 text-xs text-slate-700">
                            <span className="bg-blue-100 text-blue-800 font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                {numMatch[1]}
                            </span>
                            <span className="flex-1 leading-relaxed">{parseInlineMarkdown(numMatch[2])}</span>
                        </div>
                    );
                }
            }

            return (
                <p key={lineIdx} className="my-1 leading-relaxed text-xs text-slate-800">
                    {parseInlineMarkdown(trimmed)}
                </p>
            );
        });
    };

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
                            onClick={() => {
                                if (item.name === 'Install App') {
                                    showInstallPrompt();
                                } else {
                                    setActiveMenu(item.name);
                                }
                            }}
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
                {isTrialActive && (
                    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs border-b border-amber-600/30 z-30 shrink-0">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
                            <span>🎉 <strong>7-Day Free Trial Active</strong> ({trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} remaining) — All Base16 modules are unlocked for your school!</span>
                        </div>
                        <button onClick={() => setActiveMenu('Settings')} className="bg-white text-orange-700 px-3 py-1 rounded-lg font-black text-[11px] hover:bg-orange-50 transition-colors shadow-xs shrink-0">
                            Upgrade Plan
                        </button>
                    </div>
                )}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
                    <div className="flex items-center gap-4 md:hidden">
                        {schoolConfig?.logo ? (
                            <img src={schoolConfig.logo} alt="School Logo" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                            <div
                                className={`h-8 w-8 rounded-lg ${theme.bg} flex items-center justify-center text-white font-bold`}
                                style={theme.custom ? { backgroundColor: theme.custom.bg } : {}}
                            >{schoolConfig?.name?.[0] || 'O'}</div>
                        )}
                    </div>
                    <div className="hidden md:flex items-center gap-4 flex-1 max-w-xl relative">
                        <div className="relative w-full z-40">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={globalSearchTerm}
                                onChange={(e) => {
                                    setGlobalSearchTerm(e.target.value);
                                    setShowSearchDropdown(true);
                                }}
                                onFocus={() => setShowSearchDropdown(true)}
                                placeholder="Search students, teachers, or records..."
                                className={`w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-sm ${theme.ring}`}
                                style={theme.custom ? { '--tw-ring-color': theme.custom.ring } as React.CSSProperties : {}}
                            />
                        </div>
                        {showSearchDropdown && globalSearchTerm.length > 1 && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowSearchDropdown(false)}></div>
                                <div className="absolute top-full left-0 mt-2 w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 overflow-hidden text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                                    {(searchResults.students.length === 0 && searchResults.teachers.length === 0) ? (
                                        <div className="p-6 text-center text-slate-500 font-medium">
                                            <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                            No results found for "{globalSearchTerm}"
                                        </div>
                                    ) : (
                                        <div className="max-h-[60vh] overflow-y-auto hide-scrollbar">
                                            {searchResults.students.length > 0 && (
                                                <div className="p-2">
                                                    <h4 className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 rounded-lg mb-1">Students</h4>
                                                    {searchResults.students.map((s: any) => (
                                                        <div key={s.id}
                                                            onClick={() => { setActiveMenu(currentUser.role === 'admin' ? 'Students' : 'My Students'); setShowSearchDropdown(false); setGlobalSearchTerm(''); }}
                                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                                                        >
                                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold overflow-hidden border border-slate-200">
                                                                {s.photo_url ? <img src={s.photo_url} className="w-full h-full object-cover" /> : s.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 group-hover:text-primary-600 transition-colors">{s.name}</p>
                                                                <p className="text-xs text-slate-500 font-medium">{s.class} &bull; {s.gender}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {searchResults.teachers.length > 0 && (
                                                <div className="p-2 border-t border-slate-100">
                                                    <h4 className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 rounded-lg mb-1">Teachers</h4>
                                                    {searchResults.teachers.map((t: any) => (
                                                        <div key={t.id}
                                                            onClick={() => { setActiveMenu('Teachers'); setShowSearchDropdown(false); setGlobalSearchTerm(''); }}
                                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                                                        >
                                                            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">
                                                                {t.full_name?.charAt(0) || 'T'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 group-hover:text-primary-600 transition-colors">{t.full_name}</p>
                                                                <p className="text-xs text-slate-500 font-medium">Teaching Staff</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                                className="relative p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                            >
                                <Bell className="h-5 w-5" />
                                {recentNotices.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                            </button>

                            {/* Notification Dropdown Panel */}
                            {showNotificationsMenu && (
                                <>
                                    {/* Invisible backdrop for mobile dismiss */}
                                    <div className="fixed inset-0 z-40" onClick={() => setShowNotificationsMenu(false)}></div>
                                    <div className="fixed top-[70px] left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-3 w-auto sm:w-[340px] md:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-[100] overflow-hidden transform origin-top sm:origin-top-right transition-all animate-in slide-in-from-top-2 fade-in duration-200">
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                <Bell className="w-4 h-4 text-slate-500" /> Notifications
                                            </h3>
                                            <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full">{recentNotices.length} New</span>
                                        </div>
                                        <div className="max-h-[60vh] overflow-y-auto hide-scrollbar overscroll-contain">
                                            {recentNotices.length > 0 ? (
                                                <div className="divide-y divide-slate-50">
                                                    {recentNotices.map((notice: any) => (
                                                        <div key={notice.id} className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer group" onClick={() => {
                                                            setActiveMenu(currentUser.role === 'admin' ? 'Notice' : 'Notice Board');
                                                            setShowNotificationsMenu(false);
                                                        }}>
                                                            <div className="flex justify-between items-start mb-1 text-slate-400">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${notice.priority === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{notice.priority}</span>
                                                                <span className="text-[10px] font-medium">{new Date(notice.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-sm font-bold text-slate-800 mt-2 group-hover:text-primary-600 transition-colors">{notice.title}</p>
                                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{notice.message || 'Click to read full announcement...'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-10 text-center flex flex-col items-center justify-center">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 transform -rotate-6">
                                                        <Bell className="w-8 h-8 text-slate-300" />
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-800">All caught up!</p>
                                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Check back later for new school announcements and updates.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
                                            <button
                                                onClick={() => { setActiveMenu(currentUser.role === 'admin' ? 'Notice' : 'Notice Board'); setShowNotificationsMenu(false); }}
                                                className="text-[11px] font-bold text-slate-500 hover:text-primary-600 transition-colors uppercase tracking-widest w-full py-2"
                                            >
                                                View Notice Board
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="relative flex items-center gap-3 pl-4 border-l border-slate-200">
                            <button
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity cursor-pointer group"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-primary-600 transition-colors">{currentUser.name}</p>
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
                            </button>

                            {/* Profile Dropdown Menu */}
                            {showProfileMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                                    <div className="absolute top-full right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 overflow-hidden transform origin-top-right transition-all animate-in slide-in-from-top-2 fade-in duration-200">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 block sm:hidden">
                                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{currentUser.name}</p>
                                            <p className="text-xs text-slate-500 font-medium capitalize">{currentUser.role}</p>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            <button
                                                onClick={() => { setActiveMenu(currentUser.role === 'teacher' ? 'Settings & Profile' : 'Settings'); setShowProfileMenu(false); }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                                            >
                                                <SettingsIcon className="h-4 w-4" /> Account Settings
                                            </button>
                                            {currentUser.role === 'admin' && (
                                                <button
                                                    onClick={() => { setActiveMenu('Help center'); setShowProfileMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                                                >
                                                    <HelpCircle className="h-4 w-4" /> Help & Support
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-2 border-t border-slate-100">
                                            <button
                                                onClick={() => { setShowProfileMenu(false); onLogout(); }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            >
                                                <LogOut className="h-4 w-4" /> Logout
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-24 md:pb-8">
                    {loading && !stats.students ? (
                        <Loading type="skeleton" fullScreen={false} />
                    ) : (
                        <Suspense fallback={<Loading type="skeleton" fullScreen={false} />}>
                            {renderContent()}
                        </Suspense>
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

            {/* Session Management Modal */}
            {showSessionModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {schoolConfig?.current_term ? 'Switch Academic Session' : 'Setup Academic Session'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {schoolConfig?.current_term ? 'Select the term you want to activate/switch to.' : 'Please set up your first academic term to continue.'}
                                </p>
                            </div>
                            {schoolConfig?.current_term && (
                                <button onClick={() => setShowSessionModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {!showConfirmSwitch ? (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (!targetTerm || !targetYear) return alert("Please fill in all fields.");
                                    setShowConfirmSwitch(true);
                                }}
                                className="p-6 space-y-6"
                            >
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Term Name</label>
                                        <div className="relative">
                                            <select
                                                name="term"
                                                value={targetTerm}
                                                onChange={(e) => setTargetTerm(e.target.value)}
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                                            >
                                                <option value="First Term">First Term</option>
                                                <option value="Second Term">Second Term</option>
                                                <option value="Third Term">Third Term</option>
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Academic Year</label>
                                        <div className="relative">
                                            <select
                                                name="year"
                                                value={targetYear}
                                                onChange={(e) => setTargetYear(e.target.value)}
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                                            >
                                                {(() => {
                                                    const currentYear = new Date().getFullYear();
                                                    const years = [];
                                                    for (let i = -1; i < 4; i++) {
                                                        const y = currentYear + i;
                                                        years.push(`${y}/${y + 1}`);
                                                    }
                                                    return years.map(y => <option key={y} value={y}>{y}</option>);
                                                })()}
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Logic to determine if "Future" (New Term) */}
                                    {(() => {
                                        const terms = ['First Term', 'Second Term', 'Third Term'];
                                        const currentYearStart = parseInt(schoolConfig?.academic_year?.split('/')[0] || '0');
                                        const targetYearStart = parseInt(targetYear.split('/')[0]);
                                        const currentTermIdx = terms.indexOf(schoolConfig?.current_term || '');
                                        const targetTermIdx = terms.indexOf(targetTerm);

                                        const isFuture = targetYearStart > currentYearStart || (targetYearStart === currentYearStart && targetTermIdx > currentTermIdx);

                                        if (isFuture) {
                                            return (
                                                <div className="space-y-3">
                                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                                        <div className="mt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={copyFeesState}
                                                                onChange={(e) => setCopyFeesState(e.target.checked)}
                                                                id="copyFees"
                                                                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                            />
                                                        </div>
                                                        <label htmlFor="copyFees" className="text-sm cursor-pointer select-none">
                                                            <span className="font-bold text-blue-900 block mb-0.5">Copy Fee Structure</span>
                                                            <span className="text-blue-700/80">
                                                                Since you are starting a new term, checking this will copy fees from the current term.
                                                            </span>
                                                        </label>
                                                    </div>

                                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-3">
                                                        <div className="mt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={carryForwardState}
                                                                onChange={(e) => setCarryForwardState(e.target.checked)}
                                                                id="carryForwardFees"
                                                                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                                            />
                                                        </div>
                                                        <label htmlFor="carryForwardFees" className="text-sm cursor-pointer select-none">
                                                            <span className="font-bold text-orange-900 block mb-0.5">Carry Forward Arrears</span>
                                                            <span className="text-orange-700/80">
                                                                Checking this will automatically push all existing balances of owing students to the new term.
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>

                                <div className="pt-2 flex justify-end gap-3">
                                    {schoolConfig?.current_term && (
                                        <button
                                            type="button"
                                            onClick={() => setShowSessionModal(false)}
                                            className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all active:scale-95"
                                    >
                                        Continue
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="p-6 animate-in fade-in slide-in-from-right-8">
                                <div className="text-center mb-6">
                                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <History className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm Session Switch</h3>
                                    <div className="text-sm text-slate-500 max-w-xs mx-auto">
                                        You are about to switch the dashboard context to:
                                        <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 mt-3 font-bold text-slate-800 text-lg">
                                            {targetTerm} <span className="text-slate-400 font-light">|</span> {targetYear}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-4">
                                        The dashboard will refresh to show data specifically for this period. Existing data for other terms will be preserved.
                                    </p>
                                </div>

                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => setShowConfirmSwitch(false)}
                                        className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            startNewTermMutation.mutate({ term: targetTerm, year: targetYear, copyFees: copyFeesState, carryForward: carryForwardState });
                                            setShowSessionModal(false);
                                        }}
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                                    >
                                        Confirm Switch
                                    </button>
                                </div>
                            </div>
                        )}
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

            {/* Billing Notification Modal */}
            {showBillingModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
                            <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                <CheckCircle className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold">New Term Started!</h2>
                            <p className="text-emerald-100 mt-1">Academic session successfully updated.</p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex bg-slate-100 p-4 rounded-xl text-center items-center justify-center text-slate-700 font-medium">
                                You can now begin using the system for the new academic period.
                            </div>

                            <div className="flex justify-center pt-2">

                                <button
                                    onClick={() => setShowBillingModal(false)}
                                    className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                                >
                                    Continue to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* baseAI FLOATING BOT BUTTON & INTERACTIVE POP-UP MODAL                      */}
            {/* ========================================================================= */}

            {/* Normal Bot Button at Bottom-Right */}
            {!isAIPanelOpen && (
                <button
                    onClick={() => setIsAIPanelOpen(true)}
                    className="fixed bottom-6 right-6 z-40 flex items-center justify-center h-14 w-14 rounded-full text-white shadow-2xl hover:scale-110 active:scale-95 transition-all group border-2 border-white/40"
                    style={{ backgroundColor: theme.hex, boxShadow: `0 10px 25px -4px ${theme.hex}70` }}
                    aria-label="Open baseAI assistant"
                    title="Chat with baseAI"
                >
                    <div className="relative flex items-center justify-center">
                        <Bot className="h-7 w-7 text-white group-hover:rotate-6 transition-transform" />
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse"></span>
                    </div>
                </button>
            )}

            {/* baseAI Pop-up Chatbot Window */}
            {isAIPanelOpen && (
                <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex items-end sm:items-center justify-center">
                    {/* Backdrop for small screens */}
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-xs sm:hidden animate-in fade-in"
                        onClick={() => setIsAIPanelOpen(false)}
                    />

                    {/* Pop-up Modal Container */}
                    <div 
                        className="w-full sm:w-[420px] md:w-[460px] h-[85vh] sm:h-[580px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 z-10 animate-in zoom-in-95 slide-in-from-bottom-6 duration-300 relative"
                        style={{ boxShadow: `0 20px 40px -15px ${theme.hex}35, 0 0 0 1px ${theme.hex}20` }}
                    >
                        {/* Header */}
                        <div 
                            className="p-4 flex items-center justify-between text-white shadow-md relative overflow-hidden"
                            style={{ backgroundColor: theme.hex }}
                        >
                            <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-8 -mt-8 blur-lg pointer-events-none"></div>

                            <div className="flex items-center gap-3 relative z-10">
                                <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                                    <Bot className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-base text-white tracking-tight uppercase">baseAI</h3>
                                        <span className="bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            Online
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-white/80 font-medium truncate max-w-[200px]">
                                        {schoolConfig?.name || 'School Assistant'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 relative z-10">
                                <button
                                    onClick={() => setAiChatMessages([{
                                        sender: 'ai',
                                        text: `👋 Hello! I am **baseAI**, your school intelligence co-pilot. Ask me anything about fees, student attendance, exams, or draft instant SMS announcements.`,
                                        time: 'Just now'
                                    }])}
                                    className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/15 transition-colors"
                                    title="Reset chat conversation"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setIsAIPanelOpen(false)}
                                    className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/15 transition-colors"
                                    title="Close baseAI"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70">
                            {aiChatMessages.map((msg, index) => (
                                <div 
                                    key={index} 
                                    className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                                >
                                    {msg.sender === 'ai' && (
                                        <div 
                                            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm text-white mt-1"
                                            style={{ backgroundColor: theme.hex }}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </div>
                                    )}

                                    <div className={`max-w-[92%] md:max-w-[88%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed shadow-sm ${
                                        msg.sender === 'user' 
                                            ? 'bg-slate-900 text-white font-medium rounded-br-xs' 
                                            : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs font-normal'
                                    }`}>
                                        <div className="font-sans text-xs leading-relaxed">
                                            {msg.sender === 'user' ? msg.text : renderFormattedText(msg.text)}
                                        </div>
                                        {msg.actions && msg.actions.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                                {msg.actions.map((act: any, aIdx: number) => (
                                                    <button
                                                        key={aIdx}
                                                        onClick={() => {
                                                            if (act.menu) {
                                                                setActiveMenu(act.menu);
                                                                setIsAIPanelOpen(false);
                                                            }
                                                        }}
                                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-lg text-xs transition-colors border border-blue-200/60 shadow-2xs"
                                                    >
                                                        {act.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {msg.smsApproval && (
                                            <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl space-y-2 text-slate-800 text-xs">
                                                <div className="flex items-center justify-between font-bold text-amber-900">
                                                    <span className="flex items-center gap-1.5">📱 SMS Broadcast Approval</span>
                                                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px]">
                                                        {msg.smsApproval.total_recipients || 0} Recipients
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-amber-900/90 italic bg-white/80 p-2 rounded-lg border border-amber-100/60 leading-relaxed">
                                                    "{msg.smsApproval.message_text}"
                                                </p>
                                                {msg.smsApproval.status !== 'sent' ? (
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <button
                                                            onClick={() => handleApproveSms(msg.smsApproval, index)}
                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                                        >
                                                            <CheckCircle className="h-3.5 w-3.5" /> Approve & Send SMS
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-1.5 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-center text-xs flex items-center justify-center gap-1">
                                                        <CheckCircle className="h-4 w-4 text-emerald-600" /> SMS Sent & Posted to Notice Board!
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className={`text-[9px] mt-1.5 flex ${msg.sender === 'user' ? 'justify-end text-slate-400' : 'text-slate-400'}`}>
                                            {msg.time}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isAskingCopilot && (
                                <div className="flex items-center gap-2.5 text-slate-500 text-xs p-1 animate-in fade-in duration-200">
                                    <div 
                                        className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm"
                                        style={{ backgroundColor: theme.hex }}
                                    >
                                        <Sparkles className="h-4 w-4 animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-2 bg-white border border-slate-200/90 px-4 py-2.5 rounded-2xl shadow-xs text-slate-700">
                                        <span className="font-bold text-xs">baseAI is thinking</span>
                                        <div className="flex items-center gap-1 ml-1">
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quick Prompts */}
                        <div className="p-2 bg-white border-t border-slate-100">
                            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1 pt-0.5 px-1">
                                {[
                                    { icon: "⚡", label: "Which class owes most?" },
                                    { icon: "📱", label: "Draft fee reminder SMS" },
                                    { icon: "📚", label: "Check exam marks" },
                                    { icon: "📅", label: "Today's attendance pulse" },
                                    { icon: "📖", label: "Automatic attendance setup" }
                                ].map((chip, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAskCopilot(chip.label)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all shrink-0 border border-slate-200/50 shadow-2xs flex items-center gap-1"
                                    >
                                        <span>{chip.icon}</span> {chip.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Input Footer */}
                        <div className="p-3 bg-white border-t border-slate-200">
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleAskCopilot();
                                }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={copilotQuery}
                                    onChange={(e) => setCopilotQuery(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:bg-white transition-all"
                                    style={{ focusRingColor: theme.hex }}
                                />
                                <button
                                    type="submit"
                                    disabled={isAskingCopilot || !copilotQuery.trim()}
                                    className="p-2 rounded-xl text-white font-bold transition-all disabled:opacity-40 hover:opacity-90 shadow-sm"
                                    style={{ backgroundColor: theme.hex }}
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;