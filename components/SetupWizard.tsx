import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Building2, Palette, Lock, Upload, CheckCircle, Tag, CreditCard, Globe } from 'lucide-react';
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
    referralCode: '',
    color: 'blue', // blue, green, maroon, purple
    logo: null as string | null,
    logoFile: null as File | null,
    adminName: '',
    email: '',
    password: '',
    confirmPassword: '',
    currency: 'GHS' as CurrencyCode
  });

  // Validation State for Referral
  const [referralStatus, setReferralStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Reset referral status if they type in the code box
    if (e.target.name === 'referralCode') setReferralStatus('none');
  };

  const validateReferral = async () => {
    if (!formData.referralCode) return;

    try {
      const { data, error } = await supabase.rpc('check_referral_code', { p_code: formData.referralCode });
      if (data) {
        setReferralStatus('valid');
      } else {
        setReferralStatus('invalid');
      }
    } catch (error) {
      console.error("Referral check failed", error);
      setReferralStatus('invalid');
    }
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
        // Check if session exists (if not, email confirmation might be required)
        if (!authData.session) {
          console.warn('User created but no session. Email confirmation likely required.');
          alert('Account created! Please check your email to confirm your account before we can set up your school.');
          setLoading(false);
          return;
        }

        // 3. Create School Record with 'pending' status
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .insert([
            {
              name: formData.schoolName,
              motto: formData.motto,
              phone: formData.phone,
              brand_color: formData.color,
              logo_url: logoUrl,
              admin_id: authData.user.id,
              referral_code_used: referralStatus === 'valid' ? formData.referralCode : null,
              referral_code: `SZO-${Math.floor(Math.random() * 900 + 100)}`,
              status: 'pending', // Initial status
              subscription_plan: 'Small School', // Default plan
              currency: formData.currency
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
              email: formData.email
            }
          ]);

        if (profileError) throw profileError;

        // 5. Process Referral Reward (if applicable)
        if (referralStatus === 'valid' && formData.referralCode) {
          await supabase.rpc('process_referral', {
            p_referral_code: formData.referralCode,
            p_new_school_id: schoolData.id,
            p_new_school_name: formData.schoolName
          });
        }

        setLoading(false);
        // Move to Step 4 (Billing/Pending)
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

  // Calculations for Step 4
  const setupFee = 400;
  const discount = referralStatus === 'valid' ? 100 : 0;
  const subscriptionFee = 200;
  const totalDue = setupFee - discount + subscriptionFee;

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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referral Code (Optional)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleInputChange}
                      onBlur={validateReferral}
                      type="text"
                      placeholder="Enter code"
                      className={`w-full pl-9 pr-3 py-3 border rounded-lg focus:ring-2 outline-none ${referralStatus === 'valid' ? 'border-green-500 focus:ring-green-200' :
                        referralStatus === 'invalid' ? 'border-red-500 focus:ring-red-200' :
                          'border-slate-300 focus:ring-primary-600'
                        }`}
                    />
                  </div>
                  {/* Validation Message */}
                </div>
                {referralStatus === 'valid' && (
                  <p className="text-green-600 text-xs mt-1 flex items-center gap-1 font-bold">
                    <CheckCircle className="h-3 w-3" /> Code accepted! You qualify for a GH¢ 100 Setup Discount.
                  </p>
                )}
                {referralStatus === 'invalid' && (
                  <p className="text-red-600 text-xs mt-1">Invalid referral code.</p>
                )}
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

          {/* STEP 4: BILLING & PENDING STATUS (NEW) */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-800 mb-2">Account Created Successfully!</h3>
                <p className="text-green-700">
                  Your school account has been created and is currently <b>Pending Approval</b>.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800">Complete Payment to Activate</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">One-time Setup Fee</span>
                    <div className="text-right">
                      {referralStatus === 'valid' && (
                        <span className="block text-xs text-red-400 line-through">GH¢ {setupFee.toFixed(2)}</span>
                      )}
                      <span className="font-bold text-slate-800">GH¢ {(setupFee - discount).toFixed(2)}</span>
                    </div>
                  </div>
                  {referralStatus === 'valid' && (
                    <div className="flex justify-between items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> Referral Discount</span>
                      <span className="font-bold">- GH¢ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">First Month Subscription (Small School)</span>
                    <span className="font-bold text-slate-800">GH¢ {subscriptionFee.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Total Due Today</span>
                    <span className="font-bold text-2xl text-primary-700">GH¢ {totalDue.toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-6 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-2">Payment Instructions:</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    Please send the total amount to the following Mobile Money number:
                  </p>
                  <div className="bg-white border border-slate-200 p-3 rounded-lg font-mono text-center font-bold text-lg mb-4">
                    0502560760
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Use your School Name as the Reference. Your account will be activated within 24 hours of payment confirmation.
                  </p>
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