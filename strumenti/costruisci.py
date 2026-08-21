# -*- coding: utf-8 -*-
"""Da grezzi.json al blocco ALIMENTI di data.js.

I 71 alimenti che c'erano prima restano intatti e in cima: i piani gia'
importati li richiamano per nome, e cambiarli sotto i piedi spezzerebbe il
collegamento. Dal CREA si aggiunge solo cio' che non c'e' gia'.
"""
import json, re, unicodedata, sys

CAT = {
    'Latte e derivati': 'Latticini/Uova',
    'Latte e yogurt': 'Latticini/Uova',
    'Formaggi e latticini': 'Latticini/Uova',
    'Uova': 'Latticini/Uova',
    'Carni fresche': 'Carne',
    'Frattaglie': 'Carne',
    'Carni trasformate e conservate': 'Carne',
    'Prodotti della pesca': 'Pesce',
    'Cereali e derivati': 'Cereali',
    'Tuberi': 'Cereali',
    'Legumi': 'Legumi',
    'Verdure e ortaggi': 'Frutta/Verdura',
    'Frutta': 'Frutta/Verdura',
    'Oli e grassi': 'Grassi',
    'Frutta secca a guscio e semi oleaginosi': 'Grassi',
    'Frutta secca a guscio e semi': 'Grassi',
    'Dolciumi': 'Altro',
    'Dolci': 'Altro',
    'Bevande alcoliche': 'Altro',
    'Bevande analcoliche': 'Altro',
    'Spezie e condimenti': 'Altro',
    'Prodotti vari': 'Altro',
    'Fast-food a base di carne': 'Carne',
    'Fast-food': 'Altro',
    'Piatti pronti': 'Altro',
    'Integratori': 'Altro',
}

def ridotto(s):
    s = unicodedata.normalize('NFD', (s or '').lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

grezzi = json.load(open('grezzi.json'))
esistenti = json.load(open('esistenti.json'))          # i 71 gia' nel file

visti = {ridotto(a['n']) for a in esistenti}
nuovi, scartati, senzaCat = [], 0, set()

for cod in sorted(grezzi):
    v = grezzi[cod]
    if not v['n'] or v['k'] is None:
        scartati += 1; continue
    # un alimento senza nessun macro non serve a un diario
    if v['p'] is None and v['c'] is None and v['g'] is None:
        scartati += 1; continue
    k = ridotto(v['n'])
    if k in visti:
        scartati += 1; continue
    visti.add(k)
    cat = CAT.get(v['cat'])
    if not cat:
        senzaCat.add(v['cat']); cat = 'Altro'
    nuovi.append({
        'n': v['n'],
        'k': round(v['k'], 1),
        'p': round(v['p'] or 0, 1),
        'c': round(v['c'] or 0, 1),
        'g': round(v['g'] or 0, 1),
        'cat': cat,
    })

print('esistenti', len(esistenti), '· nuovi dal CREA', len(nuovi), '· scartati', scartati)
if senzaCat:
    print('categorie CREA non mappate:', sorted(senzaCat))

def js(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def riga(a):
    parti = ['n:%s' % js(a['n']), 'k:%g' % a['k'], 'p:%g' % a['p'],
             'c:%g' % a['c'], 'g:%g' % a['g'], 'cat:%s' % js(a['cat'])]
    if a.get('nt'):
        parti.append('nt:%s' % js(a['nt']))
    return '  {' + ', '.join(parti) + '}'

tutti = esistenti + sorted(nuovi, key=lambda a: (a['cat'], ridotto(a['n'])))
open('blocco.js', 'w').write(',\n'.join(riga(a) for a in tutti))
print('totale nel file:', len(tutti))
