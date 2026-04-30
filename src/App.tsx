import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import './App.css';

// Fix 1: Pull the model initialization into a more robust structure
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenAI(API_KEY);

const PALETTE = ['#D63B3B', '#2E9E5B', '#2563EB', '#D97706'];
const PNAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const SUGG = ['World Geography', 'Classic Rock', 'Science & Nature', 'The 2000s', 'Ancient History'];

export default function App() {
  const [topic, setTopic] = useState('');
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMsg, setLoadMsg] = useState('');
  
  const [numPlayers, setNumPlayers] = useState(2);
  const [numCats, setNumCats] = useState(6);
  const [names, setNames] = useState([...PNAMES]);
  const [scores, setScores] = useState([0, 0, 0, 0]);
  
  const [active, setActive] = useState(0);
  const [answered, setAnswered] = useState(new Set<string>());
  const [activeQ, setActiveQ] = useState<any>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  
  const [showAns, setShowAns] = useState(false);
  const [failed, setFailed] = useState(new Set<number>());
  const [settings, setSettings] = useState(false);
  
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!loading) return;
    const msgs = ['Crafting categories…', 'Writing clues…', 'Tuning difficulty…', 'Almost there…'];
    let i = 0;
    setLoadMsg(msgs[0]);
    timerRef.current = setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadMsg(msgs[i]);
    }, 1300);
    return () => clearInterval(timerRef.current);
  }, [loading]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    if (!API_KEY) {
      setError("Missing API Key! Check your .env file.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setBoard(null);
    setScores([0, 0, 0, 0]);
    setAnswered(new Set());
    setActiveQ(null);
    setFailed(new Set());

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Create a Jeopardy board about "${topic}". Exactly ${numCats} categories, each with exactly 5 clues (values 200, 400, 600, 800, 1000). Write each clue as Alex Trebek would read it. Answers should be concise (1–5 words). Difficulty increases with value. Make category names fun and specific.` }] }],
        generationConfig: {
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
                          clue: { type: Type.STRING },
                          answer: { type: Type.STRING }
                        },
                        required: ['value', 'clue', 'answer']
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

      // Fix 2: SDK update - response.text is a function, not a property
      const text = result.response.text(); 
      
      if (text) {
        const parsed = JSON.parse(text);
        setBoard({
          categories: parsed.categories.map((c: any, ci: number) => ({
            ...c,
            questions: c.questions.map((q: any, qi: number) => ({ 
              ...q, 
              id: `${ci}-${qi}` 
            }))
          }))
        });
      } else {
        throw new Error('AI returned an empty response.');
      }
    } catch (err: any) {
      console.error("Board Gen Error:", err);
      setError('Failed to generate board: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  function clickQ(q: any, cat: string) {
    if (answered.has(q.id)) return;
    setActiveQ(q);
    setActiveCat(cat);
    setShowAns(false);
    setFailed(new Set());
  }

  function score(correct: boolean) {
    if (!activeQ) return;
    const s = [...scores];
    if (correct) {
      s[active] += activeQ.value;
      setScores(s);
      setAnswered(prev => {
        const n = new Set(prev);
        n.add(activeQ.id);
        return n;
      });
      setActiveQ(null);
    } else {
      s[active] -= activeQ.value;
      setScores(s);
      setFailed(prev => {
        const n = new Set(prev);
        n.add(active);
        return n;
      });
    }
  }

  function skip() {
    if (!activeQ) return;
    setAnswered(prev => {
      const n = new Set(prev);
      n.add(activeQ.id);
      return n;
    });
    setActiveQ(null);
  }

  const catCount = board?.categories?.length || numCats;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#030814', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '0 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 30, letterSpacing: 3, color: '#FFD700', flexShrink: 0, lineHeight: 1 }}>JEOPARDY!</div>
          
          <form onSubmit={generate} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Enter any topic…"
              disabled={loading}
              style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.13)', color: '#fff', fontSize: 14 }}
            />
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              style={{ padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: 'none', background: loading || !topic.trim() ? 'rgba(255,210,0,.35)' : '#FFD700', color: '#050C22', cursor: 'pointer' }}
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
            <button type="button" onClick={() => setSettings(!settings)} className="tog-btn" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.13)', background: settings ? 'rgba(255,210,0,.15)' : 'rgba(255,255,255,.06)', color: '#aaa', fontSize: 17 }}>⚙</button>
          </form>

          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: numPlayers }, (_, i) => (
              <button key={i} onClick={() => setActive(i)} className={`score-chip${active === i ? ' active' : ''}`} style={{ padding: '5px 12px', borderRadius: 8, background: PALETTE[i], minWidth: 72 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{names[i]}</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: '#fff' }}>{scores[i] < 0 ? `-$${Math.abs(scores[i])}` : `$${scores[i]}`}</div>
              </button>
            ))}
          </div>
        </div>

        {settings && (
          <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 14, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
             <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600, marginBottom: 6 }}>PLAYERS</p>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => setNumPlayers(n)} className="tog-btn" style={{ width: 34, height: 34, borderRadius: 6, background: numPlayers === n ? '#FFD700' : 'rgba(255,255,255,.09)', color: numPlayers === n ? '#050C22' : '#ccc' }}>{n}</button>
                  ))}
                </div>
              </div>
              {Array.from({ length: numPlayers }, (_, i) => (
                <div key={i}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>PLAYER {i + 1}</p>
                  <input type="text" value={names[i]} onChange={e => { const n = [...names]; n[i] = e.target.value; setNames(n); }} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.13)', color: '#fff', width: 100 }} />
                </div>
              ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: '16px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        {error && <div style={{ background: 'rgba(180,30,30,.15)', border: '1px solid rgba(220,50,50,.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#f88' }}>{error}</div>}

        {!board && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '58vh', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 88, color: '#FFD700', letterSpacing: 5 }}>JEOPARDY!</div>
            <p style={{ color: 'rgba(255,255,255,.45)', marginBottom: 24 }}>Enter any topic above to generate a custom board powered by AI</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {SUGG.map(s => <button key={s} onClick={() => setTopic(s)} className="suggestion" style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)', cursor: 'pointer' }}>{s}</button>)}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '58vh' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
              {[0, 1, 2].map(i => <div key={i} className="dot" style={{ width: 12, height: 12 }}></div>)}
            </div>
            <p style={{ color: 'rgba(255,255,255,.65)' }}>{loadMsg}</p>
          </div>
        )}

        {board && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${catCount}, 1fr)`, gap: 5 }}>
            {board.categories.map((cat: any, i: number) => (
              <div key={i} style={{ background: 'linear-gradient(175deg,#162A70 0%,#0E1E55 100%)', border: '2px solid #09163C', borderRadius: 6, padding: '10px 6px', textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 'clamp(10px,1.3vw,17px)', color: '#fff', minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cat.name.toUpperCase()}
              </div>
            ))}
            
            {/* Fix 3: Added Optional Chaining to row mapping to prevent "undefined" crashes */}
            {Array.from({ length: 5 }, (_, row) =>
              board.categories.map((cat: any, col: number) => {
                const q = cat.questions?.[row];
                if (!q) return <div key={`${col}-${row}`} />;
                const done = answered.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => clickQ(q, cat.name)}
                    disabled={done}
                    className={`cell${done ? ' answered' : ''}`}
                    style={{ aspectRatio: '5/3', borderRadius: 6, border: done ? '2px solid rgba(255,255,255,.04)' : '2px solid #09163C', background: done ? 'rgba(255,255,255,.02)' : '#163890', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: 'clamp(16px,2.2vw,36px)', color: done ? 'transparent' : '#FFD700' }}
                  >
                    {!done && `$${q.value}`}
                  </button>
                );
              })
            )}
          </div>
        )}
      </main>

      {activeQ && (
        <div className="modal-wrap">
          <div className="modal" style={{ background: '#0C1845', border: '2px solid rgba(255,255,255,.1)', borderRadius: 16, maxWidth: 700, width: '100%', overflow: 'hidden' }}>
            <div style={{ background: '#070D2A', padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20 }}>
                <span style={{ color: '#FFD700' }}>{activeCat}</span>
                <span style={{ color: 'rgba(255,255,255,.25)', margin: '0 8px' }}>·</span>
                <span style={{ color: 'rgba(255,255,255,.75)' }}>${activeQ.value}</span>
              </div>
              <button onClick={skip} className="pass-btn" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '4px 12px', color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}>Skip →</button>
            </div>
            
            <div style={{ padding: '40px 36px 32px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(20px,3.5vw,44px)', color: '#fff', lineHeight: 1.2 }}>{activeQ.clue}</p>
              {showAns && (
                <div className="answer-reveal" style={{ marginTop: 26, padding: '14px 22px', background: 'rgba(255,210,0,.07)', border: '1px solid rgba(255,210,0,.22)', borderRadius: 10 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontWeight: 600 }}>WHAT IS…</p>
                  <p style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(20px,3vw,38px)', color: '#FFD700' }}>{activeQ.answer}</p>
                </div>
              )}
            </div>
            
            <div style={{ background: '#070D2A', padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontWeight: 600 }}>BUZZING IN:</span>
                {Array.from({ length: numPlayers }, (_, i) => (
                  <button key={i} onClick={() => !failed.has(i) && setActive(i)} className="tag-btn" style={{ padding: '5px 13px', borderRadius: 6, border: 'none', cursor: failed.has(i) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: active === i ? PALETTE[i] : 'rgba(255,255,255,.08)', color: active === i ? '#fff' : 'rgba(255,255,255,.45)', opacity: failed.has(i) ? .28 : 1, outline: active === i ? '2px solid #fff' : 'none' }}>{names[i]}</button>
                ))}
              </div>
              
              {!showAns ? (
                <button onClick={() => setShowAns(true)} className="reveal-btn" style={{ width: '100%', padding: '11px', borderRadius: 8, background: '#1E3FA0', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Reveal Answer</button>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => score(false)} disabled={failed.has(active)} className="wrong-btn" style={{ flex: 1, padding: '11px', borderRadius: 8, background: failed.has(active) ? 'rgba(180,30,30,.25)' : '#B92727', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>✕  Incorrect</button>
                  <button onClick={() => score(true)} className="right-btn" style={{ flex: 1, padding: '11px', borderRadius: 8, background: '#247A47', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>✓  Correct</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
