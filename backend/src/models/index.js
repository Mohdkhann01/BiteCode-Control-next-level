import mongoose from 'mongoose';
const {Schema,model}=mongoose;

const userSchema=new Schema({
  name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true},
  role:{type:String,enum:['participant','admin','finance','judge','mentor','volunteer'],default:'participant'},permissions:[String],phone:String,college:String,department:String,course:String,semester:String,enrollmentId:String,photo:String,github:String,linkedin:String,portfolio:String,skills:[String],bio:String,group:String,year:String,
  paymentStatus:{type:String,enum:['unpaid','pending','paid','rejected'],default:'unpaid'},active:{type:Boolean,default:true},attendanceToken:{type:String,unique:true,sparse:true,index:true},passwordResetToken:String,passwordResetExpires:Date
},{timestamps:true});

const hackathonSchema=new Schema({
  name:{type:String,required:true,trim:true},slug:{type:String,required:true,unique:true,trim:true},description:String,college:String,department:String,venue:String,logoUrl:String,heroImageUrl:String,
  registrationFee:{type:Number,default:0},teamMin:{type:Number,default:3},teamMax:{type:Number,default:5},
  registrationDeadline:Date,hackStart:Date,hackEnd:Date,submissionDeadline:Date,judgingStart:Date,judgingEnd:Date,resultsAt:Date,
  status:{type:String,enum:['draft','registration','live','submission','judging','results','closed','archived'],default:'draft'},
  rules:[String],tracks:[String],prizes:[{title:String,amount:String,description:String}],timeline:[{title:String,start:Date,end:Date,description:String}],
  sponsors:[{name:String,logoUrl:String,url:String}],mentors:[{name:String,role:String,photoUrl:String}],judges:[{name:String,role:String,photoUrl:String}],
  faqs:[{question:String,answer:String}],website:{heroBadge:String,heroTitle:String,heroAccent:String,heroDescription:String,aboutTitle:String,aboutText:String,ctaLabel:String},
  judgingRubric:[{name:String,maxScore:{type:Number,default:20},weight:{type:Number,default:1}}],settings:{aiEnabled:{type:Boolean,default:true},aiMode:{type:String,enum:['full','guidance'],default:'full'},compilerEnabled:{type:Boolean,default:true},peopleChoice:{type:Boolean,default:false},publicLeaderboard:{type:Boolean,default:false},features:{payments:{type:Boolean,default:true},teams:{type:Boolean,default:true},submissions:{type:Boolean,default:true},judging:{type:Boolean,default:true},announcements:{type:Boolean,default:true},certificates:{type:Boolean,default:true},attendance:{type:Boolean,default:true}}}
},{timestamps:true});

