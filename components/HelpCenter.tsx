import React, { useState } from 'react';
import {
   HelpCircle, ChevronDown, ChevronUp, MessageSquare,
   Send, Phone, Mail, ExternalLink, Lightbulb, CheckCircle, BookOpen, Layers, Users, CreditCard, Settings, GraduationCap, Banknote, Clock, Calendar, ArrowRight
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface HelpCenterProps {
   currentUser?: {
      id: string;
      school_id: string;
   };
}

const HelpCenter: React.FC<HelpCenterProps> = ({ currentUser }) => {
   const [activeTab, setActiveTab] = useState<'faq' | 'manual' | 'contact'>('manual');
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
         answer: "Yes, Base16 is a cloud-based Progressive Web App. Your data is synced and backed up to our secure servers automatically whenever you are online."
      }
   ];

   const manualSteps = [
      {
         id: 1,
         title: "School Profile & Settings",
         description: "Ensure your school's identity is correctly set up. This includes your logo, motto, and contact details which appear on reports and receipts.",
         icon: Settings,
         color: "bg-slate-100 text-slate-600",
         action: "Go to Settings > General",
         tips: [
            "Upload a high-quality logo (PNG format recommended).",
            "Set your brand color to match your school's uniform or identity.",
            "Verify your contact number as it will be used for SMS notifications."
         ]
      },
      {
         id: 2,
         title: "Academic Structure (Classes & Subjects)",
         description: "Define the backbone of your school. You must create classes (e.g., Grade 1) before you can add students.",
         icon: Layers,
         color: "bg-blue-100 text-blue-600",
         action: "Go to Classes (Course Management)",
         tips: [
            "Create Classes first (e.g., Nursery 1, Primary 1, JHS 1).",
            "Then create Subjects (e.g., Mathematics, English).",
            "Assign Subjects to the relevant Classes (e.g., Assign 'Science' to 'Primary 1' through 'JHS 3')."
         ]
      },
      {
         id: 3,
         title: "Staff Onboarding",
         description: "Add your teaching and administrative staff. Teachers need accounts to enter marks and take attendance.",
         icon: GraduationCap,
         color: "bg-purple-100 text-purple-600",
         action: "Go to Teachers",
         tips: [
            "Add teachers and assign them to a specific Class (Class Teacher) if applicable.",
            "Teachers will receive their login credentials to access their own dashboard."
         ]
      },
      {
         id: 4,
         title: "Financial Setup (Fees)",
         description: "Configure your fee structure so you can track payments and generate receipts.",
         icon: Banknote,
         color: "bg-orange-100 text-orange-600",
         action: "Go to Fees",
         tips: [
            "Create Fee Types (e.g., Tuition, Feeding Fee, PTA Dues).",
            "Assign fees to specific classes (e.g., JHS fees might differ from Primary fees).",
            "Once set up, you can start recording payments immediately."
         ]
      },
      {
         id: 5,
         title: "Student Enrollment",
         description: "Register your students into the classes you created.",
         icon: Users,
         color: "bg-emerald-100 text-emerald-600",
         action: "Go to Students",
         tips: [
            "You can add students individually.",
            "Ensure you select the correct Class and Gender for accurate analytics.",
            "Parent phone numbers are crucial for communication features."
         ]
      },
      {
         id: 6,
         title: "Timetable Scheduling",
         description: "Organize the daily learning schedule for each class.",
         icon: Clock,
         color: "bg-pink-100 text-pink-600",
         action: "Go to Timetable",
         tips: [
            "Select a Class and assign subjects to time slots.",
            "This helps teachers know where they need to be and when."
         ]
      },
      {
         id: 7,
         title: "Daily Operations",
         description: "You are now ready for day-to-day management!",
         icon: Calendar,
         color: "bg-indigo-100 text-indigo-600",
         action: "Attendance, Exams & Reports",
         tips: [
            "Mark Attendance daily.",
            "Record Exam scores at the end of the term.",
            "Generate Terminal Reports automatically."
         ]
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
            alert("Thanks! Our engineers have received your request. We build Base16 based on feedback like yours.");
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
            <p className="text-slate-500 text-sm">User Manuals, FAQs, and Support Contact.</p>
         </div>

         <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full space-y-6">
               <div className="flex gap-4 border-b border-slate-200 pb-1">
                  <button
                     onClick={() => setActiveTab('manual')}
                     className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                     User Manual
                  </button>
                  <button
                     onClick={() => setActiveTab('faq')}
                     className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'faq' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                     FAQs
                  </button>
                  <button
                     onClick={() => setActiveTab('contact')}
                     className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'contact' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                     Contact Support
                  </button>
               </div>

               {activeTab === 'manual' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-6">
                        <h3 className="font-bold text-blue-800 text-lg mb-2">Welcome to Base16!</h3>
                        <p className="text-blue-600">Follow this step-by-step guide to get your school up and running efficiently.</p>
                     </div>

                     <div className="grid grid-cols-1 gap-6">
                        {manualSteps.map((step, index) => (
                           <div key={step.id} className="relative flex gap-x-6 rounded-xl bg-white p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${step.color}`}>
                                 <step.icon className="h-6 w-6" aria-hidden="true" />
                              </div>

                              <div className="flex-1">
                                 <h3 className="text-lg font-bold leading-7 text-slate-900 flex items-center gap-2">
                                    <span className="text-slate-400 mr-1">#{step.id}</span> {step.title}
                                 </h3>
                                 <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>

                                 <div className="mt-3 bg-slate-50 rounded-lg border border-slate-100 p-3">
                                    <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                                       <CheckCircle className="h-3 w-3 text-green-500" /> Pro Tips:
                                    </h4>
                                    <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 ml-1">
                                       {step.tips.map((tip, i) => (
                                          <li key={i}>{tip}</li>
                                       ))}
                                    </ul>
                                 </div>

                                 <div className="mt-3 flex items-center gap-2 text-xs font-bold text-primary-600">
                                    <ArrowRight className="h-3 w-3" /> {step.action}
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {activeTab === 'faq' && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
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
               )}

               {activeTab === 'contact' && (
                  <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <div className="w-full lg:w-3/5">
                        <div className="rounded-2xl p-1 bg-gradient-to-br from-primary-600 to-indigo-700 shadow-lg transform transition-all hover:scale-[1.01]">
                           <div className="bg-gradient-to-br from-primary-900 to-indigo-900 rounded-xl p-6 text-white h-full relative overflow-hidden">
                              <div className="absolute -top-6 -right-6 opacity-10 rotate-12">
                                 <Lightbulb className="h-32 w-32" />
                              </div>

                              <div className="relative z-10">
                                 <div className="flex items-center gap-2 mb-2">
                                    <Lightbulb className="h-5 w-5 text-yellow-300" />
                                    <h3 className="font-bold text-lg">Missing a Feature? Tell Us.</h3>
                                 </div>
                                 <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                                    Base16 is built for you. What specific tool or report would make your work easier?
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
                     </div>

                     <div className="w-full lg:w-2/5 space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                           <h3 className="font-bold text-lg text-slate-800 mb-4">Contact Support</h3>
                           <div className="space-y-4">
                              <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                 <div className="bg-green-100 p-2 rounded-full text-green-700 mt-0.5">
                                    <Phone className="h-4 w-4" />
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">WhatsApp Hotline</p>
                                    <p className="font-bold text-slate-800">050 256 0760</p>
                                    <p className="text-xs text-slate-500 mt-1">Available 8am - 5pm (Mon-Fri)</p>
                                 </div>
                              </div>

                              <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                 <div className="bg-blue-100 p-2 rounded-full text-blue-700 mt-0.5">
                                    <Mail className="h-4 w-4" />
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Email Support</p>
                                    <p className="font-bold text-slate-800">sixzonesglobal@gmail.com</p>
                                    <p className="text-xs text-slate-500 mt-1">Response within 24 hours</p>
                                 </div>
                              </div>

                              <a
                                 href="https://wa.me/233502560760"
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
               )}
            </div>
         </div>
      </div>
   );
};

export default HelpCenter;