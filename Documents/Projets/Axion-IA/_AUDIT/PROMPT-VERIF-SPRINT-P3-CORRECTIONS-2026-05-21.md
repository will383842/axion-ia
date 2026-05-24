# PROMPT VÉRIFICATION SPRINT P3 — SEO/AEO/GEO/AI OVERVIEWS
## AxionIA Content-Gen Perfection 2026 — Audit post-sprint P3

**Date création** : 2026-05-21
**Sprint vérifié** : `_AUDIT/PROMPT-SPRINT-P3-CORRECTIONS-2026-05-21.md`
**Verdict de référence à valider** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/VERDICT-SPRINT-P3-CORRECTIONS.md` (à lire EN PREMIER)
**Score baseline pré-sprint** : 689/1000
**Score cible post-sprint** : ≥ 800/1000
**Mode** : **AUDIT-ONLY strict** — zéro commit, zéro modification code, zéro push
**Effort estimé** : 4-6h autopilot (10 sous-agents parallèles)

---

## 0. PRINCIPE GÉNÉRAL

Cette vérification a 4 objectifs :

1. **Spec compliance** — chaque QW/P0 du prompt P3 a-t-il un commit correspondant et fait-il ce qui est demandé ?
2. **Tests fonctionnels** — générer 1 article test + 1 page villes pilote pour observer JSON-LD réel, sources externes, AuthorByline, TOC.
3. **Cross-sprint impact** — vérifier que P3 ne casse pas P4 ou P5 (JSON-LD cohérent avec persona P4, ai.txt/robots.ts cohérent avec wording AI Act P4, etc.).
4. **Régressions** — détecter toute régression introduite (Web Vitals, accessibilité, JSON-LD existant cassé).

**Tu DOIS** produire un verdict scoré `/1000` honnête. Si tu détectes des problèmes, tu les listes franchement. Ne pas adoucir.

---

## 1. CONTEXTE — À LIRE AVANT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche** : `main`
- **HEAD origin/main au lancement** : à découvrir via `git log origin/main -1 --oneline`
- **HEAD origin/main pré-sprint** : `0906722` (référence)

### Fichiers à lire (ordre)
1. `_AUDIT/PROMPT-SPRINT-P3-CORRECTIONS-2026-05-21.md` (spec exhaustive)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/VERDICT-SPRINT-P3-CORRECTIONS.md` (verdict livré par le sprint)
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/PHASE-3-VERDICT.md` (audit initial 689/1000)
4. Mémoire `axionia_sprint_p3_corrections_livre_2026-05-21.md`
5. Mémoire `axionia_p4_decisions_canoniques_2026-05-21.md` (pour cross-check wording AI Act + persona Manon)
6. Mémoire `axionia_p5_decisions_canoniques_2026-05-21.md` (cohérence décisions)

### Mode AUDIT-ONLY (impératif)
- ❌ Aucun `git commit`
- ❌ Aucun `git push`
- ❌ Aucune modification de fichier source (`src/`, `prisma/`, `package.json`, etc.)
- ❌ Aucune installation dépendance
- ✅ Lecture de fichiers
- ✅ Exécution de commandes diagnostic (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `git log`, `git diff`, `curl`)
- ✅ Création UNIQUEMENT de fichiers dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/verification/`

---

## 2. SPAWN 10 SOUS-AGENTS PARALLÈLES

Lance 10 sous-agents Explore/general-purpose en parallèle. Chacun produit un rapport `agents/V3-XX.md` dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/verification/agents/`.

### V3-01 — Spec compliance QW 1-5 (/100)
Pour chaque QW du prompt P3 (`speakable BlogPosting`, `legalName/alternateName`, `Wikidata sameAs`, `≥2 liens externes SYSTEM_PROMPT`, `AuthorByline routes articles`) :
- Identifier le commit correspondant via `git log origin/main --oneline --grep="<keyword>"`
- Lire le diff : `git show <sha> --stat` et `git show <sha> -- <file>`
- Vérifier l'implémentation correspond bien à la spec
- Tester via lecture code : la fonction ou la modification fait-elle vraiment ce que la spec demande ?
- Score par QW : 20 pts chacun = 100 max

### V3-02 — Spec compliance QW 6-10 (/100)
Pour `citations isBasedOn`, `CF WAF bots IA`, `search_term_string urlTemplate`, `AggregateRating pilote`, `getNearbyVillesExtended` :
- Même méthodologie V3-01
- Pour QW-7 CF WAF : exécuter `curl -A "ClaudeBot/1.0" https://axion-ia.com/ -I` et `curl -A "GPTBot/1.0" https://axion-ia.com/ -I` → vérifier statut 200 (pas 403)
- Pour QW-9 AggregateRating : vérifier que SI instancié, c'est sur reviews réelles documentées (pas inventées)

