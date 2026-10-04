import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Smartphone, 
  WifiOff, 
  FileText, 
  Coins, 
  Star, 
  Users2, 
  Sparkles 
} from 'lucide-react';

const WhyUs: React.FC = () => {
  const navigate = useNavigate();

  const reasons = [
    {
      icon: <FileText className="w-6 h-6 text-blue-400" />,
      tag: "Examinations & Grading",
      title: "1-Click GES Terminal Report Cards",
      description: "No more spending vacation weeks manually calculating subject totals, class scores, and rankings in Excel. Generates official GES-compliant terminal reports with automatic remarks and batch PDF printing in minutes."
    },
    {
      icon: <Smartphone className="w-6 h-6 text-emerald-400" />,
      tag: "Fee Recovery & Receipts",
      title: "Instant Hubtel SMS & MoMo Tracking",
      description: "Every time fees are recorded, parents receive an instant branded SMS receipt on their phones. Send personalized fee arrears reminders directly to 500+ parents in one click. Recover up to 40% more fees on time."
    },
    {
      icon: <WifiOff className="w-6 h-6 text-amber-400" />,
      tag: "Dumsor-Proof Engineering",
      title: "Offline Reliability When ECG or Internet Fails",
      description: "When ECG interrupts power or local internet dips, your school does not stop. Teachers can continue taking roll call, recording marks, and tracking payments offline. Everything synchronizes automatically the moment you reconnect."
    },
    {
      icon: <Coins className="w-6 h-6 text-indigo-400" />,
      tag: "Fair Local Pricing",
      title: "Priced in Ghana Cedis (No Dollar Shocks)",
      description: "Built specifically for Ghanaian schools with fair, transparent termly pricing in Ghana Cedis (GHS). Matches the 3-term academic calendar with zero dollar exchange-rate volatility and no credit card requirements."
    },
    {
      icon: <Users2 className="w-6 h-6 text-cyan-400" />,
      tag: "Family Accounts",
      title: "Multi-Child Family Architecture",
      description: "Automatically link siblings across different classes to the same guardian. View combined family debt, apply family discounts, and send one consolidated fee statement instead of confusing separate messages."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-rose-400" />,
      tag: "White-Glove Onboarding",
      title: "100% Free Data Migration",
      description: "You don't have to re-type existing student registers. Our deployment engineers clean, format, and upload your current student lists, historical fee balances, and staff profiles for you completely free."
    }
  ];

  return (
    <section id="why-us" className="py-24 md:py-32 bg-slate-900 text-white scroll-mt-24 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:28px_28px] opacity-25 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-widest mb-5">
            <Star className="w-3.5 h-3.5 fill-blue-400" />
            <span>Why Leading Ghanaian Schools Choose Base16</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-5">
            Built for Ghana's Classrooms. <br />
            <span className="bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Engineered for Complete Peace of Mind.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
            Running an exceptional basic or international school shouldn't mean staying up all night balancing paper books or wrestling with broken Excel formulas. Here is what changes when your school adopts Base16.
          </p>
        </div>

        {/* 6 Value Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20 md:mb-24">
          {reasons.map((r, i) => (
            <div 
              key={i}
              className="bg-slate-800/50 hover:bg-slate-800/80 rounded-3xl p-7 sm:p-8 border border-slate-700/70 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-blue-500/10 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-700/60 border border-slate-600/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {r.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-700">
                    {r.tag}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2.5 tracking-tight group-hover:text-blue-300 transition-colors">
                  {r.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  {r.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700/40 flex items-center gap-2 text-xs font-bold text-blue-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Standard in all schools</span>
              </div>
            </div>
          ))}
        </div>

        {/* Proof Numbers Bar */}
        <div className="bg-gradient-to-r from-blue-900/40 via-slate-800 to-indigo-900/40 border border-blue-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">1-Click</div>
              <div className="text-xs sm:text-sm font-bold text-blue-300 uppercase tracking-wider">GES Terminal Reports</div>
              <p className="text-xs text-slate-400 mt-1">Class CA + Exam scores auto-ranked</p>
            </div>
            <div className="p-4 border-l border-slate-700/70">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight mb-1">40% Faster</div>
              <div className="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider">Fee Arrears Recovery</div>
              <p className="text-xs text-slate-400 mt-1">Via automated Hubtel SMS alerts</p>
            </div>
            <div className="p-4 border-t lg:border-t-0 lg:border-l border-slate-700/70">
              <div className="text-3xl sm:text-4xl font-black text-cyan-400 tracking-tight mb-1">GH₵ 1.5M+</div>
              <div className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider">Fees Reconciled</div>
              <p className="text-xs text-slate-400 mt-1">Zero missing cash or lost receipts</p>
            </div>
            <div className="p-4 border-t lg:border-t-0 border-l border-slate-700/70">
              <div className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight mb-1">&lt; 15 Mins</div>
              <div className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">Free Setup & Migration</div>
              <p className="text-xs text-slate-400 mt-1">We import your current student list</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default WhyUs;