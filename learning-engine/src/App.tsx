import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Brain, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  Play, 
  Sparkles
} from 'lucide-react';
import { supabase } from './utils/supabaseClient';

// Syllabus Mock Data (Can be linked/fetched from Supabase database)
const SYLLABUS_SUBJECTS = [
  { 
    id: 'core_math', 
    name: 'Core Mathematics', 
    questionsCount: 450, 
    chapters: ['Algebra & Functions', 'Trigonometry', 'Coordinate Geometry', 'Statistics & Probability', 'Calculus Basics'],
    color: 'blue'
  },
  { 
    id: 'int_science', 
    name: 'Integrated Science', 
    questionsCount: 380, 
    chapters: ['Life Cycles & Genetics', 'Physical Science', 'Chemical Substances', 'Ecological Systems', 'Agriculture & Soil'],
    color: 'emerald'
  },
  { 
    id: 'english_lang', 
    name: 'English Language', 
    questionsCount: 520, 
    chapters: ['Grammar & Structure', 'Comprehension & Inference', 'Essay Composition Rules', 'Summary Writing', 'Oral English Phonetics'],
    color: 'violet'
  },
  { 
    id: 'social_studies', 
    name: 'Social Studies', 
    questionsCount: 300, 
    chapters: ['Our Environment', 'Governance & Democracy', 'Socio-Economic Development', 'Culture & National Identity'],
    color: 'amber'
  }
];

// Sample Quiz Questions for testing (mock data fallback)
const SAMPLE_QUESTIONS = [
  {
    id: 1,
    subject: 'core_math',
    question: 'Solve for x in the equation: 3^(2x - 1) = 27',
    options: ['x = 1', 'x = 2', 'x = 3', 'x = 4'],
    correctAnswer: 1, // index 1 (x = 2)
    explanation: 'Write 27 as base 3: 27 = 3^3. Equating exponents: 2x - 1 = 3 => 2x = 4 => x = 2.'
  },
  {
    id: 2,
    subject: 'core_math',
    question: 'If log_10(x) = -3, what is the value of x?',
    options: ['0.001', '0.01', '100', '1000'],
    correctAnswer: 0, // index 0 (0.001)
    explanation: 'From logarithm definitions, log_10(x) = -3 implies x = 10^(-3) = 1/1000 = 0.001.'
  },
  {
    id: 3,
    subject: 'int_science',
    question: 'Which of the following processes is NOT a stage in the water cycle?',
    options: ['Evaporation', 'Condensation', 'Photosynthesis', 'Precipitation'],
    correctAnswer: 2,
    explanation: 'Photosynthesis is a chemical reaction used by plants to convert carbon dioxide and water into glucose. It is not part of the physical water cycle stages.'
  },
  {
    id: 4,
    subject: 'english_lang',
    question: 'Choose the word that is closest in meaning to the capitalized word: The judge was IMPARTIAL in his ruling.',
    options: ['Biased', 'Neutral', 'Severe', 'Hostile'],
    correctAnswer: 1,
    explanation: 'Impartial means fair, unbiased, or neutral.'
  }
];

