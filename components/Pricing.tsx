import React from 'react';
import { Check } from 'lucide-react';
import { PricingPlan } from '../types';

const Pricing: React.FC = () => {
  const plans: PricingPlan[] = [
    {
      name: "Small School",
      price: "200",
      limit: "Up to 400 Students",
      features: [
        "Student & Parent Database",
        "Basic Fee Tracking",
        "Terminal Report Cards",
        "SMS Reminders (Bundles extra)",
        "Email Support"
      ]
    },
    {
      name: "Growth",
      price: "500",
      limit: "Unlimited Students",
      isPopular: true,
      features: [
        "Everything in Small School",
        "Advanced Financial Reports",
        "Staff Payroll Management",
        "Priority Phone Support",
        "Free 500 SMS Credits / Term",
        "Offline Sync Mode"
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-white scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-gray-600">No hidden costs. Pay monthly as you grow.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative rounded-2xl p-8 ${
                plan.isPopular 
                  ? 'bg-primary-900 text-white shadow-xl ring-4 ring-primary-50 transform md:-translate-y-2' 
                  : 'bg-white text-slate-900 border-2 border-slate-100 shadow-sm'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-yellow-400 text-primary-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wide">
                  Best Value
                </div>
              )}
              
              <h3 className={`text-xl font-bold mb-2 ${plan.isPopular ? 'text-blue-100' : 'text-gray-500'}`}>
                {plan.name}
              </h3>
              
              <div className="flex items-baseline mb-2">
                <span className="text-xl font-semibold mr-1">GHS</span>
                <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                <span className={`ml-2 text-sm ${plan.isPopular ? 'text-blue-200' : 'text-gray-500'}`}>/ month</span>
              </div>
              
              <p className={`mb-8 font-medium ${plan.isPopular ? 'text-blue-100' : 'text-primary-800'}`}>
                {plan.limit}
              </p>
              
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className={`h-5 w-5 mr-3 flex-shrink-0 ${plan.isPopular ? 'text-yellow-400' : 'text-green-500'}`} />
                    <span className="text-sm leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button 
                className={`w-full py-4 px-6 rounded-xl font-bold transition-colors ${
                  plan.isPopular 
                    ? 'bg-white text-primary-900 hover:bg-gray-100' 
                    : 'bg-primary-900 text-white hover:bg-primary-800'
                }`}
              >
                Choose {plan.name}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-block bg-blue-50 border border-blue-100 rounded-lg px-6 py-4">
            <p className="text-slate-700 font-medium">
              Note: One-time setup & training fee of <span className="font-bold text-primary-900">GHS 400</span> applies to all plans.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;