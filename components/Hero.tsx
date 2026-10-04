import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Sparkles, WifiOff, FileText, TrendingUp } from 'lucide-react';

interface HeroProps {
  onStartWizard: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStartWizard }) => {
  const navigate = useNavigate();
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-20 lg:h-[660px] min-h-[580px] bg-white overflow-hidden selection:bg-slate-900 selection:text-white flex items-center">
      {/* Right Side Campus Image: Calibrated Height, Covers ~62% of Hero, Sharp & Uncut */}
      <div 
        className="absolute top-0 right-0 bottom-0 w-full lg:w-[60%] xl:w-[64%] h-full pointer-events-none select-none z-0 overflow-hidden"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 6%, rgba(0,0,0,0.4) 16%, black 28%)',
          maskImage: 'linear-gradient(to right, transparent 0%, transparent 6%, rgba(0,0,0,0.4) 16%, black 28%)'
        }}
      >
        <img
          src="/hero-school.png"
          alt="High School Campus"
          className="w-full h-full object-cover object-[78%_center] lg:object-[86%_center] opacity-95"
        />
        {/* Subtle top & bottom edge blends */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">

          {/* Left Hero Narrative */}
          <div className="lg:w-6/12 xl:w-5/12 text-center lg:text-left">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900 text-white shadow-sm mb-6 hover:bg-slate-800 transition-all cursor-default">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">The School Management Operating System</span>
            </div>

            {/* Simple, Communicative Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black text-slate-900 leading-[1.08] tracking-tight mb-4">
              1,000 student records &amp; insights in a single click.
            </h1>
            
            {/* Simple Clear Sub-tagline */}
            <h2 className="text-xl sm:text-2xl font-bold text-blue-600 mb-8 tracking-tight">
              Run your school the simple way.
            </h2>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center lg:justify-start items-center">
              <button
                onClick={onStartWizard}
                className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-slate-900 text-white px-9 py-4 rounded-xl font-bold text-base hover:bg-black transition-all shadow-xl hover:shadow-slate-900/20 active:scale-95"
              >
                <span>Launch Your School</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform" />
              </button>
              
              <button
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold text-base hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm active:scale-95"
              >
                <span>Book 15-Min Live Demo</span>
              </button>
            </div>

            {/* Bullet Proof Points */}
            <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-y-3 gap-x-8 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>100% GES Curriculum Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-blue-500" />
                <span>Offline-Resilient Architecture</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Zero Per-Student Monthly Tax</span>
              </div>
            </div>

          </div>

          {/* Right Hero Visual: Floating Live Deck docked at bottom so building is fully visible */}
          <div className="lg:w-6/12 xl:w-7/12 w-full mt-6 lg:mt-0 relative z-10 flex flex-col justify-end items-center lg:items-end">
            
            {/* Top Minimal Pill pinned above */}
            <div className="self-end mb-3 bg-white/95 text-slate-900 py-1.5 px-3.5 rounded-full shadow-md border border-slate-200/80 hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[11px] font-black">520 Students Enrolled</span>
            </div>

            {/* Compact Glassmorphism Command Center Card */}
            <div className="backdrop-blur-xl bg-white/90 text-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/90 ring-1 ring-slate-900/5 max-w-sm w-full transition-all duration-500 hover:shadow-3xl">
              
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono text-slate-500 ml-1.5">base16.os</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                    Term 2 Synced
                  </span>
                </div>
              </div>

              {/* Metric Tiles */}
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-600" /> Fee Collection
                  </p>
                  <p className="text-lg font-black text-slate-900">GH¢ 94,850</p>
                  <p className="text-[9px] text-emerald-600 font-bold">88.4% reconciled</p>
                </div>

                <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-blue-600" /> Reports
                  </p>
                  <p className="text-lg font-black text-slate-900">520 / 520</p>
                  <p className="text-[9px] text-blue-600 font-bold">1-Click Batch PDF</p>
                </div>
              </div>

              {/* Instant Alert Strip */}
              <div className="bg-blue-50/80 rounded-xl p-2.5 border border-blue-100 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <p className="text-[10.5px] text-slate-600 font-medium truncate">
                  8 MoMo fee SMS receipts sent to parents today
                </p>
              </div>

              {/* Bottom Feature Pill */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-500" /> Fast MoMo Engine
                </span>
                <span className="text-[10px] font-bold text-slate-400">Automated</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;