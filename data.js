/* Forma — dati di base precaricati.
 *
 * ALIMENTI: database CREA-Alimenti / LARN IV revisione, valori per 100 g di parte
 * edibile, pesi a CRUDO salvo dove la nota dice "cotti" o "sgocciolati". Non si
 * modifica: gli alimenti tuoi si aggiungono dall'app e finiscono in DB.items,
 * così viaggiano nella sincronizzazione.
 *
 * ESERCIZI: solo un elenco di nomi per il completamento automatico quando
 * componi una scheda. Non è un programma di allenamento: le schede le costruisci
 * tu dentro l'app.
 */

'use strict';

const ALIMENTI = [
  {n:'Yogurt greco 0% grassi', k:59, p:10.3, c:3.6, g:0.4, cat:'Latticini/Uova', nt:'Base proteica economica'},
  {n:'Yogurt greco 2% grassi', k:73, p:9, c:3.9, g:2, cat:'Latticini/Uova'},
  {n:'Fiocchi di latte (cottage)', k:97, p:11.1, c:3.4, g:4.3, cat:'Latticini/Uova'},
  {n:'Ricotta vaccina', k:146, p:8.8, c:3.5, g:10.9, cat:'Latticini/Uova'},
  {n:'Parmigiano Reggiano', k:387, p:33.5, c:0, g:28.1, cat:'Latticini/Uova', nt:'Max 20 g/die: molto salato'},
  {n:'Latte parz. scremato', k:46, p:3.3, c:5, g:1.5, cat:'Latticini/Uova'},
  {n:'Latte intero', k:64, p:3.3, c:4.9, g:3.6, cat:'Latticini/Uova'},
  {n:'Uovo intero', k:128, p:12.4, c:0.6, g:8.7, cat:'Latticini/Uova', nt:'1 uovo medio = 55 g'},
  {n:'Albume d\'uovo', k:43, p:10.7, c:0, g:0.2, cat:'Latticini/Uova'},
  {n:'Philadelphia Protein', k:92, p:12, c:4, g:3, cat:'Latticini/Uova', nt:'Valore da etichetta'},
  {n:'Skyr / Quark magro', k:63, p:11, c:4, g:0.2, cat:'Latticini/Uova'},
  {n:'Petto di pollo', k:110, p:23.3, c:0, g:1.4, cat:'Carne'},
  {n:'Fesa di tacchino', k:107, p:24, c:0, g:1.2, cat:'Carne'},
  {n:'Bresaola', k:151, p:32, c:0, g:2.6, cat:'Carne', nt:'Sodio alto: max 2-3 volte/sett.'},
  {n:'Prosciutto cotto sgrassato', k:132, p:19.8, c:0.9, g:5.4, cat:'Carne'},
  {n:'Fesa di tacchino a fette', k:107, p:22, c:1, g:1.5, cat:'Carne'},
  {n:'Roast-beef', k:133, p:22, c:0, g:5, cat:'Carne'},
  {n:'Hamburger bovino magro', k:180, p:20, c:0, g:11, cat:'Carne'},
  {n:'Manzo magro (fesa/girello)', k:118, p:21.8, c:0, g:3.1, cat:'Carne'},
  {n:'Lonza di maiale', k:137, p:21.3, c:0, g:5.6, cat:'Carne'},
  {n:'Merluzzo / nasello', k:71, p:17, c:0, g:0.3, cat:'Pesce', nt:'Anche surgelato'},
  {n:'Orata / branzino', k:121, p:20.7, c:0, g:3.8, cat:'Pesce'},
  {n:'Salmone fresco', k:185, p:20.4, c:0, g:11.5, cat:'Pesce', nt:'Ricco di omega-3'},
  {n:'Salmone affumicato', k:147, p:25.4, c:0, g:4.5, cat:'Pesce', nt:'Sodio alto'},
  {n:'Tonno al naturale sgocciolato', k:103, p:25.2, c:0, g:0.3, cat:'Pesce'},
  {n:'Platessa', k:86, p:16.5, c:0, g:1.7, cat:'Pesce'},
  {n:'Gamberi / mazzancolle', k:71, p:13.6, c:0, g:0.6, cat:'Pesce'},
  {n:'Sgombro', k:170, p:17, c:0, g:11.1, cat:'Pesce', nt:'Ricco di omega-3'},
  {n:'Alici / acciughe', k:96, p:16.8, c:1.5, g:2.6, cat:'Pesce'},
  {n:'Pasta di semola (cruda)', k:353, p:11, c:71.2, g:1.4, cat:'Cereali', nt:'Peso a crudo'},
  {n:'Pasta integrale (cruda)', k:337, p:13.4, c:62.9, g:2.5, cat:'Cereali', nt:'Peso a crudo'},
  {n:'Riso basmati (crudo)', k:350, p:7.5, c:77, g:0.6, cat:'Cereali', nt:'Peso a crudo'},
  {n:'Riso integrale (crudo)', k:337, p:7.5, c:69, g:1.9, cat:'Cereali', nt:'Peso a crudo'},
  {n:'Cous cous (crudo)', k:350, p:12, c:72, g:1.5, cat:'Cereali', nt:'Peso a crudo'},
  {n:'Farro perlato (crudo)', k:335, p:15.1, c:67.1, g:2.5, cat:'Cereali', nt:'Peso a crudo'},
  {n:'Pane integrale', k:224, p:7.5, c:41, g:1.3, cat:'Cereali'},
  {n:'Pane comune', k:275, p:8.6, c:55, g:0.5, cat:'Cereali'},
  {n:'Fette biscottate integrali', k:379, p:11.3, c:70, g:5, cat:'Cereali', nt:'1 fetta = 10 g'},
  {n:'Fiocchi d\'avena', k:373, p:12.6, c:62, g:7.1, cat:'Cereali'},
  {n:'Patate', k:78, p:2.1, c:17.2, g:0.1, cat:'Cereali', nt:'Peso a crudo, pelate'},
  {n:'Patate dolci', k:86, p:1.6, c:20.1, g:0.1, cat:'Cereali'},
  {n:'Ceci cotti', k:120, p:7, c:18.9, g:2.4, cat:'Legumi', nt:'Anche in scatola sciacquati'},
  {n:'Fagioli borlotti cotti', k:128, p:8.4, c:18.6, g:0.5, cat:'Legumi'},
  {n:'Lenticchie cotte', k:116, p:9, c:16.3, g:0.4, cat:'Legumi'},
  {n:'Piselli surgelati', k:76, p:5.8, c:6.5, g:0.6, cat:'Legumi'},
  {n:'Fagioli cannellini cotti', k:120, p:7.9, c:17.5, g:0.6, cat:'Legumi'},
  {n:'Frutta fresca (media)', k:50, p:0.7, c:11, g:0.3, cat:'Frutta/Verdura', nt:'Media di mela, pera, arancia, kiwi'},
  {n:'Banana', k:89, p:1.1, c:22.8, g:0.3, cat:'Frutta/Verdura'},
  {n:'Mela', k:52, p:0.3, c:13.8, g:0.2, cat:'Frutta/Verdura'},
  {n:'Frutti di bosco', k:45, p:1, c:9, g:0.4, cat:'Frutta/Verdura', nt:'Anche surgelati'},
  {n:'Verdura (media)', k:25, p:1.8, c:3, g:0.3, cat:'Frutta/Verdura', nt:'Media di insalata, zucchine, broccoli'},
  {n:'Pomodori', k:19, p:1, c:3.5, g:0.2, cat:'Frutta/Verdura', nt:'Max 100 g/pasto'},
  {n:'Zucchine', k:11, p:1.3, c:1.4, g:0.1, cat:'Frutta/Verdura'},
  {n:'Broccoli / cavolfiore', k:27, p:3, c:2.4, g:0.4, cat:'Frutta/Verdura'},
  {n:'Insalata mista', k:14, p:1.4, c:1.8, g:0.2, cat:'Frutta/Verdura'},
  {n:'Spinaci', k:31, p:3.4, c:2.9, g:0.7, cat:'Frutta/Verdura'},
  {n:'Carote', k:35, p:1.1, c:7.6, g:0.2, cat:'Frutta/Verdura', nt:'Snack libero'},
  {n:'Finocchi', k:9, p:1.2, c:1, g:0.3, cat:'Frutta/Verdura', nt:'Snack libero'},
  {n:'Minestrone di verdure', k:30, p:1.5, c:4.5, g:0.7, cat:'Frutta/Verdura'},
  {n:'Olio di oliva extra vergine', k:899, p:0, c:0, g:99.9, cat:'Grassi', nt:'1 cucchiaio = 10 g'},
  {n:'Mandorle', k:603, p:22, c:4.6, g:55.3, cat:'Grassi', nt:'10 mandorle = 12 g'},
  {n:'Noci sgusciate', k:689, p:14.3, c:5.1, g:68.1, cat:'Grassi', nt:'1 noce = 5 g'},
  {n:'Pistacchi non salati', k:608, p:18.1, c:16.8, g:51.6, cat:'Grassi'},
  {n:'Nocciole', k:655, p:13.8, c:10.5, g:62.9, cat:'Grassi'},
  {n:'Burro di arachidi 100%', k:588, p:25, c:12, g:50, cat:'Grassi', nt:'Solo arachidi, senza zuccheri'},
  {n:'Avocado', k:160, p:2, c:2, g:15, cat:'Grassi'},
  {n:'Cioccolato fondente 85%', k:550, p:10, c:20, g:45, cat:'Altro', nt:'Max 10 g/die'},
  {n:'Miele', k:304, p:0.3, c:80, g:0, cat:'Altro', nt:'Max 1 cucchiaino'},
  {n:'Marmellata senza zuccheri agg.', k:150, p:0.5, c:32, g:0.3, cat:'Altro'},
  {n:'Whey protein isolate', k:380, p:80, c:6, g:4, cat:'Altro', nt:'OPZIONALE - non in uso'},
  {n:'Barretta proteica', k:360, p:32, c:30, g:12, cat:'Altro', nt:'Solo emergenza in turno'}
];

