# -*- coding: utf-8 -*-
"""Dal PDF della scheda al CSV che l'app sa importare.

Il PDF scrive ogni esercizio come "N - nome" seguito da Serie:, Recupero: e a
volte Note:. Le tre cose da tradurre sono:

  Serie      "5x5" sono 5 serie da 5, ma "12-10-8-8" sono quattro serie con
             ripetizioni diverse: il numero di serie è quanti numeri ci sono.
  Recupero   il PDF scrive "1 min 30 sec", l'app vuole 1'30".
  Gruppo     non c'è nel PDF: lo assegno io, perché è quello che fa funzionare
             il volume per gruppo nel report. La mobilità va in Cardio, così
             l'app chiede i minuti invece di serie e ripetizioni finte.
"""
import re, sys

testo = open(sys.argv[1] if len(sys.argv) > 1 else 'scheda.txt', encoding='utf8').read()
# il PDF esce una parola per riga: rimetto tutto su una riga sola e taglio dopo
piatto = re.sub(r'\s+', ' ', testo.replace('########## PAGINA', '\n@@'))
piatto = re.sub(r'@@ \d+ ##########', '', piatto)
# intestazione ripetuta su ogni pagina: "<nome> Durata: ... Pagina 1/3"
piatto = re.sub(r'\S+(?: \S+)? Durata: \d+ settimane Scadenza: [\d/]+ '
                r'\S+(?: \S+)? Pagina \d/\d', '', piatto)
piatto = piatto.replace('Powered by TCPDF (www.tcpdf.org)', '')

# Ogni esercizio comincia con "N - ". Il giorno cambia a "GIORNO N", e le
# pagine spezzano un giorno a metà: il titolo si ripete e non va contato due
# volte, altrimenti il giorno 2 diventerebbe due giorni diversi.
pezzi = re.split(r'(GIORNO \d|(?<= )\d{1,2} - )', piatto)

GRUPPI = {
    ('Giorno 1', 1): 'Cardio',
    ('Giorno 2', 1): 'Cardio',
    ('Giorno 3', 1): 'Cardio',
}
DEFAULT = {'Giorno 1': 'Spinta (Push)', 'Giorno 2': 'Tirata (Pull)', 'Giorno 3': 'Gambe (Legs)'}
CORE = {('Giorno 1', 10), ('Giorno 1', 11),
        ('Giorno 2', 10), ('Giorno 2', 11),
        ('Giorno 3', 10), ('Giorno 3', 11)}
# nel giorno delle gambe le tre alzate sono spalle, non gambe
SPALLE = {('Giorno 3', 7), ('Giorno 3', 8), ('Giorno 3', 9)}
# la coppia in superserie: il PDF scrive le serie una volta sola, nella nota
SUPERSERIE = {('Giorno 2', 4): 4, ('Giorno 2', 5): 4}


def recupero(s):
    """"1 min 30 sec" -> 1'30" ; "40 sec" -> 40" ; "NO" -> vuoto."""
    s = (s or '').strip()
    if not s or s.upper() == 'NO':
        return ''
    mn = re.search(r'(\d+)\s*min', s)
    sc = re.search(r'(\d+)\s*sec', s)
    if mn and sc:
        return f"{mn.group(1)}'{sc.group(1)}\""
    if mn:
        return f"{mn.group(1)}'"
    if sc:
        return f'{sc.group(1)}"'
    return ''


def serie_e_rip(s):
    """Restituisce (serie, ripetizioni). Quello che non è un numero di serie
    resta nelle ripetizioni: buttarlo via perderebbe "gamba singola", "x lato",
    "presa stretta", che sono l'esercizio."""
    s = (s or '').strip()
    if not s:
        return '', ''
    # "5/7 minuti": è una durata, non delle serie
    m = re.match(r'^(\d+)\s*/\s*(\d+)\s*minuti$', s, re.I)
    if m:
        return 1, f'{m.group(1)}-{m.group(2)} minuti'
    # "4x8", "3x12+12", "3xmax presa stretta", "3x60''", "4x15 gamba singola"
    m = re.match(r'^(\d+)\s*x\s*(.+)$', s, re.I)
    if m:
        return int(m.group(1)), m.group(2).strip()
    # "12-10-8-8": una serie per numero
    if re.match(r'^\d+(\s*-\s*\d+)+$', s):
        return len(re.findall(r'\d+', s)), re.sub(r'\s*-\s*', '-', s)
    # "8 ripetizioni con corda" -> 8 ripetizioni, serie decise dalla nota
    m = re.match(r'^(\d+)\s*ripetizioni\s*(.*)$', s, re.I)
    if m:
        return '', (m.group(1) + ' ' + m.group(2)).strip()
    return '', s


righe = []
giorno = None
for i in range(1, len(pezzi), 2):
    testa, corpo = pezzi[i].strip(), pezzi[i + 1]
    if testa.startswith('GIORNO'):
        giorno = 'Giorno ' + testa.split()[1]
        continue
    if giorno is None:
        continue
    n = int(testa.rstrip(' -'))

    mS = re.search(r'Serie:\s*(.*?)(?=\s*(?:Recupero:|Note:|$))', corpo)
    mR = re.search(r'Recupero:\s*(.*?)(?=\s*(?:Note:|$))', corpo)
    mN = re.search(r'Note:\s*(.*)$', corpo)
    nome = corpo[:mS.start() if mS else (mR.start() if mR else len(corpo))].strip(' -;,')

    grezzo = (mS.group(1).strip() if mS else '')
    # "4x8 la puoi alternare anche con la chest press inclined": la coda è una
    # nota travestita da serie
    coda = ''
    m = re.match(r'^(\d+\s*x\s*\d+(?:\+\d+)?)\s+([a-zà-ù].{20,})$', grezzo, re.I)
    if m:
        grezzo, coda = m.group(1), m.group(2)

    serie, rip = serie_e_rip(grezzo)
    note = (mN.group(1).strip() if mN else '')
    if coda:
        note = (coda + '. ' + note).strip(' .') if note else coda

    if not serie and (giorno, n) in SUPERSERIE:
        serie = SUPERSERIE[(giorno, n)]
    if not serie and not rip:
        # l'esercizio senza "Serie:" è un rest-pause descritto tutto nella nota
        serie, rip = 1, 'vedi nota'

    gruppo = GRUPPI.get((giorno, n))
    if not gruppo:
        gruppo = 'Core' if (giorno, n) in CORE else \
                 'Spinta (Push)' if (giorno, n) in SPALLE else DEFAULT[giorno]

    righe.append((giorno, nome[0].upper() + nome[1:], serie, rip,
                  recupero(mR.group(1) if mR else ''), note.replace(';', ','), gruppo))

with open('scheda-renato.csv', 'w', encoding='utf8') as f:
    f.write('giorno;esercizio;serie;ripetizioni;recupero;note;gruppo\n')
    for r in righe:
        f.write(';'.join(str(x) for x in r) + '\n')

print(f'{len(righe)} esercizi su {len(set(r[0] for r in righe))} giornate')
for g in sorted(set(r[0] for r in righe)):
    print(f'  {g}: {sum(1 for r in righe if r[0] == g)} esercizi')
