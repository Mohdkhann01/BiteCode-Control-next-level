import React,{useEffect,useMemo,useState} from "react";
import {Bot,X,Send,Sparkles,Trash2} from "lucide-react";
import axios from "axios";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
const api=axios.create({baseURL:API});
api.interceptors.request.use(config=>{const token=localStorage.getItem("token");if(token)config.headers.Authorization=`Bearer ${token}`;return config});
const readUser=()=>{try{return JSON.parse(localStorage.getItem("user")||"null")}catch{return null}};

export default function AIAssistant(){
  const [open,setOpen]=useState(false);
  const [user,setUser]=useState(readUser);
  const [enabled,setEnabled]=useState(true);
  const [available,setAvailable]=useState(false);
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);

  const isAdmin=user?.role==='admin';
  const suggestions=useMemo(()=>isAdmin?[
    "How many participants are registered?",
    "Which teams have no problem assigned?",
    "How many judge assignments are pending?",
    "What is the current event status?"
  ]:[
    "How do I create a team?",
    "Give me Java code to print Hello World",
    "How do I submit my solution?",
    "How can I verify my certificate?"
  ],[isAdmin]);

  useEffect(()=>{
    const refresh=async()=>{
      const u=readUser();
      setUser(u);
      if(!u){setEnabled(false);setOpen(false);setAvailable(false);return;}
      if(u.role==='admin'){
        setEnabled(true);
        try{const r=await api.get('/ai/status');setAvailable(r.data?.enabled===true)}catch{setAvailable(false)}
        return;
      }
      try{const r=await api.get('/ai/status');setEnabled(true);setAvailable(r.data?.enabled===true)}catch{setEnabled(true);setAvailable(false)}
    };
    refresh();
    const onStorage=()=>refresh();
    window.addEventListener('storage',onStorage);
    const timer=setInterval(refresh,5000);
    return()=>{clearInterval(timer);window.removeEventListener('storage',onStorage)};
  },[]);

  useEffect(()=>{
    if(!user)return;
    setMessages([{role:'assistant',content:isAdmin?"Hi! Ask me about your event, participants, teams, problems, submissions, judging, attendance, certificates, or platform operations.":"Hi! Ask me about the hackathon or programming. You can also ask for code, debugging help, compiler guidance, teams, submissions, or certificates."}]);
  },[user?.role,isAdmin]);

  const sendMessage=async(text=input)=>{
    const message=String(text||'').trim();
    if(!message||loading)return;
    if(!available){setMessages(prev=>[...prev,{role:'assistant',content:isAdmin?'AI is configured but the AI provider is currently unavailable. Check the backend AI configuration and provider status.':'AI is temporarily unavailable. Please try again after the organizer enables the service.'}]);return;}
    setMessages(prev=>[...prev,{role:'user',content:message}]);
    setInput("");setLoading(true);
    try{
      const r=await api.post('/ai/chat',{question:message});
      setMessages(prev=>[...prev,{role:'assistant',content:r.data?.answer||'I could not generate a response.'}]);
    }catch(e){
      const status=e.response?.status;
      const server=e.response?.data?.message;
      if(status===401){localStorage.removeItem('token');localStorage.removeItem('user');setEnabled(false);setOpen(false);}
      else setMessages(prev=>[...prev,{role:'assistant',content:server||'The AI service is temporarily unavailable.'}]);
    }finally{setLoading(false)}
  };

  const clearChat=()=>setMessages([{role:'assistant',content:isAdmin?"Chat cleared. What would you like to check?":"Chat cleared. What would you like help with?"}]);
  if(!user||!enabled)return null;

  return <>
    {!open&&<button className="aiFloatingButton" onClick={()=>setOpen(true)} aria-label="Open BiteCode AI"><Sparkles size={22}/><span>AI</span></button>}
    {open&&<div className="aiChat">
      <div className="aiHeader"><div className="aiHeaderInfo"><div className="aiLogo"><Bot size={20}/></div><div><strong>{isAdmin?'BiteCode Admin AI':'BiteCode AI'}</strong><small><span className={"aiOnlineDot "+(available?'':'offline')}/>{available?'Online assistant':'AI service unavailable'}</small></div></div><div className="aiHeaderActions"><button onClick={clearChat} title="Clear chat"><Trash2 size={16}/></button><button onClick={()=>setOpen(false)} title="Close"><X size={19}/></button></div></div>
      <div className="aiMessages">
        {messages.map((m,i)=><div key={i} className={`aiMessage ${m.role==='user'?'aiUserMessage':'aiBotMessage'}`}>{m.role==='assistant'&&<div className="aiSmallIcon"><Bot size={13}/></div>}<div className="aiBubble">{m.content}</div></div>)}
        {loading&&<div className="aiMessage aiBotMessage"><div className="aiSmallIcon"><Bot size={13}/></div><div className="aiBubble aiTyping"><span/><span/><span/></div></div>}
      </div>
      {messages.length===1&&!loading&&<div className="aiSuggestions"><small>Try asking</small><div>{suggestions.map(s=><button key={s} onClick={()=>sendMessage(s)}>{s}</button>)}</div></div>}
      <div className="aiInputArea"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendMessage()}} placeholder="Ask BiteCode AI..." disabled={loading}/><button onClick={()=>sendMessage()} disabled={!input.trim()||loading}><Send size={17}/></button></div>
      <div className="aiFooter">AI answers use only information your role is authorized to access.</div>
    </div>}
  </>;
}
