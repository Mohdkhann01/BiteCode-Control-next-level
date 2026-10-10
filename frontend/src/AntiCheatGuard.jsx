import React,{useEffect,useRef,useState} from 'react';
import axios from 'axios';

const API=(import.meta.env.PROD?(import.meta.env.VITE_API_URL||'https://bitecode-control-next-level.onrender.com/api'):(import.meta.env.VITE_API_URL||'http://localhost:5000/api')).replace(/-2\.onrender\.com/i,'onrender.com');
const api=axios.create({baseURL:API,timeout:15000});
api.interceptors.request.use(c=>{const t=sessionStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`;return c});

let html2canvasPromise;
function loadHtml2Canvas(){
  if(window.html2canvas)return Promise.resolve(window.html2canvas);
  if(html2canvasPromise)return html2canvasPromise;
  html2canvasPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.async=true;s.onload=()=>window.html2canvas?resolve(window.html2canvas):reject(new Error('Screenshot library unavailable'));s.onerror=()=>reject(new Error('Screenshot library unavailable'));document.head.appendChild(s);
  });
  return html2canvasPromise;
}

export default function AntiCheatGuard({children,problemId}){
  const [incidents,setIncidents]=useState(0);
  const videoRef=useRef(null),streamRef=useRef(null),lastFrameRef=useRef(null),canvasRef=useRef(null),busyRef=useRef(false),mounted=useRef(true),lastCameraIncidentRef=useRef(0),lastEvidenceAtRef=useRef(0);
  const report=async(type,extra={})=>{
    const screenshotEligible=['tab_hidden','window_blur','fullscreen_exit'].includes(type);
    if(type==='tab_hidden'){
      if(busyRef.current)return;
      busyRef.current=true;
    }
    let screenshotUrl=null;
    // A website can capture only its rendered page content here, not the entire desktop.
    // Only capture for meaningful focus/fullscreen events; never for routine camera movement,
    // copy/paste attempts, context-menu attempts, or tab-visible notifications.
    if(screenshotEligible && Date.now()-lastEvidenceAtRef.current>8000){
      lastEvidenceAtRef.current=Date.now();
      try{
        const html2canvas=await loadHtml2Canvas();
        const canvas=await html2canvas(document.body,{scale:0.45,useCORS:true,logging:false,backgroundColor:'#fff'});
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.45));
        if(blob && blob.size<=8*1024*1024){
          const form=new FormData();
          form.append('image',blob,`anti-cheat-${Date.now()}.jpg`);
          const uploaded=await api.post('/media/images',form,{headers:{'Content-Type':'multipart/form-data'}});
          screenshotUrl=uploaded.data?.url||null;
        }
      }catch{
        // Event reporting still succeeds if screenshot capture/upload is unavailable.
      }
    }
    try{
      await api.post('/anticheat/incident',{problemId,type,details:extra,screenshot:screenshotUrl});
      if(mounted.current)setIncidents(x=>x+1);
    }catch{}
    finally{if(type==='tab_hidden')setTimeout(()=>{busyRef.current=false},2500)}
  };
  useEffect(()=>{
    mounted.current=true;
    const keydown=e=>{if((e.ctrlKey||e.metaKey)&&['c','v','x'].includes(e.key.toLowerCase())){e.preventDefault();report('clipboard_blocked',{key:e.key.toLowerCase()})}};
    const context=e=>{e.preventDefault();report('context_menu')};
    const hidden=()=>{if(document.hidden)report('tab_hidden',{reason:'document_hidden'});else report('tab_visible')};
    const blur=()=>report('window_blur');
    const fs=()=>{if(!document.fullscreenElement)report('fullscreen_exit')};
    document.addEventListener('keydown',keydown,true);document.addEventListener('contextmenu',context,true);document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);document.addEventListener('fullscreenchange',fs);
    let timer;
    const startCamera=async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)return;
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:320},height:{ideal:240}},audio:false});
        if(!mounted.current){stream.getTracks().forEach(t=>t.stop());return}
        streamRef.current=stream;
        const v=videoRef.current;v.srcObject=stream;await v.play();
        canvasRef.current=document.createElement('canvas');canvasRef.current.width=32;canvasRef.current.height=24;
        const c=canvasRef.current,ctx=c.getContext('2d',{willReadFrequently:true});
        timer=setInterval(()=>{
          if(document.hidden||!v.videoWidth)return;
          ctx.drawImage(v,0,0,32,24);const data=ctx.getImageData(0,0,32,24).data;
          if(lastFrameRef.current){let diff=0;for(let i=0;i<data.length;i+=4)diff+=Math.abs(data[i]-lastFrameRef.current[i])+Math.abs(data[i+1]-lastFrameRef.current[i+1])+Math.abs(data[i+2]-lastFrameRef.current[i+2]);const avg=diff/(32*24*3);if(avg>30 && Date.now()-lastCameraIncidentRef.current>15000){lastCameraIncidentRef.current=Date.now();report('camera_movement',{sceneChangeScore:Number(avg.toFixed(2)),note:'Large camera-frame change; review manually, this is not proof of cheating.'});}}
          lastFrameRef.current=data;
        },1200);
      }catch{ /* Camera is optional; tab/window monitoring still works. */ }
    };
    startCamera();
    return()=>{mounted.current=false;clearInterval(timer);document.removeEventListener('keydown',keydown,true);document.removeEventListener('contextmenu',context,true);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);document.removeEventListener('fullscreenchange',fs);streamRef.current?.getTracks().forEach(t=>t.stop())};
  },[problemId]);
  return <>
    <video ref={videoRef} muted playsInline style={{display:'none'}} />
    {incidents>0&&<div className="antiCheatStatus">Proctoring active · {incidents} event{incidents===1?'':'s'} recorded</div>}
    {children}
  </>;
}