const roleSchema=new Schema({name:{type:String,required:true,unique:true,trim:true},description:String,permissions:[String],system:{type:Boolean,default:false}},{timestamps:true});
const paymentSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},amount:{type:Number,required:true},method:{type:String,enum:['razorpay'],default:'razorpay'},razorpayOrderId:{type:String,required:true},razorpayPaymentId:{type:String,index:true,sparse:true},razorpaySignature:String,status:{type:String,enum:['pending','paid','failed'],default:'pending'},reviewedAt:Date,rejectionReason:String},{timestamps:true});
paymentSchema.index({hackathon:1,user:1,status:1,createdAt:-1});
paymentSchema.index({razorpayOrderId:1},{unique:true});
const teamSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},name:{type:String,required:true},code:{type:String,required:true,unique:true},leader:{type:Schema.Types.ObjectId,ref:'User',required:true},members:[{type:Schema.Types.ObjectId,ref:'User'}],problem:{type:Schema.Types.ObjectId,ref:'Problem'},status:{type:String,enum:['incomplete','confirmed','submitted','locked'],default:'incomplete'}},{timestamps:true});
const invitationSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},team:{type:Schema.Types.ObjectId,ref:'Team',required:true},from:{type:Schema.Types.ObjectId,ref:'User',required:true},to:{type:Schema.Types.ObjectId,ref:'User',required:true},status:{type:String,enum:['pending','accepted','rejected','cancelled'],default:'pending'}},{timestamps:true});
const problemSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon'},code:{type:String,required:true},title:{type:String,required:true},description:String,track:String,difficulty:{type:String,default:'Intermediate'},requirements:[String],technologies:[String],criteria:[String],resources:[String],timeLimit:{type:Number,default:2},memoryLimit:{type:Number,default:128000},testCases:[{input:String,expectedOutput:String,hidden:{type:Boolean,default:false}}],published:{type:Boolean,default:false}},{timestamps:true});
const submissionSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},team:{type:Schema.Types.ObjectId,ref:'Team',required:true,unique:true},projectName:{type:String,required:true},problem:{type:Schema.Types.ObjectId,ref:'Problem',required:true},description:String,features:[String],techStack:[String],github:String,liveDemo:String,demoVideo:String,presentation:String,screenshots:[String],futureScope:String,status:{type:String,enum:['draft','submitted','locked','under_evaluation','evaluated'],default:'draft'},submittedAt:Date},{timestamps:true});
const assignmentSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},judge:{type:Schema.Types.ObjectId,ref:'User',required:true},team:{type:Schema.Types.ObjectId,ref:'Team',required:true},status:{type:String,enum:['assigned','in_review','completed'],default:'assigned'}},{timestamps:true}); assignmentSchema.index({hackathon:1,judge:1,team:1},{unique:true}); assignmentSchema.index({hackathon:1,judge:1,createdAt:-1}); assignmentSchema.index({hackathon:1,team:1});
const evaluationSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},assignment:{type:Schema.Types.ObjectId,ref:'JudgeAssignment',required:true,unique:true},judge:{type:Schema.Types.ObjectId,ref:'User',required:true},team:{type:Schema.Types.ObjectId,ref:'Team',required:true},scores:[{criterion:String,score:Number,max:Number}],total:Number,comments:String,submitted:{type:Boolean,default:false},submittedAt:Date},{timestamps:true});
const announcementSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},title:{type:String,required:true},message:{type:String,required:true},type:{type:String,enum:['general','important','emergency','schedule','submission','technical'],default:'general'},published:{type:Boolean,default:true},createdBy:{type:Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
const ticketSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},subject:String,category:String,message:String,status:{type:String,enum:['open','in_progress','resolved','closed'],default:'open'},replies:[{by:{type:Schema.Types.ObjectId,ref:'User'},message:String,at:Date}]},{timestamps:true});
evaluationSchema.index({hackathon:1,team:1,submitted:1});
const voteSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},team:{type:Schema.Types.ObjectId,ref:'Team',required:true}},{timestamps:true}); voteSchema.index({hackathon:1,user:1},{unique:true});
const attendanceSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},type:{type:String,enum:['entry','exit','workshop','mentor','presentation'],default:'entry'},at:{type:Date,default:Date.now},scannedBy:{type:Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
attendanceSchema.index({hackathon:1,user:1},{unique:true,partialFilterExpression:{type:'entry'}});
attendanceSchema.index({hackathon:1,at:-1});
const antiCheatSchema=new Schema({
  hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},
  user:{type:Schema.Types.ObjectId,ref:'User',required:true},
  problem:{type:Schema.Types.ObjectId,ref:'Problem'},
  type:{type:String,enum:['tab_hidden','tab_visible','window_blur','fullscreen_exit','clipboard_blocked','context_menu','camera_movement'],required:true},
  details:Schema.Types.Mixed,
  screenshot:String
},{timestamps:true});
antiCheatSchema.index({hackathon:1,user:1,createdAt:-1});
const certificateSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},type:{type:String,required:true},certificateId:{type:String,required:true,unique:true},fileUrl:String,template:{organizerName:String,organizerLocation:String,established:String,title:String,subtitle:String,body:String,achievementLabel:String,track:String,signatureName:String,signatureTitle:String,logoUrl:String,primaryColor:{type:String,default:'#243b86'},accentColor:{type:String,default:'#c7a45b'}},issuedAt:{type:Date,default:Date.now}},{timestamps:true});
const codeSubmissionSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon'},problem:{type:Schema.Types.ObjectId,ref:'Problem',required:true},team:{type:Schema.Types.ObjectId,ref:'Team'},user:{type:Schema.Types.ObjectId,ref:'User',required:true},language:String,languageId:Number,sourceCode:String,mode:{type:String,enum:['run','submit'],default:'run'},status:String,score:Number,passed:Number,totalTests:Number,stdout:String,stderr:String,compileOutput:String,time:String,memory:Number,results:Schema.Types.Mixed},{timestamps:true});
const platformSettingsSchema=new Schema({key:{type:String,unique:true,default:'platform'},compilerEnabled:{type:Boolean,default:true}},{timestamps:true});
const auditSchema=new Schema({hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon'},actor:{type:Schema.Types.ObjectId,ref:'User'},action:String,entity:String,entityId:String,meta:Schema.Types.Mixed},{timestamps:true});

const feedbackSchema=new Schema({
  hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon'},
  from:{type:Schema.Types.ObjectId,ref:'User',required:true},
  fromRole:{type:String,required:true},
  category:{type:String,enum:['participant','judge','mentor','volunteer','admin','general'],required:true},
  rating:{type:Number,min:1,max:5},
  message:{type:String,required:true,trim:true,maxlength:3000},
  anonymousToUsers:{type:Boolean,default:false}
},{timestamps:true});
feedbackSchema.index({hackathon:1,category:1,createdAt:-1});
feedbackSchema.index({from:1,createdAt:-1});

const notificationSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true},hackathon:{type:Schema.Types.ObjectId,ref:'Hackathon'},title:{type:String,required:true},message:{type:String,required:true},type:{type:String,enum:['info','success','warning','error'],default:'info'},read:{type:Boolean,default:false},link:String},{timestamps:true});
notificationSchema.index({user:1,read:1,createdAt:-1});
notificationSchema.index({user:1,createdAt:-1});

export const User=model('User',userSchema),Hackathon=model('Hackathon',hackathonSchema),Role=model('Role',roleSchema),Payment=model('Payment',paymentSchema),Team=model('Team',teamSchema),Invitation=model('Invitation',invitationSchema),Problem=model('Problem',problemSchema),Submission=model('Submission',submissionSchema),JudgeAssignment=model('JudgeAssignment',assignmentSchema),Evaluation=model('Evaluation',evaluationSchema),CodeSubmission=model('CodeSubmission',codeSubmissionSchema),Announcement=model('Announcement',announcementSchema),Ticket=model('Ticket',ticketSchema),Feedback=model('Feedback',feedbackSchema),Vote=model('Vote',voteSchema),Attendance=model('Attendance',attendanceSchema),Certificate=model('Certificate',certificateSchema),AuditLog=model('AuditLog',auditSchema),AntiCheat=model('AntiCheat',antiCheatSchema),PlatformSettings=model('PlatformSettings',platformSettingsSchema),Notification=model('Notification',notificationSchema);


