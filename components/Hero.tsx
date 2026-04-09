import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface HeroProps {
  onStartWizard: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStartWizard }) => {
  return (
    <section className="relative pt-24 pb-12 md:pt-48 md:pb-32 bg-white overflow-hidden">
      {/* Subtle background detail */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Text Content */}
          <div className="lg:w-1/2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 mb-6 lg:mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600"></span>
              <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">The Modern Standard</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.1] lg:leading-[1.05] tracking-tight mb-6 px-2 lg:px-0">
              Run Your School <br className="hidden md:block" />
              <span className="text-primary-600 font-black italic">The Simple Way.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-500 mb-8 lg:mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium px-4 lg:px-0">
              Base16 is the intuitive management engine designed for school owners. Admissions, fees, and results — <span className="text-slate-900 font-bold underline decoration-primary-200 decoration-2 underline-offset-4 tracking-tight">automated in minutes.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 justify-center lg:justify-start items-center px-4 lg:px-0">
              <button
                onClick={onStartWizard}
                className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 text-white px-10 py-4 rounded-xl font-bold text-base hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                Create Account
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => window.location.href = '/demo'}
                className="w-full sm:w-auto text-slate-600 font-bold px-8 py-4 hover:text-slate-900 transition-colors text-sm lg:text-base"
              >
                Book a Walkthrough
              </button>
            </div>

            <div className="mt-10 lg:mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-y-3 gap-x-6 lg:gap-x-8 px-2">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] lg:text-xs">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Free Core CRM</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] lg:text-xs">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>GES Compliant</span>
                </div>
            </div>
          </div>

          {/* Mockup Content */}
          <div className="lg:w-1/2 w-full mt-4 lg:mt-0 relative group px-2 sm:px-6 lg:px-0">
            <div className="relative bg-white p-2 rounded-2xl shadow-xl lg:shadow-2xl border border-slate-100 ring-1 ring-slate-900/5 transform lg:rotate-1 hover:rotate-0 transition-all duration-700">
              <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                <img
                  src="/orbit_dashboard.png"
                  alt="Base16 School Dashboard"
                  className="w-full h-auto object-cover opacity-95 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>

            {/* Float badge - Optimized for mobile */}
            <div className="absolute -bottom-4 left-4 lg:-left-8 bg-white py-2.5 px-4 lg:py-3 lg:px-5 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3 lg:gap-4 transition-transform">
               <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary-50 flex items-center justify-center">
                  <span className="text-primary-600 font-black text-[10px] lg:text-xs leading-none">FREE</span>
               </div>
               <div>
                  <p className="text-[10px] lg:text-xs font-black text-slate-900 leading-none mb-1 uppercase tracking-wider">Start Trial</p>
                  <p className="text-[8px] lg:text-[10px] text-slate-400 font-bold uppercase">No Card Required</p>
               </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
;