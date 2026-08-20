/* Lettura di un piano alimentare da file.
 *
 * Due formati:
 *   .xlsx  un foglio per giornata, con le colonne Pasto / Ora / Alimento / Quantità
 *          (la forma tipica dei piani alimentari fatti in Excel)
 *   .csv   quattro colonne: giorno; pasto; alimento; grammi
 *
 * Niente librerie: un .xlsx è uno ZIP di file XML, e il browser sa già fare
 * entrambe le cose — DecompressionStream per scompattare, DOMParser per
 * leggere. Aggiungere SheetJS costerebbe mezzo megabyte da scaricare la prima
 * volta, su una funzione che userai tre volte in un anno.
 */

'use strict';

const Importa = (() => {

  /* ---------- ZIP ---------- */

  /* Si legge la coda del file (End Of Central Directory), da lì l'indice, e
     dall'indice la posizione di ogni file dentro l'archivio. */
  function apriZip(buf) {
    const dv = new DataView(buf);
    let eocd = -1;
    const minimo = Math.max(0, buf.byteLength - 66000);
    for (let i = buf.byteLength - 22; i >= minimo; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Non sembra un file .xlsx');

    const quanti = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const indice = {};
    for (let i = 0; i < quanti; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(off + 10, true);
      const dim = dv.getUint32(off + 20, true);
      const lnNome = dv.getUint16(off + 28, true);
      const lnExtra = dv.getUint16(off + 30, true);
      const lnComm = dv.getUint16(off + 32, true);
      const dove = dv.getUint32(off + 42, true);
      const nome = dec.decode(new Uint8Array(buf, off + 46, lnNome));
      indice[nome] = { metodo, dim, dove };
      off += 46 + lnNome + lnExtra + lnComm;
    }
    return { buf, dv, indice };
  }

  async function estrai(zip, nome) {
    const e = zip.indice[nome];
    if (!e) return null;
    // L'intestazione locale ripete nome ed extra, e le due lunghezze non
    // coincidono con quelle dell'indice: vanno rilette qui.
    const lnNome = zip.dv.getUint16(e.dove + 26, true);
    const lnExtra = zip.dv.getUint16(e.dove + 28, true);
    const dati = new Uint8Array(zip.buf, e.dove + 30 + lnNome + lnExtra, e.dim);
    if (e.metodo === 0) return new TextDecoder().decode(dati);
    if (e.metodo !== 8) throw new Error('Compressione non supportata nel file');
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Questo browser non sa aprire i file .xlsx: usa il formato CSV');
    }
    const flusso = new Blob([dati]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(flusso).text();
  }

  /* ---------- XLSX ---------- */

  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  function colonna(rif) {
    const m = /^([A-Z]+)/.exec(rif || '');
    if (!m) return 0;
    let n = 0;
    for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
  }

  function righeFoglio(doc, condivise) {
    const out = [];
    for (const row of doc.getElementsByTagName('row')) {
      const celle = [];
      for (const c of row.getElementsByTagName('c')) {
        const tipo = c.getAttribute('t');
        let v = '';
        if (tipo === 'inlineStr') {
          const is = c.getElementsByTagName('is')[0];
          if (is) v = is.textContent;
        } else {
          const vn = c.getElementsByTagName('v')[0];
          if (vn) v = tipo === 's' ? (condivise[+vn.textContent] || '') : vn.textContent;
        }
        celle[colonna(c.getAttribute('r'))] = v;
      }
      out.push(celle);
    }
    return out;
  }

  async function fogliDiXlsx(buf) {
    const zip = apriZip(buf);
    const px = new DOMParser();

    const condivise = [];
    const ssXml = await estrai(zip, 'xl/sharedStrings.xml');
    if (ssXml) {
      const d = px.parseFromString(ssXml, 'application/xml');
      for (const si of d.getElementsByTagName('si')) {
        let t = '';
        for (const x of si.getElementsByTagName('t')) t += x.textContent;
        condivise.push(t);
      }
    }

    const wb = px.parseFromString(await estrai(zip, 'xl/workbook.xml'), 'application/xml');
    const rels = px.parseFromString(await estrai(zip, 'xl/_rels/workbook.xml.rels'), 'application/xml');
    const dove = {};
    for (const r of rels.getElementsByTagName('Relationship')) dove[r.getAttribute('Id')] = r.getAttribute('Target');

    const fogli = [];
    for (const sh of wb.getElementsByTagName('sheet')) {
      const rid = sh.getAttributeNS(NS_R, 'id') || sh.getAttribute('r:id');
      /* Il Target può essere relativo ("worksheets/sheet1.xml") o assoluto
         rispetto al pacchetto ("/xl/worksheets/sheet1.xml"): Excel usa la prima
         forma, altri generatori la seconda. Prima si toglie la barra iniziale,
         poi si aggiunge "xl/" solo se manca — nell'ordine inverso il percorso
         assoluto diventerebbe "xl/xl/..." e il foglio non si troverebbe. */
      let bersaglio = (dove[rid] || '').replace(/^\/+/, '');
      if (!bersaglio) continue;
      if (!/^xl\//.test(bersaglio)) bersaglio = 'xl/' + bersaglio;
      const xml = await estrai(zip, bersaglio);
      if (!xml) continue;
      fogli.push({ nome: sh.getAttribute('name'), righe: righeFoglio(px.parseFromString(xml, 'application/xml'), condivise) });
    }
    return fogli;
  }

  /* ---------- dalle righe grezze a una giornata ---------- */

  const pulisci = s => String(s == null ? '' : s)
    .replace(/\s+/g, ' ').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* L'ora può essere testo ("06:45") oppure il numero con cui Excel rappresenta
     davvero le ore: una frazione di giornata. */
  function ora(v) {
    if (v == null || v === '') return null;
    const s = String(v);
    const m = /^(\d{1,2})[:.](\d{2})/.exec(s.trim());
    if (m) return +m[1];
    const n = parseFloat(s);
    if (isFinite(n) && n >= 0 && n < 1) return Math.floor(n * 24);
    return null;
  }

  function slotDa(pasto, h) {
    const p = pulisci(pasto);
    if (/colazione/.test(p)) return 'colazione';
    if (/pranzo/.test(p)) return 'pranzo';
    if (/cena/.test(p)) return 'cena';
    if (/spuntino|merenda|snack/.test(p)) {
      if (h == null) return 'spuntino2';
      if (h < 5) return 'spuntino3';       // lo spuntino delle 3 di notte
      if (h < 12) return 'spuntino1';
      if (h < 18) return 'spuntino2';
      return 'spuntino3';
    }
    if (h != null) {
      if (h < 10) return 'colazione';
      if (h < 12) return 'spuntino1';
      if (h < 15) return 'pranzo';
      if (h < 18) return 'spuntino2';
      if (h < 22) return 'cena';
      return 'spuntino3';
    }
    return 'pranzo';
  }

  /* Le colonne non stanno sempre nello stesso posto: si cerca la riga che
     contiene la parola "Alimento" e da lì si leggono le altre intestazioni. */
  function giornataDaFoglio(foglio) {
    const righe = foglio.righe;
    let hi = -1, cAl = -1, cQ = -1, cPasto = -1, cOra = -1;

    for (let i = 0; i < Math.min(righe.length, 40) && hi < 0; i++) {
      const r = righe[i] || [];
      for (let j = 0; j < r.length; j++) if (pulisci(r[j]) === 'alimento') { hi = i; cAl = j; }
      if (hi !== i) continue;
      for (let j = 0; j < r.length; j++) {
        const v = pulisci(r[j]);
        if (/^quantita/.test(v)) cQ = j;
        else if (v === 'pasto') cPasto = j;
        else if (v === 'ora') cOra = j;
      }
    }
    if (hi < 0 || cAl < 0 || cQ < 0) return null;

    const out = [];
    /* Nome e ora del pasto compaiono solo sulla prima riga del gruppo: le righe
       successive hanno quelle celle vuote. La fascia va quindi decisa una volta
       sola, all'inizio del gruppo, e portata avanti — ricalcolarla riga per riga
       manderebbe il secondo alimento di uno spuntino in un'altra fascia. */
    let slotCorrente = 'pranzo';
    for (let i = hi + 1; i < righe.length; i++) {
      const r = righe[i] || [];
      const testoPasto = cPasto >= 0 ? String(r[cPasto] || '') : '';
      if (testoPasto.trim()) {
        // "Totale colazione" chiude un gruppo, non ne apre uno nuovo
        if (/^\s*totale/i.test(testoPasto)) continue;
        slotCorrente = slotDa(testoPasto, cOra >= 0 ? ora(r[cOra]) : null);
      }
      const nome = String(r[cAl] || '').trim();
      const q = parseFloat(String(r[cQ] || '').replace(',', '.'));
      if (!nome || !isFinite(q) || q <= 0) continue;
      if (/^totale/i.test(nome)) continue;
      out.push({ slot: slotCorrente, n: nome, q });
    }
    return out.length ? { nome: foglio.nome.trim(), righe: out } : null;
  }

  /* ---------- CSV ---------- */

  function daCsv(testo) {
    const righe = testo.replace(/^﻿/, '').split(/\r?\n/).filter(r => r.trim());
    if (!righe.length) return [];
    const sep = [';', '\t', ','].map(s => [s, righe[0].split(s).length])
      .sort((a, b) => b[1] - a[1])[0][0];

    let da = 0;
    if (/giorno/i.test(righe[0]) && /aliment/i.test(righe[0])) da = 1;

    const giornate = {};
    for (let i = da; i < righe.length; i++) {
      const c = righe[i].split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
      if (c.length < 4) continue;
      const [giorno, pasto, nome, qta] = c;
      const q = parseFloat(String(qta).replace(',', '.'));
      if (!giorno || !nome || !isFinite(q) || q <= 0) continue;
      (giornate[giorno] = giornate[giorno] || []).push({ slot: slotDa(pasto, ora(pasto)), n: nome, q });
    }
    return Object.keys(giornate).map(n => ({ nome: n, righe: giornate[n] }));
  }

  /* ---------- schede di allenamento ---------- */

  /* Il rec. è scritto come 90" o 1'30". Serve in secondi. */
  function recupero(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s || /^[–—-]$/.test(s)) return null;
    const m = /^(?:(\d+)\s*['′])?\s*(\d+)?\s*["″]?$/.exec(s.replace(/\s/g, ''));
    if (!m) return null;
    const min = m[1] ? +m[1] : 0, sec = m[2] ? +m[2] : 0;
    if (!min && !sec) return null;
    return min ? min * 60 + sec : sec;
  }

  /* Un foglio di scheda ha più blocchi (riscaldamento, petto, bicipiti...),
     ognuno con la sua riga ESERCIZIO | SERIE | RIP. | REC. | NOTE. Il titolo
     del blocco è la riga singola che sta subito sopra: diventa il gruppo. */
  function schedaDaFoglio(foglio) {
    const righe = foglio.righe;
    let cN = -1, cS = -1, cR = -1, cRec = -1, cNote = -1;
    let dentro = false, sezione = '';
    const eser = [];

    for (let i = 0; i < righe.length; i++) {
      const r = righe[i] || [];
      const piene = r.filter(x => String(x || '').trim());
      const primo = pulisci(piene[0]);

      if (primo === 'esercizio') {
        dentro = true;
        cN = cS = cR = cRec = cNote = -1;
        for (let j = 0; j < r.length; j++) {
          const v = pulisci(r[j]);
          if (v === 'esercizio') cN = j;
          else if (/^serie/.test(v)) cS = j;
          else if (/^rip/.test(v)) cR = j;
          else if (/^rec/.test(v)) cRec = j;
          else if (/^note/.test(v)) cNote = j;
        }
        continue;
      }

      // una riga con una cella sola è un titolo di sezione, non un esercizio
      if (piene.length <= 1) {
        if (piene.length === 1) {
          // via frecce, emoji e spazi doppi: "▸  💪 Petto" → "Petto"
          const t = String(piene[0])
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{25B6}\u{25B8}\u{2023}\uFE0F]/gu, '')
            .replace(/\s+/g, ' ').trim();
          if (t && t.length < 60) sezione = t;
        }
        dentro = false;
        continue;
      }

      if (!dentro || cN < 0) continue;
      const nome = String(r[cN] || '').trim();
      if (!nome) continue;
      const serie = parseInt(String(r[cS] || '').replace(/\D/g, ''), 10);
      eser.push({
        n: nome,
        gruppo: sezione,
        serie: isFinite(serie) && serie > 0 ? serie : 3,
        rip: cR >= 0 ? String(r[cR] || '').trim() : '',
        rec: cRec >= 0 ? recupero(r[cRec]) : null,
        note: cNote >= 0 ? String(r[cNote] || '').trim() : ''
      });
    }
    if (!eser.length) return null;
    // via le emoji e i separatori dal nome del foglio: "🔴 G1 - Petto" → "G1 - Petto"
    const nome = foglio.nome.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').trim();
    return { nome: nome || foglio.nome, eser };
  }

  /* Una scheda in CSV: giorno; esercizio; serie; ripetizioni; recupero */
  function schedaDaCsv(testo) {
    const righe = testo.replace(/^﻿/, '').split(/\r?\n/).filter(r => r.trim());
    if (!righe.length) return [];
    const sep = [';', '\t', ','].map(s => [s, righe[0].split(s).length])
      .sort((a, b) => b[1] - a[1])[0][0];
    let da = /giorno/i.test(righe[0]) && /esercizio/i.test(righe[0]) ? 1 : 0;

    const giorni = {};
    for (let i = da; i < righe.length; i++) {
      const c = righe[i].split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
      if (c.length < 2) continue;
      const [giorno, nome, serie, rip, rec] = c;
      if (!giorno || !nome) continue;
      const s = parseInt(String(serie || '').replace(/\D/g, ''), 10);
      (giorni[giorno] = giorni[giorno] || []).push({
        n: nome, gruppo: '', serie: isFinite(s) && s > 0 ? s : 3,
        rip: rip || '', rec: recupero(rec), note: ''
      });
    }
    return Object.keys(giorni).map(n => ({ nome: n, eser: giorni[n] }));
  }

  /* ---------- ingressi ---------- */

  async function leggiPiano(file) {
    if (/\.csv$|\.txt$/i.test(file.name)) return daCsv(await file.text());
    if (/\.xlsx$|\.xlsm$/i.test(file.name)) {
      const fogli = await fogliDiXlsx(await file.arrayBuffer());
      return fogli.map(giornataDaFoglio).filter(Boolean);
    }
    throw new Error('Formato non riconosciuto: servono .xlsx o .csv');
  }

  async function leggiScheda(file) {
    if (/\.csv$|\.txt$/i.test(file.name)) return schedaDaCsv(await file.text());
    if (/\.xlsx$|\.xlsm$/i.test(file.name)) {
      const fogli = await fogliDiXlsx(await file.arrayBuffer());
      return fogli.map(schedaDaFoglio).filter(Boolean);
    }
    throw new Error('Formato non riconosciuto: servono .xlsx o .csv');
  }

  return { leggiPiano, leggiScheda, slotDa };
})();
