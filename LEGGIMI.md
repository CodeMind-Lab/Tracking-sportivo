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
| **Agenda** | La giornata ora per ora. In cima **dal tuo programma** — il turno e l'allenamento previsto, che l'app sa già e non riscrivi a mano. Sotto le voci **a orario** e le **cose da fare**, con categoria e colore. Le cose non fatte ti seguono nei giorni dopo per due settimane. |
| **Oggi** | La giornata: il **turno di lavoro** in cima, anello delle calorie con acqua e macro, il piano del giorno, passi e olio, allenamento, e in fondo **La settimana** — andamento giorno per giorno, media, aderenza, volume, peso. Ti sposti con le frecce, con la striscia Lun‑Dom, o toccando la data per aprire il **calendario del mese**. |
| **Cibo → Diario** | Il registro di tutto quello che hai mangiato, **un giorno per riga**: tocchi il giorno e si apre con le sue voci e il totale. Filtri per periodo, pasto, categoria, ricerca sul nome. Export CSV. |
| **Cibo → Piano** | Le tue **giornate tipo** (“Giorno 1 off”, “Giorno 2 on”) e, per ogni giorno della settimana, **due menu a tendina**: il turno di lavoro e la giornata che mangi. Da qui esce anche la **lista della spesa**, e ci stanno le **combinazioni** salvate. |
| **Cibo → Alimenti** | L'anagrafica dei 71 alimenti più quelli che aggiungi tu, **raggruppati per categoria**: tocchi la categoria e si apre. Ricerca e filtro. |
| **Allenamento → Sessioni** | Il registro degli allenamenti svolti: serie, volume in kg, cardio. Filtri per periodo e gruppo muscolare. Export CSV. |
| **Allenamento → Schede** | I tuoi programmi, e un **menu a tendina per ogni giorno della settimana** che dice quale seduta tocca quel giorno. Una scheda ha i **giorni 1, 2, 3, 4…** con i loro esercizi, serie, ripetizioni, carico, recupero e note. |
| **Report** | Media calorie e proteine, **aderenza** (quanti giorni sei rimasto entro il 10% del bersaglio), calorie giorno per giorno, ripartizione dei macro, cosa mangi davvero, acqua/passi/olio, volume per gruppo, progressione dei carichi, e il **peso con la media mobile** e il verdetto a tre settimane. Si stampa in PDF. |
| **Impostazioni** | Bersagli, obiettivi, sincronizzazione, backup. |

### Sul Mac: colonna, temi, scorciatoie

Da 1000 pixel in su l'app cambia impaginazione: la barra in basso sparisce e
compare la **colonna di navigazione** a sinistra, con la pastiglia che scorre
sulla voce aperta. La dashboard si apre su **due colonne**: a sinistra le
calorie e il piano del giorno, a destra passi, olio, allenamento, agenda e la
settimana.

In fondo alla colonna ci sono due pulsanti:

- **Tema** — passa da chiaro a scuro. La scelta resta anche riaprendo l'app, ed
  è per telefono e Mac insieme.
- **Stringi** — riduce la colonna alle sole icone, per far spazio alle tabelle.

Le scorciatoie da tastiera valgono solo quando non stai scrivendo in un campo:

| Tasto | Cosa fa |
|---|---|
| `←` `→` | Giorno prima / giorno dopo (su Oggi e Agenda) |
| `O` | Torna a oggi |
| `1`…`6` | Le sei voci del menu, nell'ordine in cui si vedono |
| `T` | Cambia tema |
| `Esc` | Chiude il pannello aperto o lo scanner |

Il carattere **Inter** sta dentro il repository, non su un CDN: l'app deve
aprirsi uguale anche senza rete.

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

## L'agenda

**Agenda** è la scheda della giornata. In cima c'è quello che l'app sa già da sé — il
**turno** con il suo orario e l'**allenamento** previsto per quel giorno — e non si
riscrive: toccandoli si va dove si cambiano.

Sotto, quello che scrivi tu:

- **Orari** — le voci con un'ora, in ordine.
- **Da fare** — quelle senza ora. Se non le spunti, **ti seguono nei giorni successivi**
  per due settimane, con la data in cui le avevi scritte. Una lista che dimentica quello
  che non hai fatto non è una lista.

Ogni voce ha una **categoria** (lavoro, palestra, casa, salute, spesa, personale) che le dà
il colore della striscia a sinistra. Con **ripeti ogni lunedì** la voce torna tutte le
settimane: spuntarla oggi non la dà per fatta la settimana prossima.

Ogni voce ha un **inizio** e una **fine** facoltativa: `09:30–10:45`.

Sulla scheda **Oggi** compaiono le prime tre cose ancora da fare.

### Notifiche push · avvisi anche ad app chiusa

Questa è l'unica strada perché il telefono suoni senza che l'app sia aperta, e richiede
un pezzo di server: una funzione sul **tuo** Supabase che ogni pochi minuti guarda
l'agenda e manda gli avvisi. Si installa una volta sola.

Ti avvisa anche quando **esce una versione nuova dell'app**: la funzione legge da sola la
versione pubblicata e la confronta con quella che gira sul tuo telefono, così non c'è
nessun numero da tenere aggiornato a mano.

