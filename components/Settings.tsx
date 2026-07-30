import React, { useState, useEffect } from 'react';
import {
    CheckCircle, User, Loader2, Save, Download, Copy,
    History, ShoppingCart, MessageSquare, AlertCircle, RefreshCw, X, ChevronRight,
    Building2, Lock, CreditCard, Upload, Gift, Layout, Smartphone,
    Eye, EyeOff
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { uploadToCloudinary } from '../utils/cloudinary';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaystackButton } from 'react-paystack';
import Loading from './Loading';

interface SettingsProps {
    onConfigUpdate: () => void;
    currentUser?: {
        id: string;
        school_id: string;
        name: string;
        role: 'admin' | 'teacher';
        school_name?: string;
    };
    hiddenMenuItems?: string[];
    toggleHiddenMenu?: (name: string) => void;
    availableMenus?: any[];
}

// --- Fetch Functions ---

const fetchSchoolSettings = async (schoolId: string) => {
    const { data: school, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();
    if (error) throw error;

    // Lazy init referral code if missing (moved from useEffect, better to strictly read here, update via mutation if needed or assume backend handles default)
    // For read-only query, we'll just return what we have.
    // If we really need to generate it, we should do it via a mutation or triggers. 
    // For now, adhering to read-only semantics for queryFn. 
    return school;
};

const fetchBillingHistory = async (schoolId: string) => {
    const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
};

const fetchSMSTransactions = async (schoolId: string) => {
    const { data, error } = await supabase
        .from('sms_transactions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

const fetchWallet = async (schoolId: string) => {
    const { data: wallet, error } = await supabase
        .from('school_wallets')
        .select('*')
        .eq('school_id', schoolId)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return wallet || { balance: 0 };
};

const fetchModules = async () => {
    const { data, error } = await supabase.from('system_modules').select('*').order('price_ghs', { ascending: true });
    if (error) throw error;
    return data || [];
};

const fetchSubscriptions = async (schoolId: string) => {
    const { data, error } = await supabase
        .from('school_subscriptions')
        .select(`
            *,
            system_modules (*)
        `)
        .eq('school_id', schoolId);
    if (error) throw error;
    return data || [];
};

const fetchStudentCount = async (schoolId: string) => {
    const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId);

    if (error) throw error;
    return count || 0;
};






const Settings: React.FC<SettingsProps> = ({ onConfigUpdate, currentUser, hiddenMenuItems, toggleHiddenMenu, availableMenus }) => {
    const queryClient = useQueryClient();
    const isTeacher = currentUser?.role === 'teacher';
    const schoolId = currentUser?.school_id;

    // -- Tabs State --
    const [activeTab, setActiveTab] = useState<'general' | 'security' | 'billing' | 'menu'>(isTeacher ? 'security' : 'general');
    const [billingTab, setBillingTab] = useState<'overview' | 'sms' | 'settings'>('overview');

    // -- Local Form States (initialized from Query Data) --
    // We'll use useEffect to sync query data to these local states for editing
    const [config, setConfig] = useState<any>({});
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [smsCalc, setSmsCalc] = useState({ amount: '', qty: '' });
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

    // Top Up Context
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');

    // -- UI States --
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showInvoice, setShowInvoice] = useState<any>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any>(null);
    const [showPasswords, setShowPasswords] = useState(false);




    // --- Queries ---

    const { data: schoolData, isLoading: schoolLoading } = useQuery({
        queryKey: ['schoolSettings', schoolId],
        queryFn: () => fetchSchoolSettings(schoolId!),
        enabled: !!schoolId && !isTeacher // Teachers might not need full school settings
    });

    const { data: billingHistory = [] } = useQuery({
        queryKey: ['billingHistory', schoolId],
        queryFn: () => fetchBillingHistory(schoolId!),
        enabled: !!schoolId && !isTeacher && activeTab === 'billing'
    });

    const { data: smsTransactions = [] } = useQuery({
        queryKey: ['smsTransactions', schoolId],
        queryFn: () => fetchSMSTransactions(schoolId!),
        enabled: !!schoolId && !isTeacher && activeTab === 'billing'
    });

    const { data: studentCount = 0 } = useQuery({
        queryKey: ['studentCount', schoolId],
        queryFn: () => fetchStudentCount(schoolId!),
        enabled: !!schoolId
    });

    const { data: wallet } = useQuery({
        queryKey: ['wallet', schoolId],
        queryFn: () => fetchWallet(schoolId!),
        enabled: !!schoolId && !isTeacher && activeTab === 'billing'
    });

    const { data: modules = [] } = useQuery({
        queryKey: ['modules'],
        queryFn: fetchModules,
        enabled: !isTeacher && activeTab === 'billing'
    });

    const { data: subscriptions = [] } = useQuery({
        queryKey: ['subscriptions', schoolId],
        queryFn: () => fetchSubscriptions(schoolId!),
        enabled: !!schoolId && !isTeacher && activeTab === 'billing'
    });



    // Sync Query Data to Local Config State
    useEffect(() => {
        if (schoolData) {
            setConfig({
                name: schoolData.name,
                motto: schoolData.motto,
                phone: schoolData.phone,
                email: schoolData.email,
                logo: schoolData.logo_url,
                current_term: schoolData.current_term,
                academic_year: schoolData.academic_year,
                color: schoolData.theme_color || 'blue',
                feeding_fee_amount: schoolData.feeding_fee_amount || 5,
                teachers_can_collect_feeding: schoolData.teachers_can_collect_feeding || false,
                referralCode: schoolData.referral_code || `BW-${Math.floor(Math.random() * 900 + 100)}`, // Fallback display
                referralPreference: schoolData.referral_preference || 'CASH',
                plan: schoolData.subscription_plan || 'Small School',
                nextPaymentDue: schoolData.next_payment_due,
                paymentConfig: schoolData.payment_config || {},
                sms_balance: schoolData.sms_balance || 0,
                admin: currentUser?.name || '',
                isExpired: schoolData.next_payment_due ? new Date(schoolData.next_payment_due) < new Date() : false
            });

            // If referral code is missing in DB, we could trigger an update here, but let's just display generated for now.
        }
    }, [schoolData, currentUser]);


    // -- Mutations --

    const updateGeneralSettingsMutation = useMutation({
        mutationFn: async (newConfig: any) => {
            const { error } = await supabase
                .from('schools')
                .update({
                    name: newConfig.name,
                    motto: newConfig.motto,
                    phone: newConfig.phone,
                    email: newConfig.email,
                    logo_url: newConfig.logo,
                    theme_color: newConfig.color,
                    referral_preference: newConfig.referralPreference,
                    feeding_fee_amount: newConfig.feeding_fee_amount,
                    teachers_can_collect_feeding: newConfig.teachers_can_collect_feeding
                })
                .eq('id', schoolId);
            if (error) throw error;

            // If email changed, update the auth user as well (this handles the "email used to signup")
            if (newConfig.email && newConfig.email !== schoolData?.email) {
                const { error: authError } = await supabase.auth.updateUser({ email: newConfig.email });
                if (authError) throw authError;
            }
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            // Update local storage for legacy/consistency
            localStorage.setItem('schoolhub_config', JSON.stringify(config));
            onConfigUpdate();

            const emailChanged = variables.email && variables.email !== schoolData?.email;
            if (emailChanged) {
                alert('Profile updated! A confirmation email has been sent to your new address. Please verify both your old and new emails to finalize the change.');
            } else {
                alert('School settings updated successfully!');
            }
        },
        onError: (err: any) => alert('Error updating settings: ' + err.message)
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (newName: string) => {
            const { error } = await supabase
                .from('profiles')
                .update({ name: newName })
                .eq('id', currentUser?.id);
            if (error) throw error;
        },
        onSuccess: () => {
            // We can't easily force App.tsx to reload user without a refresh or context update.
            // But we can alert success.
            alert('Administrator name updated successfully. Please re-login to see changes in the header.');
        },
        onError: (err: any) => alert('Error updating profile: ' + err.message)
    });

    const updatePaymentConfigMutation = useMutation({
        mutationFn: async (paymentConfig: any) => {
            const { error } = await supabase.from('schools')
                .update({ payment_config: paymentConfig })
                .eq('id', schoolId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            alert('Settings saved successfully!');
        },
        onError: (err: any) => alert('Failed to save settings: ' + err.message)
    });

    const updatePasswordMutation = useMutation({
        mutationFn: async (password: string) => {
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;
        },
        onSuccess: () => {
            setPasswords({ current: '', new: '', confirm: '' });
            alert('Password updated successfully!');
        },
        onError: (err: any) => alert("Error updating password: " + err.message)
    });

    const updatePlanMutation = useMutation({
        mutationFn: async (planName: string) => {
            const { error } = await supabase
                .from('schools')
                .update({ subscription_plan: planName })
                .eq('id', schoolId);
            if (error) throw error;
        },
        onSuccess: (data, planName) => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            setConfig((prev: any) => ({ ...prev, plan: planName }));
            alert(`Plan updated to ${planName}`);
            setShowPlanModal(false);
        },
        onError: (err: any) => alert("Error updating plan: " + err.message)
    });

    const requestSMSPurchaseMutation = useMutation({
        mutationFn: async ({ qty, amount }: { qty: number, amount: number }) => {
            const { data, error } = await supabase.rpc('request_sms_purchase', {
                p_school_id: schoolId,
                p_quantity: qty,
                p_amount: amount
            });
            if (error) throw error;

            // Trigger Admin SMS Notification
            try {
                // Ensure we use the international format (233) for reliability and pass credentials
                const adminPhone = '233502560760';

                await supabase.functions.invoke('send-sms', {
                    body: {
                        recipients: [{
                            phone: adminPhone,
                            vars: {}
                        }],
                        message: `🚀 SMS PURCHASE: ${config.name} (${currentUser?.name}) buying ${qty} SMS credits.`,
                        hubtelKeys: {
                            clientId: import.meta.env.VITE_HUBTEL_CLIENT_ID,
                            clientSecret: import.meta.env.VITE_HUBTEL_CLIENT_SECRET,
                            senderId: import.meta.env.VITE_HUBTEL_SENDER_ID || 'Base16'
                        }
                    }
                });
            } catch (err) {
                console.error("Admin notification failed:", err);
            }

            return data;
        },
        onSuccess: (data, variables) => {
            alert(`Purchase request sent! Your ${variables.qty} credits will be delivered in under 30 minutes once verified.`);
            setSmsCalc({ amount: '', qty: '' });
            setIsSmsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['smsTransactions', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['wallet', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
        },
        onError: (err: any) => alert("Error processing SMS purchase: " + err.message)
    });


    const topUpMutation = useMutation({
        mutationFn: async (amount: number) => {
            const { error } = await supabase.rpc('top_up_wallet', {
                p_school_id: schoolId,
                p_amount: amount,
                p_reference: `mock-paystack-${Date.now()}`
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wallet', schoolId] });
            alert("Wallet topped up successfully!");
        },
        onError: (err: any) => alert("Error topping up: " + err.message)
    });

    const activateModuleMutation = useMutation({
        mutationFn: async (moduleId: string) => {
            const { error } = await supabase.rpc('activate_module', {
                p_school_id: schoolId,
                p_module_id: moduleId
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wallet', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['subscriptions', schoolId] });
            alert("Module activated successfully!");
        },
        onError: (err: any) => alert("Activation error: " + err.message)
    });

    const toggleAutoRenewMutation = useMutation({
        mutationFn: async ({ moduleId, autoRenew }: { moduleId: string; autoRenew: boolean }) => {
            const { error } = await supabase
                .from('school_subscriptions')
                .update({ auto_renew: autoRenew })
                .eq('school_id', schoolId)
                .eq('module_id', moduleId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions', schoolId] });
        },
        onError: (err: any) => alert("Error updating auto-renew status: " + err.message)
    });

    // -- Handlers --

    // PWA Install Prompt Listener
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleGeneralSave = (e: React.FormEvent) => {
        e.preventDefault();
        updateGeneralSettingsMutation.mutate(config);
    };

    const handleSecuritySave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Update Password
        if (passwords.new) {
            if (passwords.new !== passwords.confirm) {
                alert("New passwords do not match.");
                return;
            }
            updatePasswordMutation.mutate(passwords.new);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                
                // Directly update the DB immediately so it doesn't move back on reload!
                const { error } = await supabase
                    .from('schools')
                    .update({ logo_url: url })
                    .eq('id', schoolId);
                if (error) throw error;
                
                setConfig({ ...config, logo: url });
                
                // Invalidate query keys to sync UI immediately
                queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
                queryClient.invalidateQueries({ queryKey: ['schoolConfig', schoolId] });
                
                // Trigger callback so Navbar/Dashboard/etc. re-fetch/update immediately
                if (onConfigUpdate) {
                    onConfigUpdate();
                }
                
                alert("Logo updated successfully!");
            } catch (error) {
                console.error("Error uploading logo:", error);
                alert("Error uploading image");
            }
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(config.referralCode);
        alert('Referral code copied to clipboard!');
    };

    // Sub-components helpers
    const currentPlan = plans.find(p => p.name === config.plan) || plans[0];


    return (
        <div className="flex flex-col lg:flex-row h-full bg-slate-50 overflow-hidden">
            {/* Sidebar Navigation (Left) */}
            <div className="w-full lg:w-64 bg-white border-r border-slate-200 flex flex-row lg:flex-col shrink-0">
                <div className="p-6 border-b border-slate-100 hidden lg:block">
                    <h2 className="font-bold text-slate-800 text-lg">Settings</h2>
                    <p className="text-slate-500 text-xs">Manage your account</p>
                </div>

                <div className="flex flex-row lg:flex-col p-2 lg:p-4 gap-2 overflow-x-auto hide-scrollbar">
                    {!isTeacher && (
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'general' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            style={activeTab === 'general' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                        >
                            <Building2 className="h-5 w-5" /> General
                        </button>
                    )}
                    {!isTeacher && (
                        <button
                            onClick={() => setActiveTab('billing')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'billing' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            style={activeTab === 'billing' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                        >
                            <CreditCard className="h-5 w-5" /> Billing & Plans
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        style={activeTab === 'security' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                    >
                        <Lock className="h-5 w-5" /> Security
                    </button>
                    <button
                        onClick={() => setActiveTab('menu')}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'menu' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        style={activeTab === 'menu' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                    >
                        <Layout className="h-5 w-5" /> Menu Customization
                    </button>
                </div>
            </div>

            {/* Main Content Area (Right) */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">

                {/* --- TAB 4: MENU --- */}
                {activeTab === 'menu' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Sidebar Customization</h2>
                            <p className="text-slate-500 text-sm">Toggle visibility of sidebar items to simplify your dashboard.</p>
                        </div>
                        <div className="space-y-3">
                            {availableMenus?.filter((m: any) => m.name !== 'Dashboard' && m.name !== 'Settings' && m.name !== 'Settings & Profile').map((item: any) => (
                                <div key={item.name} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg bg-slate-50 ${hiddenMenuItems?.includes(item.name) ? 'opacity-50' : ''}`}>
                                            <item.icon className={`h-5 w-5 ${hiddenMenuItems?.includes(item.name) ? 'text-slate-400' : 'text-blue-600'}`} />
                                        </div>
                                        <div>
                                            <span className={`font-bold block ${hiddenMenuItems?.includes(item.name) ? 'text-slate-400' : 'text-slate-800'}`}>{item.name}</span>
                                            <span className="text-xs text-slate-400">{hiddenMenuItems?.includes(item.name) ? 'Hidden from sidebar' : 'Visible'}</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={!hiddenMenuItems?.includes(item.name)}
                                            onChange={() => toggleHiddenMenu && toggleHiddenMenu(item.name)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 hover:peer-checked:bg-blue-700"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- TAB 1: GENERAL --- */}
                {activeTab === 'general' && !isTeacher && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <form onSubmit={handleGeneralSave} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">School Profile</h2>
                                <p className="text-slate-500 text-sm">Update your school's general information.</p>
                            </div>

                            <div className="flex items-center gap-4 mt-6">
                                <label htmlFor="logo-upload-input" className="h-24 w-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-primary-400 transition-colors shrink-0">
                                    {config.logo ? (
                                        <img src={config.logo} alt="Logo" className="h-full w-full object-cover" />
                                    ) : (
                                        <Upload className="h-8 w-8 text-slate-400" />
                                    )}
                                    <input id="logo-upload-input" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white text-xs font-bold">Change</p>
                                    </div>
                                </label>
                                <label htmlFor="logo-upload-input" className="cursor-pointer">
                                    <h3 className="font-bold text-slate-800 hover:text-primary-600 transition-colors">School Logo</h3>
                                    <p className="text-slate-500 text-xs">Click to upload a new logo <br className="sm:hidden" />(PNG, JPG)</p>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={config.name || ''}
                                        onChange={e => setConfig({ ...config, name: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Signup / School Email</label>
                                    <input
                                        required
                                        type="email"
                                        value={config.email || ''}
                                        onChange={e => setConfig({ ...config, email: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                        placeholder="school@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Motto</label>
                                    <input
                                        type="text"
                                        value={config.motto || ''}
                                        onChange={e => setConfig({ ...config, motto: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Admin Phone</label>
                                    <input
                                        type="tel"
                                        value={config.phone || ''}
                                        onChange={e => setConfig({ ...config, phone: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                        placeholder="020..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-3">Theme Color</label>
                                <div className="flex gap-4 items-center flex-wrap">
                                    {['blue', 'green', 'maroon', 'purple'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setConfig({ ...config, color })}
                                            className={`h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${config.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                                                }`}
                                            style={{
                                                backgroundColor: color === 'maroon' ? '#991b1b' : color === 'purple' ? '#7e22ce' : color === 'green' ? '#059669' : '#2563eb'
                                            }}
                                        >
                                            {config.color === color && <CheckCircle className="text-white h-5 w-5" />}
                                        </button>
                                    ))}
                                    <div className="relative group">
                                        <input
                                            type="color"
                                            value={config.color?.startsWith('#') ? config.color : '#000000'}
                                            onChange={(e) => setConfig({ ...config, color: e.target.value })}
                                            className="h-10 w-10 rounded-full overflow-hidden cursor-pointer border-0 p-0"
                                            title="Custom Color"
                                        />
                                        {config.color?.startsWith('#') && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <CheckCircle className="text-white h-5 w-5 drop-shadow-md" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={updateGeneralSettingsMutation.isPending}
                                    className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-70"
                                    style={config.color?.startsWith('#') ? { backgroundColor: config.color } : {}}
                                >
                                    {updateGeneralSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    {!updateGeneralSettingsMutation.isPending && <Save className="h-4 w-4" />}
                                </button>
                            </div>
                        </form>



                        {/* App Installation Card */}
                        {!window.matchMedia('(display-mode: standalone)').matches && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Smartphone className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">Install Base16 App</h3>
                                        <p className="text-slate-500 text-sm max-w-sm">
                                            Install the Base16 app on your device for easier access and a better experience.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleInstallApp}
                                    disabled={!deferredPrompt}
                                    className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${deferredPrompt
                                        ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-slate-800/30 hover:-translate-y-0.5'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed hidden' // Hidden if not installable
                                        }`}
                                >
                                    <Download className="h-5 w-5" />
                                    {deferredPrompt ? 'Install App' : 'App Installed'}
                                </button>
                            </div>
                        )}

                        {/* Referral Hub */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden mt-8">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Gift className="h-32 w-32 transform rotate-12" />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-white/20 p-2 rounded-lg">
                                        <Gift className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg">Base16 Referral Hub</h3>
                                </div>
                                <p className="text-purple-100 text-sm mb-6 max-w-lg">
                                    Refer other schools to Base16 and earn rewards! Share your unique referral code below.
                                </p>

                                <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-sm">
                                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <div>
                                            <p className="text-purple-200 text-xs uppercase font-bold tracking-wider mb-1">Your Referral Code</p>
                                            <p className="text-2xl font-mono font-bold tracking-widest">{config.referralCode || 'LOADING...'}</p>
                                        </div>
                                        <button
                                            onClick={handleCopyCode}
                                            className="bg-white text-purple-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-purple-50 transition-colors flex items-center gap-2 shadow-sm"
                                        >
                                            <Copy className="h-4 w-4" /> Copy Code
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}



                {/* --- TAB 2: SECURITY --- */}
                {activeTab === 'security' && (
                    <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Security & Access</h2>
                            <p className="text-slate-500 text-sm">
                                {isTeacher ? "Manage your teacher login credentials." : "Manage admin credentials and access control."}
                            </p>
                        </div>

                        <form onSubmit={handleSecuritySave} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="">
                                <h3 className="font-bold text-slate-800 mb-4">Change Password</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showPasswords ? "text" : "password"}
                                                value={passwords.new}
                                                onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                                className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords(!showPasswords)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showPasswords ? "text" : "password"}
                                                value={passwords.confirm}
                                                onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                                className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords(!showPasswords)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={updatePasswordMutation.isPending}
                                    className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-70"
                                    style={config.color?.startsWith('#') ? { backgroundColor: config.color } : {}}
                                >
                                    {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                                    {!updatePasswordMutation.isPending && <Lock className="h-4 w-4" />}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* --- TAB 3: BILLING --- */}
                {activeTab === 'billing' && !isTeacher && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex flex-col gap-2">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Billing & Credits</h2>
                                <p className="text-slate-500 text-sm">Manage subscription, SMS credits, and payment methods.</p>
                            </div>
                        </div>

                        {/* Wallet Card */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <CreditCard className="h-32 w-32 transform rotate-12" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Wallet Balance</p>
                                    <h3 className="text-4xl font-black mt-1">GH¢ {wallet?.balance ? Number(wallet.balance).toFixed(2) : '0.00'}</h3>
                                    <p className="text-slate-400 text-sm mt-2">Top up your wallet to activate modules and buy SMS credits.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        setIsTopUpModalOpen(true);
                                        setTopUpAmount('');
                                    }} className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-100 transition-colors">
                                        Top Up Wallet
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Sub Navigation */}
                        <div className="flex flex-wrap gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
                            <button onClick={() => setBillingTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingTab === 'overview' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Overview</button>
                            <button onClick={() => setBillingTab('sms')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${billingTab === 'sms' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:text-primary-600'}`}>
                                <Smartphone className="w-4 h-4" /> SMS Credits
                            </button>
                            <button onClick={() => setBillingTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingTab === 'settings' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Settings</button>
                        </div>

                        {/* SUB-TAB: OVERVIEW */}
                        {billingTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Modules List */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                                        <Layout className="h-5 w-5 text-slate-500" />
                                        <h3 className="font-bold text-slate-800">System Modules</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {modules.map((module: any) => {
                                            const sub = subscriptions.find((s: any) => s.module_id === module.id);
                                            const isActive = sub?.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) >= new Date());

                                            const isFree = module.price_ghs === 0;
                                            const isActivating = activateModuleMutation.isPending && activateModuleMutation.variables === module.id;

                                            return (
                                                <div key={module.id} className={`bg-white rounded-xl border p-5 flex flex-col justify-between ${isActive ? 'border-primary-500 ring-1 ring-primary-500 shadow-md' : 'border-slate-200'}`}>
                                                    <div>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-slate-800">{module.name}</h4>
                                                            {isActive && <span className="text-[10px] font-bold uppercase tracking-widest bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Active</span>}
                                                            {!isActive && isFree && <span className="text-[10px] font-bold uppercase tracking-widest bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Free Always</span>}
                                                        </div>
                                        <p className="text-xs text-slate-500 mb-4">{module.description}</p>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-end justify-between mb-4">
                                                            <div className="font-black text-lg text-slate-800">GH¢ {module.price_ghs} <span className="text-xs font-medium text-slate-500">/ 30 days</span></div>
                                                        </div>

                                                        {isActive && sub.expires_at ? (
                                                            <div className="text-xs text-slate-500 mb-3 bg-slate-50 px-3 py-2.5 rounded-lg space-y-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span>Expires:</span>
                                                                    <span className="font-bold text-slate-700">{new Date(sub.expires_at).toLocaleDateString()}</span>
                                                                </div>
                                                                {module.price_ghs > 0 && (
                                                                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-150">
                                                                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Auto-Renew</span>
                                                                        <button
                                                                            onClick={() => toggleAutoRenewMutation.mutate({ moduleId: module.id, autoRenew: !sub.auto_renew })}
                                                                            disabled={toggleAutoRenewMutation.isPending}
                                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all border ${
                                                                                sub.auto_renew 
                                                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                                                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                                                            }`}
                                                                        >
                                                                            {sub.auto_renew ? 'Enabled' : 'Disabled (Click to Turn On)'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : null}

                                                        <button
                                                            disabled={isActive || isActivating || (wallet?.balance < module.price_ghs && !isFree)}
                                                            onClick={() => {
                                                                if (confirm(`Activate ${module.name} for GH¢ ${module.price_ghs}?`)) {
                                                                    activateModuleMutation.mutate(module.id);
                                                                }
                                                            }}
                                                            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${isActive ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : wallet?.balance >= module.price_ghs || isFree ? 'bg-slate-900 text-white shadow-md hover:bg-slate-800' : 'bg-red-50 text-red-500 cursor-not-allowed border border-red-200'}`}
                                                        >
                                                            {isActive ? 'Currently Active' : isActivating ? 'Activating...' : wallet?.balance >= module.price_ghs || isFree ? 'Activate Module' : 'Insufficient Funds'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: SMS CREDITS */}
                        {billingTab === 'sms' && (
                            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6">
                                {/* Buy Credits Info Card */}
                                <div className="bg-transparent lg:bg-white p-0 lg:p-6 justify-center flex flex-col items-center rounded-2xl lg:border border-slate-200 lg:shadow-sm space-y-0 lg:space-y-6 text-center">
                                    <div className="bg-primary-50 p-4 rounded-full text-primary-600 mb-2 hidden lg:flex">
                                        <Smartphone className="w-10 h-10" />
                                    </div>
                                    <div className="hidden lg:block">
                                        <h3 className="font-bold text-slate-800 text-xl">Top Up SMS Balance</h3>
                                        <p className="text-slate-500 text-sm mt-2 max-w-[250px] mx-auto">Purchase credits to send bulk messages to parents and staff.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSmsCalc({ amount: '', qty: '' });
                                            setIsSmsModalOpen(true);
                                        }}
                                        className="w-full max-w-[250px] bg-primary-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 hover:scale-105 transition-all flex justify-center items-center gap-2"
                                    >
                                        <CreditCard className="w-5 h-5" /> Buy Credits via Wallet
                                    </button>
                                </div>

                                {/* Balance & History */}
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Smartphone className="h-32 w-32" />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-2">Available Credits</p>
                                            <h3 className="text-4xl font-black">{config.sms_balance ? config.sms_balance.toLocaleString() : 0}</h3>
                                            <p className="text-blue-200 text-sm mt-1">SMS Remaining</p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-64 overflow-y-auto">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                                            <h3 className="font-bold text-slate-700 text-sm">Purchase History</h3>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {smsTransactions.map((tx: any, i: number) => (
                                                <div key={i} className="p-4 flex justify-between items-center text-sm">
                                                    <div>
                                                        <p className="font-bold text-slate-800">{tx.quantity} Credits</p>
                                                        <span className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-900">GH¢ {tx.amount.toFixed(2)}</p>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${tx.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{tx.status}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {smsTransactions.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">No purchases yet.</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: SETTINGS */}
                        {billingTab === 'settings' && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Parent Payment Settings</h3>
                                    <p className="text-slate-500 text-sm">Configure how parents can pay school fees.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Money Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0244123456 (John Doe)"
                                            value={config.paymentConfig?.momo_number || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, momo_number: e.target.value }
                                            })}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. GCB Bank"
                                            value={config.paymentConfig?.bank_name || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, bank_name: e.target.value }
                                            })}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            placeholder="Account No."
                                            value={config.paymentConfig?.account_number || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, account_number: e.target.value }
                                            })}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Instructions</label>
                                        <textarea
                                            rows={3}
                                            placeholder="e.g. Please use Child Name as Reference. Dial *170#..."
                                            value={config.paymentConfig?.instructions || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, instructions: e.target.value }
                                            })}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => updatePaymentConfigMutation.mutate(config.paymentConfig)}
                                        disabled={updatePaymentConfigMutation.isPending}
                                        className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-900 transition-colors disabled:opacity-50"
                                    >
                                        {updatePaymentConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Plan Upgrade Modal */}
            {showPlanModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Choose Your Plan</h3>
                                <p className="text-slate-500 text-sm">Upgrade anytime. Downgrades available only upon renewal.</p>
                            </div>
                            <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plans.map((plan) => {
                                const isCurrent = config.plan === plan.name;
                                const currentPlanObj = plans.find(p => p.name === config.plan) || plans[0];
                                const isUpgrade = plan.rank > currentPlanObj.rank;
                                const isSame = plan.rank === currentPlanObj.rank;
                                const canSelect = isUpgrade || isSame || config.isExpired;

                                return (
                                    <div key={plan.name} className={`border-2 rounded-xl p-6 relative flex flex-col ${isCurrent ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600 scale-[1.02] shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}>
                                        {isCurrent && (
                                            <div className="absolute top-0 right-0 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">
                                                CURRENT PLAN
                                            </div>
                                        )}
                                        <h4 className="font-bold text-lg text-slate-800 mb-1">{plan.name}</h4>
                                        <p className="text-3xl font-bold text-slate-900 mb-4">GH¢ {plan.price}<span className="text-sm font-normal text-slate-500"> / student / term</span></p>

                                        <ul className="space-y-2 mb-6 flex-1">
                                            {plan.features.map((feat, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                                    <span>{feat}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {isCurrent && !config.isExpired ? (
                                            <button disabled className="w-full py-2.5 rounded-lg font-bold text-sm bg-slate-200 text-slate-400 cursor-not-allowed">
                                                Current Active Plan
                                            </button>
                                        ) : (
                                            <button
                                                disabled={!canSelect}
                                                onClick={() => {
                                                    // If switching to a new plan, we assume they need to pay/confirm. 
                                                    // For now, let's open payment modal for the selected plan.
                                                    setSelectedPlanForPayment(plan);
                                                    setShowPaymentModal(true);
                                                    setShowPlanModal(false);
                                                }}
                                                className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${canSelect ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                            >
                                                {!canSelect ? 'Available on Renewal' : isCurrent ? 'Renew Current Plan' : isUpgrade ? 'Upgrade Now' : 'Switch & Renew'}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showPaymentModal && selectedPlanForPayment && (
                <PaymentDetailsModal
                    plan={selectedPlanForPayment}
                    studentCount={studentCount}
                    onClose={() => setShowPaymentModal(false)}
                    schoolName={config.name}
                    isUpgrade={selectedPlanForPayment.name !== config.plan}
                    onConfirmSub={() => {
                        // After successful payment (hypothetically), update the plan
                        updatePlanMutation.mutate(selectedPlanForPayment.name);
                        setShowPaymentModal(false);
                    }}
                />
            )}

            {/* Invoice Modal */}
            {showInvoice && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <div className="text-center mb-6">
                            <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Order Placed!</h3>
                            <p className="text-slate-500 text-sm">Please complete payment to verify.</p>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Service</span>
                                <span className="font-bold text-slate-800">{showInvoice.qty} SMS Credits</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Amount Due</span>
                                <span className="font-bold text-primary-600 text-lg">GH¢ {Number(showInvoice.amount).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="text-center space-y-2 mb-6">
                            <p className="text-xs font-bold text-slate-500 uppercase">Payment Instructions</p>
                            <p className="text-sm text-slate-600">Send <b>GH¢ {Number(showInvoice.amount).toFixed(2)}</b> to:</p>
                            <p className="text-2xl font-black text-slate-800 tracking-wider">050 256 0760</p>
                            <p className="text-xs text-slate-400 bg-yellow-50 text-yellow-700 p-2 rounded">Credits are verified within 20 minutes of payment.</p>
                        </div>

                        <button onClick={() => setShowInvoice(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">
                            Okay, I've sent it
                        </button>
                    </div>
                </div>
            )}
            {/* Custom Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300 border border-green-100 ring-4 ring-green-50 pointer-events-auto">
                        <div className="bg-green-100 rounded-full p-3 text-green-600">
                            <CheckCircle className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Success!</h3>
                            <p className="text-slate-500 text-sm">Academic session updated successfully.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Up Wallet Modal */}
            {isTopUpModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                        <button
                            onClick={() => setIsTopUpModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Top Up Wallet</h3>
                            <p className="text-sm text-slate-500 mt-2">Enter the amount you wish to add to your virtual wallet.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (GH¢)</label>
                                <input
                                    type="number"
                                    value={topUpAmount}
                                    onChange={e => setTopUpAmount(e.target.value)}
                                    placeholder="e.g. 500.00"
                                    className="w-full text-center text-3xl font-black text-slate-800 py-4 border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 outline-none transition-all placeholder:text-slate-300"
                                    autoFocus
                                />
                            </div>

                            {(!topUpAmount || Number(topUpAmount) <= 0 || topUpMutation.isPending) ? (
                                <button
                                    disabled
                                    className="w-full bg-primary-600 text-white rounded-xl py-3.5 font-bold text-sm shadow-lg transition-all opacity-50 flex items-center justify-center gap-2"
                                >
                                    {topUpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                    {topUpMutation.isPending ? 'Processing...' : 'Proceed to Payment'}
                                </button>
                            ) : (
                                <PaystackButton
                                    className="w-full bg-primary-600 text-white rounded-xl py-3.5 font-bold text-sm shadow-lg hover:shadow-primary-600/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                    email={(config.email && config.email.trim() !== '') ? config.email.trim() : 'billing@base16schools.com'}
                                    amount={Math.round(Number(topUpAmount) * 100)}
                                    publicKey={import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''}
                                    text="Proceed to Payment"
                                    currency="GHS"
                                    reference={`top-up-${new Date().getTime().toString()}`}
                                    onSuccess={(reference) => {
                                        topUpMutation.mutate(Number(topUpAmount), {
                                            onSuccess: () => {
                                                setIsTopUpModalOpen(false);
                                                setTopUpAmount('');
                                            }
                                        });
                                    }}
                                    onClose={() => {
                                        console.log("Paystack dialog closed");
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase SMS Modal */}
            {isSmsModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                        <button
                            onClick={() => setIsSmsModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Purchase SMS Credits</h3>
                            <p className="text-slate-500 text-sm mt-1">Deducting from your digital wallet balance.</p>
                            <div className="mt-2 text-[10px] items-center gap-1.5 font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full inline-flex border border-orange-100">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Delivered in Under 30 Mins
                            </div>
                            <div className="mt-3 bg-slate-50 rounded-lg p-2 font-black text-primary-700 tracking-wide block border border-slate-100 text-xs">Rate: GH¢ 0.035 / SMS</div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity (SMS limit)</label>
                                <input
                                    type="number"
                                    value={smsCalc.qty}
                                    onChange={e => {
                                        const q = Number(e.target.value);
                                        setSmsCalc({ qty: e.target.value, amount: (q * 0.035).toFixed(2) });
                                    }}
                                    placeholder="e.g. 1000"
                                    className="w-full px-4 py-3 bg-slate-50 font-bold text-lg border border-slate-200 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 rounded-xl outline-none transition-all"
                                />
                            </div>

                            <div className="flex justify-center -my-1 relative z-10">
                                <div className="bg-white border text-slate-400 border-slate-200 rounded-full p-1.5 shadow-sm transform">
                                    <Layout className="w-4 h-4 rotate-90" />
                                </div>
                            </div>

                            <div className="-mt-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deducting Amount (GH¢)</label>
                                <input
                                    type="number"
                                    value={smsCalc.amount}
                                    onChange={e => {
                                        const a = Number(e.target.value);
                                        setSmsCalc({ amount: e.target.value, qty: Math.floor(a / 0.035).toString() });
                                    }}
                                    placeholder="e.g. 50.00"
                                    className="w-full px-4 py-3 bg-slate-50 font-bold text-lg border border-slate-200 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 rounded-xl outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="mb-6 bg-slate-100/50 rounded-xl p-3 border border-slate-200 border-dashed flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium tracking-tight">Your Wallet Balance:</span>
                            <span className={`font-black ${wallet?.balance < Number(smsCalc.amount) ? 'text-red-500' : 'text-slate-800'}`}>
                                GH¢ {wallet?.balance ? Number(wallet.balance).toFixed(2) : '0.00'}
                            </span>
                        </div>

                        <button
                            disabled={!smsCalc.qty || Number(smsCalc.qty) <= 0 || requestSMSPurchaseMutation.isPending || (wallet?.balance < Number(smsCalc.amount))}
                            onClick={() => {
                                if (!confirm(`Confirm purchase of ${smsCalc.qty} SMS for GH¢ ${smsCalc.amount} from your wallet?`)) return;
                                requestSMSPurchaseMutation.mutate({ qty: Number(smsCalc.qty), amount: Number(smsCalc.amount) });
                            }}
                            className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 
                            ${wallet?.balance >= Number(smsCalc.amount)
                                    ? 'bg-primary-600 shadow-primary-900/20 text-white hover:bg-primary-700 disabled:opacity-70'
                                    : 'bg-red-50 text-red-500 border-red-200 border cursor-not-allowed shadow-none'}`}
                        >
                            {requestSMSPurchaseMutation.isPending ? 'Processing Purchase...' : wallet?.balance >= Number(smsCalc.amount) ? 'Purchase SMS' : 'Insufficient Balance'}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

const plans = [
    {
        name: "Foundation Package",
        price: "4",
        rank: 1,
        limit: "Per Student / Term",
        features: [
            "School Management (Records, Classes)",
            "Results & Academics (Report Cards)",
            "Parent Access (Online Portal)",
            "Communication (Bulk SMS Pay-as-you-go)",
            "Secure Cloud Storage"
        ]
    },
    {
        name: "Performance Package",
        price: "20",
        rank: 2,
        limit: "Per Student / Term",
        isPopular: true,
        features: [
            "✅ FREE School Management System",
            "✅ FREE Bulk SMS (Fair Usage)",
            "🎓 Student Learning App (Quizzes & BECE)",
            "🤖 Automatic Marking & Analytics",
            "📊 Parent Performance Insights App",
            "💰 Ideal to pass on as a Learning Fee"
        ]
    }
];

const PaymentDetailsModal = ({ plan, studentCount, onClose, schoolName, isUpgrade, onConfirmSub }: any) => {
    const [payMethod, setPayMethod] = useState<'card' | 'bank'>('card');
    const [isProcessing, setIsProcessing] = useState(false);

    // Billing Calculation
    const pricePerStudent = Number(plan.price);
    const count = studentCount || 0;
    const totalBill = pricePerStudent * count;

    // Installment State
    const [amountToPay, setAmountToPay] = useState<string>(totalBill.toString());

    const handlePaystack = () => {
        setIsProcessing(true);
        const payAmount = Number(amountToPay);

        if (payAmount <= 0) {
            alert("Please enter a valid amount.");
            setIsProcessing(false);
            return;
        }

        // Mock Paystack integration with dynamic amount
        setTimeout(() => {
            const isPartial = payAmount < totalBill;
            const message = isPartial
                ? `Partial Payment of GH¢ ${payAmount.toFixed(2)} Received.\nOutstanding Balance: GH¢ ${(totalBill - payAmount).toFixed(2)}`
                : `Full Payment of GH¢ ${payAmount.toFixed(2)} Successful!`;

            alert(`Paystack Payment Gateway Integration Coming Soon!\nPAYMENT SIMULATED: SUCCESS\n\n${message}`);
            onConfirmSub();
            setIsProcessing(false);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="p-6 bg-slate-900 text-white border-b border-white/10 flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-xl">{isUpgrade ? 'Upgrade Subscription' : 'Renew Subscription'}</h3>
                        <p className="text-slate-400 text-sm mt-1">{schoolName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Plan Selected</span>
                        <span className="text-primary-600 font-bold text-xs bg-primary-50 px-2 py-1 rounded shadow-sm">{plan.name}</span>
                    </div>

                    {/* Bill Breakdown */}
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Rate per Student</span>
                            <span>GH¢ {plan.price}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Total Students</span>
                            <span>x {count}</span>
                        </div>
                        <div className="border-t border-slate-200 my-2"></div>
                        <div className="flex justify-between items-end">
                            <span className="font-bold text-slate-700">Total Bill</span>
                            <span className="text-slate-900 font-black text-2xl">GH¢ {totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* Installment Input */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Amount you want to pay now (GH¢)</label>
                        <input
                            type="number"
                            value={amountToPay}
                            onChange={(e) => setAmountToPay(e.target.value)}
                            className="w-full p-2 text-lg font-bold text-blue-900 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {Number(amountToPay) < totalBill && Number(amountToPay) > 0 && (
                            <div className="mt-2 space-y-1">
                                <p className="text-xs text-blue-600 font-medium">
                                    Balance to carry forward: <span className="font-bold">GH¢ ${(totalBill - Number(amountToPay)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </p>
                                <p className="text-[10px] text-blue-400">Installment payment acknowledged.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                        <button onClick={() => setPayMethod('card')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${payMethod === 'card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Mobile Money / Card</button>
                        <button onClick={() => setPayMethod('bank')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${payMethod === 'bank' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bank Transfer</button>
                    </div>

                    {payMethod === 'card' ? (
                        <div className="space-y-6 text-center py-4">
                            <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                                <CreditCard className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-2">Pay Securely with Paystack</h4>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto">Click below to initiate payment of <span className="font-bold text-slate-900">GH¢ {Number(amountToPay).toLocaleString()}</span> via MM/Card.</p>
                            </div>
                            <button
                                onClick={handlePaystack}
                                disabled={isProcessing || Number(amountToPay) <= 0}
                                className="w-full bg-[#00C3F7] text-white hover:brightness-95 py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200/50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-4 h-4" />}
                                {isProcessing ? 'Processing...' : `Pay GH¢ ${Number(amountToPay).toLocaleString()}`}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
                                    <Building2 className="w-5 h-5 text-slate-400" />
                                    <span className="font-bold text-slate-700">Bank Details</span>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Bank Name</span>
                                        <span className="font-bold text-slate-800">Zenith Bank</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Account Name</span>
                                        <span className="font-bold text-slate-800">Base 16 Schools</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Account Number</span>
                                        <span className="font-bold text-slate-800 font-mono text-base">1234567890123</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Branch</span>
                                        <span className="font-bold text-slate-800">Accra Main</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Amount Due</span>
                                        <span className="font-bold text-primary-600">GH¢ {Number(amountToPay).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Reference</span>
                                        <span className="font-bold text-slate-800">Please use School Name</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg border border-yellow-100 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p>After transfer, please send proof of payment to billing@base16schools.com or call 0200000000 for activation.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;