import React, { useState } from 'react';
import { Lock, User, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { generateMockData } from '../utils/mockDataGenerator';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';

interface LoginProps {
  onLogin: (user: any) => void;
  onCancel: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onCancel }) => {
  const [role, setRole] = useState<'admin' | 'teacher'>('admin');
  const [email, setEmail] = useState(''); // Used as 'Username' for admin, 'Email' for teacher
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let loginEmail = email.trim();
    const loginPass = password;

    try {
      // 0. Resolve Phone number or Username to Email (handles 024XXXXXXX or 'silas')
      if (!loginEmail.includes('@')) {
        try {
          const { data: resolvedEmail } = await supabase.rpc('resolve_login_identifier', {
            p_identifier: loginEmail
          });
          if (resolvedEmail) {
            loginEmail = resolvedEmail;
          }
        } catch (resolveErr) {
          console.warn('Could not resolve phone number identifier:', resolveErr);
        }
      }

      // Fallback for silas shortcut
      if (loginEmail.toLowerCase() === 'silas' && password === 'silas@222') {
        loginEmail = 'silas@base16.com';
      }

      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPass,
      });

      if (authError) {
        // Special handling for the 'silas' super admin account if it doesn't exist yet
        // AUTO-CREATION DISABLED FOR SECURITY
        /*
        if (loginEmail === 'silas@base16.com' && authError.message.includes('Invalid login credentials')) {
           // ... auto creation logic removed ...
        }
        */
        throw authError; // Throw original error if not the special case
      }

      if (authData.user) {
        // 2. Fetch User Profile to get Role and Details
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, schools!school_id(name, logo_url, status)')
          .eq('id', authData.user.id)
          .single();

        // Handle missing profile for 'silas' specifically (robustness)
        if (profileError && loginEmail === 'silas@base16.com') {
          console.log("Profile missing for Silas, creating...");
          await supabase.from('profiles').upsert({
            id: authData.user.id,
            email: loginEmail,
            full_name: 'Silas (Super Admin)',
            role: 'super_admin'
          });
          // Recursive call or manual set? Manual set is safer to avoid infinite loops
          onLogin({
            id: authData.user.id,
            name: 'Silas (Super Admin)',
            role: 'super_admin',
            email: loginEmail,
            photo: null,
            school_id: null,
            isFirstLogin: false
          });
          setLoading(false);
          return;
        }

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          throw new Error("User profile not found.");
        }

        // 3. Automatically use user's actual role from profile
        const userRole = profileData.role || role;

        let assignedClass = null;
        if (userRole === 'teacher') {
          try {
            const { data: assignData } = await supabase
              .from('teacher_assignments')
              .select('classes:class_id(name), is_class_teacher')
              .eq('teacher_id', authData.user.id)
              .eq('is_class_teacher', true);
            if (assignData && assignData.length > 0) {
              const primary = assignData[0];
              const cls: any = primary?.classes;
              assignedClass = Array.isArray(cls) ? cls[0]?.name : cls?.name;
            }
          } catch (_) {}
        }

        // 4. Check School Status (for Admins and Teachers)
        if (userRole === 'admin' || userRole === 'teacher') {
          if (profileData.schools?.status === 'suspended') {
            throw new Error("Your school account has been suspended. Please contact administration.");
          } else if (profileData.schools?.status === 'pending') {
            throw new Error("Your school account is pending approval. We are reviewing your registration and will activate your portal shortly.");
          }
        }

        let isFirstLogin = false;

        // 5. Success
        onLogin({
          id: authData.user.id,
          name: profileData.full_name,
          role: userRole,
          email: authData.user.email,
          photo: null,
          school_id: profileData.school_id,
          schoolLogo: profileData.schools?.logo_url,
          schoolName: profileData.schools?.name,
          assignedClass: assignedClass,
          isFirstLogin: isFirstLogin
        });
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">

        {/* Header */}
        <div className="bg-primary-900 p-8 text-center relative">
          <button
            onClick={onCancel}
            className="absolute left-4 top-4 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="bg-white/10 w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 p-2">
            <img src="/orbit_transparent_white_logo.png" alt="Base16 Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-blue-200 text-sm mt-1">Sign in to access your dashboard</p>
        </div>

        {/* Role Toggle */}
        <div className="flex p-2 m-6 bg-slate-100 rounded-xl">
          <button
            onClick={() => { setRole('admin'); setError(''); setEmail(''); setPassword(''); }}
            className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all ${role === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Admin
          </button>
          <button
            onClick={() => { setRole('teacher'); setError(''); setEmail(''); setPassword(''); }}
            className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all ${role === 'teacher' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <User className="h-4 w-4 mr-2" />
            Teacher
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email or Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-shadow"
                placeholder="Email or Phone Number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-shadow"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-900 text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-800 transition-transform active:scale-95 disabled:opacity-70 disabled:scale-100 shadow-lg"
          >
            {loading ? 'Authenticating...' : `Login as ${role === 'admin' ? 'Admin' : 'Teacher'}`}
          </button>
        </form>
      </div>
      {loading && <Loading fullScreen message="Authenticating..." />}
    </div>
  );
};

export default Login;