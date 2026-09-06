// Forma — promemoria push.
//
// Gira ogni pochi minuti su Supabase Edge Functions. Guarda l'agenda di ogni
// dispositivo registrato e manda una notifica per quello che sta per
// cominciare. In più, una volta al giorno, avvisa i dispositivi rimasti su una
// versione vecchia dell'app.
//
// Perché serve un pezzo di server: sul web non esiste un modo di programmare
// una notifica che suoni ad app chiusa. L'unico canale è il push, e il push
// vuole qualcuno di sveglio che lo mandi.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_APP = 'https://codemind-lab.github.io/Tracking-sportivo/app.js';

const env = (k: string, obbligatorio = true) => {
  const v = Deno.env.get(k);
  if (!v && obbligatorio) throw new Error('Manca il segreto ' + k);
  return v || '';
};

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

webpush.setVapidDetails(
  env('VAPID_SUBJECT', false) || 'mailto:nessuno@example.com',
  env('VAPID_PUBLIC'),
  env('VAPID_PRIVATE')
);

/* L'ora locale del dispositivo, non quella del server: un promemoria delle
   18:00 deve suonare alle 18:00 di casa sua. */
function localeIn(fuso: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date())) p[x.type] = x.value;
  const giorni: Record<string, string> = {
    Mon: 'lun', Tue: 'mar', Wed: 'mer', Thu: 'gio', Fri: 'ven', Sat: 'sab', Sun: 'dom'
  };
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    minuti: (+p.hour) * 60 + (+p.minute),
    gs: giorni[p.weekday] || 'lun'
  };
}

const minutiDa = (ora: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(ora || '');
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};

/* La versione pubblicata adesso, letta dall'app stessa: così non c'è nessun
   numero da aggiornare a mano da nessuna parte quando si pubblica. */
async function versionePubblicata(): Promise<string> {
  try {
    const r = await fetch(URL_APP + '?cb=' + Date.now(), { cache: 'no-store' });
    const t = await r.text();
    return (t.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
  } catch {
    return '';
  }
}

async function manda(sub: any, titolo: string, corpo: string, tag: string, url = './') {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify({ title: titolo, body: corpo, tag, url })
  );
}

Deno.serve(async () => {
  const { data: dispositivi, error } = await supabase.from('forma_push').select('*');
  if (error) return new Response('errore lettura: ' + error.message, { status: 500 });

  const viva = await versionePubblicata();
  const esiti = { dispositivi: dispositivi?.length || 0, avvisi: 0, aggiornamenti: 0, morti: 0 };

  for (const dev of dispositivi || []) {
    const ora = localeIn(dev.fuso || 'Europe/Rome');
    const inviati: string[] = Array.isArray(dev.inviati) ? dev.inviati : [];
    const nuovi: string[] = [];

    /* L'agenda di questo utente: le voci del giorno e quelle che si ripetono
       oggi. Sono righe JSON dentro forma_items, la stessa tabella che l'app
       sincronizza. */
    const { data: righe } = await supabase
      .from('forma_items')
      .select('data')
      .eq('user_id', dev.user_id)
      .eq('deleted', false);

    const voci = (righe || []).map((r: any) => r.data).filter(Boolean);
    const daFare: any[] = [];

    for (const v of voci) {
      if (v.t === 'ag' && v.d === ora.data && !v.fatto && v.ora) daFare.push(v);
      if (v.t === 'agr' && v.gs === ora.gs && v.ora &&
          !(Array.isArray(v.fatti) && v.fatti.includes(ora.data))) daFare.push(v);
    }

    for (const v of daFare) {
      const m = minutiDa(v.ora);
      if (m === null) continue;
      const manca = m - ora.minuti;
      if (manca < 0 || manca > (dev.preavviso || 15)) continue;

      const chiave = ora.data + '|' + v.id;
      if (inviati.includes(chiave)) continue;

      try {
        await manda(dev, v.n,
          manca <= 0 ? 'Comincia adesso' : `Fra ${manca} minuti · ${v.ora}`,
          chiave, './');
        nuovi.push(chiave);
        esiti.avvisi++;
      } catch (e: any) {
        /* 404 e 410 vogliono dire che quel dispositivo non esiste più: si
           cancella invece di riprovare per sempre. */
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from('forma_push').delete().eq('endpoint', dev.endpoint);
          esiti.morti++;
        }
      }
    }

    /* Il promemoria di aggiornare, una volta al giorno e solo se è davvero
       indietro. Ripeterlo a ogni giro sarebbe un modo sicuro di far
       disattivare le notifiche. */
    const chiaveAgg = ora.data + '|agg|' + viva;
    if (viva && dev.versione && dev.versione !== viva && !inviati.includes(chiaveAgg)) {
      try {
        await manda(dev, 'Forma si è aggiornata',
          `C'è la versione ${viva}, tu hai la ${dev.versione}. Apri l'app: Impostazioni → Aggiorna l'app.`,
          chiaveAgg, './');
        nuovi.push(chiaveAgg);
        esiti.aggiornamenti++;
      } catch { /* se non passa, si riprova domani */ }
    }

    if (nuovi.length) {
      /* La lista si pota: tiene solo oggi e ieri, tanto le chiavi cominciano
         con la data e più indietro non servono. */
      const ieri = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const tenuti = [...inviati, ...nuovi].filter(k => k >= ieri);
      await supabase.from('forma_push')
        .update({ inviati: tenuti, visto: new Date().toISOString() })
        .eq('endpoint', dev.endpoint);
    }
  }

  return new Response(JSON.stringify(esiti), {
    headers: { 'Content-Type': 'application/json' }
  });
});
