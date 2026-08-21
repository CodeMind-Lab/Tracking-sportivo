# Forma — CodeMind.Lab

Gestionale personale di **alimentazione e allenamento**. Diario, filtri, ricerche,
tabelle e report — nello stile del tuo gestionale budget, con i colori del marchio:
fondo bianco, navy, azzurro e corallo.

Funziona come un'app sull'iPhone, si apre anche dal Mac, e **funziona senza rete**.

---

## Prima cosa da fare

**Impostazioni → Bersagli giornalieri**: mettici i numeri del piano che segui — calorie nei
giorni di lavoro e in quelli di riposo, proteine, carboidrati, grassi, acqua, passi. Nel
codice ci sono valori generici di partenza, non consigli. Se colleghi Supabase li scrivi
una volta sola e si ritrovano sull'altro dispositivo.

## Cosa c'è dentro

| Scheda | A cosa serve |
|---|---|
| **Oggi** | La giornata: anello delle calorie con acqua e macro, il piano del giorno, passi, allenamento, e in fondo **La settimana** — andamento giorno per giorno, media, aderenza, volume, peso. Ti sposti con le frecce, con la striscia Lun‑Dom, o toccando la data per aprire il **calendario del mese**. |
| **Cibo → Diario** | Il registro di tutto quello che hai mangiato, **un giorno per riga**: tocchi il giorno e si apre con le sue voci e il totale. Filtri per periodo, pasto, categoria, ricerca sul nome. Export CSV. |
| **Cibo → Piano** | Il piano alimentare della settimana: scegli **Lun Mar Mer Gio Ven Sab Dom** in alto e componi la giornata di quel giorno. Da qui lo carichi nel diario di una data, generi la **lista della spesa** e gestisci le **combinazioni** salvate. |
| **Cibo → Alimenti** | L'anagrafica dei 71 alimenti più quelli che aggiungi tu, **raggruppati per categoria**: tocchi la categoria e si apre. Ricerca e filtro. |
| **Allenamento → Sessioni** | Il registro degli allenamenti svolti: serie, volume in kg, cardio. Filtri per periodo e gruppo muscolare. Export CSV. |
| **Allenamento → Schede** | I tuoi programmi. Una scheda ha i **giorni 1, 2, 3, 4…**: li scegli coi numeri in alto e ognuno ha i suoi esercizi con serie, ripetizioni, carico e recupero. |
| **Report** | Media calorie e proteine, **aderenza** (quanti giorni sei rimasto entro il 10% del bersaglio), calorie giorno per giorno, ripartizione dei macro, cosa mangi davvero, acqua/passi/olio, volume per gruppo, progressione dei carichi, e il **peso con la media mobile** e il verdetto a tre settimane. Si stampa in PDF. |
| **Impostazioni** | Bersagli, obiettivi, sincronizzazione, backup. |

### Cosa è già dentro e cosa metti tu

È **precaricato** il **database degli alimenti** con i valori per 100 g, preso dalle
*Tabelle di Composizione degli Alimenti* del **CREA** (Centro di ricerca alimenti e
nutrizione) — la fonte italiana di riferimento. Ai prodotti confezionati ci pensa la
scansione del codice a barre.

I bersagli giornalieri partono invece da numeri generici: la prima cosa da fare è
metterci i tuoi, in **Impostazioni → Bersagli giornalieri**.

Li **componi tu**: il piano della settimana e le schede di allenamento — a mano oppure
**caricando un file** (vedi sotto).

---

## Il piano della settimana

**Cibo → Piano.** In alto i sette giorni: tocchi **Gio** e vedi cosa mangi il giovedì.
Dai un nome alla giornata (`Giornata 1 · riso e tonno`), aggiungi gli alimenti pasto per
pasto, e la barra ti dice quanto sei lontano dal bersaglio di calorie.

Il piano è un **modello**: non conta nei report e non è il diario. Diventa reale quando
lo carichi in una data — dalla scheda **Oggi** il piano del giorno scelto è il riquadro
subito sotto le calorie, con tutti i pasti e le grammature; **Carica nel diario** e ci sei.
Da quel momento le voci si modificano come tutte le altre: se oggi hai mangiato 200 g di
riso invece di 60, correggi solo quella riga.

Una volta caricato, quel riquadro diventa il **confronto**: *Registrato 2353 contro 2073
del piano · +280 kcal*. È la cosa che la media settimanale non ti dice — se oggi hai
seguito il programma o hai improvvisato. Toccando l'intestazione il riquadro si ripiega,
se preferisci vedere subito i pasti registrati.

