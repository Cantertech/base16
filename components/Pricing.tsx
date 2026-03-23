import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Wallet, Layers, ShieldCheck } from 'lucide-react';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const plans = [
    {
      name: "Core System",
      price: "0",
      period: "Free Forever",
      description: "Everything you need to digitize your school administration, completely free.",
      color: "bg-green-50 text-green-900",
      btnColor: "bg-green-600 hover:bg-green-700 text-white",
      features: [
        "Student & Staff Records",
        "Class & Subject Management",
        "Basic Cloud Storage",
        "Mobile App Access",
        "Unlimited Admin Users"
      ]
    },
    {
      name: "Modular Add-ons",
      price: "Pay as you go",
      period: "Prepaid Wallet",
      description: "Top up your wallet and activate only the premium modules your school needs.",
      isPopular: true,
      color: "bg-primary-900 text-white",
      btnColor: "bg-white text-primary-900 hover:bg-blue-50",
      features: [
        "Revenue Guard (Fees & Billing)",
        "Academic Engine (Report Cards)",
        "Daily Tracker (Attendance)",
        "Bulk SMS Communication",
        "Cancel modules anytime"
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-slate-50 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Fair & Flexible Pricing</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We abandoned the expensive per-student fee model. <br />
            With Base16, you <span className="font-bold text-slate-900">pay only for what you use</span>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-3xl p-8 md:p-10 transition-all duration-300 ${plan.isPopular
                ? 'bg-primary-900 text-white shadow-2xl ring-4 ring-primary-500/20 transform md:-translate-y-4'
                : 'bg-white text-slate-900 border border-slate-200 shadow-xl'
                }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-yellow-400 text-primary-900 text-xs font-black px-4 py-1.5 rounded-bl-xl rounded-tr-2xl uppercase tracking-wider shadow-sm">
                  Most Flexible
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${plan.isPopular ? 'bg-yellow-400' : 'bg-green-500'}`}></div>
                <h3 className={`text-2xl font-bold ${plan.isPopular ? 'text-white' : 'text-slate-800'}`}>
                  {plan.name}
                </h3>
              </div>

              <div className="flex items-baseline mb-2">
                {plan.price !== "Pay as you go" && <span className="text-xl font-bold mr-1">GH¢</span>}
                <span className={`font-black tracking-tighter ${plan.price === 'Pay as you go' ? 'text-4xl' : 'text-6xl'}`}>
                  {plan.price}
                </span>
              </div>
              <p className={`text-sm font-bold mb-6 opacity-80 uppercase tracking-wide`}>
                {plan.period}
              </p>

              <p className={`mb-8 font-medium text-lg leading-relaxed ${plan.isPopular ? 'text-blue-100' : 'text-slate-600'}`}>
                {plan.description}
              </p>

              <div className={`h-px w-full mb-8 ${plan.isPopular ? 'bg-primary-800' : 'bg-slate-100'}`}></div>

              <ul className="space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className={`h-6 w-6 mr-3 flex-shrink-0 ${plan.isPopular ? 'text-yellow-400' : 'text-green-500'}`} />
                    <span className="font-bold text-base">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/login')}
                className={`w-full py-4 px-6 rounded-xl font-black text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${plan.btnColor}`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>

        {/* Comparison Table / Footnote for new model */}
        <div className="mt-20 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-6">How Our New Prepaid Wallet Works</h3>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                  <Wallet className="h-5 w-5 text-primary-700" />
                </div>
                <p className="font-bold text-slate-900 mb-2">1. Top Up Wallet</p>
                <p className="text-sm text-slate-600">Fund your school's secure virtual wallet via Mobile Money or Bank Transfer seamlessly.</p>
              </div>
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                  <Layers className="h-5 w-5 text-primary-700" />
                </div>
                <p className="font-bold text-slate-900 mb-2">2. Activate Modules</p>
                <p className="text-sm text-slate-600">Browse our App Store and subscribe to only the tools you need, like generating Report Cards.</p>
              </div>
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                  <ShieldCheck className="h-5 w-5 text-primary-700" />
                </div>
                <p className="font-bold text-slate-900 mb-2">3. Zero Commitments</p>
                <p className="text-sm text-slate-600">No hidden costs. No per-student fees. Subscriptions run for 30 days and you can cancel anytime.</p>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-100">
              <p className="text-slate-500 font-medium">
                Our Core CRM is <span className="font-bold text-green-600">forever free</span> for all Ghanaian schools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;