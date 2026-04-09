import React from 'react';
import { WifiOff, Send, UserCheck } from 'lucide-react';

const WhyUs: React.FC = () => {
  const reasons = [
    {
      icon: WifiOff,
      title: "Optimized for Ghana",
      description: "Low bandwidth? No problem. Base16 is built to work seamlessly on local internet connections. Your data syncs automatically the moment you're back online."
    },
    {
      icon: Send,
      title: "Bulk Collection Tools",
      description: "Stop manual follow-ups. Dispatch professional SMS fee reminders to every guardian with one tap. Schools see a 40% improvement in fee collection rates."
    },
    {
      icon: UserCheck,
      title: "No Training Required",
      description: "Designed for busy school owners, not engineers. If you can use WhatsApp, you can master Base16 in under 10 minutes. Zero steep learning curves."
    }
  ];

  return (
    <section id="why-us" className="py-24 bg-white scroll-mt-24 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">The tool of choice for <br/> 50+ Ghanaian Schools.</h2>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">Built by education experts who understand the daily operational challenges of running a school in our region.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {reasons.map((item, index) => (
            <div key={index} className="p-10 rounded-[2rem] border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors duration-300">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white text-slate-900 mb-8 shadow-sm ring-1 ring-slate-200">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyUs;