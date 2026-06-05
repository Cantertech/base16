import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, LogOut, Calendar, RefreshCw, AlertTriangle, Lock, Trash2, Smartphone, TrendingUp, DollarSign, Package, ShieldCheck, PlusCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface School {
    id: string;
    name: string;
    admin_email: string;
    status: string;
    created_at: string;
    next_payment_due?: string;
    last_payment_date?: string;
    student_count?: number;
    teacher_count?: number;
    sms_balance?: number;
    wallet_balance?: number;
    active_modules_count?: number;
    school_phone?: string;
    school_email?: string;
    profiles?: {
        full_name: string;
        email: string;
        role: string;
    };
}

interface SchoolDetailModalProps {
    school: School;
    onClose: () => void;
    onRenew: (id: string) => void;
    onToggleStatus: (id: string, currentStatus: string) => void;
    onImpersonate: (id: string) => void;
    onResetPassword: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (data: any) => void;
    onActivateCustomSubscriptions: (schoolId: string, moduleIds: string[], durationMonths: number) => Promise<any>;
}

const SchoolDetailModal: React.FC<SchoolDetailModalProps> = ({ school, onClose, onRenew, onToggleStatus, onImpersonate, onResetPassword, onDelete, onUpdate, onActivateCustomSubscriptions }) => {
    // --- State for Editing ---
    const [editData, setEditData] = useState({
        id: school.id,
        name: school.name,
        school_email: school.school_email || '',
        school_phone: school.school_phone || '',
        admin_name: school.profiles?.full_name || '',
        admin_email: school.profiles?.email || ''
    });

    const [selectedModules, setSelectedModules] = useState<string[]>([]);
    const [durationVal, setDurationVal] = useState<number>(1);
    const [durationUnit, setDurationUnit] = useState<'months' | 'years'>('months');
    const [isSubmittingSub, setIsSubmittingSub] = useState(false);


    // --- Queries ---
    const { data: stats = { students: 0, teachers: 0 } } = useQuery({
        queryKey: ['schoolStats', school.id],
        queryFn: async () => {
            const { count: students } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', school.id);

            const { count: teachers } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', school.id)
                .eq('role', 'teacher');

            return { students: students || 0, teachers: teachers || 0 };
        },
        enabled: !!school.id
    });


    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{school.name}</h2>
                        <p className="text-sm text-slate-500 font-mono">ID: {school.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <XCircle className="h-6 w-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto">
                    {/* STATS SECTION */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Total Students</p>
                            <p className="text-3xl font-black text-slate-900">{stats ? stats.students : '...'}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <p className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Total Teachers</p>
                            <p className="text-3xl font-black text-slate-900">{stats ? stats.teachers : '...'}</p>
                        </div>
                    </div>

                    {/* PROFILE MANAGEMENT SECTION */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
                        <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-sm tracking-widest">
                            <ShieldCheck className="h-5 w-5 text-slate-500" /> Profile Details
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">School Name</label>
                                <input
                                    type="text"
                                    value={editData.name}
                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">School Phone</label>
                                <input
                                    type="tel"
                                    value={editData.school_phone}
                                    onChange={e => setEditData({ ...editData, school_phone: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">School Email</label>
                                <input
                                    type="email"
                                    value={editData.school_email}
                                    onChange={e => setEditData({ ...editData, school_email: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Admin Name</label>
                                <input
                                    type="text"
                                    value={editData.admin_name}
                                    onChange={e => setEditData({ ...editData, admin_name: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Admin / Login Email</label>
                                <input
                                    type="email"
                                    value={editData.admin_email}
                                    onChange={e => setEditData({ ...editData, admin_email: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => onUpdate(editData)}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            <RefreshCw className="h-4 w-4" /> Save General Changes
                        </button>
                    </div>

                    {/* SUBSCRIPTION MANAGEMENT SECTION */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
                        <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-sm tracking-widest">
                            <Calendar className="h-5 w-5 text-slate-500" /> Subscription Management
                        </h3>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-widest">Status</p>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${school.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {school.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-widest">Wallet Balance</p>
                                <p className="font-black text-slate-900">GH¢ {Number(school.wallet_balance || 0).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => onImpersonate(school.id)}
                                className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                <LogOut className="h-4 w-4" /> Login as Admin
                            </button>
                            <button
                                onClick={() => onRenew(school.id)}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                <RefreshCw className="h-4 w-4" /> Approve Payment
                            </button>
                            <button
                                onClick={() => onToggleStatus(school.id, school.status)}
                                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${school.status === 'active' ? 'border-red-100 text-red-600 hover:bg-red-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}
                            >
                                {school.status === 'active' ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                {school.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                                onClick={() => onResetPassword(school.id)}
                                className="flex-1 bg-orange-100 text-orange-700 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-200 transition-all flex items-center justify-center gap-2"
                                title="Reset Admin Password to 'password123'"
                            >
                                <Lock className="h-4 w-4" /> Reset Pass
                            </button>
                        </div>

                        {/* CUSTOM SUBSCRIPTIONS OVERRIDES */}
                        <div className="border-t border-slate-200 pt-6 mt-6 space-y-6">
                            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-sm tracking-widest">
                                <PlusCircle className="h-5 w-5 text-slate-500" /> Custom Subscriptions Overrides
                            </h3>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Modules to Activate</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                        { id: 'core_system', name: 'Core System (Free)' },
                                        { id: 'revenue_guard', name: 'Revenue Guard' },
                                        { id: 'academic_engine', name: 'Academic & Parent App' },
                                        { id: 'daily_tracker', name: 'Feeding & Daily Tracker' },
                                        { id: 'prestige_pack', name: 'Prestige Pack' },
                                        { id: 'complete_bundle', name: 'The Complete Bundle (Unlock All)' },
                                    ].map((mod) => (
                                        <label key={mod.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedModules.includes(mod.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedModules([...selectedModules, mod.id]);
                                                    } else {
                                                        setSelectedModules(selectedModules.filter(id => id !== mod.id));
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{mod.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => setSelectedModules(['core_system', 'revenue_guard', 'academic_engine', 'daily_tracker', 'prestige_pack', 'complete_bundle'])}
                                        className="text-[10px] font-black uppercase text-blue-600 hover:underline"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        onClick={() => setSelectedModules([])}
                                        className="text-[10px] font-black uppercase text-slate-500 hover:underline"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration Value</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={durationVal}
                                        onChange={e => setDurationVal(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</label>
                                    <select
                                        value={durationUnit}
                                        onChange={e => setDurationUnit(e.target.value as any)}
                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="months">Months</option>
                                        <option value="years">Years</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={async () => {
                                    if (selectedModules.length === 0) {
                                        alert("Please select at least one module.");
                                        return;
                                    }
                                    const months = durationUnit === 'years' ? durationVal * 12 : durationVal;
                                    setIsSubmittingSub(true);
                                    try {
                                        await onActivateCustomSubscriptions(school.id, selectedModules, months);
                                        setSelectedModules([]);
                                    } catch (e) {
                                        // Error handled in callback/mutation
                                    } finally {
                                        setIsSubmittingSub(false);
                                    }
                                }}
                                disabled={isSubmittingSub}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                <Calendar className="h-4 w-4" />
                                {isSubmittingSub ? 'Activating...' : 'Apply Custom Subscriptions override'}
                            </button>
                        </div>

                        <div className="pt-2 border-t border-slate-200 mt-6">
                            <button
                                onClick={() => onDelete(school.id)}
                                className="w-full bg-red-50 text-red-700 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-200"
                            >
                                <Trash2 className="h-4 w-4" /> Permanently Delete School
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SuperAdminDashboardProps {
    onLogout: () => void;
    onImpersonate?: (schoolId: string) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout, onImpersonate }) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'active' | 'requests' | 'sms'>('overview');
    const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);

    // --- Queries ---

    const { data: schoolsData = { pending: [], active: [], global: { schools: 0, students: 0, revenue: 0, totalWallet: 0, totalSms: 0, avgModules: 0 } }, isLoading: schoolsLoading } = useQuery({
        queryKey: ['adminSchools'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_admin_school_stats');
            if (error) throw error;

            if (!data) return { pending: [], active: [], global: { schools: 0, students: 0, revenue: 0, totalWallet: 0, totalSms: 0, avgModules: 0 } };

            const formattedSchools = data.map((s: any) => ({
                id: s.id,
                name: s.name,
                school_phone: s.school_phone,
                school_email: s.school_email,
                status: s.status,
                created_at: s.created_at,
                next_payment_due: s.next_payment_due,
                last_payment_date: s.last_payment_date,
                student_count: Number(s.student_count) || 0,
                teacher_count: Number(s.teacher_count) || 0,
                sms_balance: Number(s.sms_balance) || 0,
                wallet_balance: Number(s.wallet_balance) || 0,
                active_modules_count: Number(s.active_modules_count) || 0,
                profiles: {
                    full_name: s.admin_name,
                    email: s.admin_email,
                    role: 'admin'
                }
            }));

            const pending = formattedSchools.filter((s: any) => s.status === 'pending');
            const active = formattedSchools.filter((s: any) => s.status === 'active');

            const totalStudents = active.reduce((sum: number, s: any) => sum + (Number(s.student_count) || 0), 0);
            const totalWallet = active.reduce((sum: number, s: any) => sum + (Number(s.wallet_balance) || 0), 0);
            const totalSms = active.reduce((sum: number, s: any) => sum + (Number(s.sms_balance) || 0), 0);
            const totalModules = active.reduce((sum: number, s: any) => sum + (Number(s.active_modules_count) || 0), 0);
            const activeCount = active.length;

            return {
                pending,
                active,
                global: {
                    schools: activeCount,
                    students: totalStudents,
                    totalWallet: totalWallet,
                    totalSms: totalSms,
                    avgModules: activeCount > 0 ? (totalModules / activeCount).toFixed(1) : 0,
                    revenue: activeCount * 500
                }
            };
        }
    });

    const { data: featureRequests = [], isLoading: ticketsLoading } = useQuery({
        queryKey: ['supportTickets'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('support_tickets')
                .select(`
                    *, 
                    schools:school_id (name),
                    profiles:user_id (full_name, email)
                `)
                .order('status', { ascending: false })
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
    });

    const { data: smsRequests = [], isLoading: smsLoading } = useQuery({
        queryKey: ['pendingSmsRequests'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sms_transactions')
                .select(`
                    *,
                    schools (name)
                `)
                .eq('status', 'Pending')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
    });


    const updateSchoolMutation = useMutation({
        mutationFn: async (updatedData: any) => {
            const { error } = await supabase.rpc('super_admin_update_school_profile', {
                p_school_id: updatedData.id,
                p_school_name: updatedData.name,
                p_school_email: updatedData.school_email,
                p_school_phone: updatedData.school_phone,
                p_admin_name: updatedData.admin_name,
                p_admin_email: updatedData.admin_email
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
            alert('School details updated successfully!');
        },
        onError: (err: any) => alert('Error updating school: ' + err.message)
    });

    const approveSchoolMutation = useMutation({
        mutationFn: async (schoolId: string) => {
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + 84);
            const { error } = await supabase.from('schools')
                .update({
                    status: 'active',
                    next_payment_due: nextDue.toISOString(),
                    last_payment_date: new Date().toISOString()
                })
                .eq('id', schoolId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
            alert('School approved successfully!');
        },
        onError: (err: any) => alert('Error approving school: ' + err.message)
    });

    const verifySmsMutation = useMutation({
        mutationFn: async (transactionId: string) => {
            const { data, error } = await supabase.rpc('verify_sms_transaction', {
                p_transaction_id: transactionId
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            if (data.success) {
                alert(data.message);
                queryClient.invalidateQueries({ queryKey: ['pendingSmsRequests'] });
                queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
            } else {
                alert(data.message);
            }
        },
        onError: (err: any) => alert('Verification Error: ' + err.message)
    });

    const renewSubscriptionMutation = useMutation({
        mutationFn: async (schoolId: string) => {
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + 84);
            const { error } = await supabase.from('schools')
                .update({
                    next_payment_due: nextDue.toISOString(),
                    last_payment_date: new Date().toISOString(),
                    status: 'active'
                })
                .eq('id', schoolId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
            alert('Payment approved!');
            setSelectedSchool(null);
        },
        onError: (err: any) => alert('Error: ' + err.message)
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, currentStatus }: { id: string, currentStatus: string }) => {
            const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
            const { error } = await supabase.from('schools').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            return newStatus;
        },
        onSuccess: (newStatus) => {
            queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
            alert(`School ${newStatus}.`);
            setSelectedSchool(null);
        },
        onError: (err: any) => alert(`Error: ${err.message}`)
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async (schoolId: string) => {
            const { error } = await supabase.rpc('reset_school_admin_password', {
                target_school_id: schoolId,
                new_password: 'password123'
            });
            if (error) throw error;
        },
        onSuccess: () => alert("Password reset to 'password123'."),
        onError: (err: any) => alert(`Failed: ${err.message}`)
    });

    const deleteSchoolMutation = useMutation({
        mutationFn: async (schoolId: string) => {
            const { data, error } = await supabase.rpc('delete_school_permanently', { target_school_id: schoolId });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
            alert(`School deleted.`);
            setSelectedSchool(null);
        },
        onError: (err: any) => alert(`Error: ${err.message}`)
    });

    const activateCustomSubscriptionsMutation = useMutation({
        mutationFn: async ({ schoolId, moduleIds, durationMonths }: { schoolId: string, moduleIds: string[], durationMonths: number }) => {
            const { data, error } = await supabase.rpc('super_admin_activate_subscriptions', {
                p_school_id: schoolId,
                p_module_ids: moduleIds,
                p_duration_months: durationMonths
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
        },
        onError: (err: any) => alert('Failed to activate subscriptions: ' + err.message)
    });

    const updateTicketStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
            alert('Status updated!');
            setSelectedTicket(null);
        },
        onError: (err: any) => alert(`Error: ${err.message}`)
    });


    // --- Handlers ---
    const approveSchool = (schoolId: string) => approveSchoolMutation.mutate(schoolId);

    const renewSubscription = (schoolId: string) => {
        if (confirm('Confirm payment received?')) renewSubscriptionMutation.mutate(schoolId);
    };

    const toggleSchoolStatus = (schoolId: string, currentStatus: string) => {
        toggleStatusMutation.mutate({ id: schoolId, currentStatus });
    };

    const resetSchoolPassword = (schoolId: string) => {
        resetPasswordMutation.mutate(schoolId);
    };

    const activateCustomSubscriptions = async (schoolId: string, moduleIds: string[], durationMonths: number) => {
        return activateCustomSubscriptionsMutation.mutateAsync({ schoolId, moduleIds, durationMonths });
    };

    const deleteSchool = async (schoolId: string) => {
        if (confirm(`PERMANENTLY DELETE?`)) deleteSchoolMutation.mutate(schoolId);
    };

    const getSubscriptionStatus = (nextPaymentDue?: string) => {
        if (!nextPaymentDue) return { status: 'Unknown', color: 'text-slate-500', bg: 'bg-slate-100' };
        const today = new Date();
        const due = new Date(nextPaymentDue);
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - due.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return { status: 'Suspended', color: 'text-red-700', bg: 'bg-red-100', icon: Lock };
        if (diffDays > 0) return { status: `Overdue`, color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle };
        return { status: 'Active', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle };
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">ORBIT <span className="text-secondary-500">SUPERADMIN</span></h1>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Global School Management & Analytics</p>
                    </div>
                    <button onClick={onLogout} className="flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-2xl shadow-sm border border-slate-100 font-black text-xs uppercase hover:bg-slate-50 transition-all">
                        <LogOut className="h-4 w-4" /> Logout
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><CheckCircle className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black text-green-500 bg-green-50 px-2.5 py-1 rounded-full">+12%</span>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Active Schools</p>
                            <h3 className="text-3xl font-black text-slate-800">{schoolsData.global.schools}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all"><DollarSign className="h-6 w-6" /></div>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Wallet Deposits</p>
                            <h3 className="text-3xl font-black text-slate-800">GH¢ {schoolsData.global.totalWallet.toLocaleString()}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all"><Package className="h-6 w-6" /></div>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Avg Modules</p>
                            <h3 className="text-3xl font-black text-slate-800">{schoolsData.global.avgModules}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-all"><Smartphone className="h-6 w-6" /></div>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total SMS Credits</p>
                            <h3 className="text-3xl font-black text-slate-800">{schoolsData.global.totalSms.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 mb-10 scrollbar-hide overflow-x-auto pb-2">
                    {[
                        { id: 'overview', label: 'Overview', icon: TrendingUp },
                        { id: 'active', label: `Active (${schoolsData.active.length})`, icon: CheckCircle },
                        { id: 'pending', label: `Pending (${schoolsData.pending.length})`, icon: Calendar },
                        { id: 'requests', label: `Tickets (${featureRequests.length})`, icon: AlertTriangle },
                        { id: 'sms', label: `SMS Req (${smsRequests.length})`, icon: Smartphone }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-2xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
                        >
                            <tab.icon className="w-4 h-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {activeTab === 'overview' ? 'Global Analytics' : activeTab === 'pending' ? 'Review Applications' : activeTab === 'active' ? 'Manage Schools' : activeTab === 'sms' ? 'Pending SMS Deliveries' : 'Resource Center'}
                        </h2>
                        {activeTab === 'overview' && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Live Updates</span>}
                    </div>

                    {schoolsLoading || ticketsLoading || smsLoading ? (
                        <div className="p-32 flex flex-col items-center justify-center text-slate-300 gap-6">
                            <RefreshCw className="w-12 h-12 animate-spin" />
                            <p className="font-black text-xs uppercase tracking-widest">Analyzing Orbit Ecosystem...</p>
                        </div>
                    ) : activeTab === 'overview' ? (
                        <div className="p-8 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Wallet Balance Distribution</h4>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={schoolsData.active.slice(0, 8)}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" fontSize={9} fontWeights="black" axisLine={false} tickLine={false} />
                                                <YAxis fontSize={9} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '15px' }}
                                                    cursor={{ fill: '#ffffff' }}
                                                />
                                                <Bar dataKey="wallet_balance" fill="#2563eb" radius={[10, 10, 0, 0]} name="Wallet (GH¢)" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Module Adoption by School</h4>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={schoolsData.active.slice(0, 8)}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" fontSize={9} fontWeights="black" axisLine={false} tickLine={false} />
                                                <YAxis fontSize={9} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '15px' }}
                                                />
                                                <Bar dataKey="active_modules_count" fill="#8b5cf6" radius={[10, 10, 0, 0]} name="Active Modules" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                    <TrendingUp className="w-4 h-4 text-secondary-500" /> Market Leaders
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                    {schoolsData.active.sort((a: any, b: any) => b.student_count - a.student_count).slice(0, 5).map((s: any, idx: number) => (
                                        <div key={s.id} className="bg-white border border-slate-100 p-6 rounded-[1.5rem] shadow-sm hover:translate-y-[-5px] transition-all">
                                            <div className="text-[9px] font-black text-blue-500 mb-2 uppercase tracking-widest">Rank #{idx + 1}</div>
                                            <div className="font-black text-slate-800 truncate mb-2 uppercase text-xs">{s.name}</div>
                                            <div className="text-xl font-black text-slate-900 leading-none">{s.student_count} <span className="text-[10px] text-slate-400 font-bold ml-1">STU</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'sms' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                                    <tr>
                                        <th className="px-8 py-6">Request ID</th>
                                        <th className="px-8 py-6">School</th>
                                        <th className="px-8 py-6">Quantity</th>
                                        <th className="px-8 py-6">Amount (Paid)</th>
                                        <th className="px-8 py-6">Requested At</th>
                                        <th className="px-8 py-6 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {smsRequests.length === 0 ? (
                                        <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-bold italic uppercase text-sm">No pending SMS requests.</td></tr>
                                    ) : (
                                        smsRequests.map((req: any) => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-6 font-mono text-[10px] text-slate-400">{req.id.slice(0, 8)}...</td>
                                                <td className="px-8 py-6 font-black text-slate-800 uppercase text-xs">{req.schools?.name}</td>
                                                <td className="px-8 py-6 font-black text-blue-600">{req.quantity.toLocaleString()} SMS</td>
                                                <td className="px-8 py-6 font-black text-green-600">GH¢ {req.amount.toFixed(2)}</td>
                                                <td className="px-8 py-6 text-[10px] text-slate-400 uppercase font-bold">{new Date(req.created_at).toLocaleString()}</td>
                                                <td className="px-8 py-6 text-center">
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Approve ${req.quantity} SMS for ${req.schools?.name}? Ensure you have topped up Hubtel.`)) {
                                                                verifySmsMutation.mutate(req.id);
                                                            }
                                                        }}
                                                        disabled={verifySmsMutation.isPending}
                                                        className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center gap-2 mx-auto"
                                                    >
                                                        {verifySmsMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                                        Verify Delivery
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'requests' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                                    <tr>
                                        <th className="px-8 py-6">ID & Status</th>
                                        <th className="px-8 py-6">Interaction Message</th>
                                        <th className="px-8 py-6">Origin School</th>
                                        <th className="px-8 py-6">User Context</th>
                                        <th className="px-8 py-6 text-center">Protocol</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {featureRequests.length === 0 ? (
                                        <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-300 font-bold italic uppercase text-sm">No active transmissions.</td></tr>
                                    ) : (
                                        featureRequests.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest w-fit ${req.status === 'Open' ? 'bg-red-50 text-red-600' : req.status === 'Resolved' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {req.status}
                                                        </span>
                                                        <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest w-fit border border-slate-200">{req.type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <p className="text-sm text-slate-800 font-bold line-clamp-2 italic leading-relaxed">"{req.message}"</p>
                                                    <p className="text-[9px] text-slate-400 mt-2 font-mono uppercase">{new Date(req.created_at).toLocaleString()}</p>
                                                </td>
                                                <td className="px-8 py-6 text-[11px] text-slate-800 font-black uppercase tracking-tight">{req.schools?.name || 'N/A'}</td>
                                                <td className="px-8 py-6">
                                                    <div className="text-[11px] font-black text-slate-800 uppercase">{req.profiles?.full_name || 'N/A'}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium">{req.profiles?.email}</div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <button onClick={() => setSelectedTicket(req)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md">Moderate</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                                    <tr>
                                        <th className="px-8 py-6">Entity Identity</th>
                                        <th className="px-8 py-6">Primary Contact</th>
                                        <th className="px-8 py-6">Registration</th>
                                        {activeTab === 'active' && <th className="px-8 py-6">Usage & Finance</th>}
                                        {activeTab === 'active' && <th className="px-8 py-6">Access Status</th>}
                                        <th className="px-8 py-6 text-center">Action Code</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(activeTab === 'pending' ? schoolsData.pending : schoolsData.active).length === 0 ? (
                                        <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-bold italic uppercase text-sm">No entities registered in this vector.</td></tr>
                                    ) : (
                                        (activeTab === 'pending' ? schoolsData.pending : schoolsData.active).map((school: any) => {
                                            const admin = school.profiles;
                                            const subStatus = getSubscriptionStatus(school.next_payment_due);
                                            const StatusIcon = subStatus.icon || CheckCircle;

                                            return (
                                                <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-8 py-6 font-black text-slate-900 uppercase text-xs tracking-tight">{school.name}</td>
                                                    <td className="px-8 py-6">
                                                        <div className="text-[11px] font-black text-slate-800 uppercase">{admin?.full_name || 'N/A'}</div>
                                                        <div className="text-[10px] text-slate-400 font-medium">{admin?.email || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-8 py-6 text-slate-500 font-mono text-[10px]">
                                                        {new Date(school.created_at).toLocaleDateString()}
                                                    </td>
                                                    {activeTab === 'active' && (
                                                        <td className="px-8 py-6">
                                                            <div className="flex flex-col gap-2 text-[9px] min-w-[140px]">
                                                                <div className="flex justify-between items-center bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-black uppercase">
                                                                    <span>Students:</span><span className="text-slate-900">{school.student_count}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg text-blue-600 font-black uppercase">
                                                                    <span>SMS Balance:</span><span className="text-blue-900">{school.sms_balance?.toLocaleString() || 0}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-emerald-600 font-black uppercase">
                                                                    <span>Wallet Ball:</span><span className="text-emerald-900">GH¢ {Number(school.wallet_balance || 0).toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-lg text-purple-600 font-black uppercase">
                                                                    <span>Modules:</span><span className="text-purple-900">{school.active_modules_count}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {activeTab === 'active' && (
                                                        <td className="px-8 py-6">
                                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${school.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                                {school.status === 'active' ? <CheckCircle className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                                                {school.status}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-8 py-6 text-center">
                                                        {activeTab === 'pending' ? (
                                                            <button
                                                                onClick={() => approveSchool(school.id)}
                                                                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-100 transition-all"
                                                            >
                                                                <CheckCircle className="h-4 w-4" /> Grant Access
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => setSelectedSchool(school)}
                                                                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-lg shadow-slate-200 transition-all"
                                                                >
                                                                    Control
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(`Reset admin password for ${school.name} to 'password123'?`)) {
                                                                            resetSchoolPassword(school.id);
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-200 transition-all"
                                                                    title="Reset Admin Password to 'password123'"
                                                                >
                                                                    <Lock className="h-3.5 w-3.5" /> Reset Pass
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {selectedTicket && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl space-y-8 border border-slate-100">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-3xl text-slate-900 uppercase tracking-tighter">Modulation Request</h3>
                            <button onClick={() => setSelectedTicket(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-300 hover:text-red-500"><XCircle className="h-7 w-7" /></button>
                        </div>

                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white px-3 py-1.5 rounded-xl border border-blue-50">{selectedTicket.type}</span>
                                <span className="text-[10px] font-bold text-slate-400 font-mono italic">{new Date(selectedTicket.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-800 font-bold italic text-xl leading-relaxed">"{selectedTicket.message}"</p>
                            <div className="pt-6 border-t border-slate-200">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Transmission Source</p>
                                <p className="text-sm font-black text-slate-900 uppercase">{selectedTicket.profiles?.full_name} <br /><span className="text-blue-600 text-xs mt-1 block">Entity: {selectedTicket.schools?.name}</span></p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Status Assignment Protocol</p>
                            <div className="grid grid-cols-2 gap-4">
                                {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => updateTicketStatusMutation.mutate({ id: selectedTicket.id, status: s })}
                                        className={`py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${selectedTicket.status === s ? 'bg-primary-600 border-primary-600 text-white shadow-2xl shadow-primary-200' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-800 hover:text-slate-800'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedSchool && (
                <SchoolDetailModal
                    school={selectedSchool}
                    onClose={() => setSelectedSchool(null)}
                    onRenew={(id) => renewSubscription(id)}
                    onToggleStatus={(id, status) => toggleSchoolStatus(id, status)}
                    onImpersonate={(id) => onImpersonate?.(id)}
                    onResetPassword={(id) => resetSchoolPassword(id)}
                    onDelete={(id) => deleteSchool(id)}
                    onUpdate={(data) => updateSchoolMutation.mutate(data)}
                    onActivateCustomSubscriptions={(schoolId, moduleIds, durationMonths) => activateCustomSubscriptions(schoolId, moduleIds, durationMonths)}
                />
            )}
        </div>
    );
};

export default SuperAdminDashboard;
