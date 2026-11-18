import React, { useState, useEffect } from 'react';
import {
    CheckCircle, User, Loader2, Save, Download, Copy,
    History, ShoppingCart, MessageSquare, AlertCircle, RefreshCw, X, ChevronRight,
    Building2, Lock, CreditCard, Upload, Gift, Layout, Smartphone,
    Eye, EyeOff, GraduationCap, Coins, Users, Sparkles, Zap, ShieldCheck, ArrowRight,
    BadgePercent, Check, Receipt, Wallet
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { uploadToCloudinary } from '../utils/cloudinary';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payWithPaystack } from '../utils/paystack';
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

// --- Pricing Models & Modules ---

export interface OrbitModuleDef {
    id: string;
    code: string;
    name: string;
    subtitle: string;
    price: number; // per term in GHS
    badge: string;
    badgeColor: string;
    features: string[];
}

export const ORBIT_MODULES: OrbitModuleDef[] = [
    {
        id: 'academic_engine',
        code: 'academic_engine',
        name: 'Academic Engine',
        subtitle: 'Terminal Exams, Broadsheets & Report Cards',
        price: 70,
        badge: 'Academics',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        features: [
            'Terminal Exams & CA Grading (30/70 & 50/50)',
            'Auto Class Positions & Broadsheet Compilation',
            'Prestige Terminal Report Cards (Customizable)',
            'Batch PDF Generation & Instant Print Export'
        ]
    },
    {
        id: 'revenue_guard',
        code: 'revenue_guard',
        name: 'Revenue & Finance Guard',
        subtitle: 'Fee Structures, Invoicing, Receipts & Debtors',
        price: 120,
        badge: 'Finance',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        features: [
            'Student Fee Ledgers & Automated Invoicing',
            'Instant Thermal POS & A4 Printable Receipts',
            'Defaulters Tracking & Fee Deficit Analysis',
            'Cash & Mobile Money Transaction Logging'
        ]
    },
    {
        id: 'daily_operations',
        code: 'daily_operations',
        name: 'Operations, Staff & Feeding',
        subtitle: 'Attendance, Teacher Payroll & Canteen',
        price: 100,
        badge: 'Operations',
        badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
        features: [
            'Daily Student & Teacher Attendance Tracking',
            'Monthly Teacher Payroll & Absence Deductions',
            'Instant Teacher Payslip Generator',
            'Daily Canteen & Feeding Fee Tracker'
        ]
    },
    {
        id: 'parent_portal',
        code: 'parent_portal',
        name: 'Parent Portal & Notices',
        subtitle: 'Online Parent Access, Reports & Notice Board',
        price: 80,
        badge: 'Parents',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        features: [
            'Secure Parent Student Access Link',
            'Online Terminal Report Card Viewer',
            'Live Student Fee Balance & Payment Status',
            'Digital School Notice Board & Announcements'
        ]
    },
    {
        id: 'ai_copilot',
        code: 'ai_copilot',
        name: 'Orbit AI Co-Pilot',
        subtitle: 'Automated Remarks & School Intelligence',
        price: 100,
        badge: 'AI Smart',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        features: [
            'AI-Generated Terminal Teacher Remarks',
            '“Ask Your School Anything” AI Co-Pilot',
            'Predictive Fee Collection & Deficit Analytics',
            'Instant Principal Executive Summaries'
        ]
    }
];

export const FULL_SUITE_OFFER = {
    code: 'full_suite',
    name: '⭐ Complete Orbit Full Suite',
    termPrice: 350,
    sumPrice: 470,
    savings: 120,
    features: [
        'ALL 5 Core Modules Completely Unlocked',
        'Academic Engine (Report Cards & Broadsheets)',
        'Revenue Guard (Fee Tracking & Receipts)',
        'Operations & Staff (Teacher Payroll & Attendance)',
        'Parent Portal (Online Access & Notices)',
        'Orbit AI Co-Pilot (Remarks & Intelligence)',
        'Unlimited Students, Classes & Staff Accounts',
        'Priority 24/7 WhatsApp Support & Free Upgrades'
    ]
};

export const SMS_PACKS = [
    {
        id: 'starter',
        name: 'Starter Pack',
        credits: 500,
        price: 30,
        rate: 'GH¢ 0.060 / SMS',
        popular: false
    },
    {
        id: 'school',
        name: 'Standard School Pack',
        credits: 1500,
        price: 85,
        rate: 'GH₵ 0.056 / SMS',
        popular: true,
        badge: 'MOST POPULAR'
    },
    {
        id: 'proprietor',
        name: 'Proprietor Mega Pack',
        credits: 5000,
        price: 260,
        rate: 'GH₵ 0.052 / SMS',
        popular: false,
        extra: 'Custom Sender ID Included'
    }
];

// --- Fetch Functions ---

const fetchSchoolSettings = async (schoolId: string) => {
    const { data: school, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();
    if (error) throw error;
    return school;
};

const fetchBillingHistory = async (schoolId: string) => {
    try {
        const { data, error } = await supabase
            .from('school_billing_invoices')
            .select('*')
            .eq('school_id', schoolId)
            .order('period_start', { ascending: false });
        if (!error && data) return data;
    } catch (_) {}
    return [];
};

const fetchSMSTransactions = async (schoolId: string) => {
    try {
        const { data, error } = await supabase
            .from('sms_purchases')
            .select('*')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });
        if (!error && data) return data;
    } catch (_) {}
    return [];
};

const fetchWalletTransactions = async (schoolId: string) => {
    try {
        const { data, error } = await supabase
            .from('school_wallet_transactions')
            .select('*')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });
        if (!error && data) return data;
    } catch (_) {}
    return [];
};

