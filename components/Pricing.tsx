import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck, Zap, HelpCircle, ArrowRight, Smartphone, Sparkles } from 'lucide-react';

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Core Infrastructure",
      badge: "Free Forever",
      price: "0",
      cycle: "Forever Free",
      description: "Everything you need to digitize your basic school directory and attendance with zero upfront commitment.",
      features: [
        "Up to 100 Student Records",
        "Full Student & Guardian Profiles",
        "Class & Subject Architecture",
        "Daily Digital Attendance Logging",
        "Offline-Resilient Browser Storage",
        "Zero setup fees or hidden costs"
      ],
      ctaText: "Start Free Onboarding",
      isPopular: false
    },
    {
      name: "Termly Full Pass",
      badge: "Most Popular in Ghana",
      price: "350",
      cycle: "Per Term (4 Months)",
      description: "Matches the Ghana academic term cycle. Unlock automated fees, report cards, and parent SMS broadcasts.",
      features: [
        "Unlimited Students & Teachers",
        "Dual-Track Fee & Debt Management",
        "Automatic Arrears Rollover Across Terms",
        "1-Click GES Compliant Terminal Reports",
        "Bulk SMS Dispatch Suite for Fee Collection",
        "FREE 48-Hour White-Glove Migration",
        "Multi-Child Guardian Family Linking"
      ],
      ctaText: "Activate Termly Pass",
      isPopular: true
    },
    {
      name: "Annual Prestige",
      badge: "Best Value (Save GH¢ 150)",
      price: "900",
      cycle: "Full Academic Year (3 Terms)",
      description: "Total operational peace of mind for the entire academic year with custom school branding and VIP support.",
      features: [
        "Everything in Termly Pass Unlocked",
        "Covers All 3 Academic Terms (12 Months)",
        "1,000 Free SMS Credits Included",
        "Custom School Crest & Report Card Layouts",
        "Dedicated Implementation Engineer",
        "Priority WhatsApp & Phone Support Hotline",
        "Automated Academic Data Archiving"
      ],
      ctaText: "Get Annual Access",
      isPopular: false
    }
  ];

  return (
    <section id="pricing" className="py-24 md:py-32 bg-slate-50 scroll-mt-24 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-slate-700 text-[11px] font-black uppercase tracking-[0.2em] mb-4 border border-slate-200 shadow-sm">
            <span>Fair & Predictable Investment</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
            Priced for Ghanaian Schools. <br />
            <span className="text-blue-600">No Per-Student Penalties.</span>
          </h2>
          <p className="text-lg text-slate-600 font-medium leading-relaxed">
            Other systems charge you per child, penalizing you as your school grows. Base16 charges one transparent, flat termly fee with zero surprises.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-8 max-w-7xl mx-auto items-stretch">
          {plans.map((p, index) => (
            <div
              key={index}
              className={`flex flex-col rounded-3xl p-8 lg:p-10 transition-all duration-300 relative ${
                p.isPopular
                  ? 'bg-slate-900 text-white shadow-2xl ring-2 ring-blue-500 scale-[1.02] md:-translate-y-2'
                  : 'bg-white text-slate-900 border border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {p.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                  {p.badge}
                </div>
              )}

              {!p.isPopular && (
                <div className="inline-block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  {p.badge}
                </div>
              )}

              <h3 className={`text-xl font-black uppercase tracking-tight mb-4 ${p.isPopular ? 'text-white' : 'text-slate-900'}`}>
                {p.name}
              </h3>

              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-2xl font-black">GH¢</span>
                <span className="text-5xl font-black tracking-tight">{p.price}</span>
              </div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-6 ${p.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                {p.cycle}
              </p>

              <p className={`text-sm leading-relaxed mb-8 font-medium ${p.isPopular ? 'text-slate-300' : 'text-slate-600'}`}>
                {p.description}
              </p>

              <div className={`h-px w-full mb-8 ${p.isPopular ? 'bg-slate-800' : 'bg-slate-100'}`} />

              <ul className="space-y-4 mb-10 flex-1">
                {p.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-4 w-4 shrink-0 mt-0.5 ${p.isPopular ? 'text-blue-400' : 'text-emerald-500'}`} />
                    <span className={`text-xs font-bold leading-normal ${p.isPopular ? 'text-slate-200' : 'text-slate-700'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/setup')}
                className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-95 ${
                  p.isPopular
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
                    : 'bg-slate-900 hover:bg-black text-white'
                }`}
              >
                {p.ctaText}
              </button>
            </div>
          ))}
        </div>

        {/* Wholesale SMS Banner */}
        <div className="mt-16 max-w-4xl mx-auto bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-black shrink-0 border border-orange-100">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">Wholesale SMS Add-on</h4>
                <span className="text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">3.5 Pesewas</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Top up your school SMS wallet instantly via Mobile Money. Zero expiry. Dispatches directly to MTN, Telecel, and AT networks.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-2xl font-black text-slate-900">GH¢ 0.035</span>
            <span className="text-xs text-slate-400 block font-bold uppercase">per SMS unit</span>
          </div>
        </div>

        {/* Final Conversion CTA Card */}
        <div className="mt-16 max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 sm:p-12 border border-blue-500/30 text-white shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> Zero-Risk School Modernization
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ready to automate your school this term?
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              Join progressive Ghanaian school leaders who have left manual registers behind. Start free in 15 minutes, or schedule a personalized walkthrough with our team.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={() => navigate('/demo')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-7 py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-xl hover:shadow-blue-500/30 active:scale-95"
            >
              <span>Book 15-Min Live Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/setup')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-4 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-95"
            >
              <span>Get Started Free</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Pricing;