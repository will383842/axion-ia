# 05 — PLAN BACKLINKS (autorité off-site) — 2026-06-05

> Réponse à « j'ai quelques backlinks mais GSC ne les montre pas ». **Diagnostic prouvé + plan d'acquisition de liens dofollow.**
> Lien direct avec l'indexation : l'autorité off-site est **le levier n°1 du crawl-rate** → débloque l'indexation au-delà de la technique (P0).

---

## 1. Diagnostic des 3 liens fournis (vérifié live 2026-06-05)

| Lien | Statut | Lien vers axion-ia.com | Type | Valeur SEO |
|---|---|---|---|---|
| `indiehackers.com/AxionIA` | 200, indexable | ✅ `<a href="https://axion-ia.com" rel="nofollow">` (server-rendered) | **nofollow** | 0 autorité ; OK entité |
| `about.me/axion-ia` | 200, indexée | ✅ `<a href="https://axion-ia.com" rel="nofollow noopener">` | **nofollow** | 0 autorité ; OK entité |
| `linkedin.com/company/123134154/admin/dashboard/` | redirige vers **login** | ❌ (mur d'auth) | **non-public** (URL admin) | aucune |

**Conclusion** : **0 backlink dofollow**. Les 2 vrais liens sont `nofollow` (ne transmettent pas d'autorité et ne sont quasi jamais listés dans le rapport « Liens » de GSC) ; le LinkedIn fourni est l'URL admin privée (Google ne voit qu'un login). → « Pas dans GSC » est **mécaniquement normal**, pas un bug.

**Leur vraie valeur** = vérification d'entité (`sameAs`), pas du jus SEO. → **Intégrés au correctif A-14** (about.me + indiehackers ajoutés au `Organization.sameAs`).

---

## 2. Ce qu'il faut viser : liens DOFOLLOW depuis pages déjà crawlées

Règle : **5-10 liens dofollow depuis des domaines à autorité déjà bien indexés** > 50 profils nofollow. Un lien depuis une page crawlée quotidiennement est traité en jours et fait monter crawl-rate + autorité.

### Tier A — Annuaires & écosystèmes FR (dofollow, rapides) — *semaine 1-2*
- **French Tech** (annuaire startups régional) — souvent dofollow.
- **BPI France / La French Tech Central**, **Station F ecosystem** (si éligible).
- Annuaires conseil/IA B2B FR (ex. annuaires cabinets conseil, plateformes prestataires : Malt profil entreprise, Sortlist, Codeur, etc.) — vérifier dofollow.
- **Société.com / Pappers / Infogreffe** : fiches entreprise auto-générées dès que le SIREN est public → **lien + cohérence NAP** (lié à A-14 : publier le SIREN active ces fiches).
- ⚠️ Éviter les fermes de liens / annuaires spam (risque qualité).

### Tier B — Presse & contenu éditorial (dofollow, fort impact) — *semaine 2-6*
- **Blueprint relations-presse** (déjà en mémoire) = le canal principal : retombées PQR/web/podcasts → liens éditoriaux dofollow.
- **Tribune / article invité** sur blogs tech/IA FR à autorité (dofollow contextuel).
- ⚠️ Medium, LinkedIn articles, la plupart des profils = **nofollow** → bons pour la marque/découverte, pas pour l'autorité.

### Tier C — Partenaires & clients — *continu*
- Page « ils nous font confiance » / études de cas chez les clients/partenaires avec lien retour dofollow.
- Logos partenaires technologiques (si programme partenaire avec page annuaire dofollow).

### Tier D — Signaux d'entité (nofollow, mais utiles E-E-A-T) — *semaine 1*
- Compléter & **rendre publics** : LinkedIn (page publiée + **vanity `linkedin.com/company/axion-ia`**), about.me, IndieHackers — déjà en `sameAs`.
- Crunchbase, Wikidata (item entité → puissant pour LLM/Knowledge Graph), GitHub org si pertinent.

---

## 3. Bonnes pratiques

- **Cible des liens** : pointer vers `https://axion-ia.com` (apex, fait un 301→/fr, OK) ou directement `https://axion-ia.com/fr` (évite 1 hop). Jamais vers une URL `/en/*` (301) ni un path noindex.
- **Ancres** : descriptives et variées (« cabinet IA opérationnel B2B », « audit IA PME »), pas sur-optimisées exact-match répétées.
- **Cohérence NAP** : même nom/adresse/téléphone partout (dépend de A-14). Active les fiches Société.com/Pappers automatiquement via le SIREN public.
- **Mesure** : suivre via **Bing Webmaster Tools** (plus rapide que GSC) + Ahrefs/Semrush free. Vérifier que chaque page référente est **indexée** (sinon le lien n'est pas traité).

---

## 4. Objectif chiffré

| Horizon | Liens dofollow visés | Effet attendu |
|---|---:|---|
| S1-2 | 3-5 (annuaires + fiches SIREN) | 1ers signaux d'autorité ; fiches entité |
| S3-6 | +3-5 (presse/éditorial) | hausse crawl-rate mesurable |
| 3 mois | 10-20 dofollow qualité | crawl-rate ↑↑ → amplifie l'indexation Tier 0/Tier 1 |

→ **Combiné au P0 technique** (sitemap cohorte), c'est ce qui fait passer de « crawl ~1-2/j » à un régime sain : la technique débloque le crawl du noyau, les liens dofollow **augmentent la taille** de ce crawl.

---

## 5. Action immédiate côté Will

1. **Publier la page LinkedIn** + créer le **vanity `linkedin.com/company/axion-ia`** (pour que le `sameAs` du code soit valide) ; vérifier en navigation privée déconnectée.
2. **Rendre le SIREN public** (cf. A-14) → active automatiquement les fiches Société.com / Pappers / Infogreffe (liens + entité).
3. M'exporter le **rapport Liens GSC** + (idéal) **Bing Webmaster Backlinks** → je valide l'état réel et priorise.
