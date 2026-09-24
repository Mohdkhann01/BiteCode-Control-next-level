import express from "express";
import { auth, allow, permission } from "../middleware/auth.js";
import { Hackathon, Problem, Team, CodeSubmission, Role, JudgeAssignment } from "../models/index.js";

const router = express.Router();
const JUDGE0_URL = (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/$/, "");
const JUDGE0_TOKEN = process.env.JUDGE0_AUTH_TOKEN || "";
const LANGUAGE_IDS = {
  python: Number(process.env.JUDGE0_PYTHON_ID || 71),
  javascript: Number(process.env.JUDGE0_JAVASCRIPT_ID || 63),
  c: Number(process.env.JUDGE0_C_ID || 50),
  cpp: Number(process.env.JUDGE0_CPP_ID || 54),
  java: Number(process.env.JUDGE0_JAVA_ID || 62),
  csharp: Number(process.env.JUDGE0_CSHARP_ID || 51),
  go: Number(process.env.JUDGE0_GO_ID || 60),
  rust: Number(process.env.JUDGE0_RUST_ID || 73),
  php: Number(process.env.JUDGE0_PHP_ID || 68),
  ruby: Number(process.env.JUDGE0_RUBY_ID || 72),
  kotlin: Number(process.env.JUDGE0_KOTLIN_ID || 78)
};
const LANGUAGE_NAMES = {python:"Python",javascript:"JavaScript",c:"C",cpp:"C++",java:"Java",csharp:"C#",go:"Go",rust:"Rust",php:"PHP",ruby:"Ruby",kotlin:"Kotlin"};
const headers = () => ({"Content-Type":"application/json", ...(JUDGE0_TOKEN?{"X-Auth-Token":JUDGE0_TOKEN}:{})});

async function fetchWithTimeout(url, options={}, timeoutMs=10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Code execution service request timed out.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function execute(sourceCode, languageId, stdin='', limits={}) {
  if (!Number.isInteger(languageId)) throw new Error('Unsupported programming language.');
  if (String(sourceCode||'').length > 100000) throw new Error('Source code is too large for online execution.');
  const body = {source_code:sourceCode, language_id:languageId, stdin:String(stdin??''), cpu_time_limit:Number(limits.timeLimit||2), memory_limit:Number(limits.memoryLimit||128000)};
  const create = await fetchWithTimeout(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {method:'POST', headers:headers(), body:JSON.stringify(body)}, 10000);
  const createText = await create.text();
  let created; try { created=JSON.parse(createText); } catch { throw new Error(`Code execution service returned invalid JSON (HTTP ${create.status}).`); }
  if (!create.ok) throw new Error(created?.error || created?.message || `Code execution service error (${create.status}).`);
  if (!created.token) throw new Error('Code execution service did not return a submission token.');
  const deadline=Date.now()+15000;
  let delay=300;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,delay));
    const resultRes=await fetchWithTimeout(`${JUDGE0_URL}/submissions/${encodeURIComponent(created.token)}?base64_encoded=false&fields=stdout,stderr,compile_output,status_id,status,time,memory,message`,{headers:headers()},7000);
    const txt=await resultRes.text();
    let result; try { result=JSON.parse(txt); } catch { delay=Math.min(1000,delay+100); continue; }
    if (!resultRes.ok) throw new Error(result?.error || result?.message || `Code result error (${resultRes.status}).`);
    if (![1,2].includes(result.status_id)) return result;
    delay=Math.min(900,delay+100);
  }
  throw new Error('Code execution timed out while waiting for the judge.');
}

async function currentHackathon(){ return Hackathon.findOne({status:{$nin:["closed","archived"]}}).sort({createdAt:-1}); }
async function compilerEnabled(h){ return Boolean(h && h.settings?.compilerEnabled !== false); }
async function teamForUser(hackathonId,userId){
  if(!hackathonId) return null;
  return Team.findOne({hackathon:hackathonId,members:userId});
}
function normalizeOutput(s){ return String(s??"").replace(/\r\n/g,"\n").trim(); }
async function hasPermission(user,name){
  if(user?.role==='admin') return true;
  const role=await Role.findOne({name:user?.role}).lean();
  return !!([...(user?.permissions||[]),...(role?.permissions||[])].includes(name));
}


