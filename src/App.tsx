

<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
#root{font-family:'Plus Jakarta Sans',sans-serif;background:#050C22;min-height:100vh;color:#fff}
.cell{transition:transform .15s ease,background .15s ease,box-shadow .15s ease;cursor:pointer;user-select:none}
.cell:not(.answered):hover{transform:scale(1.04);background:#1E4DBF!important;box-shadow:0 0 0 2px rgba(255,210,0,.4)}
.cell:not(.answered):active{transform:scale(.97)}
.modal-wrap{position:fixed;inset:0;background:rgba(3,7,20,.88);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50;backdrop-filter:blur(10px)}
.modal{animation:mIn .28s cubic-bezier(.34,1.5,.64,1)}
@keyframes mIn{from{opacity:0;transform:scale(.88) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
.answer-reveal{animation:aIn .35s cubic-bezier(.34,1.3,.64,1)}
@keyframes aIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.dot{animation:dotPulse 1.4s ease-in-out infinite;border-radius:50%;background:#FFD700}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.3}40%{transform:scale(1);opacity:1}}
.score-chip{transition:all .2s;cursor:pointer;border:none;text-align:center}
.score-chip.active{box-shadow:0 0 0 3px #fff,0 0 16px rgba(255,255,255,.25)}
.suggestion:hover{background:rgba(255,255,255,.1)!important;border-color:rgba(255,255,255,.25)!important;cursor:pointer}
input[type=text]:focus{outline:none;border-color:rgba(255,210,0,.6)!important;box-shadow:0 0 0 3px rgba(255,210,0,.15)}
.tog-btn{cursor:pointer;border:none;transition:all .15s}
.tog-btn:hover{opacity:.85}
.tag-btn:hover{background:rgba(255,255,255,.12)!important}
.pass-btn:hover{background:rgba(255,255,255,.12)!important}
.reveal-btn:hover{background:#254db0!important}
.wrong-btn:not(:disabled):hover{background:#a32222!important}
.right-btn:not(:disabled):hover{background:#1f9150!important}
</style>

<div id="root"></div>

<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script>
const {useState,useEffect,useRef}=React;
const PALETTE=['#D63B3B','#2E9E5B','#2563EB','#D97706'];
const PNAMES=['Player 1','Player 2','Player 3','Player 4'];

function App(){
  const[topic,setTopic]=useState('');
  const[board,setBoard]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[loadMsg,setLoadMsg]=useState('');
  const[numPlayers,setNumPlayers]=useState(2);
  const[numCats,setNumCats]=useState(6);
  const[names,setNames]=useState([...PNAMES]);
  const[scores,setScores]=useState([0,0,0,0]);
  const[active,setActive]=useState(0);
  const[answered,setAnswered]=useState(new Set());
  const[activeQ,setActiveQ]=useState(null);
  const[activeCat,setActiveCat]=useState(null);
  const[showAns,setShowAns]=useState(false);
  const[failed,setFailed]=useState(new Set());
  const[settings,setSettings]=useState(false);
  const timerRef=useRef(null);

  useEffect(()=>{
    if(!loading)return;
    const msgs=['Crafting categories…','Writing clues…','Tuning difficulty…','Almost there…'];
    let i=0;setLoadMsg(msgs[0]);
    timerRef.current=setInterval(()=>{i=(i+1)%msgs.length;setLoadMsg(msgs[i]);},1300);
    return()=>clearInterval(timerRef.current);
  },[loading]);

  async function generate(e){
    e.preventDefault();
    if(!topic.trim()||loading)return;
    setLoading(true);setError(null);setBoard(null);
    setScores([0,0,0,0]);setAnswered(new Set());setActiveQ(null);setFailed(new Set());
    try{
      const res=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:4096,
          messages:[{role:'user',content:`Create a Jeopardy board about "${topic}". Exactly ${numCats} categories, each with exactly 5 clues (values 200,400,600,800,1000). Write each clue as Alex Trebek would read it. Answers should be concise (1–5 words). Difficulty increases with value. Make category names fun and specific.

Respond ONLY with valid JSON, no markdown fences:
{"categories":[{"name":"CATEGORY","questions":[{"value":200,"clue":"…","answer":"…"},{"value":400,"clue":"…","answer":"…"},{"value":600,"clue":"…","answer":"…"},{"value":800,"clue":"…","answer":"…"},{"value":1000,"clue":"…","answer":"…"}]}]}`}]
        })
      });
      const data=await res.json();
      if(data.error)throw new Error(data.error.message||'API error');
      const raw=data.content[0].text.replace(/```json|```/g,'').trim();
      const parsed=JSON.parse(raw);
      setBoard({categories:parsed.categories.map((c,ci)=>({...c,questions:c.questions.map((q,qi)=>({...q,id:`${ci}-${qi}`}))}))});
    }catch(err){
      console.error(err);
      setError('Generation failed — '+err.message);
    }finally{setLoading(false);}
  }

  function clickQ(q,cat){
    if(answered.has(q.id))return;
    setActiveQ(q);setActiveCat(cat);setShowAns(false);setFailed(new Set());
  }

  function score(correct){
    if(!activeQ)return;
    const s=[...scores];
    if(correct){
      s[active]+=activeQ.value;setScores(s);
      setAnswered(prev=>{const n=new Set(prev);n.add(activeQ.id);return n;});
      setActiveQ(null);
    }else{
      s[active]-=activeQ.value;setScores(s);
      setFailed(prev=>{const n=new Set(prev);n.add(active);return n;});
    }
  }

  function skip(){
    setAnswered(prev=>{const n=new Set(prev);n.add(activeQ.id);return n;});
    setActiveQ(null);
  }

  const SUGG=['World Geography','Classic Rock','Science & Nature','The 2000s','Ancient History'];
  const catCount=board?board.categories.length:numCats;

  return React.createElement('div',{style:{minHeight:'100vh',display:'flex',flexDirection:'column'}},
    // Header
    React.createElement('header',{style:{background:'#030814',borderBottom:'1px solid rgba(255,255,255,.07)',padding:'0 16px',position:'sticky',top:0,zIndex:10}},
      React.createElement('div',{style:{maxWidth:1280,margin:'0 auto',padding:'10px 0',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}},
        // Logo
        React.createElement('div',{style:{fontFamily:'Bebas Neue',fontSize:30,letterSpacing:3,color:'#FFD700',flexShrink:0,lineHeight:1}},
          'JEOPARDY!'
        ),
        // Form
        React.createElement('form',{onSubmit:generate,style:{display:'flex',gap:8,flex:1,minWidth:200}},
          React.createElement('input',{
            type:'text',value:topic,onChange:e=>setTopic(e.target.value),
            placeholder:'Enter any topic…',disabled:loading,
            style:{flex:1,padding:'8px 14px',borderRadius:8,background:'rgba(255,255,255,.06)',
              border:'1px solid rgba(255,255,255,.13)',color:'#fff',fontSize:14,transition:'border .2s'}
          }),
          React.createElement('button',{
            type:'submit',disabled:loading||!topic.trim(),
            style:{padding:'8px 18px',borderRadius:8,fontWeight:600,fontSize:13,border:'none',
              background:loading||!topic.trim()?'rgba(255,210,0,.35)':'#FFD700',
              color:'#050C22',cursor:loading||!topic.trim()?'not-allowed':'pointer',whiteSpace:'nowrap',transition:'background .2s'}
          }, loading?'Generating…':'Generate'),
          React.createElement('button',{
            type:'button',onClick:()=>setSettings(s=>!s),className:'tog-btn',
            style:{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.13)',
              background:settings?'rgba(255,210,0,.15)':'rgba(255,255,255,.06)',color:'#aaa',fontSize:17}
          },'⚙')
        ),
        // Scores
        React.createElement('div',{style:{display:'flex',gap:6}},
          Array.from({length:numPlayers},(_,i)=>
            React.createElement('button',{
              key:i,onClick:()=>setActive(i),className:`score-chip${active===i?' active':''}`,
              style:{padding:'5px 12px',borderRadius:8,background:PALETTE[i],minWidth:72}
            },
              React.createElement('div',{style:{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.8)',letterSpacing:.5,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:80}},names[i]),
              React.createElement('div',{style:{fontFamily:'Bebas Neue',fontSize:22,color:'#fff',letterSpacing:1}},
                scores[i]<0?`-$${Math.abs(scores[i])}`:`$${scores[i]}`
              )
            )
          )
        )
      ),
      // Settings
      settings&&React.createElement('div',{style:{maxWidth:1280,margin:'0 auto',paddingBottom:14,display:'flex',gap:20,flexWrap:'wrap',alignItems:'flex-end'}},
        React.createElement('div',null,
          React.createElement('p',{style:{fontSize:11,color:'rgba(255,255,255,.4)',fontWeight:600,letterSpacing:.8,textTransform:'uppercase',marginBottom:6}},'Players'),
          React.createElement('div',{style:{display:'flex',gap:5}},
            [2,3,4].map(n=>React.createElement('button',{key:n,onClick:()=>setNumPlayers(n),className:'tog-btn',
              style:{width:34,height:34,borderRadius:6,background:numPlayers===n?'#FFD700':'rgba(255,255,255,.09)',
                color:numPlayers===n?'#050C22':'#ccc',fontWeight:600,fontSize:14}},n))
          )
        ),
        Array.from({length:numPlayers},(_,i)=>
          React.createElement('div',{key:i},
            React.createElement('p',{style:{fontSize:11,color:'rgba(255,255,255,.4)',fontWeight:600,letterSpacing:.8,textTransform:'uppercase',marginBottom:6,display:'flex',alignItems:'center',gap:5}},
              React.createElement('span',{style:{width:8,height:8,borderRadius:2,background:PALETTE[i],display:'inline-block'}}),
              `Player ${i+1}`
            ),
            React.createElement('input',{type:'text',value:names[i],
              onChange:e=>{const n=[...names];n[i]=e.target.value;setNames(n);},
              style:{padding:'5px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,.13)',
                background:'rgba(255,255,255,.06)',color:'#fff',fontSize:13,width:100}})
          )
        ),
        React.createElement('div',null,
          React.createElement('p',{style:{fontSize:11,color:'rgba(255,255,255,.4)',fontWeight:600,letterSpacing:.8,textTransform:'uppercase',marginBottom:6}},'Categories'),
          React.createElement('div',{style:{display:'flex',gap:5}},
            [4,5,6].map(n=>React.createElement('button',{key:n,onClick:()=>setNumCats(n),className:'tog-btn',
              style:{width:34,height:34,borderRadius:6,background:numCats===n?'#FFD700':'rgba(255,255,255,.09)',
                color:numCats===n?'#050C22':'#ccc',fontWeight:600,fontSize:14}},n))
          )
        )
      )
    ),

    // Main
    React.createElement('main',{style:{flex:1,padding:'16px',maxWidth:1280,margin:'0 auto',width:'100%'}},
      error&&React.createElement('div',{style:{background:'rgba(180,30,30,.15)',border:'1px solid rgba(220,50,50,.4)',borderRadius:8,padding:'10px 14px',marginBottom:14,color:'#f88',fontSize:13}},error),

      !board&&!loading&&React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'58vh',textAlign:'center'}},
        React.createElement('div',{style:{fontFamily:'Bebas Neue',fontSize:88,color:'#FFD700',letterSpacing:5,lineHeight:.95,marginBottom:16}},'JEOPARDY!'),
        React.createElement('p',{style:{color:'rgba(255,255,255,.45)',fontSize:15,marginBottom:24}},'Enter any topic above to generate a custom board powered by AI'),
        React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}},
          SUGG.map(s=>React.createElement('button',{key:s,onClick:()=>setTopic(s),className:'suggestion',
            style:{padding:'8px 16px',borderRadius:20,background:'rgba(255,255,255,.06)',
              border:'1px solid rgba(255,255,255,.12)',color:'rgba(255,255,255,.7)',fontSize:13,transition:'all .15s',cursor:'pointer'}},s))
        )
      ),

      loading&&React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'58vh'}},
        React.createElement('div',{style:{display:'flex',gap:10,marginBottom:22}},
          [0,1,2].map(i=>React.createElement('div',{key:i,className:'dot',style:{width:12,height:12}}))
        ),
        React.createElement('p',{style:{color:'rgba(255,255,255,.65)',fontSize:15}},loadMsg)
      ),

      board&&!loading&&React.createElement('div',{style:{
        display:'grid',gridTemplateColumns:`repeat(${catCount},1fr)`,gap:5
      }},
        board.categories.map((cat,i)=>
          React.createElement('div',{key:i,style:{
            background:'linear-gradient(175deg,#162A70 0%,#0E1E55 100%)',
            border:'2px solid #09163C',borderRadius:6,padding:'10px 6px',
            textAlign:'center',fontFamily:'Bebas Neue',
            fontSize:'clamp(10px,1.3vw,17px)',letterSpacing:1,color:'#fff',lineHeight:1.2,
            minHeight:58,display:'flex',alignItems:'center',justifyContent:'center'
          }},cat.name.toUpperCase())
        ),
        Array.from({length:5},(_,row)=>
          board.categories.map((cat,col)=>{
            const q=cat.questions[row];
            const done=answered.has(q.id);
            return React.createElement('button',{
              key:q.id,onClick:()=>clickQ(q,cat.name),disabled:done,
              className:`cell${done?' answered':''}`,
              style:{
                aspectRatio:'5/3',borderRadius:6,border:done?'2px solid rgba(255,255,255,.04)':'2px solid #09163C',
                background:done?'rgba(255,255,255,.02)':'#163890',cursor:done?'default':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:'Bebas Neue',fontSize:'clamp(16px,2.2vw,36px)',
                color:done?'transparent':'#FFD700',letterSpacing:1
              }
            },!done&&`$${q.value}`)
          })
        )
      )
    ),

    // Modal
    activeQ&&React.createElement('div',{className:'modal-wrap'},
      React.createElement('div',{className:'modal',style:{
        background:'#0C1845',border:'2px solid rgba(255,255,255,.1)',
        borderRadius:16,maxWidth:700,width:'100%',overflow:'hidden',
        boxShadow:'0 50px 100px rgba(0,0,0,.7)'
      }},
        React.createElement('div',{style:{background:'#070D2A',padding:'13px 18px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{style:{fontFamily:'Bebas Neue',fontSize:20,letterSpacing:2}},
            React.createElement('span',{style:{color:'#FFD700'}},activeCat),
            React.createElement('span',{style:{color:'rgba(255,255,255,.25)',margin:'0 8px'}},'·'),
            React.createElement('span',{style:{color:'rgba(255,255,255,.75)'}},'$'+activeQ.value)
          ),
          React.createElement('button',{onClick:skip,className:'pass-btn',style:{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',borderRadius:6,padding:'4px 12px',color:'rgba(255,255,255,.5)',cursor:'pointer',fontSize:12,fontWeight:500,transition:'background .15s'}},
            'Skip →')
        ),
        React.createElement('div',{style:{padding:'40px 36px 32px',textAlign:'center'}},
          React.createElement('p',{style:{fontFamily:'Bebas Neue',fontSize:'clamp(20px,3.5vw,44px)',color:'#fff',lineHeight:1.2,letterSpacing:1}},activeQ.clue),
          showAns&&React.createElement('div',{className:'answer-reveal',style:{marginTop:26,padding:'14px 22px',background:'rgba(255,210,0,.07)',border:'1px solid rgba(255,210,0,.22)',borderRadius:10}},
            React.createElement('p',{style:{fontSize:11,color:'rgba(255,255,255,.35)',marginBottom:5,fontWeight:600,letterSpacing:1}},'WHAT IS…'),
            React.createElement('p',{style:{fontFamily:'Bebas Neue',fontSize:'clamp(20px,3vw,38px)',color:'#FFD700',letterSpacing:1}},activeQ.answer)
          )
        ),
        React.createElement('div',{style:{background:'#070D2A',padding:'14px 18px',borderTop:'1px solid rgba(255,255,255,.07)'}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}},
            React.createElement('span',{style:{fontSize:11,color:'rgba(255,255,255,.35)',fontWeight:600,letterSpacing:.5}},'BUZZING IN:'),
            Array.from({length:numPlayers},(_,i)=>
              React.createElement('button',{key:i,onClick:()=>!failed.has(i)&&setActive(i),className:'tag-btn',
                style:{padding:'5px 13px',borderRadius:6,border:'none',cursor:failed.has(i)?'not-allowed':'pointer',
                  fontWeight:600,fontSize:13,transition:'all .15s',
                  background:active===i?PALETTE[i]:'rgba(255,255,255,.08)',
                  color:active===i?'#fff':'rgba(255,255,255,.45)',
                  opacity:failed.has(i)?.28:1,outline:active===i?'2px solid #fff':'none',outlineOffset:2}},
                names[i])
            )
          ),
          !showAns
            ?React.createElement('button',{onClick:()=>setShowAns(true),className:'reveal-btn',
                style:{width:'100%',padding:'11px',borderRadius:8,border:'none',background:'#1E3FA0',color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer',transition:'background .15s'}},
                'Reveal Answer')
            :React.createElement('div',{style:{display:'flex',gap:10}},
                React.createElement('button',{onClick:()=>score(false),disabled:failed.has(active),className:'wrong-btn',
                  style:{flex:1,padding:'11px',borderRadius:8,border:'none',
                    background:failed.has(active)?'rgba(180,30,30,.25)':'#B92727',
                    color:'#fff',fontWeight:600,fontSize:14,cursor:failed.has(active)?'not-allowed':'pointer',
                    opacity:failed.has(active)?.5:1,transition:'background .15s'}},
                  '✕  Incorrect'),
                React.createElement('button',{onClick:()=>score(true),className:'right-btn',
                  style:{flex:1,padding:'11px',borderRadius:8,border:'none',background:'#247A47',
                    color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer',transition:'background .15s'}},
                  '✓  Correct')
              )
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script>
