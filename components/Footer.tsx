import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-slate-900 pt-24 pb-12 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
          
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-6 group cursor-default">
              <img src="/orbit_logo_new.png" alt="Base16 Logo" className="h-10 w-auto rounded-lg shadow-sm group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-black text-xl text-slate-900 tracking-tight leading-none uppercase">Base16</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Automated Schooling</span>
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-xs">
              The professional school engine built to help Ghanaian headmasters automate their administration with zero complexity.
            </p>
          </div>

          <div>
             <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6">Product</h4>
             <ul className="space-y-4">
                <li><Link to="/features" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">Pricing</Link></li>
                <li><Link to="/about" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">How it works</Link></li>
             </ul>
          </div>

          <div>
             <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6">Company</h4>
             <ul className="space-y-4">
                <li><Link to="/about" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">Contact</Link></li>
                <li><Link to="/legal" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">Legal</Link></li>
             </ul>
          </div>

          <div>
             <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6">Support</h4>
             <ul className="space-y-4">
                <li><Link to="/contact" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">Help Center</Link></li>
                <li><Link to="/contact" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">Training</Link></li>
                <li className="text-sm font-bold text-slate-400">Accra, Ghana</li>
             </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">
            &copy; 2026 Base16 System. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-8">
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">
              Made with precision in Ghana.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;