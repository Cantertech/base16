import React, { useState, useRef } from 'react';
import {
    MessageSquare,
    Users,
    Send,
    History,
    AlertCircle,
    CheckCircle,
    Search,
    Plus,
    Trash2,
    Clock,
    StickyNote,
    X,
    Sparkles
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { sendHubtelSms, formatGhanaPhone } from '../utils/sms';
import { useCurrency } from '../contexts/CurrencyContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Loading from './Loading';

interface Notice {
    id: string;
    title: string;
    message: string;
    priority: 'Normal' | 'Urgent';
    audience: 'All Staff' | 'Teaching Staff' | 'Admins Only' | 'All Students' | 'Specific Teacher';
    date: string;
    author_id: string;
    target_user_id?: string;
    created_at?: string;
    author?: {
        full_name: string;
    };
}

interface MessageLog {
    id: string;
    date: string;
    type: string;
    recipient: string;
    content: string;
    status: 'Delivered' | 'Failed' | 'Pending';
}

// --- Fetch Functions ---

const fetchSMSBalance = async (schoolId: string) => {
    const { data } = await supabase.from('schools').select('sms_balance').eq('id', schoolId).single();
    return data?.sms_balance || 0;
};

const fetchNotices = async (schoolId: string, currentUser: any) => {
    // 1. Fetch from app_notifications (master_schema_v1.sql standard)
    const { data } = await supabase
        .from('app_notifications')
        .select(`
            id,
            school_id,
            sender_id,
            title,
            message,
            category,
            target_audience,
            target_class,
            created_at,
            author:sender_id (full_name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

    return data?.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        priority: n.category === 'Urgent' ? 'Urgent' : 'Normal',
        audience: n.target_audience === 'Teachers Only' ? 'Teaching Staff'
            : n.target_audience === 'Parents Only' ? 'All Students'
            : n.target_audience || 'All Staff',
        date: n.created_at ? n.created_at.split('T')[0] : '',
        created_at: n.created_at,
        author_id: n.sender_id,
        author: n.author
    })) || [];
};

const fetchClasses = async (schoolId: string) => {
    const { data } = await supabase.from('classes').select('name').eq('school_id', schoolId).order('name');
    if (data && data.length > 0) return data.map(c => c.name);
    return [];
};

const fetchTeachers = async (schoolId: string) => {
    const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .order('full_name');
    return data || [];
};

const fetchSchoolName = async (schoolId: string) => {
    const { data } = await supabase.from('schools').select('name').eq('id', schoolId).single();
    return data?.name || '';
};

const fetchMessageHistory = async (schoolId: string) => {
    const { data } = await supabase.from('message_logs').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
    return data || [];
};

const searchStudents = async (schoolId: string, query: string) => {
    if (query.length < 2) return [];
    const { data } = await supabase
        .from('students')
        .select('id, name, class, parent_phone')
        .eq('school_id', schoolId)
        .ilike('name', `%${query}%`)
        .limit(5);
    return data || [];
};


const Communication = ({ currentUser }: { currentUser: any }) => {
    const [activeTab, setActiveTab] = useState('notices');
    const isTeacher = currentUser.role === 'teacher';
    const schoolId = currentUser?.school_id;

    // We can fetch balance here to share, or inside ComposeSMS. Sharing is nice for header maybe?
    // But original code passed it down.
    const { data: smsBalance = 0 } = useQuery({
        queryKey: ['smsBalance', schoolId],
        queryFn: () => fetchSMSBalance(schoolId),
        enabled: !!schoolId
    });

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
                {activeTab === 'sms' && !isTeacher && <ComposeSMS balance={smsBalance} currentUser={currentUser} />}
                {activeTab === 'history' && !isTeacher && <HistoryTable currentUser={currentUser} />}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const ComposeSMS = ({ balance, currentUser }: { balance: number, currentUser: any }) => {
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const schoolId = currentUser?.school_id;

    const [recipient, setRecipient] = useState('Debtors');
    const [message, setMessage] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [targetStudentSearch, setTargetStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Queries
    const { data: classes = [] } = useQuery({
        queryKey: ['classNames', schoolId],
        queryFn: () => fetchClasses(schoolId!),
        enabled: !!schoolId
    });

    const { data: schoolName = '' } = useQuery({
        queryKey: ['schoolName', schoolId],
        queryFn: async () => {
            if (currentUser.school_name) return currentUser.school_name;
            return fetchSchoolName(schoolId);
        },
        enabled: !!schoolId
    });

    const { data: studentSearchResults = [], isFetching: searchingStudent } = useQuery({
        queryKey: ['studentSearch', schoolId, targetStudentSearch],
        queryFn: () => searchStudents(schoolId, targetStudentSearch),
        enabled: !!schoolId && targetStudentSearch.length >= 2
    });

    // Auto-select first class
    if (!selectedClass && classes.length > 0) setSelectedClass(classes[0]);

    // Mutation
    const sendSMSMutation = useMutation({
        mutationFn: async () => {
            if (!message.trim()) throw new Error("Message is empty");
            if (balance < 1) throw new Error("Insufficient SMS Balance.");
            if (recipient === 'Single Student' && !selectedStudent) throw new Error("Please select a student first.");

            // 1. Fetch Recipients
            let recipientsData: any[] = [];
            const cleanPhone = (p: string) => p?.replace(/\s+/g, '') || '';
            const PORTAL_LINK = 'https://base16.sixzones.com/login';

            if (recipient === 'Debtors') {
                const { data } = await supabase
                    .from('students')
                    .select('parent_phone, parent_name, name, balance, admission_no, id, pin')
                    .gt('balance', 0)
                    .eq('school_id', schoolId)
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
                    .eq('school_id', schoolId)
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
                    .eq('school_id', schoolId)
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
                        throw new Error("Selected student has no parent data.");
                    }
                }
            } else if (recipient === 'Teachers') {
                const { data } = await supabase
                    .from('profiles')
                    .select('phone_number, full_name')
                    .eq('school_id', schoolId)
                    .eq('role', 'teacher')
                    .not('phone_number', 'is', null);

                recipientsData = data?.map((d: any) => ({
                    phone: cleanPhone(d.phone_number),
                    vars: {
                        '{Parent Name}': d.full_name,
                        '{Student Name}': 'N/A',
                        '{Student ID}': 'N/A',
                        '{PIN}': 'N/A',
                        '{Link}': PORTAL_LINK
                    }
                })) || [];
            }

            recipientsData = recipientsData.filter(r => r.phone && r.phone.length >= 9);

            if (recipientsData.length === 0) throw new Error("No valid recipients found.");

            const actualCost = recipientsData.length;
            if (balance < actualCost) throw new Error(`Insufficient balance. You need ${actualCost} units but have ${balance}.`);

            // Send SMS via Hubtel Gateway
            await sendHubtelSms({
                recipients: recipientsData,
                message,
                schoolName
            });

            // Deduct credits RPC
            await supabase.rpc('deduct_sms_credits', { p_school_id: schoolId, p_count: recipientsData.length });

            // Log message
            await supabase.from('message_logs').insert({
                school_id: schoolId,
                date: new Date().toISOString().split('T')[0],
                type: recipient === 'Single Student' ? 'Individual SMS' : 'SMS Blast',
                recipient: recipient === 'Single Student' ? (selectedStudent?.name || 'Student') : recipient,
                content: message,
                status: 'Delivered'
            });

            return recipientsData.length;
        },
        onSuccess: (count) => {
            alert(`Success! Messages queued for ${count} recipients.`);
            setMessage('');
            queryClient.invalidateQueries({ queryKey: ['smsBalance', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['messageHistory', schoolId] });
            if (recipient === 'Single Student') {
                setSelectedStudent(null);
                setTargetStudentSearch('');
            }
        },
        onError: (error: any) => {
            alert("Error sending SMS: " + (error.message || "Unknown error"));
        }
    });


    // --- Handlers ---

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
            // Re-focus logic is tricky in strict mode with state updates on ref, but timeouts work usually
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
                                {classes.map((c: string) => <option key={c} value={c}>{c}</option>)}
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
                                            studentSearchResults.map((s: any) => (
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
                        onClick={() => sendSMSMutation.mutate()}
                        disabled={sendSMSMutation.isPending || !message}
                        className="w-full md:w-auto px-8 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sendSMSMutation.isPending ? 'Personalizing & Sending...' : 'Send Blast Message'}
                        {!sendSMSMutation.isPending && <Send className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

const NoticeCard: React.FC<{ notice: Notice, onDelete: (id: string) => void, isTeacher: boolean, currentUserId: string }> = ({ notice, onDelete, isTeacher, currentUserId }) => {
    const isUrgent = notice.priority === 'Urgent';
    const canDelete = !isTeacher || notice.author_id === currentUserId;

    return (
        <div className={`relative p-6 rounded-xl shadow-sm border transition-all hover:shadow-md hover:-translate-y-1 ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-300 shadow-sm border-2 border-white z-10"></div>
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isUrgent ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                        {notice.priority}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-white/60 text-slate-600 border border-slate-200">
                        {notice.audience === 'Specific Teacher' ? 'Private' : notice.audience}
                    </span>
                </div>
                {canDelete && (
                    <button onClick={() => onDelete(notice.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2 leading-tight">{notice.title}</h3>
            <p className="text-slate-700 text-sm leading-relaxed mb-4 min-h-[60px] whitespace-pre-wrap">{notice.message}</p>
            <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center text-[10px] font-medium text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {notice.date}</span>
                <span className="bg-white/50 px-2 py-1 rounded truncate max-w-[120px]">By: {notice.author?.full_name || 'System'}</span>
            </div>
        </div>
    );
};

const PostNoticeModal = ({ onClose, onPost, isTeacher, schoolId }: any) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
    // Teachers can ONLY post to Admins. Admins can choose audience.
    const [audience, setAudience] = useState<any>(isTeacher ? 'Admins Only' : 'All Staff');
    const [targetTeacherId, setTargetTeacherId] = useState('');

    const { data: teachers = [] } = useQuery({
        queryKey: ['teachersList', schoolId],
        queryFn: () => fetchTeachers(schoolId),
        enabled: !isTeacher && audience === 'Specific Teacher'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPost({
            title,
            message,
            priority,
            audience,
            target_user_id: audience === 'Specific Teacher' ? targetTeacherId : null,
            date: new Date().toISOString().split('T')[0]
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">
                        {isTeacher ? 'Message to School Admin' : 'Post New Notice'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 group">
                        <X className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subject / Title</label>
                        <input required type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" value={title} onChange={e => setTitle(e.target.value)} placeholder={isTeacher ? "e.g. Leave request for Monday" : "e.g. Staff Meeting"} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Detailed Message</label>
                        <textarea required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white h-32 resize-none transition-all" value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your announcement here..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Priority Level</label>
                            <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium" value={priority} onChange={e => setPriority(e.target.value as any)}>
                                <option value="Normal">Normal</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                        {!isTeacher && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Audience</label>
                                <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium" value={audience} onChange={e => setAudience(e.target.value as any)}>
                                    <option value="All Staff">All Staff</option>
                                    <option value="Teaching Staff">Teachers Only</option>
                                    <option value="All Students">Students/Parents</option>
                                    <option value="Admins Only">Admins Only</option>
                                    <option value="Specific Teacher">One Teacher</option>
                                </select>
                            </div>
                        )}
                        {isTeacher && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sent To</label>
                                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" /> School Admin
                                </div>
                            </div>
                        )}
                    </div>

                    {!isTeacher && audience === 'Specific Teacher' && (
                        <div className="animate-in slide-in-from-top-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Choose Teacher</label>
                            <select
                                required
                                className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                value={targetTeacherId}
                                onChange={e => setTargetTeacherId(e.target.value)}
                            >
                                <option value="">Select a teacher...</option>
                                {teachers.map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="pt-4 flex flex-col gap-3">
                        <button type="submit" className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-bold shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                            {isTeacher ? <Send className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {isTeacher ? 'Send Message to Admin' : 'Post Announcement'}
                        </button>
                        <button type="button" onClick={onClose} className="w-full px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors">Dismiss</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const NoticeBoard = ({ isTeacher, currentUser }: { isTeacher: boolean, currentUser: any }) => {
    const schoolId = currentUser?.school_id;
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: notices = [], isLoading } = useQuery({
        queryKey: ['notices', schoolId, currentUser?.id],
        queryFn: () => fetchNotices(schoolId, currentUser),
        enabled: !!schoolId
    });

    const postNoticeMutation = useMutation({
        mutationFn: async (noticeData: any) => {
            const category = noticeData.priority === 'Urgent' ? 'Urgent' : 'General';
            const audience = noticeData.audience === 'Teaching Staff' ? 'Teachers Only'
                : noticeData.audience === 'All Students' ? 'Parents Only'
                : 'All';

            const { error } = await supabase.from('app_notifications').insert({
                school_id: schoolId,
                sender_id: currentUser.id,
                title: noticeData.title,
                message: noticeData.message,
                category: category,
                target_audience: audience,
                target_class: noticeData.target_class || null
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['notices', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['recentNotices', schoolId] });
            alert(isTeacher ? 'Message sent to school administration.' : 'Notice posted successfully.');
        },
        onError: (err: any) => alert('Failed to post: ' + err.message)
    });

    const deleteNoticeMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('app_notifications').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notices', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['recentNotices', schoolId] });
        }
    });

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this notice/message?')) return;
        deleteNoticeMutation.mutate(id);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-primary-500" />
                    {isTeacher ? 'My Notice Board' : 'School Notices & Messages'}
                </h2>
                <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-700 flex items-center justify-center gap-2 shadow-lg shadow-primary-100 transition-all hover:-translate-y-0.5 active:translate-y-0">
                    {isTeacher ? <MessageSquare className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {isTeacher ? 'Message Admin' : 'Post New Notice'}
                </button>
            </div>

            {isLoading ? <Loading type="skeleton" fullScreen={false} /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {notices.length > 0 ? notices.map((n: any) => (
                        <NoticeCard
                            key={n.id}
                            notice={n}
                            onDelete={handleDelete}
                            isTeacher={isTeacher}
                            currentUserId={currentUser?.id}
                        />
                    )) : (
                        <div className="col-span-2 text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <StickyNote className="h-8 w-8 text-slate-300" />
                            </div>
                            <p className="text-slate-400 font-medium">No announcements or messages yet.</p>
                        </div>
                    )}
                </div>
            )}
            {isModalOpen && (
                <PostNoticeModal
                    onClose={() => setIsModalOpen(false)}
                    onPost={postNoticeMutation.mutate}
                    isTeacher={isTeacher}
                    schoolId={schoolId}
                />
            )}
        </div>
    );
};

const HistoryTable = ({ currentUser }: { currentUser: any }) => {
    const schoolId = currentUser?.school_id;

    const { data: history = [], isLoading } = useQuery({
        queryKey: ['messageHistory', schoolId],
        queryFn: () => fetchMessageHistory(schoolId),
        enabled: !!schoolId
    });

    if (isLoading) return <Loading type="skeleton" fullScreen={false} />;

    return (
        <div className="space-y-4">
            {/* Mobile History Cards */}
            <div className="md:hidden space-y-4">
                {history.length > 0 ? history.map((log: any) => (
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
                        {history.length > 0 ? history.map((log: any) => (
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