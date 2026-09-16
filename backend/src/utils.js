import jwt from 'jsonwebtoken'; import crypto from 'crypto';
export const tokenFor=u=>jwt.sign({id:u._id,role:u.role},process.env.JWT_SECRET,{expiresIn:'7d'});
export const code=()=>crypto.randomBytes(4).toString('hex').toUpperCase(); export const certId=()=>`CERT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export const audit=async(A,actor,action,entity,entityId,meta={})=>{try{const hackathon=meta?.hackathon||meta?.hackathonId||undefined;await A.create({actor,action,entity,entityId,meta,hackathon})}catch{}};
