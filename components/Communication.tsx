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
import { useCurrency } from '../contexts/CurrencyContext';

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
    const [activeTab, setActiveTab] = useState('notices');
    const [smsBalance, setSmsBalance] = useState(0);
    const isTeacher = currentUser.role === 'teacher';

    useEffect(() => {
        const fetchBalance = async () => {
            if (!currentUser?.school_id) return;
            const { data } = await supabase.from('schools').select('sms_balance').eq('id', currentUser.school_id).single();
            if (data) setSmsBalance(data.sms_balance || 0);
        };
        fetchBalance();
    }, [currentUser?.school_id]);

    const updateBalance = (newBalance: number) => {
        setSmsBalance(newBalance);
        // In a real app, update DB here
    };

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Communication Hub</h1>
                    <p className="text-slate-500 text-sm">Manage notices and announcements.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl w-full md:w-fit overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('notices')}
                    className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'notices' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <StickyNote className="h-4 w-4" /> <span className="hidden sm:inline">Digital Notice Board</span><span className="sm:hidden">Notices</span>
                </button>
                {!isTeacher && (
                    <>
                        <button
                            onClick={() => setActiveTab('sms')}
                            className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'sms' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <MessageSquare className="h-4 w-4" /> SMS Blast
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <History className="h-4 w-4" /> History
                        </button>
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'notices' && <NoticeBoard isTeacher={isTeacher} currentUser={currentUser} />}
                {activeTab === 'sms' && !isTeacher && <ComposeSMS balance={smsBalance} onUpdateBalance={updateBalance} currentUser={currentUser} />}
                {activeTab === 'history' && !isTeacher && <HistoryTable currentUser={currentUser} />}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const ComposeSMS = ({ balance, onUpdateBalance, currentUser }: { balance: number, onUpdateBalance: (n: number) => void, currentUser: any }) => {
    const { currency } = useCurrency();
    const [recipient, setRecipient] = useState('Debtors');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [targetStudentSearch, setTargetStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [searchingStudent, setSearchingStudent] = useState(false);
    const [studentSearchResults, setStudentSearchResults] = useState<any[]>([]);
    const [schoolName, setSchoolName] = useState('');

    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Fetch Classes
    useEffect(() => {
        const fetchClassesAndSchool = async () => {
            if (!currentUser?.school_id) return;

            // Fetch Classes
            const { data: classData } = await supabase
                .from('students')
                .select('class')
                .eq('school_id', currentUser.school_id);

            if (classData) {
                const uniqueClasses = [...new Set(classData.map((d: any) => d.class))].filter(Boolean).sort();
                setClasses(uniqueClasses);
                if (uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
            }

            // Fetch School Name if not in currentUser
            if (currentUser.school_name) {
                setSchoolName(currentUser.school_name);
            } else {
                const { data: schoolData } = await supabase.from('schools').select('name').eq('id', currentUser.school_id).single();
                if (schoolData) setSchoolName(schoolData.name);
            }
        };
        fetchClassesAndSchool();
    }, [currentUser?.school_id]);

    // Student Search Effect
    useEffect(() => {
        const searchStudents = async () => {
            if (targetStudentSearch.length < 2) {
                setStudentSearchResults([]);
                return;
            }
            setSearchingStudent(true);
            const { data } = await supabase
                .from('students')
                .select('id, name, class, parent_phone')
                .eq('school_id', currentUser.school_id)
                .ilike('name', `%${targetStudentSearch}%`)
                .limit(5);
            setStudentSearchResults(data || []);
            setSearchingStudent(false);
        };
        const timeout = setTimeout(searchStudents, 500);
        return () => clearTimeout(timeout);
    }, [targetStudentSearch, currentUser?.school_id]);


    const getVariables = () => {
        const baseVars = ['{Parent Name}', '{Student Name}', '{Student ID}', '{PIN}', '{Link}'];
        if (recipient === 'Debtors') return [...baseVars, '{Balance}', '{Due Date}'];
        if (recipient === 'Results') return [...baseVars, '{Total Score}', '{Position}'];
        return baseVars;
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
        if (type === 'fee') setMessage(`Dear {Parent Name}, kindly pay the outstanding ${currency.code} {Balance} for {Student Name} immediately to avoid any inconvenience.`);
        if (type === 'result') setMessage("Good news {Parent Name}! {Student Name}'s results are out. Total Score: {Total Score}. View details here: {Link}");
        if (type === 'portal') setMessage("Dear {Parent Name}, you can now view {Student Name}'s full report card online. \nLink: {Link}\nStudent ID: {Student ID}\nPIN: {PIN}\n\nPlease keep these credentials safe.");
        if (type === 'emergency') setMessage("NOTICE: School will be closed tomorrow due to heavy rains. Please stay safe.");
    };

    const handleSend = async () => {
        if (!message.trim()) return;
        if (balance < 1) {
            alert("Insufficient SMS Balance.");
            return;
        }

        if (recipient === 'Single Student' && !selectedStudent) {
            alert("Please select a student first.");
            return;
        }

        setLoading(true);

        try {
            // 1. Fetch Recipients with Data for Personalization
            let recipientsData: any[] = [];

            const cleanPhone = (p: string) => p?.replace(/\s+/g, '') || '';
            const PORTAL_LINK = 'https://base16.sixzones.com/login'; // Changed to login

            if (recipient === 'Debtors') {
                const { data } = await supabase
                    .from('students')
                    .select('parent_phone, parent_name, name, balance, admission_no, id, pin')
                    .gt('balance', 0)
                    .eq('school_id', currentUser.school_id)
                    .neq('parent_phone', null);

                recipientsData = data?.map((d: any) => ({
                    phone: cleanPhone(d.parent_phone),
                    vars: {
                        '{Parent Name}': d.parent_name || 'Parent',
                        '{Student Name}': d.name || 'Student',
                        '{Student ID}': d.admission_no || d.id?.substring(0, 8).toUpperCase(),
                        '{PIN}': d.pin || 'N/A',
                        '{Balance}': d.balance,
                        '{Due Date}': 'Month End',
                        '{Link}': PORTAL_LINK
                    }
                })) || [];

            } else if (recipient === 'All Parents' || recipient === 'Results') {
                const { data } = await supabase
                    .from('students')
                    .select('parent_phone, parent_name, name, admission_no, id, pin')
                    .eq('school_id', currentUser.school_id)
                    .neq('parent_phone', null);

                recipientsData = data?.map((d: any) => ({
                    phone: cleanPhone(d.parent_phone),
                    vars: {
                        '{Parent Name}': d.parent_name || 'Parent',
                        '{Student Name}': d.name || 'Student',
                        '{Student ID}': d.admission_no || d.id?.substring(0, 8).toUpperCase(),
                        '{PIN}': d.pin || 'N/A',
                        '{Total Score}': 'CHECK PORTAL',
                        '{Link}': PORTAL_LINK
                    }
                })) || [];

            } else if (recipient === 'Specific Class') {
                const { data } = await supabase
                    .from('students')
                    .select('parent_phone, parent_name, name, admission_no, id, pin')
                    .eq('school_id', currentUser.school_id)
                    .eq('class', selectedClass)
                    .neq('parent_phone', null);

                recipientsData = data?.map((d: any) => ({
                    phone: cleanPhone(d.parent_phone),
                    vars: {
                        '{Parent Name}': d.parent_name || 'Parent',
                        '{Student Name}': d.name || 'Student',
                        '{Student ID}': d.admission_no || d.id?.substring(0, 8).toUpperCase(),
                        '{PIN}': d.pin || 'N/A',
                        '{Link}': PORTAL_LINK
                    }
                })) || [];

            } else if (recipient === 'Single Student') {
                if (selectedStudent?.id) {
                    // We fetch specifically to ensure we have all fields even if search result was partial
                    const { data } = await supabase.from('students').select('*').eq('id', selectedStudent.id).single();
                    if (data && data.parent_phone) {
                        recipientsData = [{
                            phone: cleanPhone(data.parent_phone),
                            vars: {
                                '{Parent Name}': data.parent_name || 'Parent',
                                '{Student Name}': data.name,
                                '{Student ID}': data.admission_no || data.id?.substring(0, 8).toUpperCase(),
                                '{PIN}': data.pin || 'N/A',
                                '{Balance}': data.balance,
                                '{Link}': PORTAL_LINK
                            }
                        }];
                    } else {
                        alert("Selected student has no parent data."); setLoading(false); return;
                    }
                }

            } else if (recipient === 'Teachers') {
                const { data } = await supabase
                    .from('teachers')
                    .select('phone, name')
                    .eq('school_id', currentUser.school_id)
                    .neq('phone', null);

                recipientsData = data?.map((d: any) => ({
                    phone: cleanPhone(d.phone),
                    vars: {
                        '{Parent Name}': d.name,
                        '{Student Name}': 'N/A',
                        '{Student ID}': 'N/A',
                        '{PIN}': 'N/A',
                        '{Link}': PORTAL_LINK
                    }
                })) || [];
            }

            // Filter valid numbers
            recipientsData = recipientsData.filter(r => r.phone && r.phone.length >= 9);

            if (recipientsData.length === 0) {
                alert(`No valid recipients found.`);
                setLoading(false);
                return;
            }

            const actualCost = recipientsData.length;

            if (balance < actualCost) {
                alert(`Insufficient balance. You need ${actualCost} units but have ${balance}.`);
                setLoading(false);
                return;
            }

            // 3. Send SMS via Edge Function using 'recipients' payload
            const finalMessage = schoolName ? `${schoolName}\n${message}` : message;

            const { data, error } = await supabase.functions.invoke('send-sms', {
                body: {
                    recipients: recipientsData,
                    message: finalMessage,
                    hubtelKeys: {
                        clientId: import.meta.env.VITE_HUBTEL_CLIENT_ID,
                        clientSecret: import.meta.env.VITE_HUBTEL_CLIENT_SECRET,
                        senderId: import.meta.env.VITE_HUBTEL_SENDER_ID
                    }
                }
            });

            if (error) throw error;

            console.log('SMS Sent Response:', data);

            // 4. Update Balance & Log
            await onUpdateBalance(balance - recipientsData.length); // Use recipientsData.length for actual count

            // Deduct from DB
            if (currentUser?.school_id) {
                await supabase.rpc('deduct_sms_credits', { p_school_id: currentUser.school_id, p_count: recipientsData.length });
            }

            if (currentUser?.school_id) {
                await supabase.from('message_logs').insert({
                    school_id: currentUser.school_id,
                    date: new Date().toISOString().split('T')[0],
                    type: recipient === 'Single Student' ? 'Individual SMS' : 'SMS Blast',
                    recipient: recipient === 'Single Student' ? (selectedStudent?.name || 'Student') : recipient,
                    content: message,
                    status: 'Delivered'
                });
            }

            setMessage('');
            alert(`Success! Messages queued for ${recipientsData.length} recipients. accounts.`);
            if (recipient === 'Single Student') {
                setSelectedStudent(null);
                setTargetStudentSearch('');
            }

        } catch (err: any) {
            console.error(err);
            alert("Error sending SMS: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Balance Indicator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">SMS Balance</p>
                        <h3 className="text-3xl font-black mt-1">{balance.toLocaleString()}</h3>
                        <p className="text-slate-400 text-xs">credits remaining</p>
                    </div>
                    <div className="absolute right-0 top-0 p-4 opacity-10"><MessageSquare className="w-24 h-24" /></div>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-xl flex flex-col justify-center items-start shadow-sm hover:border-primary-300 transition-colors">
                    <p className="font-bold text-slate-800 mb-1">Running low?</p>
                    <p className="text-slate-500 text-xs mb-3">Top up your SMS credits to keep communicating.</p>
                    <div className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-2 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors" onClick={() => window.location.hash = '#settings'}>
                        Go to Settings &gt; Billing &gt; SMS Credits
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-slate-500" /> Select Target Audience
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        {['Debtors', 'All Parents', 'Results', 'Teachers', 'Specific Class', 'Single Student'].map((r) => (
                            <button
                                key={r}
                                onClick={() => { setRecipient(r); setTargetStudentSearch(''); setSelectedStudent(null); }}
                                className={`p-3 md:p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${recipient === r ? 'border-primary-600 bg-primary-50' : 'border-slate-100 hover:border-slate-300'}`}
                            >
                                <span className="block font-bold text-slate-700 text-sm md:text-base">{r}</span>
                            </button>
                        ))}
                    </div>

                    {/* Conditional Selectors */}
                    {recipient === 'Specific Class' && (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Select Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full md:w-1/2 p-2 border rounded-lg"
                            >
                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    )}

                    {recipient === 'Single Student' && (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Search Student</label>
                            <div className="relative max-w-md">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="Type name to search..."
                                        value={targetStudentSearch}
                                        onChange={(e) => setTargetStudentSearch(e.target.value)}
                                    />
                                </div>

                                {selectedStudent && (
                                    <div className="mt-2 flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-2 rounded-lg border border-green-100">
                                        <CheckCircle className="h-4 w-4" />
                                        Selected: <b>{selectedStudent.name}</b> ({selectedStudent.class})
                                        <button onClick={() => setSelectedStudent(null)} className="ml-auto text-xs underline">Change</button>
                                    </div>
                                )}

                                {!selectedStudent && targetStudentSearch.length >= 2 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-50">
                                        {searchingStudent ? (
                                            <div className="p-4 text-center text-xs text-slate-500">Searching...</div>
                                        ) : studentSearchResults.length > 0 ? (
                                            studentSearchResults.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => { setSelectedStudent(s); setTargetStudentSearch(''); }}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                                >
                                                    <p className="font-bold text-sm text-slate-800">{s.name}</p>
                                                    <p className="text-xs text-slate-500">{s.class} • {s.parent_phone || 'No Phone'}</p>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-xs text-slate-500">No students found.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
                        <button onClick={() => applyTemplate('portal')} className="px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-full text-xs font-medium text-blue-600 transition-colors border border-blue-100">Portal Credentials</button>
                        <button onClick={() => applyTemplate('emergency')} className="px-3 py-1 bg-red-50 hover:bg-red-100 rounded-full text-xs font-medium text-red-600 transition-colors border border-red-100">Emergency</button>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><StickyNote className="h-5 w-5 text-slate-500" /> School Notices</h2>
                {!isTeacher && (
                    <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-700 flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md">
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
        <div className="space-y-4">
            {/* Mobile History Cards */}
            <div className="md:hidden space-y-4">
                {history.length > 0 ? history.map(log => (
                    <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-bold text-slate-400 block mb-1">{log.date}</span>
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    {log.type}
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200 font-normal">{log.recipient}</span>
                                </h4>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${log.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {log.status === 'Delivered' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                {log.status}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-lg italic border border-slate-100">"{log.content}"</p>
                    </div>
                )) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">No message history found.</div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
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
        </div>
    );
};

export default Communication;