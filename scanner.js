/* Lettura del codice a barre dalla fotocamera.
 *
 * Safari non ha BarcodeDetector — è un'API che per ora esiste solo su Chrome —
 * quindi qui dentro c'è un decodificatore EAN-13/EAN-8 scritto a mano, che è
 * l'unico modo perché la scansione funzioni davvero su iPhone. Dove
 * BarcodeDetector c'è si usa quello, che è più veloce e più preciso.
 *
 * Il metodo è quello classico: si prende una riga orizzontale di pixel, la si
 * riduce a bianco e nero, si misurano le lunghezze delle barre e degli spazi e
 * si confrontano con le tabelle dello standard. Non serve leggere l'immagine
 * intera: un codice a barre è un segnale monodimensionale.
 */

'use strict';

const Scanner = (() => {

  /* ---------- tabelle EAN ----------
     Ogni cifra occupa 7 moduli divisi in 4 tratti (due barre e due spazi).
     Qui i tratti sono espressi in moduli: è la forma che regge la
     deformazione, perché una foto storta allunga tutto in proporzione. */
  const L = [[3,2,1,1],[2,2,2,1],[2,1,2,2],[1,4,1,1],[1,1,3,2],
             [1,2,3,1],[1,1,1,4],[1,3,1,2],[1,2,1,3],[3,1,1,2]];
  const G = L.map(p => p.slice().reverse());

  /* Le prime sei cifre di un EAN-13 sono codificate metà in un alfabeto e metà
     nell'altro: la sequenza dei due alfabeti È la tredicesima cifra, quella
     che sotto al codice sta stampata da sola a sinistra. */
  const PRIMA = ['000000','001011','001101','001110','010011',
                 '011001','011100','010101','010110','011010'];

  /* ---------- dai pixel ai tratti ---------- */

  /* La soglia fra scuro e chiaro, col metodo di Otsu: si prova ogni valore e
     si tiene quello che separa meglio i pixel in due gruppi compatti.
     Prendere semplicemente la media fra il più chiaro e il più scuro non
     regge, perché basta un riflesso o il bordo bianco della confezione accanto
     al codice per tirare su il massimo e far finire tutto il codice dalla
     parte scura. Otsu guarda come sono distribuiti i pixel, non gli estremi. */
  function soglia(riga) {
    const h = new Uint32Array(256);
    for (const v of riga) h[v]++;
    const n = riga.length;
    let somma = 0;
    for (let i = 0; i < 256; i++) somma += i * h[i];

    let sommaB = 0, pesoB = 0, migliore = 128, varMax = -1;
    for (let t = 0; t < 256; t++) {
      pesoB += h[t];
      if (!pesoB) continue;
      const pesoF = n - pesoB;
      if (!pesoF) break;
      sommaB += t * h[t];
      const mediaB = sommaB / pesoB;
      const mediaF = (somma - sommaB) / pesoF;
      const v = pesoB * pesoF * (mediaB - mediaF) * (mediaB - mediaF);
      if (v > varMax) { varMax = v; migliore = t; }
    }
    return migliore;
  }

  /* Una riga di grigi diventa una sequenza di lunghezze di tratto. */
  function tratti(riga) {
    let gmin = 255, gmax = 0;
    for (const v of riga) { if (v < gmin) gmin = v; if (v > gmax) gmax = v; }
    if (gmax - gmin < 25) return null;         // riga piatta: niente codice

    const s = soglia(riga);
    const out = [];
    let scuro = riga[0] <= s, len = 1;
    for (let i = 1; i < riga.length; i++) {
      const d = riga[i] <= s;
      if (d === scuro) len++;
      else { out.push({ scuro, len }); scuro = d; len = 1; }
    }
    out.push({ scuro, len });
    return out;
  }

  /* Confronta quattro tratti con le tabelle e restituisce la cifra più vicina.
     La distanza è sulla forma normalizzata, non sui pixel: così un codice
     grande e uno piccolo si leggono allo stesso modo. */
  function cifra(t, i, tabelle) {
    if (i + 3 >= t.length) return null;
    const tot = t[i].len + t[i+1].len + t[i+2].len + t[i+3].len;
    if (tot <= 0) return null;
    const u = tot / 7;
    const e = [t[i].len/u, t[i+1].len/u, t[i+2].len/u, t[i+3].len/u];

    let best = null, bestD = 1.1;
    for (let s = 0; s < tabelle.length; s++) {
      const tab = tabelle[s];
      for (let d = 0; d < 10; d++) {
        const p = tab[d];
        const dist = Math.abs(e[0]-p[0]) + Math.abs(e[1]-p[1]) + Math.abs(e[2]-p[2]) + Math.abs(e[3]-p[3]);
        if (dist < bestD) { bestD = dist; best = { d, set: s }; }
      }
    }
    return best;
  }

  const guardia = (t, i, quanti, u) => {
    for (let k = 0; k < quanti; k++) {
      if (i + k >= t.length) return false;
      const m = t[i + k].len / u;
      if (m < 0.5 || m > 1.7) return false;
    }
    return true;
  };

  function checksum(c) {
    let s = 0;
    for (let i = 0; i < c.length - 1; i++) s += +c[i] * (i % 2 ? 3 : 1);
    return (10 - s % 10) % 10 === +c[c.length - 1];
  }

  /* Prova a leggere un EAN-13 a partire da un certo tratto. */
  function leggi13(t, i) {
    const u = (t[i].len + t[i+1].len + t[i+2].len) / 3;
    if (u < 0.8) return null;
    if (!guardia(t, i, 3, u)) return null;

    let p = i + 3, parita = '', cifre = '';
    for (let n = 0; n < 6; n++, p += 4) {
      const c = cifra(t, p, [L, G]);
      if (!c) return null;
      cifre += c.d; parita += c.set;
    }
    if (!guardia(t, p, 5, u)) return null;
    p += 5;
    for (let n = 0; n < 6; n++, p += 4) {
      const c = cifra(t, p, [L]);
      if (!c) return null;
      cifre += c.d;
    }
    const prima = PRIMA.indexOf(parita);
    if (prima < 0) return null;
    const cod = prima + cifre;
    return checksum(cod) ? cod : null;
  }

  /* EAN-8: niente alfabeto alternato, quattro cifre per metà. */
  function leggi8(t, i) {
    const u = (t[i].len + t[i+1].len + t[i+2].len) / 3;
    if (u < 0.8) return null;
    if (!guardia(t, i, 3, u)) return null;

    let p = i + 3, cifre = '';
    for (let n = 0; n < 4; n++, p += 4) {
      const c = cifra(t, p, [L]);
      if (!c) return null;
      cifre += c.d;
    }
    if (!guardia(t, p, 5, u)) return null;
    p += 5;
    for (let n = 0; n < 4; n++, p += 4) {
      const c = cifra(t, p, [L]);
      if (!c) return null;
      cifre += c.d;
    }
    return checksum(cifre) ? cifre : null;
  }

  /* Una riga di pixel può contenere il codice in qualunque punto e in
     qualunque verso: si prova a partire da ogni barra, e poi si riprova con la
     riga rovesciata per il caso in cui il telefono sia capovolto. */
  function daRiga(riga) {
    for (const versi of [riga, Array.from(riga).reverse()]) {
      const t = tratti(versi);
      if (!t) continue;
      for (let i = 0; i < t.length - 55; i++) {
        if (!t[i].scuro) continue;
        const a = leggi13(t, i);
        if (a) return a;
      }
      for (let i = 0; i < t.length - 39; i++) {
        if (!t[i].scuro) continue;
        const b = leggi8(t, i);
        if (b) return b;
      }
    }
    return null;
  }

  /* ---------- la fotocamera ---------- */

  let video = null, canvas = null, ctx = null, flusso = null, timer = null;
  let onTrovato = null, conferme = {};

  /* Si guardano più righe sparse attorno al centro: una sola riga becca la
     scritta o un riflesso e non legge niente. */
  function analizza() {
    if (!video || video.readyState < 2) return;
    const W = 640;
    const H = Math.max(1, Math.round(video.videoHeight * W / video.videoWidth));
    if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
    ctx.drawImage(video, 0, 0, W, H);

    for (const frazione of [0.5, 0.42, 0.58, 0.34, 0.66]) {
      const y = Math.round(H * frazione);
      const dati = ctx.getImageData(0, y, W, 1).data;
      const riga = new Uint8Array(W);
      for (let x = 0; x < W; x++) {
        const i = x * 4;
        // luminanza percettiva: il rosso e il blu pesano meno del verde
        riga[x] = (dati[i] * 77 + dati[i+1] * 151 + dati[i+2] * 28) >> 8;
      }
      const cod = daRiga(riga);
      if (!cod) continue;

      /* Due letture uguali prima di accettare: un singolo fotogramma sfocato
         può superare il checksum per caso, e leggere il prodotto sbagliato è
         peggio che non leggerlo. */
      conferme[cod] = (conferme[cod] || 0) + 1;
      if (conferme[cod] >= 2) { trovato(cod); return; }
    }
  }

  function trovato(cod) {
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    const cb = onTrovato;
    chiudi();
    if (cb) cb(cod);
  }

  async function apri(callback) {
    onTrovato = callback;
    conferme = {};

    const box = document.getElementById('scan');
    box.hidden = false;
    document.getElementById('scanStato').textContent = 'Accendo la fotocamera…';

    try {
      flusso = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false
      });
    } catch (e) {
      document.getElementById('scanStato').textContent =
        e && e.name === 'NotAllowedError'
          ? 'Permesso negato. Su iPhone: Impostazioni → Safari → Fotocamera → Consenti, poi riapri l’app.'
          : 'Fotocamera non disponibile su questo dispositivo.';
      return;
    }

    video = document.getElementById('scanVideo');
    video.srcObject = flusso;
    video.setAttribute('playsinline', '');   // senza, iOS apre il video a schermo intero
    await video.play().catch(() => {});

    canvas = canvas || document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    document.getElementById('scanStato').textContent = 'Inquadra il codice a barre';

    /* Se il browser sa farlo da solo lo lasciamo fare: legge anche i codici
       storti, che il metodo a righe orizzontali non prende. */
    let nativo = null;
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        nativo = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      } catch (e) { nativo = null; }
    }

    timer = setInterval(async () => {
      if (nativo) {
        try {
          const r = await nativo.detect(video);
          if (r && r.length) { trovato(r[0].rawValue); return; }
        } catch (e) { nativo = null; }
      }
      analizza();
    }, 220);
  }

  function chiudi() {
    clearInterval(timer); timer = null;
    if (flusso) { flusso.getTracks().forEach(t => t.stop()); flusso = null; }
    if (video) { video.srcObject = null; }
    const box = document.getElementById('scan');
    if (box) box.hidden = true;
    onTrovato = null;
  }

  const disponibile = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  return { apri, chiudi, disponibile, daRiga, _leggi13: leggi13, _tratti: tratti };
})();
