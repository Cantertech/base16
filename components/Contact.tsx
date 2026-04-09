import React from 'react';
import { Mail, Phone, MapPin, Sparkles } from 'lucide-react';

const Contact: React.FC = () => {
    return (
        <div className="bg-white min-h-screen pt-32 pb-24 md:pt-48 md:pb-32">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="max-w-3xl mb-16 md:mb-24">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 mb-8">
                      <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contact Us</span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-8">
                      We're here to <br className="hidden md:block"/>
                      <span className="text-primary-600 italic">support your growth.</span>
                  </h1>
                  <p className="text-xl text-slate-500 font-medium leading-relaxed">
                      Have questions about Base16 or need a custom implementation? Our team of education experts is ready to help your school transition to the modern era.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      {
                        title: "Sales & Inquiries",
                        email: "sixzonesglobal@gmail.com",
                        phone: "050 256 0760",
                        icon: Mail
                      },
                      {
                        title: "Technical Support",
                        email: "sixzonesglobal@gmail.com",
                        phone: "050 256 0760",
                        icon: Phone
                      },
                      {
                        title: "Headquarters",
                        address: "SixZones Tech Hub, Accra, Ghana",
                        icon: MapPin
                      },
                      {
                        title: "Operational Hours",
                        note: "Mon - Fri: 8am - 5pm GMT",
                        icon: Sparkles
                      }
                    ].map((item, i) => (
                      <div key={i} className="p-8 rounded-[2rem] border border-slate-100 bg-slate-50/50 flex flex-col items-start transition-all hover:bg-slate-50 group">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-8 group-hover:bg-primary-600 group-hover:text-white transition-all">
                          <item.icon className="w-5 h-5 truncate" />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-4 tracking-tight uppercase text-sm">{item.title}</h3>
                        
                        {item.email && <p className="text-sm font-bold text-primary-600 mb-1">{item.email}</p>}
                        {item.phone && <p className="text-sm font-medium text-slate-500">{item.phone}</p>}
                        {item.address && <p className="text-sm font-medium text-slate-500 leading-relaxed">{item.address}</p>}
                        {item.note && <p className="text-sm font-medium text-slate-500">{item.note}</p>}
                      </div>
                    ))}
                </div>

                <div className="mt-24 pt-16 border-t border-slate-100 flex flex-wrap gap-8 items-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    <span className="text-slate-900">Follow us</span>
                    <a href="#" className="hover:text-primary-600 transition-colors">Twitter</a>
                    <a href="#" className="hover:text-primary-600 transition-colors">LinkedIn</a>
                    <a href="#" className="hover:text-primary-600 transition-colors">Facebook</a>
                </div>
            </div>
        </div>
    );
};

export default Contact;