### V3-03 — Featured Snippets TOC (/120)
- Composant `src/components/seo/ArticleTOC.tsx` créé ?
- Importé dans `/blog/[slug]` quand `wordCount > 1500` ?
- Importé dans `/guides/[slug]` toujours ?
- Comportement : parse h2/h3, anchor links, sticky desktop, collapsible mobile ?
- JSON-LD `ItemList` pour TOC présent ?
- Test fonctionnel : générer 1 article de test long (>1500 mots) via worker dev → vérifier TOC présent + structurée
- Score : 120 max

### V3-04 — Anti-concurrence axionai.fr (/80)
- Seeds `g_brand_axionia` présents dans table `Keyword` (vertical='brand') ? (`SELECT * FROM keywords WHERE vertical='brand'`)
- Page `/brand` ou `/qui-est-axion-ia` créée ?
- Wikidata Q-ID injecté dans `Organization.sameAs` du JSON-LD ?
- Cohérence `legalName` + `alternateName` partout (brand.ts, JSON-LD, sitemap, etc.) ?
- Score : 80 max

### V3-05 — Knowledge Graph & Wikidata (/100)
- Verdict P3 baseline = 34/80 sur A3-04. Post-sprint attendu ≥60/80.
- Q-ID Wikidata reçu de Will et injecté ? (consulter VERDICT-SPRINT-P3 section "Actions Will validées")
- `Organization.sameAs[]` contient `https://www.wikidata.org/wiki/<Q-ID>` ?
- `legalName: "Axion-IA OÜ"` OU société française pure (selon DW-3-01 tranché) ?
- `alternateName: ["AxionIA", "Axion IA", "axion-ia.com"]` ?
- `hasOfferCatalog` ajouté ? (P3 verdict mentionnait ce gap)
- `addressLocality` résolu (vs placeholder) ?
- Score : 100 max

### V3-06 — AI Overviews & sources externes (/100)
- SYSTEM_PROMPT 3 generators principaux (`blog-article.ts`, `blog-from-keywords.ts`, `blog-pillar.ts`) contient l'instruction "≥ 2 liens externes vers sources autorité FR" ?
- Validation post-LLM dans `content-publish-worker.ts` : `externalLinkCount < 2` → status `needs_review` ?
- Test fonctionnel : générer 1 article via worker dev → compter `<a href="https?://[^axion-ia.com][^"]*"` dans le HTML body → doit être ≥ 2
- CF WAF bots IA : `curl -A "ClaudeBot/1.0"` retourne 200 ?
- ai.txt / llms.txt cohérents avec wording AI Act P4 ?
- `isBasedOn` JSON-LD câblé avec `citations[]` Perplexity ?
- Score : 100 max

### V3-07 — E-E-A-T signals (/100)
- `<AuthorByline />` instancié dans `/blog/[slug]`, `/cas-concrets/[slug]`, `/guides/[slug]` ?
- Auteur = "Manon, experte IA chez Axion-IA" (cohérent D3 P4) ?
- `Person` JSON-LD cohérent (mêmes données que AuthorByline visuel) ?
- Pages légales (mentions, CGV, RGPD, /transparence, /corrections) intactes ?
- AiContentDisclaimer présent sur articles AI-générés (vérification croisée avec P4 P0-5 pour 39 pages /implantations) ?
- Score : 100 max

### V3-08 — Core Web Vitals régression (/80)
- Exécuter `pnpm build` (si compile rapide) ou lire `.next/analyze` si disponible
- Bundle size pages clés : `/`, `/blog/[slug]`, `/audits`, `/audits/paris` → check ≤ baseline P1.5 (75 KB gz target)
- TOC composant ajouté : Server Component pur ? (pas de JS client supplémentaire ?)
- Vérifier LCP/INP/CLS via `lighthouserc.json` config (gates ERROR ≤ 1800ms / off / 0.1) — pas d'INP régression
- Vérifier que `<img>` du AuthorByline a `width`/`height` (CLS safe)
- Score : 80 max

### V3-09 — Cross-sprint impact P4+P5 (/120)
**CRITIQUE** — cette section vérifie que P3 ne casse pas P4/P5 et vice-versa.

