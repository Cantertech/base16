import React from 'react';
import { Users, Banknote, BookOpen, CalendarCheck, MessageSquare, PieChart } from 'lucide-react';

const Features: React.FC = () => {
  const featureList = [
    {
      title: "Student Intelligence",
      description: "Digitalize student profiles, parent records, and behavioral history in a centralized, secure database.",
      icon: Users
    },
    {
      title: "Automated Fee Collection",
      description: "Track payments, arrears, and electronic receipts. Manage your school's cash flow with zero manual entry.",
      icon: Banknote
    },
    {
      title: "GES Termly Reports",
      description: "Generate compliant report cards and academic transcripts instantly. No more complicated Excel formulas.",
      icon: BookOpen
    },
    {
      title: "Professional Attendance",
      description: "Daily digital logging for students and staff with automated monthly reporting for school heads.",
      icon: CalendarCheck
    },
    {
      title: "Bulk SMS Engine",
      description: "Send professional fee reminders and school notices directly to parent phones with 99.9% delivery rate.",
      icon: MessageSquare
    },
    {
      title: "Financial Analytics",
      description: "Real-time visibility into school expenses and income. Visualize your school's growth with clean charts.",
      icon: PieChart
    }
  ];

  return (
    <section id="features" className="py-24 bg-white scroll-mt-24 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-20">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6 tracking-tight"> Built for the modern <br/> educational institution.</h2>
          <p className="text-lg text-slate-600 leading-relaxed font-medium">The core modules you need to automate your administration and focus on what matters most: teaching.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {featureList.map((feature, index) => (
            <div key={index} className="flex flex-col items-start group">
              <div className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-900 rounded-xl mb-6 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 ring-1 ring-slate-200">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3 tracking-tight">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;