"""Scarica le tabelle CREA una pagina alla volta, con una pausa fra una e
l'altra: e' un portale pubblico di un ente di ricerca, non un servizio da
martellare. Fonte: CREA - Tabelle di Composizione degli Alimenti,
alimentinutrizione.it"""
import json, re, time, subprocess, os, sys

UA = 'Forma/1.0 (progetto personale di diario alimentare; contatto renatonoto5396@gmail.com)'
codici = open('codici.txt').read().split()
out = {}
if os.path.exists('grezzi.json'):
    out = json.load(open('grezzi.json'))

def testo(h):
    h = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', h, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)).replace('\xa0', ' ')

def valore(t, etichetta):
    """Il valore per 100 g sta subito dopo l'unita' di misura, e puo' essere
       'tr' (tracce) o vuoto quando il dato non c'e'."""
    m = re.search(re.escape(etichetta) + r'\s+(?:g \(N x 6,25\)|kcal|kJ|g|mg)\s+([\d.,]+|tr)\b', t)
    if not m: return None
    v = m.group(1)
    if v == 'tr': return 0.0
    try: return float(v.replace(',', '.'))
    except ValueError: return None

falliti = []
for i, c in enumerate(codici):
    if c in out: continue
    try:
        # curl invece di urllib: questa installazione di Python non ha i
        # certificati radice configurati e ogni https fallisce in partenza.
        h = subprocess.run(
            ['curl', '-sS', '-m', '25', '-A', UA,
             'https://www.alimentinutrizione.it/tabelle-nutrizionali/' + c],
            capture_output=True, text=True, check=True).stdout
        if len(h) < 2000: raise RuntimeError('pagina troppo corta')
        t = testo(h)
        # il titolo della pagina è "AlimentiNUTrizione - <nome dell'alimento>"
        tit = re.search(r'<title>(.*?)</title>', h, re.S)
        nome = re.sub(r'^AlimentiNUTrizione\s*-\s*', '',
                      re.sub(r'\s+', ' ', tit.group(1)).strip()) if tit else ''
        cat = re.search(r'Categoria\s+(.*?)\s+Codice Alimento', t)
        out[c] = {
            'n': nome,
            'cat': cat.group(1).strip() if cat else '',
            'k': valore(t, 'Energia (kcal)'),
            'p': valore(t, 'Proteine (g)'),
            'g': valore(t, 'Lipidi (g)'),
            'c': valore(t, 'Carboidrati disponibili (g)'),
            'fib': valore(t, 'Fibra totale (g)'),
        }
    except Exception as e:
        falliti.append((c, str(e)[:60]))
    if i % 40 == 0:
        json.dump(out, open('grezzi.json', 'w'), ensure_ascii=False)
        print(f'{i}/{len(codici)} · raccolti {len(out)} · falliti {len(falliti)}', flush=True)
    time.sleep(0.28)

json.dump(out, open('grezzi.json', 'w'), ensure_ascii=False)
print('FINE · raccolti', len(out), '· falliti', len(falliti))
if falliti: print('esempi di errore:', falliti[:5])