/* Categorie nell'ordine in cui compaiono nella ricerca. */
const CATEGORIE = ['Latticini/Uova', 'Carne', 'Pesce', 'Cereali', 'Legumi', 'Frutta/Verdura', 'Grassi', 'Altro'];

/* Emoji per categoria: servono a distinguere le righe a colpo d'occhio in una
   lista lunga, dove leggere il nome per intero costa più di guardare un simbolo. */
const CAT_ICON = {
  'Latticini/Uova': '\u{1F95B}', 'Carne': '\u{1F357}', 'Pesce': '\u{1F41F}', 'Cereali': '\u{1F35A}',
  'Legumi': '\u{1FAD8}', 'Frutta/Verdura': '\u{1F966}', 'Grassi': '\u{1FAD2}', 'Altro': '\u{1F36B}'
};

/* Porzioni comode: quando la nota del database dice quanto pesa un pezzo,
   qui diventa un pulsante. Evita di dover ricordare che una noce fa 5 g. */
const PORZIONI = {
  'Uovo intero': [{ l: '1 uovo', q: 55 }, { l: '2 uova', q: 110 }, { l: '3 uova', q: 165 }],
  'Albume d\'uovo': [{ l: '1 albume', q: 33 }, { l: '3 albumi', q: 100 }],
  'Olio di oliva extra vergine': [{ l: '1 cucchiaio', q: 10 }, { l: '2 cucchiai', q: 20 }, { l: 'max giornaliero', q: 25 }],
  'Mandorle': [{ l: '10 mandorle', q: 12 }, { l: '15 mandorle', q: 18 }],
  'Noci sgusciate': [{ l: '2 noci', q: 10 }, { l: '3 noci', q: 15 }],
  'Fette biscottate integrali': [{ l: '2 fette', q: 20 }, { l: '4 fette', q: 40 }],
  'Yogurt greco 0% grassi': [{ l: '1 vasetto', q: 150 }, { l: '1 vasetto grande', q: 250 }],
  'Tonno al naturale sgocciolato': [{ l: '1 scatoletta', q: 52 }, { l: '2 scatolette', q: 104 }, { l: '3 scatolette', q: 150 }],
  'Parmigiano Reggiano': [{ l: '1 cucchiaio', q: 10 }, { l: 'max giornaliero', q: 20 }],
  'Cioccolato fondente 85%': [{ l: '1 quadretto', q: 5 }, { l: '2 quadretti', q: 10 }]
};

