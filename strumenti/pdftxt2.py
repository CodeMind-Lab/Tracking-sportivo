"""Testo da PDF, guardando solo i flussi di contenuto delle pagine.

La versione precedente decodificava qualunque oggetto contenesse un operatore
di testo, e finiva per leggere i programmi dei font incorporati. Qui si parte
dalle pagine e si segue il loro /Contents: e' l'unico posto dove sta il testo
che si vede.
"""
import re, sys, zlib

dati = open(sys.argv[1], 'rb').read()

oggetti = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj(.*?)endobj', dati, re.S):
    oggetti.setdefault(int(m.group(1)), m.group(2))

def flusso(obj):
    m = re.search(rb'stream\r?\n', obj)
    if not m: return None
    grezzo = obj[m.end():obj.find(b'endstream', m.end())]
    if b'/FlateDecode' in obj[:m.start()]:
        try: return zlib.decompressobj().decompress(grezzo)
        except Exception: return None
    return grezzo

# mappa dei caratteri di ogni font (ToUnicode)
def mappa_di(num):
    obj = oggetti.get(num, b'')
    m = re.search(rb'/ToUnicode\s+(\d+)\s+0\s+R', obj)
    if not m: return {}
    s = flusso(oggetti.get(int(m.group(1)), b'')) or b''
    mp = {}
    for mm in re.finditer(rb'beginbfchar(.*?)endbfchar', s, re.S):
        for a, b in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', mm.group(1)):
            mp[int(a, 16)] = ''.join(chr(int(b[i:i+4], 16)) for i in range(0, len(b), 4))
    for mm in re.finditer(rb'beginbfrange(.*?)endbfrange', s, re.S):
        for a, b, c in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', mm.group(1)):
            base = int(c[:4], 16)
            for k in range(int(a, 16), int(b, 16) + 1):
                mp[k] = chr(base + k - int(a, 16))
    return mp

pagine = [(n, o) for n, o in oggetti.items() if re.search(rb'/Type\s*/Page[^s]', o)]
pagine.sort()

for idx, (num, pag) in enumerate(pagine, 1):
    # i font disponibili in questa pagina
    fonti = {}
    for nome, rif in re.findall(rb'/(F\w+|TT\d+|C\d+_\d+|[A-Za-z]\w*)\s+(\d+)\s+0\s+R', pag):
        mp = mappa_di(int(rif))
        if mp: fonti[nome.decode('latin-1')] = mp
    if not fonti:
        for mr in re.finditer(rb'/Resources\s+(\d+)\s+0\s+R', pag):
            res = oggetti.get(int(mr.group(1)), b'')
            for nome, rif in re.findall(rb'/(\w+)\s+(\d+)\s+0\s+R', res):
                mp = mappa_di(int(rif))
                if mp: fonti[nome.decode('latin-1')] = mp

    contenuti = re.findall(rb'/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]*)\])', pag)
    rifs = []
    for a, b in contenuti:
        if a: rifs.append(int(a))
        else: rifs += [int(x) for x in re.findall(rb'(\d+)\s+0\s+R', b)]

    s = b''.join((flusso(oggetti.get(r, b'')) or b'') for r in rifs)
    if not s: continue

    corrente, out = {}, []
    for m in re.finditer(rb'/(\w+)\s+[\d.]+\s+Tf|\((?:[^()\\]|\\.)*\)|<([0-9A-Fa-f\s]+)>|TJ|Tj|T\*|TD|Td|ET|BT', s):
        tok = m.group(0)
        if tok.endswith(b'Tf'):
            corrente = fonti.get(m.group(1).decode('latin-1'), {})
        elif tok in (b'T*', b'ET', b'BT'):
            out.append('\n')
        elif tok in (b'Td', b'TD'):
            out.append(' ')
        elif tok.startswith(b'('):
            t = tok[1:-1].decode('latin-1')
            t = re.sub(r'\\([0-7]{1,3})', lambda x: chr(int(x.group(1), 8)), t)
            t = t.replace('\\(', '(').replace('\\)', ')')
            out.append(''.join(corrente.get(ord(ch), ch) for ch in t) if corrente else t)
        elif tok.startswith(b'<'):
            h = re.sub(rb'\s', b'', m.group(2))
            cod = [int(h[i:i+4], 16) for i in range(0, len(h) - 3, 4)] if len(h) % 4 == 0 else []
            if not cod or (corrente and not all(c in corrente for c in cod)):
                cod = [int(h[i:i+2], 16) for i in range(0, len(h) - 1, 2)]
            out.append(''.join(corrente.get(c, '') for c in cod))

    testo = re.sub(r'\n{3,}', '\n\n', ''.join(out))
    print(f'\n########## PAGINA {idx} ##########')
    print(testo.strip())
