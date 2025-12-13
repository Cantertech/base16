import React, { useState } from 'react';
import { Menu, X, LogIn } from 'lucide-react';

interface NavbarProps {
  onNavigateHome: () => void;
  onNavigateLogin?: () => void;
  onBookDemo?: () => void;
  showLinks?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigateHome, onNavigateLogin, onBookDemo, showLinks = true }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  // Function to handle scroll to ID
  const scrollToSection = (id: string) => {
    setIsOpen(false);
    onNavigateHome(); // Ensure we are on landing page

    // Small timeout to allow View change if needed
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <nav className="fixed w-full z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={onNavigateHome}>
            <img src="/orbit_logo.png" alt="Orbit Logo" className="h-10 w-auto" />
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase leading-none tracking-widest mb-0.5">SixZones</span>
              <span className="font-bold text-xl text-primary-900 tracking-tight leading-none">Orbit</span>
            </div>
          </div>

          {/* Desktop Menu */}
          {showLinks && (
            <div className="hidden md:flex space-x-8 items-center">
              <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-primary-900 font-medium transition-colors">Features</button>
              <button onClick={() => scrollToSection('why-us')} className="text-gray-600 hover:text-primary-900 font-medium transition-colors">Why Orbit</button>
              <button onClick={() => scrollToSection('pricing')} className="text-gray-600 hover:text-primary-900 font-medium transition-colors">Pricing</button>

              <div className="h-6 w-px bg-slate-200 mx-2"></div>

              {onNavigateLogin && (
                <button
                  onClick={onNavigateLogin}
                  className="text-primary-900 font-medium hover:underline flex items-center gap-2"
                >
                  <LogIn className="h-4 w-4" /> Login
                </button>
              )}

              <button
                onClick={onBookDemo}
                className="bg-primary-900 text-white px-5 py-2 rounded-lg font-medium hover:bg-primary-800 transition-colors shadow-md"
              >
                Book a Demo
              </button>
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
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('why-us')}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Why Orbit
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Pricing
            </button>

            {onNavigateLogin && (
              <button
                onClick={() => { setIsOpen(false); onNavigateLogin(); }}
                className="block w-full text-left px-3 py-3 text-base font-medium text-primary-900 hover:bg-blue-50 rounded-md"
              >
                Login
              </button>
            )}

            <div className="pt-4">
              <button
                onClick={() => { setIsOpen(false); if (onBookDemo) onBookDemo(); }}
                className="w-full bg-primary-900 text-white px-5 py-3 rounded-lg font-medium shadow-md"
              >
                Book a Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;