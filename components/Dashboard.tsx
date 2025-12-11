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

interface DashboardProps {
  onLogout: () => void;
  currentUser: {
    name: string;
    role: 'admin' | 'teacher';
    photo?: string | null;
    subject?: string;
    assignedClass?: string | null;
    classes?: string[]; // Specific to teacher mock
  };
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, currentUser }) => {
  const [schoolConfig, setSchoolConfig] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [financialHistory, setFinancialHistory] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState('Dashboard');

  // Header State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);

  const loadConfig = () => {
    const config = JSON.parse(localStorage.getItem('schoolhub_config') || '{}');
    setSchoolConfig(config);
  };

  useEffect(() => {
    loadConfig();
    const storedStudents = JSON.parse(localStorage.getItem('schoolhub_students') || '[]');
    const storedTrans = JSON.parse(localStorage.getItem('schoolhub_transactions') || '[]');
    const storedHistory = JSON.parse(localStorage.getItem('schoolhub_financial_history') || '[]');
    const storedNotices = JSON.parse(localStorage.getItem('schoolhub_notices') || '[]');
    
    setStudents(storedStudents);
    setTransactions(storedTrans);
    setFinancialHistory(storedHistory);
    // Get top 5 recent notices
    setRecentNotices(storedNotices.slice(0, 5));
  }, []);

  // -- Derived Stats --
  const totalStudents = students.length;
  const boysCount = students.filter(s => s.gender === 'Male').length;
  const girlsCount = students.filter(s => s.gender === 'Female').length;
  const totalEarnings = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  const totalTeachers = 12; // Mock

  const getThemeColorClass = () => {
    switch(schoolConfig?.color) {
      case 'maroon': return 'text-red-800 bg-red-50';
      case 'purple': return 'text-purple-700 bg-purple-50';
      case 'green': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-blue-600 bg-blue-50'; 
    }
  };

  const getPrimaryBg = () => {
    switch(schoolConfig?.color) {
      case 'maroon': return 'bg-red-800';
      case 'purple': return 'bg-purple-700';
      case 'green': return 'bg-emerald-600';
      default: return 'bg-blue-600';
    }
  };

  // --- MENU ITEMS ---
  const adminMenuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Students', icon: GraduationCap },
    { name: 'Teachers', icon: Users },
    { name: 'Fees', icon: Banknote },
    { name: 'Exam', icon: FileText },
    { name: 'Classes', icon: Layers }, 
    { name: 'Analytics', icon: BarChart2 },
    { name: 'Notice', icon: Bell }, 
    { name: 'Help center', icon: HelpCircle },
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
                  <p className="text-primary-600 font-bold">
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
          switch(activeMenu) {
              case 'Dashboard': 
                 return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} />;
              case 'My Students': 
                 return <Students currentUser={currentUser} />;
              case 'Mark Entry & Reports': 
                 return <Exams currentUser={currentUser} />;
              case 'Notice Board': 
                 return <Communication currentUser={currentUser} />;
              case 'Settings & Profile': 
                 return <Settings onConfigUpdate={loadConfig} currentUser={currentUser} />;
              default:
                 return <TeacherDashboardHome currentUser={currentUser} setActiveMenu={setActiveMenu} />;
          }
      }

      // 2. ADMIN ROUTES
      switch(activeMenu) {
          case 'Students': return <Students />;
          case 'Teachers': return <Teachers />;
          case 'Fees': return <Fees />;
          case 'Exam': return <Exams currentUser={currentUser} />;
          case 'Classes': return <Courses />;
          case 'Analytics': return <Analytics />;
          case 'Notice': return <Communication />;
          case 'Help center': return <HelpCenter />;
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
                             <div className={`p-4 rounded-xl ${getThemeColorClass()}`}>
                                 <GraduationCap className="h-6 w-6" />
                             </div>
                             <div>
                                 <p className="text-slate-500 text-sm font-medium">Total Students</p>
                                 <h3 className="text-2xl font-bold text-slate-800">{totalStudents}</h3>
                             </div>
                         </div>
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                             <div className="p-4 rounded-xl bg-orange-50 text-orange-600">
                                 <Users className="h-6 w-6" />
                             </div>
                             <div>
                                 <p className="text-slate-500 text-sm font-medium">Teachers</p>
                                 <h3 className="text-2xl font-bold text-slate-800">{totalTeachers}</h3>
                             </div>
                         </div>
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                             <div className="p-4 rounded-xl bg-green-50 text-green-600">
                                 <Banknote className="h-6 w-6" />
                             </div>
                             <div>
                                 <p className="text-slate-500 text-sm font-medium">Term Revenue</p>
                                 <h3 className="text-2xl font-bold text-slate-800">GH¢ {totalEarnings.toLocaleString()}</h3>
                             </div>
                         </div>
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                             <div className="p-4 rounded-xl bg-purple-50 text-purple-600">
                                 <Layers className="h-6 w-6" />
                             </div>
                             <div>
                                 <p className="text-slate-500 text-sm font-medium">Classes</p>
                                 <h3 className="text-2xl font-bold text-slate-800">12</h3>
                             </div>
                         </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Financial Trend Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                             <div className="flex justify-between items-center mb-6">
                                 <div>
                                     <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                         <TrendingUp className="h-5 w-5 text-blue-600" /> Revenue Trend
                                     </h3>
                                     <p className="text-sm text-slate-500">Monthly collection overview (2025)</p>
                                 </div>
                                 <button onClick={() => setActiveMenu('Analytics')} className="text-blue-600 text-sm font-medium hover:underline flex items-center">
                                     Full Report <ArrowUpRight className="h-4 w-4 ml-1" />
                                 </button>
                             </div>
                             
                             <div className="h-64 w-full">
                                 <ResponsiveContainer width="100%" height="100%">
                                     <AreaChart data={financialHistory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                         <defs>
                                             <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                 <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                                 <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                             </linearGradient>
                                         </defs>
                                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                         <XAxis 
                                             dataKey="month" 
                                             axisLine={false} 
                                             tickLine={false} 
                                             tick={{ fill: '#64748b', fontSize: 12 }} 
                                             dy={10}
                                         />
                                         <YAxis hide />
                                         <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                         <Area 
                                             type="monotone" 
                                             dataKey="collected" 
                                             stroke="#2563eb" 
                                             strokeWidth={3}
                                             fillOpacity={1} 
                                             fill="url(#colorRevenue)" 
                                         />
                                     </AreaChart>
                                 </ResponsiveContainer>
                             </div>
                        </div>

                        {/* Student Population / Gender */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                             <div>
                                 <h3 className="font-bold text-slate-800 mb-1">Student Composition</h3>
                                 <p className="text-sm text-slate-500 mb-6">Gender distribution ratio</p>
                                 
                                 <div className="space-y-6">
                                     <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-600 font-medium">Boys</span>
                                            <span className="font-bold text-slate-800">{boysCount} ({Math.round(boysCount/totalStudents*100)}%)</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(boysCount/totalStudents)*100}%` }}></div>
                                        </div>
                                     </div>
                                     <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-600 font-medium">Girls</span>
                                            <span className="font-bold text-slate-800">{girlsCount} ({Math.round(girlsCount/totalStudents*100)}%)</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${(girlsCount/totalStudents)*100}%` }}></div>
                                        </div>
                                     </div>
                                 </div>
                             </div>

                             <div className="mt-8 pt-6 border-t border-slate-50">
                                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h4>
                                 <div className="grid grid-cols-2 gap-3">
                                     <button onClick={() => setActiveMenu('Students')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors text-center border border-slate-100">
                                         Admit Student
                                     </button>
                                     <button onClick={() => setActiveMenu('Fees')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors text-center border border-slate-100">
                                         Collect Fees
                                     </button>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            );
      }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col fixed h-full z-10">
        {/* Logo Area */}
        <div className="h-24 flex items-center px-6 border-b border-slate-50 gap-3">
           <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 ${schoolConfig?.logo ? 'bg-white' : getPrimaryBg()}`}>
              {schoolConfig?.logo ? (
                  <img src={schoolConfig.logo} alt="School Logo" className="h-full w-full object-cover" />
              ) : (
                  <GraduationCap className="h-6 w-6 text-white" />
              )}
           </div>
           <div className="flex flex-col justify-center overflow-hidden">
              <span className="font-bold text-base text-slate-800 leading-tight truncate w-40" title={schoolConfig?.name}>
                {schoolConfig?.name || 'Orbit School'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate w-40" title={schoolConfig?.motto}>
                 {schoolConfig?.motto || 'Management System'}
              </span>
           </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {currentMenuItems.map((item) => {
            const isActive = activeMenu === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveMenu(item.name)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive 
                    ? `${getPrimaryBg()} text-white shadow-md shadow-blue-200` 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-50 space-y-1 bg-slate-50/50">
          {currentUser.role === 'admin' && (
              <button 
                onClick={() => setActiveMenu('Settings')}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    activeMenu === 'Settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <SettingsIcon className={`h-5 w-5 mr-3 ${activeMenu === 'Settings' ? 'text-slate-700' : 'text-slate-400'}`} />
                Settings
              </button>
          )}
          
          <div className="px-4 pt-2 pb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Logged in as</p>
              <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs overflow-hidden">
                      {currentUser.photo ? <img src={currentUser.photo} className="w-full h-full object-cover" /> : currentUser.name.charAt(0)}
                  </div>
                  <div className="truncate">
                      <p className="text-sm font-bold text-slate-700 truncate w-32" title={currentUser.name}>{currentUser.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{currentUser.role}</p>
                  </div>
              </div>
              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center">
            <h2 className="text-xl font-bold text-slate-800 hidden sm:block">
                Welcome Back, {currentUser.name.split(' ')[0]} 👋
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
                     className="h-10 w-10 bg-slate-100 rounded-full overflow-hidden border border-slate-200 focus:ring-2 focus:ring-primary-100 transition-all outline-none"
                   >
                      {currentUser?.photo ? (
                          <img src={currentUser.photo} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary-100 text-primary-700 font-bold">
                              {currentUser?.name.charAt(0)}
                          </div>
                      )}
                   </button>

                   {/* Dropdown */}
                   {isProfileOpen && (
                       <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                           <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                               <p className="font-bold text-slate-800 text-sm truncate">{currentUser?.name}</p>
                               <p className="text-xs text-slate-500 capitalize">{currentUser?.role}</p>
                           </div>
                           <div className="p-1">
                               {currentUser.role === 'admin' && (
                                   <button 
                                       onClick={() => { setActiveMenu('Settings'); setIsProfileOpen(false); }}
                                       className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                                   >
                                       <SettingsIcon className="h-4 w-4" /> Account Settings
                                   </button>
                               )}
                               <button 
                                   onClick={() => { setActiveMenu('Help center'); setIsProfileOpen(false); }}
                                   className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                               >
                                   <HelpCircle className="h-4 w-4" /> Help & Support
                               </button>
                               <div className="h-px bg-slate-100 my-1"></div>
                               <button 
                                   onClick={onLogout}
                                   className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                               >
                                   <LogOut className="h-4 w-4" /> Sign Out
                               </button>
                           </div>
                       </div>
                   )}
               </div>
             </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto bg-slate-50">
            {renderContent()}
        </div>

      </main>
    </div>
  );
};

// --- TEACHER DASHBOARD HOME COMPONENT ---
const TeacherDashboardHome = ({ currentUser, setActiveMenu }: { currentUser: any, setActiveMenu: (m: string) => void }) => {
    // Mock Counts based on the prompt
    const pendingMarks = 3;
    const approvalCount = 1;
    const urgentNotice = "Mandatory Staff Meeting on Friday at 2 PM";
    const assignedClasses = currentUser.classes || [currentUser.assignedClass || 'No Classes Assigned'];

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Teacher Action Hub</h1>
                <p className="text-slate-500 text-sm">Overview of your academic tasks and notices.</p>
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

            {/* CARD D: Urgent Notice */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-4">
                <div className="bg-white p-2 rounded-full shadow-sm text-orange-500 flex-shrink-0">
                    <Megaphone className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="font-bold text-orange-800 text-lg mb-1">Urgent Notice</h3>
                    <p className="text-orange-900 font-medium">{urgentNotice}</p>
                    <p className="text-orange-700/70 text-xs mt-1">Posted by Admin • Today</p>
                </div>
            </div>

        </div>
    );
}

export default Dashboard;