#### Croisement P3 ↔ P4
- AiContentDisclaimer wording : P4 doit injecter `"Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."` — P3 a-t-il modifié ce wording ? **DOIT être identique au wording P4** (cohérence AI Act art. 50)
- Persona auteur : P4 fixe "Manon, experte IA chez Axion-IA" dans SYSTEM_PROMPTs — P3 a-t-il instancié `<AuthorByline />` avec le même persona ? **DOIT être strictement identique**
- ai.txt / llms.txt (P3) : mentionne-t-il que le contenu est AI-assisted (cohérent avec mention AI Act P4) ?
- JSON-LD `Person` schema : si P4 a modifié `buildAuthorJsonLd` et P3 aussi → vérifier 1 seule source de vérité, pas duplication

#### Croisement P3 ↔ P5
- Pas de conflit attendu (P3 = JSON-LD/SEO côté pages publiques, P5 = console admin)
- Vérifier que les composants SEO ne sont pas importés dans pages admin (isolation)
- Si P5 a ajouté un dashboard "Indexation" qui lit GSC API : P3 doit avoir préparé `GSC_SERVICE_ACCOUNT_JSON` env var ? Status ?

#### Migrations Prisma
- P3 ne devrait avoir AUCUNE migration Prisma → vérifier `git diff origin/main..HEAD -- prisma/migrations/` doit être vide pour cette branche
- Si migration trouvée : red flag → analyser

### V3-10 — Actions Will status (/100)
Documenter le statut des 4 actions Will pendantes :
- DW-3-01 Wikidata Q-ID : créé ? Q-ID ?
- DW-3-02 Adresse FR : tranché ? Quelle option ?
- DW-3-03 GSC service account JSON : déployé Coolify ?
- DW-3-04 CF WAF bots IA : débloqué ?
Score = somme statuts (25 pts chacun, partial credit OK).

### Cross-cutting orchestrateur (/100)
- Cohérence inter-agents (V3-01 à V3-10) : 0 contradiction
- Priorisation issues P0/P1/P2 rigoureuse
- Recommandations post-vérif claires
- Tests effectués réels (pas juste lecture code)
- Score : 100 max

**TOTAL : 1000 pts**

---

## 3. GATES ANTI-RÉGRESSION OBLIGATOIRES

À exécuter au début de la vérification :

```powershell
pnpm typecheck   # doit être 0 erreur (baseline P1.5)
pnpm lint        # doit être 0 erreur (1 warning hors scope OK)
pnpm test        # vitest XXXX/XXXX passed — DOIT être ≥ baseline 1376/1383
pnpm content-gen:isolation-check  # 0 violation
```

**Si typecheck/lint/test régressent vs baseline P1.5 → PÉNALITÉ -100 pts global** + listing détaillé dans verdict.

Vérifier aussi pre-commit hooks ×8 (anti-siren, anti-hex, use-client, eslint, prettier, typecheck, content-gen isolation, image-bank isolation) — lancer `pnpm pre-commit` si disponible.

---

## 4. TESTS FONCTIONNELS RÉELS (obligatoires)

### Test 1 — Générer 1 article test
```powershell
# Si script disponible:
pnpm content-gen:test-generate --vertical=audits --type=blog_pillar --city=paris

# Sinon créer 1 job manuellement via BullMQ admin UI ou prisma:
# 1. Connexion DB locale
# 2. INSERT CoverageCampaign de test
# 3. Trigger 1 job content-gen-worker
# 4. Attendre génération
# 5. Lire article généré
```

Vérifier dans l'article produit :
- ✅ JSON-LD `speakable` présent dans `<head>` (rendu HTML)
- ✅ ≥ 2 liens externes vers sources autorité (`<a href="https://www.insee.fr...">` ou similaire)
- ✅ `<AuthorByline />` rendu avec "Manon, experte IA chez Axion-IA"
- ✅ AiContentDisclaimer en bas avec wording P4 transparence max
- ✅ TOC présent si wordCount > 1500
- ✅ `Person` JSON-LD cohérent

### Test 2 — Vérifier 1 page villes pilote
URL test : `/audits/paris` (page existante 39 villes pilote)
```powershell
curl -s "http://localhost:3000/fr/audits/paris" | grep -E "speakable|Organization|sameAs|wikidata"
```
Vérifier :
- ✅ `Organization` JSON-LD a `legalName` correct
- ✅ `sameAs[]` contient Wikidata URL si Q-ID créé
- ✅ `LocalBusiness` graphe complet (8 schémas baseline P1.5)
- ✅ `getNearbyVillesExtended()` câblé : section "Villes proches" visible avec 6 villes

