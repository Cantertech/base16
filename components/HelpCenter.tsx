import React, { useState } from 'react';
import {
   HelpCircle, ChevronDown, ChevronUp, MessageSquare,
   Send, Phone, Mail, ExternalLink, Lightbulb, CheckCircle
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface HelpCenterProps {
   currentUser?: {
      id: string;
      school_id: string;
   };
}

const HelpCenter: React.FC<HelpCenterProps> = ({ currentUser }) => {
   const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
   const [featureRequest, setFeatureRequest] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   // --- Mock Data ---
   const faqs = [
      {
         question: "How do I reset a teacher's password?",
         answer: "Go to the 'Teachers' module from the sidebar. Click the 'Eye' icon next to the teacher's name to open their profile. In the profile drawer, click the 'System Access' section (Admin only) and click 'Reset Password'. It will default to 'password123'."
      },
      {
         question: "How do I buy more SMS credits?",
         answer: "Currently, SMS bundles are purchased directly through our support team to ensure the best rates for Ghanaian networks. Please contact us via WhatsApp or Email listed on this page with the package you need."
      },
      {
         question: "Can I print report cards for past terms?",
         answer: "Yes. In the 'Exam' module, switch to the 'Results & Approval' tab. You can filter by Class and Academic Term (if configured) to retrieve and print historical report cards."
      },
      {
         question: "How do I correct a wrong fee entry?",
         answer: "For financial audit safety, transactions cannot be deleted by users. If you entered a wrong amount, please record a negative transaction (refund) to balance it out, or contact Support for a database correction."
      },
      {
         question: "Is the data backed up automatically?",
         answer: "Yes, Brainwave is a cloud-based Progressive Web App. Your data is synced and backed up to our secure servers automatically whenever you are online."
      }
   ];

   // --- Handlers ---
   const toggleFaq = (index: number) => {
      setOpenFaqIndex(openFaqIndex === index ? null : index);
   };

   const handleSubmitRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!featureRequest.trim()) return;

      setIsSubmitting(true);

      if (currentUser?.school_id) {
         try {
            const { error } = await supabase
               .from('support_tickets')
               .insert({
                  school_id: currentUser.school_id,
                  user_id: currentUser.id,
                  message: featureRequest,
                  status: 'Open'
               });

            if (error) throw error;

            setFeatureRequest('');
            alert("Thanks! Our engineers have received your request. We build Brainwave based on feedback like yours.");
         } catch (error: any) {
            console.error('Error submitting ticket:', error);
            alert("Failed to submit request: " + error.message);
         }
      } else {
         alert("You must be logged in to submit a request.");
      }

      setIsSubmitting(false);
   };

   return (
      <div className="p-8 space-y-8 h-full bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-300">

         {/* Header */}
         <div>
            <h1 className="text-2xl font-bold text-slate-800">Help Center & Support</h1>
            <p className="text-slate-500 text-sm">Find answers, get help, or suggest new features.</p>
         </div>

         <div className="flex flex-col lg:flex-row gap-8">

            {/* --- LEFT COLUMN: Knowledge Base (60%) --- */}
            <div className="w-full lg:w-3/5 space-y-6">
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                     <HelpCircle className="h-5 w-5 text-primary-600" />
                     <h2 className="font-bold text-lg text-slate-800">Frequently Asked Questions</h2>
                  </div>

                  <div className="divide-y divide-slate-100">
                     {faqs.map((faq, index) => (
                        <div key={index} className="group">
                           <button
                              onClick={() => toggleFaq(index)}
                              className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none hover:bg-slate-50 transition-colors"
                           >
                              <span className={`font-medium text-sm ${openFaqIndex === index ? 'text-primary-700' : 'text-slate-700'}`}>
                                 {faq.question}
                              </span>
                              {openFaqIndex === index ? (
                                 <ChevronUp className="h-4 w-4 text-primary-500" />
                              ) : (
                                 <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                              )}
                           </button>
                           {openFaqIndex === index && (
                              <div className="px-6 pb-6 pt-0 text-slate-600 text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                                 {faq.answer}
                              </div>
                           )}
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* --- RIGHT COLUMN: Contact & Features (40%) --- */}
            <div className="w-full lg:w-2/5 space-y-6">

               {/* Feature Request Box */}
               <div className="rounded-2xl p-1 bg-gradient-to-br from-primary-600 to-indigo-700 shadow-lg transform transition-all hover:scale-[1.01]">
                  <div className="bg-gradient-to-br from-primary-900 to-indigo-900 rounded-xl p-6 text-white h-full relative overflow-hidden">
                     {/* Decorative Icon */}
                     <div className="absolute -top-6 -right-6 opacity-10 rotate-12">
                        <Lightbulb className="h-32 w-32" />
                     </div>

                     <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                           <Lightbulb className="h-5 w-5 text-yellow-300" />
                           <h3 className="font-bold text-lg">Missing a Feature? Tell Us.</h3>
                        </div>
                        <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                           Brainwave is built for you. What specific tool or report would make your work easier?
                        </p>

                        <form onSubmit={handleSubmitRequest} className="space-y-3">
                           <textarea
                              required
                              value={featureRequest}
                              onChange={(e) => setFeatureRequest(e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-sm text-white placeholder:text-blue-200/50 focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none"
                              placeholder="I wish the system could..."
                              rows={4}
                           ></textarea>
                           <button
                              type="submit"
                              disabled={isSubmitting}
                              className="w-full bg-white text-primary-900 font-bold py-2.5 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                           >
                              {isSubmitting ? 'Sending...' : 'Submit Request'}
                              {!isSubmitting && <Send className="h-4 w-4" />}
                           </button>
                        </form>
                     </div>
                  </div>
               </div>

               {/* Contact Support */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-lg text-slate-800 mb-4">Contact Support</h3>
                  <div className="space-y-4">
                     <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="bg-green-100 p-2 rounded-full text-green-700 mt-0.5">
                           <Phone className="h-4 w-4" />
                        </div>
                        <div>
                           <p className="text-xs font-bold text-slate-500 uppercase">WhatsApp Hotline</p>
                           <p className="font-bold text-slate-800">+233 50 256 0760</p>
                           <p className="text-xs text-slate-500 mt-1">Available 8am - 5pm (Mon-Fri)</p>
                        </div>
                     </div>

                     <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-700 mt-0.5">
                           <Mail className="h-4 w-4" />
                        </div>
                        <div>
                           <p className="text-xs font-bold text-slate-500 uppercase">Email Support</p>
                           <p className="font-bold text-slate-800">support@brainwave.com</p>
                           <p className="text-xs text-slate-500 mt-1">Response within 24 hours</p>
                        </div>
                     </div>

                     <a
                        href="https://wa.me/233241234567"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-xl font-bold hover:bg-[#20bd5a] transition-colors shadow-sm"
                     >
                        <MessageSquare className="h-5 w-5" /> Chat on WhatsApp
                     </a>
                  </div>
               </div>

            </div>
         </div>
      </div>
   );
};

export default HelpCenter;