#### 1 · La tabella

Supabase → **SQL Editor** → New query → incolla tutto `supabase-push.sql` → **Run**.

#### 2 · I segreti

Le chiavi VAPID sono nel file `forma-chiavi-vapid.txt` che ti ho lasciato sul Desktop —
**tienilo fuori dalla cartella del progetto**, che è pubblica.

Supabase → **Project Settings** → **Edge Functions** → **Secrets**, tre voci:

| Nome | Valore |
|---|---|
| `VAPID_PUBLIC` | la chiave pubblica |
| `VAPID_PRIVATE` | la chiave privata |
| `VAPID_SUBJECT` | `mailto:` seguito dalla tua email |

#### 3 · La funzione

Supabase → **Edge Functions** → **Deploy a new function** → nome **`promemoria`** →
incolla il contenuto di `supabase/functions/promemoria/index.ts` → Deploy.

Dal computer, in alternativa:

```bash
supabase functions deploy promemoria
```

#### 4 · Falla partire da sola

Supabase → **Integrations** → **Cron** → **Create job**: nome `forma-promemoria`,
ogni **5 minuti**, tipo **Supabase Edge Function**, funzione `promemoria`.

Da SQL, se preferisci:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('forma-promemoria', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://IL-TUO-PROGETTO.supabase.co/functions/v1/promemoria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer LA-TUA-CHIAVE-SERVICE-ROLE'
    )
  );
$$);
```

#### 5 · Accendile sul telefono

Nell'app: **Impostazioni → Notifiche push → Attiva**.

Perché funzioni servono tutte e tre queste cose:

- la **sincronizzazione collegata** e l'accesso fatto (le notifiche passano da lì);
- l'app **aggiunta alla schermata Home** — da Safari il push su iPhone non esiste;
- i quattro passi qui sopra completati.

Se qualcosa non torna, apri la funzione su Supabase e guarda i log: risponde con quanti
dispositivi ha trovato e quanti avvisi ha mandato.

### I promemoria che non chiedono niente

Se non vuoi installare niente sul server, restano queste tre — funzionano da sole:

1. **Il pallino sull'icona** con quante cose restano da fare. Compare sulla schermata Home
   e **resta anche ad app chiusa**: è l'unico promemoria passivo che il web conceda.
2. **L'avviso mentre l'app è aperta**, per le voci che stanno per cominciare. Si attiva da
   *Impostazioni → Promemoria → Attiva gli avvisi*, e il preavviso si sceglie in minuti.
3. **L'esportazione nel calendario** — ed è questa la strada buona.
   *Impostazioni → Manda l'agenda al calendario* produce un file `.ics` che l'iPhone apre
   in Calendario: ogni voce diventa un evento con la sveglia al preavviso che hai scelto,
   e **quelle suonano davvero**, col telefono in tasca. Le voci che si ripetono ogni
   settimana diventano eventi ricorrenti, quindi si esporta una volta sola. Vengono
   esportati i prossimi trenta giorni, saltando quello che hai già spuntato.

## Il piano della settimana

Il piano è fatto di **giornate tipo**: “Giorno 1 off”, “Giorno 2 on”, ognuna coi suoi
pasti. Sono oggetti a sé — non appartengono a nessun giorno del calendario — e la stessa
giornata può stare su più giorni della settimana. È così che funziona una rotazione vera.

**Cibo → Piano.** In cima ci sono i sette giorni della settimana, ognuno con un **menu a
tendina**: scegli quale giornata mangi quel giorno. Cambiare la rotazione è questione di
sette tocchi, e non tocca il contenuto delle giornate.

Sotto c'è l'elenco delle giornate: tocchi una e la compili pasto per pasto. Ognuna può
essere segnata **di turno** o **di riposo** — così quando la carichi nel diario, il giorno
si sposta da solo sul bersaglio di calorie giusto.

La prima volta, il pulsante **Crea le giornate del mio piano** ti chiede quante ne hai di
riposo e quante di turno e le crea già con i nomi a posto (4 e 3 danno *Giorno 1 off …
Giorno 4 off* e *Giorno 1 on … Giorno 3 on*), assegnandole ai sette giorni.

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

Dentro una giornata, **Copia da un'altra giornata** ne sovrascrive il contenuto,
**Duplica** ne fa una copia a parte da cui partire.

### Caricare il piano da un file

**Cibo → Piano → Importa il piano da un file.** Accetta:

- **`.xlsx`** con un foglio per giornata e le colonne **Pasto · Ora · Alimento · Quantità**.
  È la forma dei piani alimentari fatti in Excel con un foglio per giornata tipo:
  caricandolo diventano altrettante giornate tipo, e ti chiede solo in quale giorno della
  settimana metterle. La stessa giornata può stare su più giorni. Reimportando lo stesso
  file le giornate si aggiornano invece di duplicarsi.
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

### La settimana di allenamento

In **Allenamento → Schede**, in cima, ci sono i sette giorni con un menu a tendina
ciascuno: scegli quale seduta fai quel giorno, o lasci **riposo**. Funziona come
l'assegnazione delle giornate alimentari.

Sulla scheda **Oggi** compare quello che tocca — *“Rientro · Circuito A”* con il pulsante
**Inizia**, che apre la sessione già pronta. Nei giorni lasciati su riposo te lo dice,
invece di lasciarti davanti a una casella vuota.

### Caricare una scheda da un file

**Allenamento → Schede → Importa una scheda da un file.** Accetta:

- **`.xlsx`** con un foglio per giorno e le colonne **Esercizio · Serie · Rip. · Rec. · Note**.
  Legge anche le sezioni (Riscaldamento, Petto, Bicipiti…), i recuperi scritti come `90"`
  o `1'30"`, e le note tecniche. Le intestazioni dei fogli possono avere emoji.
