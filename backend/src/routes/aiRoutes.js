import express from "express";
import { askAI } from "../ai.js";
import { auth } from "../middleware/auth.js";
import { Hackathon, User, Team, Submission, JudgeAssignment, Evaluation, Problem, Attendance, Certificate, Announcement } from "../models/index.js";

const router = express.Router();
const currentHackathon = () => Hackathon.findOne({status:{$nin:["closed","archived"]}}).sort({createdAt:-1});
const safeUser = u => ({id:u._id,name:u.name,email:u.email,role:u.role,active:u.active,paymentStatus:u.paymentStatus,college:u.college,department:u.department,course:u.course,semester:u.semester,enrollmentId:u.enrollmentId});

async function buildContext(req){
  const h=await currentHackathon();
  if(!h) return {role:req.user.role,currentUser:safeUser(req.user),event:null};
  const base={
    role:req.user.role,
    currentUser:safeUser(req.user),
    event:{id:h._id,name:h.name,description:h.description,college:h.college,venue:h.venue,registrationFee:h.registrationFee,teamMin:h.teamMin,teamMax:h.teamMax,status:h.status,registrationDeadline:h.registrationDeadline,hackStart:h.hackStart,hackEnd:h.hackEnd,submissionDeadline:h.submissionDeadline,judgingStart:h.judgingStart,judgingEnd:h.judgingEnd,resultsAt:h.resultsAt,tracks:h.tracks||[],prizes:h.prizes||[],timeline:h.timeline||[],settings:{aiEnabled:h.settings?.aiEnabled!==false,compilerEnabled:h.settings?.compilerEnabled!==false,publicLeaderboard:Boolean(h.settings?.publicLeaderboard)}}
  };

  if(req.user.role==='admin'){
    const [participants,teams,submissions,judges,assignments,evaluations,problems,attendance,certificates,announcements]=await Promise.all([
      User.find({role:'participant'}).select('name email active paymentStatus college department enrollmentId').sort({createdAt:-1}).limit(500).lean(),
      Team.find({hackathon:h._id}).populate('leader','name email').populate('members','name email').populate('problem','code title').lean(),
      Submission.find({hackathon:h._id}).populate('team','name code').populate('problem','code title').select('projectName status submittedAt team problem github liveDemo').lean(),
      User.countDocuments({role:'judge',active:true}),
      JudgeAssignment.find({hackathon:h._id}).populate('judge','name email').populate('team','name code').lean(),
      Evaluation.find({submitted:true}).populate('judge','name').populate('team','name code').select('judge team total submittedAt').lean(),
      Problem.find({hackathon:h._id}).select('code title track difficulty published').lean(),
      Attendance.countDocuments({hackathon:h._id}),
      Certificate.countDocuments({hackathon:h._id}),
      Announcement.find({hackathon:h._id}).select('title type published createdAt').sort({createdAt:-1}).limit(20).lean()
    ]);
    base.adminData={participants,participantCount:participants.length,teams,teamCount:teams.length,submissions,submissionCount:submissions.length,judgeCount:judges,assignments,evaluations,problemCount:problems.length,problems,attendanceRecords:attendance,certificateCount:certificates,announcements};
  } else if(req.user.role==='judge'){
    const assignments=await JudgeAssignment.find({hackathon:h._id,judge:req.user._id}).populate({path:'team',populate:[{path:'members',select:'name email'},{path:'problem',select:'code title description'}]}).lean();
    const teamIds=assignments.map(a=>a.team?._id).filter(Boolean);
    const submissions=await Submission.find({hackathon:h._id,team:{$in:teamIds}}).populate('team','name code').populate('problem','code title').select('projectName status submittedAt team problem github liveDemo description techStack').lean();
    const evaluations=await Evaluation.find({judge:req.user._id,team:{$in:teamIds}}).select('team total submitted submittedAt comments').lean();
    base.judgeData={assignments,submissions,evaluations};
  } else if(req.user.role==='participant'){
    const teams=await Team.find({hackathon:h._id,members:req.user._id}).populate('leader','name email').populate('members','name email').populate('problem','code title description').lean();
    const teamIds=teams.map(t=>t._id);
    const submissions=await Submission.find({hackathon:h._id,team:{$in:teamIds}}).populate('problem','code title').select('projectName status submittedAt problem github liveDemo description techStack').lean();
    const [attendance,certificates,announcements,problems]=await Promise.all([
      Attendance.find({hackathon:h._id,user:req.user._id}).select('type at').sort({at:-1}).limit(50).lean(),
      Certificate.find({hackathon:h._id,user:req.user._id}).populate('hackathon','name').select('type certificateId issuedAt').lean(),
      Announcement.find({hackathon:h._id,published:true}).select('title message type createdAt').sort({createdAt:-1}).limit(20).lean(),
      Problem.find({hackathon:h._id,published:true}).select('code title description track difficulty technologies').lean()
    ]);
    base.participantData={teams,submissions,attendance,certificates,announcements,problems};
  } else {
    base.roleData={message:"Only role-authorized operational information is available to this assistant."};
  }
  return base;
}

router.get("/status", auth, async (req,res)=>{
  const h=await currentHackathon();
  const participantEnabled=Boolean(h && h.settings?.aiEnabled !== false);
  res.json({enabled:req.user.role==='admin'||participantEnabled,participantAccess:participantEnabled,adminAlwaysAvailable:true,eventId:h?._id||null});
});

router.get("/test", (req,res)=>res.json({ok:true,message:"AI routes are connected!"}));

router.post("/chat", auth, async (req,res)=>{
  try{
    const question=String(req.body?.question ?? req.body?.message ?? '').trim();
    if(!question)return res.status(400).json({message:"AI question is required."});
    const h=await currentHackathon();
    if(req.user.role!=='admin' && (!h || h.settings?.aiEnabled===false)) return res.status(503).json({message:"AI assistance is currently disabled for participants by the administrator."});
    const context=await buildContext(req);
    const result=await askAI(question,context);
    res.json({answer:result.answer,model:result.model,usage:result.usage});
  }catch(error){
    console.error('AI ERROR:',error);
    res.status(500).json({message:error.message||"AI service error"});
  }
});

export default router;
