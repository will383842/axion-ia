import os, hashlib, json, collections, re, sys

base = sys.argv[1]          # path to "Images Axion-IA"
out  = sys.argv[2]          # scratchpad dir

def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()

files = []
for root, dirs, fs in os.walk(base):
    for f in fs:
        if not f.lower().endswith('.png'):
            continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, base).replace(os.sep, '/')
        files.append(rel)

def _fold(s):
    # strip accents + lowercase for robust matching (NFD → drop combining marks)
    import unicodedata
    n = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in n if not unicodedata.combining(c)).lower()

def module_of(rel):
    top = _fold(rel.split('/')[0])
    r = _fold(rel)
    if r.startswith('villes/'):
        return ('ville', rel.split('/')[1], None)
    if r.startswith('1 to 1/dirigeant'):
        return ('un-a-un', None, 'dirigeant')
    if r.startswith('1 to 1/membre'):
        return ('un-a-un', None, 'equipe')
    if top == 'audit': return ('audit', None, None)
    if top.startswith('formations & interventions'): return ('interventions_formations', None, None)
    if top.startswith('automatisations'): return ('implementations', None, None)
    if top == 'logos': return ('logo', None, None)
    if top.startswith('graphiques'): return ('graphique', None, None)
    if top.startswith('tous types de propositions'): return ('proposition', None, None)
    if top.startswith('images cas concrets'): return ('cas-concret', None, None)
    if 'par ville' in top and top.startswith('photo'): return ('ville-hero', None, None)
    if top.startswith('photos_formations'): return ('formation-photo', None, None)
    if top.startswith('captures'): return ('screenshot', None, None)
    if top == 'favicon': return ('favicon', None, None)
    if top == 'expression': return ('expression', None, None)
    if top.startswith('axion-ia_visuels_banni'): return ('banniere', None, None)
    return ('proposition', None, None)

def is_leftover(rel):
    return os.path.basename(rel).startswith('Hub_ville_')

def clean_slug(rel):
    return re.sub(r'\.png$', '', os.path.basename(rel))

def city_from(rel):
    mm = re.search(r'hero-ville-([a-z0-9-]+?)-consultant', clean_slug(rel))
    return mm.group(1) if mm else None

groups = collections.defaultdict(list)
for rel in files:
    groups[md5(os.path.join(base, rel))].append(rel)

manifest = []
excluded_leftovers = []
for hh, rels in groups.items():
    keep = [r for r in rels if not is_leftover(r)]
    left = [r for r in rels if is_leftover(r)]
    excluded_leftovers += left
    if not keep:
        keep = rels
    canonical = sorted(keep, key=lambda r: (len(clean_slug(r)), clean_slug(r)))[0]
    mod, city, persona = module_of(canonical)
    if mod == 'ville-hero':
        city = city_from(canonical)
    slug = clean_slug(canonical)
    itype = 'carre' if slug.endswith('carre') else ('banniere' if 'banniere' in slug else 'photo')
    manifest.append({
        'hash': hh,
        'canonical_slug': slug,
        'source': canonical,
        'module': mod, 'city': city, 'persona': persona,
        'image_type': itype,
        'duplicate_slugs': [clean_slug(r) for r in keep if r != canonical],
        'leftover_copies': left,
    })

manifest.sort(key=lambda x: (x['module'], x['canonical_slug']))
json.dump(manifest, open(os.path.join(out, 'image-manifest.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

from collections import Counter
bymod = Counter(x['module'] for x in manifest)
dups = [x for x in manifest if x['duplicate_slugs']]
print("=== MANIFESTE ===")
print("total fichiers png:", len(files))
print("images uniques:", len(manifest))
print("fichiers leftover Hub_ville_ exclus:", len(excluded_leftovers))
print("images avec slug(s) dupliqué(s):", len(dups))
print("\npar module:")
for k, v in sorted(bymod.items(), key=lambda x: -x[1]):
    print(f"  {v:3} {k}")
print("\n=== SLUGS DUPLIQUES (canonical <= autres) ===")
for x in dups:
    print(f"  [{x['module']}] {x['canonical_slug']}  <=  {', '.join(x['duplicate_slugs'])}")
