/* Complete, explicitly authorised workspace connection. No authentication is shared. */
'use strict';
(() => {
 const origin='https://codemind-projects-lab.renatonoto5396.chatgpt.site',protocol='codemind-forma-workspace-v1';
 let connection,accepted=false,last='',applying=false;const sent=new Map();
 const archive=()=>FormaModel.normalize({items:DB.items,settings:DB.settings,graves:DB.graves});
 async function sourceId(){
  if(DB.sync.url&&DB.sync.email){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(DB.sync.url.toLowerCase()+'|'+DB.sync.email.toLowerCase().trim()));return 'cloud_'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
  let id=localStorage.getItem('forma.codemind-source');if(!id){id=crypto.randomUUID();localStorage.setItem('forma.codemind-source',id);}return id;
 }
 function send(){
  if(!accepted||!connection||applying||window.opener?.closed)return;
  const data=archive(),text=JSON.stringify(data);if(text===last)return;last=text;
  let base=null;try{base=JSON.parse(localStorage.getItem('forma.projects-baseline:'+connection.source_id)||'null');}catch{}
  const request_id=crypto.randomUUID();sent.set(request_id,data);
  window.opener.postMessage({protocol,type:'archive',nonce:connection.nonce,source_id:connection.source_id,archive:data,base,request_id},connection.origin);
 }
 async function consent(data,from){
  const id=await sourceId();
  const accept=()=>{connection={nonce:data.nonce,origin:from,source_id:id};accepted=true;last='';localStorage.setItem('forma.projects-consent:'+id,'yes');send();};
  if(localStorage.getItem('forma.projects-consent:'+id)==='yes'){accept();return;}
  document.querySelector('#codemind-workspace-connect')?.remove();
  const panel=document.createElement('dialog');panel.id='codemind-workspace-connect';
  panel.style.cssText='max-width:560px;width:calc(100% - 32px);border:1px solid #359eba;border-radius:24px;padding:28px;background:var(--bg,#fff);color:var(--txt,#0c2441);font:inherit';
  panel.innerHTML='<h2>Forma dentro CodeMind Projects</h2><p>Collega dieta, diario alimentare, cibi, piani, allenamenti, misure e preferenze. Potrai modificarli direttamente in Projects, usando il tuo account.</p><p>I turni delle date inserite in Projects si applicheranno automaticamente anche qui. Gli altri dati del giorno restano conservati.</p><p>Le modifiche si scambiano mentre il collegamento è aperto. Quando usi le app separatamente, riapri il collegamento per allinearle. Le credenziali restano in questa app.</p><p>'+di('l').length+' voci del diario · '+di('w').length+' allenamenti · '+di('s').length+' schede</p><div style="display:flex;gap:12px;margin-top:24px"><button class="btn" id="codemind-workspace-accept">Collega tutto a Projects</button><button class="btn sec" id="codemind-workspace-cancel">Annulla</button></div>';
  document.body.append(panel);panel.showModal();
  panel.querySelector('#codemind-workspace-accept').onclick=()=>{panel.close();panel.remove();accept();};
  panel.querySelector('#codemind-workspace-cancel').onclick=()=>{panel.close();panel.remove();window.opener.postMessage({protocol,type:'cancelled',nonce:data.nonce},from);};
 }
 window.addEventListener('message',e=>{
  if(e.source!==window.opener||e.origin!==origin||e.data?.protocol!==protocol)return;
  const data=e.data;
  if(data.type==='connect'&&/^[a-zA-Z0-9-]{20,100}$/.test(data.nonce||'')){consent(data,e.origin).catch(err=>toast(err.message));return;}
  if(!accepted||data.nonce!==connection?.nonce||data.source_id!==connection.source_id)return;
  if(data.type==='saved')try{
   const before=archive(),remote=FormaModel.normalize(data.archive);
   let base=null;try{base=JSON.parse(localStorage.getItem('forma.projects-baseline:'+connection.source_id)||'null');}catch{}
   // The first acknowledgement is based on exactly the archive just sent.
   base=sent.get(data.request_id)||base||JSON.parse(last);sent.delete(data.request_id);
   const merged=FormaModel.merge(base,before,remote);applying=true;
   const old=new Map(DB.items.map(i=>[i.id,i]));DB.items=merged.items;DB.settings={...DB.settings,...merged.settings};DB.graves=merged.graves;
   for(const item of DB.items)if(!FormaModel.same(item,old.get(item.id)))DB.dirty[item.id]=1;
   for(const id of old.keys())if(!DB.items.some(i=>i.id===id)){DB.graves[id]=Date.now();delete DB.dirty[id];}
   localStorage.setItem('forma.projects-baseline:'+connection.source_id,JSON.stringify(remote));scadeCatalogo();save(true);render();Sync.schedule();applying=false;
   last=JSON.stringify(remote);send();toast('Forma e Projects allineati');
  }catch(err){applying=false;toast(err.message);window.opener.postMessage({protocol,type:'conflict',nonce:data.nonce,message:err.message},origin);}
  else if(data.type==='error'){last='';toast(data.message||'Collegamento non salvato. I tuoi dati restano in Forma.');}
 });
 window.addEventListener('forma:data-changed',()=>{try{send();}catch(err){toast(err.message);}});
 if(window.opener&&new URLSearchParams(location.search).get('codemind')==='workspace')window.opener.postMessage({protocol,type:'ready'},origin);
})();
