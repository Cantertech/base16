import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { CurrencyProvider } from './contexts/CurrencyContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import WhyUs from './components/WhyUs';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import BookDemo from './components/BookDemo';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import Loading from './components/Loading';
import About from './components/About';
import Contact from './components/Contact';
import Legal from './components/Legal';
import { supabase } from './utils/supabaseClient';

interface User {
  id: string;
  school_id: string;
  name: string;
  role: 'admin' | 'teacher' | 'super_admin';
  photo?: string | null;
  schoolLogo?: string | null;
  subject?: string;
  assignedClass?: string | null;
}

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is already setup on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Fetch profile to get role
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            let schoolLogo = null;
            if (profile.school_id) {
              const { data: school } = await supabase
                .from('schools')
                .select('logo_url')
                .eq('id', profile.school_id)
                .single();
              schoolLogo = school?.logo_url;
            }

            const user: User = {
              id: profile.id,
              school_id: profile.school_id,
              name: profile.name,
              role: profile.role as 'admin' | 'teacher' | 'super_admin',
              photo: null,
              schoolLogo: schoolLogo,
              subject: profile.subject,
              assignedClass: null // Default
            };

            if (user.role === 'teacher') {
              const { data: teacherData } = await supabase
                .from('teachers')
                .select('assigned_class')
                .eq('id', user.id)
                .single();
              if (teacherData) {
                user.assignedClass = teacherData.assigned_class;
              }
            }

            setCurrentUser(user);
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    sessionStorage.clear();
    sessionStorage.removeItem('orbit_teachers_data');
    sessionStorage.removeItem('orbit_classes_data');
    sessionStorage.removeItem('orbit_subjects_data');
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate('/login');
  };

  const handleCompleteWizard = (adminUser: User) => {
    setCurrentUser(adminUser);
    navigate('/dashboard');
  };

  if (loading) {
    return <Loading fullScreen message="Initializing Orbit System..." />;
  }

  return (
    <CurrencyProvider>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar />
            <main>
              <Hero onStartWizard={() => navigate('/setup')} />
              <WhyUs />
              <Features />
              <Pricing />
            </main>
            <Footer />
          </div>
        } />

        <Route path="/features" element={
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar />
            <main className="pt-16">
              <Features />
            </main>
            <Footer />
          </div>
        } />

        <Route path="/pricing" element={
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar />
            <main className="pt-16">
              <Pricing />
            </main>
            <Footer />
          </div>
        } />

        <Route path="/about" element={
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar />
            <main className="pt-16">
              <About />
            </main>
            <Footer />
          </div>
        } />

        <Route path="/contact" element={
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar />
            <main className="pt-16">
              <Contact />
            </main>
            <Footer />
          </div>
        } />

        <Route path="/legal" element={
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar />
            <main className="pt-16">
              <Legal />
            </main>
            <Footer />
          </div>
        } />

        <Route path="/demo" element={<BookDemo onBack={() => navigate('/')} />} />

        <Route path="/login" element={
          currentUser ? <Navigate to="/dashboard" /> :
            <Login onLogin={handleLogin} onCancel={() => navigate('/')} />
        } />

        <Route path="/setup" element={
          <div>
            <Navbar showLinks={false} />
            <div className="pt-16">
              <SetupWizard onComplete={handleCompleteWizard} />
            </div>
          </div>
        } />

        {/* Protected Routes */}
        <Route path="/dashboard/*" element={
          currentUser ? (
            currentUser.role === 'super_admin' ? (
              <SuperAdminDashboard onLogout={handleLogout} />
            ) : (
              <Dashboard onLogout={handleLogout} currentUser={currentUser} />
            )
          ) : (
            <Navigate to="/login" />
          )
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </CurrencyProvider>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;