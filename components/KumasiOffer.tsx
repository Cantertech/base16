import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, ArrowRight, MapPin } from 'lucide-react';

const KumasiOffer: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="relative py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 via-white to-primary-50 overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

            <div className="max-w-4xl mx-auto relative">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-primary-100 transform transition-all hover:scale-[1.01] duration-300">
                    <div className="flex flex-col md:flex-row">

                        {/* Left side: The Offer */}
                        <div className="md:w-3/5 p-8 md:p-12 flex flex-col justify-center">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 text-primary-800 text-sm font-bold w-fit mb-6">
                                <MapPin className="w-4 h-4" />
                                <span>Kumasi Expansion Special</span>
                            </div>

                            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 leading-tight">
                                Get <span className="text-primary-600">GH¢ 500 Free</span> Wallet Credit
                            </h2>

                            <div className="flex items-baseline gap-4 mb-6">
                                <div className="flex flex-col">
                                    <span className="text-4xl sm:text-5xl font-black text-primary-900">
                                        Zero Setup Fees
                                    </span>
                                    <span className="text-sm text-primary-700 font-medium mt-2">
                                        For the first year + Free training and migration
                                    </span>
                                </div>
                            </div>

                            <ul className="space-y-3 mb-8">
                                {[
                                    "Full access to all premium features",
                                    "Free onboarding & training session",
                                    "Dedicated support manager",
                                    "Data migration assistance"
                                ].map((item, index) => (
                                    <li key={index} className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => navigate('/demo')}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl group"
                            >
                                Book Your Slot Now
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <p className="mt-4 text-center sm:text-left text-sm text-slate-500 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Offer ends March 31st, 2026
                            </p>
                        </div>

                        {/* Right side: The Urgency/Visual */}
                        <div className="md:w-2/5 bg-primary-900 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-primary-500 rounded-full mix-blend-overlay filter blur-xl opacity-50"></div>

                            <div className="relative z-10">
                                <h3 className="text-xl font-bold mb-2 text-primary-200">Limited Availability</h3>
                                <p className="text-primary-100 opacity-90 mb-8">
                                    We are opening up specifically for schools in the Kumasi metropolis with <span className="font-bold text-white">500+ students</span>.
                                </p>

                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                                    <div className="text-center">
                                        <span className="block text-5xl font-black mb-1 text-white">10</span>
                                        <span className="text-sm uppercase tracking-wider font-bold text-primary-200">Slots Only</span>
                                    </div>
                                    <div className="w-full bg-primary-950/50 h-3 rounded-full mt-4 overflow-hidden">
                                        <div className="bg-gradient-to-r from-green-400 to-emerald-500 w-[20%] h-full rounded-full animate-pulse"></div>
                                    </div>
                                    <p className="text-xs text-center mt-2 text-primary-300">2 slots already booked</p>
                                </div>
                            </div>

                            <div className="relative z-10 mt-8">
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg backdrop-blur-sm border border-white/10">
                                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center font-bold text-white text-xs">
                                        BS
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold">Best Sh... Academy</p>
                                        <p className="text-[10px] text-green-300">Just secured a slot</p>
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