Sulla scheda **Oggi** c'è anche la striscia dei sette giorni della settimana corrente:
un tocco e ci sei. Il pallino sotto ogni giorno dice **corallo** = ho già registrato,
**azzurro** = c'è solo il piano.

Il pulsante **Copia da un altro giorno** serve per la rotazione del tuo piano
(MATTINA 1 → 2 → 3): componi una volta e ricopi.

### Caricare il piano da un file

**Cibo → Piano → Importa il piano da un file.** Accetta:

- **`.xlsx`** con un foglio per giornata e le colonne **Pasto · Ora · Alimento · Quantità**.
  È la forma dei piani alimentari fatti in Excel con un foglio per giornata tipo:
  caricandolo trova tutte le giornate e ti chiede solo in quale giorno della settimana
  metterle. La stessa giornata può stare su più giorni.
- **`.csv`** con quattro colonne separate da punto e virgola:

  ```
  giorno;pasto;alimento;grammi
  Lunedì;Colazione;Yogurt greco 0% grassi;250
  Lunedì;Pranzo;Riso basmati (crudo);60
  ```

La fascia oraria si ricava dal nome del pasto e dall'ora: "Spuntino" alle 10:30 finisce
nello spuntino del mattino, alle 03:00 in quello notturno.

I nomi degli alimenti vengono cercati nel database. Se qualcuno non viene riconosciuto,
alla fine compare l'elenco: li crei con un tocco e ricarichi il file.

---

## Le schede di allenamento

**Allenamento → Schede.** Una scheda ha i giorni **1, 2, 3, 4…**, ognuno con i suoi
esercizi. I numeri in alto passano da un giorno all'altro; **＋** ne aggiunge uno.

Le ripetizioni si scrivono come le scrive un preparatore — `8–10`, `12-15`, `Max tecn.` —
e restano così. Quando parti con l'allenamento, l'app propone il numero più basso
dell'intervallo: quello che devi garantire.

### Caricare una scheda da un file

**Allenamento → Schede → Importa una scheda da un file.** Accetta:

- **`.xlsx`** con un foglio per giorno e le colonne **Esercizio · Serie · Rip. · Rec. · Note**.
  Legge anche le sezioni (Riscaldamento, Petto, Bicipiti…), i recuperi scritti come `90"`
  o `1'30"`, e le note tecniche. Le intestazioni dei fogli possono avere emoji.
- **`.csv`** con cinque colonne:

  ```
  giorno;esercizio;serie;ripetizioni;recupero
  Giorno 1;Chest Press macchina;4;6-8;90"
  ```

Prima di scrivere qualcosa l'app ti mostra cosa ha trovato: quanti giorni e quanti
esercizi per giorno. Se sei dentro una scheda, l'importazione **sostituisce** i suoi
giorni; se sei nell'elenco, ne crea una nuova.

Tapis roulant, cyclette, corsa e simili vengono riconosciuti come cardio e si registrano
in minuti e chilometri invece che in serie e ripetizioni.

---

## 1. Metti l'app online (GitHub Pages)

L'iPhone può installare una web app **solo se sta su un indirizzo `https://`**. È anche
la condizione perché funzioni offline: su `http://` iOS non attiva il service worker.
GitHub Pages lo fa gratis e per sempre.

