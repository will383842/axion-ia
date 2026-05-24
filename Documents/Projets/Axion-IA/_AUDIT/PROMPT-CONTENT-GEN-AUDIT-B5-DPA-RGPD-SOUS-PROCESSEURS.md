# 🛡️ PROMPT AUDIT B5 — DPA + sous-processeurs RGPD (Content Generator)

> Audit dédié : conformité RGPD + AI Act EU 2026. Cross-check providers
> IA actifs vs déclarés dans politique-confidentialite + sous-processeurs.
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT B5 — DPA + RGPD)

Tu es l'auditeur conformité RGPD + AI Act EU 2026. V1+V2 content-gen
livrés (tag v1.0.1 + Sprints 7-12 mergés). Le système consomme :
- OpenAI (GPT-4o text gen + GPT-image-1 V2 si activé)
- Anthropic (Claude Sonnet 4.6 fallback + prompt caching)
- Perplexity (Sonar — data récente avec citations)
- Unsplash (images stock gratuites attribution)
- Voyage AI (embeddings voyage-3-lite pour KB)
- (V2) Google Indexing API si flag activé
- (V2) Search Console API / Plausible API (analytics)

Chacun de ces providers = sous-processeur RGPD potentiel.

Ton job : vérifier que TOUS les providers actifs sont :
1. Déclarés dans `politique-confidentialite` (page publique)
2. Sous DPA papier signé (action Will)
3. Pas de fuite PII utilisateur dans les prompts envoyés
4. Conformes AI Act EU 2026 (transparence IA persona Manon)

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition code / doc / DPA
- Tu LIS : pages légales + code content-gen + master prompt § 12 +
  helper pii-redaction.ts
- Si non-conformité → noter, NE PAS fix (Will + DPO arbitrent)
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-B5-RGPD-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. axionia/src/app/[locale]/politique-confidentialite/page.tsx
2. axionia/src/app/[locale]/sous-processeurs/page.tsx (si présent)
3. axionia/src/app/[locale]/mentions-legales/page.tsx
4. axionia/src/app/[locale]/conditions-generales/page.tsx
5. axionia/src/app/[locale]/cookies/page.tsx + politique-cookies
6. axionia/src/app/[locale]/rgpd/page.tsx + mes-donnees/
7. axionia/src/lib/pii-redaction.ts (helper PII redaction)
8. axionia/src/lib/__tests__/pii-redaction.test.ts
9. axionia/src/lib/knowledge/pii-scan.test.ts (PII scan KB)
10. axionia/src/content/legal.ts ou content/transversal.ts (sous-processeurs
    déclarés)
11. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 0.5 sécurité +
    § 21 contraintes intouchables RGPD
12. docs/adr/0010 PII minimisation Telegram (mémoire
    axionia_session_2026-05-09_sprint_24_1)
13. Mémoire `axionia_bugs_seo_preexistants_2026-05-09` (DPA register)
14. AI Act EU 2026 — résumé applicable au content-gen génératif

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -5
# Lister toutes les pages légales présentes
find axionia/src/app/[locale] -name "page.tsx" \
  | grep -iE "rgpd|confident|sous-process|cookies|legal|cgu|mentions" | sort
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 1 — Inventaire providers actifs code                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
cd axionia/
# Inventaire providers IA effectivement utilisés en code
ls src/server/content-gen/providers/
grep -rn "OPENAI_API_KEY\|ANTHROPIC_API_KEY\|PERPLEXITY_API_KEY\|UNSPLASH_ACCESS_KEY\|VOYAGE_API_KEY" \
  src/ --include="*.ts" | head -20

# Liste seeds ProviderConfig
cat prisma/seeds/content-gen/providers.ts 2>/dev/null || \
  grep -rA 20 "seedProviders\|ProviderConfig.*create" prisma/seeds/content-gen/

# Liste env vars Coolify déclarées
grep -n "OPENAI\|ANTHROPIC\|PERPLEXITY\|UNSPLASH\|VOYAGE\|GOOGLE_INDEXING\|PLAUSIBLE\|SEARCH_CONSOLE" \
  src/env.ts
