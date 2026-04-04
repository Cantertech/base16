import React from 'react';
import { ArrowRight, PlayCircle, Sparkles } from 'lucide-react';

interface HeroProps {
  onStartWizard: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStartWizard }) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-slate-50 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-blue-600 rounded-full blur-[100px] mix-blend-multiply"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">

          {/* Text Content */}
          <div className="lg:w-1/2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
              <Sparkles className="w-4 h-4 text-primary-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">The New Standard for Education</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
              The <span className="inline-block animate-[bounce_3s_infinite] text-primary-600">Simplest</span> Engine for <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-500">
                Modern Schools
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium">
              The world's <span className="text-primary-600 font-bold">simplest</span> all-in-one platform to streamline admissions, automate fee collection, and generate reports without the expensive per-student fees.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={onStartWizard}
                className="group flex flex-1 sm:flex-none items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                Start for Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => window.location.href = '/login'}
                className="md:hidden block flex-1 bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all shadow-sm"
              >
                Login
              </button>
            </div>

            <div className="mt-10 flex items-center justify-center lg:justify-start gap-4 text-sm text-slate-500 font-medium">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden`}>
                  </div>
                ))}
              </div>
              <p>Trusted by <span className="text-slate-900 font-bold">50+</span> schools in Ghana</p>
            </div>
          </div>

          {/* Image Content */}
          <div className="lg:w-1/2 w-full relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-200 to-blue-400 rounded-3xl transform rotate-3 scale-105 opacity-20 blur-2xl"></div>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/50 bg-white/50 backdrop-blur-sm p-2">
              <div className="rounded-xl overflow-hidden border border-slate-100/50 bg-slate-900">
                {/* Mac OS Window Header */}
                <div className="bg-slate-800/80 backdrop-blur-md px-4 py-3 flex items-center gap-2 border-b border-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>

                <img
                  src="/orbit_dashboard.png"
                  alt="Base16 School Management System Dashboard"
                  className="w-full h-auto object-cover transform hover:scale-[1.02] transition-transform duration-700"
                />
              </div>
            </div>

            {/* Floating Element */}
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-xl">
                  <div className="text-green-600 font-black text-xl">GH¢0</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Core CRM</div>
                  <div className="text-xs text-slate-500">Forever Free</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;