# Vérification de la prod après mise en ligne

Script en lecture seule (GET uniquement, User-Agent `axion-verif/1.0`, aucune dépendance nouvelle).

```bash
pnpm exec tsx scripts/ops/verif-prod-knowledge.ts [urlDeBase]   # défaut https://axion-ia.com
```

Contrôles : `/fr/journee-ia` en 200 avec « 1 490 » ; aucun montant en euros autre que 1 490 sur l'accueil, `/fr/tarifs`, `/fr/faq`, 5 pages `/fr/faq/par-thematique/*` et 10 pages ville (tirées du sitemap) ; `/fr/cas-concrets` en 301 vers `/fr/methodologie` ; « Grenoble » absent hors `/fr/mentions-legales` ; aucun JSON-LD ville dont `addressLocality` égale la ville de la page.

Sortie : tableau OK/ECHEC, code de sortie 1 au moindre échec.

**Liste blanche** des montants légaux : `MONTANTS_BLANCS` dans `scripts/ops/lib/verif-prod-knowledge.ts` (vide par défaut ; n'y mettre qu'un montant légal, jamais un prix).

**Charge** : ne pas lancer plus de 2 fois contre la prod. Garde-fous dans le script : 4 sous-sitemaps lus au plus (FAQ + 3 sitemaps villes), pause de 500 ms entre deux requêtes, délai d'expiration de 15 s, plafond dur de 30 requêtes par passage (environ 25 en pratique).

Tests : `pnpm exec vitest run tests/unit/ops/verif-prod-knowledge.spec.ts` (fixtures locales, aucun réseau).