```

Liste providers actifs code (cross-check § 7) :
| Provider | Endpoint API | Data envoyée | PII possible ? |
|----------|--------------|--------------|----------------|
| OpenAI | api.openai.com | prompts + KB chunks | Email/IP utilisateur si fuite |
| Anthropic | api.anthropic.com | prompts + KB chunks | idem |
| Perplexity | api.perplexity.ai | queries + intent | nom de villes/régions OK |
| Unsplash | api.unsplash.com | search queries (mots-clés) | OK aucune PII |
| Voyage | api.voyageai.com | text à embedder | KB chunks publiques OK |
| Google Indexing | indexing.googleapis.com | URLs publiques uniquement | OK (URLs only) |
| Plausible (V2) | plausible.io | events anonymisés | OK design Plausible |
| Search Console (V2) | searchconsole.googleapis.com | URLs publiques | OK |

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — Cross-check providers ↔ politique-confidentialite     ║
╚═══════════════════════════════════════════════════════════════════════╝

Lire `axionia/src/app/[locale]/politique-confidentialite/page.tsx` ou
fichier source `src/content/legal.ts`.

Vérifier que CHAQUE provider actif est déclaré comme sous-processeur :

```bash
grep -iE "openai|anthropic|perplexity|unsplash|voyage|google indexing|\
plausible|search console" \
  src/app/[locale]/politique-confidentialite/page.tsx \
  src/content/legal.ts 2>/dev/null
```

Pour CHAQUE provider :
- [ ] Nom commercial du provider mentionné
- [ ] Pays de stockage data déclaré (US / EU / UK)
- [ ] Finalité du traitement décrite (génération texte, embeddings,
      images stock, etc.)
- [ ] Base légale RGPD invoquée (intérêt légitime article 6(1)(f) ?
      consentement ? exécution contrat ?)
- [ ] Durée de conservation des prompts/data côté provider mentionnée
      (OpenAI 30j default sauf opt-out, Anthropic 30j zero retention API,
      etc.)
- [ ] Lien vers DPA du provider (URL externe)
- [ ] Transfert international (Standard Contractual Clauses si US) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — Cross-check sous-processeurs page dédiée              ║
╚═══════════════════════════════════════════════════════════════════════╝

Si `src/app/[locale]/sous-processeurs/page.tsx` existe :

- [ ] Page accessible publiquement (pas auth)
- [ ] Liste exhaustive sous-processeurs (pas que content-gen)
- [ ] Date dernière mise à jour visible
- [ ] Politique de notification changement (30j préavis ?)
- [ ] Distinction sous-processeurs CORE (Hetzner, Coolify, Postgres) vs
      content-gen-specific (OpenAI, Anthropic, etc.)

Si page absent → P0 RGPD bloquant.

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — PII redaction effectif                                ║
╚═══════════════════════════════════════════════════════════════════════╝

Mémoire `axionia_session_2026-05-09_sprint_24_1` : helper
`pii-redaction.ts` + 14 sites Telegram patchés (118 → 127 tests).

Vérifier extension content-gen :

```bash
# pii-redaction utilisé dans content-gen ?
grep -rn "pii-redaction\|piiRedact\|redactPii" \
  src/server/content-gen/ src/server/queue/workers/content-*-worker.ts
```

Sites où PII pourrait fuir :
- [ ] `content-gen-worker` : logs vers Sentry/GenerationLog → PII scrub ?
- [ ] `kb-feeder.ts` POST /api/internal/kb/ingest → headers contiennent
      pas de PII admin ?
- [ ] Telegram alerts § 12.3bis → contenu redacté ?
- [ ] Cost ledger logs → pas d'IP utilisateur ?
- [ ] Worker rss-fetch → User-Agent identifiable mais pas PII (OK) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — Conformité AI Act EU 2026 (transparence persona)      ║
╚═══════════════════════════════════════════════════════════════════════╝

AI Act EU 2026 — applicabilité content-gen :

- **Article 50** (transparence IA) : utilisateurs doivent être informés
  qu'ils interagissent avec contenus générés IA
- **Article 52** (transparence systèmes IA) : disclosure deep fake / contenu
  synthétique

Pour Axion-IA, Manon = **persona éditoriale IA disclosed** (doctrine v2.1).

Vérifier :
- [ ] Page `/fr/equipe/manon` affiche disclaimer transparence IA visible
      (non caché)
- [ ] Chaque Article publié signé Manon contient mention "Contenu
      éditorial supervisé par l'équipe Axion-IA" ou équivalent
- [ ] JSON-LD Person.aiGenerated=true émis (Sprint 6 fix)
- [ ] `politique-confidentialite` mentionne IA générative + droits
      utilisateur (opposition, accès, suppression)
- [ ] Pas de tentative de masquer le caractère IA généré
- [ ] Contenus blog/actualités tier-1 : mention auteur Manon + lien
      profil avec disclosure

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 6 — DPA papier signé (action Will)                        ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE provider sous-processeur, Will doit signer un DPA papier
ou électronique. C'est une action HUMAINE, mais vérifier le statut :

```bash
ls .secrets/dpa/ 2>/dev/null      # dossier privé DPA scans (gitignored)
ls _AUDIT/DPA-REGISTER*.md 2>/dev/null
grep -i "DPA\|data processing agreement" docs/ -r 2>/dev/null | head -5
```

Si registre DPA présent :
- [ ] Date signature pour chaque provider
- [ ] Version DPA (provider change parfois la sienne)
- [ ] Sous-processeurs déclarés par le provider (chain)
- [ ] Renouvellement annuel ?

Si registre absent → P0 RGPD : Will doit créer DPA-REGISTER.md (interne)
listant statut signature pour chaque provider actif.

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 7 — Droits utilisateur RGPD (accès / opposition / erase) ║
╚═══════════════════════════════════════════════════════════════════════╝

Mémoire `axionia_session_2026-05-09_sprint_24` : endpoints
`/api/gdpr-export` + `/api/gdpr-erasure` + retention-purge cron livrés.

Vérifier extension content-gen :

- [ ] Si Will collecte data utilisateur dans content-gen (commentaires
      Article, formulaires) : RGPD-erasure couvre-t-il ces tables ?
- [ ] ActivityLog content-gen contient PII utilisateur ?
- [ ] Retention 90j tier-3 (politique content-gen) cohérente avec
      RGPD principe data minimisation ?
- [ ] Cron `retention-purge-worker` couvre tables content-gen ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 8 — Synthèse + verdict                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-AUDIT-B5-RGPD-2026-XX-XX.md` :

