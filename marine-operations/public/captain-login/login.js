const $=id=>document.getElementById(id);let challenge=null;
function show(message){$('status').textContent=message}
async function api(path,method='GET',payload=null){
 const result=await fetch('/api/auth/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
 const data=await result.json();if(!result.ok)throw new Error(data.error||'Request failed');return data;
}
async function refresh(){
 try{
  const d=await api('me');$('fleet').hidden=false;$('emailStep').hidden=true;$('codeStep').hidden=true;
  const host=$('vessels');host.replaceChildren();
  for(const vessel of d.vessels||[]){
   const card=document.createElement('div');card.className='vessel';
   const name=document.createElement('strong');name.textContent=vessel.name;card.append(name);
   const note=document.createElement('p');note.textContent='This vessel is authorised for your account.';card.append(note);host.append(card);
  }
  show('Signed in. These are your current authorised vessels.');
 }catch{$('fleet').hidden=true}
}
$('request').addEventListener('click',async()=>{
 const email=$('email').value.trim();if(!$('email').checkValidity()||!email){show('Enter a valid email address.');return}
 $('request').disabled=true;
 try{const d=await api('request-code','POST',{email});challenge=d.challenge_id;
  if(challenge){$('emailStep').hidden=true;$('codeStep').hidden=false;show('Check your email and enter the six-digit code.')}
  else show('If this email is registered, a code may have been sent. Contact your fleet administrator if you have no invitation.');
 }catch(e){show('Unable to request code: '+e.message)}finally{$('request').disabled=false}
});
$('verify').addEventListener('click',async()=>{
 if(!challenge||!/^\d{6}$/.test($('code').value.trim())){show('Enter the six-digit code.');return}
 $('verify').disabled=true;
 try{await api('verify-code','POST',{challenge_id:challenge,code:$('code').value.trim()});await refresh()}
 catch(e){show('Verification unsuccessful: '+e.message)}
 finally{$('verify').disabled=false}
});
$('back').addEventListener('click',()=>{$('codeStep').hidden=true;$('emailStep').hidden=false;challenge=null});
$('logout').addEventListener('click',async()=>{try{await api('logout','POST',{})}finally{location.reload()}});
refresh();
