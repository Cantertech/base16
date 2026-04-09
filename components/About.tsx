import React from 'react';
import { Users, Globe, Award, Sparkles } from 'lucide-react';

const About: React.FC = () => {
    return (
        <div className="bg-white">
            {/* Hero Section */}
            <div className="relative pt-32 pb-24 md:pt-48 md:pb-32 bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:40px_40px]"></div>
                </div>
                
                <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
                            <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary-200">Our Story</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.05] tracking-tight mb-8">
                            Empowering those who <br className="hidden md:block"/>
                            <span className="text-primary-500 italic">build the future.</span>
                        </h1>
                        <p className="text-xl text-slate-400 font-medium leading-relaxed">
                            Base16 is a proud product of SixZones, dedicated to stripping away administrative burdens so educators can focus on what matters: teaching.
                        </p>
                    </div>
                </div>
            </div>

            {/* Mission Section */}
            <section className="py-24 md:py-32">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
                        <div>
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-8 tracking-tight">Our Radical Mission.</h2>
                            <p className="text-lg text-slate-500 font-medium leading-relaxed mb-8">
                                We believe that education is the cornerstone of progress. Our mission is to create a school management ecosystem that is intuitive, powerful, and accessible to every institution in Ghana.
                            </p>
                            <p className="text-lg text-slate-500 font-medium leading-relaxed">
                                We leverage cutting-edge technology to automate admissions, finances, and academic tracking — ensuring that data serves the school, not the other way around.
                            </p>
                        </div>
                        
                        <div className="grid sm:grid-cols-1 gap-10">
                            {[
                                {
                                    icon: Users,
                                    title: "Student-Centric Architecture",
                                    desc: "Everything we build is designed to improve the student experience, from smoother admissions to better academic tracking."
                                },
                                {
                                    icon: Globe,
                                    title: "Global Standards, Local Context",
                                    desc: "We bring world-class software engineering standards to local institutions, ensuring performance even on bad networks."
                                },
                                {
                                    icon: Award,
                                    title: "Legacy of Excellence",
                                    desc: "As a SixZones product, Base16 inherits a legacy of digital innovation and reliability across West Africa."
                                }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-6">
                                    <div className="w-12 h-12 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-900">
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2">{item.title}</h4>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <div className="bg-slate-50 py-24 border-y border-slate-100">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <dl className="grid grid-cols-1 gap-y-16 text-center lg:grid-cols-3">
                        <div className="flex flex-col gap-y-3">
                            <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Schools Trusted</dt>
                            <dd className="text-5xl font-black text-slate-900 tracking-tighter">50+</dd>
                        </div>
                        <div className="flex flex-col gap-y-3">
                            <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Students Managed</dt>
                            <dd className="text-5xl font-black text-slate-900 tracking-tighter">10k+</dd>
                        </div>
                        <div className="flex flex-col gap-y-3">
                            <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Uptime</dt>
                            <dd className="text-5xl font-black text-slate-900 tracking-tighter">99.9%</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
};

export default About;
