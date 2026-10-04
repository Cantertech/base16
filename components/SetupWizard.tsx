import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Building2, Palette, Lock, Upload, CheckCircle, CreditCard, Globe } from 'lucide-react';
import { generateMockData } from '../utils/mockDataGenerator';
import { supabase } from '../utils/supabaseClient';
import { uploadToCloudinary } from '../utils/cloudinary';
import { CURRENCIES, CurrencyCode } from '../contexts/CurrencyContext';

interface SetupWizardProps {
  onComplete: (user: any) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    schoolName: '',
    motto: '',
    phone: '',
    color: 'blue', // blue, green, maroon, purple
    logo: null as string | null,
    logoFile: null as File | null,
    adminName: '',
    email: '',
    password: '',
    confirmPassword: '',
    currency: 'GHS' as CurrencyCode
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setFormData({ ...formData, logo: url, logoFile: file });
    }
  };

  const createAccount = async () => {
    setLoading(true);

    try {
      // 1. Upload Logo if exists
      let logoUrl = null;
      if (formData.logoFile) {
        try {
          logoUrl = await uploadToCloudinary(formData.logoFile);
        } catch (uploadError) {
          console.error("Logo upload failed, proceeding without logo", uploadError);
        }
      }

      // 2. Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.adminName,
            role: 'admin',
          },
        },
      });

      console.log('Auth Data:', authData);

      if (authError) throw authError;

      if (authData.user) {
        // Auto-login if session was not returned immediately (since DB trigger pre-confirms account)
        if (!authData.session) {
          await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
        }

        // 3. Create School Record with 'pending' status
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .insert([
            {
              name: formData.schoolName,
              motto: formData.motto,
              phone: formData.phone,
              email: formData.email,
              brand_color: formData.color,
              theme_color: formData.color,
              logo_url: logoUrl,
              status: 'pending', // Initial status awaiting review
              subscription_plan: 'Small School',
              currency: formData.currency,
              sms_balance: 50,
              current_term: 'First Term',
              academic_year: '2025/2026',
            },
          ])
          .select()
          .single();

        if (schoolError) throw schoolError;

        // 4. Create User Profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              full_name: formData.adminName,
              role: 'admin',
              school_id: schoolData.id,
              email: formData.email,
              phone_number: formData.phone
            }
          ]);

        if (profileError) throw profileError;

        // 5. Initialize Default Academic Term so exams/fees work out of the box
        await supabase
          .from('academic_terms')
          .insert([
            {
              school_id: schoolData.id,
              academic_year: '2025/2026',
              term: 'First Term',
              is_current: true,
              is_locked: false,
              total_days: 65
            }
          ]);

        setLoading(false);
        // Move to Step 4 (Registration Complete / Pending Approval)
        setStep(4);
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      alert(`Signup failed: ${error.message}`);
      setLoading(false);
    }
  };

  // Color Mapping for Tailwind
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600',
    green: 'bg-emerald-600',
    maroon: 'bg-red-800',
    purple: 'bg-purple-700'
  };

  // Calculations for Step 4 removed as process is now free

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">

      {/* LEFT SIDE: FORM */}
      <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 overflow-y-auto">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Let's set up your school</h2>
          <p className="text-slate-500 mb-8">Step {step} of 4</p>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-2 rounded-full mb-10">
            <div
              className="bg-primary-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>

          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
                <input
                  name="schoolName"
                  value={formData.schoolName}
                  onChange={handleInputChange}
                  type="text"
                  placeholder="e.g. Morning Star Academy"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Motto</label>
                <input
                  name="motto"
                  value={formData.motto}
                  onChange={handleInputChange}
                  type="text"
                  placeholder="e.g. Excellence in all things"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Official Phone Number</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  type="tel"
                  placeholder="020 123 4567"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2: BRANDING */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">School Logo</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-white hover:border-primary-400 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {formData.logo ? (
                    <img src={formData.logo} alt="Preview" className="h-20 w-20 object-contain mb-2" />
                  ) : (
                    <Upload className="h-10 w-10 text-slate-400 mb-2" />
                  )}
                  <span className="text-sm text-slate-500">{formData.logo ? 'Click to change' : 'Upload Logo'}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">School Currency</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {CURRENCIES.map((curr) => (
                    <div
                      key={curr.code}
                      onClick={() => setFormData({ ...formData, currency: curr.code })}
                      className={`border rounded-lg p-3 cursor-pointer transition-all flex flex-col items-center justify-center text-center ${formData.currency === curr.code
                        ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-200'
                        : 'bg-white border-slate-200 hover:border-primary-300'
                        }`}
                    >
                      <span className="text-xl font-bold text-slate-800 mb-1">{curr.symbol}</span>
                      <span className="text-xs font-medium text-slate-600">{curr.code}</span>
                      <span className="text-[10px] text-slate-400">{curr.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Brand Color</label>
                <div className="grid grid-cols-5 gap-4">
                  {['blue', 'green', 'maroon', 'purple'].map((c) => (
                    <div
                      key={c}
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`h-12 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 ${formData.color === c ? 'ring-4 ring-offset-2 ring-slate-300' : ''
                        }`}
                      style={{
                        backgroundColor: c === 'maroon' ? '#991b1b' : c === 'purple' ? '#7e22ce' : c === 'green' ? '#059669' : '#2563eb'
                      }}
                    >
                      {formData.color === c && <CheckCircle className="text-white h-6 w-6" />}
                    </div>
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                    <div className={`h-12 w-full rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 border-2 border-slate-200 bg-[conic-gradient(at_center,_red,_yellow,_lime,_aqua,_blue,_magenta,_red)] ${!['blue', 'green', 'maroon', 'purple'].includes(formData.color) ? 'ring-4 ring-offset-2 ring-slate-300' : ''}`}>
                      {!['blue', 'green', 'maroon', 'purple'].includes(formData.color) && <CheckCircle className="text-white h-6 w-6 drop-shadow-md" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ADMIN */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleInputChange}
                  type="text"
                  placeholder="e.g. admin"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  type="email"
                  placeholder="admin@school.com"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  type="password"
                  placeholder="••••••••"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:outline-none ${formData.confirmPassword && formData.password !== formData.confirmPassword
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-300 focus:ring-primary-600'
                    }`}
                />
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: REGISTRATION COMPLETE & PENDING APPROVAL */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <div className="bg-green-100 text-green-600 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-green-900 mb-3">Registration Successful!</h3>
                <p className="text-green-800 text-lg mb-6">
                  Your school account has been created and is currently <b>Pending Approval</b>.
                </p>
                <div className="bg-white rounded-lg p-6 border border-green-100 shadow-sm text-left">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary-600" /> What happens next?
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    Our team will review your application. We will contact you shortly <b>within 24 hours</b> to assist you with the onboarding process.
                  </p>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                      While you wait, you can prepare your student data for import. Access is completely free.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-10 flex justify-between items-center">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center text-slate-500 hover:text-slate-800 font-medium px-4 py-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </button>
            ) : (
              <div></div> // Spacer
            )}

            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 3) {
                    createAccount();
                  } else {
                    setStep(step + 1);
                  }
                }}
                disabled={
                  (step === 1 && !formData.schoolName) ||
                  (step === 3 && (!formData.adminName || !formData.email || !formData.password || formData.password !== formData.confirmPassword)) ||
                  loading
                }
                className="bg-primary-900 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : step === 3 ? 'Create Account' : 'Next Step'}
                {!loading && <ArrowRight className="h-5 w-5 ml-2" />}
              </button>
            ) : (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
                className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-slate-700 transition-all"
              >
                Go to Login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: PREVIEW */}
      <div className="hidden md:flex w-1/2 bg-slate-100 items-center justify-center p-12 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        <div className="relative w-full max-w-lg">
          <div className="mb-6 text-center">
            <h3 className="text-slate-400 font-semibold uppercase tracking-widest text-sm">Live Preview</h3>
          </div>

          {/* Mock Dashboard Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transform rotate-1 transition-all duration-500 hover:rotate-0">
            {/* Header Preview */}
            <div
              className={`${colorMap[formData.color] ? colorMap[formData.color] : ''} p-6 text-white transition-colors duration-300`}
              style={{ backgroundColor: !colorMap[formData.color] ? formData.color : undefined }}
            >
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden border-2 border-white/30">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-8 w-8 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{formData.schoolName || 'Your School Name'}</h2>
                  <p className="text-white/80 text-sm italic">{formData.motto || 'Your Motto Here'}</p>
                </div>
              </div>
            </div>

            {/* Body Preview */}
            <div className="p-6 bg-slate-50 min-h-[200px] flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="h-24 w-1/2 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                  <div className="h-2 w-8 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-slate-100 rounded mb-1"></div>
                  <div className="h-2 w-24 bg-green-100 rounded"></div>
                </div>
                <div className="h-24 w-1/2 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                  <div className="h-2 w-8 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-slate-100 rounded mb-1"></div>
                  <div className="h-2 w-24 bg-red-100 rounded"></div>
                </div>
              </div>
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col gap-2">
                <div className="h-2 w-1/3 bg-slate-200 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default SetupWizard;