### Test 3 — Sources externes filtre LLM
Exécuter validateur post-LLM sur 5 articles récents :
```powershell
# Si fonction validateExternalLinks existe:
node -e "const v = require('./src/server/content-gen/seo/validate-external-links'); v.checkLast5Articles()"
```
Score externe links count par article. Aucun article publié avec < 2 sources externes (doit être en `needs_review`).

### Test 4 — CF WAF bots IA
```powershell
curl -A "ClaudeBot/1.0 (https://www.anthropic.com/claudebot)" https://axion-ia.com/ -I 2>&1 | grep "HTTP/"
curl -A "GPTBot/1.0 (https://openai.com/gptbot)" https://axion-ia.com/ -I 2>&1 | grep "HTTP/"
curl -A "PerplexityBot/1.0" https://axion-ia.com/ -I 2>&1 | grep "HTTP/"
curl -A "Google-Extended" https://axion-ia.com/ -I 2>&1 | grep "HTTP/"
```
Doit retourner `HTTP/2 200` (ou `HTTP/1.1 200`) pour tous. Si `403` → DW-3-04 Will non-débloqué.

### Test 5 — Wikidata Q-ID
Si Q-ID fourni dans VERDICT-SPRINT-P3 :
```powershell
curl -s "https://www.wikidata.org/wiki/<Q-ID>" | grep -E "axion-ia|Axion-IA"
```
Doit retourner contenu de la fiche. Vérifier qu'elle est conforme spec P3.

---

## 5. DOCTRINE COMPLIANCE

### Couleurs brand
- Aucun `bg-blue` ou `text-blue` ajouté en CSS pour CTAs primaires (utilisation terracotta `#c24a1b`)
- Vérifier que les nouvelles pages/composants P3 respectent la palette (fond ivoire `#faf8f3`, terracotta principale, bleu seulement pointes)

### Zero invention
- AggregateRating : si instancié, vérifier que les ratings sont basés sur reviews réelles (G2, Trustpilot, GBP) — pas inventés
- Wikidata Q-ID : doit être un Q-ID réel créé par Will, pas un placeholder

### AI Act art. 50
- Wording AiContentDisclaimer cohérent avec P4 D4 = "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."
- Présent sur tous types d'articles AI-générés
- JSON-LD `aiGenerated: true` toujours présent (acquis P1.5)

### RGPD
- `<AuthorByline />` Manon = personnage fictif → pas de vraie donnée personnelle exposée
- Pas de profil social fake pour Manon (doctrine v2.1)

---

## 6. SÉCURITÉ

