import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Clock, Sparkles, ShieldCheck, Gift } from 'lucide-react';

const KumasiOffer: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="py-20 bg-slate-50 border-y border-slate-200/80 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row relative z-10">

                        {/* Text Content */}
                        <div className="md:w-3/5 p-8 sm:p-12 md:p-16">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-black uppercase tracking-wider mb-6 border border-amber-200 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>Limited Launch Offer • Ends on the 16th</span>
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 leading-[1.12] tracking-tight">
                                Free School Setup + <br />
                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    1 Term of Reports at No Cost.
                                </span>
                            </h2>

                            <p className="text-base sm:text-lg text-slate-600 mb-8 font-medium leading-relaxed max-w-xl">
                                We have a special offer for your school: complete free setup, full historical data migration, and 1 full term of student terminal report cards at zero cost. This exclusive cohort ends on the 16th.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-8 mb-10">
                                {[
                                    "100% Free Complete School Setup",
                                    "1 Term of Terminal Reports at No Cost",
                                    "Free 48-Hour Data Migration",
                                    "Staff & Teacher Training Included"
                                ].map((item, index) => (
                                    <div key={index} className="flex items-center gap-3 text-slate-800 font-bold text-xs sm:text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center">
                                <button
                                    onClick={() => navigate('/setup')}
                                    className="group flex items-center justify-center gap-2.5 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-md hover:bg-black active:scale-95 text-sm"
                                >
                                    <span>Claim Free Setup &amp; Reports</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                
                                <button
                                    onClick={() => navigate('/demo')}
                                    className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-7 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm shadow-xs"
                                >
                                    <span>Speak with an Engineer</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Panel */}
                        <div className="md:w-2/5 bg-slate-900 p-8 sm:p-12 text-white flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-800">
                            <div className="space-y-6">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-3">
                                        Cohort Allocation Status
                                    </span>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-2xl font-black">
                                            Ends on the 16th
                                        </span>
                                        <span className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                                            Expiring Soon
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-500 to-amber-500 w-[78%] rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                                    </div>
                                    <div className="flex justify-between items-center mt-2.5 text-[11px] font-bold">
                                        <span className="text-slate-400">11 of 15 slots claimed</span>
                                        <span className="text-amber-400">Only 4 slots remaining</span>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-800 space-y-3.5">
                                    <div className="flex items-center gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                                        <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center font-black text-xs text-blue-400 shrink-0">
                                            <Gift className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white">Full Term 1 Completely Free</p>
                                            <p className="text-[10px] text-slate-400 font-medium">All student terminal reports generated at no cost</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-400/30 flex items-center justify-center font-black text-xs text-emerald-400 shrink-0">
                                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white">Zero Upfront Commitment</p>
                                            <p className="text-[10px] text-slate-400 font-medium">No payment info required to begin migration</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    );
};

export default KumasiOffer;
