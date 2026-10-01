import multer from 'multer'; import fs from 'fs'; import path from 'path';
const dir=process.env.UPLOAD_DIR||'uploads'; fs.mkdirSync(dir,{recursive:true}); const storage=multer.diskStorage({destination:(_,__,cb)=>cb(null,dir),filename:(_,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(file.originalname))});
export const upload=multer({storage,limits:{fileSize:10*1024*1024},fileFilter:(_,file,cb)=>{const ok=/\.(png|jpe?g|webp|pdf|pptx?|zip|docx?)$/i.test(file.originalname);cb(ok?null:new Error('Unsupported file type'),ok)}});