router.post("/playground/run", auth, async (req,res)=>{
  try {
    // Playground executions are intentionally NOT persisted in MongoDB.
    if(req.user?.role!=="admin" && !(await compilerEnabled(await currentHackathon()))) return res.status(503).json({message:"Online compiler is currently disabled by the administrator."});
    const {language,sourceCode,stdin=""}=req.body||{};
    if(!sourceCode?.trim()) return res.status(400).json({message:"Source code is required."});
    const languageId=LANGUAGE_IDS[language];
    if(!languageId) return res.status(400).json({message:"Unsupported language."});
    const result=await execute(sourceCode,languageId,stdin,{timeLimit:2,memoryLimit:128000});
    res.json({status:result.status?.description||"Unknown",statusId:result.status_id,stdout:result.stdout||"",stderr:result.stderr||"",compileOutput:result.compile_output||"",time:result.time||null,memory:result.memory||null,stored:false});
  } catch(e){res.status(502).json({message:e.message||"Code execution failed."});}
});

router.get("/problems", auth, async (req,res)=>{
  const h=await currentHackathon();
  if(req.user?.role!=="admin" && !(await compilerEnabled(h))) return res.status(503).json({message:"Online compiler is currently disabled by the administrator."});
  const filter={published:true};
  if(req.query.hackathonId) filter.hackathon=req.query.hackathonId;
  else if(h) filter.$or=[{hackathon:null},{hackathon:h._id}];
  else filter.hackathon=null;
  const rows=await Problem.find(filter).select("code title description track difficulty technologies requirements criteria timeLimit memoryLimit published hackathon").sort({hackathon:-1,createdAt:-1});
  res.json(rows);
});

router.get("/languages", auth, async (req,res)=>{ if(req.user?.role!=="admin" && !(await compilerEnabled(await currentHackathon()))) return res.status(503).json({message:"Online compiler is currently disabled by the administrator."}); return res.json(Object.entries(LANGUAGE_IDS).map(([key,id])=>({key,id,name:LANGUAGE_NAMES[key]}))); });

router.get("/problems/:id", auth, async (req,res)=>{
  try {
    if(req.user?.role!=="admin" && !(await compilerEnabled(await currentHackathon()))) return res.status(503).json({message:"Online compiler is currently disabled by the administrator."});
    const h=await currentHackathon();
    const p=await Problem.findById(req.params.id).select("code title description track difficulty technologies requirements criteria timeLimit memoryLimit testCases hackathon published");
    const eventVisible=p && p.published && (p.hackathon==null || (h && String(p.hackathon)===String(h._id)));
    if(!eventVisible) return res.status(404).json({message:"Problem not found"});
    const publicCases=(p.testCases||[]).filter(x=>!x.hidden).map(x=>({input:x.input,expectedOutput:x.expectedOutput}));
    res.json({...p.toObject(),testCases:publicCases});
  } catch(e){res.status(500).json({message:e.message});}
});

router.post("/run", auth, async (req,res)=>{
  try {
    if(req.user?.role!=="admin" && !(await compilerEnabled(await currentHackathon()))) return res.status(503).json({message:"Online compiler is currently disabled by the administrator."});
    const {problemId,language,sourceCode,stdin=""}=req.body||{};
    if(!problemId || !sourceCode?.trim()) return res.status(400).json({message:"Problem and source code are required."});
    if(!/^[a-f\d]{24}$/i.test(String(problemId))) return res.status(404).json({message:"Problem not found. Refresh the Code Lab and choose a published problem."});
    const h=await currentHackathon();
    const p=await Problem.findById(problemId); if(!p || !p.published || (req.user.role!=="admin" && !(p.hackathon==null || (h && String(p.hackathon)===String(h._id))))) return res.status(404).json({message:"Problem not found. Refresh the Code Lab and choose a published problem."});
    const languageId=LANGUAGE_IDS[language]; if(!languageId) return res.status(400).json({message:"Unsupported language."});
    const result=await execute(sourceCode,languageId,stdin,p);
    res.json({status:result.status?.description||"Unknown",statusId:result.status_id,stdout:result.stdout||"",stderr:result.stderr||"",compileOutput:result.compile_output||"",time:result.time||null,memory:result.memory||null});
  } catch(e){res.status(502).json({message:e.message||"Code execution failed."});}
});