1. Su [github.com](https://github.com): **+** → **New repository**.
   - Repository name: `forma`
   - **Public** (Pages sui repo privati richiede il piano a pagamento)
   - **Non** spuntare "Add a README file" → **Create repository**
2. Clicca **uploading an existing file**.
3. Trascina dentro **tutto il contenuto** della cartella `forma`:
   `index.html`, `app.css`, `data.js`, `importa.js`, `app.js`, `sync.js`, `sw.js`,
   `manifest.webmanifest` e la cartella `icons`.
   (Trascina i file, non la cartella `forma` stessa.)
4. **Commit changes**.
5. **Settings** → **Pages** → Source: **Deploy from a branch**, Branch: **main**,
   cartella **/ (root)** → **Save**.
6. Dopo 1-2 minuti compare l'indirizzo, tipo `https://tuonome.github.io/forma/`.

## 2. Installala sull'iPhone

1. Apri quell'indirizzo **con Safari** (non Chrome: solo Safari installa le web app su iOS).
2. Tocca **Condividi** (il quadrato con la freccia in su).
3. Scorri e tocca **Aggiungi a Home** → **Aggiungi**.

Ora hai l'icona sulla schermata Home: si apre a schermo intero, senza barre, e
**funziona in aereo**. Sul Mac apri lo stesso indirizzo col browser: compare la
colonna di navigazione a sinistra, come nel gestionale.

## 3. Sincronizza iPhone e Mac (Supabase)

Serve una volta sola, poi non ci pensi più.

1. Registrati su [supabase.com](https://supabase.com) (si entra col proprio account GitHub).
2. **New project**. Nome `forma`, scegli una password per il database — **non ti servirà
   nell'app**, ma salvala — regione **West EU (Ireland)** o **Central EU (Frankfurt)**.
3. Quando è pronto: **SQL Editor** → **New query**. Incolla tutto il contenuto di
   `supabase-setup.sql` e premi **Run**.
4. **Authentication** → **Sign In / Providers** → Email: togli la spunta a
   **Confirm email** (altrimenti dopo la registrazione resti fuori).
5. Nell'app: ingranaggio in alto a destra → **Sincronizzazione**:
   - incolla l'**indirizzo del progetto** (va bene anche solo l'indirizzo della pagina
     di Supabase su cui ti trovi, o il solo codice del progetto)
   - incolla la **chiave pubblica** (`anon public` o `Publishable key`)
   - **Collega**, poi **Crea account** con una email e una password
6. Sul Mac ripeti il punto 5 con **la stessa email e la stessa password**.

> **Puoi riusare lo stesso progetto Supabase di Archivio.** La tabella qui si chiama
> `forma_items`, non `items`: i due archivi non si toccano. Devi solo lanciare anche
> `supabase-setup.sql` di Forma, e accedere con lo stesso account.

**Conflitti:** vince la modifica più recente, riga per riga. Se registri un pasto
sull'iPhone e ne correggi un altro sul Mac, sopravvivono entrambi.

## 4. Senza Supabase

L'app funziona benissimo anche solo in locale: i dati restano su quel dispositivo.
In quel caso usa **Impostazioni → Backup → Esporta tutto**: è l'unica copia che esiste.

---

## Come si usa, in pratica

**Spostarsi fra i giorni.** Le frecce vanno avanti e indietro di un giorno, anche nel
futuro: serve per preparare in anticipo la giornata di un turno. La striscia Lun‑Dom salta
dentro la settimana. Toccando la data si apre il **calendario del mese**, dove ogni giorno
porta i suoi pallini — corallo se hai registrato, azzurro se c'è solo il piano, teal se hai
allenato — e da lì vai ovunque in un tocco.

**Caricare la giornata.** Se il giorno della settimana ha un piano, sulla scheda Oggi
compare *Piano del giorno* → **Carica**: tutte le voci entrano nel diario in un tocco.
Poi correggi solo quello che hai mangiato davvero diverso.

**Scansionare un prodotto.** Nel pannello di ricerca, l'icona del codice a barre accanto
alla lente accende la fotocamera: inquadri il codice sulla confezione e l'app cerca il
prodotto su [Open Food Facts](https://it.openfoodfacts.org). Ti mostra nome e valori per
100 g, li confermi (o li correggi) e finisce fra i tuoi alimenti. **Il codice resta
attaccato all'alimento**: la seconda volta che scansioni quel prodotto lo trova in casa,
senza rete e senza chiedere niente a nessuno.

I dati di Open Food Facts li inseriscono gli utenti, quindi un'occhiata all'etichetta non
fa male — se un prodotto ha valori incompleti l'app te lo dice. Se non lo trova, o se sei
offline, si apre direttamente il modulo per inserirlo a mano col codice già compilato.
C'è anche **Scrivi il codice a mano**, per quando la confezione è rovinata.

La prima volta iOS chiede il permesso per la fotocamera. Se lo neghi per sbaglio:
Impostazioni → Safari → Fotocamera → Consenti.

**Registrare un pasto.** Pulsante rotondo corallo → cerchi l'alimento → tastierino per i
grammi → **Aggiungi**. I macro si aggiornano mentre scrivi. Gli ultimi alimenti usati
compaiono in cima senza cercare: dopo una settimana registri una giornata in una decina
di tocchi. Il pasto è già scelto in base all'ora, e nel tastierino puoi cambiarlo.

Per alcuni alimenti ci sono le **porzioni pronte** ("1 uovo · 55 g", "2 cucchiai · 20 g",
"3 scatolette · 150 g"): vengono dalle note del tuo database.

**Correggere.** Sulla scheda Oggi, tocca **“N voci registrate”** sotto le calorie: si apre
il Diario già ristretto a quel giorno. Nel Diario ogni giorno è una riga chiusa con il
totale e lo scarto dal bersaglio; tocchi il giorno, si apre, e da lì tocchi la voce da
correggere. Con una ricerca attiva i giorni si aprono tutti da soli, altrimenti quello che
cerchi potrebbe restare nascosto in un giorno chiuso.

**Turno o riposo.** L'etichetta azzurra accanto alle voci registrate (*turno · 2050*) è
anche l'interruttore: toccala e passa a *riposo · 1900*. Il bersaglio dell'anello cambia
di conseguenza.

**Allenarsi.** Scheda Allenamento → pulsante rotondo → scegli la giornata della scheda.
Gli esercizi sono già lì con serie, ripetizioni e carico dell'ultima volta. Spunti una
serie e **parte da solo il cronometro di recupero**. Sotto ogni esercizio c'è
*"Ultima volta il 15 ago: 4×8 con 62.5 kg"*: è l'unica cosa che serve sapere sotto il
bilanciere.

**Guardare come va.** Scheda Report. Il numero che conta più della media è
l'**aderenza**: due giorni sbagliati in direzioni opposte danno una media perfetta e una
settimana disastrosa.

**Il peso.** Il grafico mostra ogni pesata in azzurro chiaro e la **media a 7 giorni** in
corallo: è quella che devi guardare, perché il peso grezzo oscilla di un chilo per il sale
o l'intestino. Sotto c'è il verdetto che il piano ti chiede — la media delle ultime tre
settimane contro quella delle tre precedenti — con la regola da applicare se sei fermo:
togliere 150 kcal dai carboidrati, mai dalle proteine.

**La lista della spesa.** Cibo → Piano → *Lista della spesa*. Somma le quantità dei giorni
che scegli (tutti e sette in partenza), le raggruppa per categoria e le converte in kg dove
serve. Spunti quello che metti nel carrello, e la spunta resta finché non la togli. Export
CSV e stampa.

**Sostituire un alimento.** Tocca una voce del diario o del piano, poi *Sostituisci con un
altro alimento*: l'app tiene ferme le calorie e ti dice quanti grammi servono di ogni
alternativa, ordinate per quanto restano vicine sulle proteine. Il segno verde vuol dire
che le proteine non cambiano.

**L'olio.** Non si registra a parte: l'app somma da sola i grammi di ogni riga che contiene
"olio" e li confronta col massimo giornaliero. Lo trovi sulla scheda Oggi accanto ai passi.

**Le combinazioni.** In Cibo → Piano, in fondo: le rinomini, le elimini, o le rimetti nel
diario di oggi in un tocco.

**Stampare un report.** Report → **Stampa**. Su Mac scegli *Salva come PDF*; su iPhone,
dal foglio di condivisione. La stampa toglie da sola navigazione, filtri e pulsanti.

**Esportare.** Il pulsante **CSV** esporta **esattamente le righe che stai vedendo**, con
i filtri applicati. Separatore punto e virgola: Excel italiano lo apre in colonne senza
chiedere niente. Su iPhone si apre il foglio di condivisione, sul Mac il file si scarica.

---

## Aggiornare l'app

Quando cambi i file, alza il numero di versione in **due punti** (devono corrispondere):

- `app.js`, riga in alto: `const APP_VERSION = '2026.08.21.2';`
- `sw.js`, riga in alto: `const VER = 'forma-2026.08.21.2';`

Se non alzi quello di `sw.js`, i telefoni continuano a usare i file vecchi presi dalla
cache. Poi ricarichi i file su GitHub. La versione in uso si legge in Impostazioni.

## Rifare il database degli alimenti

Nella cartella `strumenti/` ci sono gli script che hanno costruito `data.js`
dalle tabelle CREA, con le istruzioni per rilanciarli. Non servono all'app: sono
lì per il giorno in cui volessi aggiornare i valori.

## Dove stanno i dati

Nel `localStorage` del browser, sotto la chiave `forma.v1`. Tutto in una struttura sola:
una riga per cosa, con un tipo (`l` voce del diario, `p` piano di un giorno della
settimana, `w` sessione, `m` misura, `s` scheda, `a` alimento tuo, `g` giorno,
`cfg` bersagli). È la stessa forma che viaggia su Supabase,
quindi aggiungere un campo in futuro non richiede toccare il database.

Il database degli alimenti sta in `data.js` e non viene sincronizzato: è uguale su tutti
i dispositivi perché è parte dell'app. Gli alimenti che aggiungi tu — compresi quelli
arrivati dalla scansione — invece sì.

## Fonti dei dati

- **Alimenti di base**: CREA — *Tabelle di Composizione degli Alimenti*,
  [alimentinutrizione.it](https://www.alimentinutrizione.it). Consultabili liberamente
  citando la fonte, come qui.
- **Prodotti confezionati**: [Open Food Facts](https://it.openfoodfacts.org), database
  aperto sotto licenza ODbL, interrogato per codice a barre. Non serve nessuna chiave e
  l'app non manda via niente oltre al codice del prodotto.

---

CodeMind.Lab
