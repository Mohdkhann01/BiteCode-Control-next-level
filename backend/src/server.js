

import 'dotenv/config';
import dns from 'node:dns';
import net from 'node:net';
import express from 'express'; import cors from 'cors'; import mongoose from 'mongoose'; import bcrypt from 'bcryptjs'; import rateLimit from 'express-rate-limit'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import {User,Hackathon,Role,Payment,Team,Invitation,Problem,Submission,JudgeAssignment,Evaluation,CodeSubmission,Announcement,Ticket,Vote,Attendance,Certificate,AuditLog,AntiCheat,Notification,Feedback} from './models/index.js';
import {auth,allow,permission} from './middleware/auth.js'; 


import aiRoutes from "./routes/aiRoutes.js";
import compilerRoutes from "./routes/compilerRoutes.js";

import {upload} from './middleware/upload.js'; import {tokenFor,code,certId,audit} from './utils.js';
import {mailConfigured,sendFeedbackConfirmation} from './mailer.js';


const app = express();

// CORS: configure the exact frontend origin(s) in Render environment variables.
// You can provide comma-separated origins in FRONTEND_URL or CORS_ORIGINS.
// Example: FRONTEND_URL=https://your-site.vercel.app
const normalizeOrigin = (value) => {
  try {
    return new URL(String(value).trim()).origin;
  } catch {
    return '';
  }
};

const configuredOrigins = [
  process.env.CORS_ORIGINS || '',
  process.env.FRONTEND_URL || '',
  process.env.CLIENT_URL || '',
  process.env.APP_URL || ''
]
  .join(',')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const localDevelopmentOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

const allowedOrigins = new Set([...configuredOrigins, ...localDevelopmentOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    // Requests without an Origin header are usually server-to-server or health checks.
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // Do not throw an application error for a blocked browser origin; simply
    // omit CORS permission. The browser will block the response.
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({
  limit: '5mb',
  verify:(req,_res,buf)=>{if(req.originalUrl==='/api/payments/razorpay/webhook')req.rawBody=Buffer.from(buf);}
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
}));

// AI routes MUST come after express.json()
app.use('/api/ai', aiRoutes);
app.use('/api/compiler', compilerRoutes);


const uploadDir=process.env.UPLOAD_DIR||'uploads'; fs.mkdirSync(uploadDir,{recursive:true}); app.use('/uploads',express.static(path.resolve(uploadDir)));
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const isValidObjectId=value=>mongoose.Types.ObjectId.isValid(String(value||''));
const current=async()=>Hackathon.findOne({status:{$nin:['closed','archived']}}).sort({createdAt:-1});
const safe=u=>{const o=u.toObject();delete o.passwordHash;delete o.passwordResetToken;delete o.passwordResetExpires;delete o.attendanceToken;return o};
const ensureAttendanceToken=async u=>{if(u.attendanceToken)return u.attendanceToken;for(let i=0;i<5;i++){const t=crypto.randomBytes(24).toString('base64url');try{u.attendanceToken=t;await u.save();return t}catch(e){if(e?.code!==11000)throw e;}}throw new Error('Could not create a unique attendance token.');};
const validateEvent=body=>{if(body.teamMin!=null&&body.teamMax!=null&&Number(body.teamMin)>Number(body.teamMax))return 'Team minimum cannot exceed team maximum';return null};

app.get('/api',(_,res)=>res.json({ok:true,service:'BiteCode Control API',version:'2.1.0'}));
app.get('/api/health',(_,res)=>res.json({ok:true,service:'hackathon-platform',database:mongoose.connection.readyState===1,time:new Date().toISOString()}));
app.get('/api/system/status',asyncRoute(async(req,res)=>{
  const h=await current();
  res.json({ok:mongoose.connection.readyState===1,event:h?{id:h._id,name:h.name,status:h.status}:null,services:{feedback:true,razorpay:razorpayConfigured(),compiler:Boolean(process.env.JUDGE0_URL||'https://ce.judge0.com'),ai:Boolean(process.env.OPENROUTER_API_KEY),gmail:mailConfigured()}});
}));
app.post('/api/auth/register',asyncRoute(async(req,res)=>{const {name,email,password}=req.body;if(!name||!email||!password||password.length<8)return res.status(400).json({message:'Name, email and password (8+ chars) are required'});if(await User.exists({email:email.toLowerCase()}))return res.status(409).json({message:'Email already registered'});const u=await User.create({name,email:email.toLowerCase(),passwordHash:await bcrypt.hash(password,12),attendanceToken:crypto.randomBytes(24).toString('base64url')});res.status(201).json({token:tokenFor(u),user:safe(u)})}));
app.post('/api/auth/login',asyncRoute(async(req,res)=>{const email=req.body.email?.toLowerCase().trim();const u=await User.findOne({email});if(!u||!await bcrypt.compare(req.body.password||'',u.passwordHash))return res.status(401).json({message:'Invalid email or password'});if(u.active===false)return res.status(403).json({message:'This account is disabled. Please contact an administrator.'});res.json({token:tokenFor(u),user:safe(u)})}));
app.get('/api/auth/me',auth,(req,res)=>res.json({user:safe(req.user)}));
app.patch('/api/auth/me',auth,asyncRoute(async(req,res)=>{const allowed=['name','phone','college','department','course','semester','enrollmentId','group','year','photo','github','linkedin','portfolio','skills','bio'];for(const k of allowed)if(k in req.body)req.user[k]=req.body[k];await req.user.save();res.json({user:safe(req.user)})}));
app.post('/api/auth/change-password',auth,asyncRoute(async(req,res)=>{if(!req.body.newPassword||req.body.newPassword.length<8)return res.status(400).json({message:'Password must be 8+ chars'});req.user.passwordHash=await bcrypt.hash(req.body.newPassword,12);await req.user.save();res.json({message:'Password changed'})}));
app.post('/api/auth/reset/request',asyncRoute(async(req,res)=>{const u=await User.findOne({email:req.body.email?.toLowerCase()});if(!u)return res.json({message:'If the account exists, a reset link has been generated.'});u.passwordResetToken=crypto.randomBytes(24).toString('hex');u.passwordResetExpires=new Date(Date.now()+30*60*1000);await u.save();const base=process.env.FRONTEND_URL?.split(',')[0]||'http://localhost:5173';res.json({message:'Reset link generated.',resetUrl:`${base}/reset-password?token=${u.passwordResetToken}`})}));
app.post('/api/auth/reset/confirm',asyncRoute(async(req,res)=>{const u=await User.findOne({passwordResetToken:req.body.token,passwordResetExpires:{$gt:new Date()}});if(!u)return res.status(400).json({message:'Reset link is invalid or expired'});if(!req.body.password||req.body.password.length<8)return res.status(400).json({message:'Password must be 8+ chars'});u.passwordHash=await bcrypt.hash(req.body.password,12);u.passwordResetToken=undefined;u.passwordResetExpires=undefined;await u.save();res.json({message:'Password reset successfully'})}));

// AI service controls
app.get('/api/admin/ai/settings',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await current();res.json({enabled:h?.settings?.aiEnabled!==false,mode:h?.settings?.aiMode==='guidance'?'guidance':'full',enabledForEvent:Boolean(h),mailConfigured}); }));
app.patch('/api/admin/ai/settings',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await current();if(!h)return res.status(404).json({message:'No active hackathon'});h.settings=h.settings||{};if(req.body.enabled!==undefined)h.settings.aiEnabled=Boolean(req.body.enabled);if(req.body.mode!==undefined){const mode=String(req.body.mode);if(!['full','guidance'].includes(mode))return res.status(400).json({message:'AI mode must be full or guidance.'});h.settings.aiMode=mode;}await h.save();await audit(AuditLog,req.user,'UPDATE','AISettings',h._id,{enabled:h.settings.aiEnabled,mode:h.settings.aiMode||'full'});res.json({enabled:h.settings.aiEnabled!==false,mode:h.settings.aiMode==='guidance'?'guidance':'full',mailConfigured});}));
app.patch('/api/admin/events/:id/feature',auth,allow('admin'),asyncRoute(async(req,res)=>{const allowed=['payments','teams','submissions','judging','announcements','certificates','attendance'];const key=String(req.body?.key||'');if(!allowed.includes(key))return res.status(400).json({message:'Invalid event feature'});const h=await Hackathon.findById(req.params.id);if(!h)return res.status(404).json({message:'Hackathon not found'});h.settings=h.settings||{};h.settings.features=h.settings.features||{};h.settings.features[key]=Boolean(req.body.enabled);await h.save();await audit(AuditLog,req.user,'UPDATE','EventFeature',h._id,{key,enabled:h.settings.features[key]});res.json({key,enabled:h.settings.features[key]});}));

// Events
app.get('/api/hackathons/current',asyncRoute(async(req,res)=>res.json(await current())));
app.get('/api/hackathons',auth,allow('admin'),asyncRoute(async(req,res)=>res.json(await Hackathon.find().sort({createdAt:-1}))));
app.post('/api/hackathons',auth,allow('admin'),asyncRoute(async(req,res)=>{const err=validateEvent(req.body);if(err)return res.status(400).json({message:err});const h=await Hackathon.create(req.body);await audit(AuditLog,req.user,'CREATE','Hackathon',h._id,{name:h.name});res.status(201).json(h)}));
app.get('/api/hackathons/:id',auth,asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.params.id);if(!h)return res.status(404).json({message:'Hackathon not found'});res.json(h)}));
app.patch('/api/hackathons/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const err=validateEvent(req.body);if(err)return res.status(400).json({message:err});const h=await Hackathon.findByIdAndUpdate(req.params.id,req.body,{returnDocument:'after',runValidators:true});if(!h)return res.status(404).json({message:'Hackathon not found'});await audit(AuditLog,req.user,'UPDATE','Hackathon',h._id);res.json(h)}));
app.delete('/api/hackathons/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.params.id);if(!h)return res.status(404).json({message:'Hackathon not found'});await Hackathon.findByIdAndDelete(req.params.id);await audit(AuditLog,req.user,'DELETE','Hackathon',h._id,{name:h.name});res.json({message:'Event deleted'})}));
app.patch('/api/hackathons/:id/archive',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await Hackathon.findByIdAndUpdate(req.params.id,{status:'archived'},{returnDocument:'after'});if(!h)return res.status(404).json({message:'Hackathon not found'});res.json(h)}));
app.patch('/api/hackathons/:id/activate',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.params.id);if(!h)return res.status(404).json({message:'Hackathon not found'});await Hackathon.updateMany({_id:{$ne:h._id},status:{$nin:['closed','archived']}},{$set:{status:'closed'}});if(h.status==='closed'||h.status==='archived')h.status='draft';await h.save();res.json(h)}));
app.post('/api/hackathons/:id/duplicate',auth,allow('admin'),asyncRoute(async(req,res)=>{const s=await Hackathon.findById(req.params.id);if(!s)return res.status(404).json({message:'Hackathon not found'});let slug=`${s.slug}-copy`,n=2;while(await Hackathon.exists({slug}))slug=`${s.slug}-copy-${n++}`;const c=s.toObject();delete c._id;delete c.createdAt;delete c.updatedAt;c.name=`${s.name} Copy`;c.slug=slug;c.status='draft';const h=await Hackathon.create(c);res.status(201).json(h)}));


// Participants and roles
app.get('/api/users/judges',auth,allow('admin'),asyncRoute(async(req,res)=>res.json(await User.find({role:'judge'}).select('name email active createdAt'))));
app.post('/api/admin/judges',auth,allow('admin'),asyncRoute(async(req,res)=>{const {name,email,password}=req.body;if(!name||!email)return res.status(400).json({message:'Name and email required'});if(await User.exists({email:email.toLowerCase()}))return res.status(409).json({message:'Email already exists'});const u=await User.create({name,email:email.toLowerCase(),passwordHash:await bcrypt.hash(password||'Judge123!',12),role:'judge',attendanceToken:crypto.randomBytes(24).toString('base64url')});res.status(201).json(safe(u))}));
app.get('/api/admin/participants',auth,allow('admin'),asyncRoute(async(req,res)=>{const q=(req.query.q||'').trim();const filter=q?{$or:[{name:new RegExp(q,'i')},{email:new RegExp(q,'i')},{enrollmentId:new RegExp(q,'i')}] }:{};res.json(await User.find(filter).select('-passwordHash -passwordResetToken -passwordResetExpires').sort({createdAt:-1}))}));
app.post('/api/admin/participants',auth,allow('admin'),asyncRoute(async(req,res)=>{const {name,email,password,phone,college,department,course,semester,enrollmentId,group,year,role}=req.body;if(!name||!email||!password||password.length<8)return res.status(400).json({message:'Name, email and password (8+ chars) are required'});const normalizedEmail=email.toLowerCase().trim();if(await User.exists({email:normalizedEmail}))return res.status(409).json({message:'Email already registered'});const allowed=['participant','admin','finance','judge','mentor','volunteer'];const userRole=role&&allowed.includes(role)?role:'participant';const u=await User.create({name,email:normalizedEmail,passwordHash:await bcrypt.hash(password,12),phone,college,department,course,semester,enrollmentId,role:userRole,group,year,attendanceToken:crypto.randomBytes(24).toString('base64url')});await audit(AuditLog,req.user,'CREATE','User',u._id,{name:u.name,email:u.email,role:u.role});res.status(201).json(safe(u))}));
app.delete('/api/admin/participants/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{if(String(req.params.id)===String(req.user._id))return res.status(400).json({message:'You cannot remove your own account'});const u=await User.findById(req.params.id);if(!u)return res.status(404).json({message:'User not found'});if(u.role==='admin')return res.status(400).json({message:'Admin accounts cannot be removed here'});const ledTeams=await Team.find({leader:u._id});for(const team of ledTeams){team.members=team.members.filter(member=>String(member)!==String(u._id));if(team.members.length){team.leader=team.members[0];team.status=team.members.length>=3?'confirmed':'incomplete';await team.save();}else{await Team.findByIdAndDelete(team._id);}}await Team.updateMany({members:u._id},{$pull:{members:u._id}});await Invitation.deleteMany({$or:[{from:u._id},{to:u._id}]});await Attendance.deleteMany({user:u._id});await Certificate.deleteMany({user:u._id});await User.findByIdAndDelete(u._id);await audit(AuditLog,req.user,'DELETE','User',u._id,{name:u.name,email:u.email,role:u.role});res.json({message:'Participant removed'});}));
app.patch('/api/admin/users/:id/role',auth,allow('admin'),asyncRoute(async(req,res)=>{const allowed=['participant','admin','finance','judge','mentor','volunteer'];if(!allowed.includes(req.body.role))return res.status(400).json({message:'Invalid role'});const u=await User.findByIdAndUpdate(req.params.id,{role:req.body.role},{returnDocument:'after'}).select('-passwordHash');if(!u)return res.status(404).json({message:'User not found'});res.json(u)}));
app.patch('/api/admin/users/:id/status',auth,allow('admin'),asyncRoute(async(req,res)=>{const u=await User.findByIdAndUpdate(req.params.id,{active:Boolean(req.body.active)},{returnDocument:'after'}).select('-passwordHash');if(!u)return res.status(404).json({message:'User not found'});res.json(u)}));
app.post('/api/admin/users/:id/reset-link',auth,allow('admin'),asyncRoute(async(req,res)=>{const u=await User.findById(req.params.id);if(!u)return res.status(404).json({message:'User not found'});u.passwordResetToken=crypto.randomBytes(24).toString('hex');u.passwordResetExpires=new Date(Date.now()+30*60*1000);await u.save();const base=process.env.FRONTEND_URL?.split(',')[0]||'http://localhost:5173';res.json({resetUrl:`${base}/reset-password?token=${u.passwordResetToken}`})}));
const defaultRoles=[['admin','Full platform control',['events.manage','participants.manage','teams.manage','problems.manage','judging.manage','payments.manage','website.manage','roles.manage','coding.view','coding.manage']],['finance','Payment operations',['payments.manage']],['judge','Evaluation workspace',['judging.evaluate','coding.view']],['mentor','Team guidance',['teams.view','submissions.view']],['volunteer','On-ground operations',['attendance.manage','teams.view']],['participant','Builder account',['profile.manage','teams.self','submissions.self']]];
app.get('/api/admin/roles',auth,allow('admin'),asyncRoute(async(req,res)=>{for(const [name,description,permissions] of defaultRoles)await Role.updateOne({name},{$set:{description,permissions,system:true},$setOnInsert:{name}},{upsert:true});res.json(await Role.find().sort({system:-1,name:1}))}));
app.post('/api/admin/roles',auth,allow('admin'),asyncRoute(async(req,res)=>res.status(201).json(await Role.create({name:req.body.name,description:req.body.description,permissions:req.body.permissions||[]}))));
app.patch('/api/admin/roles/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const r=await Role.findByIdAndUpdate(req.params.id,{name:req.body.name,description:req.body.description,permissions:req.body.permissions||[]},{returnDocument:'after',runValidators:true});res.json(r)}));
app.delete('/api/admin/roles/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const r=await Role.findById(req.params.id);if(!r)return res.status(404).json({message:'Role not found'});if(r.system)return res.status(400).json({message:'System roles cannot be deleted'});await r.deleteOne();res.json({message:'Role deleted'})}));

// Razorpay helpers. The secret key stays server-side; the browser receives only the public key id.
const razorpayConfigured=()=>Boolean(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET);
const razorpayAuth=()=>Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
const razorpayRequest=async(pathname,{method='GET',body}={})=>{
  if(!razorpayConfigured())throw new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server environment.');
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch(`https://api.razorpay.com/v1${pathname}`,{method,headers:{Authorization:`Basic ${razorpayAuth()}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={message:text}};
    if(!r.ok){const err=new Error(data?.error?.description||data?.message||`Razorpay request failed (${r.status})`);err.status=r.status;throw err;}
    return data;
  }finally{clearTimeout(timer)}
};
const safeSignatureEqual=(expected,actual)=>{const a=Buffer.from(String(expected||''));const b=Buffer.from(String(actual||''));return a.length===b.length&&crypto.timingSafeEqual(a,b);};
const verifyRazorpaySignature=(orderId,paymentId,signature)=>safeSignatureEqual(crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'),signature);
const markRazorpayPaid=async({orderId,paymentId,signature})=>{
  const p=await Payment.findOne({razorpayOrderId:orderId,method:'razorpay'}); if(!p)throw new Error('Payment order not found');
  if(!verifyRazorpaySignature(orderId,paymentId,signature))throw new Error('Invalid Razorpay payment signature');
  const payment=await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if(String(payment.order_id)!==String(orderId))throw new Error('Razorpay payment does not belong to this order');
  p.razorpayPaymentId=paymentId; p.razorpaySignature=signature;
  if(payment.status==='captured'||payment.captured===true){p.status='paid';p.reviewedAt=new Date();await p.save();await User.findByIdAndUpdate(p.user,{paymentStatus:'paid'});await notifyUsers([p.user],{hackathon:p.hackathon,title:'Payment successful',message:`Your Razorpay registration payment of ₹${p.amount.toLocaleString('en-IN')} was verified successfully.`,type:'success',link:'/dashboard/payment'});return {payment:p,razorpay:payment};}
  await p.save(); return {payment:p,razorpay:payment};
};

app.get('/api/payments/razorpay/config',auth,asyncRoute(async(req,res)=>{
  const h=await Hackathon.findById(req.query.hackathonId||''); if(!h)return res.status(404).json({message:'Hackathon not found'});
  if(!featureEnabled(h,'payments'))return res.status(503).json({message:'Registration payments are currently disabled by the administrator.'});
  if(h.registrationFee===0)return res.json({enabled:false,reason:'No registration fee'});
  res.json({enabled:razorpayConfigured(),keyId:process.env.RAZORPAY_KEY_ID||'',currency:'INR',amount:h.registrationFee,name:h.name,description:`${h.name} registration`});
}));

app.post('/api/payments/razorpay/order',auth,asyncRoute(async(req,res)=>{
  const h=await Hackathon.findById(req.body.hackathonId); if(!h)return res.status(404).json({message:'Hackathon not found'});
  if(!featureEnabled(h,'payments'))return res.status(503).json({message:'Registration payments are currently disabled by the administrator.'});
  if(h.registrationFee<=0)return res.status(400).json({message:'This event has no registration fee.'});
  if(!razorpayConfigured())return res.status(503).json({message:'Online payment is not configured yet. Please contact the administrator.'});
  if(await Payment.exists({hackathon:h._id,user:req.user._id,status:'paid'}))return res.status(409).json({message:'Your registration payment is already approved.'});
  const existing=await Payment.findOne({hackathon:h._id,user:req.user._id,method:'razorpay',status:'pending',amount:h.registrationFee,razorpayOrderId:{$exists:true}}).sort({createdAt:-1});
  if(existing){return res.json({orderId:existing.razorpayOrderId,amount:existing.amount,currency:'INR',keyId:process.env.RAZORPAY_KEY_ID,name:h.name,description:`${h.name} registration`,prefill:{name:req.user.name,email:req.user.email,contact:req.user.phone||''}})}
  const receipt=`BC-${String(req.user._id).slice(-8)}-${Date.now().toString(36)}`.slice(0,40);
  const order=await razorpayRequest('/orders',{method:'POST',body:{amount:Math.round(Number(h.registrationFee)*100),currency:'INR',receipt,partial_payment:false,notes:{hackathonId:String(h._id),userId:String(req.user._id),email:req.user.email}}});
  await Payment.create({hackathon:h._id,user:req.user._id,amount:h.registrationFee,method:'razorpay',razorpayOrderId:order.id,status:'pending'});
  req.user.paymentStatus='pending'; await req.user.save();
  res.status(201).json({orderId:order.id,amount:h.registrationFee,currency:'INR',keyId:process.env.RAZORPAY_KEY_ID,name:h.name,description:`${h.name} registration`,prefill:{name:req.user.name,email:req.user.email,contact:req.user.phone||''}});
}));

app.post('/api/payments/razorpay/verify',auth,asyncRoute(async(req,res)=>{
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body||{};
  if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return res.status(400).json({message:'Incomplete Razorpay payment response.'});
  const p=await Payment.findOne({razorpayOrderId:razorpay_order_id,user:req.user._id}); if(!p)return res.status(404).json({message:'Payment order not found for this account.'});
  try{
    const result=await markRazorpayPaid({orderId:razorpay_order_id,paymentId:razorpay_payment_id,signature:razorpay_signature});
    res.json({ok:true,status:result.payment.status,message:result.payment.status==='paid'?'Payment verified successfully.':'Payment received and awaiting capture.'});
  }catch(e){
    const permanent=/Invalid Razorpay payment signature|does not belong to this order|Payment order not found/i.test(String(e.message||''));
    if(permanent){p.status='failed';p.rejectionReason=e.message;await p.save().catch(()=>{});return res.status(400).json({message:e.message||'Payment verification failed.'});}
    console.error('Razorpay verification temporarily failed:',e.message);
    return res.status(502).json({message:'Razorpay verification is temporarily unavailable. Your payment remains pending; please refresh and check payment status.'});
  }
}));

app.post('/api/payments/razorpay/webhook',asyncRoute(async(req,res)=>{
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  if(!secret)return res.status(503).json({message:'Razorpay webhook secret is not configured.'});
  const signature=req.headers['x-razorpay-signature'];
  const expected=crypto.createHmac('sha256',secret).update(req.rawBody||Buffer.from(JSON.stringify(req.body||{}))).digest('hex');
  if(!signature||!safeSignatureEqual(expected,signature))return res.status(401).json({message:'Invalid webhook signature'});
  const event=req.body||{};
  const entity=event.payload?.payment?.entity||event.payload?.order?.entity;
  const orderId=entity?.order_id||entity?.id;
  if(event.event==='payment.captured'&&entity?.id&&orderId){try{const p=await Payment.findOne({razorpayOrderId:orderId});if(p){p.razorpayPaymentId=entity.id;p.status='paid';p.reviewedAt=new Date();await p.save();await User.findByIdAndUpdate(p.user,{paymentStatus:'paid'});}}catch(e){console.error('Razorpay webhook processing failed:',e.message)}}
  if(event.event==='payment.failed'&&orderId){const p=await Payment.findOne({razorpayOrderId:orderId});if(p&&p.status!=='paid'){p.status='failed';p.rejectionReason=entity?.error_description||'Razorpay payment failed';await p.save();}}
  res.json({ok:true});
}));

// Razorpay payments only. Manual UPI / payment-proof approval is intentionally removed.
app.get('/api/payments/mine',auth,asyncRoute(async(req,res)=>res.json(await Payment.find({user:req.user._id,method:'razorpay'}).populate('hackathon','name registrationFee').sort({createdAt:-1}))));
app.get('/api/admin/payments',auth,permission('payments.manage'),asyncRoute(async(req,res)=>res.json(await Payment.find({method:'razorpay'}).populate('user','name email enrollmentId').populate('hackathon','name').sort({createdAt:-1}))));
app.post('/api/admin/payments/:id/sync',auth,permission('payments.manage'),asyncRoute(async(req,res)=>{const p=await Payment.findOne({_id:req.params.id,method:'razorpay'});if(!p)return res.status(404).json({message:'Razorpay payment not found'});if(!p.razorpayPaymentId)return res.status(400).json({message:'Razorpay payment id is not available yet.'});const payment=await razorpayRequest(`/payments/${encodeURIComponent(p.razorpayPaymentId)}`);if(String(payment.order_id)!==String(p.razorpayOrderId))return res.status(400).json({message:'Razorpay order mismatch.'});if(payment.status==='captured'||payment.captured===true){p.status='paid';p.reviewedAt=new Date();await p.save();await User.findByIdAndUpdate(p.user,{paymentStatus:'paid'});}else if(payment.status==='failed'){p.status='failed';p.rejectionReason=payment.error_description||'Razorpay payment failed';await p.save();}res.json({status:p.status,razorpayStatus:payment.status});}));

const paid=async(uid,h)=>{if(h?.registrationFee===0)return true;const p=await Payment.findOne({hackathon:h._id,user:uid,method:'razorpay',status:'paid'}).select('_id');return Boolean(p)};
const featureEnabled=(h,key)=>h?.settings?.features?.[key]!==false;
// Teams
app.get('/api/teams/mine',auth,asyncRoute(async(req,res)=>res.json(await Team.find({members:req.user._id}).populate('members','name email enrollmentId paymentStatus role').populate('problem','code title'))));
app.post('/api/teams',auth,asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.body.hackathonId);if(!h)return res.status(404).json({message:'Hackathon not found'});if(!featureEnabled(h,'teams'))return res.status(503).json({message:'Team formation is currently disabled by the administrator.'});if(!await paid(req.user._id,h))return res.status(403).json({message:'Payment must be approved before team creation'});const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({message:'Team name is required'});if(await Team.exists({hackathon:h._id,members:req.user._id}))return res.status(409).json({message:'You are already in a team'});const t=await Team.create({hackathon:h._id,name,code:code(),leader:req.user._id,members:[req.user._id],status:h.teamMin<=1?'confirmed':'incomplete'});res.status(201).json(await Team.findById(t._id).populate('members','name email enrollmentId paymentStatus role'))}));
app.get('/api/admin/teams',auth,permission('teams.view','teams.manage'),asyncRoute(async(req,res)=>res.json(await Team.find(req.query.hackathonId?{hackathon:req.query.hackathonId}:{}).populate('leader','name email').populate('members','name email enrollmentId role paymentStatus').populate('problem','code title').sort({createdAt:-1}))));
app.patch('/api/admin/teams/:id',auth,permission('teams.manage'),asyncRoute(async(req,res)=>{
  const t=await Team.findById(req.params.id);
  if(!t)return res.status(404).json({message:'Team not found'});
  if(req.body.name!=null)t.name=String(req.body.name).trim();
  if(req.body.status!=null){const allowed=['incomplete','confirmed','submitted','locked'];if(!allowed.includes(req.body.status))return res.status(400).json({message:'Invalid team status'});t.status=req.body.status;}
  if(req.body.problem!==undefined){if(req.body.problem){const p=await Problem.findOne({_id:req.body.problem,hackathon:t.hackathon});if(!p)return res.status(400).json({message:'Problem does not belong to this hackathon'});t.problem=p._id;}else t.problem=undefined;}
  if(!t.name)return res.status(400).json({message:'Team name is required'});
  await t.save();
  await audit(AuditLog,req.user,'UPDATE','Team',t._id,{name:t.name,status:t.status,problem:t.problem});
  res.json(await t.populate([{path:'leader',select:'name email enrollmentId'},{path:'members',select:'name email enrollmentId role paymentStatus'},{path:'problem',select:'code title'}]));
}));
app.post('/api/admin/teams',auth,permission('teams.manage'),asyncRoute(async(req,res)=>{
  const {hackathonId,name,leaderId,memberIds=[]}=req.body||{};
  const h=await Hackathon.findById(hackathonId); if(!h)return res.status(404).json({message:'Hackathon not found'});
  if(!featureEnabled(h,'teams'))return res.status(503).json({message:'Team formation is currently disabled for this event.'});
  if(!name?.trim()||!leaderId)return res.status(400).json({message:'Team name and leader are required'});
  const ids=[leaderId,...(Array.isArray(memberIds)?memberIds:[])].map(String).filter(Boolean);
  const unique=[...new Set(ids)];
  if(unique.length>h.teamMax)return res.status(400).json({message:`Team cannot exceed ${h.teamMax} members`});
  const users=await User.find({_id:{$in:unique},role:'participant',active:true}).select('_id name email');
  if(users.length!==unique.length)return res.status(400).json({message:'All selected members must be active participant accounts'});
  const occupied=await Team.findOne({hackathon:h._id,members:{$in:unique}});
  if(occupied)return res.status(409).json({message:`A selected participant is already in team ${occupied.name}`});
  const t=await Team.create({hackathon:h._id,name:name.trim(),code:code(),leader:leaderId,members:unique,status:unique.length>=h.teamMin?'confirmed':'incomplete'});
  await audit(AuditLog,req.user,'CREATE','Team',t._id,{name:t.name,members:unique});
  res.status(201).json(await t.populate([{path:'leader',select:'name email enrollmentId'},{path:'members',select:'name email enrollmentId role paymentStatus'}]));
}));
app.post('/api/admin/teams/:id/members',auth,permission('teams.manage'),asyncRoute(async(req,res)=>{
  const t=await Team.findById(req.params.id); if(!t)return res.status(404).json({message:'Team not found'});
  if(t.status==='locked')return res.status(400).json({message:'Locked teams cannot be changed'});
  const h=await Hackathon.findById(t.hackathon); if(!h)return res.status(404).json({message:'Hackathon not found'}); if(!featureEnabled(h,'teams'))return res.status(503).json({message:'Team formation is currently disabled for this event.'}); const u=await User.findById(req.body.userId);
  if(!u||u.role!=='participant'||!u.active)return res.status(404).json({message:'Active participant not found'});
  if(t.members.some(x=>String(x)===String(u._id)))return res.status(409).json({message:'Participant is already in this team'});
  if(t.members.length>=h.teamMax)return res.status(400).json({message:'Team is full'});
  if(await Team.exists({hackathon:h._id,members:u._id}))return res.status(409).json({message:'Participant is already in another team'});
  t.members.push(u._id); if(t.members.length>=h.teamMin&&t.status==='incomplete')t.status='confirmed'; await t.save();
  await audit(AuditLog,req.user,'UPDATE','Team',t._id,{action:'ADD_MEMBER',user:u._id});
  res.json(await t.populate([{path:'leader',select:'name email enrollmentId'},{path:'members',select:'name email enrollmentId role paymentStatus'},{path:'problem',select:'code title'}]));
}));
app.delete('/api/admin/teams/:id/members/:uid',auth,permission('teams.manage'),asyncRoute(async(req,res)=>{
  const t=await Team.findById(req.params.id); if(!t)return res.status(404).json({message:'Team not found'});
  if(String(t.leader)===String(req.params.uid))return res.status(400).json({message:'Transfer leadership before removing the team leader'});
  const h=await Hackathon.findById(t.hackathon); t.members=t.members.filter(x=>String(x)!==String(req.params.uid)); if(t.members.length<(h?.teamMin||1))t.status='incomplete'; await t.save();
  await audit(AuditLog,req.user,'UPDATE','Team',t._id,{action:'REMOVE_MEMBER',user:req.params.uid});
  res.json(await t.populate([{path:'leader',select:'name email enrollmentId'},{path:'members',select:'name email enrollmentId role paymentStatus'},{path:'problem',select:'code title'}]));
}));
app.patch('/api/admin/teams/:id/leader',auth,permission('teams.manage'),asyncRoute(async(req,res)=>{
  const t=await Team.findById(req.params.id); if(!t)return res.status(404).json({message:'Team not found'});
  if(!t.members.some(x=>String(x)===String(req.body.userId)))return res.status(400).json({message:'New leader must already be a team member'});
  t.leader=req.body.userId; await t.save(); await audit(AuditLog,req.user,'UPDATE','Team',t._id,{action:'TRANSFER_LEADER',user:req.body.userId});
  res.json(await t.populate([{path:'leader',select:'name email enrollmentId'},{path:'members',select:'name email enrollmentId role paymentStatus'},{path:'problem',select:'code title'}]));
}));
app.delete('/api/admin/teams/:id',auth,permission('teams.manage'),asyncRoute(async(req,res)=>{const t=await Team.findById(req.params.id);if(!t)return res.status(404).json({message:'Team not found'});await Team.findByIdAndDelete(req.params.id);await Invitation.deleteMany({team:t._id});await audit(AuditLog,req.user,'DELETE','Team',t._id,{name:t.name});res.json({message:'Team deleted'});}));
app.post('/api/teams/:id/invite',auth,asyncRoute(async(req,res)=>{const t=await Team.findById(req.params.id).populate('hackathon');if(!t||String(t.leader)!==String(req.user._id))return res.status(403).json({message:'Only team leader can invite'});if(t.members.length>=t.hackathon.teamMax)return res.status(400).json({message:'Team is full'});const u=await User.findOne({email:req.body.email?.toLowerCase().trim(),role:'participant',active:true});if(!u||!(await paid(u._id,t.hackathon)))return res.status(400).json({message:'Invitee must be registered and payment-approved'});if(await Team.exists({hackathon:t.hackathon._id,members:u._id}))return res.status(409).json({message:'User is already in a team'});res.status(201).json(await Invitation.create({hackathon:t.hackathon._id,team:t._id,from:req.user._id,to:u._id}))}));
app.get('/api/invitations',auth,asyncRoute(async(req,res)=>res.json(await Invitation.find({to:req.user._id,status:'pending'}).populate('team','name code').populate('from','name email'))));
app.post('/api/invitations/:id/respond',auth,asyncRoute(async(req,res)=>{const i=await Invitation.findOne({_id:req.params.id,to:req.user._id,status:'pending'}).populate('team');if(!i)return res.status(404).json({message:'Invitation not found'});if(req.body.action==='reject'){i.status='rejected';await i.save();return res.json(i)}const h=await Hackathon.findById(i.hackathon);if(!h)return res.status(404).json({message:'Hackathon not found'});if(!featureEnabled(h,'teams'))return res.status(503).json({message:'Team formation is currently disabled.'});if(!await paid(req.user._id,h))return res.status(403).json({message:'Payment must be approved'});if(i.team.members.length>=h.teamMax)return res.status(400).json({message:'Team is full'});if(await Team.exists({hackathon:h._id,members:req.user._id}))return res.status(409).json({message:'Already in another team'});i.team.members.push(req.user._id);if(i.team.members.length>=h.teamMin)i.team.status='confirmed';await i.team.save();i.status='accepted';await i.save();res.json(i)}));
app.post('/api/teams/join',auth,asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.body.hackathonId);if(!h)return res.status(404).json({message:'Hackathon not found'});if(!featureEnabled(h,'teams'))return res.status(503).json({message:'Team formation is currently disabled.'});if(!await paid(req.user._id,h))return res.status(403).json({message:'Payment must be approved'});const rawCode=String(req.body.code||'').trim().toUpperCase();if(!rawCode)return res.status(400).json({message:'Team code is required'});const t=await Team.findOne({hackathon:h._id,code:rawCode});if(!t)return res.status(404).json({message:'Invalid team code'});if(t.members.length>=h.teamMax)return res.status(400).json({message:'Team is full'});if(await Team.exists({hackathon:h._id,members:req.user._id}))return res.status(409).json({message:'Already in a team'});t.members.push(req.user._id);if(t.members.length>=h.teamMin)t.status='confirmed';await t.save();res.json(t)}));
app.delete('/api/teams/:id/members/:uid',auth,asyncRoute(async(req,res)=>{const t=await Team.findById(req.params.id);if(!t||String(t.leader)!==String(req.user._id))return res.status(403).json({message:'Only leader can remove members'});if(String(req.params.uid)===String(t.leader))return res.status(400).json({message:'Leader cannot be removed'});t.members=t.members.filter(x=>String(x)!==req.params.uid);const h=await Hackathon.findById(t.hackathon).select('teamMin');if(t.members.length<(h?.teamMin||1))t.status='incomplete';await t.save();res.json(t)}));

// Problems
app.get('/api/problems',asyncRoute(async(req,res)=>{const filter={published:true};if(req.query.hackathonId)filter.hackathon=req.query.hackathonId;else{const h=await current();if(h)filter.hackathon=h._id;}const rows=await Problem.find(filter).sort({createdAt:-1}).lean();res.json(rows.map(p=>{delete p.testCases;return p;}));}));
app.get('/api/admin/problems',auth,permission('problems.manage','coding.view','coding.manage'),asyncRoute(async(req,res)=>res.json(await Problem.find(req.query.hackathonId?{hackathon:req.query.hackathonId}:{}).sort({createdAt:-1}))));
app.post('/api/admin/problems',auth,permission('coding.manage'),asyncRoute(async(req,res)=>{const body={...req.body};const scope=String(body.scope||'event');delete body.scope;if(scope==='event'){const h=await current();if(!h)return res.status(400).json({message:'Create or activate an event before creating an event challenge.'});body.hackathon=h._id;}else if(scope==='basic'){body.hackathon=null;}else return res.status(400).json({message:'Invalid problem scope.'});if(!body.code||!body.title||!body.description)return res.status(400).json({message:'Code, title and description are required'});res.status(201).json(await Problem.create(body));}));
app.patch('/api/admin/problems/:id',auth,permission('coding.manage'),asyncRoute(async(req,res)=>{const body={...req.body};const scope=body.scope;delete body.scope;const existing=await Problem.findById(req.params.id);if(!existing)return res.status(404).json({message:'Problem not found'});if(scope==='event'){const h=await current();if(!h)return res.status(400).json({message:'No active event available for this event challenge.'});body.hackathon=h._id;}else if(scope==='basic'){body.hackathon=null;}const p=await Problem.findByIdAndUpdate(req.params.id,body,{returnDocument:'after',runValidators:true});res.json(p);}));
app.delete('/api/admin/problems/:id',auth,permission('coding.manage'),asyncRoute(async(req,res)=>{await Problem.findByIdAndDelete(req.params.id);res.json({message:'Deleted'})}));

// Submissions and judging
app.post('/api/submissions',auth,asyncRoute(async(req,res)=>{const event=await Hackathon.findById(req.body.hackathonId);if(!event)return res.status(404).json({message:'Hackathon not found'});if(!featureEnabled(event,'submissions'))return res.status(503).json({message:'Project submissions are currently disabled by the administrator.'});const t=await Team.findOne({hackathon:req.body.hackathonId,members:req.user._id}).populate('hackathon');if(!t||String(t.leader)!==String(req.user._id))return res.status(403).json({message:'Only a team leader can submit'});if(t.members.length<t.hackathon.teamMin||t.members.length>t.hackathon.teamMax)return res.status(400).json({message:`Team must have ${t.hackathon.teamMin}-${t.hackathon.teamMax} members`});if(!t.problem)return res.status(400).json({message:'Select a problem first'});if(t.hackathon.submissionDeadline&&new Date()>t.hackathon.submissionDeadline)return res.status(400).json({message:'Submission deadline has passed'});const s=await Submission.findOneAndUpdate({team:t._id},{...req.body,hackathon:t.hackathon._id,team:t._id,problem:t.problem,status:'submitted',submittedAt:new Date()},{upsert:true,returnDocument:'after'});t.status='submitted';await t.save();const judgeIds=await JudgeAssignment.find({hackathon:t.hackathon._id,team:t._id}).distinct('judge');await notifyUsers(judgeIds,{hackathon:t.hackathon._id,title:'Team submission received',message:`${t.name} submitted a project for review.`,type:'info',link:'/judge'});res.json(s)}));
app.get('/api/submissions/mine',auth,asyncRoute(async(req,res)=>{const ts=await Team.find({members:req.user._id});res.json(await Submission.find({team:{$in:ts.map(t=>t._id)}}).populate('problem','code title'))}));
app.get('/api/admin/submissions',auth,permission('submissions.view','judging.manage','coding.view'),asyncRoute(async(req,res)=>{let filter=req.query.hackathonId?{hackathon:req.query.hackathonId}:{};if(req.user.role==='judge'){const ids=await JudgeAssignment.find({hackathon:req.query.hackathonId||undefined,judge:req.user._id}).distinct('team');filter.team={$in:ids};}res.json(await Submission.find(filter).populate({path:'team',populate:[{path:'members',select:'name email enrollmentId'},{path:'leader',select:'name email'}]}).populate('problem','code title').sort({submittedAt:-1}))}));
app.get('/api/admin/coding-submissions',auth,permission('coding.view','coding.manage'),asyncRoute(async(req,res)=>{const filter={mode:'submit'};if(req.query.problemId)filter.problem=req.query.problemId;if(req.query.hackathonId)filter.hackathon=req.query.hackathonId;const rows=await CodeSubmission.find(filter).populate('problem','code title').populate('user','name email enrollmentId').populate('team','name code').sort({createdAt:-1}).limit(500);res.json(rows)}));
app.get('/api/admin/assignments',auth,permission('judging.manage'),asyncRoute(async(req,res)=>res.json(await JudgeAssignment.find(req.query.hackathonId?{hackathon:req.query.hackathonId}:{}).populate('judge','name email').populate('team','name status').sort({createdAt:-1}))));
app.post('/api/admin/assignments',auth,permission('judging.manage'),asyncRoute(async(req,res)=>{
  const {hackathon,judge,team,teamId,teamIds}=req.body||{};
  const h=await Hackathon.findById(hackathon);
  if(!h)return res.status(404).json({message:'Hackathon not found'});
  if(!featureEnabled(h,'judging'))return res.status(503).json({message:'Judging is currently disabled for this event.'});
  const j=await User.findOne({_id:judge,role:'judge',active:true}).select('_id name email');
  if(!j)return res.status(400).json({message:'Select an active judge account.'});
  const ids=[...(Array.isArray(teamIds)?teamIds:[]),teamId,team].filter(Boolean).map(String);
  const unique=[...new Set(ids)];
  if(!unique.length)return res.status(400).json({message:'Select at least one team.'});
  const teams=await Team.find({_id:{$in:unique},hackathon:h._id}).select('_id name');
  if(teams.length!==unique.length)return res.status(400).json({message:'One or more selected teams do not belong to this event.'});
  const existing=await JudgeAssignment.find({hackathon:h._id,judge:j._id,team:{$in:unique}}).select('team');
  const existingSet=new Set(existing.map(x=>String(x.team)));
  const pending=unique.filter(id=>!existingSet.has(id));
  if(!pending.length)return res.status(409).json({message:'This judge is already assigned to the selected team(s).'});
  const docs=pending.map(id=>({hackathon:h._id,judge:j._id,team:id,status:'assigned'}));
  const created=await JudgeAssignment.insertMany(docs);
  await Promise.all(created.map(a=>audit(AuditLog,req.user,'CREATE','JudgeAssignment',a._id,{judge:j._id,team:a.team,hackathon:h._id})));
  const rows=await JudgeAssignment.find({_id:{$in:created.map(x=>x._id)}}).populate('judge','name email').populate('team','name status');
  await notifyUsers([j._id],{hackathon:h._id,title:'New judging assignments',message:`You have ${created.length} new team assignment${created.length>1?'s':''}.`,type:'info',link:'/judge'});
  res.status(201).json(rows);
}));
app.delete('/api/admin/assignments/:id',auth,permission('judging.manage'),asyncRoute(async(req,res)=>{const a=await JudgeAssignment.findById(req.params.id);if(!a)return res.status(404).json({message:'Assignment not found'});await Evaluation.deleteOne({assignment:a._id});await a.deleteOne();await audit(AuditLog,req.user,'DELETE','JudgeAssignment',a._id,{judge:a.judge,team:a.team,hackathon:a.hackathon});res.json({message:'Judge assignment removed'}); }));
app.get('/api/judge/rubric',auth,allow('judge'),asyncRoute(async(req,res)=>{const h=await current();if(!h)return res.status(404).json({message:'No active hackathon'});const rubric=h.judgingRubric?.length?h.judgingRubric:[{name:'Problem fit',maxScore:20,weight:1},{name:'Technical execution',maxScore:20,weight:1},{name:'Innovation',maxScore:20,weight:1},{name:'UX / usability',maxScore:20,weight:1},{name:'Impact',maxScore:20,weight:1}];res.json(rubric)}));
app.get('/api/judge/assignments',auth,allow('judge'),asyncRoute(async(req,res)=>res.json(await JudgeAssignment.find({judge:req.user._id}).populate('team','name status').populate({path:'team',populate:{path:'members',select:'name email'}}).populate('hackathon','name'))));
app.post('/api/judge/evaluations',auth,allow('judge'),asyncRoute(async(req,res)=>{const a=await JudgeAssignment.findOne({_id:req.body.assignmentId,judge:req.user._id});if(!a)return res.status(404).json({message:'Assignment not found'});const scores=Array.isArray(req.body.scores)?req.body.scores:[];if(!scores.length)return res.status(400).json({message:'At least one rubric score is required.'});if(scores.some(x=>!Number.isFinite(Number(x.score))||Number(x.score)<0||Number(x.score)>Number(x.max||20)))return res.status(400).json({message:'One or more evaluation scores are invalid.'});const total=scores.reduce((x,y)=>x+Number(y.score||0),0);const e=await Evaluation.findOneAndUpdate({assignment:a._id},{hackathon:a.hackathon,assignment:a._id,judge:req.user._id,team:a.team,scores,total,comments:req.body.comments,submitted:true,submittedAt:new Date()},{upsert:true,returnDocument:'after'});a.status='completed';await a.save();const teamUsers=await Team.findById(a.team).distinct('members');await notifyUsers(teamUsers,{hackathon:a.hackathon,title:'Evaluation completed',message:'A judge completed an evaluation for your team.',type:'success',link:'/dashboard/results'});res.json(e)}));
app.get('/api/admin/evaluations',auth,permission('judging.manage'),asyncRoute(async(req,res)=>res.json(await Evaluation.find(req.query.hackathonId?{hackathon:req.query.hackathonId}:{}).populate('judge','name email').populate('team','name').sort({total:-1}))));
app.get('/api/public/ranking',asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.query.hackathonId);if(!h?.settings?.publicLeaderboard)return res.status(403).json({message:'Leaderboard is private'});const rows=await Evaluation.aggregate([{$match:{submitted:true}},{$lookup:{from:'judgeassignments',localField:'assignment',foreignField:'_id',as:'assignmentDoc'}},{$unwind:'$assignmentDoc'},{$match:{'assignmentDoc.hackathon':h._id}},{$group:{_id:'$team',score:{$avg:'$total'},evaluations:{$sum:1}}},{$sort:{score:-1}},{$limit:200},{$lookup:{from:'teams',localField:'_id',foreignField:'_id',as:'team'}},{$unwind:{path:'$team',preserveNullAndEmptyArrays:true}},{$project:{_id:1,score:{$round:['$score',2]},evaluations:1,team:{_id:'$team._id',name:'$team.name',code:'$team.code'}}}]);res.json(rows)}));

// Announcements, attendance, certificates
app.get('/api/announcements',asyncRoute(async(req,res)=>{const filter={published:true};if(req.query.hackathonId)filter.hackathon=req.query.hackathonId;res.json(await Announcement.find(filter).sort({createdAt:-1}))}));

// QR attendance: the QR contains only a random credential. The server resolves it to a participant.
app.get('/api/attendance/mine',auth,asyncRoute(async(req,res)=>{
  const h=await current(); if(!h)return res.status(404).json({message:'No active hackathon'});
  if(req.user.role!=='participant')return res.status(403).json({message:'Participant attendance QR is only available for participant accounts.'});
  if(h.settings?.features?.attendance===false)return res.status(503).json({message:'Attendance is currently disabled for this event.'});
  const token=await ensureAttendanceToken(req.user);
  const records=await Attendance.find({hackathon:h._id,user:req.user._id}).populate('scannedBy','name role').sort({at:-1}).limit(20).lean();
  res.json({event:{id:h._id,name:h.name},qrValue:`BITEATT:${token}`,records,checkedIn:Boolean(records.find(x=>x.type==='entry'))});
}));
app.get('/api/attendance/credential',auth,allow('participant'),asyncRoute(async(req,res)=>{
  const h=await current(); if(!h)return res.status(404).json({message:'No active hackathon'}); if(h.settings?.features?.attendance===false)return res.status(503).json({message:'Attendance is currently disabled for this event.'});
  const token=await ensureAttendanceToken(req.user); res.json({event:{id:h._id,name:h.name},qrValue:`BITEATT:${token}`});
}));
app.post('/api/attendance/scan',auth,allow('admin','judge','mentor','volunteer'),asyncRoute(async(req,res)=>{
  const requestedHackathonId=String(req.body?.hackathonId||req.body?.eventId||'').trim();
  if(requestedHackathonId && !isValidObjectId(requestedHackathonId))return res.status(400).json({message:'Invalid hackathon id.'});
  const h=requestedHackathonId?await Hackathon.findById(requestedHackathonId):await current();
  if(!h)return res.status(404).json({message:'Hackathon not found'});
  if(h.settings?.features?.attendance===false)return res.status(503).json({message:'Attendance is currently disabled for this event.'});
  const raw=String(req.body?.qrValue||req.body?.token||'').trim(); const token=raw.replace(/^BITEATT:/i,''); if(!token)return res.status(400).json({message:'Scan a participant attendance QR code.'});
  const u=await User.findOne({attendanceToken:token,role:'participant',active:true}); if(!u)return res.status(404).json({message:'Invalid or inactive participant QR code.'});
  if(h.registrationFee>0 && !(await paid(u._id,h)))return res.status(403).json({message:'This participant is not payment-approved for this event.'});
  const type=['entry','exit','workshop','mentor','presentation'].includes(String(req.body?.type))?String(req.body.type):'entry';
  if(type==='entry'){
    const existing=await Attendance.findOne({hackathon:h._id,user:u._id,type:'entry'}).populate('scannedBy','name role');
    if(existing)return res.status(409).json({message:'Participant is already checked in.',already:true,record:await existing.populate([{path:'user',select:'name email enrollmentId'}])});
  }
  const record=await Attendance.create({hackathon:h._id,user:u._id,type,at:new Date(),scannedBy:req.user._id});
  await audit(AuditLog,req.user,'SCAN','Attendance',record._id,{participant:u._id,event:h._id,type});
  res.status(201).json({message:type==='entry'?'Attendance marked successfully.':'Attendance event recorded successfully.',already:false,record:await record.populate([{path:'user',select:'name email enrollmentId'},{path:'scannedBy',select:'name role'}])});
}));

app.post('/api/admin/announcements',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.body.hackathon);if(!h)return res.status(404).json({message:'Hackathon not found'});if(!featureEnabled(h,'announcements'))return res.status(503).json({message:'Announcements are disabled for this event.'});res.status(201).json(await Announcement.create({...req.body,createdBy:req.user._id}))}));
app.post('/api/tickets',auth,asyncRoute(async(req,res)=>res.status(201).json(await Ticket.create({...req.body,user:req.user._id})))); app.get('/api/tickets/mine',auth,asyncRoute(async(req,res)=>res.json(await Ticket.find({user:req.user._id}).sort({createdAt:-1})))); app.get('/api/admin/tickets',auth,allow('admin','volunteer'),asyncRoute(async(req,res)=>res.json(await Ticket.find().populate('user','name email').sort({createdAt:-1}))));
app.post('/api/votes',auth,asyncRoute(async(req,res)=>{const h=await Hackathon.findById(req.body.hackathonId);if(!h?.settings?.peopleChoice)return res.status(400).json({message:'People’s Choice is disabled'});if(await Vote.exists({hackathon:h._id,user:req.user._id}))return res.status(409).json({message:'You have already voted'});res.status(201).json(await Vote.create({hackathon:h._id,user:req.user._id,team:req.body.teamId}))}));
app.get('/api/admin/attendance',auth,allow('admin','judge','mentor','volunteer'),asyncRoute(async(req,res)=>{
  // Never pass an empty/invalid query value into findById().
  const requestedHackathonId=String(req.query.hackathonId||'').trim();
  if(requestedHackathonId && !isValidObjectId(requestedHackathonId))
    return res.status(400).json({message:'Invalid hackathon id.'});

  const h=requestedHackathonId?await Hackathon.findById(requestedHackathonId):await current();
  if(!h)return res.status(404).json({message:'Event not found'});

  const filter={hackathon:h._id};
  const userFilter={role:'participant'};
  if(req.query.department)userFilter.department=String(req.query.department).trim();
  if(req.query.group)userFilter.group=String(req.query.group).trim();
  if(req.query.year)userFilter.year=String(req.query.year).trim();
  const userIds=await User.find(userFilter).distinct('_id');
  filter.user={$in:userIds};

  // Avoid Mongoose populate CastErrors from any legacy malformed reference.
  const rawRows=await Attendance.find(filter).sort({at:-1}).limit(5000).lean();
  const validUserIds=[...new Set(rawRows.map(x=>String(x.user||'')).filter(isValidObjectId))];
  const validScannerIds=[...new Set(rawRows.map(x=>String(x.scannedBy||'')).filter(isValidObjectId))];
  const [users,scanners]=await Promise.all([
    User.find({_id:{$in:validUserIds}}).select('name email enrollmentId college department group year').lean(),
    User.find({_id:{$in:validScannerIds}}).select('name role').lean()
  ]);
  const usersById=new Map(users.map(x=>[String(x._id),x]));
  const scannersById=new Map(scanners.map(x=>[String(x._id),x]));
  res.json(rawRows.map(row=>({...row,user:usersById.get(String(row.user||''))||null,scannedBy:scannersById.get(String(row.scannedBy||''))||null,hackathon:{_id:h._id,name:h.name}})));
}));

app.post('/api/admin/attendance',auth,allow('admin'),asyncRoute(async(req,res)=>{const u=await User.findOne({email:req.body.email?.toLowerCase().trim(),role:'participant',active:true});if(!u)return res.status(404).json({message:'Eligible participant not found'});const h=await Hackathon.findById(req.body.hackathonId);if(!h)return res.status(404).json({message:'Hackathon not found'});const type=['entry','exit','workshop','mentor','presentation'].includes(String(req.body.type))?String(req.body.type):'entry';if(type==='entry'&&await Attendance.exists({hackathon:h._id,user:u._id,type:'entry'}))return res.status(409).json({message:'Participant is already checked in.'});const record=await Attendance.create({hackathon:h._id,user:u._id,type,at:req.body.at?new Date(req.body.at):new Date(),scannedBy:req.user._id});await audit(AuditLog,req.user,'MANUAL_ATTENDANCE','Attendance',record._id,{participant:u._id,event:h._id,type});res.status(201).json(await record.populate([{path:'user',select:'name email enrollmentId'},{path:'scannedBy',select:'name role'}]))}));
app.delete('/api/admin/attendance/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const record=await Attendance.findByIdAndDelete(req.params.id);if(!record)return res.status(404).json({message:'Attendance record not found'});await audit(AuditLog,req.user,'DELETE','Attendance',record._id,{participant:record.user,event:record.hackathon,type:record.type});res.json({message:'Attendance record deleted'})}));
app.get('/api/admin/ranking',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=req.query.hackathonId?await Hackathon.findById(req.query.hackathonId):await current(); if(!h)return res.status(404).json({message:'Hackathon not found'});
  const rows=await Evaluation.aggregate([
    {$match:{hackathon:h._id,submitted:true}},
    {$group:{_id:'$team',score:{$avg:'$total'},evaluations:{$sum:1}}},
    {$sort:{score:-1,_id:1}},{$limit:200},
    {$lookup:{from:'teams',localField:'_id',foreignField:'_id',as:'team'}},{$unwind:{path:'$team',preserveNullAndEmptyArrays:true}},
    {$lookup:{from:'users',localField:'team.members',foreignField:'_id',as:'members'}},
    {$project:{_id:1,score:{$round:['$score',2]},evaluations:1,team:{_id:'$team._id',name:'$team.name',code:'$team.code'},members:{_id:1,name:1,email:1,enrollmentId:1}}}
  ]);
  let lastScore=null,rank=0; const out=rows.map((x,i)=>{if(lastScore===null||x.score!==lastScore)rank=i+1;lastScore=x.score;return {...x,rank}});
  res.json(out);
}));
app.post('/api/admin/certificates/auto-issue',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=req.body?.hackathonId?await Hackathon.findById(req.body.hackathonId):await current(); if(!h)return res.status(404).json({message:'Hackathon not found'}); if(h.settings?.features?.certificates===false)return res.status(503).json({message:'Certificates are disabled for this event.'});
  const rankings=await Evaluation.aggregate([{$match:{hackathon:h._id,submitted:true}},{$group:{_id:'$team',score:{$avg:'$total'}}},{$sort:{score:-1,_id:1}},{$limit:2},{$lookup:{from:'teams',localField:'_id',foreignField:'_id',as:'team'}},{$unwind:'$team'}]);
  const winnerIds=new Set((rankings[0]?.team?.members||[]).map(String)); const runnerIds=new Set((rankings[1]?.team?.members||[]).map(String));
  const participants=await User.find({role:'participant',active:{$ne:false}}).select('_id name email college enrollmentId department group year');
  const defaults={organizerName:h.college||h.name||'Hackathon Organizer',organizerLocation:h.venue||'',established:'',title:'CERTIFICATE',subtitle:'OF ACHIEVEMENT',body:`For outstanding participation and contribution in ${h.name}.`,achievementLabel:'This certificate is proudly presented to',track:'',signatureName:'Event Organizer',signatureTitle:'Organizer',logoUrl:h.logoUrl||'',primaryColor:'#243b86',accentColor:'#c7a45b'};
  let created=0,skipped=0;
  for(const u of participants){const type=winnerIds.has(String(u._id))?'Winner':runnerIds.has(String(u._id))?'Runner-up':'Participation';if(await Certificate.exists({hackathon:h._id,user:u._id,type})){skipped++;continue;}await Certificate.create({hackathon:h._id,user:u._id,type,certificateId:certId(),template:defaults});created++;}
  await audit(AuditLog,req.user,'AUTO_ISSUE','Certificates',h._id,{created,skipped,winnerCount:winnerIds.size,runnerUpCount:runnerIds.size});
  res.json({created,skipped,winnerCount:winnerIds.size,runnerUpCount:runnerIds.size});
}));

app.get('/api/certificates/mine',auth,asyncRoute(async(req,res)=>res.json(await Certificate.find({user:req.user._id}).populate('hackathon','name').sort({issuedAt:-1}))));
app.get('/api/admin/certificates',auth,allow('admin'),asyncRoute(async(req,res)=>{const filter=req.query.hackathonId?{hackathon:req.query.hackathonId}:{};res.json(await Certificate.find(filter).populate('user','name email enrollmentId').populate('hackathon','name').sort({issuedAt:-1}))}));
app.post('/api/admin/certificates',auth,allow('admin'),asyncRoute(async(req,res)=>{const {hackathon,user,type,fileUrl,template}=req.body;if(!hackathon||!user||!type)return res.status(400).json({message:'Hackathon, participant and certificate type are required'});const [h,u]=await Promise.all([Hackathon.findById(hackathon),User.findById(user)]);if(!h)return res.status(404).json({message:'Hackathon not found'});if(!featureEnabled(h,'certificates'))return res.status(503).json({message:'Certificates are disabled for this event.'});if(!u||u.role!=='participant'||u.active===false)return res.status(404).json({message:'Eligible participant not found'});const existing=await Certificate.findOne({hackathon:h._id,user:u._id,type});if(existing)return res.status(409).json({message:'This certificate already exists for the participant'});const defaults={organizerName:h.college||h.name||'Hackathon Organizer',organizerLocation:h.venue||'',established:'',title:'CERTIFICATE',subtitle:'OF ACHIEVEMENT',body:`For outstanding participation and contribution in ${h.name}.`,achievementLabel:'This certificate is proudly presented to',track:'',signatureName:'Event Organizer',signatureTitle:'Organizer',logoUrl:h.logoUrl||'',primaryColor:'#243b86',accentColor:'#c7a45b'};const cleanTemplate={...defaults,...(template||{})};const c=await Certificate.create({hackathon:h._id,user:u._id,type,fileUrl,certificateId:certId(),template:cleanTemplate});await audit(AuditLog,req.user,'CREATE','Certificate',c._id,{certificateId:c.certificateId,user:u._id,type});res.status(201).json(await c.populate([{path:'user',select:'name email enrollmentId college'},{path:'hackathon',select:'name college venue logoUrl'}]))}));
app.delete('/api/admin/certificates/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const c=await Certificate.findByIdAndDelete(req.params.id);if(!c)return res.status(404).json({message:'Certificate not found'});res.json({message:'Certificate deleted'})}));
app.patch('/api/admin/certificates/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{const c=await Certificate.findById(req.params.id);if(!c)return res.status(404).json({message:'Certificate not found'});if(req.body.type!=null)c.type=String(req.body.type).trim();if(req.body.fileUrl!==undefined)c.fileUrl=req.body.fileUrl||undefined;if(req.body.template&&typeof req.body.template==='object')c.template={...(c.template?.toObject?.()||c.template||{}),...req.body.template};await c.save();await audit(AuditLog,req.user,'UPDATE','Certificate',c._id,{certificateId:c.certificateId,type:c.type,hackathon:c.hackathon});res.json(await c.populate([{path:'user',select:'name email enrollmentId college'},{path:'hackathon',select:'name college venue logoUrl'}]))}));
app.get('/api/certificates/verify/:id',asyncRoute(async(req,res)=>{const c=await Certificate.findOne({certificateId:req.params.id}).populate('user','name college enrollmentId').populate('hackathon','name');if(!c)return res.status(404).json({message:'Certificate not found'});res.json(c)}));

app.get('/api/admin/audit',auth,allow('admin'),asyncRoute(async(req,res)=>{const filter=req.query.hackathonId?{hackathon:req.query.hackathonId}:{};const rows=await AuditLog.find(filter).populate('actor','name email role').sort({createdAt:-1}).limit(Math.min(Number(req.query.limit)||200,500));res.json(rows)}));

app.get('/api/admin/stats',auth,allow('admin'),asyncRoute(async(req,res)=>{const id=req.query.hackathonId;const [participants,paidCount,teams,submissions,judges,announcements]=await Promise.all([User.countDocuments({role:'participant'}),User.countDocuments({role:'participant',paymentStatus:'paid'}),Team.countDocuments(id?{hackathon:id}:{}),Submission.countDocuments(id?{hackathon:id,status:{$in:['submitted','locked','under_evaluation','evaluated']}}:{}),User.countDocuments({role:'judge'}),Announcement.countDocuments(id?{hackathon:id}:{})]);res.json({participants,paid:paidCount,teams,submissions,judges,announcements})}));


// Next-level operations: event health, notifications, balanced judge assignment and safe controls
const eventPhase = h => {
  if(!h) return {key:'setup',label:'Setup'};
  const now=Date.now();
  const phases=[['registration','Registration',h.registrationDeadline],['live','Hackathon live',h.hackStart],['submission','Submission',h.submissionDeadline],['judging','Judging',h.judgingStart],['results','Results',h.resultsAt]];
  if(h.status==='closed'||h.status==='archived') return {key:h.status,label:h.status[0].toUpperCase()+h.status.slice(1)};
  if(h.status==='draft') return {key:'setup',label:'Setup'};
  if(h.status==='registration') return {key:'registration',label:'Registration'};
  if(h.status==='live') return {key:'live',label:'Hackathon live'};
  if(h.status==='submission') return {key:'submission',label:'Submission'};
  if(h.status==='judging') return {key:'judging',label:'Judging'};
  if(h.status==='results') return {key:'results',label:'Results'};
  const upcoming=phases.find(([,label,date])=>date&&new Date(date).getTime()>now);
  return upcoming?{key:upcoming[0],label:upcoming[1]}:{key:'setup',label:'Setup'};
};
const notifyUsers=async(users,doc)=>{const ids=[...new Set(users.map(x=>String(x)).filter(Boolean))];if(!ids.length)return;await Notification.insertMany(ids.map(user=>({...doc,user})),{ordered:false});};

// Feedback: category is always derived from the authenticated role; the client cannot choose another category.
const feedbackRoles=new Set(['participant','judge','mentor','volunteer','admin']);
app.get('/api/feedback/mine',auth,asyncRoute(async(req,res)=>{
  if(!feedbackRoles.has(req.user.role))return res.status(403).json({message:'This account is not allowed to submit feedback.'});
  const rows=await Feedback.find({from:req.user._id}).populate('hackathon','name').sort({createdAt:-1}).limit(100).lean();
  res.json(rows);
}));
app.post('/api/feedback',auth,asyncRoute(async(req,res)=>{
  if(!feedbackRoles.has(req.user.role))return res.status(403).json({message:'This account is not allowed to submit feedback.'});
  const message=String(req.body?.message||'').trim();
  if(message.length<3) return res.status(400).json({message:'Feedback must contain at least 3 characters.'});
  const category=req.user.role;
  const h=req.body?.hackathonId?await Hackathon.findById(req.body.hackathonId):await current();
  const rating=req.body?.rating==null?undefined:Number(req.body.rating);
  if(rating!=null&&(!Number.isFinite(rating)||rating<1||rating>5))return res.status(400).json({message:'Rating must be between 1 and 5.'});
  const row=await Feedback.create({hackathon:h?._id,from:req.user._id,fromRole:req.user.role,category,rating,message,anonymousToUsers:Boolean(req.body?.anonymousToUsers)});
  // Feedback is saved first. Notifications/email are secondary and must never
  // turn a successful feedback submission into a false failure.
  if(h){
    try{
      const admins=await User.find({role:'admin',active:{$ne:false}}).distinct('_id');
      await notifyUsers(admins,{hackathon:h._id,title:'New feedback received',message:`New ${category} feedback was submitted by ${req.user.name}.`,type:'info',link:'/admin/feedback'});
    }catch(error){
      console.error('Feedback notification failed:',error.message);
    }
  }
  // Email is intentionally non-blocking so Gmail outages never slow or fail feedback submission.
  try{
    void sendFeedbackConfirmation({to:req.user.email,name:req.user.name,category,rating,message,eventName:h?.name}).catch(error=>console.error('Feedback email failed:',error.message));
  }catch(error){
    console.error('Feedback email setup failed:',error.message);
  }
  res.status(201).json(await row.populate([{path:'hackathon',select:'name'},{path:'from',select:'name email role'}]));
}));
app.get('/api/admin/feedback',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const filter={}; if(req.query.hackathonId)filter.hackathon=req.query.hackathonId; if(req.query.category)filter.category=req.query.category;
  const rows=await Feedback.find(filter).populate('from','name email role department group year enrollmentId').populate('hackathon','name').sort({createdAt:-1}).limit(500).lean();
  res.json(rows);
}));

app.get('/api/notifications/mine',auth,asyncRoute(async(req,res)=>{
  const rows=await Notification.find({user:req.user._id}).sort({createdAt:-1}).limit(50).lean();
  res.json(rows);
}));
app.patch('/api/notifications/:id/read',auth,asyncRoute(async(req,res)=>{
  const n=await Notification.findOneAndUpdate({_id:req.params.id,user:req.user._id},{read:true},{returnDocument:'after'});
  if(!n)return res.status(404).json({message:'Notification not found'});res.json(n);
}));
app.post('/api/notifications/read-all',auth,asyncRoute(async(req,res)=>{await Notification.updateMany({user:req.user._id,read:false},{$set:{read:true}});res.json({message:'Notifications marked as read'});}));

app.get('/api/admin/operations',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=await current();
  if(!h)return res.json({event:null});
  const id=h._id;
  const [participants,paid,teams,confirmedTeams,submissions,judges,assignments,completedEvaluations,publishedProblems,pendingPayments,unreadAudit,checkedIn]=await Promise.all([
    User.countDocuments({role:'participant',active:true}),
    User.countDocuments({role:'participant',paymentStatus:'paid',active:true}),
    Team.countDocuments({hackathon:id}),
    Team.countDocuments({hackathon:id,status:{$in:['confirmed','submitted','locked']}}),
    Submission.countDocuments({hackathon:id,status:{$in:['submitted','locked','under_evaluation','evaluated']}}),
    User.countDocuments({role:'judge',active:true}),
    JudgeAssignment.countDocuments({hackathon:id}),
    Evaluation.countDocuments({submitted:true,team:{$in:await Team.find({hackathon:id}).distinct('_id')}}),
    Problem.countDocuments({hackathon:id,published:true}),
    Payment.countDocuments({hackathon:id,status:'pending'}),
    AuditLog.countDocuments({hackathon:id,createdAt:{$gte:new Date(Date.now()-24*60*60*1000)}}),
     Attendance.countDocuments({hackathon:id,type:'entry'})
  ]);
  const assignedTeams=await JudgeAssignment.find({hackathon:id}).distinct('team');
  const unassigned=Math.max(0,submissions-(new Set(assignedTeams.map(String)).size));
  const phase=eventPhase(h);
  res.json({event:{id:h._id,name:h.name,status:h.status,phase,dates:{registrationDeadline:h.registrationDeadline,hackStart:h.hackStart,hackEnd:h.hackEnd,submissionDeadline:h.submissionDeadline,judgingStart:h.judgingStart,judgingEnd:h.judgingEnd,resultsAt:h.resultsAt}},features:{ai:h.settings?.aiEnabled!==false,compiler:h.settings?.compilerEnabled!==false,...(h.settings?.features||{})},metrics:{participants,paid,teams,confirmedTeams,submissions,judges,assignments,completedEvaluations,publishedProblems,pendingPayments,checkedIn,unassignedTeams:unassigned,audit24h:unreadAudit},health:{database:mongoose.connection.readyState===1,judgeService:Boolean(process.env.JUDGE0_URL||'https://ce.judge0.com'),jwtConfigured:Boolean(process.env.JWT_SECRET),ai:Boolean(process.env.OPENROUTER_API_KEY),gmail:mailConfigured()}});
}));

app.post('/api/admin/judges/auto-assign',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=await current();if(!h)return res.status(404).json({message:'No active hackathon'});
  if(h.settings?.features?.judging===false)return res.status(503).json({message:'Judging is disabled for this event.'});
  const judges=await User.find({role:'judge',active:true}).select('_id name email').sort({createdAt:1});
  if(!judges.length)return res.status(400).json({message:'Create at least one active judge first.'});
  const teams=await Team.find({hackathon:h._id,status:{$in:['confirmed','submitted','locked']}}).select('_id name');
  const existing=await JudgeAssignment.find({hackathon:h._id}).select('judge team');
  const existingPairs=new Set(existing.map(x=>`${x.judge}:${x.team}`));
  const counts=new Map(judges.map(j=>[String(j._id),0]));existing.forEach(x=>counts.set(String(x.judge),(counts.get(String(x.judge))||0)+1));
  const created=[];
  for(const team of teams){
    const assignedForTeam=existing.filter(x=>String(x.team)===String(team._id));
    if(assignedForTeam.length)continue;
    const judge=[...judges].sort((a,b)=>(counts.get(String(a._id))||0)-(counts.get(String(b._id))||0))[0];
    if(!judge)continue;
    const doc=await JudgeAssignment.create({hackathon:h._id,judge:judge._id,team:team._id,status:'assigned'});
    created.push(doc);counts.set(String(judge._id),(counts.get(String(judge._id))||0)+1);
    await notifyUsers([judge._id],{hackathon:h._id,title:'New team assigned',message:`You have been assigned to judge ${team.name}.`,type:'info',link:'/judge'});
  }
  await audit(AuditLog,req.user,'AUTO_ASSIGN','JudgeAssignment',h._id,{created:created.length});
  res.json({created:created.length,judges:judges.map(j=>({name:j.name,assignments:counts.get(String(j._id))||0}))});
}));

app.get('/api/admin/roles/:name',auth,allow('admin'),asyncRoute(async(req,res)=>{const r=await Role.findOne({name:req.params.name});if(!r)return res.status(404).json({message:'Role not found'});res.json(r);}));
app.patch('/api/admin/roles/:name',auth,allow('admin'),asyncRoute(async(req,res)=>{const r=await Role.findOne({name:req.params.name});if(!r)return res.status(404).json({message:'Role not found'});if(r.system===true&&req.params.name==='admin')return res.status(400).json({message:'The admin role is protected.'});if(Array.isArray(req.body.permissions))r.permissions=[...new Set(req.body.permissions.map(String))];if(req.body.description!=null)r.description=String(req.body.description);await r.save();await audit(AuditLog,req.user,'UPDATE','Role',r._id,{name:r.name,permissions:r.permissions});res.json(r);}));


app.post('/api/anticheat/incident',auth,asyncRoute(async(req,res)=>{
  const h=await current();
  if(!h)return res.status(404).json({message:'No active hackathon.'});
  if(h.settings?.compilerEnabled===false && req.user.role!=='admin')return res.status(503).json({message:'Compiler is disabled.'});
  const allowed=['tab_hidden','tab_visible','window_blur','fullscreen_exit','clipboard_blocked','context_menu','camera_movement'];
  const type=String(req.body?.type||'');
  if(!allowed.includes(type))return res.status(400).json({message:'Invalid anti-cheat event.'});
  let screenshot=typeof req.body?.screenshot==='string'?req.body.screenshot:'';
  if(screenshot.length>1400000)screenshot='';
  const row=await AntiCheat.create({hackathon:h._id,user:req.user._id,problem:req.body?.problemId||undefined,type,details:req.body?.details||{},screenshot:screenshot||undefined});
  await audit(AuditLog,req.user,'ANTICHEAT','AntiCheat',row._id,{type,problem:req.body?.problemId||null});
  res.status(201).json({ok:true,id:row._id,type});
}));
app.get('/api/admin/anticheat',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=await current();
  if(!h)return res.json([]);
  const rawLimit=Number(req.query.limit);
  const limit=Number.isFinite(rawLimit)?Math.min(Math.max(Math.trunc(rawLimit),1),1000):300;
  try{
    const rows=await AntiCheat.find({hackathon:h._id})
      .sort({createdAt:-1})
      .limit(limit)
      .populate('user','name email enrollmentId department group year')
      .populate('problem','code title')
      .lean();
    return res.json(rows);
  }catch(error){
    console.error('Anti-cheat admin query failed:',error);
    // A malformed legacy reference should not make the entire security page unusable.
    const rows=await AntiCheat.find({hackathon:h._id})
      .sort({createdAt:-1})
      .limit(limit)
      .lean();
    return res.json(rows);
  }
}));

app.get('/api/admin/health',auth,allow('admin'),asyncRoute(async(req,res)=>{const h=await current();res.json({ok:mongoose.connection.readyState===1,event:Boolean(h),timestamp:new Date().toISOString(),services:{mongo:mongoose.connection.readyState===1,judge0:Boolean(process.env.JUDGE0_URL||'https://ce.judge0.com'),ai:Boolean(process.env.OPENROUTER_API_KEY),gmail:mailConfigured(),uploads:fs.existsSync(path.resolve(uploadDir))}});}));

// Final-phase operational APIs
const csvEscape=value=>{const s=String(value??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const sendCsv=(res,filename,headers,rows)=>{res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);res.send([headers.map(csvEscape).join(','),...rows.map(r=>r.map(csvEscape).join(','))].join('\n'));};
const attendanceFilterFromQuery=req=>{const department=String(req.query.department||'').trim();const group=String(req.query.group||'').trim();const year=String(req.query.year||'').trim();return {department,group,year};};
const requireAttendanceScope=({department,group,year})=>{if(!department||!group||!year)return 'Select Department, Group and Year before exporting attendance. Each export is intentionally limited to one exact Department + Group + Year.';return null;};


app.patch('/api/admin/hackathons/:id/status',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const allowed=['draft','registration','live','submission','judging','results','closed'];
  const next=String(req.body?.status||''); if(!allowed.includes(next))return res.status(400).json({message:'Invalid event phase.'});
  const h=await Hackathon.findById(req.params.id); if(!h)return res.status(404).json({message:'Hackathon not found'});
  if(next==='registration' && h.registrationDeadline && new Date(h.registrationDeadline)<new Date())return res.status(400).json({message:'Registration deadline has already passed.'});
  h.status=next; await h.save(); await audit(AuditLog,req.user,'PHASE_CHANGE','Hackathon',h._id,{from:req.body?.from||null,to:next});
  res.json({id:h._id,status:h.status,phase:eventPhase(h)});
}));

app.get('/api/admin/live-activity',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=await current(); if(!h)return res.json([]);
  const rows=await AuditLog.find({hackathon:h._id}).populate('actor','name role').sort({createdAt:-1}).limit(30).lean();
  res.json(rows.map(x=>({id:x._id,at:x.createdAt,action:x.action,entity:x.entity,actor:x.actor?.name||'System',role:x.actor?.role||'',meta:x.meta||{}})));
}));

app.get('/api/notifications/unread-count',auth,asyncRoute(async(req,res)=>{res.json({count:await Notification.countDocuments({user:req.user._id,read:false})})}));

app.get('/api/admin/export/:type',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const h=await current(); if(!h)return res.status(404).json({message:'No active hackathon'}); const type=String(req.params.type);
  if(type==='participants'){const rows=await User.find({role:'participant'}).select('name email phone college department course semester group year enrollmentId paymentStatus active createdAt').lean();return sendCsv(res,'participants.csv',['Name','Email','Phone','College','Department','Course','Semester','Group','Year','Enrollment ID','Payment Status','Active','Created'],rows.map(x=>[x.name,x.email,x.phone,x.college,x.department,x.course,x.semester,x.group,x.year,x.enrollmentId,x.paymentStatus,x.active,x.createdAt]));}
  if(type==='teams'){const rows=await Team.find({hackathon:h._id}).populate('leader','name email').populate('members','name email').populate('problem','code title').lean();return sendCsv(res,'teams.csv',['Team','Code','Leader','Leader Email','Members','Problem','Status','Created'],rows.map(x=>[x.name,x.code,x.leader?.name,x.leader?.email,(x.members||[]).map(m=>m.name).join(' | '),x.problem?`${x.problem.code} - ${x.problem.title}`:'',x.status,x.createdAt]));}
  if(type==='submissions'){const rows=await CodeSubmission.find({hackathon:h._id,mode:'submit'}).populate('user','name email').populate('team','name code').populate('problem','code title').lean();return sendCsv(res,'code-submissions.csv',['Participant','Email','Team','Problem','Language','Status','Score','Passed','Total Tests','Created'],rows.map(x=>[x.user?.name,x.user?.email,x.team?.name,x.problem?`${x.problem.code} - ${x.problem.title}`:'',x.language,x.status,x.score,x.passed,x.totalTests,x.createdAt]));}
  if(type==='evaluations'){const rows=await Evaluation.find({submitted:true}).populate('judge','name email').populate('team','name').lean();const teamIds=await Team.find({hackathon:h._id}).distinct('_id');const set=new Set(teamIds.map(String));return sendCsv(res,'evaluations.csv',['Judge','Judge Email','Team','Total','Comments','Submitted'],rows.filter(x=>set.has(String(x.team?._id||x.team))).map(x=>[x.judge?.name,x.judge?.email,x.team?.name,x.total,x.comments,x.submittedAt]));}
  if(type==='certificates'){const rows=await Certificate.find({hackathon:h._id}).populate('user','name email enrollmentId').lean();return sendCsv(res,'certificates.csv',['Participant','Email','Enrollment ID','Type','Certificate ID','Issued'],rows.map(x=>[x.user?.name,x.user?.email,x.user?.enrollmentId,x.type,x.certificateId,x.issuedAt]));}
   if(type==='feedback'){const rows=await Feedback.find({hackathon:h._id}).populate('from','name email role department group year').sort({createdAt:1}).lean();return sendCsv(res,'feedback.csv',['From','Email','Role','Category','Rating','Department','Group','Year','Message','Created'],rows.map(x=>[x.from?.name,x.from?.email,x.from?.role,x.category,x.rating,x.from?.department,x.from?.group,x.from?.year,x.message,x.createdAt]));}
  if(type==='attendance'){const scope=attendanceFilterFromQuery(req);const scopeError=requireAttendanceScope(scope);if(scopeError)return res.status(400).json({message:scopeError});const userFilter={role:'participant',department:scope.department,group:scope.group,year:scope.year};const users=await User.find(userFilter).select('name email enrollmentId department group year college').sort({name:1}).lean();const ids=users.map(x=>x._id);const rows=await Attendance.find({hackathon:h._id,user:{$in:ids}}).sort({at:1}).lean();const scannerIds=[...new Set(rows.map(x=>String(x.scannedBy||'')).filter(isValidObjectId))];const scanners=await User.find({_id:{$in:scannerIds}}).select('name role').lean();const usersById=new Map(users.map(x=>[String(x._id),x]));const scannersById=new Map(scanners.map(x=>[String(x._id),x]));const byUser=new Map();for(const u of users)byUser.set(String(u._id),{user:u,types:new Map()});for(const x of rows){const item=byUser.get(String(x.user||''));if(!item)continue;const old=item.types.get(x.type);if(!old||new Date(x.at)<new Date(old.at))item.types.set(x.type,x);}const out=[...byUser.values()].map(({user,types})=>{const scan=type=>types.get(type);const marked=Object.values(Object.fromEntries([...types.entries()].map(([k,v])=>[k,scannersById.get(String(v.scannedBy||''))?.name||'']))).filter(Boolean).join(' | ');return [user.name,user.email,user.enrollmentId,user.department,user.group,user.year,scan('entry')?'Present':'Absent',scan('entry')?.at||'',scan('exit')?'Recorded':'',scan('exit')?.at||'',scan('workshop')?'Recorded':'',scan('mentor')?'Recorded':'',scan('presentation')?'Recorded':'',marked]});return sendCsv(res,`attendance-${scope.department}-${scope.group}-${scope.year}.csv`,['Participant','Email','Enrollment ID','Department','Group','Year','Entry Status','Entry Time','Exit Status','Exit Time','Workshop','Mentor','Presentation','Marked By'],out);}
  return res.status(400).json({message:'Unknown export type. Use participants, teams, submissions, evaluations, certificates or attendance.'});
}));


app.use('/api', (req,res,next)=>{
  if(res.headersSent) return next();
  res.status(404).json({message:'API endpoint not found.',method:req.method,path:req.originalUrl});
});

app.use((err,req,res,next)=>{console.error(err);if(err?.name==='CastError')return res.status(400).json({message:`Invalid ${err.path||'identifier'}.`});if(err?.code===11000)return res.status(409).json({message:'A record with these details already exists.'});if(err?.name==='ValidationError')return res.status(400).json({message:Object.values(err.errors||{}).map(x=>x.message).join('; ')||'Validation failed.'});res.status(err.status||500).json({message:err.message||'Server error'});});
function configureMongoDns(){
  const raw=process.env.MONGODB_DNS_SERVERS?.split(',').map(x=>x.trim()).filter(Boolean)||[];
  const configured=raw.filter(value=>net.isIP(value));
  const invalid=raw.filter(value=>!net.isIP(value));
  if(invalid.length) console.warn(`Ignoring invalid MONGODB_DNS_SERVERS value(s): ${invalid.join(', ')}`);
  if(!configured.length) return;
  try{
    dns.setServers(configured);
    console.log(`MongoDB DNS servers: ${configured.join(', ')}`);
  }catch(e){
    console.warn(`Could not configure custom DNS servers: ${e.message}`);
  }
}

function mongoConnectionString(){
  const raw=process.env.MONGODB_URI?.trim();
  if(!raw) throw new Error('MONGODB_URI is not configured. Create backend/.env from .env.example.');
  if(!raw.startsWith('mongodb+srv://')) return raw;

  // Use the Atlas SRV URI exactly as configured. This is important when the
  // database password or cluster has changed. A static cluster fallback is
  // supported only when the operator explicitly provides fallback hosts.
  // Atlas SRV lookups can fail on some Windows/ISP DNS configurations.
  // Prefer an explicitly configured fallback, otherwise use the hosts for
  // the BiteCode Atlas cluster used by this project. This keeps the app
  // usable even when _mongodb._tcp SRV resolution is unavailable.
  const fallbackHosts=process.env.MONGODB_FALLBACK_HOSTS?.trim();
  if(!fallbackHosts) return raw;
  const replicaSet=process.env.MONGODB_REPLICA_SET?.trim();
  try{
    const u=new URL(raw);
    const params=new URLSearchParams(u.search);
    if(replicaSet) params.set('replicaSet',replicaSet);
    params.set('authSource',params.get('authSource')||'admin');
    params.set('tls','true');
    if(!params.has('retryWrites')) params.set('retryWrites','true');
    if(!params.has('w')) params.set('w','majority');
    const db=(u.pathname&&u.pathname!=='/')?u.pathname:'/hackathon_platform';
    return `mongodb://${u.username}:${u.password}@${fallbackHosts}${db}?${params.toString()}`;
  }catch(e){
    throw new Error(`Invalid MONGODB_URI: ${e.message}`);
  }
}
async function ensureEventControlDefaults(){
  await Hackathon.updateMany({$or:[{"settings.compilerEnabled":{$exists:false}},{"settings.aiEnabled":{$exists:false}},{"settings.aiMode":{$exists:false}}]},{$set:{"settings.compilerEnabled":true,"settings.aiEnabled":true,"settings.aiMode":'full'}});
  console.log('Event control defaults verified: compiler ON, AI ON, mode FULL where settings were missing.');
}

async function ensureAttendanceCredentials(){
  const cursor=User.find({role:'participant',active:{$ne:false},$or:[{attendanceToken:{$exists:false}},{attendanceToken:null},{attendanceToken:''}]}).select('_id attendanceToken').cursor();
  for await (const u of cursor){
    try{u.attendanceToken=crypto.randomBytes(24).toString('base64url');await u.save();}catch(e){if(e?.code!==11000)throw e;}
  }
}

async function ensureDemoCodingProblem(){
  if(String(process.env.AUTO_SEED||'false').toLowerCase()!=='true') return;
  let h=await Hackathon.findOne({status:{$nin:['closed','archived']}}).sort({createdAt:-1});
  if(!h){
    h=await Hackathon.create({name:'BiteCode 2026',slug:`bitecode-${Date.now()}`,description:'A practical coding and product hackathon.',college:'BiteCode',venue:'Lab / Hybrid',registrationFee:0,teamMin:1,teamMax:5,status:'registration',tracks:['AI & Automation','Developer Tools'],settings:{aiEnabled:true,aiMode:'full',compilerEnabled:true}});
    console.log('Created a default active hackathon for first run.');
  }
  const count=await Problem.countDocuments({hackathon:h._id,published:true});
  if(count===0){
    await Problem.create({hackathon:h._id,code:'BC-01',title:'Sum of Two Numbers',description:'Read two integers and print their sum.',track:'Beginner',difficulty:'Beginner',technologies:['Java','Python','C++'],timeLimit:2,memoryLimit:128000,published:true,testCases:[{input:'10 25',expectedOutput:'35',hidden:false},{input:'100 250',expectedOutput:'350',hidden:false},{input:'-5 15',expectedOutput:'10',hidden:true},{input:'0 0',expectedOutput:'0',hidden:true}]});
    console.log('Created default coding problem BC-01.');
  }
}

async function connectMongoWithRetry(uri){
  const attempts=Math.max(1,Number(process.env.MONGO_CONNECT_ATTEMPTS||8));
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      await mongoose.connect(uri,{serverSelectionTimeoutMS:12000,connectTimeoutMS:12000,maxPoolSize:20});
      console.log(`MongoDB connected on attempt ${attempt}.`);
      return;
    }catch(e){
      lastError=e;
      console.error(`MongoDB connection attempt ${attempt}/${attempts} failed: ${e.message}`);
      if(attempt<attempts) await new Promise(r=>setTimeout(r,Math.min(5000,1000*attempt)));
    }
  }
  if(lastError?.code==='ECONNREFUSED' && String(lastError?.hostname||'').startsWith('_mongodb._tcp.')){
    throw new Error('MongoDB SRV DNS lookup was refused. Check Windows/ISP DNS and, if needed, configure MONGODB_FALLBACK_HOSTS for the current Atlas cluster.');
  }
  throw lastError;
}

async function start(){
  configureMongoDns();
  const mongoUri=mongoConnectionString();
  console.log(`Connecting to MongoDB using ${mongoUri.startsWith('mongodb+srv://')?'SRV':'standard'} connection...`);
  await connectMongoWithRetry(mongoUri);
  for(const [name,description,permissions] of defaultRoles)await Role.updateOne({name},{$set:{description,permissions,system:true},$setOnInsert:{name}},{upsert:true});
  if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD&&!await User.exists({email:process.env.ADMIN_EMAIL.toLowerCase()})){await User.create({name:'System Administrator',email:process.env.ADMIN_EMAIL.toLowerCase(),passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),role:'admin'});console.log('Initial admin created from environment credentials.');}
  await ensureEventControlDefaults();
  await ensureAttendanceCredentials();
  app.listen(process.env.PORT||5000,()=>console.log(`API running on ${process.env.PORT||5000}`));
}
start().catch(e=>{console.error(e);process.exit(1)});
