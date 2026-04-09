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
    <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <img src="/orbit_logo.jpg" alt="Base16 Logo" className="h-10 w-auto rounded-lg shadow-sm group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-black text-xl text-slate-900 tracking-tight leading-none uppercase">Base16</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Automated Schooling</span>
            </div>
          </div>

          {/* Desktop Menu */}
          {showLinks && (
            <div className="hidden md:flex space-x-10 items-center">
              <Link to="/features" className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Features</Link>
              <Link to="/pricing" className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
              <Link to="/about" className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">About</Link>
              
              <div className="h-4 w-px bg-slate-200"></div>

              <Link
                to="/login"
                className="text-sm font-bold text-slate-900 hover:text-primary-600 transition-colors flex items-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" /> Login
              </Link>

              <button
                onClick={() => navigate('/demo')}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
              >
                Book Demo
              </button>

              {isInstallable && (
                <button
                  onClick={showInstallPrompt}
                  className="bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Install
                </button>
              )}
            </div>
          )}

          {/* Mobile Menu Button */}
          {showLinks && (
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-900 p-2"
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
        <div className="md:hidden bg-white border-t border-slate-100 absolute w-full shadow-2xl">
          <div className="px-4 py-8 space-y-6">
            <Link to="/features" onClick={() => setIsOpen(false)} className="block text-xl font-bold text-slate-900">Features</Link>
            <Link to="/pricing" onClick={() => setIsOpen(false)} className="block text-xl font-bold text-slate-900">Pricing</Link>
            <Link to="/about" onClick={() => setIsOpen(false)} className="block text-xl font-bold text-slate-900">About</Link>
            <Link to="/contact" onClick={() => setIsOpen(false)} className="block text-xl font-bold text-slate-900">Contact</Link>
            
            <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
               <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/demo');
                  }}
                  className="w-full bg-slate-900 text-white px-5 py-4 rounded-xl font-bold shadow-md"
                >
                  Book a Demo
                </button>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center px-5 py-4 text-slate-900 font-bold bg-slate-50 rounded-xl"
                >
                  Login
                </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;