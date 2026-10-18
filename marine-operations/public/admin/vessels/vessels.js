const $=id=>document.getElementById(id),status=$('status'),tenant=$('tenant'),list=$('vesselList'),form=$('vesselForm');
const fields=['name','registration_number','flag_state','make','model','year_built','loa_metres','beam_metres','draft_metres','mmsi','call_sign','hin_cin','insurance_expiry'];
const numeric=new Set(['year_built','loa_metres','beam_metres','draft_metres']);
let vesselId=null,writes=false;
function message(value){status.textContent=value}
async function api(path,method='GET',data){
 const r=await fetch('/api/admin/tenants/'+encodeURIComponent(tenant.value)+'/vessels'+path,{method,credentials:'same-origin',headers:{'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to load');return j;
}
const make=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text||'';if(cls)e.className=cls;return e};
function fill(v={}){
 for(const k of fields)$(k).value=v[k]??'';
 $('formTitle').textContent=v.id?'Edit Vessel Passport · '+v.name:'Register new vessel';
}
function warning(v){
 const host=$('alerts');host.replaceChildren();
 if(v.insurance_expiry){
  const days=Math.ceil((Date.parse(v.insurance_expiry+'T00:00:00Z')-Date.now())/86400000);
  const note=make('p',days<0?'Insurance date has passed':days<=30?'Insurance due within 30 days':'Insurance expiry recorded: '+v.insurance_expiry,days<=30?'warning':'muted');host.append(note);
  host.append(make('p','This is an on-screen indicator only. Automatic notifications are not yet active.','muted'));
 }
}
async function refresh(){
 list.replaceChildren();if(!tenant.value)return;
 try{
  const result=await api('');const items=result.vessels||[];
  if(!items.length)list.append(make('p','No vessels registered.'));
  for(const item of items){
   const b=make('button',item.name+' · '+(item.model||'Model not specified'),'item');
   b.type='button';b.addEventListener('click',()=>openVessel(item.id));list.append(b);
  }
  message(items.length+' vessels loaded for selected client.');
 }catch(e){message('Vessel list unavailable: '+e.message)}
}
async function openVessel(id){
 try{const result=await api('/'+encodeURIComponent(id));vesselId=id;fill(result.vessel);warning(result.vessel);$('save').disabled=!writes;}
 catch(e){message('Cannot open vessel: '+e.message)}
}
$('newVessel').addEventListener('click',()=>{vesselId=null;fill();$('alerts').replaceChildren();$('save').disabled=!writes;});
tenant.addEventListener('change',()=>{vesselId=null;fill();$('save').disabled=!writes;refresh()});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!writes||!tenant.value)return;if(!form.reportValidity())return;
 const data={};for(const k of fields)data[k]=numeric.has(k)?($(k).value===''?null:Number($(k).value)):$(k).value.trim();
 $('save').disabled=true;
 try{const result=await api(vesselId?'/'+encodeURIComponent(vesselId):'','POST',data);
  vesselId=result.id;message('Vessel saved to staging database. No captain permissions granted.');await refresh();await openVessel(vesselId);
 }catch(err){message('Not saved: '+err.message)}finally{$('save').disabled=!writes}
});
(async()=>{
 try{
  const r=await fetch('/api/admin/tenants',{credentials:'same-origin'});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Unauthorised');
  writes=d.actions_enabled===true; // additionally subject to VESSEL_WRITE_ENABLED server-side
  tenant.replaceChildren(new Option('Select client',''));
  for(const t of d.tenants||[])tenant.add(new Option(t.name,t.id));
  tenant.disabled=false;$('newVessel').disabled=!writes;
  message('Select an authorised client. Vessel writes may still be disabled by the staging server.');
 }catch(e){message('Please sign in with an authorised administrator account: '+e.message)}
})();
