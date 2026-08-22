# -*- coding: utf-8 -*-
"""Dal PDF del nutrizionista al CSV che l'app sa importare.

Ogni riga del piano ha la forma "<alimento> <misura casalinga> pari a <N> g".
I grammi si prendono da lì e non si toccano: sono la prescrizione. Quello che
va deciso e' solo a quale voce del database corrisponde ogni nome.
"""
import re, sys

MESI = re.compile(r'\s+')
testo = open('piano.txt', encoding='utf8').read()
pagine = re.split(r'########## PAGINA (\d+) ##########', testo)

PASTI = [
    ('Colazione',                'colazione'),
    ('Spuntino Mattina',         'spuntino1'),
    ('Pranzo',                   'pranzo'),
    ('Spuntino Pomeriggio',      'spuntino2'),
    ('Spuntino Post-allenamento','spuntino2'),
    ('Cena',                     'cena'),
]

MISURA = (r'(?:\d+\s*)?[½¼¾]?\s*'
          r'(?:porzioni|tazze|cucchiaini|cucchiai|unit\s*à\s*;?|fette|vasetti|pezzi|quadretti|barrette)')
RIGA = re.compile(r'(' + MISURA + r')\s*pari a\s*(\d+)\s*g', re.I)

# Nome sul PDF -> voce del database. Dove il piano e' generico ("Pesce",
# "Legumi") si sceglie la voce magra piu' comune, che e' quella che il piano
# intende: sono scelte, e vanno dette.
MAPPA = {
    'latte': 'Latte parz. scremato',
    'biscotti, integrali o ai cereali': 'Biscotti, integrali',
    'cioccolato fondente': 'Cioccolato fondente 85%',
    'frutta secca non salata (mandorle, nocciole, noci, pistacchi)': 'Mandorle',
    'pasta': 'Pasta di semola (cruda)',
    'minestrone': 'Minestrone di verdure',
    'olio di oliva extra vergine': 'Olio di oliva extra vergine',
    'parmigiano reggiano': 'Parmigiano Reggiano',
    'frutta fresca': 'Frutta fresca (media)',
    'verdura (in media), cruda': 'Verdura (media)',
    'pesce': 'Merluzzo / nasello',
    'patate, crude': 'Patate',
    'yogurt (0% lipidi)': 'Yogurt, 0% lipidi',
    'avena': "Fiocchi d'avena",
    'tonno al naturale': 'Tonno al naturale sgocciolato',
    'pane': 'Pane integrale',
    'pane tostato': 'Pane integrale',
    'bresaola, fesa di tacchino, prosciutto cotto': 'Bresaola',
    'bresaola, fesa di tacchino, prosciutto': 'Bresaola',
    'prosciutto cotto, fesa di tacchino, bresaola': 'Bresaola',
    'pollo (petto)': 'Petto di pollo',
    'fette biscottate': 'Fette biscottate integrali',
    'burro di arachidi': 'Burro di arachidi 100%',
    'legumi (in media), cotti': 'Ceci cotti',
    'uova di gallina': 'Uovo intero',
    'barretta proteica': 'Barretta proteica',
    'fiocchi di latte': 'Fiocchi di latte (cottage)',
    'crema 100 % mandorle': 'Mandorle',
    'avocado': 'Avocado',
    'carne tritata': 'Hamburger bovino magro',
    'hamburger': 'Hamburger bovino magro',
}

# Pagina del PDF -> nome della giornata nell'app
NOMI = {1: 'Giorno 1 off', 3: 'Giorno 2 off', 6: 'Giorno 3 off', 7: 'Giorno 4 off',
        2: 'Giorno 1 on',  4: 'Giorno 2 on',  5: 'Giorno 3 on'}

righe, ignorate, senzaMappa = [], [], set()

for i in range(1, len(pagine), 2):
    n = int(pagine[i])
    if n not in NOMI: continue
    corpo = MESI.sub(' ', pagine[i + 1])

    # taglia la pagina nei suoi pasti
    tagli = []
    for etichetta, slot in PASTI:
        # la à di "Quantità" arriva staccata dal PDF: va inclusa nel taglio,
        # altrimenti resta incollata al primo alimento del pasto
        for m in re.finditer(re.escape(etichetta) + r'\s+Quantit\s*à\s*', corpo):
            tagli.append((m.start(), m.end(), slot, etichetta))
    tagli.sort()

    for k, (ini, fin, slot, etichetta) in enumerate(tagli):
        blocco = corpo[fin:tagli[k + 1][0] if k + 1 < len(tagli) else len(corpo)]
        pos = 0
        for m in RIGA.finditer(blocco):
            nome = blocco[pos:m.start()].strip(' ;,')
            pos = m.end()
            grammi = int(m.group(2))
            # "o Riso Basmati" e' un'alternativa alla riga sopra, non una riga in piu'
            if re.match(r'^o\s+', nome, re.I):
                ignorate.append((NOMI[n], re.sub(r'^o\s+', '', nome, flags=re.I), grammi))
                continue
            chiave = re.sub(r'\s+', ' ', nome).strip().lower()
            db = MAPPA.get(chiave)
            if not db:
                senzaMappa.add(nome)
                continue
            righe.append((NOMI[n], etichetta, db, grammi, nome))

if senzaMappa:
    print('SENZA CORRISPONDENZA:', sorted(senzaMappa), file=sys.stderr)

ETICHETTA = {'Spuntino Post-allenamento': 'Spuntino pomeriggio',
             'Spuntino Mattina': 'Spuntino mattina',
             'Spuntino Pomeriggio': 'Spuntino pomeriggio'}

with open('piano-renato.csv', 'w', encoding='utf8') as f:
    f.write('giorno;pasto;alimento;grammi\n')
    for g, pasto, db, q, orig in righe:
        f.write(f'{g};{ETICHETTA.get(pasto, pasto)};{db};{q}\n')

print(f'{len(righe)} righe su {len(set(r[0] for r in righe))} giornate')
print(f'{len(ignorate)} alternative "oppure" lasciate fuori')
for g, n, q in ignorate:
    print(f'   {g}: {n} ({q} g)')
