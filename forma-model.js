/* Shared archive model. Authentication and connection settings are never transferred. */
'use strict';
(() => {
  const types=new Set(['a','ag','agr','cfg','g','gt','in','l','m','p','pa','r','s','tn','tu','w']);
  const settings=new Set(['recDefault','preavviso','pianoAperto','filtri','fAperti','spesaGiorni','spesaPresi']);
  const forbidden=/^(?:__proto__|prototype|constructor|sync|access|refresh|password|token|anon|secret|service_role|authorization|apikey)$/i;
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
  const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
  function clean(value,depth=0) {
    if(depth>15) throw Error('Archivio troppo complesso.');
    if(value===null || typeof value==='boolean')return value;
    if(typeof value==='string'){if(value.length>100000)throw Error('Testo troppo lungo.');return value;}
    if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Numero non valido.');return value;}
    if(Array.isArray(value)){if(value.length>20000)throw Error('Troppi elementi.');return value.map(x=>clean(x,depth+1));}
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([k,v])=>!forbidden.test(k)&&v!==undefined).map(([k,v])=>[k,clean(v,depth+1)]));
    throw Error('Archivio non valido.');
  }
  function normalize(value) {
    if(!value || !Array.isArray(value.items) || value.items.length>20000)throw Error('Archivio Forma non valido.');
    const seen=new Set();
    const items=value.items.map(item=>{
      if(!item || typeof item.id!=='string' || !item.id || item.id.length>200 || seen.has(item.id) || !types.has(item.t))throw Error('Voce Forma non valida o duplicata.');
      seen.add(item.id);return clean(item);
    });
    const out={version:1,items,settings:clean(Object.fromEntries(Object.entries(value.settings||{}).filter(([key])=>settings.has(key)))),graves:clean(value.graves||{})};
    for(const [id,time] of Object.entries(out.graves)){if(id.length>200 || !Number.isFinite(time) || time<0)throw Error('Storico cancellazioni non valido.');}
    for(const item of items)delete out.graves[item.id];
    if(new TextEncoder().encode(JSON.stringify(out)).length>6000000)throw Error('Archivio superiore a 6 MB. Esporta un backup prima di ridurlo.');
    return out;
  }
  // Three-way merge: independent fields merge; concurrent edits of the same field stop.
  function merge(base,local,remote) {
    local=normalize(local);remote=normalize(remote);
    if(!base) {
      const byId=new Map(remote.items.map(x=>[x.id,x]));
      const graves={...remote.graves};
      for(const [id,time] of Object.entries(local.graves))graves[id]=Math.max(time,graves[id]||0);
      for(const item of local.items){const prev=byId.get(item.id);if(!prev || (item.updatedAt||0)>(prev.updatedAt||0))byId.set(item.id,item);}
      return normalize({items:[...byId.values()].filter(x=>(graves[x.id]||0)<=(x.updatedAt||0)),settings:{...remote.settings,...local.settings},graves});
    }
    base=normalize(base);
    const maps=[base,local,remote].map(a=>new Map(a.items.map(i=>[i.id,i]))), ids=new Set(maps.flatMap(m=>[...m.keys()]));
    const items=[];
    const field=(b,l,r,label)=>{
      if(same(l,b))return r;
      if(same(r,b)||same(l,r))return l;
      throw Error('Modifiche contemporanee su '+label+'. Le tue modifiche restano salvate: ricarica o esporta una copia prima di scegliere.');
    };
    for(const id of ids) {
      const [b,l,r]=maps.map(m=>m.get(id));let item;
      if(b&&l&&r){item={};for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
        const val=key==='updatedAt'?Math.max(b[key]||0,l[key]||0,r[key]||0):field(b[key],l[key],r[key],(l.n||l.gn||id)+' · '+key);
        if(val!==undefined)item[key]=val;
      }}else item=field(b,l,r,id);
      if(item)items.push(item);
    }
    const mergedSettings={};for(const key of new Set([...Object.keys(base.settings),...Object.keys(local.settings),...Object.keys(remote.settings)])){
      const val=field(base.settings[key],local.settings[key],remote.settings[key],'preferenze · '+key);if(val!==undefined)mergedSettings[key]=val;
    }
    const graves={...remote.graves};for(const [id,time] of Object.entries(local.graves))graves[id]=Math.max(time,graves[id]||0);
    for(const id of maps[0].keys())if(!items.some(i=>i.id===id))graves[id]=Math.max(Date.now(),graves[id]||0);
    return normalize({items,settings:mergedSettings,graves});
  }
  const presets={apertura:{n:'Apertura',ore:'07:30 – 15:30',ic:'🌅',col:'ambra'},chiusura:{n:'Chiusura',ore:'15:30 – 23:30',ic:'🌆',col:'corallo'},notte:{n:'Notte',ore:'23:30 – 07:30',ic:'🌙',col:'viola'},off:{n:'OFF',ore:'riposo',ic:'🏠',col:'verde'}};
  function applyTurns(archive,turns,previous=[]) {
    const a=normalize(archive),items=a.items,now=Date.now();
    for(const old of previous){if(turns.some(t=>t.date===old.date))continue;const g=items.find(x=>x.t==='g'&&x.d===old.date);if(g?.turno==='cm-work-'+old.preset){g.turno='';g.updatedAt=now;}}
    for(const turn of turns){
      if(!presets[turn.preset] || !/^\d{4}-\d{2}-\d{2}$/.test(turn.date))continue;
      const id='cm-work-'+turn.preset;
      if(!items.some(x=>x.id===id))items.push({id,t:'tn',...presets[turn.preset],riposo:turn.preset==='off',ord:100,updatedAt:now});
      let g=items.find(x=>x.t==='g'&&x.d===turn.date);
      if(!g){g={id:'g-'+turn.date,t:'g',d:turn.date,acqua:0,passi:0};items.push(g);}
      if(g.turno!==id){g.turno=id;g.updatedAt=now;delete a.graves[g.id];}
    }
    return a;
  }
  function sport(archive,source_id) {
    const a=normalize(archive),days=['lun','mar','mer','gio','ven','sab','dom'];
    return {version:1,source_id,workouts:a.items.filter(i=>i.t==='w').slice(-2000).map(w=>{
      const minutes=Number(w.dur),start=Number(w.inizio),valid=w.fine&&minutes>0&&minutes<=300&&Number.isFinite(start)&&start>0;
      return {id:w.id,date:w.d,title:[w.sn,w.gn].filter(Boolean).join(' · ')||'Allenamento',completed:!!w.fine,duration_minutes:minutes>0&&minutes<=300?Math.round(minutes):0,started_at:valid?new Date(start).toISOString():null,ended_at:valid?new Date(start+Math.round(minutes)*60000).toISOString():null};
    }),plans:days.flatMap((gs,weekday)=>{
      const p=a.items.find(x=>x.t==='pa'&&x.gs===gs),s=p&&a.items.find(x=>x.id===p.sid&&x.t==='s'),g=s?.giorni?.find(g=>g.n===p.gn);
      return g?[{id:p.id,weekday,title:[s.n,g.n].filter(Boolean).join(' · ')}]:[];
    })};
  }
  globalThis.FormaModel=Object.freeze({normalize,merge,applyTurns,sport,same});
})();
