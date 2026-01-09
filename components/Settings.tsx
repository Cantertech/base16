import React, { useState, useEffect } from 'react';
import {
    Building2, Lock, CreditCard, Save, Upload, CheckCircle,
    History, Gift, Copy, X, Layout, Download, Smartphone
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { uploadToCloudinary } from '../utils/cloudinary';

interface SettingsProps {
    onConfigUpdate: () => void;
    currentUser?: {
        id: string;
        school_id: string;
        name: string;
        role: 'admin' | 'teacher';
    };
    hiddenMenuItems?: string[];
    toggleHiddenMenu?: (name: string) => void;
    availableMenus?: any[];
}

const Settings: React.FC<SettingsProps> = ({ onConfigUpdate, currentUser, hiddenMenuItems, toggleHiddenMenu, availableMenus }) => {
    const isTeacher = currentUser?.role === 'teacher';
    // If teacher, force security tab default
    const [activeTab, setActiveTab] = useState<'general' | 'security' | 'billing' | 'menu'>(isTeacher ? 'security' : 'general');
    const [loading, setLoading] = useState(false);

    // -- Data States --
    const [config, setConfig] = useState<any>({});
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [billingHistory, setBillingHistory] = useState<any[]>([]);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null); // PWA Install Prompt

    // -- Billing & SMS State --
    const [billingTab, setBillingTab] = useState<'overview' | 'sms' | 'settings'>('overview');
    const [smsData, setSmsData] = useState({ balance: 0, transactions: [] as any[] });
    const [smsCalc, setSmsCalc] = useState({ amount: '', qty: '' });
    const [showInvoice, setShowInvoice] = useState<any>(null);


    // -- Pricing Plans --
    const plans = [
        {
            name: "Small School",
            price: "200",
            limit: "Up to 400 Students",
            features: ["Student & Parent Database", "Basic Fee Tracking", "Terminal Report Cards", "SMS Reminders", "Email Support"]
        },
        {
            name: "Growth",
            price: "500",
            limit: "Unlimited Students",
            isPopular: true,
            features: ["Everything in Small School", "Advanced Financial Reports", "Staff Payroll Management", "Priority Phone Support", "Free 500 SMS Credits / Term", "Offline Sync Mode"]
        }
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            if (!currentUser?.school_id) return;

            // Fetch School Details
            const { data: school } = await supabase
                .from('schools')
                .select('*')
                .eq('id', currentUser.school_id)
                .single();

            if (school) {
                setConfig({
                    name: school.name,
                    motto: school.motto,
                    phone: school.phone,
                    email: school.email,
                    logo: school.logo_url,
                    color: school.theme_color || 'blue',
                    referralCode: school.referral_code || `BW-${Math.floor(Math.random() * 900 + 100)}`, // Generate if missing
                    referralPreference: school.referral_preference || 'CASH',
                    plan: school.subscription_plan || 'Small School', // Default to Small School
                    nextPaymentDue: school.next_payment_due,
                    paymentConfig: school.payment_config || {}
                });

                // If referral code was generated on fly, save it back (lazy init)
                if (!school.referral_code) {
                    await supabase.from('schools').update({
                        referral_code: `BW-${Math.floor(Math.random() * 900 + 100)}`
                    }).eq('id', currentUser.school_id);
                }
            }

            // Fetch Billing History
            const { data: billingData } = await supabase
                .from('billing_history')
                .select('*')
                .eq('school_id', currentUser.school_id)
                .order('date', { ascending: false });

            if (billingData) {
                setBillingHistory(billingData);
            }

            // Fetch SMS Data
            const { data: smsTransactions } = await supabase.from('sms_transactions').select('*').eq('school_id', currentUser.school_id).order('created_at', { ascending: false });
            if (school) {
                const balance = school.sms_balance || 0;
                setSmsData({ balance, transactions: smsTransactions || [] });
            }
        };

        fetchSettings();
    }, [currentUser?.school_id]);

    // PWA Install Prompt Listener
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // -- Handlers --

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleGeneralSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.school_id) return;

        setLoading(true);

        const { error } = await supabase
            .from('schools')
            .update({
                name: config.name,
                motto: config.motto,
                phone: config.phone,
                logo_url: config.logo,
                theme_color: config.color,
                referral_preference: config.referralPreference
            })
            .eq('id', currentUser.school_id);

        if (error) {
            alert('Error updating settings: ' + error.message);
        } else {
            // Update local storage for fallback/legacy components if any
            localStorage.setItem('schoolhub_config', JSON.stringify(config));
            onConfigUpdate(); // Notify Dashboard to refresh
            alert('School settings updated successfully!');
        }
        setLoading(false);
    };

    const handleSecuritySave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            alert("New passwords do not match.");
            return;
        }
        setLoading(true);

        const { error } = await supabase.auth.updateUser({ password: passwords.new });

        if (error) {
            alert("Error updating password: " + error.message);
        } else {
            setPasswords({ current: '', new: '', confirm: '' });
            alert('Password updated successfully!');
        }
        setLoading(false);
    };



    const handleUpdatePlan = async (planName: string) => {
        if (!currentUser?.school_id) return;
        setLoading(true);

        const { error } = await supabase
            .from('schools')
            .update({ subscription_plan: planName })
            .eq('id', currentUser.school_id);

        if (error) {
            alert("Error updating plan: " + error.message);
        } else {
            setConfig({ ...config, plan: planName });
            alert(`Plan updated to ${planName}`);
            setShowPlanModal(false);
        }
        setLoading(false);
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                setConfig({ ...config, logo: url });
            } catch (error) {
                alert("Error uploading image");
            }
        }
    };
    const handleCopyCode = () => {
        navigator.clipboard.writeText(config.referralCode);
        alert('Referral code copied to clipboard!');
    };

    // Helper to get current plan details
    const currentPlan = plans.find(p => p.name === config.plan) || plans[0];

    return (
        <div className="flex flex-col lg:flex-row h-full bg-slate-50 overflow-hidden">
            {/* Sidebar Navigation (Left) */}
            <div className="w-full lg:w-64 bg-white border-r border-slate-200 flex flex-row lg:flex-col shrink-0">
                <div className="p-6 border-b border-slate-100 hidden lg:block">
                    <h2 className="font-bold text-slate-800 text-lg">Settings</h2>
                    <p className="text-slate-500 text-xs">Manage your account</p>
                </div>

                <div className="flex flex-row lg:flex-col p-2 lg:p-4 gap-2 overflow-x-auto">
                    {!isTeacher && (
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'general' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            style={activeTab === 'general' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                        >
                            <Building2 className="h-5 w-5" /> General
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        style={activeTab === 'security' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                    >
                        <Lock className="h-5 w-5" /> Security
                    </button>
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
                        onClick={() => setActiveTab('menu')}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'menu' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        style={activeTab === 'menu' && config.color?.startsWith('#') ? { backgroundColor: `${config.color}15`, color: config.color } : {}}
                    >
                        <Layout className="h-5 w-5" /> Menu Customization
                    </button>
                </div>
            </div>

            {/* Main Content Area (Right) */}
            <div className="flex-1 overflow-y-auto p-8">

                {/* --- TAB 1: GENERAL --- */}
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

                            <div className="flex items-center gap-4">
                                <div className="h-24 w-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-primary-400 transition-colors">
                                    {config.logo ? (
                                        <img src={config.logo} alt="Logo" className="h-full w-full object-cover" />
                                    ) : (
                                        <Upload className="h-8 w-8 text-slate-400" />
                                    )}
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white text-xs font-bold">Change</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">School Logo</h3>
                                    <p className="text-slate-500 text-xs">Click to upload a new logo (PNG, JPG)</p>
                                </div>
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
                                    disabled={loading}
                                    className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-70"
                                    style={config.color?.startsWith('#') ? { backgroundColor: config.color } : {}}
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                    {!loading && <Save className="h-4 w-4" />}
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
                            {!isTeacher && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Administrator Name</label>
                                    <input
                                        type="text"
                                        value={config.admin || ''}
                                        onChange={e => setConfig({ ...config, admin: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-slate-50"
                                    />
                                </div>
                            )}

                            <div className={!isTeacher ? "pt-4 border-t border-slate-100" : ""}>
                                <h3 className="font-bold text-slate-800 mb-4">Change Password</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                        <input
                                            required
                                            type="password"
                                            value={passwords.new}
                                            onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                        <input
                                            required
                                            type="password"
                                            value={passwords.confirm}
                                            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-70"
                                    style={config.color?.startsWith('#') ? { backgroundColor: config.color } : {}}
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                    {!loading && <Lock className="h-4 w-4" />}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* --- TAB 3: BILLING --- */}
                {activeTab === 'billing' && !isTeacher && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Billing & Credits</h2>
                                <p className="text-slate-500 text-sm">Manage subscription, SMS credits, and payment methods.</p>
                            </div>

                            {/* Sub Navigation */}
                            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                <button onClick={() => setBillingTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingTab === 'overview' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Overview</button>
                                <button onClick={() => setBillingTab('sms')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${billingTab === 'sms' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:text-primary-600'}`}>
                                    <Smartphone className="w-4 h-4" /> SMS Credits
                                </button>
                                <button onClick={() => setBillingTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingTab === 'settings' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Settings</button>
                            </div>
                        </div>

                        {/* SUB-TAB: OVERVIEW */}
                        {billingTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Subscription Card */}
                                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <CreditCard className="h-32 w-32 transform rotate-12" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Current Plan</p>
                                                <h3 className="text-2xl font-bold mt-1">{currentPlan.name}</h3>
                                                <p className="text-slate-400 text-xs mt-1">{currentPlan.limit}</p>
                                            </div>
                                            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">Active</span>
                                        </div>
                                        <div className="space-y-4 mb-8">
                                            <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                                                <span className="text-slate-300">Amount</span>
                                                <span className="font-bold">GH¢ {currentPlan.price} / mo</span>
                                            </div>
                                            <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                                                <span className="text-slate-300">Next Billing</span>
                                                <span className="font-bold">{config.nextPaymentDue ? new Date(config.nextPaymentDue).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowPlanModal(true)} className="w-full bg-white text-slate-900 py-2 rounded-lg font-bold text-sm hover:bg-slate-100 transition-colors">Manage Subscription</button>
                                    </div>
                                </div>

                                {/* Payment History */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden col-span-1 md:col-span-2">
                                    <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                                        <History className="h-5 w-5 text-slate-500" />
                                        <h3 className="font-bold text-slate-800">Subscription History</h3>
                                    </div>
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Description</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {billingHistory.map((item: any) => (
                                                    <tr key={item.id} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4 text-sm text-slate-600">{item.date}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.description}</td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">GH¢ {item.amount.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                                                <CheckCircle className="h-3 w-3" /> {item.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {billingHistory.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No history available</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: SMS CREDITS */}
                        {billingTab === 'sms' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Buy Credits */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">Purchase SMS Credits</h3>
                                        <p className="text-slate-500 text-sm">Top up your balance to send messages. <br /><span className="text-primary-600 font-bold">Rate: GH¢ 0.035 / SMS</span></p>
                                    </div>

                                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">I want to buy (Quantity)</label>
                                            <input
                                                type="number"
                                                value={smsCalc.qty}
                                                onChange={e => {
                                                    const q = Number(e.target.value);
                                                    setSmsCalc({ qty: e.target.value, amount: (q * 0.035).toFixed(2) });
                                                }}
                                                placeholder="e.g. 1000 SMS"
                                                className="w-full p-3 font-bold text-lg border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                            />
                                        </div>
                                        <div className="flex items-center justify-center text-slate-400">
                                            <Layout className="w-4 h-4 rotate-90" /> {/* Exchange Icon Replacement */}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">I want to pay (Amount GH¢)</label>
                                            <input
                                                type="number"
                                                value={smsCalc.amount}
                                                onChange={e => {
                                                    const a = Number(e.target.value);
                                                    setSmsCalc({ amount: e.target.value, qty: Math.floor(a / 0.035).toString() });
                                                }}
                                                placeholder="e.g. 50.00"
                                                className="w-full p-3 font-bold text-lg border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        disabled={!smsCalc.qty || Number(smsCalc.qty) <= 0 || loading}
                                        onClick={async () => {
                                            if (!confirm(`Confirm purchase of ${smsCalc.qty} SMS for GH¢ ${smsCalc.amount}?`)) return;
                                            setLoading(true);
                                            try {
                                                const { data, error } = await supabase.rpc('request_sms_purchase', {
                                                    p_school_id: currentUser?.school_id,
                                                    p_quantity: Number(smsCalc.qty),
                                                    p_amount: Number(smsCalc.amount)
                                                });
                                                if (error) throw error;
                                                setShowInvoice({
                                                    ref: data,
                                                    amount: smsCalc.amount,
                                                    qty: smsCalc.qty
                                                });
                                                setSmsCalc({ amount: '', qty: '' });
                                                // Refresh
                                                const { data: txs } = await supabase.from('sms_transactions').select('*').eq('school_id', currentUser?.school_id).order('created_at', { ascending: false });
                                                if (txs) setSmsData(prev => ({ ...prev, transactions: txs }));

                                            } catch (e: any) {
                                                alert("Error: " + e.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Smartphone className="animate-pulse" /> : <CreditCard className="w-5 h-5" />} Buy Credits
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
                                            <h3 className="text-4xl font-black">{smsData.balance.toLocaleString()}</h3>
                                            <p className="text-blue-200 text-sm mt-1">SMS Remaining</p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-64 overflow-y-auto">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                                            <h3 className="font-bold text-slate-700 text-sm">Purchase History</h3>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {smsData.transactions.map((tx, i) => (
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
                                            {smsData.transactions.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">No purchases yet.</div>}
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
                                        onClick={async () => {
                                            setLoading(true);
                                            const { error } = await supabase.from('schools')
                                                .update({ payment_config: config.paymentConfig })
                                                .eq('id', currentUser?.school_id);
                                            setLoading(false);
                                            if (error) alert('Failed to save settings: ' + error.message);
                                            else alert('Settings saved successfully!');
                                        }}
                                        disabled={loading}
                                        className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-900 transition-colors disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Save Configuration'}
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
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Manage Subscription</h3>
                            <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plans.map((plan) => (
                                <div key={plan.name} className={`border-2 rounded-xl p-6 relative flex flex-col ${config.plan === plan.name ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-slate-200 hover:border-slate-300'}`}>
                                    {config.plan === plan.name && (
                                        <div className="absolute top-0 right-0 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">
                                            CURRENT PLAN
                                        </div>
                                    )}
                                    <h4 className="font-bold text-lg text-slate-800 mb-1">{plan.name}</h4>
                                    <p className="text-3xl font-bold text-slate-900 mb-4">GH¢ {plan.price}<span className="text-sm font-normal text-slate-500">/mo</span></p>

                                    <ul className="space-y-2 mb-6 flex-1">
                                        {plan.features.map((feat, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        disabled={loading || config.plan === plan.name}
                                        onClick={() => handleUpdatePlan(plan.name)}
                                        className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${config.plan === plan.name ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'}`}
                                    >
                                        {loading ? 'Processing...' : config.plan === plan.name ? 'Active Plan' : 'Switch to ' + plan.name}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 bg-slate-50 rounded-xl text-center">
                            <p className="text-sm text-slate-500">Need a custom enterprise plan? <button className="text-primary-600 font-bold hover:underline">Contact Sales</button></p>
                        </div>
                    </div>
                </div>
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

        </div>
    );
};

export default Settings;