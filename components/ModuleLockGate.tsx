import React, { useState } from 'react';
import { Sparkles, Wallet, CreditCard, Lock, CheckCircle, Zap, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { payWithPaystack, verifyPaystackPayment } from '../utils/paystack';
import { useQueryClient } from '@tanstack/react-query';

export interface ModuleLockGateProps {
    moduleCode: 'academic_engine' | 'revenue_guard' | 'daily_operations' | 'parent_portal' | 'ai_copilot';
    moduleName: string;
    subtitle: string;
    price: number; // in GHS
    badge: string;
    features: string[];
    schoolId: string;
    schoolName?: string;
    schoolEmail?: string;
    walletBalance?: number;
    onUnlocked?: () => void;
}

export const ModuleLockGate: React.FC<ModuleLockGateProps> = ({
    moduleCode,
    moduleName,
    subtitle,
    price,
    badge,
    features,
    schoolId,
    schoolName = 'Your School',
    schoolEmail = '',
    walletBalance = 0,
    onUnlocked
}) => {
    const queryClient = useQueryClient();
    const [isWalletUnlocking, setIsWalletUnlocking] = useState(false);
    const [isPaystackLoading, setIsPaystackLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const hasEnoughWallet = walletBalance >= price;

    // Handle 1-Click Instant Unlock using Wallet Balance (atomic server-side RPC)
    const handleWalletUnlock = async () => {
        if (!hasEnoughWallet) return;
        setIsWalletUnlocking(true);
        setErrorMsg(null);

        try {
            const { error: rpcErr } = await supabase.rpc('pay_from_school_wallet', {
                p_school_id: schoolId,
                p_amount: price,
                p_purpose: 'subscription',
                p_description: `Unlocked Module: ${moduleName} (${price} GHS/term)`,
                p_plan_code: moduleCode,
                p_sms_quantity: 0
            });

            if (rpcErr) throw rpcErr;

            // Refresh cached queries
            await queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
            await queryClient.invalidateQueries({ queryKey: ['schoolConfig', schoolId] });
            await queryClient.invalidateQueries({ queryKey: ['activeSubscription', schoolId] });

            if (onUnlocked) onUnlocked();
        } catch (err: any) {
            console.error('Failed to unlock module with wallet:', err);
            setErrorMsg(err.message || 'Failed to complete wallet activation. Please try again.');
        } finally {
            setIsWalletUnlocking(false);
        }
    };

    // Handle Paystack Payment Gateway (server-side verified)
    const handlePaystackUnlock = async () => {
        setIsPaystackLoading(true);
        setErrorMsg(null);

        try {
            const res = await payWithPaystack({
                amount: price,
                email: schoolEmail || 'admin@base16.com',
                metadata: {
                    school_id: schoolId,
                    module_code: moduleCode,
                    purpose: 'module_unlock'
                },
                onSuccess: async (payRes) => {
                    try {
                        await verifyPaystackPayment({
                            reference: payRes.reference,
                            action: 'module_unlock',
                            schoolId,
                            expectedAmount: price,
                            moduleCode,
                            moduleName,
                            paymentMethod: 'Paystack MoMo/Card'
                        });

                        await queryClient.invalidateQueries({ queryKey: ['schoolSettings', schoolId] });
                        await queryClient.invalidateQueries({ queryKey: ['schoolConfig', schoolId] });
                        await queryClient.invalidateQueries({ queryKey: ['activeSubscription', schoolId] });

                        if (onUnlocked) onUnlocked();
                    } catch (verifyErr: any) {
                        setErrorMsg(verifyErr.message || 'Payment verification failed. Contact support with your reference.');
                    } finally {
                        setIsPaystackLoading(false);
                    }
                },
                onClose: () => {
                    setIsPaystackLoading(false);
                }
            });

            if (!res) setIsPaystackLoading(false);
        } catch (err: any) {
            console.error('Paystack module launch error:', err);
            setIsPaystackLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Badge */}
            <div className="text-center space-y-3 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 shadow-xs">
                    <Lock className="w-3.5 h-3.5" /> {badge} Module Locked
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                    Unlock {moduleName}
                </h2>
                <p className="text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
                    {subtitle}. Activate this module to immediately enable full functional access for your school.
                </p>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Feature Highlights Column */}
                <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-md">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Included Features</h3>
                            <p className="text-xs text-slate-500">Everything you get with {moduleName}</p>
                        </div>
                    </div>

                    <ul className="space-y-4">
                        {features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                                <div className="mt-0.5 p-1 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                                    <CheckCircle className="h-4 w-4" />
                                </div>
                                <span>{feat}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Interactive Sample Demo Preview Box */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span>Live Feature Showcase</span>
                            <span className="text-blue-600 font-extrabold flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Ready to Use
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                            "Once activated, this module seamlessly connects with your enrolled students, staff, and school ledgers with instant real-time sync."
                        </p>
                    </div>
                </div>

                {/* Activation Action Box */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-700 space-y-6">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Termly Module Fee</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-4xl font-black tracking-tight text-white">GH₵ {price}</span>
                                <span className="text-xs text-slate-400 font-semibold">/ term</span>
                            </div>
                        </div>

                        {/* Wallet Section */}
                        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-slate-300 font-bold uppercase tracking-wider">
                                    <Wallet className="h-4 w-4 text-emerald-400" /> Wallet Balance
                                </div>
                                <span className="font-extrabold text-emerald-400 text-sm">
                                    GH₵ {Number(walletBalance).toFixed(2)}
                                </span>
                            </div>

                            {hasEnoughWallet ? (
                                <button
                                    onClick={handleWalletUnlock}
                                    disabled={isWalletUnlocking}
                                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                                >
                                    {isWalletUnlocking ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                                    ) : (
                                        <Zap className="h-4 w-4 text-slate-950 fill-current" />
                                    )}
                                    {isWalletUnlocking ? 'Activating...' : `⚡ 1-Click Unlock with Wallet (GH₵ ${price})`}
                                </button>
                            ) : (
                                <div className="text-[11px] text-amber-300 bg-amber-950/60 p-2.5 rounded-xl border border-amber-800/60 font-medium">
                                    Insufficient wallet balance for 1-click unlock. Pay via MoMo or top up your wallet in Settings.
                                </div>
                            )}
                        </div>

                        {/* Paystack Payment Option */}
                        <button
                            onClick={handlePaystackUnlock}
                            disabled={isPaystackLoading}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm border border-blue-500/50"
                        >
                            {isPaystackLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CreditCard className="h-4 w-4" />
                            )}
                            {isPaystackLoading ? 'Opening Payment Gateway...' : 'Pay via Mobile Money / Card'}
                        </button>
                    </div>

                    {/* Full Suite Upgrade Banner */}
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl flex items-center justify-between gap-3 text-purple-900">
                        <div>
                            <h4 className="font-black text-xs uppercase tracking-wider text-purple-900">⭐ Full Suite Deal</h4>
                            <p className="text-xs text-purple-700 font-medium">Unlock ALL 5 modules for GH₵ 350/term (Save GH₵ 150)</p>
                        </div>
                        <ShieldCheck className="h-6 w-6 text-purple-600 shrink-0" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModuleLockGate;
