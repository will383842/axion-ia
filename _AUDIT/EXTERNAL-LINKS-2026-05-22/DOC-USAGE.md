# External Links Database — Documentation usage

Date : 2026-05-22
Sprint : External Links Database 2026

---

## 1. Architecture

```
src/data/external-links/
├── types.ts                      # ExternalLink interface + filtres concurrent
├── master.ts                     # SSOT — agrège tous les .ts + applique overrides
├── helpers.ts                    # selectExternalLinks() server + trackUsage + detectHallucinations
├── helpers-server-safe.ts        # version pure pour tests (sans prisma)
├── national-fr.ts                # 24 liens bootstrap (INSEE, CNIL, ANSSI, ...)
├── international.ts              # 12 liens (EU AI Act, OECD, NIST, ISO, WEF, ...)
├── regions.ts                    # 13 conseils régionaux FR
├── cities.ts                     # 12 mairies top 12 (top 200 attendu post-seed)
├── verticales.ts                 # 18 liens transversaux (Gartner, BCG, HBR, MDN, web.dev...)
├── topics.ts                     # 8 liens topics IA (Stanford AI Index, ArXiv, Anthropic, ...)
├── press-fr.ts                   # 7 liens presse FR (JDN, Numerama, ZDNet, ...)
├── manual-additions.ts           # vide initial — admin ajoute via UI
├── auto-seeded.ts                # généré par seed-external-links-from-perplexity.ts
└── verification-status.json      # overrides status/paywall/indexable/schemaOrg
```

Total bootstrap initial : **94 liens** vérifiés manuellement.
Cible post-seed Perplexity : **~2 400 liens**.

---

## 2. Comment ajouter un lien manuellement

### Option A — Via fichier `manual-additions.ts` (recommandé pour versioning git)

Édite `src/data/external-links/manual-additions.ts` et ajoute une entrée :

```typescript
{
  id: "manual-cgu-rgpd-001",
  url: "https://www.cnil.fr/fr/conseil-developpement",
  title: "Conseil au développement — CNIL",
  organization: "CNIL",
  category: "gov_fr",
  scope: "national",
  verticales: ["audits"],
  topics: ["rgpd", "ai-act"],
  language: "fr",
  authority: 5,
  verifiedAt: "2026-05-22",
  lastCheckedAt: "2026-05-22T00:00:00Z",
  status: "active",
  isCompetitor: false,
  paywall: false,
  indexable: true,
  isHttps: true,
  usageCount: 0,
}
```

Puis :

```bash
pnpm vitest run src/data/external-links/    # check no regression
git add src/data/external-links/manual-additions.ts
git commit -m "feat(external-links): manual addition CNIL conseil dev"
git push
```

### Option B — Via admin console `/content-gen/external-links`

