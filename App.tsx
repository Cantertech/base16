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

type ViewState = 'landing' | 'wizard' | 'dashboard' | 'login' | 'demo';

interface User {
  name: string;
  role: 'admin' | 'teacher';
  photo?: string | null;
  subject?: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Check if user is already setup on load
  useEffect(() => {
    // For this demo, we won't auto-login from reload to allow showing the login screen.
    const isSetup = localStorage.getItem('schoolhub_setup_complete');
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

  const handleLogout = () => {
    setCurrentUser(null);
    setView('landing');
    window.scrollTo(0, 0);
  };

  if (view === 'dashboard' && currentUser) {
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