import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Bell, History, Send, StickyNote, 
  Users, AlertCircle, CheckCircle, Plus, X, Trash2, Clock,
  Sparkles, FileText, Link
} from 'lucide-react';

// --- Types ---
interface Notice {
  id: string;
  title: string;
  message: string;
  audience: 'All Staff' | 'Teaching Staff' | 'Admins Only';
  priority: 'Normal' | 'Urgent';
  date: string;
  author: string;
}

interface MessageLog {
  id: string;
  date: string;
  type: string;
  recipient: string;
  content: string;
  status: 'Delivered' | 'Failed';
}

interface CommunicationProps {
    currentUser?: {
        role: 'admin' | 'teacher';
    };
}

// --- Main Communication Component ---
const Communication: React.FC<CommunicationProps> = ({ currentUser }) => {
  const isTeacher = currentUser?.role === 'teacher';
  // If teacher, default to Notices
  const [activeTab, setActiveTab] = useState<'sms' | 'notices' | 'history'>(isTeacher ? 'notices' : 'sms');
  const [smsBalance, setSmsBalance] = useState(0);

  // Load Balance
  useEffect(() => {
    const bal = localStorage.getItem('schoolhub_sms_balance');
    setSmsBalance(bal ? parseInt(bal) : 0);
  }, []);

  const updateBalance = (newBalance: number) => {
    setSmsBalance(newBalance);
    localStorage.setItem('schoolhub_sms_balance', newBalance.toString());
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-slate-50">
      
      {/* Sticky Top Bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex justify-between items-center shadow-sm">
         <div>
            <h1 className="text-2xl font-bold text-slate-800">Communication Center</h1>
            <p className="text-slate-500 text-sm">
                {isTeacher ? 'View school updates and staff notices.' : 'Manage internal notices and external parent messaging.'}
            </p>
         </div>

         {!isTeacher && (
             <div className="flex items-center gap-4">
                 <div className="bg-slate-100 rounded-full px-4 py-1.5 flex items-center gap-2 border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">SMS Balance</span>
                    <span className={`text-sm font-bold ${smsBalance < 50 ? 'text-red-600' : 'text-blue-600'}`}>
                        {smsBalance} Units
                    </span>
                 </div>
             </div>
         )}
      </div>

      {/* Tabs */}
      <div className="px-8 pt-6">
        <div className="flex border-b border-slate-200">
            {!isTeacher && (
                <button 
                    onClick={() => setActiveTab('sms')}
                    className={`pb-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sms' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <MessageSquare className="h-4 w-4" /> SMS Blast
                </button>
            )}
            <button 
                onClick={() => setActiveTab('notices')}
                className={`pb-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'notices' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Bell className="h-4 w-4" /> Digital Notice Board
            </button>
            {!isTeacher && (
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <History className="h-4 w-4" /> History
                </button>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'sms' && !isTeacher && <ComposeSMS balance={smsBalance} onUpdateBalance={updateBalance} />}
        {activeTab === 'notices' && <NoticeBoard isTeacher={isTeacher} />}
        {activeTab === 'history' && !isTeacher && <HistoryTable />}
      </div>

    </div>
  );
};

// --- Sub-Component: ComposeSMS ---
const ComposeSMS = ({ balance, onUpdateBalance }: { balance: number, onUpdateBalance: (n: number) => void }) => {
    const [recipient, setRecipient] = useState('All Parents');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    
    // Stats for Dropdown
    const [stats, setStats] = useState({ debtors: 0, parents: 0, teachers: 0 });

    useEffect(() => {
        const students = JSON.parse(localStorage.getItem('schoolhub_students') || '[]');
        const teachers = JSON.parse(localStorage.getItem('schoolhub_teachers') || '[]');
        
        setStats({
            debtors: students.filter((s: any) => s.balance > 0).length,
            parents: students.length,
            teachers: teachers.length
        });
    }, []);

    // Variable Definitions based on Recipient
    const getVariables = () => {
        switch(recipient) {
            case 'Debtors':
                return ['{Student Name}', '{Parent Name}', '{Balance}', '{Class}'];
            case 'Results':
                return ['{Student Name}', '{Parent Name}', '{Class}', '{Position}', '{Total Score}', '{Link}'];
            case 'Teachers':
                return ['{Teacher Name}', '{Subject}'];
            default: // All Parents
                return ['{Student Name}', '{Parent Name}', '{Class}'];
        }
    };

    const insertVariable = (variable: string) => {
        if (textAreaRef.current) {
            const start = textAreaRef.current.selectionStart;
            const end = textAreaRef.current.selectionEnd;
            const text = message;
            const newText = text.substring(0, start) + variable + text.substring(end);
            setMessage(newText);
            
            // Restore focus and move cursor
            setTimeout(() => {
                if (textAreaRef.current) {
                    textAreaRef.current.focus();
                    textAreaRef.current.setSelectionRange(start + variable.length, start + variable.length);
                }
            }, 0);
        } else {
            setMessage(prev => prev + variable);
        }
    };

    const applyTemplate = (type: string) => {
        if (type === 'fee') setMessage("Dear {Parent Name}, kindly pay the outstanding GHS {Balance} for {Student Name} immediately to avoid any inconvenience.");
        if (type === 'result') setMessage("Good news {Parent Name}! {Student Name}'s results are out. Total Score: {Total Score}. View details here: {Link}");
        if (type === 'emergency') setMessage("NOTICE: School will be closed tomorrow due to heavy rains. Please stay safe.");
    };

    const handleSend = () => {
        if (!message.trim()) return;
        if (balance < 1) {
            alert("Insufficient SMS Balance.");
            return;
        }

        setLoading(true);
        setTimeout(() => {
            // Deduct Balance
            const count = recipient === 'Debtors' ? stats.debtors : recipient === 'Teachers' ? stats.teachers : stats.parents;
            // Simplified cost logic: 1 unit per recipient.
            const actualCost = Math.max(1, Math.floor(count * 0.2)); // Mock cost
            
            onUpdateBalance(balance - actualCost);

            // Add to History
            const history: MessageLog[] = JSON.parse(localStorage.getItem('schoolhub_message_history') || '[]');
            const newLog: MessageLog = {
                id: `MSG-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                type: 'SMS Blast',
                recipient: recipient,
                content: message, 
                status: 'Delivered'
            };
            localStorage.setItem('schoolhub_message_history', JSON.stringify([newLog, ...history]));

            setLoading(false);
            setMessage('');
            alert(`Success! System personalized and sent messages to ${count} recipients. ${actualCost} units deducted.`);
        }, 2000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            
            {/* Recipient Selector Grid */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-slate-500" /> Select Target Audience
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     <button 
                        onClick={() => setRecipient('Debtors')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${recipient === 'Debtors' ? 'border-primary-600 bg-primary-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                         <span className="block font-bold text-slate-700">Debtors</span>
                         <span className="text-xs text-slate-500">Fees > 0</span>
                         <span className="absolute top-3 right-3 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {stats.debtors}
                         </span>
                     </button>
                     <button 
                        onClick={() => setRecipient('All Parents')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${recipient === 'All Parents' ? 'border-primary-600 bg-primary-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                         <span className="block font-bold text-slate-700">All Parents</span>
                         <span className="text-xs text-slate-500">General Info</span>
                         <span className="absolute top-3 right-3 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {stats.parents}
                         </span>
                     </button>
                     <button 
                        onClick={() => setRecipient('Results')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${recipient === 'Results' ? 'border-primary-600 bg-primary-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                         <span className="block font-bold text-slate-700">Exam Results</span>
                         <span className="text-xs text-slate-500">Links & Scores</span>
                         <span className="absolute top-3 right-3 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {stats.parents}
                         </span>
                     </button>
                     <button 
                        onClick={() => setRecipient('Teachers')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${recipient === 'Teachers' ? 'border-primary-600 bg-primary-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                         <span className="block font-bold text-slate-700">Teachers</span>
                         <span className="text-xs text-slate-500">Staff Only</span>
                         <span className="absolute top-3 right-3 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {stats.teachers}
                         </span>
                     </button>
                </div>
            </div>

            {/* Composer */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                     <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-slate-500" /> Compose Message
                     </h3>
                     <div className="flex flex-wrap gap-2">
                        <button onClick={() => applyTemplate('fee')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-medium text-slate-600 transition-colors">Fee Template</button>
                        <button onClick={() => applyTemplate('result')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-medium text-slate-600 transition-colors">Results Template</button>
                        <button onClick={() => applyTemplate('emergency')} className="px-3 py-1 bg-red-50 hover:bg-red-100 rounded-full text-xs font-medium text-red-600 transition-colors">Emergency</button>
                     </div>
                 </div>

                 <div className="space-y-2">
                    {/* Variable Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-thin">
                         <div className="flex items-center gap-1 text-xs font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded-md whitespace-nowrap">
                             <Sparkles className="h-3 w-3" /> Personalize:
                         </div>
                         {getVariables().map(v => (
                             <button
                                key={v}
                                onClick={() => insertVariable(v)}
                                className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-xs font-mono hover:bg-white hover:border-primary-300 hover:text-primary-600 transition-colors whitespace-nowrap"
                             >
                                 {v}
                             </button>
                         ))}
                    </div>

                    <div className="relative">
                        <textarea 
                            ref={textAreaRef}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full h-40 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none resize-none font-sans text-base leading-relaxed"
                            placeholder={`Type your message here. Click variables above to insert dynamic data.\ne.g. Dear {Parent Name}...`}
                        ></textarea>
                        <div className="absolute bottom-3 right-3 text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">
                            {message.length} chars • {Math.ceil(message.length / 160) || 1} SMS unit(s)
                        </div>
                    </div>
                 </div>

                 <div className="flex justify-end">
                    <button 
                        onClick={handleSend}
                        disabled={loading || !message}
                        className="w-full md:w-auto px-8 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Personalizing & Sending...' : 'Send Blast Message'}
                        {!loading && <Send className="h-4 w-4" />}
                    </button>
                 </div>
            </div>

        </div>
    );
};

// --- Sub-Component: Notice Board ---
const NoticeBoard = ({ isTeacher }: { isTeacher: boolean }) => {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('schoolhub_notices');
        if (stored) setNotices(JSON.parse(stored));
    }, []);

    const handlePost = (notice: Notice) => {
        const updated = [notice, ...notices];
        setNotices(updated);
        localStorage.setItem('schoolhub_notices', JSON.stringify(updated));
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if(confirm('Delete this notice?')) {
            const updated = notices.filter(n => n.id !== id);
            setNotices(updated);
            localStorage.setItem('schoolhub_notices', JSON.stringify(updated));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Latest Updates</h3>
                {!isTeacher && (
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-700 shadow-md transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Post New Notice
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notices.length > 0 ? notices.map(notice => (
                    <NoticeCard key={notice.id} notice={notice} onDelete={handleDelete} isTeacher={isTeacher} />
                )) : (
                    <div className="col-span-full text-center py-12 text-slate-400">
                        <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No active notices.</p>
                    </div>
                )}
            </div>

            {isModalOpen && !isTeacher && <PostNoticeModal onClose={() => setIsModalOpen(false)} onPost={handlePost} />}
        </div>
    );
};

interface NoticeCardProps {
  notice: Notice;
  onDelete: (id: string) => void;
  isTeacher: boolean;
}

const NoticeCard: React.FC<NoticeCardProps> = ({ notice, onDelete, isTeacher }) => {
    const isUrgent = notice.priority === 'Urgent';
    return (
        <div className={`relative p-6 rounded-xl shadow-sm border transition-all hover:shadow-md hover:-translate-y-1 ${
            isUrgent ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
            {/* Pin Effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-300 shadow-sm border-2 border-white z-10"></div>
            
            <div className="flex justify-between items-start mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                    isUrgent ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                }`}>
                    {notice.priority}
                </span>
                {!isTeacher && (
                    <button onClick={() => onDelete(notice.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>

            <h3 className="font-bold text-slate-900 text-lg mb-2 leading-tight">{notice.title}</h3>
            <p className="text-slate-700 text-sm leading-relaxed mb-4 min-h-[60px]">{notice.message}</p>

            <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {notice.date}</span>
                <span className="bg-white/50 px-2 py-1 rounded">{notice.audience}</span>
            </div>
        </div>
    );
};

const PostNoticeModal = ({ onClose, onPost }: any) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
    const [audience, setAudience] = useState<'All Staff' | 'Teaching Staff' | 'Admins Only'>('All Staff');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPost({
            id: `NOT-${Date.now()}`,
            title,
            message,
            priority,
            audience,
            date: new Date().toISOString().split('T')[0],
            author: 'Admin' // Hardcoded for demo
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Post New Notice</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-600" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Staff Meeting" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                        <textarea required className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-600 h-24 resize-none" value={message} onChange={e => setMessage(e.target.value)} placeholder="Details..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                            <select className="w-full p-2 border rounded-lg outline-none bg-white" value={priority} onChange={e => setPriority(e.target.value as any)}>
                                <option value="Normal">Normal</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
                            <select className="w-full p-2 border rounded-lg outline-none bg-white" value={audience} onChange={e => setAudience(e.target.value as any)}>
                                <option value="All Staff">All Staff</option>
                                <option value="Teaching Staff">Teaching Staff</option>
                                <option value="Admins Only">Admins Only</option>
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold">Post Notice</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Sub-Component: History Table ---
const HistoryTable = () => {
    const [history, setHistory] = useState<MessageLog[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('schoolhub_message_history');
        if (stored) setHistory(JSON.parse(stored));
    }, []);

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Recipient</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase w-1/3">Content Preview</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {history.length > 0 ? history.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-600">{log.date}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-800">{log.type}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                <span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{log.recipient}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">{log.content}</td>
                            <td className="px-6 py-4 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    log.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {log.status === 'Delivered' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                    {log.status}
                                </span>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">No message history found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Communication;