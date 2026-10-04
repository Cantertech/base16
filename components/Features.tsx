import React from 'react';
import { Banknote, BookOpen, Sparkles, WifiOff, MessageSquare, Users2, ShieldCheck, CheckCircle2 } from 'lucide-react';

const Features: React.FC = () => {
  const coreFeatures = [
    {
      title: "Dual-Track Fee & Debt Engine",
      tagline: "Recover fees 40% faster with zero manual math.",
      description: "Separate Tuition, Feeding, Bus and Uniforms into isolated ledgers. Arrears roll over automatically into new terms. Record Mobile Money or cash payments in 2 taps with instant SMS receipts sent directly to parents.",
      icon: Banknote,
      highlight: "Automatic Debt Rollover"
    },
    {
      title: "1-Click GES Terminal Report Cards",
      tagline: "End the report card weekend nightmare.",
      description: "100% compliant with Ghana Education Service standards. Continuous Assessment (30%/50%) and Exam scores are computed with automated class rankings, subject totals, and headteacher remarks. Batch print all classes in seconds.",
      icon: BookOpen,
      highlight: "100% GES Curriculum Ready"
    },
    {
      title: "7:30 AM Executive Intelligence",
      tagline: "Your school's vital signs before assembly.",
      description: "No generic chatbot gimmicks. Instant structured metrics direct from your database: debtors owing over 30 days, classes with declining marks, and teachers with unsubmitted exam scores — giving the proprietor complete control.",
      icon: Sparkles,
      highlight: "Operational Awareness"
    },
    {
      title: "Offline-Resilient Architecture",
      tagline: "Engineered for Ghana's power & network realities.",
      description: "A teacher shouldn't lose an hour of mark entry because ECG cut power or Wi-Fi dipped. Base16 caches input locally in the browser and automatically syncs the exact second connectivity returns.",
      icon: WifiOff,
      highlight: "Zero Data Loss"
    },
    {
      title: "Zero-App SMS Dispatch Suite",
      tagline: "Reach parents on any mobile phone in Ghana.",
      description: "Don't force parents to download another heavy mobile app. Deliver fee balances, terminal results, and emergency announcements straight to their standard SMS inbox at wholesale telecom rates (GH¢ 0.035/SMS).",
      icon: MessageSquare,
      highlight: "99.9% Delivery Rate"
    },
    {
      title: "Multi-Child Family Architecture",
      tagline: "One parent, multiple children, single truth.",
      description: "Automatically link siblings across different classes to the same guardian. View combined family debt, apply family discounts, and send one consolidated fee statement instead of confusing separate messages.",
      icon: Users2,
      highlight: "Sibling Family Linking"
    }
  ];

  return (
    <section id="features" className="py-24 md:py-32 bg-white scroll-mt-24 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-black uppercase tracking-[0.2em] mb-4 border border-blue-100">
            <span>Core System Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-[1.1]">
            Built for School Leaders. <br />
            <span className="text-blue-600">Designed for Everyday Simplicity.</span>
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed font-medium">
            Every module in Base16 was crafted around the real daily workflows of school proprietors, headteachers, and accountants.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {coreFeatures.map((f, index) => (
            <div 
              key={index} 
              className="flex flex-col p-8 rounded-3xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-xl transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 flex items-center justify-center bg-white text-slate-900 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm border border-slate-200 group-hover:border-blue-600">
                  <f.icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors bg-white px-2.5 py-1 rounded-full border border-slate-200/60">
                  {f.highlight}
                </span>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight group-hover:text-blue-600 transition-colors">
                {f.title}
              </h3>
              
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                {f.tagline}
              </p>

              <p className="text-sm text-slate-600 leading-relaxed font-medium mt-auto">
                {f.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Features;