- Vérifier qu'aucune clé API n'est exposée côté client (`grep -r "OPENAI_API_KEY\|ANTHROPIC_API_KEY\|VOYAGE_API_KEY" src/app/ src/components/`)
- Vérifier que `GSC_SERVICE_ACCOUNT_JSON` est server-only (jamais leaked au client)
- OWASP headers intacts (CSP, HSTS, X-Frame-Options)
- Server Actions P3 (s'il y en a) ont vérification auth

---

## 7. PERFORMANCE

- Bundle size delta : `git diff origin/main..HEAD -- "**/*.tsx" "**/*.ts"` total LoC ajouté → estimer impact bundle
- Pas de package npm ajouté (`git diff origin/main..HEAD -- package.json pnpm-lock.yaml`)
- TOC composant : Server Component pur ?
- Pas de regression Web Vitals : LCP ≤ 1800ms, CLS ≤ 0.1

---

## 8. LIVRABLES

### Structure de fichiers à créer
```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/verification/
├── VERDICT-VERIFICATION-SPRINT-P3.md      (verdict global /1000)
├── CROSS-CUTTING.md                       (analyses transverses)
└── agents/
    ├── V3-01.md  (Spec compliance QW 1-5)
    ├── V3-02.md  (Spec compliance QW 6-10)
    ├── V3-03.md  (Featured Snippets TOC)
    ├── V3-04.md  (Anti-concurrence)
    ├── V3-05.md  (Knowledge Graph)
    ├── V3-06.md  (AI Overviews & sources)
    ├── V3-07.md  (E-E-A-T)
    ├── V3-08.md  (Web Vitals régression)
    ├── V3-09.md  (Cross-sprint P4+P5)
    └── V3-10.md  (Actions Will status)
```

### Format VERDICT-VERIFICATION-SPRINT-P3.md

```markdown
# VERDICT VÉRIFICATION SPRINT P3 — SEO/AEO/GEO
## Date : YYYY-MM-DD
## HEAD audité : <SHA court>
## Score baseline pré-sprint : 689/1000
## Score sprint déclaré : XXX/1000 (depuis VERDICT-SPRINT-P3-CORRECTIONS.md)
## **Score vérifié par cet audit : XXX/1000** (peut différer du score sprint déclaré)

## Verdict global
✅ GO si ≥ 800/1000
🟡 CONDITIONAL si 700-799
🔴 RÉGRESSION si < score baseline 689

## Scores par agent
| Agent | Score | Max | % |
|-------|-------|-----|---|
| V3-01 Spec QW 1-5 | XX | 100 | XX% |
| ... |

## Items vérifiés OK ✅
| Item | Commit | Statut |
|------|--------|--------|
| QW-1 speakable BlogPosting | abc1234 | ✅ Implémenté correctement |

## Items partiels ⚠️
| Item | Issue | Recommandation |
|------|-------|----------------|

## Items manquants / régressions 🔴
| Item | Cause | Impact |
|------|-------|--------|

## Cross-sprint conflicts détectés
| Sprint | Conflit | Sévérité | Recommandation |
|--------|---------|----------|----------------|

## Tests fonctionnels résultats
- Test 1 (article test) : ✅/❌
- Test 2 (page villes) : ✅/❌
- Test 3 (sources externes) : ✅/❌
- Test 4 (CF WAF) : ✅/❌
- Test 5 (Wikidata) : ✅/❌

## Gates anti-régression
- typecheck : ✅/❌ (X errors vs baseline 0)
- lint : ✅/❌
- vitest : XXXX/XXXX passed (vs baseline 1376/1383)
- isolation-check : ✅/❌

## Régressions vs baseline P1.5
- Aucune / Liste détaillée

## Actions Will pendantes status
- DW-3-01 Wikidata Q-ID : ✅/⏳/❌
- DW-3-02 Adresse FR : ✅/⏳/❌
- DW-3-03 GSC JSON : ✅/⏳/❌
- DW-3-04 CF WAF : ✅/⏳/❌

## Recommandations
1. ...

## STOP & ASK Will
- ...
```

### Mémoire à créer
Slug : `axionia_verif_sprint_p3_corrections_2026-05-21`
Type : project

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Vérif Sprint P3 LIVRÉE 2026-05-21 — score XXX/1000](axionia_verif_sprint_p3_corrections_2026-05-21.md) — Audit post-sprint P3 SEO/AEO/GEO. Items OK / partiels / manquants. Cross-sprint conflicts P4+P5. Tests fonctionnels réels.
```

---

## 9. STOP & ASK FINAL

Format :
```
✅ Vérification Sprint P3 livrée.
- HEAD vérifié : <sha>
- Score vérifié : XXX/1000 (vs sprint déclaré YYY)
- X items OK / Y items partiels / Z items manquants
- Cross-sprint conflicts : X items

📋 Régressions détectées :
- ...

📋 Actions Will pendantes :
- ...

🚀 Suite proposée :
[A] Sprint P3 follow-up pour corriger items manquants/partiels
[B] Attendre fin des vérifs P4 et P5 → consolider dans P6
[C] Validation prod (déploiement)
[D] Autre
```

---

## 10. PHRASE DE LANCEMENT

```
Lance la vérification décrite dans `_AUDIT/PROMPT-VERIF-SPRINT-P3-CORRECTIONS-2026-05-21.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code. Lire d'abord VERDICT-SPRINT-P3-CORRECTIONS.md. Spawn 10 sous-agents parallèles V3-01 à V3-10. Tests fonctionnels obligatoires (article test + page villes + sources externes + CF WAF + Wikidata). Gates anti-régression vs baseline P1.5 (typecheck 0, vitest 1376+/1383). Cross-sprint impact P4+P5 (wording AI Act, persona Manon, AuthorByline cohérence). Termine par VERDICT-VERIFICATION-SPRINT-P3.md scoré /1000 + mémoire + MEMORY.md update + STOP & ASK Will. Go.
```

---

*Vérification Sprint P3 — 4-6h autopilot — AUDIT-ONLY — Cible verdict honnête /1000*