const fetchActiveSubscription = async (schoolId: string) => {
    try {
        const { data, error } = await supabase
            .from('school_subscriptions')
            .select('*')
            .eq('school_id', schoolId)
            .maybeSingle();
        if (!error && data) return data;
    } catch (_) {}
    return null;
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
    const [billingTab, setBillingTab] = useState<'overview' | 'sms' | 'settings' | 'history'>('overview');

    // -- Local Form States (initialized from Query Data) --
    // We'll use useEffect to sync query data to these local states for editing
    const [config, setConfig] = useState<any>({});
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [smsCalc, setSmsCalc] = useState({ amount: '', qty: '' });
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

    // Modular & Bundle Billing States
    const [selectedModules, setSelectedModules] = useState<string[]>(['academic_engine', 'revenue_guard']);
    const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<{
        code: string;
        name: string;
        amount: number;
        description: string;
        modules: string[];
    } | null>(null);
    const [showSubscriptionCheckout, setShowSubscriptionCheckout] = useState(false);

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

    const { data: activeSub } = useQuery({
        queryKey: ['activeSubscription', schoolId],
        queryFn: () => fetchActiveSubscription(schoolId!),
        enabled: !!schoolId && !isTeacher && activeTab === 'billing'
    });

    const { data: walletTransactions = [] } = useQuery({
        queryKey: ['walletTransactions', schoolId],
        queryFn: () => fetchWalletTransactions(schoolId!),
        enabled: !!schoolId && !isTeacher && activeTab === 'billing' && billingTab === 'history',
        retry: false
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

    const activateSubscriptionMutation = useMutation({
        mutationFn: async (payload: {
            planCode: string;
            amount: number;
            paymentMethod: string;
            paymentRef?: string;
            description: string;
        }) => {
            const { data, error } = await supabase.rpc('activate_school_subscription', {
                p_school_id: schoolId,
                p_plan_code: payload.planCode,
                p_amount: payload.amount,
                p_payment_method: payload.paymentMethod || 'Mobile Money',
                p_payment_ref: payload.paymentRef || `MOMO-${Date.now()}`,
                p_description: payload.description
            });
            if (error) {
                // Direct fallback
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 4);
                await supabase.from('school_subscriptions').upsert({
                    school_id: schoolId,
                    plan_code: payload.planCode,
                    billing_cycle: 'Termly',
                    status: 'active',
                    amount_billed: payload.amount,
                    current_period_start: new Date().toISOString().split('T')[0],
                    current_period_end: endDate.toISOString().split('T')[0],
                    payment_method: payload.paymentMethod || 'Mobile Money',
                    payment_reference: payload.paymentRef || `REF-${Date.now()}`
                });
                await supabase.from('schools').update({
                    subscription_plan: payload.planCode,
                    next_payment_due: endDate.toISOString().split('T')[0],
                    status: 'active'
                }).eq('id', schoolId);
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSubscription', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['billingHistory', schoolId] });
            setShowSubscriptionCheckout(false);
            alert('🎉 Subscription activated successfully! Your school is licensed for the active term.');
        },
        onError: (err: any) => alert('Subscription error: ' + err.message)
    });

    const buySMSCreditsMutation = useMutation({
        mutationFn: async (pack: { quantity: number; amount: number; paymentMethod?: string; reference?: string }) => {
            const ref = pack.reference || `SMS-PAY-${Date.now()}`;
            const { data, error } = await supabase.rpc('top_up_school_sms', {
                p_school_id: schoolId,
                p_quantity: pack.quantity,
                p_amount: pack.amount,
                p_payment_ref: ref,
                p_payment_method: pack.paymentMethod || 'Paystack Online'
            });
            if (error) {
                // Safe direct fallback
                const currentBal = config.sms_balance || 0;
                await supabase.from('schools').update({
                    sms_balance: currentBal + pack.quantity
                }).eq('id', schoolId);
                try {
                    await supabase.from('sms_purchases').insert({
                        school_id: schoolId,
                        quantity: pack.quantity,
                        amount_paid: pack.amount,
                        payment_reference: ref,
                        payment_method: pack.paymentMethod || 'Paystack Online',
                        status: 'Completed'
                    });
                } catch (_) {}
            }
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['smsTransactions', schoolId] });
            setIsSmsModalOpen(false);
            alert(`🎉 Success! ${variables.quantity.toLocaleString()} SMS credits have been added to your school balance.`);
        },
        onError: (err: any) => alert('Failed to purchase SMS credits: ' + err.message)
    });

    const topUpWalletMutation = useMutation({
        mutationFn: async (payload: { amount: number; paymentMethod: string; reference?: string }) => {
            const ref = payload.reference || `TOPUP-${Date.now()}`;
            const { data, error } = await supabase.rpc('top_up_school_wallet', {
                p_school_id: schoolId,
                p_amount: payload.amount,
                p_payment_ref: ref,
                p_payment_method: payload.paymentMethod || 'Mobile Money'
            });
            if (error) {
                // Direct fallback if RPC is not yet executed in database
                const cur = Number(schoolData?.wallet_balance || 0);
                const newBal = cur + payload.amount;
                await supabase.from('schools').update({
                    wallet_balance: newBal
                }).eq('id', schoolId);

                try {
                    await supabase.from('school_wallet_transactions').insert({
                        school_id: schoolId,
                        amount: payload.amount,
                        balance_after: newBal,
                        type: 'deposit',
                        purpose: 'Wallet Deposit',
                        payment_method: payload.paymentMethod || 'Mobile Money',
                        payment_reference: ref,
                        description: `Wallet Top-Up of GH₵ ${payload.amount}`
                    });
                } catch (_) {}
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['walletTransactions', schoolId] });
            setIsTopUpModalOpen(false);
            alert('🎉 Orbit Wallet topped up successfully! You can now use your balance across any module or SMS pack.');
        },
        onError: (err: any) => alert('Top-up failed: ' + err.message)
    });

    const payFromWalletMutation = useMutation({
        mutationFn: async (payload: {
            amount: number;
            purpose: 'subscription' | 'sms';
            description: string;
            planCode?: string;
            smsQuantity?: number;
        }) => {
            const cur = Number(schoolData?.wallet_balance || 0);
            if (cur < payload.amount) {
                throw new Error(`Insufficient wallet balance. You have GH₵ ${cur.toFixed(2)}, but need GH₵ ${payload.amount.toFixed(2)}.`);
            }

            const { data, error } = await supabase.rpc('pay_from_school_wallet', {
                p_school_id: schoolId,
                p_amount: payload.amount,
                p_purpose: payload.purpose,
                p_description: payload.description,
                p_plan_code: payload.planCode || null,
                p_sms_quantity: payload.smsQuantity || 0
            });

            if (error) {
                // Direct fallback
                const newBal = cur - payload.amount;
                if (payload.purpose === 'subscription') {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 4);
                    await supabase.from('schools').update({
                        wallet_balance: newBal,
                        subscription_plan: payload.planCode || 'full_suite',
                        next_payment_due: endDate.toISOString().split('T')[0],
                        status: 'active'
                    }).eq('id', schoolId);

                    await supabase.from('school_subscriptions').upsert({
                        school_id: schoolId,
                        plan_code: payload.planCode || 'full_suite',
                        billing_cycle: 'Termly',
                        status: 'active',
                        amount_billed: payload.amount,
                        current_period_start: new Date().toISOString().split('T')[0],
                        current_period_end: endDate.toISOString().split('T')[0],
                        payment_method: 'Orbit Wallet',
                        payment_reference: `WALLET-${Date.now()}`
                    });
                } else if (payload.purpose === 'sms') {
                    const curSms = Number(config.sms_balance || 0);
                    await supabase.from('schools').update({
                        wallet_balance: newBal,
                        sms_balance: curSms + (payload.smsQuantity || 0)
                    }).eq('id', schoolId);

                    try {
                        await supabase.from('sms_purchases').insert({
                            school_id: schoolId,
                            quantity: payload.smsQuantity || 0,
                            amount_paid: payload.amount,
                            payment_reference: `WALLET-SMS-${Date.now()}`,
                            payment_method: 'Orbit Wallet',
                            status: 'Completed'
                        });
                    } catch (_) {}
                }

                try {
                    await supabase.from('school_wallet_transactions').insert({
                        school_id: schoolId,
                        amount: -payload.amount,
                        balance_after: newBal,
                        type: payload.purpose,
                        purpose: payload.purpose,
                        payment_method: 'Orbit Wallet',
                        payment_reference: `WALLET-PAY-${Date.now()}`,
                        description: payload.description
                    });
                } catch (_) {}
            }
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['walletTransactions', schoolId] });
            if (variables.purpose === 'subscription') {
                queryClient.invalidateQueries({ queryKey: ['activeSubscription', schoolId] });
                queryClient.invalidateQueries({ queryKey: ['billingHistory', schoolId] });
                setShowSubscriptionCheckout(false);
                alert('🎉 Academic Term License unlocked instantly using your Orbit Wallet!');
            } else {
                queryClient.invalidateQueries({ queryKey: ['smsTransactions', schoolId] });
                setIsSmsModalOpen(false);
                alert(`🎉 ${variables.smsQuantity?.toLocaleString()} SMS credits added to your balance instantly using your Orbit Wallet!`);
            }
        },
        onError: (err: any) => alert('Wallet payment failed: ' + err.message)
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
                        {/* Streamlined Header */}
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Billing & Credits</h2>
                            <p className="text-slate-500 text-sm mt-0.5">Manage subscription, SMS credits, and payment methods.</p>
                        </div>

                        {/* Streamlined Wallet Balance Card (Exact to User Design) */}
                        <div className="bg-[#0b1329] text-white rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-800">
                            {/* Background geometric wallet watermark */}
                            <div className="absolute right-6 -bottom-6 opacity-5 pointer-events-none">
                                <Wallet className="w-40 h-40 text-white transform rotate-12" />
                            </div>

                            <div className="relative z-10 space-y-1">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    WALLET BALANCE
                                </div>
                                <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
                                    GH₵ {Number(schoolData?.wallet_balance || 0).toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-400 pt-0.5">
                                    Top up your wallet to activate modules and buy SMS credits.
                                </p>
                            </div>

                            <div className="relative z-10 flex items-center gap-3">
                                <button
                                    onClick={() => setIsTopUpModalOpen(true)}
                                    className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] whitespace-nowrap"
                                >
                                    Top Up Wallet
                                </button>
                            </div>
                        </div>

                        {/* Sub Navigation */}
                        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
                            <button
                                onClick={() => setBillingTab('overview')}
                                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                                    billingTab === 'overview'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <Zap className="w-4 h-4 text-amber-400" /> Term Licenses & Modules
                            </button>
                            <button
                                onClick={() => setBillingTab('sms')}
                                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                                    billingTab === 'sms'
                                        ? 'bg-primary-600 text-white shadow-md'
                                        : 'text-slate-600 hover:text-primary-600 hover:bg-slate-100'
                                }`}
                            >
                                <Smartphone className="w-4 h-4" /> SMS Store ({(config.sms_balance || 0).toLocaleString()})
                            </button>
                            <button
                                onClick={() => setBillingTab('settings')}
                                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                                    billingTab === 'settings'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <Building2 className="w-4 h-4" /> School Fee Accounts
                            </button>
                            <button
                                onClick={() => setBillingTab('history')}
                                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                                    billingTab === 'history'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <Receipt className="w-4 h-4" /> Wallet Ledger & Invoices
                            </button>
                        </div>

                        {/* SUB-TAB 1: OVERVIEW (PRICING & MODULES) */}
                        {billingTab === 'overview' && (
                            <div className="space-y-4">
                                {activeSub?.status === 'active' && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 w-fit">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <span>Active Term License: <b>{activeSub?.plan_code === 'full_suite' ? 'Complete Orbit Full Suite' : activeSub?.plan_code}</b> (Valid until {activeSub?.current_period_end ? new Date(activeSub.current_period_end).toLocaleDateString() : 'term conclusion'})</span>
                                    </div>
                                )}

                                {/* ⭐ HERO CARD: COMPLETE ORBIT FULL SUITE (Small & Neat with Visible Border) */}
                                <div className="rounded-2xl bg-white text-slate-800 p-4 sm:p-5 border-2 border-indigo-500 shadow-md ring-1 ring-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                <Sparkles className="h-3 w-3 text-amber-600 fill-amber-600" /> RECOMMENDED
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                Save GH₵ 120 (26% Off)
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-baseline gap-2.5">
                                            <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                                                Complete Orbit Full Suite
                                            </h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl md:text-2xl font-black text-slate-900">GH₵ 350</span>
                                                <span className="text-xs text-slate-500 font-medium">/ term</span>
                                                <span className="text-xs text-slate-400 line-through ml-1">GH₵ 470</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 max-w-xl">
                                            Unlocks all 5 modules: Academic Engine, Revenue Guard, Operations & Payroll, Parent Portal, and Orbit AI Co-Pilot. Unlimited students.
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end justify-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => {
                                                setSelectedPlanForCheckout({
                                                    code: 'full_suite',
                                                    name: '⭐ Complete Orbit Full Suite',
                                                    amount: FULL_SUITE_OFFER.termPrice,
                                                    description: 'All 5 Core Modules: Academic Engine, Revenue & Finance Guard, Operations & Staff Payroll, Parent Portal, and Orbit AI Co-Pilot',
                                                    modules: [
                                                        'Academic Engine (Broadsheets & Reports)',
                                                        'Revenue & Finance Guard (Fees & POS)',
                                                        'Operations, Staff & Feeding (Payroll & Attendance)',
                                                        'Parent Portal & Notice Board',
                                                        'Orbit AI Co-Pilot & Remarks'
                                                    ]
                                                });
                                                setShowSubscriptionCheckout(true);
                                            }}
                                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow transition-all hover:scale-[1.01] active:scale-[0.98] text-center flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap"
                                        >
                                            <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                                            Activate Full Suite (GH₵ 350)
                                        </button>
                                        <span className="text-[10px] text-slate-400 text-center md:text-right">
                                            Instant 1-Click with Wallet • 4 Months
                                        </span>
                                    </div>
                                </div>

                                {/* SECTION 2: INDIVIDUAL MODULES (A LA CARTE) */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                <Layout className="h-5 w-5 text-indigo-600" />
                                                Or Build Your Custom Stack (A La Carte)
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Select only the specific modules you wish to license this term.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <button
                                                onClick={() => setSelectedModules(ORBIT_MODULES.map(m => m.id))}
                                                className="text-primary-600 font-bold hover:underline"
                                            >
                                                Select All (5)
                                            </button>
                                            <span className="text-slate-300">•</span>
                                            <button
                                                onClick={() => setSelectedModules(['academic_engine'])}
                                                className="text-slate-500 hover:text-slate-800"
                                            >
                                                Reset to 1
                                            </button>
                                        </div>
                                    </div>

                                    {/* 5 Modules Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {ORBIT_MODULES.map((module) => {
                                            const isSelected = selectedModules.includes(module.id);
                                            return (
                                                <div
                                                    key={module.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            if (selectedModules.length > 1) {
                                                                setSelectedModules(selectedModules.filter(id => id !== module.id));
                                                            } else {
                                                                alert('Please keep at least one module selected.');
                                                            }
                                                        } else {
                                                            setSelectedModules([...selectedModules, module.id]);
                                                        }
                                                    }}
                                                    className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                                                        isSelected
                                                            ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                                    isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                                                                }`}>
                                                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                                </div>
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${module.badgeColor}`}>
                                                                    {module.badge}
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-lg font-black text-slate-900">GH₵ {module.price}</span>
                                                                <span className="text-[10px] text-slate-400 block font-medium">/ term</span>
                                                            </div>
                                                        </div>

                                                        <h4 className="font-bold text-slate-900 text-base">{module.name}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5 mb-3">{module.subtitle}</p>

                                                        <ul className="space-y-1.5 border-t border-slate-100 pt-2.5">
                                                            {module.features.map((feat, idx) => (
                                                                <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-600">
                                                                    <CheckCircle className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                                                    <span>{feat}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="pt-4 mt-2">
                                                        <button
                                                            type="button"
                                                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                                                                isSelected
                                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {isSelected ? '✓ Module Selected' : '+ Add Module'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* DYNAMIC DECOY NUDGE BANNER & CHECKOUT BAR */}
                                    {(() => {
                                        const selectedList = ORBIT_MODULES.filter(m => selectedModules.includes(m.id));
                                        const currentSum = selectedList.reduce((sum, m) => sum + m.price, 0);
                                        const isAll = selectedModules.length === ORBIT_MODULES.length;
                                        const diff = 350 - currentSum;

                                        return (
                                            <div className="space-y-3 pt-2">
                                                {/* Smart Suggestion Nudge Box */}
                                                {isAll ? (
                                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                                                <BadgePercent className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-amber-950 text-sm">You selected all 5 individual modules (GH₵ 500)!</h4>
                                                                <p className="text-xs text-amber-800">
                                                                    Don't pay separately. Activate the <b>Complete Full Suite</b> for only <b>GH₵ 350</b> and save <b>GH₵ 150 (30% discount)</b>!
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPlanForCheckout({
                                                                    code: 'full_suite',
                                                                    name: '⭐ Complete Orbit Full Suite',
                                                                    amount: FULL_SUITE_OFFER.termPrice,
                                                                    description: 'All 5 Core Modules unlocked at bundle discount',
                                                                    modules: selectedList.map(m => m.name)
                                                                });
                                                                setShowSubscriptionCheckout(true);
                                                            }}
                                                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md whitespace-nowrap"
                                                        >
                                                            Switch to Full Suite (Save GH₵ 150)
                                                        </button>
                                                    </div>
                                                ) : currentSum > FULL_SUITE_OFFER.termPrice ? (
                                                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                                                <BadgePercent className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-emerald-950 text-sm">
                                                                    Smart Suggestion: Save GH₵ {currentSum - FULL_SUITE_OFFER.termPrice} with the Full Suite!
                                                                </h4>
                                                                <p className="text-xs text-emerald-800">
                                                                    Your selected {selectedModules.length} modules cost <b>GH₵ {currentSum}</b>, which is more than the Full Suite (GH₵ 350). Switch now to save <b>GH₵ {currentSum - FULL_SUITE_OFFER.termPrice}</b> and unlock ALL 5 modules!
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPlanForCheckout({
                                                                    code: 'full_suite',
                                                                    name: '⭐ Complete Orbit Full Suite',
                                                                    amount: FULL_SUITE_OFFER.termPrice,
                                                                    description: 'All 5 Core Modules unlocked at bundle discount',
                                                                    modules: ORBIT_MODULES.map(m => m.name)
                                                                });
                                                                setShowSubscriptionCheckout(true);
                                                            }}
                                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md whitespace-nowrap"
                                                        >
                                                            Switch to Full Suite (Save GH₵ {currentSum - FULL_SUITE_OFFER.termPrice})
                                                        </button>
                                                    </div>
                                                ) : currentSum === FULL_SUITE_OFFER.termPrice ? (
                                                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-indigo-950 text-sm">
                                                                    Smart Suggestion: Unlock ALL 5 Modules for the exact same price!
                                                                </h4>
                                                                <p className="text-xs text-indigo-800">
                                                                    Your selected modules total <b>GH₵ 350</b>. For that exact same price, the Complete Full Suite unlocks every single system in Orbit!
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPlanForCheckout({
                                                                    code: 'full_suite',
                                                                    name: '⭐ Complete Orbit Full Suite',
                                                                    amount: FULL_SUITE_OFFER.termPrice,
                                                                    description: 'All 5 Core Modules unlocked at bundle discount',
                                                                    modules: ORBIT_MODULES.map(m => m.name)
                                                                });
                                                                setShowSubscriptionCheckout(true);
                                                            }}
                                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md whitespace-nowrap"
                                                        >
                                                            Get All 5 Modules (GH₵ 350)
                                                        </button>
                                                    </div>
                                                ) : currentSum >= 280 ? (
                                                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-indigo-950 text-sm">
                                                                    Smart Suggestion: For just GH₵ {FULL_SUITE_OFFER.termPrice - currentSum} more, unlock EVERYTHING!
                                                                </h4>
                                                                <p className="text-xs text-indigo-800">
                                                                    You selected {selectedModules.length} modules for <b>GH₵ {currentSum}</b>. Adding only <b>GH₵ {FULL_SUITE_OFFER.termPrice - currentSum}</b> gives you all 5 modules with the Full Suite (GH₵ 350).
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPlanForCheckout({
                                                                    code: 'full_suite',
                                                                    name: '⭐ Complete Orbit Full Suite',
                                                                    amount: FULL_SUITE_OFFER.termPrice,
                                                                    description: 'All 5 Core Modules unlocked at bundle discount',
                                                                    modules: ORBIT_MODULES.map(m => m.name)
                                                                });
                                                                setShowSubscriptionCheckout(true);
                                                            }}
                                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md whitespace-nowrap"
                                                        >
                                                            Get Full Suite for +GH₵ {FULL_SUITE_OFFER.termPrice - currentSum}
                                                        </button>
                                                    </div>
                                                ) : null}

                                                {/* Selected Summary Bar */}
                                                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                                                    <div>
                                                        <div className="text-xs text-slate-500 font-medium">Selected Custom Stack:</div>
                                                        <div className="flex items-baseline gap-2 mt-0.5">
                                                            <span className="text-2xl font-black text-slate-900">
                                                                GH₵ {isAll || currentSum > FULL_SUITE_OFFER.termPrice ? FULL_SUITE_OFFER.termPrice : currentSum}
                                                            </span>
                                                            <span className="text-xs text-slate-500">/ term ({selectedModules.length} modules selected)</span>
                                                            {currentSum > FULL_SUITE_OFFER.termPrice && (
                                                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 ml-2">
                                                                    Capped at Full Suite Rate (Save GH₵ {currentSum - FULL_SUITE_OFFER.termPrice})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            const shouldUpgrade = isAll || currentSum >= FULL_SUITE_OFFER.termPrice;
                                                            setSelectedPlanForCheckout({
                                                                code: shouldUpgrade ? 'full_suite' : `custom_${selectedModules.join('_')}`,
                                                                name: shouldUpgrade ? '⭐ Complete Orbit Full Suite' : `Custom Modular License (${selectedModules.length} Modules)`,
                                                                amount: shouldUpgrade ? FULL_SUITE_OFFER.termPrice : currentSum,
                                                                description: shouldUpgrade ? 'All 5 Core Modules unlocked' : selectedList.map(m => m.name).join(', '),
                                                                modules: shouldUpgrade ? ORBIT_MODULES.map(m => m.name) : selectedList.map(m => m.name)
                                                            });
                                                            setShowSubscriptionCheckout(true);
                                                        }}
                                                        disabled={selectedModules.length === 0}
                                                        className="w-full sm:w-auto px-7 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        Proceed to Checkout ({selectedModules.length} Modules)
                                                        <ArrowRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB 2: SMS CREDITS */}
                        {billingTab === 'sms' && (
                            <div className="space-y-6">
                                {/* Balance Card */}
                                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                        <Smartphone className="h-40 w-40" />
                                    </div>
                                    <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-3 py-1 rounded-full">
                                                Direct Telecel / MTN Carrier Delivery
                                            </span>
                                            <h3 className="text-4xl md:text-5xl font-black mt-2">
                                                {(config.sms_balance || 0).toLocaleString()} <span className="text-lg font-normal text-blue-200">SMS Credits</span>
                                            </h3>
                                            <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-lg">
                                                SMS credits never expire. Use them anytime to send terminal report cards, urgent announcements, and fee payment receipts to parents.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsSmsModalOpen(true)}
                                            className="px-6 py-3.5 bg-white text-blue-900 hover:bg-blue-50 font-black rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                                        >
                                            <CreditCard className="w-4 h-4" /> Buy Credit Pack
                                        </button>
                                    </div>
                                </div>

                                {/* SMS Credit Packs Grid */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 text-base">Select an SMS Top-Up Pack</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {SMS_PACKS.map(pack => (
                                            <div
                                                key={pack.id}
                                                className={`bg-white rounded-2xl p-6 border-2 flex flex-col justify-between transition-all ${
                                                    pack.popular
                                                        ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-lg'
                                                        : 'border-slate-200 shadow-sm hover:border-slate-300'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h5 className="font-bold text-slate-800 text-lg">{pack.name}</h5>
                                                        {pack.badge && (
                                                            <span className="text-[10px] font-black uppercase tracking-wider bg-primary-600 text-white px-2.5 py-0.5 rounded-full">
                                                                {pack.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-3xl font-black text-slate-900 mb-1">
                                                        GH₵ {pack.price}
                                                    </div>
                                                    <p className="text-xs text-primary-600 font-bold mb-4">{pack.credits.toLocaleString()} SMS Credits • {pack.rate}</p>
                                                    
                                                    <div className="text-xs text-slate-500 space-y-1.5 border-t border-slate-100 pt-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                            <span>Instant MoMo Activation</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                            <span>{pack.extra}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                            <span>Delivered to Parents instantly</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setIsSmsModalOpen(true)}
                                                    className={`w-full mt-6 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                                                        pack.popular
                                                            ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-200'
                                                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                                                    }`}
                                                >
                                                    <Smartphone className="w-3.5 h-3.5" /> Buy {pack.name}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* SMS Purchase History */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                        <h4 className="font-bold text-slate-800 text-sm">SMS Credit Purchase History</h4>
                                        <span className="text-xs text-slate-500">{smsTransactions.length} Total Orders</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                                        {smsTransactions.map((tx: any, i: number) => (
                                            <div key={i} className="p-4 flex justify-between items-center text-sm">
                                                <div>
                                                    <p className="font-bold text-slate-800">{tx.quantity?.toLocaleString() || 0} Credits</p>
                                                    <span className="text-xs text-slate-500">
                                                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Recent'} • Ref: {tx.payment_reference || 'DIRECT'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-900">GH₵ {Number(tx.amount_paid || 0).toFixed(2)}</p>
                                                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                                        {tx.status || 'Completed'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {smsTransactions.length === 0 && (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                No SMS purchases recorded yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB 3: SETTINGS (SCHOOL PARENT PAYMENT DETAILS) */}
                        {billingTab === 'settings' && (
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">School Fee Collection Accounts</h3>
                                    <p className="text-slate-500 text-xs md:text-sm mt-0.5">
                                        Configure the Mobile Money and Bank details shown to parents on fee invoices and the parent portal.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                            School Mobile Money Number & Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0244 123 456 (St. Jude School)"
                                            value={config.paymentConfig?.momo_number || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, momo_number: e.target.value }
                                            })}
                                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none text-sm font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                            Bank Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. GCB Bank / Zenith Bank"
                                            value={config.paymentConfig?.bank_name || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, bank_name: e.target.value }
                                            })}
                                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none text-sm font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                            Account Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 1011234567890"
                                            value={config.paymentConfig?.account_number || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, account_number: e.target.value }
                                            })}
                                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none text-sm font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                            Account Holder / Branch
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Orbit International School, Accra"
                                            value={config.paymentConfig?.account_name || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, account_name: e.target.value }
                                            })}
                                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none text-sm font-semibold"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                            Payment Instructions for Parents
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder="e.g. Please use your Child's Full Name or Student ID as the reference for Mobile Money or Bank deposits."
                                            value={config.paymentConfig?.instructions || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                paymentConfig: { ...config.paymentConfig, instructions: e.target.value }
                                            })}
                                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={() => updatePaymentConfigMutation.mutate(config.paymentConfig)}
                                        disabled={updatePaymentConfigMutation.isPending}
                                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 text-xs md:text-sm flex items-center gap-2"
                                    >
                                        {updatePaymentConfigMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {updatePaymentConfigMutation.isPending ? 'Saving...' : 'Save Payment Configuration'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB 4: INVOICE & WALLET HISTORY */}
                        {billingTab === 'history' && (
                            <div className="space-y-6">
                                {/* Orbit Wallet Ledger */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                                                <Wallet className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">Orbit Wallet Statement & Ledger</h4>
                                                <p className="text-xs text-slate-500">Live balance and complete log of all deposits, subscriptions, and SMS charges.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Wallet Balance</div>
                                                <div className="text-lg font-black text-slate-900">
                                                    GH₵ {Number(schoolData?.wallet_balance || 0).toFixed(2)}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsTopUpModalOpen(true)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                                            >
                                                <Wallet className="w-3.5 h-3.5" /> + Top Up Wallet
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs md:text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                                <tr>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">Transaction / Purpose</th>
                                                    <th className="p-4">Reference</th>
                                                    <th className="p-4">Payment Method</th>
                                                    <th className="p-4 text-right">Amount</th>
                                                    <th className="p-4 text-right">Balance After</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {walletTransactions.map((tx: any, i: number) => {
                                                    const isCredit = Number(tx.amount) > 0;
                                                    return (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="p-4 text-slate-600 whitespace-nowrap">
                                                                {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Recent'}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                                                                        tx.type === 'deposit'
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : tx.type === 'subscription'
                                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                                : 'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                        {tx.type}
                                                                    </span>
                                                                    <span className="font-semibold text-slate-800">{tx.description || tx.purpose}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 font-mono text-xs text-slate-500">
                                                                {tx.payment_reference || 'DIRECT'}
                                                            </td>
                                                            <td className="p-4 text-slate-600">
                                                                {tx.payment_method || 'Orbit Wallet'}
                                                            </td>
                                                            <td className={`p-4 font-black text-right whitespace-nowrap ${
                                                                isCredit ? 'text-emerald-600' : 'text-slate-800'
                                                            }`}>
                                                                {isCredit ? `+GH₵ ${Number(tx.amount).toFixed(2)}` : `-GH₵ ${Math.abs(Number(tx.amount)).toFixed(2)}`}
                                                            </td>
                                                            <td className="p-4 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                                                                GH₵ {Number(tx.balance_after || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {walletTransactions.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                                            No wallet transactions yet. Top up your Orbit Wallet to activate unified 1-click billing!
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Subscription Invoices & Receipts */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-base">Subscription Invoices & Receipts</h4>
                                            <p className="text-xs text-slate-500">Official proof of software term licensing for your school.</p>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 bg-slate-200/80 px-2.5 py-1 rounded-full">
                                            {billingHistory.length} Invoices
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs md:text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                                <tr>
                                                    <th className="p-4">Invoice #</th>
                                                    <th className="p-4">Date / Period</th>
                                                    <th className="p-4">Licensed Plan</th>
                                                    <th className="p-4">Amount</th>
                                                    <th className="p-4">Payment Method</th>
                                                    <th className="p-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {billingHistory.map((inv: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50/50">
                                                        <td className="p-4 font-mono font-bold text-slate-900">
                                                            {inv.invoice_number || `INV-${i + 1001}`}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : 'Current Term'}
                                                        </td>
                                                        <td className="p-4 font-semibold text-slate-800">
                                                            {inv.plan_code === 'full_suite' ? '⭐ Complete Orbit Full Suite' : inv.plan_code || 'Term License'}
                                                        </td>
                                                        <td className="p-4 font-black text-slate-900">
                                                            GH₵ {Number(inv.amount || 0).toFixed(2)}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {inv.payment_method || 'Mobile Money'}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                                {inv.status || 'Paid'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {billingHistory.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                                            No subscription invoices recorded yet.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Modals */}
            {showSubscriptionCheckout && selectedPlanForCheckout && (
                <SubscriptionCheckoutModal
                    plan={selectedPlanForCheckout}
                    schoolName={config.name || 'Your School'}
                    schoolEmail={config.email || ''}
                    walletBalance={Number(schoolData?.wallet_balance || 0)}
                    onClose={() => setShowSubscriptionCheckout(false)}
                    onConfirm={(paymentDetails) => {
                        activateSubscriptionMutation.mutate({
                            planCode: selectedPlanForCheckout.code,
                            amount: selectedPlanForCheckout.amount,
                            paymentMethod: paymentDetails.method,
                            paymentRef: paymentDetails.reference,
                            description: selectedPlanForCheckout.name
                        });
                    }}
                    onPayFromWallet={() => {
                        payFromWalletMutation.mutate({
                            amount: selectedPlanForCheckout.amount,
                            purpose: 'subscription',
                            description: `License: ${selectedPlanForCheckout.name}`,
                            planCode: selectedPlanForCheckout.code
                        });
                    }}
                    onOpenTopUp={() => {
                        setShowSubscriptionCheckout(false);
                        setIsTopUpModalOpen(true);
                    }}
                    isPending={activateSubscriptionMutation.isPending}
                    isWalletPending={payFromWalletMutation.isPending}
                />
            )}

            {isSmsModalOpen && (
                <SMSPurchaseModal
                    currentBalance={config.sms_balance || 0}
                    schoolName={config.name || 'Your School'}
                    schoolEmail={config.email || ''}
                    walletBalance={Number(schoolData?.wallet_balance || 0)}
                    onClose={() => setIsSmsModalOpen(false)}
                    onBuy={(pack) => {
                        buySMSCreditsMutation.mutate({
                            quantity: pack.quantity,
                            amount: pack.amount,
                            paymentMethod: pack.paymentMethod,
                            reference: pack.reference
                        });
                    }}
                    onPayFromWallet={(pack) => {
                        payFromWalletMutation.mutate({
                            amount: pack.amount,
                            purpose: 'sms',
                            description: `${pack.quantity.toLocaleString()} SMS Credits`,
                            smsQuantity: pack.quantity
                        });
                    }}
                    onOpenTopUp={() => {
                        setIsSmsModalOpen(false);
                        setIsTopUpModalOpen(true);
                    }}
                    isPending={buySMSCreditsMutation.isPending}
                    isWalletPending={payFromWalletMutation.isPending}
                />
            )}

            {isTopUpModalOpen && (
                <TopUpWalletModal
                    currentBalance={Number(schoolData?.wallet_balance || 0)}
                    schoolName={config.name || 'Your School'}
                    schoolEmail={config.email || ''}
                    onClose={() => setIsTopUpModalOpen(false)}
                    onTopUp={(details) => {
                        topUpWalletMutation.mutate({
                            amount: details.amount,
                            paymentMethod: details.method,
                            reference: details.reference
                        });
                    }}
                    isPending={topUpWalletMutation.isPending}
                />
            )}

        </div>
    );
};

// --- MODALS ---

interface TopUpWalletModalProps {
    currentBalance: number;
    schoolName: string;
    schoolEmail: string;
    onClose: () => void;
    onTopUp: (details: { amount: number; method: string; reference?: string; phone?: string }) => void;
    isPending: boolean;
}

const TOPUP_PRESETS = [
    { label: 'Starter', amount: 100, desc: '1 Module' },
    { label: 'Popular', amount: 200, desc: '2 Modules' },
    { label: '⭐ Full Suite', amount: 350, desc: 'All 5 Modules' },
    { label: 'Pro Pack', amount: 500, desc: 'Suite + SMS' },
    { label: 'School Reserve', amount: 1000, desc: 'Full Term Reserve' },
];

const TopUpWalletModal: React.FC<TopUpWalletModalProps> = ({
    currentBalance,
    schoolName,
    schoolEmail,
    onClose,
    onTopUp,
    isPending
}) => {
    const [selectedAmount, setSelectedAmount] = useState<number>(350);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [method, setMethod] = useState<'momo' | 'card' | 'bank'>('momo');
    const [network, setNetwork] = useState<'MTN' | 'Telecel' | 'AT'>('MTN');
    const [phone, setPhone] = useState('');
    const [isLaunchingPaystack, setIsLaunchingPaystack] = useState(false);

    const finalAmount = selectedAmount === 0 ? Number(customAmount) || 0 : selectedAmount;

    const handleTopUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (finalAmount <= 0) {
            alert('Please select or specify a valid top-up amount.');
            return;
        }

        if (method === 'bank') {
            onTopUp({
                amount: finalAmount,
                method: 'Bank Transfer',
                reference: `BANK-${Date.now()}`
            });
            return;
        }

        // Online Gateway via Paystack (Ghana MoMo / Debit Card)
        setIsLaunchingPaystack(true);
        try {
            await payWithPaystack({
                amount: finalAmount,
                email: schoolEmail && schoolEmail.includes('@') ? schoolEmail : 'school@orbit.edu.gh',
                channels: method === 'momo' ? ['mobile_money'] : ['card'],
                metadata: {
                    school_name: schoolName,
                    purpose: 'orbit_wallet_topup',
                    phone: phone || undefined,
                    network: method === 'momo' ? network : undefined
                },
                onSuccess: (response) => {
                    setIsLaunchingPaystack(false);
                    onTopUp({
                        amount: finalAmount,
                        method: method === 'momo' ? `${network} Mobile Money` : 'Debit/Credit Card',
                        reference: response.reference,
                        phone
                    });
                },
                onClose: () => {
                    setIsLaunchingPaystack(false);
                }
            });
        } catch (err: any) {
            setIsLaunchingPaystack(false);
            console.error('Paystack top-up error:', err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-700/50">
                        Prepaid Base Wallet
                    </span>
                    <h3 className="text-xl font-black mt-2">Top Up Orbit School Wallet</h3>
                    <p className="text-xs text-emerald-100/80 mt-0.5">
                        Current Balance: <span className="font-bold text-white">GH₵ {currentBalance.toFixed(2)}</span> • {schoolName}
                    </p>
                </div>

                <form onSubmit={handleTopUpSubmit} className="p-6 overflow-y-auto space-y-5">
                    {/* Amount Preset Grid */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Select Top-Up Amount (GHS):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {TOPUP_PRESETS.map((p) => {
                                const isSelected = selectedAmount === p.amount;
                                return (
                                    <button
                                        key={p.amount}
                                        type="button"
                                        onClick={() => {
                                            setSelectedAmount(p.amount);
                                            setCustomAmount('');
                                        }}
                                        className={`p-3 rounded-2xl border text-left transition-all ${
                                            isSelected
                                                ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-sm'
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                    >
                                        <div className="text-[11px] font-bold text-slate-500">{p.label}</div>
                                        <div className="text-lg font-black text-slate-900 mt-0.5">GH₵ {p.amount}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => setSelectedAmount(0)}
                                className={`p-3 rounded-2xl border text-left transition-all ${
                                    selectedAmount === 0
                                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <div className="text-[11px] font-bold text-slate-500">Custom</div>
                                <div className="text-base font-black text-slate-900 mt-0.5">Other Amount</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">Type custom GHS</div>
                            </button>
                        </div>

                        {selectedAmount === 0 && (
                            <div className="mt-3">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Enter Custom Amount (GH₵)</label>
                                <input
                                    type="number"
                                    min="10"
                                    step="10"
                                    required
                                    placeholder="e.g. 750"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 text-base"
                                />
                            </div>
                        )}
                    </div>

                    {/* Method Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Select Payment Channel:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setMethod('momo')}
                                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                    method === 'momo'
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-sm ring-1 ring-emerald-500'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <Smartphone className="h-5 w-5" />
                                <span className="text-xs">Mobile Money</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('card')}
                                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                    method === 'card'
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-sm ring-1 ring-emerald-500'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <CreditCard className="h-5 w-5" />
                                <span className="text-xs">Card / Online</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('bank')}
                                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                    method === 'bank'
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-sm ring-1 ring-emerald-500'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <Building2 className="h-5 w-5" />
                                <span className="text-xs">Bank Transfer</span>
                            </button>
                        </div>
                    </div>

                    {/* Channel Details */}
                    {method === 'momo' && (
                        <div className="space-y-3 pt-1 animate-in fade-in">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Select Network</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['MTN', 'Telecel', 'AT'] as const).map((net) => (
                                        <button
                                            key={net}
                                            type="button"
                                            onClick={() => setNetwork(net)}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                                                network === net
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {net}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Money Number</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="e.g. 024 123 4567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 text-sm"
                                />
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-800">
                                <Zap className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                                <span>A prompt will be sent to your phone. After entering your PIN, your Orbit Wallet updates immediately.</span>
                            </div>
                        </div>
                    )}

                    {method === 'card' && (
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center space-y-1">
                            <CreditCard className="h-6 w-6 text-blue-600 mx-auto" />
                            <div className="text-xs font-bold text-slate-800">Secure Online Checkout</div>
                            <p className="text-[11px] text-slate-500">Visa, Mastercard, and Verve supported via 256-bit encryption.</p>
                        </div>
                    )}

                    {method === 'bank' && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Bank:</span>
                                <span className="font-bold text-slate-800">Zenith Bank Ghana</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Account:</span>
                                <span className="font-mono font-bold text-slate-900">6011234567890</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Reference:</span>
                                <span className="font-bold text-emerald-700">{schoolName.slice(0, 15)}</span>
                            </div>
                        </div>
                    )}

                    {/* Summary & Submit */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isPending || isLaunchingPaystack || finalAmount <= 0}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        >
                            {isPending || isLaunchingPaystack ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>{isLaunchingPaystack ? 'Connecting to Paystack...' : 'Updating Orbit Wallet...'}</span>
                                </>
                            ) : (
                                <>
                                    <Wallet className="h-4 w-4" />
                                    <span>{method === 'bank' ? `Record Bank Transfer of GH₵ ${finalAmount.toLocaleString()}` : `Pay GH₵ ${finalAmount.toLocaleString()} via Paystack`}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface SubscriptionCheckoutModalProps {
    plan: {
        code: string;
        name: string;
        amount: number;
        description: string;
        modules: string[];
    };
    schoolName: string;
    schoolEmail: string;
    walletBalance: number;
    onClose: () => void;
    onConfirm: (paymentDetails: { method: string; phone?: string; network?: string; reference?: string }) => void;
    onPayFromWallet: () => void;
    onOpenTopUp: () => void;
    isPending: boolean;
    isWalletPending: boolean;
}

const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({
    plan,
    schoolName,
    schoolEmail,
    walletBalance,
    onClose,
    onConfirm,
    onPayFromWallet,
    onOpenTopUp,
    isPending,
    isWalletPending
}) => {
    const [method, setMethod] = useState<'momo' | 'card' | 'bank'>('momo');
    const [phone, setPhone] = useState('');
    const [network, setNetwork] = useState<'MTN' | 'Telecel' | 'AT'>('MTN');
    const [isLaunchingPaystack, setIsLaunchingPaystack] = useState(false);

    const hasEnoughWalletBalance = walletBalance >= plan.amount;

    const handlePay = async (e?: React.FormEvent, directMethod?: 'momo' | 'card' | 'bank') => {
        if (e) e.preventDefault();
        const activeMethod = directMethod || method;

        if (activeMethod === 'bank') {
            onConfirm({
                method: 'Bank Transfer',
                reference: `BANK-${Date.now()}`
            });
            return;
        }

        setIsLaunchingPaystack(true);
        try {
            await payWithPaystack({
                amount: plan.amount,
                email: schoolEmail && schoolEmail.includes('@') ? schoolEmail : 'school@orbit.edu.gh',
                channels: activeMethod === 'momo' ? ['mobile_money'] : ['card'],
                metadata: {
                    school_name: schoolName,
                    plan_code: plan.code,
                    plan_name: plan.name,
                    phone: phone || undefined,
                    network: activeMethod === 'momo' ? network : undefined
                },
                onSuccess: (res) => {
                    setIsLaunchingPaystack(false);
                    onConfirm({
                        method: activeMethod === 'momo' ? `${network} Mobile Money` : 'Debit/Credit Card',
                        phone,
                        network,
                        reference: res.reference
                    });
                },
                onClose: () => {
                    setIsLaunchingPaystack(false);
                }
            });
        } catch (err: any) {
            setIsLaunchingPaystack(false);
            console.error('Subscription Paystack error:', err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100 flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-900/60 px-2.5 py-1 rounded-full border border-indigo-700/50">
                        Termly Software License
                    </span>
                    <h3 className="text-xl font-black mt-2">{plan.name}</h3>
                    <p className="text-xs text-slate-300 mt-0.5">{schoolName}</p>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Amount Card */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex justify-between items-center">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total License Fee</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-3xl font-black text-slate-900">GH₵ {plan.amount.toLocaleString()}</span>
                                <span className="text-xs text-slate-500 font-medium">/ 1 Term (4 Months)</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle className="h-3 w-3" /> All Students Included
                            </span>
                        </div>
                    </div>

                    {/* Included Modules Pill List */}
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Modules Being Licensed:</span>
                        <div className="flex flex-wrap gap-1.5">
                            {plan.modules.map((m, idx) => (
                                <span key={idx} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                                    <Check className="h-3 w-3 text-indigo-500" />
                                    {m}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* ⭐ UNIFIED ORBIT WALLET OPTION */}
                    {hasEnoughWalletBalance ? (
                        <div className="bg-emerald-50/80 border-2 border-emerald-500 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-emerald-600 text-white rounded-xl">
                                        <Wallet className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                                            Orbit Base Wallet (Instant 1-Click)
                                        </span>
                                        <div className="text-base font-black text-slate-900">
                                            Available: GH₵ {walletBalance.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-full">
                                    Funds Ready
                                </span>
                            </div>
                            <p className="text-xs text-emerald-900">
                                You have enough balance in your school wallet. Pay instantly with zero phone prompts or network delays!
                            </p>
                            <button
                                type="button"
                                onClick={onPayFromWallet}
                                disabled={isWalletPending || isPending}
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                            >
                                {isWalletPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />}
                                {isWalletPending ? 'Activating License...' : `⚡ Pay GH₵ ${plan.amount.toLocaleString()} from Orbit Wallet`}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-slate-200 text-slate-700 rounded-xl">
                                    <Wallet className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Orbit Wallet Balance
                                    </span>
                                    <div className="text-sm font-bold text-slate-800">
                                        GH₵ {walletBalance.toFixed(2)} <span className="text-xs text-amber-600 font-semibold">(GH₵ {(plan.amount - walletBalance).toFixed(2)} short)</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onOpenTopUp}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1"
                            >
                                <Wallet className="h-3 w-3" /> + Top Up Wallet
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-3 my-1 text-slate-400">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {hasEnoughWalletBalance ? 'or pay with external MoMo / Card' : 'Direct Payment Channels'}
                        </span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setMethod('momo')}
                                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                    method === 'momo'
                                        ? 'border-primary-600 bg-primary-50/70 text-primary-700 font-bold shadow-sm ring-1 ring-primary-500'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <Smartphone className="h-5 w-5" />
                                <span className="text-xs">Mobile Money</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('card')}
                                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                    method === 'card'
                                        ? 'border-primary-600 bg-primary-50/70 text-primary-700 font-bold shadow-sm ring-1 ring-primary-500'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <CreditCard className="h-5 w-5" />
                                <span className="text-xs">Debit Card</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('bank')}
                                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                    method === 'bank'
                                        ? 'border-primary-600 bg-primary-50/70 text-primary-700 font-bold shadow-sm ring-1 ring-primary-500'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <Building2 className="h-5 w-5" />
                                <span className="text-xs">Bank Transfer</span>
                            </button>
                        </div>
                    </div>

                    {/* Method Details */}
                    {method === 'momo' && (
                        <form onSubmit={handlePay} className="space-y-4 pt-1 animate-in fade-in">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Select Network</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['MTN', 'Telecel', 'AT'] as const).map((net) => (
                                        <button
                                            key={net}
                                            type="button"
                                            onClick={() => setNetwork(net)}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                                                network === net
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {net}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Money Number</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="e.g. 024 123 4567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-800 text-base"
                                />
                            </div>
                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2.5 text-xs text-amber-800">
                                <Zap className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                <span>A prompt will be sent to your phone. Authorize with your 4-digit MoMo PIN to activate your software immediately.</span>
                            </div>

                            <button
                                type="submit"
                                disabled={isPending || isLaunchingPaystack}
                                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                            >
                                {isPending || isLaunchingPaystack ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
                                {isPending || isLaunchingPaystack ? 'Opening Paystack Gateway...' : `Pay GH₵ ${plan.amount.toLocaleString()} via ${network} MoMo`}
                            </button>
                        </form>
                    )}

                    {method === 'card' && (
                        <div className="space-y-4 pt-1 text-center py-2 animate-in fade-in">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 max-w-sm mx-auto">
                                <CreditCard className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                <h4 className="font-bold text-slate-800 text-sm">Secure Card Payment</h4>
                                <p className="text-xs text-slate-500 mt-1">Visa, Mastercard, and Verve supported via 256-bit encryption.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handlePay(undefined, 'card')}
                                disabled={isPending || isLaunchingPaystack}
                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                            >
                                {isPending || isLaunchingPaystack ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                {isPending || isLaunchingPaystack ? 'Opening Paystack Gateway...' : `Pay GH₵ ${plan.amount.toLocaleString()} with Card`}
                            </button>
                        </div>
                    )}

                    {method === 'bank' && (
                        <div className="space-y-3 pt-1 text-xs text-slate-600 animate-in fade-in">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Bank Name</span>
                                    <span className="font-bold text-slate-800">Zenith Bank Ghana</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Account Name</span>
                                    <span className="font-bold text-slate-800">Orbit EdTech Systems</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Account Number</span>
                                    <span className="font-mono font-bold text-slate-900 text-sm">6011234567890</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Payment Reference</span>
                                    <span className="font-bold text-primary-600">{schoolName.slice(0, 15)}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onConfirm({ method: 'Bank Transfer', reference: `BANK-${Date.now()}` })}
                                disabled={isPending}
                                className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-2"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                                {isPending ? 'Generating...' : 'I Have Transferred — Generate Invoice & Activate'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface SMSPurchaseModalProps {
    currentBalance: number;
    schoolName: string;
    schoolEmail: string;
    walletBalance: number;
    onClose: () => void;
    onBuy: (pack: { quantity: number; amount: number; paymentMethod?: string; reference?: string }) => void;
    onPayFromWallet: (pack: { quantity: number; amount: number }) => void;
    onOpenTopUp: () => void;
    isPending: boolean;
    isWalletPending: boolean;
}

const SMSPurchaseModal: React.FC<SMSPurchaseModalProps> = ({
    currentBalance,
    schoolName,
    schoolEmail,
    walletBalance,
    onClose,
    onBuy,
    onPayFromWallet,
    onOpenTopUp,
    isPending,
    isWalletPending
}) => {
    const [selectedPackId, setSelectedPackId] = useState<string>('school');
    const [customQty, setCustomQty] = useState<string>('');
    const [phone, setPhone] = useState('');
    const [isLaunchingPaystack, setIsLaunchingPaystack] = useState(false);

    const activePack = SMS_PACKS.find(p => p.id === selectedPackId);
    const isCustom = selectedPackId === 'custom';
    const computedQuantity = isCustom ? Number(customQty) || 0 : activePack?.credits || 0;
    const computedPrice = isCustom ? Math.round(computedQuantity * 0.055) : activePack?.price || 0;

    const hasEnoughWalletBalance = walletBalance >= computedPrice && computedPrice > 0;

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (computedQuantity <= 0 || computedPrice <= 0) {
            alert('Please select or specify a valid SMS quantity.');
            return;
        }

        setIsLaunchingPaystack(true);
        try {
            await payWithPaystack({
                amount: computedPrice,
                email: schoolEmail && schoolEmail.includes('@') ? schoolEmail : 'school@orbit.edu.gh',
                channels: ['mobile_money', 'card'],
                metadata: {
                    school_name: schoolName,
                    type: 'sms_purchase',
                    credits: computedQuantity,
                    phone: phone || undefined
                },
                onSuccess: (res) => {
                    setIsLaunchingPaystack(false);
                    onBuy({
                        quantity: computedQuantity,
                        amount: computedPrice,
                        paymentMethod: 'Paystack MoMo/Card',
                        reference: res.reference
                    });
                },
                onClose: () => {
                    setIsLaunchingPaystack(false);
                }
            });
        } catch (err: any) {
            setIsLaunchingPaystack(false);
            console.error('SMS Paystack error:', err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 bg-blue-900/60 px-2.5 py-1 rounded-full">
                        Instant SMS Top-Up
                    </span>
                    <h3 className="text-xl font-black mt-2">Buy SMS Credit Pack</h3>
                    <p className="text-xs text-blue-100 mt-0.5">Current Balance: {currentBalance.toLocaleString()} Credits</p>
                </div>

                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="space-y-2.5">
                        {SMS_PACKS.map(pack => (
                            <div
                                key={pack.id}
                                onClick={() => setSelectedPackId(pack.id)}
                                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                    selectedPackId === pack.id
                                        ? 'border-primary-600 bg-primary-50/50 shadow-sm ring-1 ring-primary-500'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedPackId === pack.id ? 'border-primary-600 bg-primary-600' : 'border-slate-300'
                                    }`}>
                                        {selectedPackId === pack.id && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 text-sm">{pack.name}</span>
                                            {pack.badge && (
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-primary-600 text-white px-2 py-0.5 rounded-full">
                                                    {pack.badge}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500">{pack.credits.toLocaleString()} SMS • {pack.rate}</span>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-slate-900">GH₵ {pack.price}</span>
                            </div>
                        ))}
                    </div>

                    {/* ⭐ WALLET 1-CLICK OPTION FOR SMS */}
                    {hasEnoughWalletBalance ? (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-bold text-slate-900">Orbit Wallet: GH₵ {walletBalance.toFixed(2)}</span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    1-Click Instant
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onPayFromWallet({ quantity: computedQuantity, amount: computedPrice })}
                                disabled={isWalletPending || computedPrice <= 0}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                                {isWalletPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />}
                                {isWalletPending ? 'Purchasing Credits...' : `⚡ Pay GH₵ ${computedPrice} from Orbit Wallet`}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                            <div>
                                <span className="text-slate-500">Orbit Wallet:</span> <b className="text-slate-800">GH₵ {walletBalance.toFixed(2)}</b>
                            </div>
                            <button
                                type="button"
                                onClick={onOpenTopUp}
                                className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                            >
                                <Wallet className="h-3 w-3" /> + Top Up Wallet
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-3 my-1 text-slate-400">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">or pay via Mobile Money</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    <form onSubmit={handlePurchase} className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Money Number</label>
                            <input
                                type="tel"
                                required
                                placeholder="e.g. 0244 000 000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-800 text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isPending || isLaunchingPaystack || computedPrice <= 0}
                            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        >
                            {isPending || isLaunchingPaystack ? <Loader2 className="h-5 w-5 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                            {isPending || isLaunchingPaystack ? 'Opening Paystack Checkout...' : `Pay GH₵ ${computedPrice} for ${computedQuantity.toLocaleString()} SMS`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Settings;