function App() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'quizzes' | 'syllabus' | 'ai-tutor'>('dashboard');
  
  // Quiz State
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState(SAMPLE_QUESTIONS);
  
  // Simulated Candidate Data
  const candidateProfile = {
    name: 'Emmanuel Mensah',
    email: 'emmanuel@novdec.com',
    targetExams: 'WASSCE NovDec 2026',
    streak: 5,
    rank: 142,
    points: 1240
  };

  // Load any customized questions or settings from database if connected
  useEffect(() => {
    async function loadDbContent() {
      try {
        const { data: dbQuestions } = await supabase
          .from('novdec_questions')
          .select('*')
          .limit(10);
        if (dbQuestions && dbQuestions.length > 0) {
          setQuestions(dbQuestions);
        }
      } catch (err) {
        console.log('Using local mock questions');
      }
    }
    loadDbContent();
  }, []);

  const filteredQuestions = questions.filter(
    q => !selectedSubject || q.subject === selectedSubject
  );

  const handleOptionSelect = (idx: number) => {
    if (showAnswer) return;
    setSelectedOption(idx);
  };

  const handleNextQuestion = () => {
    const isCorrect = selectedOption === filteredQuestions[currentQuestionIdx].correctAnswer;
    if (isCorrect) setScore(score + 1);
    
    setShowAnswer(true);
  };

  const handleProceedNext = () => {
    setSelectedOption(null);
    setShowAnswer(false);
    if (currentQuestionIdx < filteredQuestions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      // Quiz complete
      setIsQuizMode(false);
      alert(`Well Done! You finished the quiz session. Your score: ${score + (selectedOption === filteredQuestions[currentQuestionIdx].correctAnswer ? 1 : 0)}/${filteredQuestions.length}`);
      setCurrentQuestionIdx(0);
      setScore(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans antialiased">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-[#0d1426]/80 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight uppercase leading-none bg-gradient-to-r from-white via-slate-100 to-blue-400 bg-clip-text text-transparent">Base16</h1>
            <span className="text-[9px] font-bold text-blue-500 tracking-widest uppercase">Learning Engine</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-400">
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsQuizMode(false); }} 
            className={`transition-colors py-2 px-3 rounded-lg ${activeTab === 'dashboard' ? 'text-white bg-white/5 font-bold' : 'hover:text-white'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('syllabus'); setIsQuizMode(false); }}
            className={`transition-colors py-2 px-3 rounded-lg ${activeTab === 'syllabus' ? 'text-white bg-white/5 font-bold' : 'hover:text-white'}`}
          >
            Syllabus Explorer
          </button>
          <button 
            onClick={() => { setActiveTab('quizzes'); setIsQuizMode(false); }}
            className={`transition-colors py-2 px-3 rounded-lg ${activeTab === 'quizzes' ? 'text-white bg-white/5 font-bold' : 'hover:text-white'}`}
          >
            Mock Quizzes
          </button>
          <button 
            onClick={() => { setActiveTab('ai-tutor'); setIsQuizMode(false); }}
            className={`transition-colors py-2 px-3 rounded-lg ${activeTab === 'ai-tutor' ? 'text-white bg-white/5 font-bold' : 'hover:text-white'}`}
          >
            AI Study Partner
          </button>
        </nav>

        {/* Right Candidate Widget */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-350 shadow-inner">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span>Rank #{candidateProfile.rank}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-800 border-2 border-blue-500 flex items-center justify-center text-xs font-black text-blue-400">
            EM
          </div>
        </div>
      </header>

      {/* Main Panel Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
        
        {/* --- Active Quiz Mode Modal --- */}
        {isQuizMode && filteredQuestions.length > 0 ? (
          <div className="max-w-2xl mx-auto bg-[#0d1426] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 md:p-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                Question {currentQuestionIdx + 1} of {filteredQuestions.length}
              </span>
              <button 
                onClick={() => setIsQuizMode(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                Exit Session
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-lg md:text-xl font-bold text-white mb-6">
              {filteredQuestions[currentQuestionIdx].question}
            </h3>

            {/* Answer Options */}
            <div className="space-y-3 mb-6">
              {filteredQuestions[currentQuestionIdx].options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === filteredQuestions[currentQuestionIdx].correctAnswer;
                
                let optionStyle = 'border-white/10 hover:border-white/20 bg-white/5 text-slate-300';
                if (showAnswer) {
                  if (isCorrect) {
                    optionStyle = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold';
                  } else if (isSelected) {
                    optionStyle = 'border-red-500/50 bg-red-500/10 text-red-400 font-bold';
                  }
                } else if (isSelected) {
                  optionStyle = 'border-blue-500 bg-blue-500/10 text-white font-bold';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    disabled={showAnswer}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left text-sm font-semibold transition-all ${optionStyle}`}
                  >
                    <span>{opt}</span>
                    {showAnswer && isCorrect && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                    {showAnswer && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-500" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation card */}
            {showAnswer && (
              <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl mb-6 animate-in slide-in-from-bottom-2 duration-200">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Solution & Explanation
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {filteredQuestions[currentQuestionIdx].explanation}
                </p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end">
              {!showAnswer ? (
                <button
                  onClick={handleNextQuestion}
                  disabled={selectedOption === null}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg shadow-blue-650/20 transition-all flex items-center gap-1 active:scale-95"
                >
                  Check Answer <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleProceedNext}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg shadow-emerald-650/20 transition-all flex items-center gap-1 active:scale-95"
                >
                  {currentQuestionIdx < filteredQuestions.length - 1 ? 'Next Question' : 'Complete Session'} <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* --- DASHBOARD TAB --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-blue-900/35 to-indigo-950/25 border border-white/5 rounded-3xl p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                  <div className="space-y-3 text-center md:text-left">
                    <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-bold text-blue-400">
                      <Sparkles className="h-3 w-3" /> Smart Study Engine Active
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight md:max-w-xl">
                      Master your NovDec exams with targeted daily revisions.
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-md font-medium">
                      Ready to conquer your WASSCE NovDec prep? Start a micro-revision quiz to boost your confidence.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={() => { setSelectedSubject(null); setIsQuizMode(true); }}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play className="h-4 w-4 fill-white" /> Start Random Quiz
                    </button>
                    <button
                      onClick={() => setActiveTab('syllabus')}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-2xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <BookOpen className="h-4 w-4 text-slate-400" /> Browse Syllabus
                    </button>
                  </div>
                </div>

                {/* Metric Summary Rows */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0d1426] border border-white/5 p-5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Study Streak</span>
                    <h4 className="text-2xl font-black text-emerald-400 flex items-center gap-1.5">
                      {candidateProfile.streak} Days 🔥
                    </h4>
                  </div>
                  <div className="bg-[#0d1426] border border-white/5 p-5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Accumulated Points</span>
                    <h4 className="text-2xl font-black text-amber-400 flex items-center gap-1.5">
                      {candidateProfile.points} XP
                    </h4>
                  </div>
                  <div className="bg-[#0d1426] border border-white/5 p-5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mock Exams Run</span>
                    <h4 className="text-2xl font-black text-blue-400">12 Session</h4>
                  </div>
                  <div className="bg-[#0d1426] border border-white/5 p-5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Est. Performance</span>
                    <h4 className="text-2xl font-black text-violet-400">Grade B2 (82%)</h4>
                  </div>
                </div>

                {/* Subject Selector section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" /> Syllabus Subject Revison
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {SYLLABUS_SUBJECTS.map(subj => (
                      <div 
                        key={subj.id}
                        className="bg-[#0d1426] border border-white/5 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 transition-all group"
                      >
                        <div className="space-y-2">
                          <h4 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                            {subj.name}
                          </h4>
                          <span className="text-[10px] bg-slate-800 text-slate-350 px-2.5 py-0.5 rounded-full font-semibold inline-block">
                            {subj.questionsCount} Mock Q&A
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }}></div>
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                            <span>Syllabus Covered</span>
                            <span>45%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedSubject(subj.id); setIsQuizMode(true); }}
                          className="w-full mt-2 bg-white/5 hover:bg-blue-600 hover:text-white text-slate-300 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          Revise Subject <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Tutor Card */}
                <div className="bg-gradient-to-r from-violet-950/20 to-fuchsia-950/20 border border-violet-500/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Need help explaining a solution?</h4>
                      <p className="text-xs text-slate-450 font-medium">Our AI study partner matches WAEC curriculum guidelines to break down explanations.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('ai-tutor')}
                    className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-violet-650/10 active:scale-95 transition-all"
                  >
                    Start AI Chat
                  </button>
                </div>

              </div>
            )}

            {/* --- SYLLABUS TAB --- */}
            {activeTab === 'syllabus' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-bold text-white">Syllabus Chapters Explorer</h2>
                  <p className="text-xs text-slate-400">Navigate modular breakdowns of target NovDec curricula.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {SYLLABUS_SUBJECTS.map(subj => (
                    <div key={subj.id} className="bg-[#0d1426] border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-white">{subj.name}</h3>
                        <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded-md font-semibold">
                          WAEC Syllabus
                        </span>
                      </div>
                      
                      <div className="divide-y divide-white/5">
                        {subj.chapters.map((chap, idx) => (
                          <div key={idx} className="py-3 flex items-center justify-between text-xs font-medium text-slate-300">
                            <span>{chap}</span>
                            <button
                              onClick={() => { setSelectedSubject(subj.id); setIsQuizMode(true); }}
                              className="text-blue-400 hover:text-blue-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5"
                            >
                              Practice <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- QUIZZES TAB --- */}
            {activeTab === 'quizzes' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-bold text-white">Interactive Mock Revision</h2>
                  <p className="text-xs text-slate-400">Choose a quiz deck matching your targeted topic revisions.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SYLLABUS_SUBJECTS.map(subj => (
                    <div key={subj.id} className="bg-[#0d1426] border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-white">{subj.name} Mock Session</h3>
                        <p className="text-xs text-slate-450 font-medium">Revise specific chapter objectives & core questions.</p>
                      </div>
                      <button
                        onClick={() => { setSelectedSubject(subj.id); setIsQuizMode(true); }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                      >
                        Start Mock
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- AI STUDY TUTOR TAB --- */}
            {activeTab === 'ai-tutor' && (
              <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl mx-auto">
                <div className="bg-[#0d1426] border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Base16 AI Revision Assistant</h3>
                      <p className="text-[10px] text-slate-450">Trained on West African WAEC exam guidelines.</p>
                    </div>
                  </div>

                  {/* Simulated chat container */}
                  <div className="space-y-4 h-[300px] overflow-y-auto pr-2 text-xs leading-relaxed">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-violet-500/10 flex items-center justify-center text-[10px] text-violet-400 font-bold">AI</div>
                      <div className="bg-white/5 p-3 rounded-r-xl rounded-bl-xl border border-white/5 text-slate-300 max-w-[85%] font-medium">
                        Hello Emmanuel! I can help you solve WASSCE questions, explain formulas, or summarize complex topics. What are we revising today?
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 justify-end">
                      <div className="bg-blue-600/10 p-3 rounded-l-xl rounded-br-xl border border-blue-500/15 text-slate-350 max-w-[85%] font-medium">
                        Can you explain how to solve quadratic equations using the formula method?
                      </div>
                      <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-blue-400">EM</div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-violet-500/10 flex items-center justify-center text-[10px] text-violet-400 font-bold">AI</div>
                      <div className="bg-white/5 p-3 rounded-r-xl rounded-bl-xl border border-white/5 text-slate-300 max-w-[85%] font-medium">
                        Sure! For any quadratic equation of the form <strong className="text-white">ax² + bx + c = 0</strong>, the roots are found using: 
                        <div className="my-2 p-2 bg-black/35 text-center font-mono text-white rounded border border-white/5">
                          x = [-b ± √(b² - 4ac)] / 2a
                        </div>
                        The term <strong className="text-white">b² - 4ac</strong> is called the discriminant. It tells you the nature of the roots! Would you like a step-by-step example?
                      </div>
                    </div>
                  </div>

                  {/* Input form */}
                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text" 
                      placeholder="Ask anything (e.g. solve 2x^2 + 5x - 3 = 0)..." 
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold outline-none focus:border-violet-500 transition-all"
                    />
                    <button className="bg-violet-600 hover:bg-violet-500 text-white px-5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#060a14] border-t border-white/5 py-8 text-center text-xs text-slate-500 font-medium">
        <p>© 2026 Base16 Learning Engine. Dedicated test-prep revision for WASSCE NovDec candidates.</p>
      </footer>
    </div>
  );
}

export default App;
