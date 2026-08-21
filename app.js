/* Forma — alimentazione e allenamento.
   I dati vivono in localStorage sul dispositivo e funzionano senza rete.
   Se colleghi Supabase (Impostazioni) la stessa roba si ritrova su Mac e iPhone. */

'use strict';

/* ============================================================
   1. Archivio locale
   ============================================================ */

/* Da alzare a ogni pubblicazione: si legge nelle impostazioni e dice a colpo
   d'occhio se il telefono sta usando i file nuovi o quelli vecchi. */
const APP_VERSION = '2026.08.21.1';

const KEY = 'forma.v1';

/* Tutto ciò che deve viaggiare tra i dispositivi sta in items, una riga per
   cosa, con un tipo:
     cfg  target e profilo (una sola riga, id fisso)
     g    il giorno: turno o riposo, acqua, passi
     l    una riga del diario alimentare
     a    un alimento aggiunto da te
     r    una combinazione salvata (un pasto ricorrente)
     s    una scheda di allenamento
     w    una sessione di allenamento svolta
     m    una misura: peso, girovita, massa grassa
   sync/dirty/graves restano fuori da items: sono la sincronizzazione stessa. */
const DB = {
  items: [],
  settings: { ultimoSlot: '', recDefault: 90 },
  sync: { url: '', anon: '', email: '', access: '', refresh: '', expires: 0, cursor: '', at: 0 },
  dirty: {},
  graves: {}
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      DB.items = Array.isArray(d.items) ? d.items : [];
      DB.settings = Object.assign(DB.settings, d.settings || {});
      DB.sync = Object.assign(DB.sync, d.sync || {});
      DB.dirty = d.dirty || {};
      DB.graves = d.graves || {};
    }
  } catch (e) {
    console.error('Dati illeggibili', e);
  }
}

let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1, items: DB.items, settings: DB.settings,
        sync: DB.sync, dirty: DB.dirty, graves: DB.graves
      }));
    } catch (e) {
      toast('Memoria piena: esporta un backup e libera spazio');
    }
  };
  if (now) write(); else saveTimer = setTimeout(write, 400);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Ogni modifica passa da qui: segna l'ora e mette la riga in coda per il
   server. Chiamarla è l'unico modo perché una modifica esca dal telefono. */
function tocca(it) {
  if (it.t === 'a') scadeCatalogo();
  it.updatedAt = Date.now();
  DB.dirty[it.id] = 1;
  save();
  if (typeof Sync !== 'undefined') Sync.schedule();
  return it;
}

function aggiungi(it) {
  it.id = it.id || uid();
  DB.items.push(it);
  return tocca(it);
}

function elimina(id) {
  const i = DB.items.findIndex(x => x.id === id);
  if (i < 0) return;
  if (DB.items[i].t === 'a') scadeCatalogo();
  DB.items.splice(i, 1);
  DB.graves[id] = Date.now();
  delete DB.dirty[id];
  save();
  if (typeof Sync !== 'undefined') Sync.schedule();
}

/* ============================================================
   2. Utilità
   ============================================================ */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : (d || 0); };
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}

function haptic() { if (navigator.vibrate) navigator.vibrate(8); }

const oggiISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const spostaData = (iso, n) => {
  const d = new Date((iso || oggiISO()) + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
function nomeGiorno(iso) {
  if (iso === oggiISO()) return 'Oggi';
  if (iso === spostaData(oggiISO(), -1)) return 'Ieri';
  if (iso === spostaData(oggiISO(), 1)) return 'Domani';
  return new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long' })
    .replace(/^./, c => c.toUpperCase());
}
const dataLunga = iso =>
  new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const dataCorta = iso =>
  new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

function durata(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/* ============================================================
   3. Lettura dei dati
   ============================================================ */

const di = t => DB.items.filter(i => i.t === t);

/* Numeri di partenza, non consigli: servono solo perché l'app abbia qualcosa da
   mostrare prima che tu apra le impostazioni. I bersagli veri li mette chi usa
   l'app, e da quel momento viaggiano nella sincronizzazione come tutto il resto. */
const TARGET_DEFAULT = {
  kcal: 2000, kcalOff: 1900, prot: 130, carb: 200, gras: 65,
  acqua: 2500, passi: 8000, olio: 25
};
const PROFILO_DEFAULT = { altezza: 175, pesoObiettivo: 75, giroObiettivo: 90 };

function cfg() {
  let c = DB.items.find(i => i.t === 'cfg');
  if (!c) {
    c = aggiungi({ id: 'cfg', t: 'cfg', target: Object.assign({}, TARGET_DEFAULT), profilo: Object.assign({}, PROFILO_DEFAULT) });
  }
  c.target = Object.assign({}, TARGET_DEFAULT, c.target || {});
  c.profilo = Object.assign({}, PROFILO_DEFAULT, c.profilo || {});
  return c;
}

/* Il giorno esiste come riga solo quando ci scrivi qualcosa: aprire il diario
   di una data non deve creare righe da sincronizzare. */
function giorno(d, crea) {
  let g = DB.items.find(i => i.t === 'g' && i.d === d);
  if (!g && crea) g = aggiungi({ id: 'g-' + d, t: 'g', d, tipo: 'turno', acqua: 0, passi: 0 });
  return g || { t: 'g', d, tipo: 'turno', acqua: 0, passi: 0, _finto: true };
}

const kcalTarget = d => {
  const t = cfg().target;
  return giorno(d).tipo === 'off' ? t.kcalOff : t.kcal;
};

const righeDi = d => di('l').filter(i => i.d === d);

/* Da una riga del diario ai numeri veri: il database ha i valori per 100 g,
   la riga ha i grammi. */
function macro(riga) {
  const f = riga.q / 100;
  return { k: riga.k * f, p: riga.p * f, c: riga.c * f, g: riga.g * f };
}
function somma(righe) {
  const t = { k: 0, p: 0, c: 0, g: 0 };
  for (const r of righe) { const m = macro(r); t.k += m.k; t.p += m.p; t.c += m.c; t.g += m.g; }
  return t;
}

/* Il catalogo completo: prima i tuoi alimenti, poi quelli del database. In caso
   di nome uguale vince il tuo, così puoi correggere un valore senza toccare i
   file dell'app.
 *
 * Il risultato si tiene da parte: con quasi mille alimenti e quattordici punti
 * del codice che lo chiedono, ricostruire la lista a ogni chiamata si sentiva
 * mentre si scriveva nella casella di ricerca. Basta buttare la copia quando
 * cambia qualcosa fra i TUOI alimenti — il resto è fisso. */
let _catalogo = null;
function catalogo() {
  if (_catalogo) return _catalogo;
  const miei = di('a').map(a => ({ n: a.n, k: a.k, p: a.p, c: a.c, g: a.g, cat: a.cat || 'Altro', nt: a.nt || '', id: a.id, ean: a.ean, mio: true }));
  const nomi = new Set(miei.map(a => a.n.toLowerCase()));
  _catalogo = miei.concat(ALIMENTI.filter(a => !nomi.has(a.n.toLowerCase())));
  return _catalogo;
}
const scadeCatalogo = () => { _catalogo = null; };

/* Gli ultimi alimenti usati, dal più recente: nella pratica il 90% di ciò che
   mangi in una settimana sta nelle prime dieci righe. */
function recenti(n) {
  /* Il catalogo si costruisce una volta sola: dentro il ciclo verrebbe
     ricostruito per ogni riga del diario, e il diario cresce ogni giorno. */
  const indice = {};
  for (const a of catalogo()) indice[a.n.toLowerCase()] = a;

  const visti = new Set(), out = [];
  const righe = di('l').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const r of righe) {
    const k = r.n.toLowerCase();
    if (visti.has(k)) continue;
    visti.add(k);
    if (indice[k]) out.push(indice[k]);
    if (out.length >= (n || 12)) break;
  }
  return out;
}

const misure = () => di('m').sort((a, b) => a.d < b.d ? -1 : 1);
const ultimaMisura = () => { const m = misure(); return m[m.length - 1] || null; };
const sessioni = () => di('w').sort((a, b) => a.d < b.d ? 1 : -1);
const schede = () => di('s');

/* I sette giorni. L'ordine è quello del calendario italiano: getDay() mette la
   domenica a 0, e usarlo così farebbe cominciare la settimana di domenica. */
const GIORNI_SETT = [
  { id: 'lun', b: 'Lun', l: 'Lunedì' }, { id: 'mar', b: 'Mar', l: 'Martedì' },
  { id: 'mer', b: 'Mer', l: 'Mercoledì' }, { id: 'gio', b: 'Gio', l: 'Giovedì' },
  { id: 'ven', b: 'Ven', l: 'Venerdì' }, { id: 'sab', b: 'Sab', l: 'Sabato' },
  { id: 'dom', b: 'Dom', l: 'Domenica' }
];
const gsDiData = iso => GIORNI_SETT[(new Date(iso + 'T12:00:00').getDay() + 6) % 7].id;

/* Il lunedì della settimana in cui cade una data. */
function lunediDi(iso) {
  const d = new Date((iso || oggiISO()) + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/* Il piano di un giorno della settimana. Come per il giorno, la riga nasce solo
   quando ci scrivi davvero qualcosa. */
function piano(gs, crea) {
  let p = DB.items.find(i => i.t === 'p' && i.gs === gs);
  if (!p && crea) p = aggiungi({ id: 'piano-' + gs, t: 'p', gs, nome: '', righe: [] });
  return p || { t: 'p', gs, nome: '', righe: [], _finto: true };
}
const pianoPieno = gs => (piano(gs).righe || []).length > 0;

/* Copia il piano di un giorno della settimana dentro il diario di una data.
   Le righe diventano voci vere e da lì si modificano come tutte le altre. */
function applicaPiano(gs, data) {
  const p = piano(gs);
  if (!(p.righe || []).length) { toast('Questo giorno non ha ancora un piano'); return; }

  const gia = righeDi(data);
  if (gia.length) {
    if (!confirm('Il diario di ' + nomeGiorno(data).toLowerCase() + ' ha già ' + gia.length +
      ' voci. Le sostituisco con il piano?')) return;
    for (const r of gia) elimina(r.id);
  }
  for (const r of p.righe) {
    aggiungi({ t: 'l', d: data, slot: r.slot, n: r.n, q: r.q, k: r.k, p: r.p, c: r.c, g: r.g });
  }
  haptic();
  toast(p.righe.length + ' voci caricate' + (p.nome ? ' · ' + p.nome : ''));
  render();
}

const slotOra = () => {
  const h = new Date().getHours();
  if (h < 10) return 'colazione';
  if (h < 12) return 'spuntino1';
  if (h < 15) return 'pranzo';
  if (h < 18) return 'spuntino2';
  if (h < 22) return 'cena';
  return 'spuntino3';
};

/* ============================================================
   4. Stato della navigazione
   ============================================================ */

let view = { name: 'oggi', d: oggiISO() };

const TITOLI = {
  oggi: 'Oggi', cibo: 'Cibo', allena: 'Allenamento', report: 'Report',
  settings: 'Impostazioni', scheda: 'Scheda', sessione: 'Allenamento'
};

/* Le sottoschede: Cibo e Allenamento hanno ciascuna un registro filtrabile e
   un'anagrafica. Restano in memoria così tornando dalla scheda ci si ritrova
   dove si era. */
const SUB = { cibo: 'diario', allena: 'sessioni' };

function vai(v, push) {
  /* Ogni stato porta con sé la data, anche chi non la usa. Senza, un
     vai({name:'oggi'}) scritto da qualche parte senza pensarci arriverebbe a
     new Date('undefined') e farebbe cadere tutta la schermata — ed è successo. */
  if (!v.d) v.d = oggiISO();
  view = v;
  if (push !== false) history.pushState(v, '', '');
  window.scrollTo(0, 0);
  render();
}

function render() {
  const app = $('#app');
  const t = view.name;
  /* Anche la sincronizzazione e il ripristino di un backup possono aver
     cambiato i tuoi alimenti senza passare da tocca(). */
  if (DB._alimentiCambiati) { DB._alimentiCambiati = false; scadeCatalogo(); }

  // vale anche per gli stati vecchi che tornano indietro dalla cronologia
  if (!view.d) view.d = oggiISO();

  /* Sulla dashboard il titolo è il marchio. Nelle altre schede resta la parola:
     il logo ripetuto ovunque smetterebbe di dire qualcosa e toglierebbe spazio
     al nome della schermata in cui ti trovi. */
  $('#topTitle').innerHTML = t === 'oggi'
    ? `<img class="brand" src="icons/logo-lockup.png" alt="CodeMind.Lab" width="719" height="90">`
    : esc(TITOLI[t] || 'Forma');
  $('#backBtn').hidden = !['scheda', 'sessione'].includes(t);
  $('#settingsBtn').hidden = t === 'settings';

  /* La scheda attiva si accende in entrambe le navigazioni: quella in basso sul
     telefono e quella a sinistra sul Mac. */
  $$('#tabbar button, .side-menu button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));

  $('#fab').hidden = !['oggi', 'cibo', 'allena'].includes(t);

  if (t === 'oggi') app.innerHTML = vistaOggi();
  else if (t === 'cibo') app.innerHTML = vistaCibo();
  else if (t === 'allena') app.innerHTML = vistaAllena();
  else if (t === 'report') app.innerHTML = vistaReport();
  else if (t === 'settings') app.innerHTML = vistaSettings();
  else if (t === 'scheda') app.innerHTML = vistaScheda();
  else if (t === 'sessione') app.innerHTML = vistaSessione();

  const sf = $('#sideFoot');
  if (sf) sf.innerHTML = 'Versione <b>' + APP_VERSION + '</b><br>' +
    (typeof Sync !== 'undefined' && Sync.signedIn() ? 'Sincronizzato' : 'Solo su questo dispositivo');
}

/* ============================================================
   5. Oggi — il diario della giornata
   ============================================================ */

function barraGiorno(d) {
  /* Nessun blocco in avanti. Bloccarlo a oggi sembrava sensato — non puoi aver
     mangiato domani — ma questo è anche un programma settimanale: dalla
     domenica non si passava al lunedì dopo, e non si poteva preparare in
     anticipo la giornata di un turno. */
  return `<div class="daynav">
    <button class="arw" data-day="-1" aria-label="Giorno precedente">
      <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
    <button class="lbl" data-act="calendario">${esc(nomeGiorno(d))}<small>${esc(dataLunga(d))}</small></button>
    <button class="arw" data-day="1" aria-label="Giorno successivo">
      <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
  </div>`;
}

/* L'anello delle calorie. Un cerchio SVG con il tratteggio calcolato: niente
   librerie, e resta nitido su qualunque schermo. */
function anello(fatto, target) {
  const R = 42, C = 2 * Math.PI * R;
  const q = target > 0 ? Math.min(fatto / target, 1) : 0;
  const over = fatto > target;
  const resta = r0(target - fatto);
  return `<div class="ring ${over ? 'over' : ''}">
    <svg viewBox="0 0 96 96">
      <circle class="rest" cx="48" cy="48" r="${R}"/>
      <circle class="arc" cx="48" cy="48" r="${R}"
        stroke-dasharray="${C.toFixed(1)}"
        stroke-dashoffset="${(C * (1 - q)).toFixed(1)}"
        transform="rotate(-90 48 48)"/>
    </svg>
    <div class="mid"><b>${r0(fatto)}</b><span>di ${target}</span></div>
  </div>`;
}

function barraMacro(cls, nome, fatto, target) {
  const q = target > 0 ? fatto / target : 0;
  const over = q > 1.08;
  return `<div class="macro ${cls}">
    <div class="mh"><span class="mn">${nome}</span>
      <span class="mv">${r0(fatto)}<i>/${target}</i></span></div>
    <div class="bar"><i class="${over ? 'over' : ''}" style="width:${Math.min(q, 1) * 100}%"></i></div>
  </div>`;
}

function vistaOggi() {
  const d = view.d;
  const g = giorno(d);
  const t = cfg().target;
  const righe = righeDi(d);
  const tot = somma(righe);
  const kt = kcalTarget(d);
  const resta = r0(kt - tot.k);

  let h = barraGiorno(d);

  /* La settimana in cui cade il giorno mostrato: toccare "Gio" costa un tocco,
     mentre con le sole frecce ce ne vorrebbero tre. */
  const lun = lunediDi(d);
  h += `<div class="weekstrip">${GIORNI_SETT.map((wg, i) => {
    const data = spostaData(lun, i);
    const suo = righeDi(data).length > 0;
    return `<button data-vaidata="${data}" class="${data === d ? 'on' : ''}">
      ${wg.b}<i class="${suo ? 'pieno' : (pianoPieno(wg.id) ? 'piano' : '')}"></i></button>`;
  }).join('')}</div>`;

  /* Turno o riposo non è sparito, è diventato la scritta stessa: dice già quale
     dei due sei e toccandola passi all'altro. Due pulsanti che ripetevano i
     numeri già scritti nell'anello occupavano un terzo della scheda per una
     cosa che si cambia una volta al giorno. */
  const bicchieri = Math.round(t.acqua / 250);
  const bevuti = Math.round(g.acqua / 250);

  h += `<div class="kcal-card">
    <div class="kcal-top">
      ${anello(tot.k, kt)}
      <div class="kcal-side">
        <div class="big">${resta >= 0 ? resta + ' kcal disponibili' : Math.abs(resta) + ' kcal oltre'}</div>
        <div class="sub">
          ${righe.length
            ? `<button class="link" data-act="vai-diario">${righe.length}${righe.length === 1 ? ' voce registrata' : ' voci registrate'}</button>`
            : 'Niente ancora'} ·
          <button class="tipo-sw ${g.tipo === 'off' ? 'off' : ''}" data-act="cambia-tipo">
            ${g.tipo === 'off' ? 'riposo' : 'turno'} · ${g.tipo === 'off' ? t.kcalOff : t.kcal}
            <svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4M21 7H7M7 21l-4-4 4-4M3 17h14"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="macros">
      ${barraMacro('p', 'Prot', tot.p, t.prot)}
      ${barraMacro('c', 'Carb', tot.c, t.carb)}
      ${barraMacro('g', 'Grassi', tot.g, t.gras)}
    </div>
    <div class="acqua-row">
      <span class="ar-t">💧 Acqua<b>${r1(g.acqua / 1000)}<i> / ${r1(t.acqua / 1000)} L</i></b></span>
      <span class="ar-b">
        <button data-acqua="-250" aria-label="Togli un bicchiere">−</button>
        <button data-acqua="250">+250 ml</button>
      </span>
      <span class="water">${Array.from({ length: bicchieri }, (_, i) =>
        `<i class="${i < bevuti ? 'on' : ''}"></i>`).join('')}</span>
    </div>
  </div>`;

  h += riquadroPiano(d, righe, tot);

  /* I passi restano fuori: sono l'unica leva sul dispendio finché la palestra
     non è a regime, e a differenza dell'acqua si aggiornano una volta sola. */
  h += `<div class="qcard largo">
    <div class="qh">👟 Passi</div>
    <div class="qv">${g.passi ? g.passi.toLocaleString('it-IT') : '—'}<small> / ${t.passi.toLocaleString('it-IT')}</small></div>
    <div class="water">${Array.from({ length: 10 }, (_, i) =>
      `<i class="${g.passi >= t.passi * (i + 1) / 10 ? 'on' : ''}"></i>`).join('')}</div>
    <div class="qb"><button data-act="passi">Aggiorna</button></div>
  </div>`;

  /* L'allenamento del giorno, se c'è. Sotto le calorie perché la domanda
     "ho già allenato oggi?" viene dopo "quanto ho mangiato?". */
  const sess = di('w').filter(w => w.d === d);
  h += `<div class="section-head"><h2>Allenamento</h2></div>`;
  if (sess.length) {
    h += sess.map(w => rigaSessione(w)).join('');
  } else {
    h += `<button class="card-row" data-act="allena-vai">
      <span class="cbadge coral">＋</span>
      <span class="cb"><h3>Nessun allenamento</h3>
        <span class="meta">Tocca per partire da una scheda</span></span>
      <span class="go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>
    </button>`;
  }

  h += riquadroSettimana(d);
  return h;
}

/* Come sta andando la settimana. Prende il posto dell'elenco dei pasti, che
   ripeteva quello che il riquadro del piano mostra già più in alto e che si
   legge comunque nel Diario. Qui invece c'è la sola cosa che la giornata
   singola non può dirti: se la direzione è giusta. */
function riquadroSettimana(d) {
  const t = cfg().target;
  const lun = lunediDi(d);
  const giorni = Array.from({ length: 7 }, (_, i) => spostaData(lun, i));
  const oggi = oggiISO();

  /* Solo i giorni già passati e con qualcosa scritto: contare i giorni futuri
     come "zero calorie" farebbe crollare la media e non vorrebbe dire niente. */
  const conDati = giorni.filter(x => x <= oggi && righeDi(x).length);
  const kcal = conDati.map(x => somma(righeDi(x)).k);
  const media = kcal.length ? kcal.reduce((a, b) => a + b, 0) / kcal.length : 0;
  const prot = conDati.length
    ? conDati.reduce((a, x) => a + somma(righeDi(x)).p, 0) / conDati.length : 0;
  const inTarget = conDati.filter(x => Math.abs(somma(righeDi(x)).k - kcalTarget(x)) <= kcalTarget(x) * 0.10).length;

  const sess = di('w').filter(w => w.d >= giorni[0] && w.d <= giorni[6]);
  const volume = sess.reduce((v, w) => v + statSessione(w).volume, 0);

  const ms = misure();
  const ultima = ms[ms.length - 1];
  const prec = ms[ms.length - 2];
  const dPeso = ultima && prec && ultima.peso && prec.peso ? num(ultima.peso) - num(prec.peso) : null;

  const maxK = Math.max(t.kcal, ...kcal) * 1.05 || 1;

  let h = `<div class="section-head"><h2>La settimana</h2>
    <button class="act" data-act="vai-report">Report completo</button></div>`;

  if (!conDati.length && !sess.length) {
    return h + vuoto('📈', 'Ancora niente questa settimana',
      'Registra un pasto o un allenamento e qui compare l’andamento: media, aderenza al piano e volume.');
  }

  h += `<div class="panel" style="margin-top:0">
    <div class="wk-bars">${giorni.map(x => {
      const futuro = x > oggi;
      const k = righeDi(x).length ? somma(righeDi(x)).k : 0;
      const kt = kcalTarget(x);
      const allenato = di('w').some(w => w.d === x);
      return `<button class="wb ${x === d ? 'on' : ''}" data-vaidata="${x}">
        <i class="${!k ? 'vuoto' : (k > kt * 1.05 ? 'over' : '')}"
           style="height:${k ? Math.max(4, k / maxK * 100) : 4}%"></i>
        <u class="${allenato ? 'si' : ''}"></u>
        <span>${GIORNI_SETT[(new Date(x + 'T12:00:00').getDay() + 6) % 7].b}</span>
      </button>`;
    }).join('')}</div>
    <div class="legend" style="margin-top:9px">
      <span><i style="background:var(--sky)"></i>entro il bersaglio</span>
      <span><i style="background:var(--coral)"></i>oltre</span>
      <span><i style="background:var(--teal);border-radius:50%"></i>allenamento</span>
    </div>
  </div>`;

  h += `<div class="kpis" style="margin-top:12px">
    <div class="kpi"><div class="kl">Media kcal</div>
      <div class="kv">${conDati.length ? r0(media) : '—'}</div>
      <div class="kd ${!conDati.length ? 'pari' : Math.abs(media - t.kcal) < t.kcal * .05 ? 'pari' : media > t.kcal ? 'su' : 'giu'}">
        ${conDati.length ? conDati.length + (conDati.length === 1 ? ' giorno' : ' giorni') + ' su 7' : 'niente registrato'}</div></div>
    <div class="kpi"><div class="kl">Media proteine</div>
      <div class="kv">${conDati.length ? r0(prot) : '—'}<small> g</small></div>
      <div class="kd ${prot >= t.prot * .95 ? 'giu' : 'su'}">bersaglio ${t.prot} g</div></div>
    <div class="kpi"><div class="kl">Aderenza</div>
      <div class="kv">${conDati.length ? r0(inTarget / conDati.length * 100) : '—'}<small>%</small></div>
      <div class="kd pari">${inTarget} ${inTarget === 1 ? 'giorno' : 'giorni'} entro il 10%</div></div>
    <div class="kpi"><div class="kl">Allenamenti</div>
      <div class="kv">${sess.length}</div>
      <div class="kd pari">${volume ? r0(volume).toLocaleString('it-IT') + ' kg' : 'nessun volume'}</div></div>
  </div>`;

  if (dPeso !== null) {
    h += `<div class="card-row" style="margin-top:12px">
      <span class="cbadge">⚖️</span>
      <span class="cb"><h3>${r1(ultima.peso)} kg</h3>
        <span class="meta">ultima misura del ${esc(dataCorta(ultima.d))}</span></span>
      <span class="badge ${dPeso < 0 ? 'ok' : dPeso > 0 ? 'no' : 'neutro'}">${dPeso > 0 ? '+' : ''}${r1(dPeso)} kg</span>
    </div>`;
  } else {
    h += `<button class="card-row" style="margin-top:12px" data-act="nuova-misura">
      <span class="cbadge coral">⚖️</span>
      <span class="cb"><h3>Registra il peso</h3>
        <span class="meta">peso e girovita una volta a settimana</span></span>
      <span class="go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>
    </button>`;
  }
  return h;
}

/* Il piano del giorno scelto, in evidenza: è la domanda con cui apri l'app —
   "cosa devo mangiare oggi" — e finché non è caricato nel diario è anche l'unica
   azione che ha senso fare qui. Sta subito sotto le calorie, prima di tutto il
   resto. */
function riquadroPiano(d, righe, tot) {
  const gs = gsDiData(d);
  const g = GIORNI_SETT.find(x => x.id === gs);
  const p = piano(gs);

  if (!(p.righe || []).length) {
    return `<button class="plan-hero vuoto" data-act="vai-piano">
      <span class="ph-badge">${g.b}</span>
      <span class="ph-t"><b>Nessun piano per ${esc(g.l.toLowerCase())}</b>
        <span>Componilo una volta e lo ricarichi ogni ${esc(g.l.toLowerCase())} in un tocco</span></span>
      <span class="ph-go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>
    </button>`;
  }

  const tp = somma(p.righe);
  /* Quanto ti sei discostato dal piano. È il confronto che conta: la media
     settimanale non dice se oggi hai seguito il programma o improvvisato. */
  const scarto = righe.length ? r0(tot.k - tp.k) : null;

  /* L'elenco dei pasti si può ripiegare, ma parte aperto: la prima cosa che
     vuoi sapere aprendo l'app è cosa mangi, non che esiste un piano. */
  const aperto = DB.settings.pianoAperto !== false;

  let h = `<div class="plan-hero">
    <div class="ph-top" data-act="piega-piano">
      <span class="ph-badge">${g.b}</span>
      <span class="ph-t"><b>${esc(p.nome || g.l)}</b>
        <span>${r0(tp.k)} kcal · ${r0(tp.p)} g prot</span></span>
      <button class="ph-edit" data-act="vai-piano">Modifica</button>
      <span class="ph-chev ${aperto ? 'su' : ''}">
        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
    </div>`;

  if (aperto) {
    h += `<div class="ph-meals">`;
    for (const pa of PASTI) {
      const rp = p.righe.filter(r => r.slot === pa.id);
      if (!rp.length) continue;
      const tm = somma(rp);
      h += `<div class="pm">
        <span class="pmh"><span class="pmn"><i class="pmi">${pa.ic}</i>${esc(pa.l)}</span><b>${r0(tm.k)} kcal</b></span>
        <span class="pml">${rp.map(r => esc(r.n) + ' <i>' + r1(r.q) + ' g</i>').join(' · ')}</span>
      </div>`;
    }
    h += `</div>`;
  }

  if (scarto === null) {
    h += `<button class="ph-cta" data-applica="${gs}" data-data="${d}">
      Carica nel diario · ${r0(tp.k)} kcal</button>`;
  } else {
    const stato = Math.abs(scarto) <= tp.k * 0.03 ? 'ok' : (scarto > 0 ? 'no' : 'neutro');
    h += `<div class="ph-conf">
        <span>Registrato <b>${r0(tot.k)}</b> contro <b>${r0(tp.k)}</b> del piano</span>
        <span class="badge ${stato}">${Math.abs(scarto) <= tp.k * 0.03 ? 'in linea' : (scarto > 0 ? '+' : '−') + Math.abs(scarto) + ' kcal'}</span>
      </div>
      <button class="ph-cta sec" data-applica="${gs}" data-data="${d}">Ricarica il piano</button>`;
  }
  return h + `</div>`;
}

function rigaSessione(w) {
  const nSerie = (w.eser || []).reduce((n, e) => n + (e.sets || []).filter(s => s.ok).length, 0);
  const volume = (w.eser || []).reduce((v, e) =>
    v + (e.sets || []).filter(s => s.ok).reduce((x, s) => x + num(s.r) * num(s.w), 0), 0);
  const min = (w.eser || []).reduce((x, e) => x + num(e.min), 0);
  const dettagli = [];
  if (nSerie) dettagli.push(nSerie + ' serie');
  if (volume) dettagli.push(r0(volume).toLocaleString('it-IT') + ' kg di volume');
  if (min) dettagli.push(min + ' min di cardio');
  return `<button class="card-row" data-sess="${w.id}">
    <span class="cbadge">${w.fine ? '✓' : '▶'}</span>
    <span class="cb"><h3>${esc(w.gn || w.sn || 'Allenamento')}</h3>
      <span class="meta">${dettagli.length ? esc(dettagli.join(' · ')) : 'da compilare'}${w.fine ? '' : ' · in corso'}</span></span>
    <span class="go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>
  </button>`;
}

/* ============================================================
   6. Motore dei filtri
   ============================================================

   Gli stessi filtri servono in tre punti — la tabella a schermo, i totali in
   fondo e l'esportazione. Sono un oggetto solo e una funzione sola: se fossero
   ricopiati, prima o poi l'export mostrerebbe righe diverse da quelle a video.
*/

const PERIODI = [
  { id: 'oggi', l: 'Oggi' },
  { id: '7', l: '7 giorni' },
  { id: '30', l: '30 giorni' },
  { id: 'mese', l: 'Questo mese' },
  { id: 'scorso', l: 'Mese scorso' },
  { id: 'anno', l: "Quest'anno" },
  { id: 'tutto', l: 'Tutto' },
  { id: 'custom', l: 'Date scelte' }
];

const FILTRI_DEFAULT = {
  cibo:   { per: '7',  da: '', a: '', q: '', slot: [], cat: [], ord: 'data-' },
  alim:   { q: '', cat: [], soloMiei: false, ord: 'nome' },
  allena: { per: '30', da: '', a: '', q: '', gruppo: [], ord: 'data-' },
  report: { per: '30', da: '', a: '' }
};

function filtri(k) {
  DB.settings.filtri = DB.settings.filtri || {};
  DB.settings.filtri[k] = Object.assign({}, FILTRI_DEFAULT[k], DB.settings.filtri[k] || {});
  return DB.settings.filtri[k];
}

/* Da un periodo scelto a due date vere. Restituisce sempre un intervallo
   chiuso: le query diventano un confronto fra stringhe ISO, che in ordine
   alfabetico coincide con l'ordine cronologico. */
function intervallo(f) {
  const o = oggiISO();
  switch (f.per) {
    case 'oggi': return { da: o, a: o };
    case '7': return { da: spostaData(o, -6), a: o };
    case '30': return { da: spostaData(o, -29), a: o };
    case 'mese': return { da: o.slice(0, 8) + '01', a: o };
    case 'scorso': {
      const d = new Date(o + 'T12:00:00');
      const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const u = new Date(d.getFullYear(), d.getMonth(), 0);
      const iso = x => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      return { da: iso(p), a: iso(u) };
    }
    case 'anno': return { da: o.slice(0, 4) + '-01-01', a: o };
    case 'tutto': return { da: '0000-01-01', a: '9999-12-31' };
    default: return { da: f.da || '0000-01-01', a: f.a || '9999-12-31' };
  }
}

const etichettaPeriodo = f => {
  const p = PERIODI.find(p => p.id === f.per);
  if (f.per !== 'custom') return p ? p.l : '';
  const i = intervallo(f);
  return dataCorta(i.da) + ' → ' + dataCorta(i.a);
};

/* Un filtro è "attivo" quando c'è qualcosa da azzerare. Serve solo a spegnere
   il pulsante Azzera: se restasse acceso a vuoto sembrerebbe rotto. */
function filtroAttivo(k) {
  const f = filtri(k), d = FILTRI_DEFAULT[k];
  return Object.keys(d).some(x => JSON.stringify(f[x]) !== JSON.stringify(d[x]));
}

function azzeraFiltro(k) {
  DB.settings.filtri[k] = Object.assign({}, FILTRI_DEFAULT[k]);
  save();
  render();
}

/* ---------- pezzi di interfaccia riutilizzabili ---------- */

function campoPeriodo(k) {
  const f = filtri(k);
  return `<div class="fgroup full">
      <label>Periodo</label>
      <div class="fchips">
        ${PERIODI.map(p => `<button data-f="${k}" data-per="${p.id}" class="${f.per === p.id ? 'on' : ''}">${p.l}</button>`).join('')}
      </div>
    </div>
    ${f.per === 'custom' ? `
    <div class="fgroup"><label>Dal</label>
      <input type="date" data-f="${k}" data-set="da" value="${esc(f.da)}"></div>
    <div class="fgroup"><label>Al</label>
      <input type="date" data-f="${k}" data-set="a" value="${esc(f.a)}"></div>` : ''}`;
}

function campoRicerca(k, ph) {
  const f = filtri(k);
  return `<div class="fgroup full"><label>Ricerca</label>
    <div class="fsearch">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" data-f="${k}" data-set="q" value="${esc(f.q)}" placeholder="${esc(ph)}"
        autocapitalize="off" spellcheck="false">
      ${f.q ? `<button class="clr" data-f="${k}" data-set="q" data-val="">×</button>` : ''}
    </div></div>`;
}

function campoMulti(k, campo, etichetta, valori, etichette) {
  const f = filtri(k), sel = f[campo] || [];
  return `<div class="fgroup full"><label>${esc(etichetta)}</label>
    <div class="fchips">
      ${valori.map((v, i) => `<button data-f="${k}" data-multi="${campo}" data-val="${esc(v)}"
        class="${sel.includes(v) ? 'on' : ''}">${esc((etichette || valori)[i])}</button>`).join('')}
    </div></div>`;
}

/* Il riassunto che si legge a filtri chiusi: dice cosa stai guardando senza
   doverli riaprire. */
function riassuntoFiltri(k) {
  const f = filtri(k), p = [];
  if (f.per) p.push('<b>' + esc(etichettaPeriodo(f)) + '</b>');
  if (f.q) p.push('“' + esc(f.q) + '”');
  if ((f.slot || []).length) p.push(f.slot.length + ' pasti');
  if ((f.cat || []).length) p.push(f.cat.length + ' categorie');
  if ((f.gruppo || []).length) p.push(f.gruppo.length + ' gruppi');
  if (f.soloMiei) p.push('solo i miei');
  return p.join(' · ') || 'nessuno';
}

/* Aperti sul Mac, chiusi sul telefono: sullo schermo grande non rubano spazio
   a niente, su quello piccolo si mangerebbero mezza schermata. */
function filtriAperti(k) {
  DB.settings.fAperti = DB.settings.fAperti || {};
  if (DB.settings.fAperti[k] === undefined) DB.settings.fAperti[k] = window.innerWidth >= 900;
  return DB.settings.fAperti[k];
}

function scatolaFiltri(k, dentro) {
  const aperto = filtriAperti(k);
  return `<div class="filters ${aperto ? '' : 'chiuso'}">
    <div class="fhead" data-apri="${k}">
      <span class="ft">Filtri</span>
      ${aperto ? '<span class="riass"></span>' : `<span class="riass">${riassuntoFiltri(k)}</span>`}
      <button class="freset" data-reset="${k}" ${filtroAttivo(k) ? '' : 'disabled'}>Azzera</button>
      <span class="chev"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
    </div>
    <div class="fgrid">${dentro}</div>
  </div>`;
}

function rigaRisultati(n, cosa, extra, exp) {
  return `<div class="fsummary">
    <span><b>${n}</b> ${esc(cosa)}${extra ? ' · ' + extra : ''}</span>
    ${exp ? `<span class="exp">
      <button data-export="${exp}">CSV</button>
      <button data-act="stampa">Stampa</button></span>` : ''}
  </div>`;
}

const vuoto = (ic, tit, txt) =>
  `<div class="empty"><span class="ic">${ic}</span><strong>${esc(tit)}</strong><p>${txt}</p></div>`;

/* ============================================================
   7. Cibo — registro del diario e anagrafica degli alimenti
   ============================================================ */

/* Le righe che passano i filtri. Una funzione sola, usata dalla tabella, dai
   totali e dall'esportazione. */
function righeFiltrate() {
  const f = filtri('cibo'), i = intervallo(f);
  const q = f.q.trim().toLowerCase();
  const cat = catalogo();
  let righe = di('l').filter(r => r.d >= i.da && r.d <= i.a);
  if (f.slot.length) righe = righe.filter(r => f.slot.includes(r.slot));
  if (f.cat.length) {
    const catDi = {};
    for (const a of cat) catDi[a.n.toLowerCase()] = a.cat;
    righe = righe.filter(r => f.cat.includes(catDi[r.n.toLowerCase()] || 'Altro'));
  }
  if (q) righe = righe.filter(r => r.n.toLowerCase().includes(q));

  const dir = f.ord.endsWith('-') ? -1 : 1;
  const campo = f.ord.replace('-', '');
  righe.sort((a, b) => {
    if (campo === 'data') return a.d === b.d ? (a.updatedAt || 0) - (b.updatedAt || 0) : (a.d < b.d ? -1 : 1) * 1;
    if (campo === 'nome') return a.n.localeCompare(b.n);
    if (campo === 'kcal') return macro(a).k - macro(b).k;
    if (campo === 'prot') return macro(a).p - macro(b).p;
    return 0;
  });
  if (dir === -1) righe.reverse();
  return righe;
}

function vistaCibo() {
  const sub = SUB.cibo;
  let h = `<div class="seg" data-seg="sub-cibo" style="margin-bottom:14px">
    <button data-sub="diario" class="${sub === 'diario' ? 'on' : ''}">Diario</button>
    <button data-sub="piano" class="${sub === 'piano' ? 'on' : ''}">Piano</button>
    <button data-sub="alimenti" class="${sub === 'alimenti' ? 'on' : ''}">Alimenti</button>
  </div>`;
  return h + (sub === 'diario' ? vistaDiario() : sub === 'piano' ? vistaPiano() : vistaAlimenti());
}

/* ---------- il piano della settimana ---------- */

/* La striscia dei sette giorni. Il pallino sotto dice quali giorni hanno già un
   piano: senza, dovresti toccarli uno per uno per scoprirlo. */
function strisciaSettimana(sel, attr) {
  return `<div class="weekstrip">${GIORNI_SETT.map(g => `
    <button data-${attr}="${g.id}" class="${g.id === sel ? 'on' : ''}">
      ${g.b}<i class="${pianoPieno(g.id) ? 'piano' : ''}"></i>
    </button>`).join('')}</div>`;
}

function vistaPiano() {
  const gs = SUB.gs || gsDiData(oggiISO());
  SUB.gs = gs;
  const g = GIORNI_SETT.find(x => x.id === gs);
  const p = piano(gs);
  const t = cfg().target;
  const tot = somma(p.righe || []);

  let h = strisciaSettimana(gs, 'gs');

  h += `<div class="panel" style="margin-top:12px">
    <div class="label">${esc(g.l)}</div>
    <input class="txtin" data-pnome="${gs}" value="${esc(p.nome || '')}"
      placeholder="Nome della giornata — es. MATTINA 1 · riso e tonno">
    <div class="stat-row" style="margin-top:12px"><span>Calorie</span>
      <span>${r0(tot.k)} / ${t.kcal} kcal</span></div>
    <div class="stat-row"><span>Proteine · carboidrati · grassi</span>
      <span>${r0(tot.p)} · ${r0(tot.c)} · ${r0(tot.g)} g</span></div>
    <div class="split">
      <i style="width:${Math.min(100, tot.k / t.kcal * 100)}%;background:${tot.k > t.kcal * 1.05 ? 'var(--coral)' : 'var(--teal)'}"></i></div>
  </div>`;

  for (const pa of PASTI) {
    const rp = (p.righe || []).filter(r => r.slot === pa.id);
    const tp = somma(rp);
    h += `<div class="meal ${rp.length ? '' : 'vuoto'}">
      <div class="mtop">
        <span class="mic">${pa.ic}</span>
        <span class="mname">${esc(pa.l)}</span>
        ${rp.length ? `<span class="mkcal">${r0(tp.k)} kcal</span>` : ''}
        <button class="madd" data-padd="${gs}|${pa.id}" aria-label="Aggiungi a ${esc(pa.l)}">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      ${rp.length ? `<div class="rows">${rp.map(r => {
        const m = macro(r);
        return `<button class="frow" data-priga="${gs}|${(p.righe || []).indexOf(r)}">
          <span class="fb"><span class="fn">${esc(r.n)}</span>
            <span class="fm">${r1(r.q)} g · ${r0(m.p)}P ${r0(m.c)}C ${r0(m.g)}G</span></span>
          <span class="fk">${r0(m.k)}</span></button>`;
      }).join('')}</div>` : ''}
    </div>`;
  }

  h += `<div class="btn-row">
    <button class="btn" data-applica="${gs}">Carica nel diario di oggi</button>
  </div>
  <button class="btn sec" data-act="copia-piano">Copia da un altro giorno</button>
  <button class="btn sec" data-act="importa-piano">Importa il piano da un file</button>
  ${(p.righe || []).length ? `<button class="btn danger" data-act="svuota-piano">Svuota ${esc(g.l)}</button>` : ''}
  <p class="set-note">Il piano è il tuo modello: resta lì e non conta nei report.
    Diventa reale solo quando lo carichi nel diario di una data, e da quel momento
    lo modifichi come qualsiasi altra voce.</p>`;
  return h;
}

/* Quali giorni e quali categorie sono aperti. Sta in memoria e non nel
   localStorage: è il punto in cui ti trovi adesso, non una preferenza. */
const aperti = { giorni: new Set(), cat: new Set(), inizializzato: false };

function vistaDiario() {
  const f = filtri('cibo');
  const righe = righeFiltrate();
  const tot = somma(righe);
  const perGiorno = raggruppaPerGiorno(righe);
  const gg = perGiorno.length || 1;

  let h = scatolaFiltri('cibo',
    campoPeriodo('cibo') +
    campoRicerca('cibo', 'nome dell’alimento…') +
    campoMulti('cibo', 'slot', 'Pasto', PASTI.map(p => p.id), PASTI.map(p => p.l)) +
    campoMulti('cibo', 'cat', 'Categoria', CATEGORIE, CATEGORIE)
  );

  h += `<div class="kpis" style="margin-bottom:12px">
    <div class="kpi"><div class="kl">Media kcal / giorno</div>
      <div class="kv">${r0(tot.k / gg)}</div>
      ${scostamento(tot.k / gg, cfg().target.kcal, 'kcal')}</div>
    <div class="kpi"><div class="kl">Media proteine</div>
      <div class="kv">${r0(tot.p / gg)}<small> g</small></div>
      ${scostamento(tot.p / gg, cfg().target.prot, 'g')}</div>
  </div>`;

  h += rigaRisultati(righe.length, righe.length === 1 ? 'voce' : 'voci',
    `<b>${perGiorno.length}</b> ${perGiorno.length === 1 ? 'giorno' : 'giorni'} · <b>${r0(tot.k)}</b> kcal totali`, 'cibo');

  if (!righe.length) {
    return h + vuoto('🍽️', 'Nessuna voce nel periodo',
      'Cambia i filtri, oppure registra un pasto dalla scheda <b>Oggi</b>.');
  }

  /* Alla prima apertura si spalanca solo il giorno più recente: gli altri li
     apri tu. Prima erano tutte le righe di tutti i giorni una dietro l'altra,
     con la data ripetuta su ognuna. */
  if (!aperti.inizializzato) {
    aperti.inizializzato = true;
    if (perGiorno.length) aperti.giorni.add(perGiorno[0].d);
  }
  /* Con una ricerca in corso non ha senso tenere chiuso: quello che cerchi
     potrebbe essere in un giorno che non apriresti mai. */
  const tuttiAperti = !!f.q.trim();

  for (const g of perGiorno) {
    const apri = tuttiAperti || aperti.giorni.has(g.d);
    const kt = kcalTarget(g.d);
    const scarto = r0(g.tot.k - kt);
    const stato = Math.abs(scarto) <= kt * 0.10 ? 'ok' : (scarto > 0 ? 'no' : 'neutro');
    h += `<div class="acc ${apri ? 'aperto' : ''}">
      <button class="acc-h fitta" data-giorno="${g.d}">
        <span class="acc-d">${esc(dataCorta(g.d))}<small>${esc(nomeGiorno(g.d))}</small></span>
        <span class="acc-n">${g.righe.length} ${g.righe.length === 1 ? 'voce' : 'voci'}</span>
        <span class="acc-k">${r0(g.tot.k)}<i> kcal</i></span>
        <span class="badge ${stato}">${scarto > 0 ? '+' : ''}${scarto}</span>
        <span class="acc-c"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
      </button>
      ${apri ? tabellaGiorno(g, f) : ''}
    </div>`;
  }
  return h;
}

/* Le righe filtrate, divise per giorno e già ordinate. Il verso del giorno
   segue l'ordinamento scelto sulla colonna Data. */
function raggruppaPerGiorno(righe) {
  const mappa = {};
  for (const r of righe) (mappa[r.d] = mappa[r.d] || []).push(r);
  const f = filtri('cibo');
  const giu = f.ord === 'data-' || !f.ord.startsWith('data');
  return Object.keys(mappa).sort((a, b) => giu ? (a < b ? 1 : -1) : (a < b ? -1 : 1))
    .map(d => ({ d, righe: mappa[d], tot: somma(mappa[d]) }));
}

function tabellaGiorno(g, f) {
  const ord = (c, l, cls) =>
    `<th class="${cls || ''}" data-ord="cibo" data-campo="${c}">${l}${f.ord.startsWith(c) ? `<i>${f.ord.endsWith('-') ? '↓' : '↑'}</i>` : ''}</th>`;

  let h = `<div class="acc-b"><div class="tablewrap"><table class="dt">
    <thead><tr>
      ${ord('nome', 'Alimento', 'nome')}<th class="opt">Pasto</th>
      <th class="n">g</th>${ord('kcal', 'Kcal', 'n')}${ord('prot', 'Prot', 'n')}
      <th class="n opt">Carb</th><th class="n opt">Gras</th>
    </tr></thead><tbody>`;
  for (const r of g.righe) {
    const m = macro(r);
    const p = PASTI.find(p => p.id === r.slot);
    h += `<tr data-riga="${r.id}">
      <td class="nome">${esc(r.n)}<span class="sub opt-inv">${esc(p ? p.l : r.slot)}</span></td>
      <td class="opt"><span class="badge neutro">${esc(p ? p.l : r.slot)}</span></td>
      <td class="n">${r1(r.q)}</td><td class="n">${r0(m.k)}</td>
      <td class="n">${r0(m.p)}</td><td class="n opt">${r0(m.c)}</td><td class="n opt">${r0(m.g)}</td>
    </tr>`;
  }
  return h + `</tbody><tfoot><tr>
      <td class="nome">Totale del giorno</td>
      <td class="opt"></td>
      <td class="n">${r1(g.righe.reduce((a, r) => a + r.q, 0))}</td>
      <td class="n">${r0(g.tot.k)}</td>
      <td class="n">${r0(g.tot.p)}</td>
      <td class="n opt">${r0(g.tot.c)}</td>
      <td class="n opt">${r0(g.tot.g)}</td>
    </tr></tfoot></table></div></div>`;
}

/* Lo scostamento dal target, con il segno e il colore giusti: il verde non è
   "di più", è "in linea". */
function scostamento(valore, target, unita) {
  if (!target) return '';
  const d = valore - target;
  const q = Math.abs(d) / target;
  const cls = q < 0.05 ? 'pari' : (d > 0 ? 'su' : 'giu');
  const segno = d > 0 ? '+' : '−';
  return `<div class="kd ${cls}">${q < 0.05 ? 'in linea' : segno + r0(Math.abs(d)) + ' ' + unita} · target ${target}</div>`;
}

function alimentiFiltrati() {
  const f = filtri('alim');
  const q = f.q.trim().toLowerCase();
  let l = catalogo();
  if (f.soloMiei) l = l.filter(a => a.mio);
  if (f.cat.length) l = l.filter(a => f.cat.includes(a.cat));
  if (q) l = l.filter(a => a.n.toLowerCase().includes(q) || (a.nt || '').toLowerCase().includes(q));
  const c = f.ord.replace('-', ''), dir = f.ord.endsWith('-') ? -1 : 1;
  l.sort((a, b) => c === 'nome' ? a.n.localeCompare(b.n) :
    c === 'prot' ? a.p - b.p : c === 'kcal' ? a.k - b.k : 0);
  if (dir === -1) l.reverse();
  return l;
}

function vistaAlimenti() {
  const f = filtri('alim');
  const lista = alimentiFiltrati();
  const miei = di('a').length;

  let h = scatolaFiltri('alim',
    campoRicerca('alim', 'cerca fra ' + catalogo().length + ' alimenti…') +
    campoMulti('alim', 'cat', 'Categoria', CATEGORIE, CATEGORIE) +
    `<div class="fgroup full"><label>Origine</label><div class="fchips">
       <button data-f="alim" data-flag="soloMiei" class="${f.soloMiei ? 'on' : ''}">Solo i miei (${miei})</button>
     </div></div>`
  );

  h += rigaRisultati(lista.length, lista.length === 1 ? 'alimento' : 'alimenti',
    'valori per <b>100 g</b>', 'alimenti');

  if (!lista.length) return h + vuoto('🔍', 'Nessun alimento', 'Cambia i filtri o aggiungine uno con <b>+</b>.');

  /* Settantuno righe di seguito non si scorrono: si aprono per categoria.
     Quando c'è una ricerca in corso invece si spalancano tutte, perché quello
     che cerchi potrebbe stare in una categoria che non apriresti mai. */
  const tuttiAperti = !!f.q.trim() || f.soloMiei;

  const perCat = {};
  for (const a of lista) (perCat[a.cat] = perCat[a.cat] || []).push(a);
  const ordine = CATEGORIE.filter(c => perCat[c]).concat(Object.keys(perCat).filter(c => !CATEGORIE.includes(c)));

  for (const c of ordine) {
    const l = perCat[c];
    const apri = tuttiAperti || aperti.cat.has(c);
    h += `<div class="acc ${apri ? 'aperto' : ''}">
      <button class="acc-h" data-catapri="${esc(c)}">
        <span class="acc-i">${CAT_ICON[c] || '🍽️'}</span>
        <span class="acc-d">${esc(c)}</span>
        <span class="acc-n">${l.length} ${l.length === 1 ? 'alimento' : 'alimenti'}</span>
        <span class="acc-c"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
      </button>
      ${apri ? tabellaAlimenti(l, f) : ''}
    </div>`;
  }
  return h;
}

function tabellaAlimenti(lista, f) {
  const ord = (c, l) =>
    `<th class="n" data-ord="alim" data-campo="${c}">${l}${f.ord.startsWith(c) ? `<i>${f.ord.endsWith('-') ? '↓' : '↑'}</i>` : ''}</th>`;

  let h = `<div class="acc-b"><div class="tablewrap"><table class="dt"><thead><tr>
      <th class="nome" data-ord="alim" data-campo="nome">Alimento${f.ord.startsWith('nome') ? `<i>${f.ord.endsWith('-') ? '↓' : '↑'}</i>` : ''}</th>
      ${ord('kcal', 'Kcal')}${ord('prot', 'Prot')}
      <th class="n opt">Carb</th><th class="n opt">Gras</th>
    </tr></thead><tbody>`;
  for (const a of lista) {
    h += `<tr data-alim="${esc(a.n)}">
      <td class="nome">${esc(a.n)}${a.mio ? ' <span class="badge coral">mio</span>' : ''}${a.nt ? `<span class="sub">${esc(a.nt)}</span>` : ''}</td>
      <td class="n">${a.k}</td><td class="n">${a.p}</td><td class="n opt">${a.c}</td><td class="n opt">${a.g}</td>
    </tr>`;
  }
  return h + `</tbody></table></div></div>`;
}

/* ============================================================
   8. Allenamento — registro delle sessioni e schede
   ============================================================ */

const GRUPPI = Object.keys(ESERCIZI);

/* A quale gruppo appartiene un esercizio. Se l'hai scritto tu e non è in
   elenco finisce in "Altro": meglio una riga in più nei report che una
   sessione che sparisce dai filtri. */
const gruppoDi = (() => {
  const mappa = {};
  for (const g of GRUPPI) for (const e of ESERCIZI[g]) mappa[e.toLowerCase()] = g;
  return nome => mappa[String(nome || '').toLowerCase()] || 'Altro';
})();

/* Una scheda importata ha sezioni come "Riscaldamento" o "Petto", non "Cardio":
   il gruppo da solo non basta a capire che il tapis roulant si misura in minuti
   e non in serie. Il nome invece lo dice sempre. */
const RX_CARDIO = /corsa|cammin|tapis|treadmill|cyclette|\bbike\b|ellittic|vogator|nuoto|salto con la corda|cardio/i;
const isCardio = e => !!e.cardio || GRUPPI_CARDIO.includes(e.gruppo || gruppoDi(e.n)) || RX_CARDIO.test(e.n || '');

/* I numeri di una sessione, calcolati una volta sola perché servono nella
   tabella, nei totali e nei report. */
function statSessione(w) {
  const eser = w.eser || [];
  let serie = 0, volume = 0, ripetizioni = 0, min = 0, km = 0;
  for (const e of eser) {
    for (const s of (e.sets || [])) {
      if (!s.ok) continue;
      serie++; ripetizioni += num(s.r); volume += num(s.r) * num(s.w);
    }
    min += num(e.min); km += num(e.km);
  }
  return { serie, volume, ripetizioni, min, km, esercizi: eser.length };
}

function sessioniFiltrate() {
  const f = filtri('allena'), i = intervallo(f);
  const q = f.q.trim().toLowerCase();
  let l = di('w').filter(w => w.d >= i.da && w.d <= i.a);
  if (f.gruppo.length) {
    l = l.filter(w => (w.eser || []).some(e => f.gruppo.includes(e.gruppo || gruppoDi(e.n))));
  }
  if (q) {
    l = l.filter(w => (w.gn || '').toLowerCase().includes(q) || (w.sn || '').toLowerCase().includes(q) ||
      (w.eser || []).some(e => e.n.toLowerCase().includes(q)));
  }
  const dir = f.ord.endsWith('-') ? -1 : 1, c = f.ord.replace('-', '');
  l.sort((a, b) => c === 'data' ? (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)
    : c === 'volume' ? statSessione(a).volume - statSessione(b).volume
    : c === 'serie' ? statSessione(a).serie - statSessione(b).serie : 0);
  if (dir === -1) l.reverse();
  return l;
}

function vistaAllena() {
  const sub = SUB.allena;
  let h = `<div class="seg" data-seg="sub-allena" style="margin-bottom:14px">
    <button data-sub="sessioni" class="${sub === 'sessioni' ? 'on' : ''}">Sessioni</button>
    <button data-sub="schede" class="${sub === 'schede' ? 'on' : ''}">Schede</button>
  </div>`;
  return h + (sub === 'sessioni' ? vistaSessioni() : vistaSchede());
}

function vistaSessioni() {
  const f = filtri('allena');
  const l = sessioniFiltrate();
  const tot = l.reduce((a, w) => {
    const s = statSessione(w);
    return { serie: a.serie + s.serie, volume: a.volume + s.volume, min: a.min + s.min, km: a.km + s.km };
  }, { serie: 0, volume: 0, min: 0, km: 0 });
  const i = intervallo(f);
  const settimane = Math.max(1, Math.round((new Date(i.a) - new Date(i.da)) / 6048e5) || 1);

  let h = scatolaFiltri('allena',
    campoPeriodo('allena') +
    campoRicerca('allena', 'esercizio, scheda, giornata…') +
    campoMulti('allena', 'gruppo', 'Gruppo muscolare', GRUPPI, GRUPPI)
  );

  h += `<div class="kpis" style="margin-bottom:12px">
    <div class="kpi"><div class="kl">Sessioni</div><div class="kv">${l.length}</div>
      <div class="kd pari">${r1(l.length / settimane)} a settimana</div></div>
    <div class="kpi"><div class="kl">Volume totale</div>
      <div class="kv">${r0(tot.volume).toLocaleString('it-IT')}<small> kg</small></div>
      <div class="kd pari">${tot.serie} serie svolte</div></div>
  </div>`;

  h += rigaRisultati(l.length, l.length === 1 ? 'sessione' : 'sessioni',
    tot.min ? `<b>${r0(tot.min)}</b> min di cardio` : '', 'sessioni');

  if (!l.length) {
    return h + vuoto('🏋️', 'Nessuna sessione nel periodo',
      'Cambia i filtri, oppure parti da una scheda con <b>+</b>.');
  }

  const ord = (c, lb, cls) =>
    `<th class="${cls || ''}" data-ord="allena" data-campo="${c}">${lb}${f.ord.startsWith(c) ? `<i>${f.ord.endsWith('-') ? '↓' : '↑'}</i>` : ''}</th>`;

  h += `<div class="tablewrap"><table class="dt"><thead><tr>
      ${ord('data', 'Data')}<th class="nome">Allenamento</th><th class="opt">Gruppi</th>
      <th class="n opt">Es.</th>${ord('serie', 'Serie', 'n')}${ord('volume', 'Volume', 'n')}
      <th class="n opt">Cardio</th><th class="opt">Stato</th>
    </tr></thead><tbody>`;
  for (const w of l) {
    const s = statSessione(w);
    const gr = Array.from(new Set((w.eser || []).map(e => e.gruppo || gruppoDi(e.n))));
    h += `<tr data-sess="${w.id}">
      <td>${esc(dataCorta(w.d))}<span class="sub">${esc(nomeGiorno(w.d))}</span></td>
      <td class="nome">${esc(w.gn || 'Allenamento')}${w.sn ? `<span class="sub">${esc(w.sn)}</span>` : ''}</td>
      <td class="opt">${gr.slice(0, 2).map(g => `<span class="badge sky">${esc(g.replace(/ \(.*/, ''))}</span>`).join(' ')}${gr.length > 2 ? ' +' + (gr.length - 2) : ''}</td>
      <td class="n opt">${s.esercizi}</td><td class="n">${s.serie}</td>
      <td class="n">${s.volume ? r0(s.volume).toLocaleString('it-IT') : '—'}</td>
      <td class="n opt">${s.min ? s.min + "'" : '—'}${s.km ? ' · ' + r1(s.km) + ' km' : ''}</td>
      <td class="opt"><span class="badge ${w.fine ? 'ok' : 'coral'}">${w.fine ? 'chiusa' : 'in corso'}</span></td>
    </tr>`;
  }
  return h + `</tbody><tfoot><tr>
      <td colspan="2">Totale</td><td class="opt"></td><td class="n opt"></td><td class="n">${tot.serie}</td>
      <td class="n">${r0(tot.volume).toLocaleString('it-IT')}</td>
      <td class="n opt">${tot.min ? r0(tot.min) + "'" : '—'}</td><td class="opt"></td>
    </tr></tfoot></table></div>`;
}

function vistaSchede() {
  const l = schede();
  let h = '';
  if (!l.length) {
    return vuoto('📋', 'Nessuna scheda',
      'Una scheda è il tuo programma: i giorni 1, 2, 3… ognuno con i suoi esercizi. ' +
      'Creane una con <b>+</b>, oppure caricane una che hai già in un file.') +
      `<button class="btn sec" data-act="importa-scheda">Importa una scheda da un file</button>`;
  }
  for (const s of l) {
    const ng = (s.giorni || []).length;
    const ne = (s.giorni || []).reduce((n, g) => n + (g.eser || []).length, 0);
    const usata = di('w').filter(w => w.sid === s.id).length;
    h += `<button class="card-row" data-scheda="${s.id}">
      <span class="cbadge">${ng}<br>gg</span>
      <span class="cb"><h3>${esc(s.n)}</h3>
        <span class="meta">${ne} esercizi · usata ${usata} ${usata === 1 ? 'volta' : 'volte'}</span></span>
      <span class="go"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>
    </button>`;
  }
  return h + `<button class="btn sec" data-act="importa-scheda">Importa una scheda da un file</button>`;
}

/* ---------- editor della scheda ---------- */

function vistaScheda() {
  const sc = DB.items.find(i => i.id === view.id);
  if (!sc) return vuoto('📋', 'Scheda non trovata', 'È stata cancellata su un altro dispositivo.');
  sc.giorni = sc.giorni || [];

  /* Un giorno alla volta. Impilarli tutti sembrava comodo finché i giorni erano
     due; con quattro giorni da quindici esercizi diventa un rotolo in cui non
     trovi più niente. */
  const gi = Math.min(view.gi || 0, Math.max(0, sc.giorni.length - 1));
  const g = sc.giorni[gi];

  let h = `<div class="panel" style="margin-top:0">
    <div class="label">Scheda</div>
    <input class="txtin" data-sn="${sc.id}" value="${esc(sc.n)}" placeholder="Nome della scheda">
  </div>`;

  h += `<div class="weekstrip giorni">${sc.giorni.map((x, i) => `
    <button data-gsel="${i}" class="${i === gi ? 'on' : ''}">
      <b>${i + 1}</b><span>${esc((x.n || '').replace(/^giorno\s*\d+\s*[·\-–—]?\s*/i, '').slice(0, 12) || 'giorno')}</span>
    </button>`).join('')}
    <button data-act="add-giorno" class="piu">＋</button></div>`;

  if (!g) {
    return h + vuoto('🏋️', 'Nessun giorno',
      'Aggiungi il primo giorno con <b>＋</b>, oppure importa la scheda da un file.') +
      `<button class="btn sec" data-act="importa-scheda">Importa da un file</button>
       <button class="btn danger" data-act="del-scheda">Elimina la scheda</button>`;
  }

  h += `<div class="panel">
    <div class="rep-h">
      <input class="txtin" style="font-weight:700;padding:7px 10px" data-gn="${gi}"
        value="${esc(g.n)}" placeholder="Nome del giorno">
      <button class="freset" data-delg="${gi}">Elimina</button>
    </div>`;

  if (!(g.eser || []).length) {
    h += `<p class="set-note" style="margin:4px 0 0">Nessun esercizio. Aggiungine uno qui sotto.</p>`;
  }

  let sezione = null;
  (g.eser || []).forEach((e, ei) => {
    /* Le sezioni della scheda (riscaldamento, petto, bicipiti…) si vedono solo
       quando cambiano: ripeterle su ogni riga sarebbe rumore. */
    if (e.gruppo && e.gruppo !== sezione) {
      sezione = e.gruppo;
      h += `<p class="set-note" style="margin:14px 0 2px;font-weight:800;color:var(--teal);
        text-transform:uppercase;font-size:10px;letter-spacing:.06em">${esc(sezione)}</p>`;
    }
    const card = isCardio(e);
    h += `<div class="ex"><div class="eh">
        <span class="en">${esc(e.n)}</span>
        <button class="del" data-dele="${gi}.${ei}" aria-label="Togli">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="sethead"><span class="sn"></span><span>Serie</span><span>Ripetizioni</span>
        <span>Peso kg</span><span>Rec. s</span></div>
      <div class="setrow">
        <span class="sn">×</span>
        <input type="number" inputmode="numeric" data-es="${gi}.${ei}.serie" value="${e.serie || 3}">
        <input type="text" inputmode="text" data-es="${gi}.${ei}.rip" value="${esc(e.rip == null ? 10 : e.rip)}" placeholder="8–10">
        <input type="number" inputmode="decimal" step="0.5" data-es="${gi}.${ei}.peso" value="${e.peso || ''}" placeholder="—">
        <input type="number" inputmode="numeric" step="15" data-es="${gi}.${ei}.rec" value="${e.rec || ''}" placeholder="${DB.settings.recDefault}">
      </div>
      ${e.note ? `<p class="set-note" style="margin:6px 0 0">${esc(e.note)}</p>` : ''}
    </div>`;
  });

  h += `<button class="addset" data-adde="${gi}">＋ Aggiungi esercizio</button></div>`;

  h += `<button class="btn" data-avvia="${sc.id}|${esc(g.n)}">Allena questo giorno</button>
    <button class="btn sec" data-act="importa-scheda">Importa da un file (sostituisce i giorni)</button>
    <button class="btn danger" data-act="del-scheda">Elimina la scheda</button>`;
  return h;
}

/* ---------- sessione in corso ---------- */

function vistaSessione() {
  const w = DB.items.find(i => i.id === view.id);
  if (!w) return vuoto('🏋️', 'Sessione non trovata', 'È stata cancellata su un altro dispositivo.');
  const s = statSessione(w);

  let h = `<div class="kcal-card">
    <div class="rep-h" style="margin:0">
      <h3 style="color:#fff;font-size:17px">${esc(w.gn || 'Allenamento')}</h3>
      <span class="hint" style="color:rgba(255,255,255,.6)">${esc(dataCorta(w.d))}</span>
    </div>
    <div class="macros" style="margin-top:12px;padding-top:12px">
      <div class="macro"><div class="mh"><span class="mn">Serie</span><span class="mv">${s.serie}</span></div></div>
      <div class="macro"><div class="mh"><span class="mn">Volume</span><span class="mv">${r0(s.volume).toLocaleString('it-IT')}<i> kg</i></span></div></div>
      <div class="macro"><div class="mh"><span class="mn">Ripetizioni</span><span class="mv">${s.ripetizioni}</span></div></div>
    </div>
  </div>`;

  (w.eser || []).forEach((e, ei) => {
    const card = isCardio(e);
    const prec = ultimaVolta(e.n, w.d);
    h += `<div class="panel"><div class="eh">
      <span class="en">${esc(e.n)}</span>
      <span class="ed">${esc(e.gruppo || gruppoDi(e.n))}</span>
      <button class="del" data-delwe="${ei}" aria-label="Togli esercizio">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>`;
    if (prec) h += `<p class="set-note" style="margin:0 0 9px">Ultima volta il ${esc(dataCorta(prec.d))}: <b>${esc(prec.testo)}</b></p>`;

    if (card) {
      h += `<div class="setrow">
        <span class="sn">min</span><input type="number" inputmode="numeric" data-ws="${ei}.min" value="${e.min || ''}" placeholder="0">
        <span class="sn">km</span><input type="number" inputmode="decimal" step="0.1" data-ws="${ei}.km" value="${e.km || ''}" placeholder="0">
      </div>`;
    } else {
      h += `<div class="sethead"><span class="sn"></span><span>Ripetizioni</span><span>Peso kg</span><span class="tick"></span></div>
        <div class="sets">`;
      (e.sets || []).forEach((st, si) => {
        h += `<div class="setrow ${st.ok ? 'on' : ''}">
          <span class="sn">${si + 1}</span>
          <input type="number" inputmode="numeric" data-ws="${ei}.${si}.r" value="${st.r != null ? st.r : ''}" placeholder="${esc(e.rip || '')}">
          <input type="number" inputmode="decimal" step="0.5" data-ws="${ei}.${si}.w" value="${st.w != null ? st.w : ''}" placeholder="${e.peso || ''}">
          <button class="tick" data-tick="${ei}.${si}" aria-label="Serie completata">
            <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></button>
        </div>`;
      });
      h += `</div><button class="addset" data-addset="${ei}">＋ Serie</button>`;
    }
    h += `</div>`;
  });

  h += `<button class="btn sec" data-act="add-eser-sess">＋ Aggiungi esercizio</button>
    <div class="panel"><div class="label">Note</div>
      <textarea class="notes" data-wnote placeholder="Come è andata, dolori, sensazioni…">${esc(w.note || '')}</textarea></div>`;
  h += w.fine
    ? `<button class="btn sec" data-act="riapri-sess">Riapri la sessione</button>`
    : `<button class="btn" data-act="chiudi-sess">Chiudi l’allenamento</button>`;
  h += `<button class="btn danger" data-act="del-sess">Elimina la sessione</button>`;
  return h;
}

/* Il confronto con l'ultima volta è la sola informazione che serve davvero
   mentre sei sotto il bilanciere: dice se stai progredendo o ripetendo. */
function ultimaVolta(nome, primaDi) {
  const l = di('w').filter(w => w.d < primaDi).sort((a, b) => a.d < b.d ? 1 : -1);
  for (const w of l) {
    const e = (w.eser || []).find(x => x.n.toLowerCase() === nome.toLowerCase());
    if (!e) continue;
    const fatte = (e.sets || []).filter(s => s.ok);
    if (fatte.length) {
      const top = fatte.reduce((a, b) => num(b.w) > num(a.w) ? b : a);
      return { d: w.d, testo: fatte.length + '×' + top.r + ' con ' + top.w + ' kg' };
    }
    if (e.min) return { d: w.d, testo: e.min + ' min' + (e.km ? ' · ' + e.km + ' km' : '') };
  }
  return null;
}

/* ============================================================
   9. Report
   ============================================================ */

/* Un grafico a linea in SVG puro: i valori arrivano già in coppie [x, y] e
   qui diventano coordinate. Nessuna libreria da tenere aggiornata e nessun
   file in più da scaricare la prima volta. */
function grafico(punti, opt) {
  opt = opt || {};
  if (punti.length < 2) return `<p class="set-note">Servono almeno due rilevazioni per disegnare l’andamento.</p>`;
  const W = 320, H = 150, ml = 30, mr = 8, mt = 10, mb = 20;
  const ys = punti.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (opt.goal != null) { min = Math.min(min, opt.goal); max = Math.max(max, opt.goal); }
  const pad = (max - min) * 0.15 || 1;
  min -= pad; max += pad;
  const X = i => ml + (W - ml - mr) * (punti.length === 1 ? 0.5 : i / (punti.length - 1));
  const Y = v => mt + (H - mt - mb) * (1 - (v - min) / (max - min));

  const linea = punti.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  const area = linea + ` L${X(punti.length - 1).toFixed(1)} ${(H - mb).toFixed(1)} L${X(0).toFixed(1)} ${(H - mb).toFixed(1)} Z`;
  const tacche = [max - pad * 0.6, (max + min) / 2, min + pad * 0.6];

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${tacche.map(v => `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>
      <text class="lbl" x="2" y="${(Y(v) + 3).toFixed(1)}">${r1(v)}</text>`).join('')}
    ${opt.goal != null ? `<line class="goal" x1="${ml}" x2="${W - mr}" y1="${Y(opt.goal).toFixed(1)}" y2="${Y(opt.goal).toFixed(1)}"/>` : ''}
    <path class="area" d="${area}"/>
    <path class="lin" d="${linea}"/>
    ${punti.map((p, i) => `<circle class="dot ${i === punti.length - 1 ? 'last' : ''}" cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.2"/>`).join('')}
    <text class="lbl" x="${ml}" y="${H - 4}">${esc(punti[0].l)}</text>
    <text class="lbl" x="${W - mr}" y="${H - 4}" text-anchor="end">${esc(punti[punti.length - 1].l)}</text>
  </svg>`;
}

function classifica(voci, colore, unita) {
  if (!voci.length) return `<p class="set-note">Niente da mostrare nel periodo.</p>`;
  const max = voci[0].v || 1;
  return voci.map((v, i) => `<div class="rank">
    <span class="rn">${i + 1}</span>
    <span class="rb">
      <span class="rl"><span>${esc(v.n)}</span><span>${typeof v.t === 'string' ? esc(v.t) : r0(v.v).toLocaleString('it-IT') + ' ' + unita}</span></span>
      <span class="rt"><i class="${colore || ''}" style="width:${Math.max(3, v.v / max * 100)}%"></i></span>
    </span>
  </div>`).join('');
}

function vistaReport() {
  const f = filtri('report'), i = intervallo(f);
  const t = cfg().target;
  const righe = di('l').filter(r => r.d >= i.da && r.d <= i.a);
  const sess = di('w').filter(w => w.d >= i.da && w.d <= i.a);
  const cat = catalogo();

  /* Un giorno conta solo se ci hai scritto qualcosa: includere i giorni vuoti
     abbasserebbe la media e ti direbbe che mangi meno di quanto mangi. */
  const perGiorno = {};
  for (const r of righe) {
    const m = macro(r);
    const g = perGiorno[r.d] = perGiorno[r.d] || { k: 0, p: 0, c: 0, g: 0 };
    g.k += m.k; g.p += m.p; g.c += m.c; g.g += m.g;
  }
  const giorni = Object.keys(perGiorno).sort();
  const nG = giorni.length || 1;
  const tot = somma(righe);
  const media = { k: tot.k / nG, p: tot.p / nG, c: tot.c / nG, g: tot.g / nG };

  /* Aderenza: quanti giorni sono finiti entro il 10% del bersaglio di calorie.
     È la misura che conta davvero, più della media: due giorni sbagliati in
     direzioni opposte danno una media perfetta e una settimana disastrosa. */
  const inTarget = giorni.filter(d => {
    const kt = kcalTarget(d);
    return Math.abs(perGiorno[d].k - kt) <= kt * 0.10;
  }).length;

  const ms = misure().filter(m => m.d >= i.da && m.d <= i.a);
  const tutteMs = misure();
  const dPeso = ms.length > 1 ? ms[ms.length - 1].peso - ms[0].peso : null;

  const statTot = sess.reduce((a, w) => {
    const s = statSessione(w);
    return { serie: a.serie + s.serie, volume: a.volume + s.volume, min: a.min + s.min, km: a.km + s.km };
  }, { serie: 0, volume: 0, min: 0, km: 0 });

  let h = scatolaFiltri('report', campoPeriodo('report'));

  h += `<div class="fsummary">
    <span>Periodo: <b>${esc(etichettaPeriodo(f))}</b> · <b>${nG}</b> ${nG === 1 ? 'giorno' : 'giorni'} con registrazioni</span>
    <span class="exp"><button data-export="report">CSV</button><button data-act="stampa">Stampa</button></span>
  </div>`;

  /* Senza nemmeno un giorno registrato una media è zero solo per finta: meglio
     un trattino, che dice "non lo so" invece di "hai mangiato zero". */
  const vuotoPer = !giorni.length;

  h += `<div class="kpis">
    <div class="kpi"><div class="kl">Media kcal</div><div class="kv">${vuotoPer ? '—' : r0(media.k)}</div>
      ${vuotoPer ? '<div class="kd pari">nessun giorno registrato</div>' : scostamento(media.k, t.kcal, 'kcal')}</div>
    <div class="kpi"><div class="kl">Media proteine</div><div class="kv">${vuotoPer ? '—' : r0(media.p) + '<small> g</small>'}</div>
      ${vuotoPer ? '<div class="kd pari">nessun giorno registrato</div>' : scostamento(media.p, t.prot, 'g')}</div>
    <div class="kpi"><div class="kl">Aderenza</div><div class="kv">${vuotoPer ? '—' : r0(inTarget / nG * 100) + '<small>%</small>'}</div>
      <div class="kd pari">${vuotoPer ? 'niente da confrontare' : inTarget + ' giorni su ' + nG + ' entro il 10%'}</div></div>
    <div class="kpi"><div class="kl">Variazione peso</div>
      <div class="kv">${dPeso == null ? '—' : (dPeso > 0 ? '+' : '') + r1(dPeso)}<small> kg</small></div>
      <div class="kd ${dPeso == null ? 'pari' : dPeso < 0 ? 'giu' : 'su'}">${ms.length ? ms.length + ' rilevazioni' : 'nessuna misura'}</div></div>
  </div>`;

  /* ---------- andamento calorie ---------- */
  h += `<div class="panel"><div class="rep-h"><h3>Calorie giorno per giorno</h3>
      <span class="hint">colonna corallo = oltre il bersaglio</span></div>`;
  if (giorni.length) {
    const ultimi = giorni.slice(-21);
    const maxK = Math.max(...ultimi.map(d => perGiorno[d].k), t.kcal) * 1.05;
    h += `<div class="bars">${ultimi.map(d => {
      const k = perGiorno[d].k, kt = kcalTarget(d);
      return `<div class="b" title="${esc(dataCorta(d))}: ${r0(k)} kcal">
        <i class="${k > kt * 1.05 ? 'over' : ''}" style="height:${Math.max(3, k / maxK * 100)}%"></i>
        <span>${new Date(d + 'T12:00:00').getDate()}</span></div>`;
    }).join('')}</div>
    <div class="legend"><span><i style="background:var(--sky)"></i>entro il bersaglio</span>
      <span><i style="background:var(--coral)"></i>oltre</span>
      <span>ultimi ${ultimi.length} giorni registrati</span></div>`;
  } else {
    h += `<p class="set-note">Nessuna registrazione nel periodo.</p>`;
  }
  h += `</div>`;

  /* ---------- ripartizione macro ---------- */
  const kp = media.p * 4, kc = media.c * 4, kg = media.g * 9, ks = kp + kc + kg || 1;
  const tp = t.prot * 4, tc = t.carb * 4, tg = t.gras * 9, ts = tp + tc + tg || 1;
  h += `<div class="panel"><div class="rep-h"><h3>Ripartizione dei macronutrienti</h3>
      <span class="hint">media del periodo, a confronto con il piano</span></div>`;

  /* Senza registrazioni la ripartizione è 0/0/0 e la barra piatta: sembra un
     dato, invece è l'assenza di dati. */
  if (vuotoPer) {
    h += `<p class="set-note" style="margin:0">Nessuna registrazione nel periodo: non c'è
      niente da confrontare con il piano.</p></div>`;
  } else {
  h += `
    <div class="stat-row"><span>Come mangi</span><span>${r0(kp / ks * 100)} / ${r0(kc / ks * 100)} / ${r0(kg / ks * 100)}%</span></div>
    <div class="split">
      <i style="width:${kp / ks * 100}%;background:var(--prot)"></i>
      <i style="width:${kc / ks * 100}%;background:var(--carb)"></i>
      <i style="width:${kg / ks * 100}%;background:var(--gras)"></i></div>
    <div class="stat-row" style="margin-top:10px"><span>Come dovresti</span><span>${r0(tp / ts * 100)} / ${r0(tc / ts * 100)} / ${r0(tg / ts * 100)}%</span></div>
    <div class="split">
      <i style="width:${tp / ts * 100}%;background:var(--prot);opacity:.45"></i>
      <i style="width:${tc / ts * 100}%;background:var(--carb);opacity:.45"></i>
      <i style="width:${tg / ts * 100}%;background:var(--gras);opacity:.45"></i></div>
    <div class="legend">
      <span><i style="background:var(--prot)"></i>proteine ${r0(media.p)} g</span>
      <span><i style="background:var(--carb)"></i>carboidrati ${r0(media.c)} g</span>
      <span><i style="background:var(--gras)"></i>grassi ${r0(media.g)} g</span></div>
  </div>`;
  }

  /* ---------- cosa mangio ---------- */
  const perAlimento = {};
  for (const r of righe) {
    const m = macro(r);
    const a = perAlimento[r.n] = perAlimento[r.n] || { k: 0, p: 0, q: 0, n: 0 };
    a.k += m.k; a.p += m.p; a.q += r.q; a.n++;
  }
  const topK = Object.entries(perAlimento).map(([n, v]) => ({ n, v: v.k })).sort((a, b) => b.v - a.v).slice(0, 8);
  const topP = Object.entries(perAlimento).map(([n, v]) => ({ n, v: v.p })).sort((a, b) => b.v - a.v).slice(0, 6);

  const perCat = {}, catDi = {};
  for (const a of cat) catDi[a.n.toLowerCase()] = a.cat;
  for (const r of righe) {
    const c = catDi[r.n.toLowerCase()] || 'Altro';
    perCat[c] = (perCat[c] || 0) + macro(r).k;
  }
  const catOrd = Object.entries(perCat).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);

  const perSlot = {};
  for (const r of righe) perSlot[r.slot] = (perSlot[r.slot] || 0) + macro(r).k;

  h += `<div class="cols2">
    <div class="panel"><div class="rep-h"><h3>Cosa mangio davvero</h3>
      <span class="hint">calorie nel periodo</span></div>
      ${classifica(topK, '', 'kcal')}</div>
    <div class="panel"><div class="rep-h"><h3>Da dove arrivano le proteine</h3>
      <span class="hint">grammi nel periodo</span></div>
      ${classifica(topP, 'coral', 'g')}</div>
  </div>`;

  h += `<div class="cols2">
    <div class="panel"><div class="rep-h"><h3>Calorie per categoria</h3></div>
      ${classifica(catOrd, 'sky', 'kcal')}</div>
    <div class="panel"><div class="rep-h"><h3>Calorie per pasto</h3>
      <span class="hint">media al giorno</span></div>
      ${classifica(PASTI.filter(p => perSlot[p.id]).map(p => ({ n: p.l, v: perSlot[p.id] / nG }))
        .sort((a, b) => b.v - a.v), '', 'kcal')}</div>
  </div>`;

  /* ---------- allenamento ---------- */
  h += `<div class="section-head"><h2>Allenamento</h2>
    <span class="count">${sess.length} ${sess.length === 1 ? 'sessione' : 'sessioni'}</span></div>`;

  h += `<div class="kpis">
    <div class="kpi"><div class="kl">Serie svolte</div><div class="kv">${statTot.serie}</div>
      <div class="kd pari">${sess.length ? r1(statTot.serie / sess.length) : 0} a sessione</div></div>
    <div class="kpi"><div class="kl">Volume</div>
      <div class="kv">${r0(statTot.volume / 1000)}<small> t</small></div>
      <div class="kd pari">${r0(statTot.volume).toLocaleString('it-IT')} kg sollevati</div></div>
    <div class="kpi"><div class="kl">Cardio</div><div class="kv">${r0(statTot.min)}<small> min</small></div>
      <div class="kd pari">${r1(statTot.km)} km</div></div>
    <div class="kpi"><div class="kl">Giorni allenati</div>
      <div class="kv">${new Set(sess.map(w => w.d)).size}</div>
      <div class="kd pari">su ${Math.max(1, Math.round((new Date(i.a === '9999-12-31' ? oggiISO() : i.a) - new Date(i.da === '0000-01-01' ? (giorni[0] || oggiISO()) : i.da)) / 864e5) + 1)} giorni</div></div>
  </div>`;

  const perGruppo = {}, perEser = {};
  for (const w of sess) {
    for (const e of (w.eser || [])) {
      const g = e.gruppo || gruppoDi(e.n);
      const v = (e.sets || []).filter(s => s.ok).reduce((x, s) => x + num(s.r) * num(s.w), 0);
      const ns = (e.sets || []).filter(s => s.ok).length;
      perGruppo[g] = (perGruppo[g] || 0) + v;
      const pe = perEser[e.n] = perEser[e.n] || { v: 0, serie: 0, max: 0, maxD: '' };
      pe.v += v; pe.serie += ns;
      for (const s of (e.sets || [])) {
        if (s.ok && num(s.w) > pe.max) { pe.max = num(s.w); pe.maxD = w.d; }
      }
    }
  }
  /* Il cardio non ha volume: comparirebbe come una riga a zero, che non dice
     niente e sposta in basso quelle che contano. */
  const gruppoOrd = Object.entries(perGruppo).filter(([, v]) => v > 0)
    .map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);
  const eserOrd = Object.entries(perEser).map(([n, v]) => ({ n, v: v.serie, t: v.serie + ' serie · max ' + r1(v.max) + ' kg' }))
    .sort((a, b) => b.v - a.v).slice(0, 8);

  h += `<div class="cols2">
    <div class="panel"><div class="rep-h"><h3>Volume per gruppo</h3>
      <span class="hint">kg sollevati</span></div>
      ${classifica(gruppoOrd, 'sky', 'kg')}</div>
    <div class="panel"><div class="rep-h"><h3>Esercizi più frequenti</h3></div>
      ${classifica(eserOrd, 'coral', '')}</div>
  </div>`;

  /* ---------- progressione dei carichi ---------- */
  const prog = Object.entries(perEser)
    .filter(([n, v]) => v.max > 0)
    .map(([n, v]) => {
      const stor = progressione(n);
      const delta = stor.length > 1 ? stor[stor.length - 1].y - stor[0].y : 0;
      return { n, max: v.max, delta, punti: stor.length };
    })
    .sort((a, b) => b.delta - a.delta).slice(0, 10);

  if (prog.length) {
    h += `<div class="panel"><div class="rep-h"><h3>Progressione dei carichi</h3>
      <span class="hint">massimale di serie nel periodo, contro la prima volta registrata</span></div>
      <div class="tablewrap" style="box-shadow:none;border:0"><table class="dt"><thead><tr>
        <th class="nome">Esercizio</th><th class="n">Massimo</th><th class="n">Variazione</th><th>Andamento</th>
      </tr></thead><tbody>`;
    for (const p of prog) {
      h += `<tr data-eser="${esc(p.n)}"><td class="nome">${esc(p.n)}</td>
        <td class="n">${r1(p.max)} kg</td>
        <td class="n">${p.delta > 0 ? '+' : ''}${r1(p.delta)} kg</td>
        <td><span class="badge ${p.delta > 0 ? 'ok' : p.delta < 0 ? 'no' : 'neutro'}">${p.delta > 0 ? 'in salita' : p.delta < 0 ? 'in calo' : 'fermo'}</span></td></tr>`;
    }
    h += `</tbody></table></div></div>`;
  }

  /* ---------- corpo ---------- */
  h += `<div class="section-head"><h2>Corpo</h2>
    <button class="act" data-act="nuova-misura">＋ Registra misura</button></div>`;

  if (tutteMs.length > 1) {
    h += `<div class="cols2">
      <div class="panel"><div class="rep-h"><h3>Peso</h3><span class="hint">obiettivo ${cfg().profilo.pesoObiettivo} kg</span></div>
        ${grafico(tutteMs.filter(m => m.peso).map(m => ({ y: num(m.peso), l: dataCorta(m.d) })), { goal: cfg().profilo.pesoObiettivo })}</div>
      <div class="panel"><div class="rep-h"><h3>Girovita</h3><span class="hint">obiettivo ${cfg().profilo.giroObiettivo} cm</span></div>
        ${grafico(tutteMs.filter(m => m.giro).map(m => ({ y: num(m.giro), l: dataCorta(m.d) })), { goal: cfg().profilo.giroObiettivo })}</div>
    </div>`;
  }

  if (tutteMs.length) {
    h += `<div class="tablewrap" style="margin-top:12px"><table class="dt"><thead><tr>
      <th>Data</th><th class="n">Peso</th><th class="n">Girovita</th><th class="n">Massa grassa</th><th class="n">Δ peso</th>
    </tr></thead><tbody>`;
    const ord = tutteMs.slice().reverse();
    ord.forEach((m, idx) => {
      const prec = ord[idx + 1];
      const d = prec && m.peso && prec.peso ? num(m.peso) - num(prec.peso) : null;
      h += `<tr data-misura="${m.id}">
        <td>${esc(dataCorta(m.d))}<span class="sub">${esc(String(m.d).slice(0, 4))}</span></td>
        <td class="n">${m.peso ? r1(m.peso) + ' kg' : '—'}</td>
        <td class="n">${m.giro ? r1(m.giro) + ' cm' : '—'}</td>
        <td class="n">${m.mg ? r1(m.mg) + ' %' : '—'}</td>
        <td class="n">${d == null ? '—' : `<span class="badge ${d < 0 ? 'ok' : d > 0 ? 'no' : 'neutro'}">${d > 0 ? '+' : ''}${r1(d)}</span>`}</td>
      </tr>`;
    });
    h += `</tbody></table></div>`;
  } else {
    h += vuoto('⚖️', 'Nessuna misura',
      'Peso e girovita ogni settimana, bioimpedenza ogni otto: è la regola del tuo piano.');
  }

  return h;
}

/* La serie storica del carico massimo di un esercizio, una data per sessione. */
function progressione(nome) {
  return di('w').sort((a, b) => a.d < b.d ? -1 : 1).map(w => {
    const e = (w.eser || []).find(x => x.n.toLowerCase() === nome.toLowerCase());
    if (!e) return null;
    const fatte = (e.sets || []).filter(s => s.ok && num(s.w) > 0);
    if (!fatte.length) return null;
    return { y: Math.max(...fatte.map(s => num(s.w))), l: dataCorta(w.d) };
  }).filter(Boolean);
}

/* ============================================================
   10. Impostazioni
   ============================================================ */

function vistaSettings() {
  const c = cfg(), t = c.target, p = c.profilo;
  const nRighe = di('l').length, nSess = di('w').length, nMis = di('m').length;

  const campo = (chiave, etichetta, unita, gruppo) =>
    `<div class="field"><label>${esc(etichetta)}</label>
      <input type="number" inputmode="decimal" data-cfg="${gruppo}.${chiave}"
        value="${(gruppo === 'target' ? t : p)[chiave]}"><span class="unit">${unita}</span></div>`;

  let h = `<div class="panel" style="margin-top:0"><div class="label">Bersagli giornalieri</div>
    ${campo('kcal', 'Kcal nei giorni di turno', 'kcal', 'target')}
    ${campo('kcalOff', 'Kcal nei giorni di riposo', 'kcal', 'target')}
    ${campo('prot', 'Proteine', 'g', 'target')}
    ${campo('carb', 'Carboidrati', 'g', 'target')}
    ${campo('gras', 'Grassi', 'g', 'target')}
    ${campo('acqua', 'Acqua', 'ml', 'target')}
    ${campo('passi', 'Passi', '', 'target')}
    <p class="set-note">Questi numeri sono solo un punto di partenza: metti i tuoi, presi dal
      piano che stai seguendo. Se il peso medio non scende per tre settimane, la correzione
      si fa togliendo calorie dai carboidrati — mai dalle proteine, che in deficit servono a
      non perdere massa magra.</p>
  </div>`;

  h += `<div class="panel"><div class="label">Obiettivi</div>
    ${campo('pesoObiettivo', 'Peso da raggiungere', 'kg', 'profilo')}
    ${campo('giroObiettivo', 'Girovita da raggiungere', 'cm', 'profilo')}
    ${campo('altezza', 'Altezza', 'cm', 'profilo')}
    <p class="set-note">Le due righe tratteggiate nei grafici del report sono questi numeri.
      Il rapporto girovita/altezza è l'indice che i nutrizionisti guardano più del peso:
      sotto 0,50 è considerato il livello di riferimento.</p>
  </div>`;

  h += `<div class="panel"><div class="label">Recupero fra le serie</div>
    <div class="field"><label>Durata predefinita</label>
      <input type="number" inputmode="numeric" data-rec value="${DB.settings.recDefault}"><span class="unit">sec</span></div>
    <p class="set-note">Il cronometro parte da solo quando spunti una serie.</p>
  </div>`;

  h += typeof Sync !== 'undefined' ? Sync.panel() : '';

  h += `<div class="panel"><div class="label">Backup</div>
    <div class="stat-row"><span>Voci del diario</span><span>${nRighe}</span></div>
    <div class="stat-row"><span>Sessioni di allenamento</span><span>${nSess}</span></div>
    <div class="stat-row"><span>Misure</span><span>${nMis}</span></div>
    <div class="stat-row"><span>Alimenti tuoi</span><span>${di('a').length}</span></div>
    <div class="stat-row"><span>Schede</span><span>${schede().length}</span></div>
    <button class="btn sec" data-act="backup">Esporta tutto (file JSON)</button>
    <button class="btn sec" data-act="ripristina">Ripristina da un backup</button>
    <p class="set-note">Il backup contiene tutto: diario, allenamenti, misure, bersagli.
      Senza sincronizzazione è l'unica copia che esiste oltre a questo dispositivo.</p>
  </div>`;

  h += `<div class="panel"><div class="label">Questa app</div>
    <div class="stat-row"><span>Versione</span><span>${APP_VERSION}</span></div>
    <div class="stat-row"><span>Alimenti nel database</span><span>${ALIMENTI.length}</span></div>
    <div class="stat-row"><span>Funziona senza rete</span><span>${'serviceWorker' in navigator ? 'sì' : 'no'}</span></div>
    <button class="btn danger" data-act="azzera">Cancella tutti i dati di questo dispositivo</button>
  </div>`;

  h += `<div class="brand-foot"><div class="wm">CodeMind<span>.Lab</span></div>
    <p>Forma · alimentazione e allenamento</p></div>`;
  return h;
}

/* ============================================================
   11. Pannelli dal basso
   ============================================================ */

let sheetCtx = {};

function apriSheet(html, ctx) {
  sheetCtx = ctx || {};
  $('#sheetContent').innerHTML = html;
  $('#sheet').hidden = false;
  const f = $('#sheetContent input[autofocus]');
  if (f) setTimeout(() => f.focus(), 120);
}
function chiudiSheet() { $('#sheet').hidden = true; sheetCtx = {}; }

/* ---------- scelta dell'alimento ---------- */

function sheetCerca(slot, q) {
  const query = (q || '').trim().toLowerCase();
  const lista = query
    ? catalogo().filter(a => a.n.toLowerCase().includes(query)).slice(0, 40)
    : recenti(10);
  const ric = di('r');

  let h = `<h2 class="sheet-title">Aggiungi a ${esc((PASTI.find(p => p.id === slot) || {}).l || 'pasto')}</h2>
    <div class="searchbar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="cercaCibo" type="search" placeholder="Cerca fra ${catalogo().length} alimenti"
        value="${esc(q || '')}" autocapitalize="off" spellcheck="false" ${q ? '' : 'autofocus'}>
      <button class="scan-btn" data-act="scansiona" aria-label="Scansiona il codice a barre">
        <svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10.5 8v8M14 8v8M17 8v8"/></svg>
      </button>
    </div>`;

  if (!query && ric.length) {
    h += `<div class="fchips" style="margin-bottom:10px">
      ${ric.slice(0, 6).map(r => `<button data-ric="${r.id}">📦 ${esc(r.n)}</button>`).join('')}
    </div>`;
  }
  if (!query) {
    h += `<p class="set-note" style="margin:0 0 6px">${lista.length ? 'Usati di recente' : 'Scrivi per cercare nel database'}</p>`;
  }

  h += lista.map(a => `<button class="res" data-cibo="${esc(a.n)}">
      <span class="ic">${CAT_ICON[a.cat] || '🍽️'}</span>
      <span class="body"><h3>${esc(a.n)}</h3>
        <span class="meta"><b>${a.k}</b> kcal · ${a.p}P ${a.c}C ${a.g}G per 100 g${a.mio ? ' · <span class="mine">mio</span>' : ''}</span></span>
      <span class="add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
    </button>`).join('');

  if (query && !lista.length) {
    h += `<p class="set-note">Nessun alimento con questo nome.</p>
      <button class="btn sec" data-act="nuovo-alimento">Crea “${esc(q)}”</button>`;
  }
  return h;
}

/* ---------- quantità ---------- */

function sheetQuantita() {
  const a = sheetCtx.alim, q = num(sheetCtx.q, 0);
  const f = q / 100;
  const porz = PORZIONI[a.n] || [];
  const slot = sheetCtx.slot;
  return `<h2 class="sheet-title">${esc(a.n)}</h2>
    <div class="qty">
      <div class="qn">${a.k} kcal · ${a.p}P ${a.c}C ${a.g}G per 100 g</div>
      <div class="qbig">${sheetCtx.q === '' ? '0' : esc(sheetCtx.q)}<span> g</span></div>
      <div class="qmac"><b>${r0(a.k * f)}</b> kcal · <b>${r1(a.p * f)}</b> P ·
        <b>${r1(a.c * f)}</b> C · <b>${r1(a.g * f)}</b> G</div>
    </div>
    ${porz.length ? `<div class="porz">${porz.map(p =>
      `<button data-pq="${p.q}">${esc(p.l)} · ${p.q} g</button>`).join('')}</div>` : ''}
    <div class="fgroup" style="margin-top:14px"><label>Pasto</label>
      <select id="slotSel">${PASTI.map(p =>
        `<option value="${p.id}" ${p.id === slot ? 'selected' : ''}>${esc(p.l)}</option>`).join('')}</select></div>
    <div class="pads">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
      <button data-k="canc" class="op">←</button>
      <button data-k="0">0</button>
      <button data-k="c" class="op">C</button>
    </div>
    <button class="btn" data-act="conferma-cibo">${(sheetCtx.rigaId || sheetCtx.pIdx != null) ? 'Salva' : 'Aggiungi'} ${q ? r0(a.k * f) + ' kcal' : ''}</button>
    ${(sheetCtx.rigaId || sheetCtx.pIdx != null) ? `<button class="btn danger" data-act="elimina-riga">Elimina la voce</button>` : ''}`;
}

/* ---------- altri pannelli ---------- */

function sheetMisura(m) {
  return `<h2 class="sheet-title">${m ? 'Modifica misura' : 'Nuova misura'}</h2>
    <div class="field"><label>Data</label><input type="date" id="misD" value="${esc(m ? m.d : oggiISO())}"><span class="unit"></span></div>
    <div class="field"><label>Peso</label><input type="number" inputmode="decimal" step="0.1" id="misP" value="${m && m.peso ? m.peso : ''}"><span class="unit">kg</span></div>
    <div class="field"><label>Girovita</label><input type="number" inputmode="decimal" step="0.5" id="misG" value="${m && m.giro ? m.giro : ''}"><span class="unit">cm</span></div>
    <div class="field"><label>Massa grassa</label><input type="number" inputmode="decimal" step="0.1" id="misMg" value="${m && m.mg ? m.mg : ''}"><span class="unit">%</span></div>
    <p class="set-note">Peso e girovita ogni settimana, la bioimpedenza ogni otto.
      Pesati sempre nelle stesse condizioni: appena sveglio, a digiuno, dopo il bagno.</p>
    <button class="btn" data-act="salva-misura">Salva</button>
    ${m ? `<button class="btn danger" data-act="elimina-misura">Elimina</button>` : ''}`;
}

function sheetNuovoAlimento(nome, a) {
  /* Il titolo dipende dall'id, non dal fatto che ci siano dei valori: quando
     arriva dal codice a barre o da una copia i campi sono già pieni, ma
     l'alimento non esiste ancora. */
  return `<h2 class="sheet-title">${a && a.id ? 'Modifica alimento' : 'Nuovo alimento'}</h2>
    <p class="set-note" style="margin:0 0 12px">Valori per <b>100 g</b>, come sul database del piano.
      Se li copi da un'etichetta, controlla che non siano riferiti a una porzione.</p>
    <input class="txtin" id="alN" placeholder="Nome" value="${esc(a ? a.n : (nome || ''))}" style="margin-bottom:9px">
    <div class="fgrid">
      <div class="fgroup"><label>Kcal</label><input type="number" inputmode="decimal" id="alK" value="${a ? a.k : ''}"></div>
      <div class="fgroup"><label>Proteine g</label><input type="number" inputmode="decimal" id="alP" value="${a ? a.p : ''}"></div>
      <div class="fgroup"><label>Carboidrati g</label><input type="number" inputmode="decimal" id="alC" value="${a ? a.c : ''}"></div>
      <div class="fgroup"><label>Grassi g</label><input type="number" inputmode="decimal" id="alG" value="${a ? a.g : ''}"></div>
      <div class="fgroup full"><label>Categoria</label><select id="alCat">
        ${CATEGORIE.map(c => `<option ${a && a.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select></div>
      <div class="fgroup full"><label>Nota</label><input type="text" id="alNt" value="${esc(a ? a.nt || '' : '')}" placeholder="es. 1 vasetto = 150 g"></div>
    </div>
    <button class="btn" data-act="salva-alimento">Salva</button>
    ${a && a.id ? `<button class="btn danger" data-act="elimina-alimento">Elimina</button>` : ''}`;
}

/* prompt() non è affidabile dentro un'app installata — su alcune versioni di iOS
   viene semplicemente ignorato — e comunque stona con il resto dell'interfaccia,
   che chiede tutto dal basso. */
/* Il calendario del mese. Le frecce spostano di un giorno, la striscia della
   settimana di sette: per andare al mese scorso o alla settimana prossima
   servirebbero venti tocchi. Qui ci si arriva in uno. */
function sheetCalendario(sel) {
  const mese = sheetCtx.mese || sel.slice(0, 7);
  const [anno, mm] = mese.split('-').map(Number);
  const primo = new Date(anno, mm - 1, 1);
  const giorniNelMese = new Date(anno, mm, 0).getDate();
  const vuoti = (primo.getDay() + 6) % 7;          // lunedì come primo giorno
  const oggi = oggiISO();

  const nomeMese = primo.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    .replace(/^./, c => c.toUpperCase());

  let celle = '';
  for (let i = 0; i < vuoti; i++) celle += `<span class="cal-v"></span>`;
  for (let g = 1; g <= giorniNelMese; g++) {
    const data = mese + '-' + String(g).padStart(2, '0');
    const righe = righeDi(data).length;
    const allenato = di('w').some(w => w.d === data);
    const haPiano = pianoPieno(gsDiData(data));
    const cls = [
      data === sel ? 'sel' : '',
      data === oggi ? 'oggi' : '',
      data > oggi ? 'futuro' : ''
    ].filter(Boolean).join(' ');
    celle += `<button class="cal-g ${cls}" data-vaidata="${data}">
      <b>${g}</b>
      <span class="cal-p">
        <i class="${righe ? 'cibo' : (haPiano ? 'piano' : '')}"></i>
        <i class="${allenato ? 'pesi' : ''}"></i>
      </span>
    </button>`;
  }

  return `<h2 class="sheet-title">Vai a una data</h2>
    <div class="cal-top">
      <button class="arw" data-mese="-1" aria-label="Mese precedente">
        <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="cal-m">${esc(nomeMese)}</span>
      <button class="arw" data-mese="1" aria-label="Mese successivo">
        <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
    </div>
    <div class="cal-h">${GIORNI_SETT.map(g => `<span>${g.b}</span>`).join('')}</div>
    <div class="cal-griglia">${celle}</div>
    <div class="legend" style="justify-content:center">
      <span><i style="background:var(--coral)"></i>registrato</span>
      <span><i style="background:var(--sky)"></i>solo piano</span>
      <span><i style="background:var(--teal)"></i>allenamento</span>
    </div>
    <button class="btn sec" data-vaidata="${oggi}">Torna a oggi</button>`;
}

function sheetPassi(d) {
  const g = giorno(d);
  const t = cfg().target.passi;
  return `<h2 class="sheet-title">Passi di ${esc(nomeGiorno(d).toLowerCase())}</h2>
    <input class="txtin" id="passiVal" type="number" inputmode="numeric"
      value="${g.passi || ''}" placeholder="${t}" autofocus>
    <div class="fchips" style="margin-top:11px">
      ${[5000, 7500, 10000, 12000, 15000].map(n =>
        `<button data-passi="${n}">${n.toLocaleString('it-IT')}</button>`).join('')}
    </div>
    <p class="set-note">Il bersaglio del piano è ${t.toLocaleString('it-IT')} passi:
      finché la palestra non è a regime è l'unica leva sul dispendio.</p>
    <button class="btn" data-act="salva-passi">Salva</button>`;
}

function sheetRicetta(d) {
  const righe = righeDi(d);
  const t = somma(righe);
  return `<h2 class="sheet-title">Salva come combinazione</h2>
    <p class="set-note" style="margin:0 0 11px">${righe.length} voci · ${r0(t.k)} kcal ·
      ${r0(t.p)} g proteine. La ritrovi come pulsante quando aggiungi un alimento.</p>
    <input class="txtin" id="ricNome" value="Giornata ${esc(dataCorta(d))}"
      placeholder="Nome della combinazione" autofocus>
    <button class="btn" data-act="salva-ricetta-ok">Salva</button>`;
}

function sheetAvvioAllenamento() {
  const l = schede();
  let h = `<h2 class="sheet-title">Nuovo allenamento</h2>`;
  if (!l.length) {
    h += `<p class="set-note" style="margin:0 0 12px">Non hai ancora schede. Puoi partire da zero
      e aggiungere gli esercizi mentre ti alleni, oppure creare prima una scheda.</p>`;
  }
  for (const s of l) {
    for (const g of (s.giorni || [])) {
      h += `<button class="sheet-row" data-avvia="${s.id}|${esc(g.n)}">
        <span class="ic">🏋️</span>
        <span>${esc(g.n)}<span class="hint">${esc(s.n)} · ${(g.eser || []).length} esercizi</span></span>
      </button>`;
    }
  }
  h += `<button class="sheet-row" data-avvia="|Allenamento libero">
      <span class="ic">✏️</span><span>Allenamento libero</span></button>`;
  return h;
}

function sheetEsercizio() {
  const q = (sheetCtx.q || '').toLowerCase();
  let h = `<h2 class="sheet-title">Aggiungi esercizio</h2>
    <div class="searchbar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="cercaEser" type="search" placeholder="Cerca o scrivi un nome nuovo"
        value="${esc(sheetCtx.q || '')}" autocapitalize="off" spellcheck="false" autofocus>
    </div>`;
  let trovati = 0;
  for (const g of GRUPPI) {
    const l = ESERCIZI[g].filter(e => !q || e.toLowerCase().includes(q));
    if (!l.length) continue;
    trovati += l.length;
    h += `<p class="set-note" style="margin:12px 0 2px;font-weight:800;color:var(--teal);text-transform:uppercase;font-size:10px;letter-spacing:.06em">${esc(g)}</p>`;
    h += l.map(e => `<button class="sheet-row" data-eserpick="${esc(e)}"><span>${esc(e)}</span></button>`).join('');
  }
  if (!trovati && sheetCtx.q) {
    h += `<button class="btn" data-eserpick="${esc(sheetCtx.q)}">Aggiungi “${esc(sheetCtx.q)}”</button>`;
  }
  return h;
}

function sheetAzioniAlimento(nome) {
  const a = catalogo().find(x => x.n === nome);
  if (!a) return '';
  return `<h2 class="sheet-title">${esc(a.n)}</h2>
    <p class="set-note" style="margin:0 0 10px"><b>${a.k}</b> kcal · ${a.p} g proteine ·
      ${a.c} g carboidrati · ${a.g} g grassi per 100 g${a.nt ? ' · ' + esc(a.nt) : ''}</p>
    <button class="sheet-row" data-cibo="${esc(a.n)}"><span class="ic">➕</span>
      <span>Aggiungi al diario di oggi</span></button>
    ${a.mio
      ? `<button class="sheet-row" data-modal="${esc(a.n)}"><span class="ic">✏️</span><span>Modifica i valori</span></button>`
      : `<button class="sheet-row" data-copia="${esc(a.n)}"><span class="ic">📄</span>
          <span>Crea una copia mia<span class="hint">per correggere i valori</span></span></button>`}`;
}

/* ============================================================
   Codice a barre
   ============================================================

   Il codice si cerca prima fra i tuoi alimenti: un prodotto già scansionato
   una volta si ritrova senza rete. Solo se non c'è si chiede a Open Food
   Facts, che è gratuito, non vuole chiavi ed è pieno di prodotti italiani.
*/

const OFF = 'https://world.openfoodfacts.org/api/v2/product/';

function alimentoDaCodice(codice) {
  return di('a').find(a => a.ean === codice) || null;
}

/* Le categorie di Open Food Facts sono migliaia: qui si tenta solo di
   indovinare quella giusta fra le nostre otto, e in caso di dubbio si mette
   "Altro" — tanto la si può cambiare prima di salvare. */
function categoriaDaOFF(tags) {
  const t = (tags || []).join(' ');
  if (/dairy|milk|yogurt|cheese|egg|latt|formagg|uov/i.test(t)) return 'Latticini/Uova';
  if (/meat|poultry|chicken|beef|pork|ham|salumi|carn/i.test(t)) return 'Carne';
  if (/fish|seafood|tuna|salmon|pesc|tonn/i.test(t)) return 'Pesce';
  if (/cereal|bread|pasta|rice|flour|pane|pasta|ris|farin|biscot/i.test(t)) return 'Cereali';
  if (/legume|bean|lentil|chickpea|fagiol|lentic|cec/i.test(t)) return 'Legumi';
  if (/fruit|vegetable|frutt|verdur|ortagg/i.test(t)) return 'Frutta/Verdura';
  if (/oil|nut|seed|olio|frutta-secca|semi/i.test(t)) return 'Grassi';
  return 'Altro';
}

async function cercaCodice(codice) {
  const campi = 'product_name,product_name_it,brands,quantity,nutriments,categories_tags';
  const r = await fetch(OFF + encodeURIComponent(codice) + '?fields=' + campi);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (d.status !== 1 || !d.product) return null;

  const pr = d.product, nut = pr.nutriments || {};
  /* Le calorie a volte ci sono già in kcal, a volte solo in kJ. */
  let kcal = num(nut['energy-kcal_100g'], 0);
  if (!kcal) kcal = num(nut['energy_100g'], 0) / 4.184;

  const marca = (pr.brands || '').split(',')[0].trim();
  const nome = (pr.product_name_it || pr.product_name || '').trim();
  if (!nome) return null;

  return {
    n: nome + (marca && !nome.toLowerCase().includes(marca.toLowerCase()) ? ' · ' + marca : ''),
    k: r1(kcal), p: r1(num(nut.proteins_100g, 0)),
    c: r1(num(nut.carbohydrates_100g, 0)), g: r1(num(nut.fat_100g, 0)),
    cat: categoriaDaOFF(pr.categories_tags), nt: pr.quantity || '', ean: codice
  };
}

function avviaScansione() {
  if (!Scanner.disponibile()) { sheetCodiceManuale('La fotocamera non è disponibile qui.'); return; }
  const ctx = Object.assign({}, sheetCtx);      // il pasto scelto non va perso
  chiudiSheet();
  Scanner.apri(codice => { sheetCtx = ctx; gestisciCodice(codice); });
}

async function gestisciCodice(codice) {
  /* Prima in casa: se l'hai già scansionato una volta salti la rete e vai
     dritto alla quantità. */
  const mio = alimentoDaCodice(codice);
  if (mio) {
    sheetCtx = Object.assign({}, sheetCtx, { alim: mio, q: '', slot: sheetCtx.slot || slotOra(), rigaId: null, pIdx: null });
    apriSheet('', sheetCtx);
    $('#sheetContent').innerHTML = sheetQuantita();
    return;
  }

  if (!navigator.onLine) {
    apriSheet(sheetNuovoAlimento('', { n: '', k: '', p: '', c: '', g: '', cat: 'Altro', nt: '', ean: codice }), { ean: codice });
    toast('Sei offline: i valori mettili tu');
    return;
  }

  apriSheet(`<h2 class="sheet-title">Cerco il prodotto…</h2>
    <p class="set-note" style="margin:0 0 10px">Codice <b>${esc(codice)}</b></p>
    <div class="spinner"></div>`, { ean: codice });

  try {
    const p = await cercaCodice(codice);
    if (!p) {
      apriSheet(sheetNuovoAlimento('', { n: '', k: '', p: '', c: '', g: '', cat: 'Altro', nt: '', ean: codice }), { ean: codice });
      toast('Prodotto non in archivio: aggiungilo tu');
      return;
    }
    apriSheet(sheetProdotto(p), { prodotto: p });
  } catch (e) {
    apriSheet(sheetNuovoAlimento('', { n: '', k: '', p: '', c: '', g: '', cat: 'Altro', nt: '', ean: codice }), { ean: codice });
    toast('Non raggiungo Open Food Facts');
  }
}

function sheetProdotto(p) {
  const dubbio = !p.k || (!p.p && !p.c && !p.g);
  return `<h2 class="sheet-title">Prodotto trovato</h2>
    <div class="trovato">
      <span class="ic" style="font-size:22px">${CAT_ICON[p.cat] || '🍽️'}</span>
      <span class="tb">
        <h3>${esc(p.n)}</h3>
        <span class="meta"><b>${p.k}</b> kcal · ${p.p}P ${p.c}C ${p.g}G per 100 g</span>
        <span class="ean">${esc(p.ean)}${p.nt ? ' · ' + esc(p.nt) : ''}</span>
      </span>
    </div>
    <p class="set-note">${dubbio
      ? 'Su questo prodotto Open Food Facts ha dati incompleti: controllali sull’etichetta prima di salvare.'
      : 'I dati vengono da Open Food Facts, dove li inseriscono gli utenti. Un’occhiata all’etichetta non fa male.'}</p>
    <button class="btn" data-act="salva-prodotto">Aggiungi ai miei alimenti</button>
    <button class="btn sec" data-act="correggi-prodotto">Correggi i valori</button>`;
}

function sheetCodiceManuale(avviso) {
  return apriSheet(`<h2 class="sheet-title">Codice a barre</h2>
    ${avviso ? `<p class="set-note" style="margin:0 0 10px">${esc(avviso)}</p>` : ''}
    <p class="set-note" style="margin:0 0 10px">Le tredici cifre stampate sotto alle barre.</p>
    <input class="txtin" id="eanVal" type="text" inputmode="numeric" autocomplete="off"
      placeholder="8076809513692" autofocus>
    <button class="btn" data-act="cerca-ean">Cerca</button>`, Object.assign({}, sheetCtx));
}

/* ============================================================
   12. Esportazione
   ============================================================

   Il CSV nasce dagli stessi filtri della tabella: quello che vedi è quello che
   esce. Il punto e virgola come separatore è ciò che Excel italiano si aspetta;
   con la virgola metterebbe tutta la riga in una colonna sola.
*/

function csv(righe) {
  return righe.map(r => r.map(c => {
    const s = String(c == null ? '' : c);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
}

async function scarica(nomeFile, testo, tipo) {
  const blob = new Blob(['﻿' + testo], { type: (tipo || 'text/csv') + ';charset=utf-8' });
  const file = new File([blob], nomeFile, { type: blob.type });

  /* Su iPhone un collegamento con "download" spesso non fa nulla dentro l'app
     installata: il foglio di condivisione è l'unico modo affidabile per far
     uscire un file dal telefono. Sul Mac vince il salvataggio diretto. */
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nomeFile }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function esporta(cosa) {
  const oggi = oggiISO();
  if (cosa === 'cibo') {
    const righe = righeFiltrate();
    const out = [['Data', 'Giorno', 'Pasto', 'Alimento', 'Grammi', 'Kcal', 'Proteine', 'Carboidrati', 'Grassi']];
    for (const r of righe) {
      const m = macro(r);
      const p = PASTI.find(p => p.id === r.slot);
      out.push([r.d, nomeGiorno(r.d), p ? p.l : r.slot, r.n, r1(r.q), r0(m.k), r1(m.p), r1(m.c), r1(m.g)]);
    }
    const t = somma(righe);
    out.push([]);
    out.push(['Totale', '', '', '', '', r0(t.k), r1(t.p), r1(t.c), r1(t.g)]);
    scarica('forma-diario-' + oggi + '.csv', csv(out));

  } else if (cosa === 'alimenti') {
    const out = [['Alimento', 'Categoria', 'Kcal/100g', 'Proteine', 'Carboidrati', 'Grassi', 'Origine', 'Nota']];
    for (const a of alimentiFiltrati()) out.push([a.n, a.cat, a.k, a.p, a.c, a.g, a.mio ? 'mio' : 'piano', a.nt || '']);
    scarica('forma-alimenti-' + oggi + '.csv', csv(out));

  } else if (cosa === 'sessioni') {
    const out = [['Data', 'Allenamento', 'Scheda', 'Esercizio', 'Gruppo', 'Serie', 'Ripetizioni', 'Peso kg', 'Minuti', 'Km']];
    for (const w of sessioniFiltrate()) {
      for (const e of (w.eser || [])) {
        const fatte = (e.sets || []).filter(s => s.ok);
        if (fatte.length) {
          fatte.forEach((s, i) => out.push([w.d, w.gn || '', w.sn || '', e.n,
            e.gruppo || gruppoDi(e.n), i + 1, s.r, s.w, '', '']));
        } else {
          out.push([w.d, w.gn || '', w.sn || '', e.n, e.gruppo || gruppoDi(e.n), '', '', '', e.min || '', e.km || '']);
        }
      }
    }
    scarica('forma-allenamenti-' + oggi + '.csv', csv(out));

  } else if (cosa === 'report') {
    const f = filtri('report'), i = intervallo(f);
    const righe = di('l').filter(r => r.d >= i.da && r.d <= i.a);
    const perGiorno = {};
    for (const r of righe) {
      const m = macro(r);
      const g = perGiorno[r.d] = perGiorno[r.d] || { k: 0, p: 0, c: 0, g: 0 };
      g.k += m.k; g.p += m.p; g.c += m.c; g.g += m.g;
    }
    const out = [['Data', 'Tipo giornata', 'Kcal', 'Bersaglio', 'Scarto', 'Proteine', 'Carboidrati', 'Grassi', 'Acqua ml', 'Passi', 'Allenamenti', 'Volume kg']];
    for (const d of Object.keys(perGiorno).sort()) {
      const g = perGiorno[d], kt = kcalTarget(d), gg = giorno(d);
      const s = di('w').filter(w => w.d === d);
      const vol = s.reduce((v, w) => v + statSessione(w).volume, 0);
      out.push([d, gg.tipo === 'off' ? 'riposo' : 'turno', r0(g.k), kt, r0(g.k - kt),
        r1(g.p), r1(g.c), r1(g.g), gg.acqua || 0, gg.passi || 0, s.length, r0(vol)]);
    }
    scarica('forma-report-' + oggi + '.csv', csv(out));
  }
}

/* ============================================================
   13. Cronometro del recupero
   ============================================================ */

let recT = null, recFine = 0;

function avviaRecupero(sec) {
  recFine = Date.now() + sec * 1000;
  $('#rest').hidden = false;
  clearInterval(recT);
  recT = setInterval(tickRecupero, 250);
  tickRecupero();
}
function tickRecupero() {
  const resta = Math.max(0, Math.round((recFine - Date.now()) / 1000));
  $('#restTime').textContent = durata(resta);
  if (resta <= 0) {
    clearInterval(recT); recT = null;
    $('#rest').hidden = true;
    haptic();
    toast('Recupero finito');
  }
}
function fermaRecupero() {
  clearInterval(recT); recT = null;
  $('#rest').hidden = true;
}

/* ============================================================
   14. Comandi
   ============================================================ */

/* Ridisegna senza far perdere il punto in cui stavi scrivendo: la ricerca
   filtra a ogni lettera, e se il cursore saltasse via il campo diventerebbe
   inutilizzabile. */
function renderConFuoco() {
  const el = document.activeElement;
  const sel = el && el.dataset && (el.dataset.set || el.id);
  const pos = el && el.selectionStart;
  render();
  if (!sel) return;
  const n = document.querySelector(el.id ? '#' + el.id : `[data-set="${sel}"]`);
  if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
}

let cercaT = null;

document.addEventListener('click', e => {
  /* Il fondo scuro dietro al pannello va gestito per primo e da solo: è un
     <div>, quindi non verrebbe mai raccolto dal closest() qui sotto, ed era il
     motivo per cui da un pannello aperto non si poteva più uscire. */
  if (e.target.id === 'sheetBackdrop' || e.target.closest('#sheetClose')) { chiudiSheet(); return; }

  /* [data-act] va incluso: senza, le due righe che non sono <button> — la data
     in cima a Oggi e l'intestazione del piano — non rispondevano al tocco. */
  const b = e.target.closest('button, [data-act], [data-apri], [data-riga], [data-sess], [data-alim], [data-misura], [data-eser], [data-scheda], th[data-ord]');
  if (!b) return;
  const d = b.dataset;

  /* ---------- navigazione ---------- */
  if (d.tab) { vai({ name: d.tab, d: oggiISO() }); return; }
  if (b.id === 'settingsBtn') { vai({ name: 'settings' }); return; }
  if (b.id === 'backBtn') { history.back(); return; }
  if (b.id === 'fab') { fab(); return; }
  if (d.sub) { SUB[view.name] = d.sub; render(); return; }

  /* ---------- barra del recupero ---------- */
  if (b.id === 'scanChiudi') { Scanner.chiudi(); return; }
  if (b.id === 'scanManuale') { Scanner.chiudi(); sheetCodiceManuale(''); return; }

  if (b.id === 'restPlus') { recFine += 30000; tickRecupero(); return; }
  if (b.id === 'restStop') { fermaRecupero(); return; }

  /* ---------- pannello dal basso ---------- */
  if (d.chiudi) { chiudiSheet(); return; }

  /* ---------- filtri ---------- */
  if (d.f) {
    const f = filtri(d.f);
    if (d.per) f.per = d.per;
    else if (d.multi) {
      const a = f[d.multi] = f[d.multi] || [];
      const i = a.indexOf(d.val);
      if (i < 0) a.push(d.val); else a.splice(i, 1);
    } else if (d.flag) f[d.flag] = !f[d.flag];
    else if (d.set) f[d.set] = d.val || '';
    save(); render(); return;
  }
  if (d.reset) { azzeraFiltro(d.reset); return; }
  if (d.apri) {
    DB.settings.fAperti = DB.settings.fAperti || {};
    DB.settings.fAperti[d.apri] = !filtriAperti(d.apri);
    save(); render(); return;
  }
  if (d.ord) {
    const f = filtri(d.ord);
    f.ord = f.ord === d.campo ? d.campo + '-' : d.campo;
    save(); render(); return;
  }
  if (d.export) { esporta(d.export); return; }

  /* ---------- Oggi ---------- */
  if (d.day) { view.d = spostaData(view.d, num(d.day)); render(); return; }

  if (d.acqua) {
    const g = giorno(view.d, true);
    g.acqua = Math.max(0, (g.acqua || 0) + num(d.acqua));
    tocca(g); haptic(); render(); return;
  }
  if (d.addSlot) { apriSheet(sheetCerca(d.addSlot, ''), { slot: d.addSlot }); return; }
  if (d.riga) {
    const r = DB.items.find(i => i.id === d.riga);
    if (!r) return;
    const a = catalogo().find(x => x.n.toLowerCase() === r.n.toLowerCase()) || { n: r.n, k: r.k, p: r.p, c: r.c, g: r.g, cat: 'Altro' };
    apriSheet('', {});
    sheetCtx = { alim: a, q: String(r1(r.q)), slot: r.slot, rigaId: r.id, d: r.d };
    $('#sheetContent').innerHTML = sheetQuantita();
    $('#sheet').hidden = false;
    return;
  }

  /* ---------- alimenti ---------- */
  if (d.alim) { apriSheet(sheetAzioniAlimento(d.alim), {}); return; }
  if (d.cibo) {
    const a = catalogo().find(x => x.n === d.cibo);
    if (!a) return;
    sheetCtx = Object.assign({}, sheetCtx, { alim: a, q: '', slot: sheetCtx.slot || slotOra(), rigaId: null });
    $('#sheetContent').innerHTML = sheetQuantita();
    $('#sheet').hidden = false;
    return;
  }
  if (d.pq) { sheetCtx.q = String(d.pq); $('#sheetContent').innerHTML = sheetQuantita(); return; }
  if (d.k) {
    if (d.k === 'canc') sheetCtx.q = String(sheetCtx.q || '').slice(0, -1);
    else if (d.k === 'c') sheetCtx.q = '';
    else if (String(sheetCtx.q || '').length < 5) sheetCtx.q = String(sheetCtx.q || '') + d.k;
    $('#sheetContent').innerHTML = sheetQuantita();
    return;
  }
  if (d.modal) {
    const a = di('a').find(x => x.n === d.modal);
    apriSheet(sheetNuovoAlimento('', a), { alimId: a && a.id });
    return;
  }
  if (d.passi) { $('#passiVal').value = d.passi; return; }
  if (d.creaal) { apriSheet(sheetNuovoAlimento(d.creaal, null), {}); return; }
  if (d.copia) {
    const a = catalogo().find(x => x.n === d.copia);
    apriSheet(sheetNuovoAlimento('', { n: a.n + ' (mio)', k: a.k, p: a.p, c: a.c, g: a.g, cat: a.cat, nt: a.nt }), {});
    return;
  }
  if (d.ric) {
    const r = DB.items.find(i => i.id === d.ric);
    if (!r) return;
    for (const x of (r.righe || [])) {
      aggiungi({ t: 'l', d: view.d || oggiISO(), slot: sheetCtx.slot || x.slot || slotOra(), n: x.n, q: x.q, k: x.k, p: x.p, c: x.c, g: x.g });
    }
    chiudiSheet(); haptic(); toast(r.n + ' aggiunta'); render();
    return;
  }

  /* ---------- piano della settimana ---------- */
  if (d.giorno) {
    if (aperti.giorni.has(d.giorno)) aperti.giorni.delete(d.giorno);
    else aperti.giorni.add(d.giorno);
    render(); return;
  }
  if (d.catapri) {
    if (aperti.cat.has(d.catapri)) aperti.cat.delete(d.catapri);
    else aperti.cat.add(d.catapri);
    render(); return;
  }
  if (d.gs) { SUB.gs = d.gs; render(); return; }
  if (d.vaidata) {
    view.d = d.vaidata;
    if (!$('#sheet').hidden) chiudiSheet();
    render(); return;
  }
  if (d.mese) {
    const [a, m] = (sheetCtx.mese || view.d.slice(0, 7)).split('-').map(Number);
    const nuovo = new Date(a, m - 1 + num(d.mese), 1);
    sheetCtx.mese = nuovo.getFullYear() + '-' + String(nuovo.getMonth() + 1).padStart(2, '0');
    $('#sheetContent').innerHTML = sheetCalendario(view.d);
    return;
  }
  if (d.applica) { applicaPiano(d.applica, d.data || oggiISO()); return; }
  if (d.padd) {
    const [gs, slot] = d.padd.split('|');
    apriSheet(sheetCerca(slot, ''), { slot, piano: gs });
    return;
  }
  if (d.priga) {
    const [gs, idx] = d.priga.split('|');
    const p = piano(gs);
    const r = (p.righe || [])[+idx];
    if (!r) return;
    const a = catalogo().find(x => x.n.toLowerCase() === r.n.toLowerCase()) ||
      { n: r.n, k: r.k, p: r.p, c: r.c, g: r.g, cat: 'Altro' };
    sheetCtx = { alim: a, q: String(r1(r.q)), slot: r.slot, piano: gs, pIdx: +idx };
    $('#sheetContent').innerHTML = sheetQuantita();
    $('#sheet').hidden = false;
    return;
  }
  if (d.copiada) {
    const da = piano(d.copiada);
    const p = piano(SUB.gs, true);
    p.righe = (da.righe || []).map(r => Object.assign({}, r));
    if (!p.nome) p.nome = da.nome || '';
    tocca(p); chiudiSheet(); toast('Copiato'); render();
    return;
  }

  /* ---------- allenamento ---------- */
  if (d.gsel !== undefined) { view.gi = num(d.gsel); render(); return; }
  if (d.scheda) { vai({ name: 'scheda', id: d.scheda, gi: 0 }); return; }
  if (d.sess) { vai({ name: 'sessione', id: d.sess }); return; }
  if (d.avvia) {
    const [sid, gn] = d.avvia.split('|');
    avviaAllenamento(sid, gn);
    return;
  }
  if (d.adde !== undefined) { apriSheet(sheetEsercizio(), { gi: num(d.adde), dove: 'scheda' }); return; }
  if (d.eserpick) { scegliEsercizio(d.eserpick); return; }
  if (d.delg !== undefined) {
    const s = DB.items.find(i => i.id === view.id);
    s.giorni.splice(num(d.delg), 1); tocca(s); render(); return;
  }
  if (d.dele !== undefined) {
    const [gi, ei] = d.dele.split('.').map(Number);
    const s = DB.items.find(i => i.id === view.id);
    s.giorni[gi].eser.splice(ei, 1); tocca(s); render(); return;
  }
  if (d.delwe !== undefined) {
    const w = DB.items.find(i => i.id === view.id);
    w.eser.splice(num(d.delwe), 1); tocca(w); render(); return;
  }
  if (d.addset !== undefined) {
    const w = DB.items.find(i => i.id === view.id);
    const e = w.eser[num(d.addset)];
    const ult = (e.sets || [])[e.sets.length - 1] || {};
    e.sets.push({ r: ult.r != null ? ult.r : (e.rip || ''), w: ult.w != null ? ult.w : (e.peso || ''), ok: false });
    tocca(w); render(); return;
  }
  if (d.tick) {
    const [ei, si] = d.tick.split('.').map(Number);
    const w = DB.items.find(i => i.id === view.id);
    const s = w.eser[ei].sets[si];
    s.ok = !s.ok;
    tocca(w); haptic();
    if (s.ok) avviaRecupero(num(w.eser[ei].rec, DB.settings.recDefault));
    render(); return;
  }
  if (d.eser) { apriSheet(sheetProgressione(d.eser), {}); return; }

  /* ---------- misure ---------- */
  if (d.misura) {
    const m = DB.items.find(i => i.id === d.misura);
    apriSheet(sheetMisura(m), { misId: m.id }); return;
  }

  /* ---------- azioni con nome ---------- */
  if (d.act) azione(d.act, b);
});

function azione(a, b) {
  const W = () => DB.items.find(i => i.id === view.id);

  if (a === 'calendario') { apriSheet(sheetCalendario(view.d), { mese: view.d.slice(0, 7) }); return; }

  if (a === 'cambia-tipo') {
    const g = giorno(view.d, true);
    g.tipo = g.tipo === 'off' ? 'turno' : 'off';
    tocca(g); haptic(); render(); return;
  }

  /* Dal riepilogo al dettaglio senza passare dai filtri: il Diario si apre
     già ristretto al giorno che stavi guardando. */
  if (a === 'vai-diario') {
    const f = filtri('cibo');
    f.per = 'custom'; f.da = view.d; f.a = view.d;
    save();
    SUB.cibo = 'diario';
    vai({ name: 'cibo', d: view.d });
    return;
  }
  if (a === 'vai-report') { vai({ name: 'report', d: view.d }); return; }
  if (a === 'stampa') { window.print(); return; }
  if (a === 'allena-vai') { apriSheet(sheetAvvioAllenamento(), {}); return; }
  if (a === 'nuova-misura') { apriSheet(sheetMisura(null), {}); return; }
  if (a === 'nuovo-alimento') {
    apriSheet(sheetNuovoAlimento($('#cercaCibo') ? $('#cercaCibo').value : '', null), {});
    return;
  }

  if (a === 'passi') { apriSheet(sheetPassi(view.d), { d: view.d }); return; }
  if (a === 'salva-passi') {
    const g = giorno(sheetCtx.d || view.d, true);
    g.passi = Math.max(0, r0(num($('#passiVal').value)));
    tocca(g); chiudiSheet(); render(); return;
  }

  if (a === 'conferma-cibo') {
    const q = num(sheetCtx.q);
    if (q <= 0) { toast('Metti una quantità'); return; }
    const slot = $('#slotSel') ? $('#slotSel').value : sheetCtx.slot;
    const al = sheetCtx.alim;
    const riga = { slot, n: al.n, q, k: al.k, p: al.p, c: al.c, g: al.g };

    if (sheetCtx.piano) {
      const p = piano(sheetCtx.piano, true);
      p.righe = p.righe || [];
      if (sheetCtx.pIdx != null) p.righe[sheetCtx.pIdx] = riga; else p.righe.push(riga);
      tocca(p);
    } else if (sheetCtx.rigaId) {
      const r = DB.items.find(i => i.id === sheetCtx.rigaId);
      r.q = q; r.slot = slot; tocca(r);
    } else {
      aggiungi(Object.assign({ t: 'l', d: (view.name === 'oggi' ? view.d : oggiISO()) }, riga));
    }
    chiudiSheet(); haptic(); render(); return;
  }
  if (a === 'elimina-riga') {
    if (sheetCtx.piano) {
      const p = piano(sheetCtx.piano, true);
      p.righe.splice(sheetCtx.pIdx, 1); tocca(p);
    } else {
      elimina(sheetCtx.rigaId);
    }
    chiudiSheet(); render(); return;
  }

  if (a === 'salva-misura') {
    const d = $('#misD').value || oggiISO();
    const peso = num($('#misP').value), giro = num($('#misG').value), mg = num($('#misMg').value);
    if (!peso && !giro && !mg) { toast('Metti almeno un valore'); return; }
    if (sheetCtx.misId) {
      const m = DB.items.find(i => i.id === sheetCtx.misId);
      m.d = d; m.peso = peso; m.giro = giro; m.mg = mg; tocca(m);
    } else {
      aggiungi({ t: 'm', d, peso, giro, mg });
    }
    chiudiSheet(); toast('Misura salvata'); render(); return;
  }
  if (a === 'elimina-misura') { elimina(sheetCtx.misId); chiudiSheet(); render(); return; }

  if (a === 'salva-alimento') {
    const n = $('#alN').value.trim();
    if (!n) { toast('Serve un nome'); return; }
    const dati = {
      n, k: num($('#alK').value), p: num($('#alP').value), c: num($('#alC').value),
      g: num($('#alG').value), cat: $('#alCat').value, nt: $('#alNt').value.trim()
    };
    // il codice resta attaccato all'alimento: la prossima scansione lo trova
    // qui e non serve più la rete
    if (sheetCtx.ean) dati.ean = sheetCtx.ean;
    if (sheetCtx.alimId) {
      const it = DB.items.find(i => i.id === sheetCtx.alimId);
      Object.assign(it, dati); tocca(it);
    } else {
      aggiungi(Object.assign({ t: 'a' }, dati));
    }
    chiudiSheet(); toast('Alimento salvato'); render(); return;
  }
  if (a === 'elimina-alimento') { elimina(sheetCtx.alimId); chiudiSheet(); render(); return; }

  if (a === 'salva-ricetta') {
    if (!righeDi(view.d).length) return;
    apriSheet(sheetRicetta(view.d), { d: view.d });
    return;
  }
  if (a === 'salva-ricetta-ok') {
    const d = sheetCtx.d || view.d;
    const nome = $('#ricNome').value.trim();
    if (!nome) { toast('Serve un nome'); return; }
    aggiungi({
      t: 'r', n: nome,
      righe: righeDi(d).map(r => ({ n: r.n, q: r.q, k: r.k, p: r.p, c: r.c, g: r.g, slot: r.slot }))
    });
    chiudiSheet();
    toast('Salvata: la ritrovi quando aggiungi un alimento');
    return;
  }

  if (a === 'add-giorno') {
    const s = W();
    s.giorni = s.giorni || [];
    s.giorni.push({ n: 'Giorno ' + (s.giorni.length + 1), eser: [] });
    view.gi = s.giorni.length - 1;
    tocca(s); render(); return;
  }

  if (a === 'piega-piano') {
    DB.settings.pianoAperto = DB.settings.pianoAperto === false;
    save(); render(); return;
  }
  if (a === 'vai-piano') { SUB.cibo = 'piano'; SUB.gs = gsDiData(view.d || oggiISO()); vai({ name: 'cibo' }); return; }

  if (a === 'copia-piano') {
    const qui = SUB.gs;
    const altri = GIORNI_SETT.filter(g => g.id !== qui && pianoPieno(g.id));
    if (!altri.length) { toast('Nessun altro giorno ha un piano da copiare'); return; }
    apriSheet(`<h2 class="sheet-title">Copia il piano da…</h2>
      ${altri.map(g => {
        const p = piano(g.id), t = somma(p.righe || []);
        return `<button class="sheet-row" data-copiada="${g.id}">
          <span class="ic">📋</span>
          <span>${esc(g.l)}${p.nome ? ' · ' + esc(p.nome) : ''}
            <span class="hint">${p.righe.length} voci · ${r0(t.k)} kcal</span></span></button>`;
      }).join('')}
      <p class="set-note">Sostituisce quello che c'è ora in
        ${esc(GIORNI_SETT.find(g => g.id === qui).l)}.</p>`, {});
    return;
  }

  if (a === 'svuota-piano') {
    const g = GIORNI_SETT.find(x => x.id === SUB.gs);
    if (!confirm('Svuoto il piano di ' + g.l + '? Il diario già registrato non cambia.')) return;
    const p = piano(SUB.gs, true);
    p.righe = []; p.nome = '';
    tocca(p); render(); return;
  }

  if (a === 'scansiona') { avviaScansione(); return; }
  if (a === 'cerca-ean') {
    const c = ($('#eanVal').value || '').replace(/\D/g, '');
    if (c.length < 8) { toast('Servono almeno otto cifre'); return; }
    gestisciCodice(c); return;
  }
  if (a === 'salva-prodotto') {
    const p = sheetCtx.prodotto;
    const it = aggiungi({ t: 'a', n: p.n, k: p.k, p: p.p, c: p.c, g: p.g, cat: p.cat, nt: p.nt, ean: p.ean });
    sheetCtx = Object.assign({}, sheetCtx, { alim: it, q: '', slot: sheetCtx.slot || slotOra(), rigaId: null, pIdx: null });
    $('#sheetContent').innerHTML = sheetQuantita();
    toast('Salvato fra i tuoi alimenti');
    return;
  }
  if (a === 'correggi-prodotto') {
    const p = sheetCtx.prodotto;
    apriSheet(sheetNuovoAlimento('', p), { ean: p.ean, slot: sheetCtx.slot });
    return;
  }
  if (a === 'importa-piano') { scegliFile('piano'); return; }
  if (a === 'importa-scheda') { scegliFile('scheda'); return; }
  if (a === 'conferma-piano') { confermaPiano(); return; }
  if (a === 'conferma-scheda') { confermaScheda(); return; }
  if (a === 'del-scheda') {
    if (!confirm('Eliminare la scheda? Le sessioni già svolte restano.')) return;
    elimina(view.id); history.back(); return;
  }
  if (a === 'add-eser-sess') { apriSheet(sheetEsercizio(), { dove: 'sessione' }); return; }
  if (a === 'chiudi-sess') {
    const w = W(); w.fine = true; tocca(w); fermaRecupero(); toast('Allenamento chiuso'); render(); return;
  }
  if (a === 'riapri-sess') { const w = W(); w.fine = false; tocca(w); render(); return; }
  if (a === 'del-sess') {
    if (!confirm('Eliminare questa sessione?')) return;
    elimina(view.id); history.back(); return;
  }

  if (a === 'backup') {
    scarica('forma-backup-' + oggiISO() + '.json',
      JSON.stringify({ v: 1, app: 'forma', versione: APP_VERSION, items: DB.items, settings: DB.settings }, null, 1),
      'application/json');
    return;
  }
  if (a === 'ripristina') {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const dati = JSON.parse(rd.result);
          if (!Array.isArray(dati.items)) throw new Error('formato');
          if (!confirm('Sostituisco i dati di questo dispositivo con le ' + dati.items.length +
            ' voci del backup?')) return;
          DB.items = dati.items;
          DB.settings = Object.assign(DB.settings, dati.settings || {});
          scadeCatalogo();
          /* Tutto va rimandato al server: dal suo punto di vista è roba nuova. */
          DB.dirty = {};
          for (const i of DB.items) DB.dirty[i.id] = 1;
          DB.sync.cursor = '';
          save(true); toast('Backup ripristinato'); render();
        } catch (err) { toast('Il file non è un backup di Forma'); }
      };
      rd.readAsText(f);
    };
    inp.click();
    return;
  }
  if (a === 'azzera') {
    if (!confirm('Cancella diario, allenamenti, misure e bersagli da QUESTO dispositivo. Procedo?')) return;
    if (!confirm('Sicuro? Senza un backup non si torna indietro.')) return;
    localStorage.removeItem(KEY);
    location.reload();
    return;
  }
}

/* ---------- il pulsante rotondo ---------- */
function fab() {
  if (view.name === 'oggi') { apriSheet(sheetCerca(slotOra(), ''), { slot: slotOra() }); return; }
  if (view.name === 'cibo') {
    if (SUB.cibo === 'alimenti') apriSheet(sheetNuovoAlimento('', null), {});
    else apriSheet(sheetCerca(slotOra(), ''), { slot: slotOra() });
    return;
  }
  if (view.name === 'allena') {
    if (SUB.allena === 'schede') {
      const s = aggiungi({ t: 's', n: 'Nuova scheda', giorni: [{ n: 'Giornata 1', eser: [] }] });
      vai({ name: 'scheda', id: s.id });
    } else {
      apriSheet(sheetAvvioAllenamento(), {});
    }
    return;
  }
}

/* ---------- avvio di un allenamento ---------- */
/* Nella scheda le ripetizioni si scrivono come le scrive un preparatore:
   "8–10", "12-15", "Max tecn.". Nella sessione servono in un campo numerico, e
   il numero giusto da proporre è il minimo dell'intervallo: è quello che devi
   garantire, il resto è guadagnato. */
function ripNumero(rip) {
  const m = /(\d+)/.exec(String(rip == null ? '' : rip));
  return m ? +m[1] : '';
}

function avviaAllenamento(sid, gn) {
  const s = sid ? DB.items.find(i => i.id === sid) : null;
  const g = s ? (s.giorni || []).find(x => x.n === gn) : null;
  const eser = (g ? g.eser : []).map(e => ({
    n: e.n, gruppo: e.gruppo || gruppoDi(e.n), rip: e.rip, peso: e.peso, rec: e.rec,
    cardio: isCardio(e), note: e.note,
    min: isCardio(e) ? (ripNumero(e.rip) || '') : undefined, km: isCardio(e) ? '' : undefined,
    sets: isCardio(e) ? [] : Array.from({ length: num(e.serie, 3) },
      () => ({ r: ripNumero(e.rip), w: e.peso || '', ok: false }))
  }));
  const w = aggiungi({
    t: 'w', d: oggiISO(), sid: sid || '', sn: s ? s.n : '', gn: gn || 'Allenamento',
    eser, fine: false, inizio: Date.now()
  });
  chiudiSheet();
  vai({ name: 'sessione', id: w.id });
}

/* ---------- esercizio scelto dal pannello ---------- */
function scegliEsercizio(nome) {
  const gruppo = gruppoDi(nome);
  const cardio = GRUPPI_CARDIO.includes(gruppo);
  if (sheetCtx.dove === 'scheda') {
    const s = DB.items.find(i => i.id === view.id);
    const g = s.giorni[sheetCtx.gi];
    g.eser = g.eser || [];
    g.eser.push(cardio
      ? { n: nome, gruppo, cardio: true, min: 30, km: '' }
      : { n: nome, gruppo, serie: 3, rip: 10, peso: '', rec: DB.settings.recDefault });
    tocca(s);
  } else {
    const w = DB.items.find(i => i.id === view.id);
    w.eser = w.eser || [];
    w.eser.push(cardio
      ? { n: nome, gruppo, cardio: true, min: '', km: '', sets: [] }
      : { n: nome, gruppo, rip: 10, peso: '', rec: DB.settings.recDefault, sets: [{ r: '', w: '', ok: false }, { r: '', w: '', ok: false }, { r: '', w: '', ok: false }] });
    tocca(w);
  }
  chiudiSheet();
  render();
}

/* ============================================================
   Importazione di un piano o di una scheda da file
   ============================================================ */

function scegliFile(tipo) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xlsm,.csv,.txt';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    toast('Leggo ' + f.name + '…');
    try {
      if (tipo === 'piano') {
        const g = await Importa.leggiPiano(f);
        if (!g.length) throw new Error('Nel file non ho trovato colonne Alimento e Quantità');
        apriSheet(sheetMappaPiano(g), { giornate: g });
      } else {
        const g = await Importa.leggiScheda(f);
        if (!g.length) throw new Error('Nel file non ho trovato colonne Esercizio, Serie e Rip.');
        apriSheet(sheetMappaScheda(g, f.name), {
          giorni: g,
          nomeScheda: f.name.replace(/\.(xlsx|xlsm|csv|txt)$/i, '').replace(/[_-]+/g, ' ').trim()
        });
      }
    } catch (e) {
      toast(String(e.message || e).slice(0, 120));
    }
  };
  inp.click();
}

/* I nomi non coincidono mai alla lettera fra un file e un database: "Tonno al
   naturale sgocciolato" contro "tonno naturale". Si confronta una forma
   ridotta — minuscole, senza accenti, senza punteggiatura — e in seconda
   battuta si accetta che uno contenga l'altro. */
const nomeRidotto = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function indiceAlimenti() {
  const ix = {};
  for (const a of catalogo()) ix[nomeRidotto(a.n)] = a;
  return ix;
}

function trovaAlimento(nome, ix) {
  const k = nomeRidotto(nome);
  if (!k) return null;
  if (ix[k]) return ix[k];

  /* Con quasi mille voci il primo che "contiene" non basta più: "riso"
     pescherebbe un qualunque risotto. Si preferisce chi comincia allo stesso
     modo, e fra i candidati il nome più corto — cioè il meno specifico, che è
     quasi sempre quello giusto quando il piano scrive solo "Riso basmati". */
  const chiavi = Object.keys(ix);
  const inizia = chiavi.filter(c => c.startsWith(k) || k.startsWith(c));
  if (inizia.length) return ix[inizia.sort((a, b) => a.length - b.length)[0]];

  const dentro = chiavi.filter(c => c.includes(k) || k.includes(c));
  if (!dentro.length) return null;
  return ix[dentro.sort((a, b) => a.length - b.length)[0]];
}

/* ---------- piano: quale giornata in quale giorno ---------- */

function sheetMappaPiano(giornate) {
  /* Se una giornata si chiama come un giorno della settimana finisce lì da
     sola; altrimenti si distribuiscono in ordine, che è comunque un punto di
     partenza migliore di sette caselle vuote. */
  const scelte = {};
  GIORNI_SETT.forEach((g, i) => {
    const perNome = giornate.findIndex(x => nomeRidotto(x.nome).startsWith(nomeRidotto(g.l).slice(0, 5)));
    scelte[g.id] = perNome >= 0 ? perNome : (giornate.length ? i % giornate.length : -1);
  });

  return `<h2 class="sheet-title">Trovate ${giornate.length} giornate</h2>
    <p class="set-note" style="margin:0 0 12px">Assegna ogni giornata al giorno della
      settimana in cui la mangi. Puoi mettere la stessa giornata su più giorni, e
      lasciare "—" dove non vuoi un piano.</p>
    ${GIORNI_SETT.map(g => `<div class="field sel">
      <label>${esc(g.l)}</label>
      <select id="map-${g.id}">
        <option value="-1">—</option>
        ${giornate.map((x, i) => {
          const t = x.righe.reduce((a, r) => a + r.q, 0);
          return `<option value="${i}" ${scelte[g.id] === i ? 'selected' : ''}>${esc(x.nome)} (${x.righe.length} voci)</option>`;
        }).join('')}
      </select></div>`).join('')}
    <button class="btn" data-act="conferma-piano">Importa</button>`;
}

function confermaPiano() {
  const giornate = sheetCtx.giornate || [];
  const ix = indiceAlimenti();
  const mancanti = new Set();
  let quanti = 0;

  for (const g of GIORNI_SETT) {
    const sel = $('#map-' + g.id);
    const i = sel ? +sel.value : -1;
    if (i < 0 || !giornate[i]) continue;
    const righe = [];
    for (const r of giornate[i].righe) {
      const a = trovaAlimento(r.n, ix);
      if (!a) { mancanti.add(r.n); continue; }
      righe.push({ slot: r.slot, n: a.n, q: r.q, k: a.k, p: a.p, c: a.c, g: a.g });
    }
    const p = piano(g.id, true);
    p.righe = righe;
    p.nome = giornate[i].nome;
    tocca(p);
    quanti++;
  }

  chiudiSheet();
  SUB.cibo = 'piano';
  vai({ name: 'cibo' });

  if (mancanti.size) {
    setTimeout(() => apriSheet(sheetMancanti(Array.from(mancanti))), 250);
  } else {
    toast('Piano importato su ' + quanti + ' giorni');
  }
}

function sheetMancanti(nomi) {
  return `<h2 class="sheet-title">${nomi.length} alimenti non riconosciuti</h2>
    <p class="set-note" style="margin:0 0 12px">Questi nomi non esistono nel database, quindi
      quelle righe non sono state importate. Creali e reimporta il file: il resto del piano
      è già a posto.</p>
    ${nomi.map(n => `<button class="sheet-row" data-creaal="${esc(n)}">
      <span class="ic">➕</span><span>${esc(n)}</span></button>`).join('')}`;
}

/* ---------- scheda: anteprima prima di sostituire ---------- */

function sheetMappaScheda(giorni, nomeFile) {
  const totale = giorni.reduce((n, g) => n + g.eser.length, 0);
  const dentroEditor = view.name === 'scheda';
  return `<h2 class="sheet-title">Trovati ${giorni.length} giorni</h2>
    <p class="set-note" style="margin:0 0 12px">${totale} esercizi in tutto.
      ${dentroEditor
        ? 'Sostituiscono i giorni della scheda che stai modificando.'
        : 'Diventano una scheda nuova: i giorni si scelgono coi numeri in alto.'}</p>
    ${giorni.map((g, i) => `<div class="sheet-row">
      <span class="ic">${i + 1}</span>
      <span>${esc(g.nome)}<span class="hint">${g.eser.length} esercizi</span></span>
    </div>`).join('')}
    <button class="btn" data-act="conferma-scheda">${dentroEditor ? 'Sostituisci' : 'Crea la scheda'}</button>`;
}

function confermaScheda() {
  const giorni = (sheetCtx.giorni || []).map(g => ({
    n: g.nome,
    eser: g.eser.map(e => ({
      n: e.n, gruppo: e.gruppo || '', serie: e.serie, rip: e.rip,
      peso: '', rec: e.rec || DB.settings.recDefault, note: e.note || ''
    }))
  }));
  if (!giorni.length) return;

  let sc;
  if (view.name === 'scheda') {
    sc = DB.items.find(i => i.id === view.id);
    sc.giorni = giorni;
    tocca(sc);
  } else {
    sc = aggiungi({ t: 's', n: sheetCtx.nomeScheda || 'Scheda importata', giorni });
  }
  chiudiSheet();
  vai({ name: 'scheda', id: sc.id, gi: 0 });
  toast(giorni.length + ' giorni importati');
}

/* ---------- storico di un esercizio ---------- */
function sheetProgressione(nome) {
  const punti = progressione(nome);
  const sess = di('w').filter(w => (w.eser || []).some(e => e.n.toLowerCase() === nome.toLowerCase()))
    .sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 12);
  let h = `<h2 class="sheet-title">${esc(nome)}</h2>
    ${punti.length > 1 ? grafico(punti, {}) : '<p class="set-note">Servono almeno due sessioni per vedere l’andamento.</p>'}
    <div class="tablewrap" style="box-shadow:none;border:0;margin-top:10px"><table class="dt"><thead><tr>
      <th>Data</th><th>Serie svolte</th><th class="n">Volume</th></tr></thead><tbody>`;
  for (const w of sess) {
    const e = w.eser.find(x => x.n.toLowerCase() === nome.toLowerCase());
    const fatte = (e.sets || []).filter(s => s.ok);
    const vol = fatte.reduce((v, s) => v + num(s.r) * num(s.w), 0);
    h += `<tr><td>${esc(dataCorta(w.d))}</td>
      <td>${fatte.length ? fatte.map(s => s.r + '×' + s.w).join(' · ') : (e.min ? e.min + ' min' : '—')}</td>
      <td class="n">${vol ? r0(vol) + ' kg' : '—'}</td></tr>`;
  }
  return h + `</tbody></table></div>`;
}

/* ---------- campi che si modificano scrivendo ---------- */

document.addEventListener('input', e => {
  const el = e.target, d = el.dataset;

  if (el.id === 'cercaCibo') {
    clearTimeout(cercaT);
    cercaT = setTimeout(() => {
      const v = el.value;
      $('#sheetContent').innerHTML = sheetCerca(sheetCtx.slot, v);
      const n = $('#cercaCibo');
      if (n) { n.focus(); n.setSelectionRange(v.length, v.length); }
    }, 180);
    return;
  }
  if (el.id === 'cercaEser') {
    clearTimeout(cercaT);
    cercaT = setTimeout(() => {
      sheetCtx.q = el.value;
      $('#sheetContent').innerHTML = sheetEsercizio();
      const n = $('#cercaEser');
      if (n) { n.focus(); n.setSelectionRange(sheetCtx.q.length, sheetCtx.q.length); }
    }, 180);
    return;
  }

  /* Ricerca e date dei filtri: si ridisegna, ma il cursore torna dov'era. */
  if (d.f && d.set) {
    filtri(d.f)[d.set] = el.value;
    clearTimeout(cercaT);
    cercaT = setTimeout(() => { save(); renderConFuoco(); }, 220);
    return;
  }

  /* Gli altri campi NON ridisegnano: scrivere un peso mentre la pagina si
     ricostruisce sotto le dita significa perdere metà del numero. */
  if (d.cfg) {
    const [gruppo, chiave] = d.cfg.split('.');
    const c = cfg();
    c[gruppo][chiave] = num(el.value);
    tocca(c); return;
  }
  if (d.rec !== undefined) { DB.settings.recDefault = Math.max(10, r0(num(el.value, 90))); save(); return; }
  if (d.sn) { const s = DB.items.find(i => i.id === d.sn); s.n = el.value; tocca(s); return; }
  if (d.gn !== undefined) {
    const s = DB.items.find(i => i.id === view.id);
    s.giorni[num(d.gn)].n = el.value; tocca(s); return;
  }
  if (d.es) {
    const [gi, ei, campo] = d.es.split('.');
    const s = DB.items.find(i => i.id === view.id);
    // "8–10" non è un numero: passarlo da num() lo ridurrebbe a 8 mentre scrivi
    s.giorni[gi].eser[ei][campo] = (campo === 'rip' || campo === 'note') ? el.value : num(el.value);
    tocca(s); return;
  }
  if (d.pnome) {
    const p = piano(d.pnome, true);
    p.nome = el.value; tocca(p); return;
  }
  if (d.ws) {
    const parti = d.ws.split('.');
    const w = DB.items.find(i => i.id === view.id);
    if (parti.length === 2) w.eser[parti[0]][parti[1]] = num(el.value);
    else w.eser[parti[0]].sets[parti[1]][parti[2]] = el.value;
    tocca(w); return;
  }
  if (d.wnote !== undefined) {
    const w = DB.items.find(i => i.id === view.id);
    w.note = el.value; tocca(w); return;
  }
});

/* Il menu a tendina del pasto non è un "input" su tutti i browser. */
document.addEventListener('change', e => {
  if (e.target.dataset.f && e.target.dataset.set) {
    filtri(e.target.dataset.f)[e.target.dataset.set] = e.target.value;
    save(); render();
  }
});

/* ============================================================
   15. Avvio
   ============================================================ */

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#scan').hidden) { Scanner.chiudi(); return; }
  if (!$('#sheet').hidden) chiudiSheet();
});

/* Uscendo dall'app la fotocamera va spenta: lasciarla accesa in sottofondo
   consuma batteria e accende la spia senza motivo. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && typeof Scanner !== 'undefined') Scanner.chiudi();
});

window.addEventListener('popstate', e => {
  /* Con un pannello aperto, il gesto "indietro" deve chiudere quello, non
     cambiare schermata: è quello che si aspetta chi lo usa. */
  if (!$('#scan').hidden) {
    Scanner.chiudi();
    history.pushState(view, '', '');
    return;
  }
  if (!$('#sheet').hidden) {
    chiudiSheet();
    history.pushState(view, '', '');
    return;
  }
  view = e.state || { name: 'oggi', d: oggiISO() };
  render();
});

load();
history.replaceState(view, '', '');
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