```markdown
# Audit B5 — DPA + sous-processeurs RGPD (YYYY-MM-DD)

## 1. Contexte
- V1+V2 livrés
- Providers actifs : XX
- Pages légales auditées : YY

## 2. Inventaire providers actifs code

| Provider | Endpoint | Data envoyée | Pays | PII risque |
|----------|----------|--------------|------|-----------|

## 3. Cross-check politique-confidentialite

| Provider | Mentionné ? | Pays ? | Base légale ? | Durée conservation ? | Lien DPA ? |
|----------|-------------|--------|---------------|---------------------|------------|

## 4. Page sous-processeurs

- Présente : ✅/❌
- Liste exhaustive : ✅/⚠️/❌
- Date maj visible : ✅/❌

## 5. PII redaction effective

| Site potentiel fuite | pii-redaction utilisé ? |
|----------------------|-------------------------|

## 6. Conformité AI Act EU 2026

- [ ] Disclaimer transparence IA Manon visible
- [ ] aiGenerated JSON-LD émis
- [ ] Mention IA dans Articles
- [ ] politique-confidentialite IA générative

## 7. DPA papier statut

| Provider | DPA signé ? | Date | Version |

## 8. RGPD droits utilisateur extension content-gen

| Droit | Endpoint couvre content-gen tables ? |
|-------|--------------------------------------|
| Accès `/api/gdpr-export` | ✅/❌ |
| Erasure `/api/gdpr-erasure` | ✅/❌ |
| Retention purge cron | ✅/❌ |

## 9. Verdict /70

- Providers tous déclarés politique-confidentialite : 15 pt
- Page sous-processeurs présente + à jour : 10 pt
- PII redaction effective : 10 pt
- AI Act transparence Manon : 10 pt
- DPA signés tous providers : 15 pt
- Droits utilisateur RGPD couvrent content-gen : 10 pt

🟢 RGPD COMPLIANT : ≥ 60/70 + tous P0 OK
🟡 NEAR-COMPLIANT : 40-59/70
❌ NON-COMPLIANT : < 40/70

## 10. Top non-conformités priorisées

| # | P0/P1 | Catégorie | Description | Action Will |

## 11. Recommandations pré-deploy

### P0 absolu
- [ ] DPA papier signés AVANT prod (chaque provider)
- [ ] Page sous-processeurs publique
- [ ] politique-confidentialite mention IA générative
- [ ] Disclaimer Manon transparence IA visible

### P1 sous 48h post-deploy
- [ ] Registre DPA interne `_AUDIT/DPA-REGISTER.md`
- [ ] Procédure renouvellement annuel
- [ ] Notification users 30j avant changement sous-processeur

## 12. Métadonnées
- Durée : X h
- Providers audités : Y
- Pages légales scannées : Z
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
Si non-conformité critique détectée → STOP & ASK Will (DPO arbitre).
```
