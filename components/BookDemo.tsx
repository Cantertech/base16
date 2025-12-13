import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle, ArrowLeft, Phone, Mail, MapPin } from 'lucide-react';

interface BookDemoProps {
  onBack: () => void;
}

const BookDemo: React.FC<BookDemoProps> = ({ onBack }) => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API submission
    setTimeout(() => {
      setSubmitted(true);
      window.scrollTo(0, 0);
    }, 500);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Received!</h2>
          <p className="text-slate-600 mb-8 text-sm leading-relaxed">
            Thank you for your interest in Brainwave. Our team has received your request and will contact you via phone or WhatsApp within 24 hours to confirm your demo slot.
          </p>
          <button
            onClick={onBack}
            className="bg-primary-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-800 transition-colors w-full shadow-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-12 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center text-slate-500 hover:text-slate-800 mb-8 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left Side: Info */}
          <div className="lg:w-2/5 bg-primary-900 p-10 lg:p-12 text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <Calendar className="h-64 w-64 transform rotate-12" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">See Brainwave in Action</h2>
                <p className="text-blue-100 mb-10 leading-relaxed text-lg">
                  Schedule a personalized 20-minute walkthrough. We'll show you exactly how Brainwave solves the specific problems your school faces—from fee collection to report cards.
                </p>

                <div className="space-y-8 mb-12">
                  <div className="flex items-start gap-4">
                    <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                      <Clock className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Save Time</h4>
                      <p className="text-sm text-blue-200 mt-1">Discover how to cut administrative work by 50% immediately.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                      <CheckCircle className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">No Commitments</h4>
                      <p className="text-sm text-blue-200 mt-1">Free consultation. No credit card required. No pressure.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-8 space-y-4">
                <div className="flex items-center gap-3 text-sm text-blue-100">
                  <Phone className="h-4 w-4" /> +233 24 123 4567
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-100">
                  <Mail className="h-4 w-4" /> sales@brainwave.com
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-100">
                  <MapPin className="h-4 w-4" /> East Legon, Accra, Ghana
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="lg:w-3/5 p-10 lg:p-16 bg-white">
            <div className="max-w-lg mx-auto lg:mx-0">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Enter your details</h3>
              <p className="text-slate-500 mb-8">Tell us a bit about yourself so we can prepare for our meeting.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                    <input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 focus:bg-white outline-none transition-all" placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">School Name</label>
                    <input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 focus:bg-white outline-none transition-all" placeholder="e.g. Great Minds Academy" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                    <input required type="tel" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 focus:bg-white outline-none transition-all" placeholder="024..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Role</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 focus:bg-white outline-none transition-all">
                      <option>Headmaster / Proprietor</option>
                      <option>Administrator</option>
                      <option>Teacher</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address <span className="font-normal text-slate-400">(Optional)</span></label>
                  <input type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 focus:bg-white outline-none transition-all" placeholder="john@example.com" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">How can we help? <span className="font-normal text-slate-400">(Optional)</span></label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-600 focus:bg-white outline-none transition-all h-24 resize-none" placeholder="e.g. I need help with fee tracking..."></textarea>
                </div>

                <button type="submit" className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition-transform active:scale-[0.99] shadow-lg flex justify-center items-center gap-2">
                  Confirm Booking <ArrowLeft className="h-5 w-5 rotate-180" />
                </button>

                <p className="text-center text-xs text-slate-400 mt-4">
                  By booking, you agree to our privacy policy. We will never spam you.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDemo;