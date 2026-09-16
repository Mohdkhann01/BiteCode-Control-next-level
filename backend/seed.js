import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import bcrypt from 'bcryptjs';
import {User,Hackathon,Problem,Role} from './src/models/index.js';

const roles=[
  ['admin','Full platform control',['events.manage','participants.manage','teams.manage','problems.manage','judging.manage','payments.manage','website.manage','roles.manage','coding.view','coding.manage']],
  ['finance','Payment operations',['payments.manage']],
  ['judge','Evaluation workspace',['judging.evaluate','coding.view']],
  ['mentor','Team guidance',['teams.view','submissions.view']],
  ['volunteer','Event operations',['attendance.manage','teams.view']],
  ['participant','Builder account',['profile.manage','teams.self','submissions.self']]
];

const rawUri=process.env.MONGODB_URI?.trim();
if(!rawUri) throw new Error('MONGODB_URI is missing. Create backend/.env first.');
const dnsServers=process.env.MONGODB_DNS_SERVERS?.split(',').map(x=>x.trim()).filter(Boolean);
if(dnsServers?.length) dns.setServers(dnsServers);
function mongoUri(){
  if(!rawUri.startsWith('mongodb+srv://')) return rawUri;
  const hosts=process.env.MONGODB_FALLBACK_HOSTS?.trim();
  if(!hosts) return rawUri;
  const u=new URL(rawUri); const q=new URLSearchParams(u.search);
  if(process.env.MONGODB_REPLICA_SET) q.set('replicaSet',process.env.MONGODB_REPLICA_SET);
  q.set('authSource',q.get('authSource')||'admin'); q.set('tls','true');
  const db=u.pathname&&u.pathname!=='/'?u.pathname:'/hackathon_platform';
  return `mongodb://${u.username}:${u.password}@${hosts}${db}?${q.toString()}`;
}

await mongoose.connect(mongoUri(),{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000});

for(const [name,description,permissions] of roles){
  await Role.updateOne({name},{$setOnInsert:{name,description,permissions,system:true}},{upsert:true});
}

if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){
  const email=process.env.ADMIN_EMAIL.toLowerCase().trim();
  if(!await User.exists({email})) await User.create({name:'System Administrator',email,passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),role:'admin'});
}

let h=await Hackathon.findOne({slug:'bitecode-2026'});
if(!h){
  h=await Hackathon.create({
    name:'BiteCode 2026',slug:'bitecode-2026',
    description:'A technology hackathon where builders solve meaningful problems with practical software.',
    college:'BiteCode',venue:'Lab / Hybrid',registrationFee:0,teamMin:1,teamMax:5,status:'registration',
    tracks:['AI & Automation','FinTech & Web3','Sustainability','Developer Tools'],
    prizes:[{title:'Grand Prize',amount:'₹1,00,000',description:'Best overall product.'},{title:'Best Innovation',amount:'₹50,000',description:'Most original technical idea.'}],
    website:{heroBadge:'BITECODE · BUILD SPRINT',heroTitle:'Build the future.',heroAccent:'One commit at a time.',heroDescription:'A practical coding and product hackathon.'},judgingRubric:[{name:'Problem fit',maxScore:20,weight:1},{name:'Technical execution',maxScore:20,weight:1},{name:'Innovation',maxScore:20,weight:1},{name:'UX / usability',maxScore:20,weight:1},{name:'Impact',maxScore:20,weight:1}]
  });
}

let problem=await Problem.findOne({code:'BC-01'});
const testCases=[
  {input:'10 25',expectedOutput:'35',hidden:false},
  {input:'100 250',expectedOutput:'350',hidden:false},
  {input:'-5 15',expectedOutput:'10',hidden:true},
  {input:'0 0',expectedOutput:'0',hidden:true}
];
if(!problem){
  problem=await Problem.create({
    hackathon:h._id,code:'BC-01',title:'Sum of Two Numbers',
    description:'Read two integers and print their sum.',track:'Beginner',difficulty:'Beginner',
    technologies:['Java','Python','C++'],timeLimit:2,memoryLimit:128000,published:true,testCases
  });
}else{
  problem.hackathon=h._id;
  problem.published=true;
  problem.testCases=testCases;
  await problem.save();
}

console.log('Seed complete.');
console.log(`Demo problem: ${problem.code} · ${problem.title}`);
console.log('Public tests: 10 25 -> 35, 100 250 -> 350');
await mongoose.disconnect();
