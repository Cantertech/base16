import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles, MessageCircle, ShieldCheck } from 'lucide-react';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the free data migration work if our records are in paper books?",
      a: "You don't have to manually type hundreds of student registers. You can simply hand us your existing paper books, snap clear photos of your class lists, or send existing Excel files via WhatsApp. Our deployment engineers will format, verify, and load all your students, classes, and historical fee arrears into your system within 24 to 48 hours — at absolutely zero extra charge."
    },
    {
      q: "Can parents pay school fees using MTN MoMo, Telecel Cash, or AT Money?",
      a: "Yes! Base16 is integrated with Ghana's leading payment gateways (Paystack & Hubtel). Parents can pay fees directly via Mobile Money or debit cards, and both the school accountant and the parent receive instant branded SMS receipts. You can also record physical cash payments and issue instant SMS receipts just as easily."
    },
    {
      q: "What happens when there is an ECG power cut (dumsor) or no internet?",
      a: "Your school never stops. Base16 is engineered as a Progressive Web App (PWA) with offline resilience. Teachers can continue taking roll call, recording exam marks, and issuing fee receipts offline on their smartphones, tablets, or laptops. The moment connection returns, everything synchronizes automatically with zero lost records."
    },
    {
      q: "Does Base16 comply with the official Ghana Education Service (GES) grading system?",
      a: "100% yes. Base16 supports the official GES Continuous Assessment format (30% Class Score + 70% Exam Score, or customizable 50/50 weights). It automatically calculates raw marks, percentage aggregates, class positions (1st, 2nd, 3rd), and generates headteacher remarks and batch-printable terminal report cards."
    },
    {
      q: "Do older or non-technical teachers need computer training to use this?",
      a: "Zero technical training is required. If a teacher knows how to send a WhatsApp message, they can use Base16. The buttons are large, clear, and designed around daily school habits. In fact, most schools get their entire teaching staff up and running within 15 minutes of launch."
    },
    {
      q: "Are there any hidden charges, per-student fees, or dollar subscriptions?",
      a: "Never. Base16 was built in Ghana for Ghanaian schools. Our pricing is fixed, transparent, and billed per term in Ghana Cedis (GH₵ 350 per term for unlimited students and staff). You will never experience foreign currency exchange rate shocks or surprise penalties."
    }
  ];

  return (
    <section id="faq" className="py-24 md:py-32 bg-white text-slate-900 scroll-mt-24 border-t border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-widest mb-4 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Got Questions? We Have Answers</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Everything you need to know about adopting Base16 for your school this term.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen ? 'border-blue-500/50 bg-blue-50/20 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-6 sm:p-7 flex items-center justify-between gap-4 font-bold text-slate-900 transition-colors"
                >
                  <span className="text-base sm:text-lg font-bold pr-2">{faq.q}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? 'bg-blue-600 text-white rotate-180' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-7 sm:px-7 text-sm sm:text-base text-slate-600 leading-relaxed font-normal animate-in fade-in duration-200 border-t border-slate-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Help Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">Have a specific question about your school?</h4>
              <p className="text-xs sm:text-sm text-slate-500">Our Ghana support desk is available on WhatsApp and phone.</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/demo'}
            className="shrink-0 bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            Speak with an Advisor
          </button>
        </div>

      </div>
    </section>
  );
};

export default FAQ;
