const $=id=>document.getElementById(id);
const form=$('passport'),status=$('status'),review=$('review');
$('preview').addEventListener('click',()=>{
 const name=$('fullName').value.trim(),email=$('email').value.trim();
 if(!name||name.length<2||!email||!$('email').checkValidity()||!$('consent').checked){
  status.textContent='Complete your name and valid email, and confirm the declaration.';review.hidden=true;return;
 }
 const hours=$('seaHours').value;
 const summary=[
  'CAPTAIN PASSPORT — UNSUBMITTED DEVELOPMENT PREVIEW',
  'Full name: '+name,'Email: '+email,
  'Phone: '+$('phone').value.trim(),
  'Qualification: '+$('qualification').value,
  'First aid date: '+$('firstAid').value,
  'Commercial endorsement: '+$('commercial').value,
  'VHF/SRC declared: '+($('vhf').checked?'Yes':'No'),
  'Most recent medical date: '+$('medicalDate').value,
  'Medical certificate expiry: '+$('medicalExpiry').value,
  'Relevant sea hours declared: '+hours,
  'Vessel categories: '+$('boatClasses').value.trim(),
  'Experience: '+$('experience').value.trim(),
  'Requested vessels: '+$('requestVessels').value.trim(),
  'APPROVAL STATUS: NOT SUBMITTED — NO VESSEL ACCESS GRANTED'
 ];
 review.textContent=summary.join('\n');review.hidden=false;
 status.textContent='Draft ready for review on this device. Nothing has been uploaded, emailed or registered.';
});
form.addEventListener('reset',()=>{review.hidden=true;status.textContent='No application submitted.';});

let challenge=null;
async function sendRegistration(path,body){
 const response=await fetch('/api/registration/'+path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;
}
$('submitApplication').addEventListener('click',async()=>{
 if(!form.checkValidity()||!$('consent').checked){form.reportValidity();status.textContent='Please complete your required details and declaration.';return}
 const b={invitation:$('invitation').value.trim(),full_name:$('fullName').value.trim(),email:$('email').value.trim(),phone:$('phone').value.trim(),experience_summary:$('experience').value.trim(),qualification_title:$('qualification').value||'Not specified',qualification_type:'OTHER',confirm_accuracy:$('consent').checked};
 $('submitApplication').disabled=true;
 try{
  challenge=await sendRegistration('apply',b);
  $('verify').hidden=false;
  status.textContent='Application accepted for email verification. Enter the code you receive. No vessel access has been granted.';
 }catch(e){status.textContent='Application not submitted: '+e.message}
 finally{$('submitApplication').disabled=false}
});
$('verifyEmail').addEventListener('click',async()=>{
 if(!challenge)return;
 try{
  const d=await sendRegistration('verify-email',{application_id:challenge.application_id,challenge_id:challenge.challenge_id,code:$('verifyCode').value.trim()});
  if(d.status==='email_verified_pending_administrator_review'){
   status.textContent='Email verified. Your application is pending manual review. You cannot operate fleet accounts until authorised.';
   $('verify').hidden=true;$('submitApplication').disabled=true;
  }
 }catch(e){status.textContent='Email verification failed: '+e.message}
});
