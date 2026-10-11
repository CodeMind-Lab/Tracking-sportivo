/* Opt-in bridge. Nutrition, measurements and authentication never leave Forma. */
'use strict';
(() => {
  const PROTOCOL='codemind-forma-v1';
  const ALLOWED='https://codemind-projects-lab.renatonoto5396.chatgpt.site';
  let connection=null, accepted=false, sending=false, queued=false, last='';
  const allowed=origin => origin===ALLOWED || (location.hostname==='127.0.0.1' && origin==='http://127.0.0.1:4178');
  async function sourceId() {
    if (DB.sync.url && DB.sync.email) {
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(DB.sync.url.toLowerCase()+'|'+DB.sync.email.toLowerCase().trim()));
      return 'cloud_'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    }
    let id=localStorage.getItem('forma.codemind-source');
    if(!id) {id=crypto.randomUUID();localStorage.setItem('forma.codemind-source',id);}
    return id;
  }
  async function snapshot() {
    const workouts=di('w').slice(-2000).map(w => {
      const minutes=Number(w.dur), start=Number(w.inizio);
      const valid=!!w.fine && minutes>0 && minutes<=300 && Number.isFinite(start) && start>0;
      return {id:w.id,date:w.d,title:[w.sn,w.gn].filter(Boolean).join(' · ') || 'Allenamento',completed:!!w.fine,duration_minutes:minutes>0 && minutes<=300 ? Math.round(minutes) : 0,started_at:valid?new Date(start).toISOString():null,ended_at:valid?new Date(start+Math.round(minutes)*60000).toISOString():null};
    });
    const plans=GIORNI_SETT.flatMap((g,weekday) => {
      const a=allenamentoDi(g.id),p=pianoAllRec(g.id);
      return a?[{id:p.id || 'allena-'+g.id,weekday,title:[a.sc.n,a.g.n].filter(Boolean).join(' · ')}]:[];
    });
    return {version:1,source_id:await sourceId(),workouts,plans};
  }
  async function send() {
    if(!accepted || !connection || window.opener?.closed) return;
    if(sending) {queued=true;return;} sending=true;
    try {const data=await snapshot(), text=JSON.stringify(data);if(text!==last) {last=text;window.opener.postMessage({protocol:PROTOCOL,type:'snapshot',nonce:connection.nonce,snapshot:data},connection.origin);}}
    catch {toast('Non riesco ad aggiornare CodeMind. Riapri il collegamento.');}
    finally {sending=false;if(queued) {queued=false;send();}}
  }
  function consent(data,origin) {
    const turns=(Array.isArray(data.turns)?data.turns:[]).filter(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.date) && ['apertura','chiusura','notte','off'].includes(t.preset)).slice(0,7);
    const existing=document.querySelector('#codemind-connect');if(existing) existing.remove();
    const panel=document.createElement('dialog');panel.id='codemind-connect';
    panel.style.cssText='max-width:520px;width:calc(100% - 32px);border:1px solid #359eba;border-radius:24px;padding:28px;background:var(--bg,#fff);color:var(--txt,#0c2441);font:inherit;';
    panel.innerHTML='<h2>Collega CodeMind Projects</h2><p>Condividi il riepilogo degli allenamenti e il programma settimanale con la tua Agenda. Alimentazione, misure e credenziali restano in Forma.</p><p>Il riepilogo si aggiorna mentre le due finestre restano aperte.</p>' +
      (turns.length ? '<details><summary>Turni da CodeMind · '+turns.length+' giorni</summary><ul>'+
        turns.map(t=>'<li>'+esc(dataCorta(t.date))+': '+esc(turnoInfo(t.preset)?.n || t.preset)+(turnoDi(t.date) && turnoDi(t.date)!==t.preset ? ' · sostituisce '+esc(turnoInfo(turnoDi(t.date))?.n || turnoDi(t.date)) : '')+'</li>').join('')+
        '</ul></details><label style="display:flex;gap:10px;margin:18px 0"><input id="codemind-turns" type="checkbox"> Applica questi turni alle date indicate</label><p style="font-size:13px">I giorni non indicati e i dati di pasti, acqua e passi restano come sono.</p>' : '')+
      '<div style="display:flex;gap:10px;margin-top:24px"><button class="btn" id="codemind-accept">Collega allenamenti</button><button class="btn second" id="codemind-cancel">Annulla</button></div>';
    document.body.append(panel);panel.showModal();
    panel.querySelector('#codemind-cancel').onclick=()=>{window.opener.postMessage({protocol:PROTOCOL,type:'cancelled',nonce:data.nonce},origin);panel.close();panel.remove();};
    panel.querySelector('#codemind-accept').onclick=()=>{
      connection={nonce:data.nonce,origin}; accepted=true;last='';
      if(panel.querySelector('#codemind-turns')?.checked) {
        for(const turn of turns) {const day=giorno(turn.date,true);day.turno=turn.preset;tocca(day);}
        save(true);render();
      }
      panel.close();panel.remove();send();toast('Collegato a CodeMind Projects');
    };
  }
  window.addEventListener('message',e=>{
    const data=e.data;
    if(e.source!==window.opener || !allowed(e.origin) || data?.protocol!==PROTOCOL || data.type!=='connect' || !/^[a-zA-Z0-9-]{20,100}$/.test(data.nonce || '')) return;
    if(accepted && connection?.nonce===data.nonce) return;
    consent(data,e.origin);
  });
  window.addEventListener('forma:data-changed',send);
  if(window.opener && new URLSearchParams(location.search).get('codemind')==='1') {
    window.opener.postMessage({protocol:PROTOCOL,type:'ready'},ALLOWED);
    if(location.hostname==='127.0.0.1') window.opener.postMessage({protocol:PROTOCOL,type:'ready'},'http://127.0.0.1:4178');
  }
})();
