# Plan de génération LLM massive — 2150 villes françaises

**Sprint A · Phase génération contenu ville · 2026-05-25**

---

## Stratégie stratifiée par tier

| Tier      | Villes ciblées                                                      | Nb villes  | Generators actifs                                             | Mots/page | Coût estimé       |
| --------- | ------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- | --------- | ----------------- |
| 1         | > 500 000 hab. (Paris, Marseille, Lyon, Toulouse) + 100 000–500 000 | ~100       | `ecosystem` + `secteurs` + `faq-extended` + `cas-usage` (× 4) | 800–1 200 | ~$25–35           |
| 2         | 20 000–100 000 (villes moyennes)                                    | ~400       | `ecosystem` + `faq-extended` (× 2)                            | 400–700   | ~$35–50           |
| 3         | < 20 000 (petites communes)                                         | ~1 650     | Géré par `landing-ville-shared.ts` seul                       | 300–500   | $0 supplémentaire |
| **TOTAL** | —                                                                   | **~2 150** | —                                                             | —         | **~$60–85**       |

> Les 4 generators (secteurs, faq-extended, cas-usage) peuvent ne pas encore exister au moment du run : le script les importe en `dynamic import` conditionnel et skip silencieusement si le module est absent.

---

## Script disponible

```
scripts/regen-villes-stratified.ts
```

---

## Instructions pour Will

### Pré-requis (vérifier avant de lancer)

1. **DB opérationnelle** : `pnpm db:up` + `pnpm prisma:migrate` si besoin
2. **Seed villes** : `pnpm db:seed:cities-order` (la table `City` doit être peuplée)
3. **Variables d'environnement** :
   - `DATABASE_URL` — Postgres de prod ou local (pas `stub.invalid`)
   - `ANTHROPIC_API_KEY` — clé Anthropic active avec budget suffisant
   - `OPENAI_API_KEY` — fallback provider (optionnel mais recommandé)
4. **Generators Sprint A** présents : vérifier que les 3 nouveaux generators existent dans `src/server/content-gen/generators/`. Si absents, le script les skip gracieusement.

### Commandes de lancement

```bash
# Test dry-run avant toute dépense LLM
pnpm tsx scripts/regen-villes-stratified.ts --tier=1 --dry-run

# Tier 1 uniquement (~100 villes, 4 generators, ~$25-35)
pnpm tsx scripts/regen-villes-stratified.ts --tier=1

# Tier 2 uniquement (~400 villes, 2 generators, ~$35-50)
pnpm tsx scripts/regen-villes-stratified.ts --tier=2

# Villes spécifiques (test manuel)
pnpm tsx scripts/regen-villes-stratified.ts --villes=paris,lyon,bordeaux

# Tout en une fois (~$60-85 total)
pnpm tsx scripts/regen-villes-stratified.ts --all

# Reprendre après une interruption (ex: après "lyon")
pnpm tsx scripts/regen-villes-stratified.ts --tier=1 --resume-from=lyon
```

### Ordre recommandé

1. **Dry-run Tier 1** → vérifier logs sans dépense
2. **Run Tier 1** → valider qualité sur 5-10 villes avant de continuer
3. **Run Tier 2** si Tier 1 satisfaisant
4. Tier 3 = rien à lancer (landing-ville-shared.ts s'en charge automatiquement)

---

## Concurrence et rate limits

- **Concurrence = 5** simultanés (dans le script). C'est volontairement conservateur.
- Anthropic rate limits (Sonnet 4.6) : ~500 req/min tier payant — avec 5 concurrent + ~3s/req, on est autour de 100 req/min, bien en dessous.
- Si des erreurs 429 apparaissent : réduire en modifiant `CONCURRENCY = 3` dans le script.
- Ne pas lancer plusieurs instances en parallèle du même script (risque doublon DB).

---

## Support de reprise (resume)

Le script **ne re-génère pas** ce qui est déjà en base avec `status = published` pour une combinaison `(villeSlug, generatorName)`.

- Si le script est interrompu (Ctrl+C, crash, timeout) : relancer exactement la même commande. Les villes déjà traitées seront skippées automatiquement.
- L'option `--resume-from=<slug>` permet également de sauter les N premières villes dans l'ordre alphabétique de population DESC (utile si on veut redémarrer depuis un point précis sans attendre les checks DB).
- Les deux mécanismes sont cumulables : `--resume-from` + check DB = protection maximale contre les doublons.

---

## Étapes de vérification post-génération

### 1. Vérification rapide DB

```bash
# Compter les jobs publiés par generator (adapter les contentType si nécessaire)
pnpm tsx -e "
const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();
prisma.contentGenJob.groupBy({
  by: ['contentType', 'status'],
  where: { status: 'published' },
  _count: { _all: true }
}).then(r => { console.table(r); prisma.\$disconnect(); });
"
```

### 2. Vérification couverture par tier

Ouvrir `/fr/admin/content-gen/city-coverage` (admin Axion-IA) → colonne `articlesCount` + `isCovered`.

### 3. Spot-check qualité

Tester 3-5 URLs publiques générées :

- `https://axion-ia.fr/fr/implantations/{region}/{ville}/interventions`
- Vérifier : H1 unique, JSON-LD Article, Speakable, score qualité ≥ 50/100 dans les logs

### 4. Vérifier absence de soft-404

```bash
# Sur quelques URLs au hasard
curl -s -o /dev/null -w "%{http_code}" https://axion-ia.fr/fr/implantations/ile-de-france/paris/interventions
# Attendre 200 (pas 404)
```

### 5. Revalidation ISR

Les pages sont en ISR `revalidate = 3600`. Si vous avez besoin d'une revalidation forcée :

```bash
curl -X POST https://axion-ia.fr/api/revalidate?path=/fr/implantations/...
```

---

## Notes importantes

- **Tier 3 non géré ici** : les ~1 650 petites communes sont générées à la demande par `landing-ville-shared.ts` lors du premier SSG/ISR — aucune action nécessaire.
- **Generators conditionnels** : `landing-ville-secteurs.ts`, `landing-ville-faq-extended.ts`, `landing-ville-cas-usage.ts` peuvent ne pas encore exister (Sprint A phase parallèle). Le script les skip silencieusement avec un `console.warn` et continue sans erreur fatale.
- **`landing-ville-ecosystem.ts` existe déjà** (Sprint v7 Phase 5) et sera utilisé immédiatement.
- **Coûts** : estimations basées sur Claude Sonnet 4.6 (~$3/MTok input, ~$15/MTok output). Les prix exacts dépendent de la longueur des prompts KB retrieve.
- **Anti-doorway HCU** : le contenu généré n'est indexable (`tier_1_indexable`) que si le score qualité ≥ 50. Le gate est appliqué par chaque generator individuellement.
