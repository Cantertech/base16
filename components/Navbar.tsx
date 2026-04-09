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

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleLogoClick = () => {
    navigate('/');
    window.scrollTo(0, 0);
  };

  return (
    <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={handleLogoClick}>
            <img src="/orbit_logo.jpg" alt="Base16 Logo" className="h-10 w-auto" />
            <div className="flex flex-col justify-center">
              <span className="font-bold text-xl text-primary-900 tracking-tight leading-none">Base16</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase leading-none tracking-widest mt-0.5">The Simplest School Engine</span>
            </div>
          </div>

          {/* Desktop Menu */}
          {showLinks && (
            <div className="hidden md:flex space-x-8 items-center">
              <Link to="/features" className="text-gray-600 hover:text-primary-900 font-medium transition-colors">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-primary-900 font-medium transition-colors">Pricing</Link>
              <Link to="/about" className="text-gray-600 hover:text-primary-900 font-medium transition-colors">About</Link>
              <Link to="/contact" className="text-gray-600 hover:text-primary-900 font-medium transition-colors">Contact</Link>

              <div className="h-6 w-px bg-slate-200 mx-2"></div>

              <Link
                to="/login"
                className="text-slate-600 hover:text-primary-900 font-bold transition-all flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>


              <Link
                to="/demo"
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                Book a Demo
              </Link>

              {isInstallable && (
                <button
                  onClick={showInstallPrompt}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
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
                onClick={toggleMenu}
                className="text-gray-600 hover:text-gray-900 focus:outline-none p-2"
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
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-2">
            <Link
              to="/features"
              onClick={() => setIsOpen(false)}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Features
            </Link>
            <Link
              to="/pricing"
              onClick={() => setIsOpen(false)}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Pricing
            </Link>
            <Link
              to="/about"
              onClick={() => setIsOpen(false)}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              About
            </Link>
            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Contact
            </Link>

            {isInstallable && (
              <button
                onClick={() => {
                  showInstallPrompt();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-base font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Download className="h-5 w-5" /> Install Base16 App
              </button>
            )}

            <button
              onClick={() => {
                setIsOpen(false);
                onStartWizard && onStartWizard();
              }}
              className="block w-full text-center bg-slate-900 text-white px-5 py-3 rounded-xl font-bold shadow-md"
            >
              Start for Free
            </button>

            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center px-5 py-3 text-base font-bold text-primary-900 bg-primary-50 rounded-xl"
            >
              Login to Account
            </Link>

            <div className="pt-4">
              <Link
                to="/demo"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center bg-primary-900 text-white px-5 py-3 rounded-lg font-medium shadow-md"
              >
                Book a Demo
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;