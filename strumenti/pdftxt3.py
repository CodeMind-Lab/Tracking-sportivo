# -*- coding: utf-8 -*-
"""Testo da PDF, anche quando gli oggetti stanno dentro object stream.

I PDF moderni comprimono gli oggetti dentro flussi /ObjStm invece di scriverli
uno per uno: cercare "N 0 obj" nel file non trova più niente. Qui prima si
scompattano quei flussi, poi si procede come sempre.
"""
import re, sys, zlib

dati = open(sys.argv[1], 'rb').read()

def scompatta(intestazione, grezzo):
    if b'/FlateDecode' not in intestazione:
        return grezzo
    try:
        return zlib.decompressobj().decompress(grezzo)
    except Exception:
        return b''

def flusso_di(obj):
    m = re.search(rb'stream\r?\n?', obj)
    if not m: return None
    fine = obj.find(b'endstream', m.end())
    return scompatta(obj[:m.start()], obj[m.end():fine])

# --- oggetti scritti in chiaro ---
# L'intestazione va ancorata a un a capo: dentro i flussi compressi capita di
# trovare per caso byte che somigliano a "12 0 obj", e un falso inizio si
# mangia gli oggetti veri che vengono dopo.
oggetti = {}
for m in re.finditer(rb'(?:^|[\r\n])(\d+)\s+\d+\s+obj', dati):
    fine = dati.find(b'endobj', m.end())
    if fine < 0: continue
    oggetti.setdefault(int(m.group(1)), dati[m.end():fine])

# --- oggetti dentro gli object stream ---
for num, obj in list(oggetti.items()):
    if b'/ObjStm' not in obj: continue
    s = flusso_di(obj)
    if not s: continue
    n = int(re.search(rb'/N\s+(\d+)', obj).group(1))
    primo = int(re.search(rb'/First\s+(\d+)', obj).group(1))
    testa = s[:primo].split()
    for i in range(n):
        try:
            onum = int(testa[2 * i]); off = int(testa[2 * i + 1])
            fine = int(testa[2 * i + 3]) + primo if 2 * i + 3 < len(testa) else len(s)
            oggetti.setdefault(onum, s[primo + off:fine])
        except (IndexError, ValueError):
            break

def mappa_di(num):
    obj = oggetti.get(num, b'')
    m = re.search(rb'/ToUnicode\s+(\d+)\s+0\s+R', obj)
    if not m: return {}
    s = flusso_di(oggetti.get(int(m.group(1)), b'')) or b''
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

pagine = sorted((n, o) for n, o in oggetti.items() if re.search(rb'/Type\s*/Page[^s]', o))

for idx, (num, pag) in enumerate(pagine, 1):
    fonti = {}
    mres = re.search(rb'/Resources\s+(\d+)\s+0\s+R', pag)
    res = oggetti.get(int(mres.group(1)), b'') if mres else pag
    # /Font può essere scritto lì o essere un rimando a un altro oggetto:
    # senza seguirlo si finisce a cercare la mappa dei caratteri nel dizionario
    # sbagliato, e il testo esce come numeri di glifo.
    mfont = re.search(rb'/Font\s*<<(.*?)>>', res, re.S)
    if mfont:
        blocco = mfont.group(1)
    else:
        mrif = re.search(rb'/Font\s+(\d+)\s+0\s+R', res)
        blocco = oggetti.get(int(mrif.group(1)), b'') if mrif else res
    for nome, rif in re.findall(rb'/(\w+)\s+(\d+)\s+0\s+R', blocco):
        mp = mappa_di(int(rif))
        if mp: fonti[nome.decode('latin-1')] = mp

    rifs = []
    for a, b in re.findall(rb'/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]*)\])', pag):
        if a: rifs.append(int(a))
        else: rifs += [int(x) for x in re.findall(rb'(\d+)\s+0\s+R', b)]
    s = b''.join((flusso_di(oggetti.get(r, b'')) or b'') for r in rifs)
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

    print(f'\n########## PAGINA {idx} ##########')
    print(re.sub(r'\n{3,}', '\n\n', ''.join(out)).strip())
