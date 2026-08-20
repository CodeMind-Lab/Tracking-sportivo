/* Sincronizzazione con Supabase — iPhone, iPad e Mac sugli stessi dati.
 *
 * Principio: il telefono resta la fonte di verità per l'interfaccia. Ogni modifica
 * viene salvata subito in locale e funziona offline; il server è una copia che si
 * allinea quando c'è rete. Niente librerie: solo le API REST di Supabase.
 *
 * Conflitti: vince la modifica più recente, riga per riga (non tutto il file).
 * Se spunti una serie sull'iPhone e correggi la stessa riga sul Mac prima di
 * sincronizzare, sopravvive solo la modifica fatta per ultima.
 */

'use strict';

const Sync = (() => {

  let timer = null;
  let running = false;
  let lastError = '';
  let problemaCollegamento = '';

  /* Il pannello di Supabase cambia spesso e il "Project URL" non è sempre dove
     te lo aspetti. L'unica cosa sempre a portata di mano è l'indirizzo della
     pagina del progetto, che contiene il suo codice identificativo. Qui si
     accetta qualunque forma e si ricava l'indirizzo giusto.

     Vanno bene tutti questi:
       https://abcdefghijklmnop.supabase.co
       abcdefghijklmnop.supabase.co
       https://supabase.com/dashboard/project/abcdefghijklmnop/settings/api
       abcdefghijklmnop                                                     */
  function normalizzaUrl(v) {
    v = (v || '').trim().replace(/\s/g, '');
    if (!v) return '';

    // indirizzo della dashboard: si estrae il codice del progetto
    const dash = v.match(/supabase\.(?:com|green)\/dashboard\/project\/([a-z0-9]{16,40})/i);
    if (dash) return 'https://' + dash[1].toLowerCase() + '.supabase.co';

    // indirizzo del progetto, con o senza protocollo e con o senza percorso
    const host = v.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.supabase\.(co|in)\b/i);
    if (host) return 'https://' + host[1].toLowerCase() + '.supabase.' + host[2].toLowerCase();

    // solo il codice del progetto
    if (/^[a-z0-9]{16,40}$/i.test(v)) return 'https://' + v.toLowerCase() + '.supabase.co';

    return '';
  }

  /* Prova il collegamento prima di salvarlo, invece di lasciare che l'errore
     salti fuori più tardi al momento dell'accesso, quando è molto meno chiaro
     da dove arrivi. Una sola chiamata distingue tutti i casi:
       rete muta → indirizzo inesistente
       404       → indirizzo esistente ma non è un progetto Supabase
       401/403   → chiave sbagliata
       200       → tutto a posto                                            */
  /* Supabase ha due formati di chiave pubblica:
       vecchio → un JWT lunghissimo che comincia per "eyJ"
       nuovo   → "sb_publishable_…", che NON è un JWT
     Riconoscerli permette di dire subito cosa c'è che non va, senza nemmeno
     chiamare il server. */
  function formaChiave(k) {
    if (/^sb_secret_/.test(k)) return 'segreta';
    if (/^sb_publishable_/.test(k)) return 'ok';
    if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k)) return 'ok';
    if (/^eyJ/.test(k)) return 'troncata';
    return 'sconosciuta';
  }

  /* Una singola prova, riportando anche il messaggio del server: è quello che
     dice davvero cosa non va, invece di farlo indovinare a noi. */
  async function provaChiave(url, anon, conBearer) {
    const headers = { apikey: anon };
    if (conBearer) headers.Authorization = 'Bearer ' + anon;
    const percorso = '/rest/v1/forma_items?select=id&limit=1';
    try {
      // Si interroga la tabella vera, non la radice /rest/v1/: quella elenca la
      // struttura del database e Supabase la riserva alla chiave segreta, quindi
      // rifiuterebbe una chiave pubblica perfettamente valida
      // ("Secret API key required"). Così invece si verifica in un colpo solo
      // che la chiave funzioni e che il database sia stato preparato.
      const r = await fetch(url + percorso, { headers });
      let dettaglio = '';
      if (!r.ok) {
        const testo = await r.text().catch(() => '');
        try {
          const j = JSON.parse(testo);
          dettaglio = j.message || j.msg || j.error_description || j.error || j.hint || '';
        } catch (e) {
          dettaglio = testo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        dettaglio = dettaglio.slice(0, 120);
      }
      return { ok: r.ok, stato: r.status, dettaglio, percorso };
    } catch (e) {
      return { ok: false, stato: 0, dettaglio: '', percorso };
    }
  }

  async function verificaCollegamento(url, anon) {
    switch (formaChiave(anon)) {
      case 'segreta':
        return 'Questa è la chiave segreta (service_role): non va mai messa in un’app ' +
               'che gira sul telefono. Serve quella pubblica.';
      case 'troncata':
        return 'La chiave sembra incompleta: è stata copiata solo in parte. Ricopiala tutta.';
      case 'sconosciuta':
        return 'Non sembra una chiave Supabase: deve iniziare per “sb_publishable_” oppure per “eyJ”.';
    }

    // Le due convenzioni esistenti: le chiavi nuove vogliono solo "apikey",
    // quelle vecchie (JWT) vengono spesso inviate anche come "Bearer". Si
    // provano entrambe invece di scommettere su quale usi il tuo progetto.
    let esito = await provaChiave(url, anon, false);
    if (!esito.ok && (esito.stato === 401 || esito.stato === 403)) {
      const alt = await provaChiave(url, anon, true);
      if (alt.ok) esito = alt;
    }

    if (esito.ok) return '';

    if (esito.stato === 0) {
      return 'Non raggiungo quell’indirizzo: controlla il codice del progetto.';
    }
    if (esito.stato === 404) {
      // Un 404 che parla della tabella significa che indirizzo e chiave vanno
      // bene, ma il database non è ancora stato preparato.
      if (/forma_items|relation|table|schema cache|PGRST/i.test(esito.dettaglio)) {
        return 'Indirizzo e chiave sono giusti, ma nel database manca la tabella. ' +
               'Su Supabase apri SQL Editor → New query, incolla tutto il contenuto del file ' +
               'supabase-setup.sql e premi Run.';
      }
      return 'Quell’indirizzo esiste ma non è un progetto Supabase. Serve ' +
             'https://xxxx.supabase.co, non la pagina della dashboard.';
    }
    // Versione e percorso interrogato rendono il messaggio autosufficiente:
    // dicono se il dispositivo sta usando i file aggiornati e a quale porta ha
    // bussato, senza doverlo dedurre.
    const traccia = ' [v' + APP_VERSION + ' · ' + esito.percorso + ']';

    if (esito.stato === 401 || esito.stato === 403) {
      return 'Il progetto rifiuta la chiave' +
             (esito.dettaglio ? ' — risposta del server: “' + esito.dettaglio + '”' : '') +
             '. Controlla in Supabase → Project Settings → API Keys che la chiave publishable ' +
             'sia attiva, e in Settings → Data API che l’API sia abilitata.' + traccia;
    }
    return 'Il progetto risponde con un errore ' + esito.stato +
           (esito.dettaglio ? ' — “' + esito.dettaglio + '”' : '') +
           '. Se è in pausa, riattivalo dalla dashboard di Supabase.' + traccia;
  }

  const cfg = () => DB.sync;
  const configured = () => !!(cfg().url && cfg().anon);
  const signedIn = () => configured() && !!cfg().refresh;
  const api = p => cfg().url.replace(/\/+$/, '') + p;

  /* ---------- sessione ---------- */

  function setSession(s, email) {
    const c = cfg();
    c.access = s.access_token;
    c.refresh = s.refresh_token;
    c.expires = Date.now() + (s.expires_in || 3600) * 1000;
    if (email) c.email = email;
    save(true);
  }

  async function authPost(path, body) {
    const r = await fetch(api(path), {
      method: 'POST',
      headers: { apikey: cfg().anon, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(d.msg || d.error_description || d.message || d.error || 'HTTP ' + r.status);
    }
    return d;
  }

  /* Dopo ogni accesso si riparte da zero: si riscarica tutto dal server e si
     ripropone tutto ciò che c'è qui. Serve perché entrando con un account
     diverso le righe locali risulterebbero "già inviate" e resterebbero
     prigioniere di questo dispositivo, invisibili sugli altri. Costa un giro
     completo una volta sola, ed evita di perdere i dati senza accorgersene. */
  function preparaRiallineamento() {
    cfg().cursor = '';
    for (const i of DB.items) DB.dirty[i.id] = 1;
    save(true);
  }

  async function signIn(email, password) {
    const d = await authPost('/auth/v1/token?grant_type=password', { email, password });
    setSession(d, email);
    preparaRiallineamento();
  }

  async function signUp(email, password) {
    const d = await authPost('/auth/v1/signup', { email, password });
    const s = d.access_token ? d : d.session;
    // Se su Supabase è attiva la conferma via email non arriva nessuna sessione.
    if (!s || !s.access_token) throw new Error('CONFIRM');
    setSession(s, email);
    preparaRiallineamento();
  }

  async function refreshSession() {
    const c = cfg();
    try {
      const d = await authPost('/auth/v1/token?grant_type=refresh_token', { refresh_token: c.refresh });
      setSession(d);
    } catch (e) {
      // Il refresh token non vale più: si torna alla schermata di accesso
      // senza toccare i dati locali.
      c.access = ''; c.refresh = ''; c.expires = 0;
      save(true);
      throw new Error('SESSIONE');
    }
  }

  function signOut() {
    const c = cfg();
    c.access = ''; c.refresh = ''; c.expires = 0; c.cursor = ''; c.at = 0;
    save(true);
  }

  /* ---------- chiamate ai dati ---------- */

  async function rest(path, opts) {
    opts = opts || {};
    if (Date.now() > cfg().expires - 60000) await refreshSession();

    const send = () => fetch(api('/rest/v1' + path), Object.assign({}, opts, {
      headers: Object.assign({
        apikey: cfg().anon,
        Authorization: 'Bearer ' + cfg().access,
        'Content-Type': 'application/json'
      }, opts.headers || {})
    }));

    let r = await send();
    if (r.status === 401) { await refreshSession(); r = await send(); }
    if (!r.ok) {
      const txt = (await r.text().catch(() => '')).slice(0, 140);
      throw new Error('HTTP ' + r.status + (txt ? ' — ' + txt : ''));
    }
    return r;
  }

  /* Scarica solo ciò che è cambiato dopo l'ultimo giro (cursore sul tempo del
     server, non del dispositivo: gli orologi dei tre apparecchi non coincidono). */
  async function pull() {
    let cursor = cfg().cursor;
    const rows = [];
    let page;
    do {
      let url = '/forma_items?select=id,data,deleted,updated_at&order=updated_at.asc&limit=1000';
      if (cursor) url += '&updated_at=gt.' + encodeURIComponent(cursor);
      page = await (await rest(url)).json();
      rows.push(...page);
      if (page.length) cursor = page[page.length - 1].updated_at;
    } while (page.length === 1000);
    return { rows, cursor };
  }

  function merge(rows) {
    let n = 0;
    for (const r of rows) {
      const idx = DB.items.findIndex(i => i.id === r.id);
      const local = idx >= 0 ? DB.items[idx] : null;
      const remoteAt = (r.data && r.data.updatedAt) || 0;

      if (r.deleted) {
        // Cancellato altrove. Se qui è stato modificato dopo, la modifica vince
        // e verrà ricaricato al prossimo invio.
        if (local && !(DB.dirty[r.id] && (local.updatedAt || 0) > remoteAt)) {
          DB.items.splice(idx, 1);
          n++;
        }
        delete DB.graves[r.id];
        continue;
      }

      if (!local) {
        // Non farlo resuscitare se è stato cancellato qui più di recente.
        if (DB.graves[r.id] && DB.graves[r.id] > remoteAt) continue;
        DB.items.push(r.data);
        n++;
      } else if (remoteAt > (local.updatedAt || 0)) {
        DB.items[idx] = r.data;
        delete DB.dirty[r.id];
        n++;
      }
    }
    return n;
  }

  async function push() {
    const rows = [];
    for (const id of Object.keys(DB.dirty)) {
      const it = DB.items.find(i => i.id === id);
      if (it) rows.push({ id, data: it, deleted: false, client_updated_at: it.updatedAt || 0 });
    }
    for (const id of Object.keys(DB.graves)) {
      rows.push({ id, data: {}, deleted: true, client_updated_at: DB.graves[id] });
    }
    if (!rows.length) return 0;

    for (let i = 0; i < rows.length; i += 200) {
      await rest('/forma_items', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(i, i + 200))
      });
    }
    for (const r of rows) {
      delete DB.dirty[r.id];
      if (r.deleted) delete DB.graves[r.id];
    }
    return rows.length;
  }

  /* ---------- giro completo ---------- */

  /* Una sincronia in sottofondo non deve ridisegnare la pagina mentre stai
     scrivendo: perderesti il testo a metà e il cursore. */
  function repaint() {
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    render();
  }

  async function run(manual) {
    if (running || !signedIn()) return;
    if (!navigator.onLine) { if (manual) toast('Sei offline: sincronizzo appena torna la rete'); return; }

    running = true;
    if (view.name === 'settings') repaint();
    try {
      // Prima scaricare, poi inviare. L'ordine inverso farebbe vincere sempre
      // la modifica locale: l'invio sovrascrive la riga sul server senza
      // guardare le date, e il confronto "chi è più recente" non avverrebbe mai.
      const { rows, cursor } = await pull();
      const n = merge(rows);
      await push();
      if (cursor) cfg().cursor = cursor;
      cfg().at = Date.now();
      lastError = '';
      save(true);
      if (manual) toast(n ? `Aggiornate ${n} voci` : 'Tutto già allineato');
      running = false;
      if (n || manual || view.name === 'settings') repaint();
    } catch (e) {
      lastError = e.message === 'SESSIONE' ? 'sessione scaduta, riaccedi' : e.message;
      running = false;
      if (manual) toast('Sincronia non riuscita');
      if (view.name === 'settings') repaint();
    }
  }

  function schedule() {
    if (!signedIn()) return;
    clearTimeout(timer);
    timer = setTimeout(() => run(false), 4000);
  }

  /* ---------- pannello nelle impostazioni ---------- */

  function panel() {
    const c = cfg();
    let h = `<div class="panel"><div class="label">Sincronizzazione</div>`;

    if (!configured()) {
      h += `<p class="set-note" style="margin:0 0 11px">Collega il tuo progetto Supabase per ritrovare
        gli stessi dati su iPhone, iPad e Mac.</p>
        <input class="txtin" id="syncUrl" inputmode="url" autocapitalize="off" spellcheck="false"
          placeholder="indirizzo del progetto Supabase" value="${esc(c.url)}" style="margin-bottom:5px">
        <p class="set-note" style="margin:0 0 11px">Se non trovi il “Project URL”, incolla qui
          <b>l’indirizzo della pagina del progetto</b> — quello che vedi nella barra del browser
          mentre sei dentro Supabase. Va bene anche solo il codice del progetto.</p>
        <input class="txtin" id="syncAnon" autocapitalize="off" spellcheck="false"
          placeholder="chiave pubblica del progetto" value="${esc(c.anon)}" style="margin-bottom:5px">
        <p class="set-note" style="margin:0 0 11px">In Supabase è indicata come
          <b>anon public</b> oppure <b>Publishable key</b>: sono la stessa cosa.</p>
        ${problemaCollegamento
          ? `<p class="set-note" style="color:var(--danger);margin:0 0 4px">${esc(problemaCollegamento)}</p>`
          : ''}
        <button class="btn" id="syncSave">Collega</button>`;

    } else if (!signedIn()) {
      // L'indirizzo va mostrato: se è sbagliato, è qui che si nota.
      h += `<div class="stat-row" style="border:0;padding-top:0"><span>Progetto</span>
          <span style="font-size:11.5px;word-break:break-all;text-align:right">${esc(c.url)}</span></div>
        <p class="set-note" style="margin:0 0 11px">Usa la stessa email su tutti i dispositivi.</p>
        <input class="txtin" id="syncEmail" type="email" autocomplete="username" autocapitalize="off"
          spellcheck="false" placeholder="email" value="${esc(c.email)}" style="margin-bottom:9px">
        <input class="txtin" id="syncPass" type="password" autocomplete="current-password" placeholder="password">
        <button class="btn" id="syncIn">Accedi</button>
        <button class="btn sec" id="syncUp">Crea account</button>
        <button class="btn sec" id="syncReset" style="color:var(--txt-dim)">Cambia progetto Supabase</button>`;

    } else {
      const pending = Object.keys(DB.dirty).length + Object.keys(DB.graves).length;
      const when = c.at
        ? new Date(c.at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'mai';
      h += `<div class="stat-row"><span>Account</span><span>${esc(c.email)}</span></div>
        <div class="stat-row"><span>Ultima sincronia</span><span>${running ? 'in corso…' : esc(when)}</span></div>
        <div class="stat-row"><span>Modifiche da inviare</span><span>${pending}</span></div>
        ${lastError ? `<p class="set-note" style="color:var(--danger)">Ultimo errore: ${esc(lastError)}</p>` : ''}
        <button class="btn" id="syncNow">${running ? 'Sincronizzo…' : 'Sincronizza ora'}</button>
        <button class="btn sec" id="syncOut">Esci da questo dispositivo</button>`;
    }
    return h + `</div>`;
  }

  /* ---------- comandi ---------- */

  function authError(e) {
    if (e.message === 'CONFIRM') {
      return 'Account creato. Su Supabase disattiva "Confirm email" (Authentication → Sign In / Providers → Email), poi accedi.';
    }
    if (/Invalid login/i.test(e.message)) return 'Email o password non corrispondono';
    if (/already registered/i.test(e.message)) return 'Email già registrata: usa Accedi';
    if (/Password should be/i.test(e.message)) return 'Password troppo corta (minimo 6 caratteri)';
    if (/Failed to fetch/i.test(e.message)) return 'Non raggiungo Supabase: controlla l’indirizzo del progetto';
    if (/HTTP 404/.test(e.message)) {
      return 'Indirizzo sbagliato: punta a una pagina che non è il tuo progetto. ' +
             'Premi “Cambia progetto Supabase” e reinseriscilo.';
    }
    return e.message.slice(0, 90);
  }

  document.addEventListener('click', async e => {
    const id = e.target.id;
    if (!id || !id.startsWith('sync')) return;

    if (id === 'syncSave') {
      const url = normalizzaUrl($('#syncUrl').value);
      const anon = $('#syncAnon').value.trim();
      problemaCollegamento = '';
      if (!url) {
        problemaCollegamento = 'Indirizzo non riconosciuto. Incolla l’indirizzo del progetto, ' +
          'oppure quello della pagina di Supabase su cui ti trovi.';
        render(); return;
      }
      if (!anon) { problemaCollegamento = 'Manca la chiave pubblica del progetto.'; render(); return; }

      e.target.textContent = 'Verifico…';
      problemaCollegamento = await verificaCollegamento(url, anon);
      if (problemaCollegamento) { render(); return; }

      cfg().url = url; cfg().anon = anon;
      save(true);
      toast('Progetto collegato');
      render();
      return;
    }

    if (id === 'syncReset') {
      cfg().url = ''; cfg().anon = '';
      problemaCollegamento = '';
      save(true); render();
      return;
    }

    if (id === 'syncIn' || id === 'syncUp') {
      const email = $('#syncEmail').value.trim();
      const pass = $('#syncPass').value;
      if (!email || !pass) { toast('Servono email e password'); return; }
      e.target.textContent = 'Attendi…';
      try {
        if (id === 'syncUp') await signUp(email, pass); else await signIn(email, pass);
        toast('Collegato');
        render();
        run(true);
      } catch (err) {
        toast(authError(err));
        render();
      }
      return;
    }

    if (id === 'syncNow') { run(true); return; }

    if (id === 'syncOut') {
      signOut();
      toast('Uscito: i dati restano su questo dispositivo');
      render();
      return;
    }
  });

  /* ---------- avvio e occasioni di risincronia ---------- */

  function init() {
    if (signedIn()) run(false);
    window.addEventListener('online', () => run(false));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) run(false);
    });
  }

  return { init, schedule, panel, run, signedIn, configured };
})();

Sync.init();