/* Le fasce della giornata. L'ordine è quello dell'orologio: la barra dei totali
   e il diario seguono questo elenco, non l'ordine di inserimento. */
const PASTI = [
  { id: 'colazione', l: 'Colazione', ic: '\u2615' },
  { id: 'spuntino1', l: 'Spuntino mattina', ic: '\u{1F34E}' },
  { id: 'pranzo',    l: 'Pranzo',    ic: '\u{1F37D}\uFE0F' },
  { id: 'spuntino2', l: 'Spuntino pomeriggio', ic: '\u{1F95C}' },
  { id: 'cena',      l: 'Cena',      ic: '\u{1F373}' },
  { id: 'spuntino3', l: 'Spuntino sera / turno notte', ic: '\u{1F319}' }
];

/* Nomi per il completamento automatico quando componi una scheda.
   Raggruppati come una PPL, che è la struttura su cui è tarato il piano. */
const ESERCIZI = {
  'Spinta (Push)': [
    'Panca piana con bilanciere', 'Panca inclinata con manubri', 'Panca piana con manubri',
    'Chest press alla macchina', 'Croci ai cavi', 'Croci con manubri su panca',
    'Military press con bilanciere', 'Lento avanti con manubri', 'Alzate laterali',
    'Alzate laterali al cavo', 'Dip alle parallele', 'Push down ai cavi',
    'French press', 'Estensioni tricipiti sopra la testa', 'Piegamenti a terra'
  ],
  'Tirata (Pull)': [
    'Trazioni alla sbarra', 'Lat machine avanti', 'Lat machine presa inversa',
    'Pulley basso', 'Rematore con bilanciere', 'Rematore con manubrio',
    'Pull-over ai cavi', 'Face pull', 'Alzate posteriori', 'Curl con bilanciere',
    'Curl con manubri', 'Hammer curl', 'Curl alla panca Scott', 'Shrug con manubri'
  ],
  'Gambe (Legs)': [
    'Squat con bilanciere', 'Front squat', 'Pressa 45\u00b0', 'Hack squat',
    'Affondi con manubri', 'Bulgarian split squat', 'Stacco rumeno',
    'Stacco da terra', 'Leg extension', 'Leg curl sdraiato', 'Leg curl seduto',
    'Hip thrust', 'Calf raise in piedi', 'Calf raise seduto', 'Adduttori alla macchina'
  ],
  'Core': [
    'Plank', 'Plank laterale', 'Crunch a terra', 'Crunch ai cavi',
    'Leg raise alla sbarra', 'Russian twist', 'Ab wheel', 'Hollow hold'
  ],
  'Cardio': [
    'Corsa', 'Camminata veloce', 'Camminata in salita al tapis roulant',
    'Cyclette', 'Ellittica', 'Vogatore', 'Salto con la corda', 'Nuoto'
  ]
};

/* Il cardio si misura in minuti e distanza, non in serie e ripetizioni:
   l'app cambia i campi in base a questo elenco. */
const GRUPPI_CARDIO = ['Cardio'];
