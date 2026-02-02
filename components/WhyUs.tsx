import React from 'react';
import { WifiOff, Send, UserCheck } from 'lucide-react';

const WhyUs: React.FC = () => {
  const reasons = [
    {
      icon: WifiOff,
      title: "Works Offline / Slow Net",
      description: "Bad network? No problem. Base16 is optimized for Ghanaian internet conditions. Keep working and the system syncs automatically when the connection returns."
    },
    {
      icon: Send,
      title: "Automated Fee Chase",
      description: "Stop calling parents one by one. Send professional bulk SMS reminders to all debtors in Ghana with a single click. Improving collection rates by up to 40%."
    },
    {
      icon: UserCheck,
      title: "Simple for Everyone",
      description: "Designed specifically for busy headmasters, not computer wizards. Large buttons, clear text, and no confusing menus. If you can use WhatsApp, you can use Base16."
    }
  ];

  return (
    <section id="why-us" className="py-20 bg-white scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Why Headmasters Choose Base16</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">We understand the unique challenges of running a modern school.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {reasons.map((item, index) => (
            <div key={index} className="bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:shadow-lg transition-shadow duration-300">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 text-primary-800 mb-6">
                <item.icon className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyUs;