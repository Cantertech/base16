import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Wallet, Layers, ShieldCheck } from 'lucide-react';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const plans = [
    {
      name: "Core Infrastructure",
      price: "0",
      period: "No monthly fees",
      description: "Everything you need to digitize your fundamental school operations.",
      features: [
        "Full Student & Staff Profiles",
        "Class & Subject Architecture",
        "Secure Cloud Data Storage",
        "Mobile App & Tablet Access",
        "Zero setup or hidden costs"
      ],
      isFree: true
    },
    {
      name: "Modular Add-ons",
      price: "Pay-as-you-go",
      period: "Prepaid Wallet System",
      description: "Activate only the premium modules required for your specific workflow.",
      isPopular: true,
      features: [
        "Revenue Guard (Fee Management)",
        "Academic Engine (Report Batching)",
        "Daily Tracker (Attendance)",
        "Bulk SMS Notification Suite",
        "Cancel or switch anytime"
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 lg:py-24 bg-white scroll-mt-24 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 lg:mb-20 text-center mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 lg:mb-6 tracking-tight leading-tight">Fair & Modular Pricing.</h2>
          <p className="text-base sm:text-lg lg:text-xl text-slate-500 font-medium leading-relaxed">No per-student taxes. No expensive yearly bundles. <br className="hidden sm:block"/> Pay only for the tools you actually use.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-12 max-w-5xl mx-auto items-start px-2 sm:px-0">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-[2rem] lg:rounded-[2.5rem] p-8 lg:p-12 transition-all duration-300 border ${plan.isPopular
                ? 'bg-slate-900 text-white border-slate-900 shadow-xl lg:shadow-2xl'
                : 'bg-white text-slate-900 border-slate-200 shadow-sm'
                }`}
            >
              {plan.isPopular && (
                <div className="absolute top-6 right-6 lg:top-8 lg:right-8 bg-primary-600 text-white text-[9px] lg:text-[10px] font-black px-3 py-1 lg:px-4 lg:py-1.5 rounded-full uppercase tracking-widest leading-none">
                  Most Flexible
                </div>
              )}

              <h3 className={`font-bold mb-6 lg:mb-8 ${plan.isPopular ? 'text-primary-400' : 'text-slate-400'} uppercase tracking-[0.15em] text-[11px] lg:text-sm`}>
                {plan.name}
              </h3>

              <div className="flex items-baseline mb-3 lg:mb-4">
                {plan.isFree && <span className="text-2xl lg:text-2xl font-black mr-2">GH¢</span>}
                <span className={`font-black tracking-tighter ${plan.price === 'Pay-as-you-go' ? 'text-4xl lg:text-4xl' : 'text-6xl lg:text-6xl'}`}>
                  {plan.price}
                </span>
              </div>
              <p className={`text-xs lg:text-sm font-bold mb-8 lg:mb-10 uppercase tracking-widest opacity-60`}>
                {plan.period}
              </p>

              <div className={`h-px w-full mb-8 lg:mb-10 ${plan.isPopular ? 'bg-slate-800' : 'bg-slate-100'}`}></div>

              <ul className="space-y-4 lg:space-y-5 mb-10 lg:mb-12">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className={`h-4 w-4 lg:h-5 lg:w-5 mr-3 lg:mr-4 flex-shrink-0 ${plan.isPopular ? 'text-primary-500' : 'text-green-500'}`} />
                    <span className="font-bold text-xs lg:text-sm tracking-tight">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/login')}
                className={`w-full py-4 px-6 rounded-2xl font-black text-sm lg:text-base transition-all active:scale-95 shadow-md ${plan.isPopular ? 'bg-white text-slate-900 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                {plan.isFree ? 'Start for Free' : 'Explore Modules'}
              </button>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-16 lg:mt-24 max-w-5xl mx-auto px-2 sm:px-0">
          <div className="grid md:grid-cols-3 gap-10 lg:gap-12 bg-slate-50 p-8 lg:p-16 rounded-[2rem] lg:rounded-[3rem] border border-slate-100">
              <div className="space-y-3 lg:space-y-4 text-center md:text-left">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto md:mx-0">
                  <Wallet className="h-5 w-5 text-slate-900" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm lg:text-base">1. Top Up Wallet</h4>
                <p className="text-[13px] lg:text-sm text-slate-500 font-medium leading-relaxed">Securely fund your school's wallet via MoMo or Bank.</p>
              </div>
              <div className="space-y-3 lg:space-y-4 text-center md:text-left">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto md:mx-0">
                  <Layers className="h-5 w-5 text-slate-900" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm lg:text-base">2. Activate Access</h4>
                <p className="text-[13px] lg:text-sm text-slate-500 font-medium leading-relaxed">Subscribe to premium tools only when you need them.</p>
              </div>
              <div className="space-y-3 lg:space-y-4 text-center md:text-left">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto md:mx-0">
                  <ShieldCheck className="h-5 w-5 text-slate-900" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm lg:text-base">3. Zero Lock-in</h4>
                <p className="text-[13px] lg:text-sm text-slate-500 font-medium leading-relaxed">Disable modules anytime. No long-term contracts.</p>
              </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
;