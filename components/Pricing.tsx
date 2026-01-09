import React from 'react';
import { Check } from 'lucide-react';
import { PricingPlan } from '../types';

const Pricing: React.FC = () => {
  const plans = [
    {
      name: "Foundation Package",
      price: "4 - 5",
      period: "per student / term",
      description: "Best for schools that want reliable administration and parent communication.",
      color: "bg-green-50 text-green-900",
      btnColor: "bg-green-600 hover:bg-green-700",
      features: [
        "School Management (Records, Classes)",
        "Results & Academics (Report Cards)",
        "Parent Access (Online Portal)",
        "Communication (Bulk SMS Pay-as-you-go)",
        "Secure Cloud Storage"
      ]
    },
    {
      name: "Performance Package",
      price: "20",
      period: "per student / term",
      description: "For schools that want better results, happier parents, and less teacher workload.",
      isPopular: true,
      color: "bg-blue-900 text-white",
      btnColor: "bg-white text-blue-900 hover:bg-blue-50",
      features: [
        "Everything in Foundation",
        "Student Learning App (Quizzes)",
        "Automatic Marking & Analytics",
        "Parent Performance Insights",
        "Teacher Productivity Tools",
        "SMS Benefits (Included Fair Usage)"
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-slate-50 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Pricing Plans</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Simple, transparent pricing designed for Ghanaian schools. <br />
            Pay <span className="font-bold text-slate-900">per student, per term</span>. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-3xl p-8 md:p-10 transition-all duration-300 ${plan.isPopular
                  ? 'bg-blue-900 text-white shadow-2xl ring-4 ring-blue-500/20 transform md:-translate-y-4'
                  : 'bg-white text-slate-900 border border-slate-200 shadow-xl'
                }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-yellow-400 text-blue-900 text-xs font-black px-4 py-1.5 rounded-bl-xl rounded-tr-2xl uppercase tracking-wider shadow-sm">
                  Best Value
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${plan.isPopular ? 'bg-yellow-400' : 'bg-green-500'}`}></div>
                <h3 className={`text-2xl font-bold ${plan.isPopular ? 'text-white' : 'text-slate-800'}`}>
                  {plan.name}
                </h3>
              </div>

              <div className="flex items-baseline mb-2">
                <span className="text-xl font-bold mr-1">GH¢</span>
                <span className="text-6xl font-black tracking-tighter">{plan.price}</span>
              </div>
              <p className={`text-sm font-bold mb-6 opacity-80 uppercase tracking-wide`}>
                {plan.period}
              </p>

              <p className={`mb-8 font-medium text-lg leading-relaxed ${plan.isPopular ? 'text-blue-100' : 'text-slate-600'}`}>
                {plan.description}
              </p>

              <div className={`h-px w-full mb-8 ${plan.isPopular ? 'bg-blue-800' : 'bg-slate-100'}`}></div>

              <ul className="space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className={`h-6 w-6 mr-3 flex-shrink-0 ${plan.isPopular ? 'text-yellow-400' : 'text-green-500'}`} />
                    <span className="font-bold text-base">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-4 px-6 rounded-xl font-black text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${plan.btnColor}`}
              >
                Choose {plan.name}
              </button>
            </div>
          ))}
        </div>

        {/* Comparison Table / Footnote */}
        <div className="mt-20 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-4">How Payments Work</h3>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="font-bold text-slate-900 mb-1">Per Student / Term</p>
                <p className="text-sm text-slate-600">You are strictly charged based on the number of students, once every term.</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="font-bold text-slate-900 mb-1">Pass on to Parents</p>
                <p className="text-sm text-slate-600">Schools typically include this fee in ICT or Academic support levies.</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="font-bold text-slate-900 mb-1">Flexible Upgrade</p>
                <p className="text-sm text-slate-600">Start with Foundation. Upgrade to Performance when you are ready.</p>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-100">
              <p className="text-slate-500 font-medium">
                One-time setup & training fee of <span className="font-bold text-slate-900">GH¢ 400</span> applies to all new schools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;