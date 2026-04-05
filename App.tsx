
import React, { useState, useEffect } from 'react';
import { User, UserRole, PredictionResult, Language } from './types';
import { supabase } from './services/supabase';
import { localStore } from './services/storage';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import PredictionResultView from './pages/PredictionResultView';
import History from './pages/History';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AdminPanel from './pages/AdminPanel';
import DoctorDashboard from './pages/DoctorDashboard';
import About from './pages/About';
import Profile from './pages/Profile';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [user, setUser] = useState<User | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.ENGLISH);
  const [activeResult, setActiveResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const mapSupabaseUser = (sbUser: any): User | null => {
    if (!sbUser) return null;
    return {
      id: sbUser.id,
      email: sbUser.email || '',
      name: sbUser.user_metadata?.name || 'User',
      role: (sbUser.user_metadata?.role as UserRole) || UserRole.USER,
      createdAt: sbUser.created_at,
      preferredLanguage: sbUser.user_metadata?.language as Language
    };
  };

  const handleLanguageChange = async (lang: Language) => {
    setSelectedLanguage(lang);
    if (user) {
      await supabase.auth.updateUser({
        data: { language: lang }
      });
      setUser({ ...user, preferredLanguage: lang });
    }
  };

  const fetchHistory = async (userId: string) => {
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Handle missing table error (PGRST205) by falling back to local storage
        if ((error as any).code === 'PGRST205') {
          // Use a more subtle log for expected missing table
          console.info("Predictions table not found in Supabase. Using local storage mode.");
          const localData = localStore.getPredictions().filter(p => p.userId === userId);
          setHistory(localData);
          return;
        }
        throw error;
      }
      
      if (data) {
        const formattedData: PredictionResult[] = data.map(item => ({
          id: item.id,
          userId: item.user_id,
          timestamp: item.created_at,
          imageUrl: item.image_url,
          risks: item.risks,
          overallSummary: item.overall_summary,
          status: item.status,
          language: item.language,
          userReportedSymptoms: item.user_reported_symptoms
        }));
        setHistory(formattedData);
      }
    } catch (err) {
      console.info("Could not fetch history from Supabase, trying local storage");
      const localData = localStore.getPredictions().filter(p => p.userId === userId);
      setHistory(localData);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    // Global error handler for unhandled rejections (like Supabase fetch failures)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Promise Rejection:", event.reason);
      if (event.reason?.message?.includes('Refresh Token')) {
        supabase.auth.signOut();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Initial check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session retrieval error:", error);
        // If the session is invalid or refresh token is missing/expired, 
        // sign out to clear the stale local session
        if (error.message.includes('Refresh Token') || error.message.includes('not found')) {
          supabase.auth.signOut();
        }
      }
      const u = mapSupabaseUser(session?.user);
      setUser(u);
      if (u) {
        fetchHistory(u.id);
        // On app mount with existing session, we respect the user's preferred language
        if (u.preferredLanguage) {
          setSelectedLanguage(u.preferredLanguage);
        }
      }
      setIsLoading(false);
    }).catch(err => {
      console.error("Unexpected session error:", err);
      if (err.message === 'Failed to fetch') {
        // This usually means Supabase is unreachable. 
        // We'll let the app load in offline/local mode.
        console.warn("Supabase unreachable. App will operate in local mode.");
      }
      setIsLoading(false);
    });

    // Event listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = mapSupabaseUser(session?.user);
      
      if (event === 'SIGNED_IN') {
        // Respect the language already selected in the UI if it was changed on login/signup page
        // or use the user's preferred language from metadata
        const preferredLang = u?.preferredLanguage;
        if (preferredLang && preferredLang !== selectedLanguage) {
          setSelectedLanguage(preferredLang);
        }
        setUser(u);
        if (u) fetchHistory(u.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setHistory([]);
        // Keep current language on sign out instead of resetting to English
      } else if (u) {
        setUser(u);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      subscription.unsubscribe();
    };
  }, []);

  const navigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const addResult = (result: PredictionResult) => {
    setHistory(prev => [result, ...prev]);
    setActiveResult(result);
    setCurrentPage('result');
  };

  const deleteResult = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', id);

      if (error) {
        if ((error as any).code === 'PGRST205') {
          localStore.deletePrediction(id);
        } else {
          throw error;
        }
      }
      
      setHistory(prev => prev.filter(item => item.id !== id));
      if (activeResult?.id === id) {
        setActiveResult(null);
        navigate('dashboard');
      }
    } catch (err) {
      console.error("Error deleting result:", err);
      // Even if Supabase fails, we remove it from local state and local storage for responsiveness
      localStore.deletePrediction(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      if (activeResult?.id === id) {
        setActiveResult(null);
        navigate('dashboard');
      }
    }
  };

  const shareResult = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('predictions')
        .update({ is_shared_with_specialist: true })
        .eq('id', id);

      if (error) {
        if ((error as any).code === 'PGRST205') {
          localStore.updatePrediction(id, { isSharedWithSpecialist: true });
        } else {
          throw error;
        }
      }
      
      setHistory(prev => prev.map(item => item.id === id ? { ...item, isSharedWithSpecialist: true } : item));
      if (activeResult?.id === id) {
        setActiveResult({ ...activeResult, isSharedWithSpecialist: true });
      }
    } catch (err) {
      console.error("Error sharing result:", err);
      localStore.updatePrediction(id, { isSharedWithSpecialist: true });
      setHistory(prev => prev.map(item => item.id === id ? { ...item, isSharedWithSpecialist: true } : item));
      if (activeResult?.id === id) {
        setActiveResult({ ...activeResult, isSharedWithSpecialist: true });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const bypassLogin = () => {
    const mockUser: User = {
      id: 'demo-user-id',
      email: 'demo@smartai.com',
      name: 'Demo User',
      role: UserRole.USER,
      createdAt: new Date().toISOString(),
      preferredLanguage: Language.ENGLISH
    };
    setUser(mockUser);
    setCurrentPage('dashboard');
    fetchHistory(mockUser.id);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home onGetStarted={() => navigate(user ? 'dashboard' : 'login')} language={selectedLanguage} />;
      case 'about': return <About language={selectedLanguage} />;
      case 'login': return <Login onNavigate={navigate} language={selectedLanguage} onLanguageChange={handleLanguageChange} onBypass={bypassLogin} />;
      case 'register': return <Register onNavigate={navigate} language={selectedLanguage} onLanguageChange={handleLanguageChange} />;
      case 'dashboard': 
        if (user?.role === UserRole.DOCTOR) return <DoctorDashboard history={history} language={selectedLanguage} onNavigate={navigate} />;
        if (user?.role === UserRole.ADMIN) return <AdminPanel language={selectedLanguage} onNavigate={navigate} />;
        return <Dashboard user={user} history={history} onNavigate={navigate} isLoading={isHistoryLoading} onDelete={deleteResult} language={selectedLanguage} onLanguageChange={handleLanguageChange} />;
      case 'upload': return <Upload user={user} language={selectedLanguage} onLanguageChange={handleLanguageChange} onResult={addResult} onNavigate={navigate} />;
      case 'result': return <PredictionResultView result={activeResult} onNavigate={navigate} onDelete={deleteResult} onShare={shareResult} language={selectedLanguage} onLanguageChange={handleLanguageChange} />;
      case 'history': return <History history={history} isLoading={isHistoryLoading} onViewResult={(r) => { setActiveResult(r); navigate('result'); }} onDelete={deleteResult} language={selectedLanguage} />;
      case 'profile': return <Profile user={user} onUpdate={(updatedUser) => setUser(updatedUser)} onLanguageChange={handleLanguageChange} selectedLanguage={selectedLanguage} />;
      case 'admin': return <AdminPanel language={selectedLanguage} onNavigate={navigate} />;
      case 'doctor': return <DoctorDashboard history={history} language={selectedLanguage} onNavigate={navigate} />;
      default: return <Home onGetStarted={() => navigate(user ? 'dashboard' : 'login')} language={selectedLanguage} />;
    }
  };

  return (
    <div className={`flex flex-col min-h-screen ${isMobile ? 'pb-20' : ''}`}>
      {!isMobile && (
        <Navbar 
          user={user} 
          onNavigate={navigate} 
          onLogout={() => supabase.auth.signOut()} 
          currentPage={currentPage}
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
        />
      )}
      
      <main className={`flex-grow ${!isMobile ? 'pt-20' : 'pt-4'}`}>
        {renderPage()}
      </main>

      {isMobile && user && (
        <BottomNav 
          currentPage={currentPage} 
          onNavigate={navigate} 
          role={user.role}
          language={selectedLanguage}
        />
      )}
    </div>
  );
};

export default App;
