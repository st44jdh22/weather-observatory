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
