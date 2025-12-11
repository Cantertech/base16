import React from 'react';
import { Users, Banknote, BookOpen, CalendarCheck, MessageSquare, PieChart } from 'lucide-react';
import { FeatureItem } from '../types';

const Features: React.FC = () => {
  const featureList: FeatureItem[] = [
    {
      title: "Student Records",
      description: "Digitalize all student profiles, parent contacts, and medical info in one secure place.",
      icon: Users
    },
    {
      title: "Fee Management",
      description: "Track payments, partial payments, and arrears instantly. Know who owes you at a glance.",
      icon: Banknote
    },
    {
      title: "Academics & Reports",
      description: "Generate beautiful, GES-compliant terminal report cards without the Excel headache.",
      icon: BookOpen
    },
    {
      title: "Attendance Tracking",
      description: "Mark daily attendance for students and staff. Spot absenteeism trends early.",
      icon: CalendarCheck
    },
    {
      title: "SMS Messaging",
      description: "Send fee reminders, meeting notices, and holiday wishes directly to parents' phones.",
      icon: MessageSquare
    },
    {
      title: "Expense Tracking",
      description: "Record daily school expenses. See exactly where your money is going every month.",
      icon: PieChart
    }
  ];

  return (
    <section id="features" className="py-20 bg-slate-50 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything You Need to Run Your School</h2>
          <p className="text-lg text-gray-600">The "Big 6" modules designed to simplify your administration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {featureList.map((feature, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-start hover:border-primary-600 transition-colors cursor-default group">
              <div className="p-3 bg-blue-50 text-primary-800 rounded-lg mb-4 group-hover:bg-primary-900 group-hover:text-white transition-colors">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;