(non implémenté en V1 — admin permet uniquement la consultation. V2 ajoutera un
formulaire d'ajout qui écrit dans `manual-additions.ts` via Server Action.)

---

## 3. Comment lancer la re-vérification HEAD manuelle

### Depuis l'admin

1. Aller à `/<adminPrefix>/content-gen/external-links`
2. Cliquer "Lancer vérification HEAD"
3. Le worker `external-links-monitor` enqueue un job → ~3-5 min bootstrap / ~30-45 min post-seed
4. La page admin se rafraîchit avec les nouvelles stats au prochain load

### Depuis le CLI (sans Coolify, dev local)

```bash
pnpm tsx src/scripts/verify-external-links-head.ts
```

Génère :

- `src/data/external-links/verification-status.json` (overrides merged dans master.ts)
- `_AUDIT/EXTERNAL-LINKS-2026-05-22/verification-report.md` (rapport détaillé)

Commit + push après review du rapport.

---

## 4. Comment re-générer la base annuel

Le catalogue est conçu pour être stable ~12 mois. Le re-seed annuel élargit la
couverture et capture les nouvelles publications gouvernementales / academic.

### Pré-conditions

- `PERPLEXITY_API_KEY` valorisée dans `.env.local` ET Coolify prod
- Budget ~$2 (Perplexity sonar, ~270 calls)

### Process

```bash
# 1. Lancer le seed batch (~45-60 min)
pnpm tsx src/scripts/seed-external-links-from-perplexity.ts

# 2. Le script écrit src/data/external-links/auto-seeded.ts (overwrite)

# 3. Ajouter import dans master.ts si pas déjà présent
#    + import { LINKS_AUTO_SEEDED } from "./auto-seeded";
#    + spread ...LINKS_AUTO_SEEDED dans ALL_EXTERNAL_LINKS

# 4. Vérifier HEAD du seed
pnpm tsx src/scripts/verify-external-links-head.ts

# 5. Review _AUDIT/EXTERNAL-LINKS-2026-05-22/verification-report.md
#    - Virer manuellement les URLs non pertinentes ou redirects problématiques
#    - Marquer paywall/competitor si détecté

# 6. Gates verts
pnpm typecheck
pnpm vitest run src/data/external-links/

# 7. Commit + push
git add src/data/external-links/
git commit -m "feat(external-links): re-seed annuel <YYYY-MM-DD>"
git push
```

### Coûts

- Perplexity batch : ~$1.62 (sonar : $1/1M tokens × ~700 in + ~7000 out / 270 calls + $0.005/call search)
- HEAD verification : gratuit (HTTP calls)
- Maintenance Will : ~1-2h review

---

## 5. Comment debugger si articles génèrent < 2 liens externes

### Symptôme

Log `external_links_validation` montre `external_link_count: 0` ou `1`.

### Causes possibles & solutions

#### A. Catalogue vide ou filtré

```bash
# Vérifier que le catalogue est chargé
node -e "
import('./src/data/external-links/master.ts').then(m => {
  console.log('Total:', m.ALL_EXTERNAL_LINKS.length);
  console.log('Healthy:', m.getExternalLinksStats().healthyForSelection);
});
"
```

Si < 50 healthyForSelection → re-lancer verify-external-links-head.ts.

#### B. SYSTEM_PROMPT du generator n'invite pas le LLM à inclure les liens

Vérifier que le generator a bien :

```typescript
const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });
// ...
const userPrompt = `...
${externalLinksCtx.markdownSection}
...`;
```

#### C. Le LLM ignore les liens fournis

Plus le SYSTEM_PROMPT est strict (« OBLIGATOIRE ≥ 2 liens »), plus le LLM
respecte. Les SYSTEM_PROMPTs actuels mentionnent déjà cette règle.

#### D. Hallucinations (LLM invente des URLs)

Le validator `detectHallucinations()` les capture et logge. Si beaucoup
d'hallucinations :

- Le LLM préfère ses URLs hardcodées d'entraînement → renforcer le wording
  « NE PAS INVENTER d'autres URLs » dans `buildExternalLinksPromptSection()`
- Ou augmenter le `count` pour donner plus de choix au LLM

#### E. minAuthority trop strict

Default 4 = exclut press_top (autorité 3). Si manque de liens, baisser à 3 :

```typescript
injectExternalLinks(input, { count: 4, minAuthority: 3 });
```

### Logging

Toujours consulter `generation_log` table en DB pour le step `external_links_validation` :

```sql
SELECT message, metadata FROM generation_logs
WHERE step = 'external_links_validation'
  AND content_gen_job_id = 'xxx'
ORDER BY created_at DESC LIMIT 5;
```

---

## 6. Activation env vars Coolify (prod)

| Variable                         | Default  | Description                           |
| -------------------------------- | -------- | ------------------------------------- |
| `PERPLEXITY_API_KEY`             | _absent_ | Requise pour le seed batch (Phase C). |
| `EXTERNAL_LINKS_MONITOR_ENABLED` | `false`  | Active le worker monthly HEAD.        |

Activer dans Coolify → Application → Env vars → New → key + value → scope RUN.
Restart container pour appliquer.

---

## 7. Limites connues

- **Catalogue statique** : changements de catalogue requièrent un déploiement code (vs DB).
- **Pas d'EN-only filtering** : si on ré-active EN locale, certains liens FR ne seront pas pertinents pour les articles EN.
- **Pas de scoring qualité destination** : on suppose autorité 5 = page haute qualité. En réalité certaines pages 5 peuvent être thin content. Future amélioration : Lighthouse score sur destination ?
- **Rate-limit destination servers** : monthly check 30 conc → peu de risque, mais possible pour gros catalogue à terme.

---

## 8. Suivi performance

KPIs à monitorer :

- % articles avec ≥ 2 liens externes (cible 95 %)
- % hallucinations / publication (cible < 5 %)
- Distribution rotation : top 10 liens cités vs reste catalogue (cible : pas de
  monopole, top 10 ≤ 30 % des citations totales)
- Coût Perplexity annuel (cible < $5/an)
- Broken links % monthly check (cible < 5 % — seuil alerte Telegram)
