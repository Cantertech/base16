import React, { useState } from 'react';
import { Menu, X, LogIn, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInstall } from '../contexts/InstallContext';

interface NavbarProps {
  showLinks?: boolean;
  onStartWizard?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ showLinks = true, onStartWizard }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { isInstallable, showInstallPrompt } = useInstall();

  const handleLogoClick = () => {
    navigate('/');
    window.scrollTo(0, 0);
  };

  return (
    <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all duration-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <img src="/orbit_logo_new.png" alt="Base16 Logo" className="h-10 w-auto group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-extrabold text-xl text-slate-900 tracking-tight leading-none uppercase">Base16</span>
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Automated Schooling</span>
            </div>
          </div>
 
          {/* Desktop Menu */}
          {showLinks && (
            <div className="hidden md:flex space-x-8 items-center">
              <Link to="/features" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all duration-200 hover:-translate-y-0.5">Features</Link>
              <Link to="/pricing" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all duration-200 hover:-translate-y-0.5">Pricing</Link>
              <Link to="/about" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all duration-200 hover:-translate-y-0.5">About</Link>
              
              <div className="h-4 w-px bg-slate-200"></div>
 
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all duration-200 flex items-center gap-2"
              >
                <LogIn className="w-4 h-4 text-blue-600" /> Login
              </Link>
 
              <button
                onClick={() => navigate('/setup')}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
              >
                Get Started Free
              </button>

              <button
                onClick={() => navigate('/demo')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
              >
                Book Demo
              </button>
 
              {isInstallable && (
                <button
                  onClick={showInstallPrompt}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Install App
                </button>
              )}
            </div>
          )}
 
          {/* Mobile Menu Button */}
          {showLinks && (
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          )}
        </div>
      </div>
 
      {/* Mobile Menu Dropdown */}
      {isOpen && showLinks && (
        <div className="md:hidden bg-white border-t border-slate-200 absolute w-full shadow-2xl">
          <div className="px-4 py-8 space-y-6">
            <Link to="/features" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors">Features</Link>
            <Link to="/pricing" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors">Pricing</Link>
            <Link to="/about" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors">About</Link>
            <Link to="/contact" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors">Contact</Link>
            
            <div className="pt-6 border-t border-slate-200 flex flex-col gap-4">
               <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/demo');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white px-5 py-4 rounded-xl font-bold shadow-lg transition-colors"
                >
                  Book a Demo
                </button>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center px-5 py-4 text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors block"
                >
                  Login
                </Link>
                {isInstallable && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      showInstallPrompt();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-4 rounded-xl font-bold shadow-md transition-colors"
                  >
                    <Download className="w-5 h-5 text-blue-400" />
                    <span>Install Full App</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;