router.post("/submit", auth, async (req,res)=>{
  try {
    if(req.user?.role!=="admin" && !(await compilerEnabled(await currentHackathon()))) return res.status(503).json({message:"Online compiler is currently disabled by the administrator."});
    const {problemId,language,sourceCode}=req.body||{};
    if(!problemId || !sourceCode?.trim()) return res.status(400).json({message:"Problem and source code are required."});
    if(!/^[a-f\d]{24}$/i.test(String(problemId))) return res.status(404).json({message:"Problem not found. Refresh the Code Lab and open a published problem."});
    const p=await Problem.findOne({_id:problemId,published:true}); if(!p) return res.status(404).json({message:"Problem not found. Refresh the Code Lab and open a published problem."});
    const h=p.hackathon ? await Hackathon.findById(p.hackathon) : await currentHackathon();
    const active=await currentHackathon();
    if(req.user.role!=="admin" && (!h || !active || String(h._id)!==String(active._id))) return res.status(404).json({message:"This coding problem is not part of the active event."});
    if(h?.settings?.features?.submissions===false) return res.status(503).json({message:"Challenge submissions are currently disabled by the administrator."});
    if(h?.submissionDeadline && new Date()>new Date(h.submissionDeadline)) return res.status(400).json({message:"The coding submission deadline has passed."});
    const team=await teamForUser(h?._id,req.user._id);
    if(req.user.role!=="admin" && !team) return res.status(403).json({message:"Join or create a team before submitting a challenge solution."});
    const languageId=LANGUAGE_IDS[language]; if(!languageId) return res.status(400).json({message:"Unsupported language."});
    const cases=p.testCases||[]; if(!cases.length) return res.status(400).json({message:"This problem has no test cases configured yet."});
    const results=[]; let passed=0;
    for(const tc of cases){
      const r=await execute(sourceCode,languageId,tc.input||"",p);
      const accepted=r.status_id===3 && normalizeOutput(r.stdout)===normalizeOutput(tc.expectedOutput);
      if(accepted) passed++;
      results.push({hidden:!!tc.hidden,passed:accepted,status:r.status?.description||"Unknown",stdout:tc.hidden?"":(r.stdout||""),stderr:r.stderr||"",compileOutput:r.compile_output||"",time:r.time||null,memory:r.memory||null});
      if(r.status_id!==3) break;
    }
    const score=Math.round((passed/cases.length)*100);
    const status=passed===cases.length?"Accepted":results.some(x=>x.status.includes("Compilation"))?"Compilation Error":"Wrong Answer";
    const saved=await CodeSubmission.create({hackathon:h?._id,problem:p._id,team:team?._id,user:req.user._id,language,languageId,sourceCode,mode:"submit",status,score,passed,totalTests:cases.length,results:results.map(x=>({...x,stdout:x.hidden?undefined:x.stdout}))});
    res.json({id:saved._id,status,score,passed,totalTests:cases.length,results});
  } catch(e){res.status(502).json({message:e.message||"Code submission failed."});}
});

router.get("/mine", auth, async (req,res)=>{
  const rows=await CodeSubmission.find({user:req.user._id,mode:"submit"}).populate("problem","code title").sort({createdAt:-1}).limit(50);
  res.json(rows);
});


router.get("/admin/settings", auth, permission("coding.manage","coding.view"), async (req,res)=>{
  const h=await currentHackathon();
  res.json({enabled:h?.settings?.compilerEnabled!==false, eventId:h?._id||null, eventName:h?.name||null, canView:true, canManage:req.user?.role==='admin'||await hasPermission(req.user,'coding.manage'), languages:Object.entries(LANGUAGE_IDS).map(([key,id])=>({key,id,name:LANGUAGE_NAMES[key]}))});
});

router.patch("/admin/settings", auth, permission("coding.manage"), async (req,res)=>{
  const h=await currentHackathon();
  if(!h)return res.status(404).json({message:"No active hackathon."});
  h.settings=h.settings||{};
  h.settings.compilerEnabled=Boolean(req.body?.enabled);
  await h.save();
  res.json({enabled:h.settings.compilerEnabled,eventId:h._id});
});

router.get("/admin/problems", auth, permission("coding.manage","coding.view"), async (req,res)=>{
  const h=await currentHackathon();
  const filter=req.query.hackathonId?{hackathon:req.query.hackathonId}:{};
  res.json(await Problem.find(filter).sort({createdAt:-1}));
});

router.get("/admin/submissions", auth, permission("coding.view"), async (req,res)=>{
  const filter={mode:"submit"};
  if(req.query.problemId) filter.problem=req.query.problemId;
  if(req.query.hackathonId) filter.hackathon=req.query.hackathonId;
  if(req.user.role==='judge'){
    const ids=await JudgeAssignment.find({hackathon:req.query.hackathonId||undefined,judge:req.user._id}).distinct('team');
    filter.team={$in:ids};
  }
  const rows=await CodeSubmission.find(filter).populate("problem","code title").populate("user","name email").populate("team","name").sort({createdAt:-1}).limit(500);
  res.json(rows);
});

export default router;
