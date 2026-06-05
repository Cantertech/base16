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
    <nav className="fixed w-full z-50 bg-[#0b1329]/90 backdrop-blur-md border-b border-white/10 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <img src="/orbit_transparent_white_logo.png" alt="Base16 Logo" className="h-10 w-auto  group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-extrabold text-xl text-white tracking-tight leading-none uppercase">Base16</span>
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Automated Schooling</span>
            </div>
          </div>

          {/* Desktop Menu */}
          {showLinks && (
            <div className="hidden md:flex space-x-8 items-center">
              <Link to="/features" className="text-sm font-semibold text-slate-300 hover:text-white transition-all duration-200 hover:-translate-y-0.5">Features</Link>
              <Link to="/pricing" className="text-sm font-semibold text-slate-300 hover:text-white transition-all duration-200 hover:-translate-y-0.5">Pricing</Link>
              <Link to="/about" className="text-sm font-semibold text-slate-300 hover:text-white transition-all duration-200 hover:-translate-y-0.5">About</Link>
              
              <div className="h-4 w-px bg-white/10"></div>

              <Link
                to="/login"
                className="text-sm font-semibold text-slate-300 hover:text-white transition-all duration-200 flex items-center gap-2"
              >
                <LogIn className="w-4 h-4 text-blue-400" /> Login
              </Link>

              <button
                onClick={() => navigate('/demo')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
              >
                Book Demo
              </button>

              {isInstallable && (
                <button
                  onClick={showInstallPrompt}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/25 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
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
                className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
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
        <div className="md:hidden bg-[#0b1329]/95 backdrop-blur-lg border-t border-white/10 absolute w-full shadow-2xl">
          <div className="px-4 py-8 space-y-6">
            <Link to="/features" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-white hover:text-blue-400 transition-colors">Features</Link>
            <Link to="/pricing" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-white hover:text-blue-400 transition-colors">Pricing</Link>
            <Link to="/about" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-white hover:text-blue-400 transition-colors">About</Link>
            <Link to="/contact" onClick={() => setIsOpen(false)} className="block text-lg font-bold text-white hover:text-blue-400 transition-colors">Contact</Link>
            
            <div className="pt-6 border-t border-white/10 flex flex-col gap-4">
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
                  className="w-full text-center px-5 py-4 text-white font-bold bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors block"
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