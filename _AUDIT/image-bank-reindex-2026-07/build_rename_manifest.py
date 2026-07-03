import json, sys, os

scratch = sys.argv[1]
man = json.load(open(os.path.join(scratch, 'image-manifest.json'), encoding='utf-8'))

# Slots mis en quarantaine : image dont le slug canonique MENT sur le contenu (vérif visuelle).
# On ne publie pas ces images (poison SEO/AEO). Will fournira le bon visuel distinct.
DROP_CANONICAL = {
    'axion-ia-cas-concret-analyse-contrats-clauses-risques-ia-rapide-carre',   # visuel = onboarding client
    'axion-ia-cas-concret-generation-contenu-reseaux-sociaux-ia-batch-carre',  # visuel = veille concurrentielle
}
# Modules exclus de la publication auto (non pertinents / sensibles).
EXCLUDE_MODULES = {'favicon', 'screenshot', 'expression'}

# module → category (convert-all déclenche le mode logo si category === "logos")
def category_of(module):
    return 'logos' if module == 'logo' else module

def split_source(rel):
    parts = rel.split('/')
    top = parts[0]
    if top == 'Villes':
        return ('Villes', '/'.join(parts[1:]))          # "Paris/xxx.png"
    if top == '1 TO 1':
        return ('1 TO 1/' + parts[1], '/'.join(parts[2:]))  # sourceFolder mappé dans FOLDER_MAP
    return (top, '/'.join(parts[1:]))                    # dossier plat → basename

rename = []
quarantine = []
excluded = []
i = 0
for e in man:
    slug = e['canonical_slug']
    mod = e['module']
    if slug in DROP_CANONICAL:
        quarantine.append({'slug': slug, 'module': mod, 'source': e['source'],
                           'reason': 'image ne correspond pas au slug (vérif visuelle)',
                           'duplicate_slugs': e['duplicate_slugs']})
        continue
    if mod in EXCLUDE_MODULES:
        excluded.append({'slug': slug, 'module': mod, 'source': e['source']})
        continue
    i += 1
    sf, src = split_source(e['source'])
    rename.append({
        'id': i,
        'source': src,
        'sourceFolder': sf,
        'targetSlug': slug,
        'type': e['image_type'],
        'category': category_of(mod),
        'city': e['city'],
        'persona': e['persona'],
    })

# slugs secondaires (variantes / doublons) volontairement non publiés — trace
dropped_dupe_slugs = []
for e in man:
    for d in e['duplicate_slugs']:
        dropped_dupe_slugs.append({'kept': e['canonical_slug'], 'dropped_duplicate': d})

out_manifest = os.path.join(scratch, '00-rename-manifest.NEW.json')
json.dump(rename, open(out_manifest, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

report = {
    'generated': 'regen 2026-07-03 (221 uniques → publiés)',
    'total_unique_images': len(man),
    'published': len(rename),
    'quarantine_wrong_label': quarantine,
    'excluded_modules': excluded,
    'dropped_duplicate_slugs': dropped_dupe_slugs,
}
json.dump(report, open(os.path.join(scratch, 'quarantine-report.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

from collections import Counter
print("publiés:", len(rename), "| quarantaine:", len(quarantine), "| exclus (favicon/captures):", len(excluded))
print("doublons secondaires non publiés:", len(dropped_dupe_slugs))
print("\npar category (manifeste publié):")
for k, v in sorted(Counter(r['category'] for r in rename).items(), key=lambda x: -x[1]):
    print(f"  {v:3} {k}")
print("\nQUARANTAINE (à traiter par Will) :")
for q in quarantine:
    print("  -", q['slug'], " | dup:", ', '.join(q['duplicate_slugs']))
print("\nEXCLUS :", ', '.join(sorted(set(x['module'] for x in excluded))))
