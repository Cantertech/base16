import React, { useState } from 'react';
import { GraduationCap, Lock, User, ShieldCheck, ArrowLeft, Eye, EyeOff, Sparkles } from 'lucide-react';
import { generateMockData } from '../utils/mockDataGenerator';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate network delay
    setTimeout(() => {
      if (role === 'admin') {
        const configStr = localStorage.getItem('schoolhub_config');
        
        // --- DEMO ACCESS HANDLER ---
        // If no school is set up, allow "admin" / "admin123" to create a demo school instantly.
        if (!configStr) {
            if (email.toLowerCase() === 'admin' && (password === 'admin123' || password === 'password123')) {
                const demoConfig = {
                    name: 'Demo International School',
                    motto: 'Knowledge is Power',
                    color: 'blue',
                    logo: null,
                    admin: 'Mr. Demo Admin',
                    password: 'password123'
                };
                
                // Save demo config
                localStorage.setItem('schoolhub_config', JSON.stringify(demoConfig));
                
                // Generate detailed mock data
                generateMockData(demoConfig.name);
                
                onLogin({ name: demoConfig.admin, role: 'admin', photo: null });
                return;
            }
            
            setError('No school setup found. For instant demo access, use Username: "admin" and Password: "admin123"');
            setLoading(false);
            return;
        }

        const config = JSON.parse(configStr);
        // Admin Login Logic
        // In a real app, we'd use ID/Username. Here we match the Admin Name or "admin"
        if (
          (email.toLowerCase() === config.admin.toLowerCase() || email.toLowerCase() === 'admin') && 
          password === config.password
        ) {
          onLogin({ name: config.admin, role: 'admin', photo: config.logo });
        } else {
          setError('Invalid Administrator credentials.');
        }
      } else {
        // Teacher Login Logic
        
        // --- SPECIFIC MOCK CREDENTIAL REQUEST ---
        if (email === 'teacher' && password === 'teacher123') {
             // Ensure mock data exists
             if (!localStorage.getItem('schoolhub_students')) {
                 generateMockData('Orbit Academy');
             }
             
             onLogin({ 
                 name: 'Mr. Solomon Opoku', 
                 role: 'teacher', 
                 subject: 'Mathematics, Science',
                 assignedClass: 'JHS 1', // Primary class
                 classes: ['JHS 1 - Mathematics', 'Primary 6 - Science'] // For the dashboard card
             });
             setLoading(false);
             return;
        }

        const teachersStr = localStorage.getItem('schoolhub_teachers');
        if (!teachersStr) {
             if (email.toLowerCase() === 'demo@school.com' && password === 'password123') {
                 generateMockData('Demo School');
                 onLogin({ name: 'Mr. Demo Teacher', role: 'teacher', subject: 'Science', assignedClass: 'JHS 1' });
                 return;
             }

            setError('No teachers found. Please setup the school as Admin first.');
            setLoading(false);
            return;
        }
        const teachers = JSON.parse(teachersStr);
        const teacher = teachers.find((t: any) => t.email.toLowerCase() === email.toLowerCase() && t.password === password);
        
        if (teacher) {
            onLogin({ 
                name: teacher.name, 
                role: 'teacher', 
                subject: teacher.subject,
                assignedClass: teacher.assignedClass
            });
        } else {
            setError('Invalid email or password.');
        }
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-primary-900 p-8 text-center relative">
          <button 
            onClick={onCancel}
            className="absolute left-4 top-4 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="bg-white/10 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-blue-200 text-sm mt-1">Sign in to access your dashboard</p>
        </div>

        {/* Role Toggle */}
        <div className="flex p-2 m-6 bg-slate-100 rounded-xl">
          <button
            onClick={() => { setRole('admin'); setError(''); setEmail(''); setPassword(''); }}
            className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all ${
              role === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Admin
          </button>
          <button
            onClick={() => { setRole('teacher'); setError(''); setEmail(''); setPassword(''); }}
            className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all ${
              role === 'teacher' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
              {role === 'admin' ? 'Admin Name or "admin"' : 'School Email / Username'}
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
                placeholder={role === 'admin' ? 'Try: admin' : 'e.g. teacher'}
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

          {/* Demo Hint */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm">
             <div className="flex items-center gap-2 text-blue-800 font-bold mb-1">
                <Sparkles className="h-4 w-4" />
                <span>Demo Access</span>
             </div>
             {role === 'admin' ? (
                <p className="text-blue-700">User: <b>admin</b> | Pass: <b>admin123</b></p>
             ) : (
                <p className="text-blue-700">User: <b>teacher</b> | Pass: <b>teacher123</b></p>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;