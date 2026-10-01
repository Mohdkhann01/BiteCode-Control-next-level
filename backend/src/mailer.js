import nodemailer from 'nodemailer';

const host = process.env.GMAIL_HOST || 'smtp.gmail.com';
const port = Number(process.env.GMAIL_PORT || 465);
const secure = String(process.env.GMAIL_SECURE ?? 'true').toLowerCase() === 'true';

let transporter = null;
function getTransporter(){
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g,'').trim();
  if(!user || !pass) return null;
  if(!transporter){
    transporter = nodemailer.createTransport({host,port,secure,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
  }
  return transporter;
}

export const mailConfigured = () => Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim());

function escapeHtml(value=''){
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

export async function sendFeedbackConfirmation({to,name,category,rating,message,eventName}){
  const transport = getTransporter();
  if(!transport || !to) return {sent:false,skipped:true};
  const from = process.env.GMAIL_FROM?.trim() || `BiteCode Control <${process.env.GMAIL_USER}>`;
  const safeName=escapeHtml(name||'Participant');
  const safeCategory=escapeHtml(category||'Feedback');
  const safeRating=rating==null?'Not provided':`${escapeHtml(rating)}/5`;
  const safeMessage=escapeHtml(message||'').replace(/\n/g,'<br>');
  const safeEvent=escapeHtml(eventName||'BiteCode');
  await transport.sendMail({
    from,to,subject:`${safeEvent} — Feedback received`,
    text:`Hi ${name||'Participant'},\n\nWe received your ${category||'feedback'} for ${eventName||'BiteCode'}.\nRating: ${rating==null?'Not provided':`${rating}/5`}\n\n${message||''}\n\nThank you.\nBiteCode Control`,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#182033;max-width:620px;margin:auto"><h2>${safeEvent} — Feedback received</h2><p>Hi ${safeName},</p><p>We received your feedback successfully.</p><p><b>Category:</b> ${safeCategory}<br><b>Rating:</b> ${safeRating}</p><div style="padding:16px;background:#f5f7fb;border-radius:10px">${safeMessage}</div><p>Thank you for helping improve the event.</p><p>— BiteCode Control</p></div>`
  });
  return {sent:true};
}
