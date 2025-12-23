import React, { useState, useEffect } from 'react';
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
import { supabase } from './utils/supabaseClient';

type ViewState = 'landing' | 'wizard' | 'dashboard' | 'login' | 'demo';

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

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
            setView('dashboard');
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
        setView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <Loading fullScreen message="Initializing Orbit System..." />;
  }

  const handleStartWizard = () => {
    setView('wizard');
    window.scrollTo(0, 0);
  };

  const handleBookDemo = () => {
    setView('demo');
    window.scrollTo(0, 0);
  };

  const handleCompleteWizard = (adminUser: User) => {
    // Auto login after setup
    setCurrentUser(adminUser);
    setView('dashboard');
    window.scrollTo(0, 0);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setView('dashboard');
    window.scrollTo(0, 0);
  };

  const handleLogout = async () => {
    // Clear all cached data to prevent data leakage between sessions
    sessionStorage.clear();
    // Also explicitly clear cache keys to be safe
    sessionStorage.removeItem('orbit_teachers_data');
    sessionStorage.removeItem('orbit_classes_data');
    sessionStorage.removeItem('orbit_subjects_data');
    await supabase.auth.signOut();
    setCurrentUser(null);
    setView('login');
    window.scrollTo(0, 0);
  };

  return (
    <CurrencyProvider>
      {view === 'dashboard' && currentUser ? (
        currentUser.role === 'super_admin' ? (
          <SuperAdminDashboard onLogout={handleLogout} />
        ) : (
          <Dashboard onLogout={handleLogout} currentUser={currentUser} />
        )
      ) : view === 'login' ? (
        <Login
          onLogin={handleLogin}
          onCancel={() => setView('landing')}
        />
      ) : view === 'demo' ? (
        <BookDemo onBack={() => setView('landing')} />
      ) : view === 'wizard' ? (
        <div>
          {/* Minimal Navbar for Wizard (no links) */}
          <Navbar onNavigateHome={() => setView('landing')} showLinks={false} />
          <div className="pt-16">
            <SetupWizard onComplete={handleCompleteWizard} />
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
          <Navbar
            onNavigateHome={() => setView('landing')}
            onNavigateLogin={() => setView('login')}
            onBookDemo={handleBookDemo}
            showLinks={true}
          />
          <main>
            <Hero onStartWizard={handleStartWizard} />
            <WhyUs />
            <Features />
            <Pricing />
          </main>
          <Footer />
        </div>
      )}
    </CurrencyProvider>
  );
};

export default App;