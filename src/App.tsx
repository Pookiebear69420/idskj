import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Play, Check, X, RotateCcw, Settings, Trophy } from 'lucide-react';

// --- Types & Constants ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Question {
  id: string;
  value: number;
  question: string;
  answer: string;
}

interface Category {
  name: string;
  questions: Question[];
}

interface Player {
  id: number;
  name: string;
  score: number;
  color: string;
}

// --- Main Component ---
export default function JeopardyApp() {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [boardData, setBoardData] = useState<Category[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Player 1', score: 0, color: 'bg-red-600' },
    { id: 2, name: 'Player 2', score: 0, color: 'bg-green-600' },
    { id: 3, name: 'Player 3', score: 0, color: 'bg-yellow-500' },
  ]);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<{ q: Question; cat: string } | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [showAnswer, setShowAnswer] = useState(false);

  // --- Logic ---
  const generateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', // Using latest stable flash for speed
        contents: `Generate a Jeopardy board for: "${topic}". 
        Return 6 categories, each with 5 questions (values: 200, 400, 600, 800, 1000). 
        Format: JSON only. Values should be numbers. Answers should be concise.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    questions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          value: { type: Type.NUMBER },
                          question: { type: Type.STRING },
                          answer: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      const processed = data.categories.map((c: any, ci: number) => ({
        ...c,
        questions: c.questions.map((q: any, qi: number) => ({ ...q, id: `q-${ci}-${qi}` }))
      }));
      setBoardData(processed);
      setAnsweredIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateScore = (points: number, isCorrect: boolean) => {
    setPlayers(prev => prev.map((p, i) => 
      i === activePlayerIdx ? { ...p, score: p.score + (isCorrect ? points : -points) } : p
    ));
    if (isCorrect) {
      setAnsweredIds(prev => new Set(prev).add(activeQuestion!.q.id));
      setActiveQuestion(null);
      setShowAnswer(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b28] text-white font-sans selection:bg-yellow-400 selection:text-black">
      {/* Dynamic Header */}
      <nav className="p-4 bg-black/20 border-b border-white/10 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black italic tracking-tighter text-yellow-400">NEON JEOPARDY</h1>
            <form onSubmit={generateBoard} className="hidden md:flex gap-2">
              <input 
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Enter any topic..."
                className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-lg focus:ring-2 ring-yellow-400 outline-none w-64 transition-all"
              />
              <button className="bg-yellow-400 text-black font-bold px-4 rounded-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2">
                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
                Generate
              </button>
            </form>
          </div>

          <div className="flex gap-3">
            {players.map((p, i) => (
              <motion.div 
                key={p.id}
                onClick={() => setActivePlayerIdx(i)}
                className={`cursor-pointer p-2 rounded-xl border-2 transition-all ${activePlayerIdx === i ? 'border-white bg-white/10 scale-110' : 'border-transparent opacity-50'}`}
              >
                <div className={`w-3 h-3 rounded-full ${p.color} mb-1 mx-auto`} />
                <div className="text-center font-mono font-bold">${p.score}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Board */}
      <main className="max-w-7xl mx-auto p-6">
        {!boardData && !isLoading ? (
          <EmptyState setTopic={setTopic} />
        ) : isLoading ? (
          <LoadingState />
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-6 gap-3"
          >
            {boardData?.map((cat, ci) => (
              <div key={ci} className="space-y-3">
                <div className="h-16 flex items-center justify-center text-center bg-blue-900/40 border border-blue-500/30 rounded-lg p-2 mb-4">
                  <span className="text-xs font-black uppercase tracking-widest leading-tight">{cat.name}</span>
                </div>
                {cat.questions.map((q) => (
                  <QuestionCard 
                    key={q.id} 
                    q={q} 
                    isAnswered={answeredIds.has(q.id)} 
                    onClick={() => setActiveQuestion({ q, cat: cat.name })}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Question Modal */}
      <AnimatePresence>
        {activeQuestion && (
          <QuestionModal 
            data={activeQuestion} 
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            onClose={() => setActiveQuestion(null)}
            onScore={updateScore}
            activePlayer={players[activePlayerIdx]}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components (Keep it clean) ---

function QuestionCard({ q, isAnswered, onClick }: { q: Question; isAnswered: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={!isAnswered ? { scale: 1.05, backgroundColor: '#2563eb' } : {}}
      whileTap={{ scale: 0.95 }}
      disabled={isAnswered}
      onClick={onClick}
      className={`w-full aspect-[4/3] rounded-lg flex items-center justify-center text-3xl font-black font-mono border-2 transition-colors ${
        isAnswered 
        ? 'bg-transparent border-white/5 text-transparent' 
        : 'bg-blue-700 border-blue-500 text-yellow-400 shadow-lg shadow-blue-900/20'
      }`}
    >
      ${q.value}
    </motion.button>
  );
}

function QuestionModal({ data, showAnswer, setShowAnswer, onClose, onScore, activePlayer }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-blue-900 border-4 border-blue-400 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.5)]"
      >
        <div className="p-4 bg-black/20 flex justify-between items-center text-blue-300 font-bold uppercase tracking-tighter">
          <span>{data.cat} — ${data.q.value}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X /></button>
        </div>
        
        <div className="p-12 md:p-20 text-center min-h-[350px] flex flex-col justify-center">
          <h2 className="text-4xl md:text-6xl font-serif font-bold uppercase leading-tight drop-shadow-lg">
            {data.q.question}
          </h2>
          
          <AnimatePresence>
            {showAnswer && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-12 p-6 bg-yellow-400 rounded-2xl"
              >
                <p className="text-black text-sm font-black uppercase mb-1">Answer:</p>
                <p className="text-blue-900 text-3xl font-black">{data.q.answer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-8 bg-black/40 flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold opacity-60 uppercase">Turn: {activePlayer.name}</span>
            {!showAnswer ? (
              <button 
                onClick={() => setShowAnswer(true)}
                className="bg-white text-blue-900 px-10 py-4 rounded-full font-black text-xl hover:scale-105 transition-transform"
              >
                REVEAL CLUE
              </button>
            ) : (
              <div className="flex gap-4">
                <button onClick={() => onScore(data.q.value, false)} className="bg-red-600 px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-500">
                  <X /> Incorrect
                </button>
                <button onClick={() => onScore(data.q.value, true)} className="bg-green-600 px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-green-500">
                  <Check /> Correct
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative">
        <Loader2 className="w-20 h-20 text-yellow-400 animate-spin" />
        <div className="absolute inset-0 blur-xl bg-yellow-400/20 animate-pulse" />
      </div>
      <h2 className="text-3xl font-black mt-8 tracking-widest animate-pulse">CRAFTING BOARD...</h2>
    </div>
  );
}

function EmptyState({ setTopic }: { setTopic: (t: string) => void }) {
  const suggestions = ["80s Arcade Games", "Quantum Physics", "Gordon Ramsay Quotes", "Georgia History"];
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-32 h-32 bg-yellow-400 rounded-3xl flex items-center justify-center rotate-3 shadow-2xl mb-10">
        <Trophy className="w-16 h-16 text-blue-900" />
      </div>
      <h2 className="text-5xl font-black mb-4">Ready for a challenge?</h2>
      <p className="text-blue-300 text-xl mb-8 max-w-lg">Choose a topic and let the AI build your custom game show board in seconds.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {suggestions.map(s => (
          <button 
            key={s} 
            onClick={() => setTopic(s)}
            className="px-6 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors text-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
