import React, { useState, useEffect } from 'react';
import {
    Building2, Lock, CreditCard, Save, Upload, CheckCircle,
    History, Gift, Copy, MessageSquare, Plus, X
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
}

const Settings: React.FC<SettingsProps> = ({ onConfigUpdate, currentUser }) => {
    const isTeacher = currentUser?.role === 'teacher';
    // If teacher, force security tab default
    const [activeTab, setActiveTab] = useState<'general' | 'security' | 'billing'>(isTeacher ? 'security' : 'general');
    const [loading, setLoading] = useState(false);

    // -- Data States --
    const [config, setConfig] = useState<any>({});
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [billingHistory, setBillingHistory] = useState<any[]>([]);
    const [smsBalance, setSmsBalance] = useState(0);
    const [showSmsModal, setShowSmsModal] = useState(false);

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
                    plan: school.subscription_plan || 'Small School' // Default to Small School
                });
                setSmsBalance(school.sms_balance || 0);

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
        };

        fetchSettings();
    }, [currentUser?.school_id]);

    // -- Handlers --

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

    const handleBuySms = async (units: number, cost: number) => {
        if (!currentUser?.school_id) return;
        setLoading(true);

        // 1. Update Balance in DB
        const newBalance = smsBalance + units;
        const { error: balanceError } = await supabase
            .from('schools')
            .update({ sms_balance: newBalance })
            .eq('id', currentUser.school_id);

        if (balanceError) {
            alert("Error purchasing SMS: " + balanceError.message);
            setLoading(false);
            return;
        }

        setSmsBalance(newBalance);

        // 2. Add Billing Record to Supabase
        const newRecord = {
            school_id: currentUser.school_id,
            date: new Date().toISOString().split('T')[0],
            description: `SMS Bundle (${units} Units)`,
            amount: cost,
            status: 'Paid'
        };

        const { data: insertedRecord, error: billingError } = await supabase
            .from('billing_history')
            .insert(newRecord)
            .select()
            .single();

        if (billingError) {
            console.error('Error saving billing record:', billingError);
        } else if (insertedRecord) {
            setBillingHistory([insertedRecord, ...billingHistory]);
        }

        setLoading(false);
        setShowSmsModal(false);
        alert(`Successfully purchased ${units} SMS credits!`);
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
                        >
                            <Building2 className="h-5 w-5" /> General
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Lock className="h-5 w-5" /> Security
                    </button>
                    {!isTeacher && (
                        <button
                            onClick={() => setActiveTab('billing')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === 'billing' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <CreditCard className="h-5 w-5" /> Billing & Plans
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area (Right) */}
            <div className="flex-1 overflow-y-auto p-8">

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
                                <div className="flex gap-4">
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
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-70"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                    {!loading && <Save className="h-4 w-4" />}
                                </button>
                            </div>
                        </form>

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
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Billing & Plans</h2>
                            <p className="text-slate-500 text-sm">Manage your subscription and SMS credits.</p>
                        </div>

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
                                        <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                                            Active
                                        </span>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                                            <span className="text-slate-300">Amount</span>
                                            <span className="font-bold">GH¢ {currentPlan.price} / mo</span>
                                        </div>
                                        <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                                            <span className="text-slate-300">Next Billing</span>
                                            <span className="font-bold">Jan 1, 2026</span>
                                        </div>
                                    </div>

                                    <button className="w-full bg-white text-slate-900 py-2 rounded-lg font-bold text-sm hover:bg-slate-100 transition-colors">
                                        Manage Subscription
                                    </button>
                                </div>
                            </div>

                            {/* SMS Balance Card */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                            <MessageSquare className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-lg">SMS Credits</h3>
                                    </div>
                                    <p className="text-slate-500 text-sm mb-6">
                                        Credits are required to send bulk messages to parents. They do not expire.
                                    </p>
                                    <div className="flex items-baseline gap-2 mb-6">
                                        <span className="text-4xl font-extrabold text-slate-900">{smsBalance}</span>
                                        <span className="text-slate-500 font-medium">Units Available</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSmsModal(true)}
                                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" /> Buy Credits
                                </button>
                            </div>
                        </div>

                        {/* Payment History */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                                <History className="h-5 w-5 text-slate-500" />
                                <h3 className="font-bold text-slate-800">Payment History</h3>
                            </div>
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
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* --- SMS PURCHASE MODAL --- */}
            {showSmsModal && !isTeacher && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Top Up SMS Credits</h3>
                            <button onClick={() => setShowSmsModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-slate-500 text-sm mb-6">Select a bundle package below. Payment is processed securely via Mobile Money.</p>

                            <div className="grid grid-cols-1 gap-4">
                                {[
                                    { units: 500, price: 20, tag: 'Starter' },
                                    { units: 1000, price: 35, tag: 'Popular', highlight: true },
                                    { units: 2000, price: 60, tag: 'Best Value' }
                                ].map(pkg => (
                                    <button
                                        key={pkg.units}
                                        onClick={() => handleBuySms(pkg.units, pkg.price)}
                                        disabled={loading}
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${pkg.highlight
                                            ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-200'
                                            : 'border-slate-200 hover:border-primary-300'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 text-lg">{pkg.units} SMS</span>
                                                {pkg.highlight && <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{pkg.tag}</span>}
                                                {!pkg.highlight && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{pkg.tag}</span>}
                                            </div>
                                            <p className="text-xs text-slate-500">Instant delivery</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-bold text-xl text-slate-800">GH¢ {pkg.price}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Settings;