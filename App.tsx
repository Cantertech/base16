import React, { useState, useEffect } from 'react';
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
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Check if user is already setup on load
  useEffect(() => {
    const checkSession = async () => {
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
            subject: profile.subject
          };

          setCurrentUser(user);
          setView('dashboard');
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setCurrentUser(null);
        setView('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    await supabase.auth.signOut();
    setCurrentUser(null);
    setView('landing');
    window.scrollTo(0, 0);
  };

  if (view === 'dashboard' && currentUser) {
    if (currentUser.role === 'super_admin') {
      return <SuperAdminDashboard onLogout={handleLogout} />;
    }
    return <Dashboard onLogout={handleLogout} currentUser={currentUser} />;
  }

  if (view === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onCancel={() => setView('landing')}
      />
    );
  }

  if (view === 'demo') {
    return <BookDemo onBack={() => setView('landing')} />;
  }

  if (view === 'wizard') {
    return (
      <div>
        {/* Minimal Navbar for Wizard (no links) */}
        <Navbar onNavigateHome={() => setView('landing')} showLinks={false} />
        <div className="pt-16">
          <SetupWizard onComplete={handleCompleteWizard} />
        </div>
      </div>
    );
  }

  return (
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
  );
};

export default App;