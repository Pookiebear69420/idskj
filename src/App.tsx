import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Loader2, Play, Check, X, RefreshCw } from 'lucide-react';

// Initialize Gemini API
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

interface BoardData {
  categories: Category[];
}

type Player = 'red' | 'green' | 'yellow';

export default function App() {
  const isShared = typeof window !== 'undefined' && window.location.hostname.includes('ais-pre-');
  
  const [topic, setTopic] = useState('');
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [scores, setScores] = useState<Record<Player, number>>({ red: 0, green: 0, yellow: 0 });
  const [activePlayer, setActivePlayer] = useState<Player>('red');
  const [failedPlayers, setFailedPlayers] = useState<Set<Player>>(new Set());
  
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [showAnswer, setShowAnswer] = useState(false);

  const generateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);
    setBoardData(null);
    setScores({ red: 0, green: 0, yellow: 0 });
    setFailedPlayers(new Set());
    setAnsweredQuestions(new Set());
    setActiveQuestion(null);
    setShowAnswer(false);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a Jeopardy board for the topic: "${topic}".
        It should have exactly 6 categories, and each category should have exactly 5 questions with increasing difficulty values: 200, 400, 600, 800, 1000.
        The questions should be challenging but appropriate for the topic.
        The answer should be just the answer, not in the form of a question (e.g., "George Washington", not "Who is George Washington?").`,
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
                    name: { type: Type.STRING, description: 'Category name' },
                    questions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          value: { type: Type.NUMBER, description: 'Question value (200, 400, 600, 800, 1000)' },
                          question: { type: Type.STRING, description: 'The clue/question' },
                          answer: { type: Type.STRING, description: 'The correct answer' }
                        },
                        required: ['value', 'question', 'answer']
                      }
                    }
                  },
                  required: ['name', 'questions']
                }
              }
            },
            required: ['categories']
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        
        // Add unique IDs to questions
        const processedData: BoardData = {
          categories: data.categories.map((cat: any, cIdx: number) => ({
            name: cat.name,
            questions: cat.questions.map((q: any, qIdx: number) => ({
              ...q,
              id: `q-${cIdx}-${qIdx}`
            }))
          }))
        };
        
        setBoardData(processedData);
      } else {
        setError("Failed to generate board. Please try again.");
      }
    } catch (err) {
      console.error("Error generating board:", err);
      setError("An error occurred while generating the board. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionClick = (question: Question, categoryName: string) => {
    if (answeredQuestions.has(question.id)) return;
    setActiveQuestion(question);
    setActiveCategory(categoryName);
    setShowAnswer(false);
    setFailedPlayers(new Set());
  };

  const handleScore = (isCorrect: boolean) => {
    if (!activeQuestion) return;
    
    if (isCorrect) {
      setScores(prev => ({ ...prev, [activePlayer]: prev[activePlayer] + activeQuestion.value }));
      setAnsweredQuestions(prev => {
        const newSet = new Set(prev);
        newSet.add(activeQuestion.id);
        return newSet;
      });
      setActiveQuestion(null);
      setActiveCategory(null);
    } else {
      setScores(prev => ({ ...prev, [activePlayer]: prev[activePlayer] - activeQuestion.value }));
      setFailedPlayers(prev => {
        const newSet = new Set(prev);
        newSet.add(activePlayer);
        return newSet;
      });
    }
  };

  const handlePass = () => {
    if (!activeQuestion) return;
    
    setAnsweredQuestions(prev => {
      const newSet = new Set(prev);
      newSet.add(activeQuestion.id);
      return newSet;
    });
    
    setActiveQuestion(null);
    setActiveCategory(null);
  };

  return (
    <div className="min-h-screen bg-blue-950 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 border-b border-blue-800 p-4 shadow-md z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 text-blue-950 p-2 rounded-lg font-bold text-xl tracking-tighter">
              AI JEOPARDY
            </div>
          </div>
          
          <form onSubmit={generateBoard} className="flex w-full md:w-auto gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={isShared ? "Remix to unlock!" : "Enter a topic (e.g., 90s Movies, World History)"}
              className="flex-1 md:w-80 px-4 py-2 rounded-md bg-blue-950 border border-blue-700 text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || isShared}
            />
            <button
              type="submit"
              disabled={isLoading || !topic.trim() || isShared}
              className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-bold px-6 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              <span className="hidden sm:inline">Generate</span>
            </button>
          </form>

          <div className="flex gap-2 md:gap-4">
            {(['red', 'green', 'yellow'] as Player[]).map(p => (
              <button
                key={p}
                onClick={() => setActivePlayer(p)}
                className={`flex flex-col items-center justify-center px-3 py-1 md:px-4 md:py-2 rounded-md border-2 transition-all ${
                  activePlayer === p 
                    ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105' 
                    : 'border-transparent opacity-70 hover:opacity-100'
                } ${
                  p === 'red' ? 'bg-red-600 text-white' : p === 'green' ? 'bg-green-600 text-white' : 'bg-yellow-500 text-blue-950'
                }`}
              >
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-80">{p}</span>
                <span className="font-mono font-bold text-sm md:text-xl">
                  {scores[p] < 0 ? '-$' : '$'}{Math.abs(scores[p])}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full relative">
        {isShared && (
          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 p-4 rounded-lg mb-6 text-center shadow-lg">
            <p className="font-bold text-lg mb-1">🔒 Shared Template Mode</p>
            <p>This is a view-only shared app. To generate your own Jeopardy boards, please click the <strong>Remix</strong> button in AI Studio!</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        {!boardData && !isLoading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-blue-900 rounded-full flex items-center justify-center mb-6 shadow-lg border border-blue-800">
              <span className="text-yellow-400 text-4xl font-bold">?</span>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-blue-100">Welcome to AI Jeopardy</h1>
            <p className="text-xl text-blue-300 mb-8">
              Enter any topic above to generate a custom game board powered by AI.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Space Exploration', 'Greek Mythology', 'Pop Music', 'Computer Science'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setTopic(suggestion)}
                  className="bg-blue-900 hover:bg-blue-800 border border-blue-700 px-4 py-2 rounded-full text-sm text-blue-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-16 h-16 text-yellow-400 animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-blue-200 animate-pulse">Generating your board...</h2>
            <p className="text-blue-400 mt-2">This might take a few seconds.</p>
          </div>
        )}

        {boardData && !isLoading && (
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-6 gap-2 md:gap-4 h-full">
              {/* Category Headers */}
              {boardData.categories.map((category, idx) => (
                <div key={idx} className="bg-blue-800 border-2 border-blue-950 rounded-md p-2 flex items-center justify-center text-center shadow-md">
                  <h3 className="font-bold text-white uppercase tracking-wider text-xs md:text-sm lg:text-base break-words">
                    {category.name}
                  </h3>
                </div>
              ))}

              {/* Question Grid */}
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                boardData.categories.map((category, colIndex) => {
                  const question = category.questions[rowIndex];
                  const isAnswered = answeredQuestions.has(question.id);
                  
                  return (
                    <button
                      key={question.id}
                      onClick={() => handleQuestionClick(question, category.name)}
                      disabled={isAnswered}
                      className={`
                        aspect-[4/3] rounded-md flex items-center justify-center text-2xl md:text-3xl lg:text-4xl font-bold font-mono transition-all duration-300
                        ${isAnswered 
                          ? 'bg-blue-950/50 border border-blue-900/50 text-transparent cursor-default' 
                          : 'bg-blue-700 hover:bg-blue-600 border-2 border-blue-950 text-yellow-400 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_0_30px_rgba(0,0,0,0.4)] hover:scale-[1.02] cursor-pointer'}
                      `}
                    >
                      {!isAnswered && `$${question.value}`}
                    </button>
                  );
                })
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Active Question Modal */}
      {activeQuestion && (
        <div className="fixed inset-0 bg-blue-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-blue-900 border-4 border-blue-700 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="bg-blue-950 p-4 flex justify-between items-center border-b border-blue-800">
              <div className="text-yellow-400 font-bold uppercase tracking-widest text-lg">
                {activeCategory} <span className="text-blue-500 mx-2">•</span> ${activeQuestion.value}
              </div>
              <button 
                onClick={handlePass}
                className="text-blue-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-semibold"
              >
                Pass <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 md:p-16 flex-1 flex flex-col items-center justify-center min-h-[40vh] text-center">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-8" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                {activeQuestion.question.toUpperCase()}
              </h2>
              
              {showAnswer && (
                <div className="mt-8 p-6 bg-blue-950/50 border border-yellow-400/30 rounded-lg animate-in fade-in slide-in-from-bottom-4">
                  <p className="text-blue-300 text-sm uppercase tracking-widest mb-2 font-semibold">Correct Answer</p>
                  <p className="text-2xl md:text-4xl font-bold text-yellow-400">
                    {activeQuestion.answer}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer / Controls */}
            <div className="bg-blue-950 p-6 border-t border-blue-800 flex flex-col items-center gap-6">
              
              {/* Player Selection in Modal */}
              <div className="flex gap-3">
                <span className="text-blue-300 text-sm font-semibold self-center mr-2 uppercase tracking-wider">Active Player:</span>
                {(['red', 'green', 'yellow'] as Player[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setActivePlayer(p)}
                    disabled={failedPlayers.has(p)}
                    className={`px-4 py-2 rounded-md font-bold uppercase text-sm transition-all ${
                      activePlayer === p ? 'ring-2 ring-white scale-105' : 'opacity-60 hover:opacity-100'
                    } ${
                      p === 'red' ? 'bg-red-600 text-white' : p === 'green' ? 'bg-green-600 text-white' : 'bg-yellow-500 text-blue-950'
                    } ${failedPlayers.has(p) ? 'grayscale cursor-not-allowed opacity-30' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg"
                >
                  Reveal Answer
                </button>
              ) : (
                <div className="flex gap-4 w-full max-w-md">
                  <button
                    onClick={() => handleScore(false)}
                    disabled={failedPlayers.has(activePlayer)}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <X className="w-6 h-6" /> Incorrect
                  </button>
                  <button
                    onClick={() => handleScore(true)}
                    disabled={failedPlayers.has(activePlayer)}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Check className="w-6 h-6" /> Correct
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
