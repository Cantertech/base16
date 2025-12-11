import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Building2, Palette, Lock, Upload, CheckCircle, Tag, CreditCard } from 'lucide-react';
import { generateMockData } from '../utils/mockDataGenerator';

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
    adminName: '',
    password: ''
  });

  // Validation State for Referral
  const [referralStatus, setReferralStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Reset referral status if they type in the code box
    if (e.target.name === 'referralCode') setReferralStatus('none');
  };

  const validateReferral = () => {
    if (!formData.referralCode) return;
    // Mock Validation: Code must be > 3 chars
    if (formData.referralCode.length > 3) {
        setReferralStatus('valid');
    } else {
        setReferralStatus('invalid');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setFormData({ ...formData, logo: url });
    }
  };

  const finishSetup = () => {
    setLoading(true);
    // Simulate processing delay for effect
    setTimeout(() => {
      // 1. Run Mock Engine & Get Generated Referral Data
      // This generates the code THIS school will own
      const mockData = generateMockData(formData.schoolName);

      // 2. Save Config
      localStorage.setItem('schoolhub_config', JSON.stringify({
        name: formData.schoolName,
        motto: formData.motto,
        color: formData.color,
        logo: formData.logo,
        admin: formData.adminName,
        password: formData.password,
        // Save the code this school USED to sign up (for internal analytics)
        usedReferralCode: referralStatus === 'valid' ? formData.referralCode : null,
        // Save the code this school OWNS (to refer others)
        referralCode: mockData.referralCode, 
        referralPreference: mockData.referralPreference
      }));

      setLoading(false);
      
      // 3. Auto Login as Admin
      onComplete({
        name: formData.adminName,
        role: 'admin',
        photo: formData.logo
      });
    }, 2000);
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
  const subscriptionFee = 250;
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
                        className={`w-full pl-9 pr-3 py-3 border rounded-lg focus:ring-2 outline-none ${
                            referralStatus === 'valid' ? 'border-green-500 focus:ring-green-200' :
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
                <label className="block text-sm font-medium text-slate-700 mb-3">Brand Color</label>
                <div className="grid grid-cols-4 gap-4">
                  {['blue', 'green', 'maroon', 'purple'].map((c) => (
                    <div 
                      key={c}
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`h-12 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 ${
                        formData.color === c ? 'ring-4 ring-offset-2 ring-slate-300' : ''
                      }`}
                      style={{ 
                        backgroundColor: c === 'maroon' ? '#991b1b' : c === 'purple' ? '#7e22ce' : c === 'green' ? '#059669' : '#2563eb' 
                      }}
                    >
                      {formData.color === c && <CheckCircle className="text-white h-6 w-6" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ADMIN */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Headmaster / Admin Name</label>
                <input
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleInputChange}
                  type="text"
                  placeholder="Mr. John Doe"
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
            </div>
          )}

          {/* STEP 4: SUMMARY & PAYMENT (NEW) */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-slate-500" />
                        <h3 className="font-bold text-slate-800">Billing Summary</h3>
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
                            <span className="text-slate-600">First Month Subscription</span>
                            <span className="font-bold text-slate-800">GH¢ {subscriptionFee.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">Total Due Today</span>
                            <span className="font-bold text-2xl text-primary-700">GH¢ {totalDue.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <p className="text-xs text-center text-slate-400">
                    By clicking Complete Setup, you verify that the school details provided are accurate. 
                    <br/>(Mock Payment Process)
                </p>
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
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !formData.schoolName}
                className="bg-primary-900 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 3 ? 'Review & Pay' : 'Next Step'} <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            ) : (
              <button 
                onClick={finishSetup}
                disabled={loading}
                className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Complete Setup'} 
                {!loading && <CheckCircle className="h-5 w-5 ml-2" />}
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
            <div className={`${colorMap[formData.color] || 'bg-primary-900'} p-6 text-white transition-colors duration-300`}>
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
    </div>
  );
};

export default SetupWizard;