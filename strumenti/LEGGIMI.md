# Come è stato costruito il database degli alimenti

Questi script non fanno parte dell'app: servono solo se un domani vorrai
**rifare o aggiornare** `data.js`. L'app funziona senza.

I dati vengono dalle **Tabelle di Composizione degli Alimenti del CREA**
(Centro di ricerca alimenti e nutrizione), che si consultano liberamente su
[alimentinutrizione.it](https://www.alimentinutrizione.it) citando la fonte.
Non esiste né un'API né un file da scaricare: le schede sono pagine web
normali, e si leggono una alla volta.

## I tre passi

```bash
cd strumenti
python3 scarica.py      # ~6 minuti: 832 schede, una pausa fra l'una e l'altra
python3 costruisci.py   # filtra, mappa le categorie, scarta i doppioni
python3 applica.py      # riscrive il blocco ALIMENTI dentro ../data.js
```

`scarica.py` riprende da dove si era fermato: se lo interrompi e lo rilanci,
non riscarica quello che ha già. Il risultato grezzo resta in `grezzi.json`,
quindi per rifare solo la parte di elaborazione bastano gli ultimi due passi.

## I file

| File | Cosa contiene |
|---|---|
| `codici.txt` | Gli 832 codici alimento, presi dall'indice del portale |
| `grezzi.json` | Quello che è stato letto dalle pagine, senza ritocchi |
| `scarica.py` | Scarica e legge le schede |
| `costruisci.py` | Da `grezzi.json` al blocco JavaScript, con la mappa delle categorie |
| `applica.py` | Innesta il blocco in `../data.js` |

## Due cose da sapere

**I 71 alimenti originali non si toccano.** `costruisci.py` li rilegge da
`esistenti.json` e li rimette in cima identici: i piani alimentari già
importati li richiamano per nome, e cambiarli sotto i piedi spezzerebbe il
collegamento. Dal CREA entra solo ciò che non c'è già.

**Sii gentile col portale.** La pausa fra una pagina e l'altra
(`time.sleep(0.28)`) c'è apposta: è il sito di un ente di ricerca pubblico,
non un servizio da martellare. Non toglierla.

## Un controllo che vale la pena rifare

Per ogni alimento le calorie dovrebbero tornare con la somma dei macro a
4/4/9 kcal per grammo. Le uniche voci che sballano sono le bevande alcoliche,
dove le calorie vengono dall'alcol (7 kcal/g) e non da proteine, carboidrati
o grassi: lì lo scarto è giusto.
