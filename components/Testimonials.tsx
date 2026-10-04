import React from 'react';
import { Star, Quote, CheckCircle, Building2, MapPin, Users } from 'lucide-react';

const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: "Dr. Emmanuel Boateng",
      role: "Proprietor & Director",
      school: "Great Heritage Academy",
      location: "Kumasi, Ashanti Region",
      students: "480 Students",
      avatar: "EB",
      avatarGradient: "from-blue-600 to-indigo-700",
      quote: "End-of-term exams used to keep our teachers at school until 9 PM for two weeks just doing calculations and writing report booklets. With Base16, all 480 terminal reports were ready, ranked, and printed in under 30 minutes. Automated SMS fee alerts helped us collect over GH₵ 65,000 in overdue fees within three weeks.",
      tag: "Fee Recovery & Exam Speed"
    },
    {
      name: "Mrs. Faustina Mensah",
      role: "Headmistress",
      school: "Fountain of Glory Preparatory",
      location: "Accra, Greater Accra",
      students: "320 Students",
      avatar: "FM",
      avatarGradient: "from-emerald-600 to-teal-700",
      quote: "Before Base16, parents constantly disputed fee balances because paper receipts were misplaced. Now, the second a parent pays via MoMo or cash, an instant branded SMS receipt hits their phone. The transparency has eliminated friction between our accounts department and parents completely.",
      tag: "Zero Fee Disputes"
    },
    {
      name: "Mr. Kofi Asare-Bediako",
      role: "Academic Director",
      school: "Morning Star International School",
      location: "Takoradi, Western Region",
      students: "550 Students",
      avatar: "KA",
      avatarGradient: "from-amber-600 to-orange-700",
      quote: "The offline resilience was the clincher for our management board. During local power cuts or unstable Wi-Fi, teachers continue entering grades without fear of losing data. It is easily the most dependable educational software we have used in our 14 years of operation.",
      tag: "Offline Dumsor-Proof"
    },
    {
      name: "Rev. Samuel Osei-Tutu",
      role: "School Administrator",
      school: "Calvary Baptist Basic School",
      location: "Sunyani, Bono Region",
      students: "290 Students",
      avatar: "SO",
      avatarGradient: "from-purple-600 to-violet-700",
      quote: "Our teachers were skeptical at first because they are not tech-savvy. But within one single afternoon, even our kindergarten and nursery teachers were taking daily roll call on their phones. It is truly as simple and familiar as using WhatsApp.",
      tag: "Zero Tech Skills Needed"
    },
    {
      name: "Mr. Ebenezer Quaye",
      role: "School Bursar & Accountant",
      school: "Crown Prince Academy",
      location: "Tema, Greater Accra",
      students: "410 Students",
      avatar: "EQ",
      avatarGradient: "from-cyan-600 to-blue-700",
      quote: "Reconciling daily feeding money, tuition payments, and bus fees used to take me nearly 3 hours every afternoon. With Base16's separate ledgers, reconciliation takes under 5 minutes, and our cash book balances to the exact pesewa every single day.",
      tag: "Daily Cash Reconciliation"
    },
    {
      name: "Madam Patricia Osei",
      role: "Parent & PTA Executive",
      school: "St. Anne's Anglican School",
      location: "Kumasi, Ashanti Region",
      students: "3 Children Enrolled",
      avatar: "PO",
      avatarGradient: "from-rose-600 to-pink-700",
      quote: "I have three children in the school. In the past, I never knew whether money handed to the children reached the accountant. Now I get an immediate SMS alert the moment payment is logged, plus a direct link to view their report cards online without paying for an app.",
      tag: "Parent Transparency"
    }
  ];

  return (
    <section id="testimonials" className="py-24 md:py-32 bg-slate-50 text-slate-900 scroll-mt-24 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-black uppercase tracking-widest mb-4 border border-blue-200">
            <Users className="w-3.5 h-3.5 text-blue-700" />
            <span>Proven in 100+ Ghanaian Schools</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Loved by School Owners. <br />
            <span className="text-blue-600">Trusted by Headteachers & Parents.</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Read how private and basic schools across Accra, Kumasi, Takoradi, and Sunyani eliminated administrative stress and accelerated fee recovery with Base16.
          </p>
        </div>

        {/* 6 Testimonial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {testimonials.map((t, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-3xl p-8 border border-slate-200/80 hover:border-blue-400/60 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl flex flex-col justify-between relative group"
            >
              <div>
                {/* Header: Rating & Tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    {t.tag}
                  </span>
                </div>

                {/* Quote */}
                <p className="text-sm text-slate-700 leading-relaxed font-medium italic mb-6">
                  "{t.quote}"
                </p>
              </div>

              {/* Author Footer */}
              <div className="pt-5 border-t border-slate-100 flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${t.avatarGradient} text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md`}>
                  {t.avatar}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{t.name}</h4>
                  <p className="text-xs font-semibold text-blue-600 truncate">{t.role}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{t.school} • {t.location}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Testimonials;