- **`.csv`** con cinque colonne, più due facoltative (**note** e **gruppo**):

  ```
  giorno;esercizio;serie;ripetizioni;recupero;note;gruppo
  Circuito A;Chest press;3;15;40";Carico leggero, controlla la discesa;Circuito
  ```

  Le note compaiono sotto l'esercizio **mentre ti alleni**, che è dove servono, e il
  gruppo diventa la sezione della seduta (Riscaldamento, Circuito, Cardio).

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
**funziona in aereo**.

Sul Mac apri lo stesso indirizzo col browser: sopra i 1000 px compare la colonna di
navigazione e la dashboard si apre su due colonne — vedi *Sul Mac: colonna, temi,
scorciatoie* più su. Sotto quella soglia torna esattamente com'è sul telefono.

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

**Il turno di lavoro.** In cima alla scheda Oggi, con l'orario e il suo colore a sinistra,
così lo riconosci senza leggerlo. Parte con quattro turni — **Apertura** (07:30–15:30),
**Chiusura** (15:30–23:30), **Notte** (23:30–07:30), **OFF** — ma sono solo un punto di
partenza: in **Impostazioni → Turni di lavoro** li rinomini, cambi orario, icona e colore,
ne aggiungi altri o li elimini.

Un turno segnato **è un riposo** abbassa il bersaglio di calorie a quello dei giorni di
riposo. È l'unica cosa che il turno decide. Eliminando un turno, i giorni che lo usavano
restano senza — l'app te lo dice prima, con quanti sono.

Il turno solito di ogni giorno si imposta una volta in **Cibo → Piano**, nella stessa
tabella dove scegli le giornate alimentari. Quando una settimana i turni si scambiano,
tocchi la barra sulla scheda Oggi e cambi **solo quel giorno**: l'app te lo segnala, e con
*Segui la settimana* torna al modello.

**Nei giorni OFF il bersaglio di calorie scende** da solo a quello dei giorni di riposo.
Gli orari sono quelli del piano v3: se sono cambiati, dimmelo e li rendo modificabili.

**Spostarsi fra i giorni.** Il giorno che scegli **resta scelto**: passi a Cibo o a Report
e tornando su Oggi sei ancora lì. Riparte da oggi solo quando riapri l'app.

Le frecce vanno avanti e indietro di un giorno, anche nel futuro: serve per preparare in
anticipo la giornata di un turno. La striscia Lun‑Dom salta
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

### Sul telefono

L'app tiene i file in memoria per funzionare senza rete, e dopo una pubblicazione può
restare indietro di qualche ora. **Impostazioni → Aggiorna l'app adesso**: riscarica tutto
subito, ignorando ogni cache. I dati non si toccano — diario, piani e allenamenti restano
dove sono.

Quando l'app si accorge da sola che c'è una versione nuova, te lo dice con un avviso.

Se ti trovi bloccato su una versione che non ha ancora quel pulsante: chiudi l'app dal
selettore delle app (scorri verso l'alto e butta via la scheda) e riaprila. Un avvio da
freddo la fa ricontrollare.

### Quando pubblichi

Alza il numero di versione in **due punti** (devono corrispondere):

- `app.js`, riga in alto: `const APP_VERSION = '2026.08.21.3';`
- `sw.js`, riga in alto: `const VER = 'forma-2026.08.21.3';`

Se non alzi quello di `sw.js`, i telefoni continuano a usare i file vecchi presi dalla
cache. Poi ricarichi i file su GitHub. La versione in uso si legge in Impostazioni.

## Rifare il database degli alimenti

Nella cartella `strumenti/` ci sono gli script che hanno costruito `data.js`
dalle tabelle CREA, con le istruzioni per rilanciarli. Non servono all'app: sono
lì per il giorno in cui volessi aggiornare i valori.

## Dove stanno i dati

Nel `localStorage` del browser, sotto la chiave `forma.v1`. Tutto in una struttura sola:
una riga per cosa, con un tipo (`l` voce del diario, `gt` giornata tipo, `p` a quale
giornata punta un giorno della settimana, `pa` quale seduta tocca in quale giorno, `ag` una voce di agenda, `agr` una voce che si
ripete ogni settimana, `tn` un turno di lavoro, `tu` il turno solito di un giorno
della settimana, `w` sessione, `m` misura, `s` scheda, `a` alimento tuo, `g` giorno,
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
