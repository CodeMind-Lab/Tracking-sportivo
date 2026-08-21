"""Rimpiazza il blocco ALIMENTI dentro data.js con quello appena costruito."""
import re
blocco = open('blocco.js').read()
p = '/Users/renatonoto/Desktop/forma/data.js'
src = open(p).read()

i = src.index('const ALIMENTI = [\n') + len('const ALIMENTI = [\n')
j = src.index('\n];', i)
nuovo = src[:i] + blocco + src[j:]

# la nota in testa al file deve dire da dove vengono davvero i dati
nuovo = nuovo.replace(
""" * ALIMENTI: database CREA-Alimenti / LARN IV revisione, valori per 100 g di parte
 * edibile, pesi a CRUDO salvo dove la nota dice "cotti" o "sgocciolati". Non si
 * modifica: gli alimenti tuoi si aggiungono dall'app e finiscono in DB.items,
 * così viaggiano nella sincronizzazione.""",
""" * ALIMENTI: Tabelle di Composizione degli Alimenti del CREA (Centro di ricerca
 * alimenti e nutrizione), alimentinutrizione.it — valori per 100 g di parte
 * edibile. Dove il nome non dice "cotto" o "bollito" il peso è a CRUDO.
 * Questo file non si modifica a mano: gli alimenti tuoi si aggiungono dall'app,
 * finiscono in DB.items e viaggiano nella sincronizzazione. I prodotti
 * confezionati arrivano dalla scansione del codice a barre (Open Food Facts).""")
open(p, 'w').write(nuovo)
print('data.js aggiornato ·', len(nuovo), 'byte')
