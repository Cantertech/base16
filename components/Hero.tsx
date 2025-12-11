import React from 'react';
import { ArrowRight, PlayCircle } from 'lucide-react';

interface HeroProps {
    onStartWizard: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStartWizard }) => {
  return (
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-primary-50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          
          {/* Text Content */}
          <div className="lg:w-1/2 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Manage Your School with <span className="text-primary-800">Confidence & Ease</span>.
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              The all-in-one platform to streamline admissions, automate fee collection, and generate reports. Orbit simplifies administration so you can focus on education.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button 
                onClick={onStartWizard}
                className="flex items-center justify-center gap-2 bg-primary-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-800 transition-transform hover:scale-105 shadow-lg"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-sm">
                <PlayCircle className="h-5 w-5 text-primary-800" />
                See How It Works
              </button>
            </div>
          </div>

          {/* Image Content */}
          <div className="lg:w-1/2 w-full relative">
            <div className="absolute -inset-4 bg-primary-100 rounded-2xl transform rotate-2 opacity-50 blur-lg"></div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
               {/* Using the placeholder as requested */}
               <img 
                src="https://placehold.co/600x400/1e40af/ffffff?text=Orbit+Dashboard" 
                alt="Orbit Dashboard" 
                className="w-full h-auto object-cover"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;