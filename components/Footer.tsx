import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-white pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <img src="/orbit_logo.jpg" alt="Base16 Logo" className="h-8 w-auto" />
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-none text-white">Base16</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase leading-none tracking-widest mt-0.5">by SixZones</span>
            </div>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Privacy Policy</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Terms of Service</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">Contact Support</a>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-500 text-sm">
            &copy; 2025 SixZones. All rights reserved.
          </p>
          <p className="text-slate-600 text-xs mt-2 md:mt-0">
            Made with ❤️ in Accra, Ghana.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;