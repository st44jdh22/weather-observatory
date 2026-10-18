// Server-only transactional email transport. No recipient address/API key in public assets.
export function mailerFromEnv(env){
 if(!env?.RESEND_API_KEY||!env?.OTP_FROM_EMAIL||!env?.OTP_ALLOWED_RECIPIENTS)return null;
 const allowed=new Set(String(env.OTP_ALLOWED_RECIPIENTS).split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
 return {async send({to,subject,text}){
  const recipient=String(to||'').trim().toLowerCase();
  if(!allowed.has(recipient))throw Error('RECIPIENT_NOT_APPROVED_FOR_STAGING');
  if(!/^[-\w .()—]{1,120}$/.test(String(subject||'')))throw Error('INVALID_SUBJECT');
  if(typeof text!=='string'||text.length>2000)throw Error('INVALID_EMAIL_BODY');
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({from:env.OTP_FROM_EMAIL,to:[recipient],subject,text})
  });
  if(!response.ok)throw Error('EMAIL_PROVIDER_REJECTED_'+response.status);
  const body=await response.json();
  if(typeof body.id!=='string')throw Error('EMAIL_PROVIDER_UNCONFIRMED');
  return {providerId:body.id,status:'accepted_by_provider'};
 }};
}
