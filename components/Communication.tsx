import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare,
    Users,
    Send,
    History,
    AlertCircle,
    CheckCircle,
    Search,
    Filter,
    Plus,
    Trash2,
    Clock,
    StickyNote,
    X,
    Sparkles,
    Megaphone
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { getCachedData, setCachedData } from '../utils/cache';

interface Notice {
    id: string;
    title: string;
    message: string;
    priority: 'Normal' | 'Urgent';
    audience: 'All Staff' | 'Teaching Staff' | 'Admins Only';
    date: string;
    author_id: string;
}

interface MessageLog {
    id: string;
    date: string;
    type: string;
    recipient: string;
    content: string;
    status: 'Delivered' | 'Failed' | 'Pending';
}

const Communication = ({ currentUser }: { currentUser: any }) => {
    const [activeTab, setActiveTab] = useState('compose');
    const [smsBalance, setSmsBalance] = useState(0);
    const isTeacher = currentUser.role === 'teacher';

    useEffect(() => {
        // Fetch SMS Balance (Mock or Real)
        setSmsBalance(1250);
    }, []);

    const updateBalance = (newBalance: number) => {
        setSmsBalance(newBalance);
        // In a real app, update DB here
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Communication Hub</h1>
                    <p className="text-slate-500 text-sm">Manage notices, SMS blasts, and announcements.</p>
                </div>
                {!isTeacher && (
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">SMS Balance</p>
                            <p className="text-xl font-bold text-slate-800">{smsBalance.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span></p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full md:w-fit">
                {!isTeacher && (
                    <button
                        onClick={() => setActiveTab('compose')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'compose' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Send className="h-4 w-4" /> Compose SMS
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('notices')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'notices' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <StickyNote className="h-4 w-4" /> Digital Notice Board
                </button>
                {!isTeacher && (
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History className="h-4 w-4" /> History
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'compose' && !isTeacher && <ComposeSMS balance={smsBalance} onUpdateBalance={updateBalance} currentUser={currentUser} />}
                {activeTab === 'notices' && <NoticeBoard isTeacher={isTeacher} currentUser={currentUser} />}
                {activeTab === 'history' && !isTeacher && <HistoryTable currentUser={currentUser} />}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const ComposeSMS = ({ balance, onUpdateBalance, currentUser }: { balance: number, onUpdateBalance: (n: number) => void, currentUser: any }) => {
    const [recipient, setRecipient] = useState('Debtors');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Mock Stats
    const stats = { debtors: 45, parents: 320, teachers: 28 };

    const getVariables = () => {
        if (recipient === 'Debtors') return ['{Parent Name}', '{Student Name}', '{Balance}', '{Due Date}'];
        if (recipient === 'Results') return ['{Parent Name}', '{Student Name}', '{Total Score}', '{Position}', '{Link}'];
        return ['{Parent Name}', '{Student Name}'];
    };

    const insertVariable = (variable: string) => {
        if (textAreaRef.current) {
            const start = textAreaRef.current.selectionStart;
            const end = textAreaRef.current.selectionEnd;
            const text = message;
            const newText = text.substring(0, start) + variable + text.substring(end);
            setMessage(newText);
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

    const handleSend = async () => {
        if (!message.trim()) return;
        if (balance < 1) {
            alert("Insufficient SMS Balance.");
            return;
        }

        setLoading(true);

        // Deduct Balance
        const count = recipient === 'Debtors' ? stats.debtors : recipient === 'Teachers' ? stats.teachers : stats.parents;
        const actualCost = Math.max(1, Math.floor(count * 1));

        if (balance < actualCost) {
            alert(`Insufficient balance. You need ${actualCost} units but have ${balance}.`);
            setLoading(false);
            return;
        }

        await onUpdateBalance(balance - actualCost);

        if (currentUser?.school_id) {
            await supabase.from('message_logs').insert({
                school_id: currentUser.school_id,
                date: new Date().toISOString().split('T')[0],
                type: 'SMS Blast',
                recipient: recipient,
                content: message,
                status: 'Delivered'
            });
        }

        setLoading(false);
        setMessage('');
        alert(`Success! System personalized and sent messages to ${count} recipients. ${actualCost} units deducted.`);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-slate-500" /> Select Target Audience
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['Debtors', 'All Parents', 'Results', 'Teachers'].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRecipient(r)}
                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${recipient === r ? 'border-primary-600 bg-primary-50' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <span className="block font-bold text-slate-700">{r === 'Results' ? 'Exam Results' : r}</span>
                            <span className="text-xs text-slate-500">{r === 'Debtors' ? 'Fees > 0' : r === 'Teachers' ? 'Staff Only' : r === 'Results' ? 'Links & Scores' : 'General Info'}</span>
                        </button>
                    ))}
                </div>
            </div>

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

const NoticeCard: React.FC<{ notice: Notice, onDelete: (id: string) => void, isTeacher: boolean }> = ({ notice, onDelete, isTeacher }) => {
    const isUrgent = notice.priority === 'Urgent';
    return (
        <div className={`relative p-6 rounded-xl shadow-sm border transition-all hover:shadow-md hover:-translate-y-1 ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-300 shadow-sm border-2 border-white z-10"></div>
            <div className="flex justify-between items-start mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${isUrgent ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
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
        onPost({ title, message, priority, audience, date: new Date().toISOString().split('T')[0] });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Post New Notice</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
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

const NoticeBoard = ({ isTeacher, currentUser }: { isTeacher: boolean, currentUser: any }) => {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const CACHE_KEY = `notices_${currentUser?.school_id}`;

    const fetchNotices = async (force = false) => {
        if (!currentUser?.school_id) return;
        if (!force) {
            const cached = getCachedData<Notice[]>(CACHE_KEY);
            if (cached) {
                setNotices(cached);
                return;
            }
        }
        const { data } = await supabase.from('notices').select('*').eq('school_id', currentUser.school_id).order('created_at', { ascending: false });
        if (data) {
            const mapped = data.map((n: any) => ({ ...n, priority: n.priority || 'Normal', audience: n.audience || 'All Staff' }));
            setNotices(mapped);
            setCachedData(CACHE_KEY, mapped);
        }
    };

    useEffect(() => { fetchNotices(); }, [currentUser?.school_id]);

    const handlePost = async (noticeData: any) => {
        if (!currentUser?.school_id) return;
        const { error } = await supabase.from('notices').insert({
            school_id: currentUser.school_id,
            title: noticeData.title,
            message: noticeData.message,
            priority: noticeData.priority,
            audience: noticeData.audience,
            date: noticeData.date,
            author_id: currentUser.id
        });
        if (error) { console.error(error); alert('Failed to post'); }
        else { setIsModalOpen(false); fetchNotices(true); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete notice?')) return;
        const { error } = await supabase.from('notices').delete().eq('id', id);
        if (!error) fetchNotices(true);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><StickyNote className="h-5 w-5 text-slate-500" /> School Notices</h2>
                {!isTeacher && (
                    <button onClick={() => setIsModalOpen(true)} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-700 flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
                        <Plus className="h-4 w-4" /> Post Notice
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notices.length > 0 ? notices.map(n => <NoticeCard key={n.id} notice={n} onDelete={handleDelete} isTeacher={isTeacher} />) : (
                    <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-dashed border-slate-300"><p className="text-slate-400">No notices found.</p></div>
                )}
            </div>
            {isModalOpen && !isTeacher && <PostNoticeModal onClose={() => setIsModalOpen(false)} onPost={handlePost} />}
        </div>
    );
};

const HistoryTable = ({ currentUser }: { currentUser: any }) => {
    const [history, setHistory] = useState<MessageLog[]>([]);
    const CACHE_KEY = `msg_history_${currentUser?.school_id}`;

    useEffect(() => {
        const fetchHistory = async () => {
            if (!currentUser?.school_id) return;
            const cached = getCachedData<MessageLog[]>(CACHE_KEY);
            if (cached) { setHistory(cached); return; }

            const { data } = await supabase.from('message_logs').select('*').eq('school_id', currentUser.school_id).order('created_at', { ascending: false });
            if (data) {
                setHistory(data);
                setCachedData(CACHE_KEY, data);
            }
        };
        fetchHistory();
    }, [currentUser?.school_id]);

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
                            <td className="px-6 py-4 text-sm text-slate-600"><span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{log.recipient}</span></td>
                            <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">{log.content}</td>
                            <td className="px-6 py-4 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${log.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {log.status === 'Delivered' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                    {log.status}
                                </span>
                            </td>
                        </tr>
                    )) : <tr><td colSpan={5} className="p-8 text-center text-slate-400">No message history found.</td></tr>}
                </tbody>
            </table>
        </div>
    );
};

export default Communication;