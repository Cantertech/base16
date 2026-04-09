import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, MapPin } from 'lucide-react';

const KumasiOffer: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="py-24 bg-slate-50 border-y border-slate-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative group">
                    {/* Subtle accent corner */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-bl-[4rem] group-hover:scale-110 transition-transform duration-700"></div>
                    
                    <div className="flex flex-col md:flex-row relative z-10">

                        {/* Text Content */}
                        <div className="md:w-3/5 p-6 sm:p-8 md:p-16">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-widest mb-6 lg:mb-8">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Ashanti Expansion</span>
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 lg:mb-6 leading-[1.2] lg:leading-[1.1] tracking-tight">
                                Get <span className="underline decoration-primary-200 decoration-8 underline-offset-[-2px]">GH¢ 500</span> <br className="lg:hidden"/> Free Wallet Credit.
                            </h2>

                            <p className="text-base sm:text-lg md:text-xl text-slate-500 mb-8 lg:mb-10 font-medium leading-relaxed">
                                We are opening specifically for schools in the Kumasi metropolis. Get zero setup fees for the first year plus free training.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 mb-10 lg:mb-12">
                                {[
                                    "12-Month Setup Waiver",
                                    "On-Site Training",
                                    "Data Migration",
                                    "Support Manager"
                                ].map((item, index) => (
                                    <div key={index} className="flex items-center gap-3 text-slate-600 font-bold text-[13px] lg:text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => navigate('/demo')}
                                className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 text-white px-10 py-4 rounded-xl font-bold transition-all shadow-md hover:bg-slate-800 active:scale-95"
                            >
                                Secure Your Slot
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        {/* Visual Side */}
                        <div className="md:w-2/5 bg-slate-900 p-8 sm:p-12 text-white flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-800">
                            <div className="space-y-6 lg:space-y-8">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-3 lg:mb-4 text-center md:text-left">Availability Status</span>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-2xl lg:text-3xl font-black">10 <span className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase tracking-tighter">Slots Total</span></span>
                                        <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest border border-green-500/20">Active</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary-500 w-[20%] rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-3 lg:mt-4 font-bold uppercase tracking-widest text-center md:text-left">2 SLOTS SECURED THIS WEEK</p>
                                </div>

                                <div className="pt-6 lg:pt-8 border-t border-slate-800">
                                   <div className="flex items-center gap-3 lg:gap-4 bg-white/5 p-3 lg:p-4 rounded-xl border border-white/5">
                                      <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary-600 flex items-center justify-center font-black text-xs lg:text-sm">B</div>
                                      <div>
                                         <p className="text-[11px] lg:text-xs font-black tracking-tight">Best Shepherd Academy</p>
                                         <p className="text-[9px] lg:text-[10px] text-slate-600 font-medium italic">Confirmed 1 hour ago</p>
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
