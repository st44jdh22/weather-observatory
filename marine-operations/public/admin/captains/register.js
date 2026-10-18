const $=id=>document.getElementById(id),status=$('status'),tenant=$('tenant'),queue=$('queue'),detail=$('detail');
let selectedApplication=null,allowedVessels=[],actionsEnabled=false;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
async function post(url,data){
 const res=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)});
 const json=await res.json();if(!res.ok)throw Error(json.error||'Action failed');return json;
}
async function get(url){
 const res=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'}});
 const json=await res.json();if(!res.ok)throw Error(json.error||'Request failed');return json;
}
function pair(parent,name,value){const p=el('p');p.append(el('strong',name+': '),document.createTextNode(String(value??'—')));parent.append(p)}
function setStatus(s){status.textContent=s}
async function init(){
 try{
  const data=await get('/api/admin/tenants');
  actionsEnabled=data.actions_enabled===true;
  tenant.replaceChildren(new Option('Select client account',''));
  for(const t of data.tenants||[])tenant.add(new Option(t.name+' ('+t.role+')',t.id));
  tenant.disabled=false;setStatus('Signed in with an administrator account. Choose a client.');
 }catch(e){setStatus('Administrator access unavailable: '+e.message)}
}
async function loadQueue(){
 selectedApplication=null;queue.replaceChildren();detail.replaceChildren(el('h2','Captain Passport'),el('p','Select an application.'));
 if(!tenant.value)return;
 try{
  const root='/api/admin/tenants/'+encodeURIComponent(tenant.value)+'/applications';
  const [data,vessels]=await Promise.all([get(root),get(root+'/vessels')]);allowedVessels=vessels.vessels||[];
  const rows=data.applications||[];
  if(!rows.length)queue.append(el('p','No applications for this client.'));
  for(const a of rows){
   const button=el('button',a.full_name+' — '+a.status+' · '+a.email,'item');
   button.type='button';button.addEventListener('click',()=>openApplication(a.id));queue.append(button);
  }
  setStatus(rows.length+' application(s) loaded.');
 }catch(e){setStatus('Unable to load client applications: '+e.message)}
}
async function openApplication(id){
 const client=tenant.value; if(!client)return;
 selectedApplication=id;detail.replaceChildren(el('h2','Captain Passport'));
 try{
  const d=await get('/api/admin/tenants/'+encodeURIComponent(client)+'/applications/'+encodeURIComponent(id));
  if(tenant.value!==client||selectedApplication!==id)return;
  const a=d.application;
  pair(detail,'Captain',a.full_name);pair(detail,'Email',a.email);pair(detail,'Email verified',a.email_verified_at?'Yes':'No');
  pair(detail,'Status',a.status);pair(detail,'Sea experience',a.experience_summary||'Not provided');
  const section=el('h3','Qualifications');detail.append(section);
  if(!(d.qualifications||[]).length)detail.append(el('p','No qualifications submitted.'));
  for(const q of d.qualifications||[]){
   pair(detail,q.title,(q.verification_status||'unverified')+' · expires '+(q.expiry_date||'not recorded'));
   if(actionsEnabled&&q.verification_status==='unverified'){
    const verify=el('button','Mark verified'),rejectQ=el('button','Reject evidence','secondary'),actions=el('div',null,'row');
    for(const [button,verdict] of [[verify,'verified'],[rejectQ,'rejected']]){
     button.addEventListener('click',()=>runAction('verify-qualification',{qualification_id:q.id,verdict},'Confirm qualification '+verdict+'?'));
     actions.append(button);
    }
    detail.append(actions);
   }
  }
  detail.append(el('h3','Document evidence'));
  pair(detail,'Private document references',(d.documents||[]).length);
  for(const doc of d.documents||[])pair(detail,doc.type,doc.scan_status+' · '+doc.mime_type);
  detail.append(el('h3','Sea time'));
  for(const entry of d.sea_time||[])pair(detail,entry.vessel_class,entry.hours_declared+' hours declared · '+(entry.verified_hours??'not verified')+' verified');
  detail.append(el('h3','Vessel authorisations'));
  const active=new Set((d.vessel_approvals||[]).filter(x=>x.status==='approved').map(x=>x.vessel_id));
  for(const vessel of allowedVessels){
   pair(detail,vessel.name,active.has(vessel.id)?'Approved':'Not authorised');
   if(actionsEnabled&&a.status==='approved'){
    const isApproved=active.has(vessel.id),label=isApproved?'Revoke access to '+vessel.name:'Authorise '+vessel.name;
    const button=el('button',label,isApproved?'secondary':'');
    button.addEventListener('click',()=>runAction(isApproved?'revoke-vessel':'assign-vessel',{vessel_id:vessel.id},'Confirm: '+label+'?'));
    detail.append(button);
   }
  }
  const info=el('p','Approvals are controlled server-side. Self-registration never gives vessel access.','muted');detail.append(info);
  if(a.status==='pending'||a.status==='under_review'){
   detail.append(el('h3','Administrator review'));
   const note=el('textarea');note.rows=3;note.placeholder='Review notes';note.maxLength=500;detail.append(note);
   const bar=el('div',null,'row'),review=el('button','Mark under review'),reject=el('button','Reject application','secondary'),approve=el('button','Approve captain (no vessel access)');
   for(const b of [review,reject,approve]){b.type='button';b.disabled=!actionsEnabled;bar.append(b)}
   review.addEventListener('click',()=>runAction('review',{status:'under_review',note:note.value},'Mark this application under review?'));
   reject.addEventListener('click',()=>runAction('review',{status:'rejected',note:note.value},'Reject this application?'));
   approve.addEventListener('click',()=>runAction('approve',{note:note.value},'Approve this captain without granting vessel access?'));
   detail.append(bar,el('p',actionsEnabled?'All actions are logged and confirmed by the server.':'Review actions are disabled until secure staging activation.','muted'));
  }
 }catch(e){setStatus('Unable to load passport: '+e.message)}
}
async function runAction(action,data,question){
 if(!actionsEnabled||!selectedApplication||!tenant.value)return;
 if(!window.confirm(question))return;
 try{
  const url='/api/admin/tenants/'+encodeURIComponent(tenant.value)+'/applications/'+encodeURIComponent(selectedApplication)+'/'+action;
  const result=await post(url,data);
  setStatus('Server response: '+result.status+'. The register has been refreshed.');
  await loadQueue();
 }catch(e){setStatus('Action was not completed: '+e.message)}
}
tenant.addEventListener('change',loadQueue);
init();
