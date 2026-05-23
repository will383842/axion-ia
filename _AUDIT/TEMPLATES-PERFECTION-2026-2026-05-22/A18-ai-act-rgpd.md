# A18 AI Act art.50 + RGPD — Audit forensique

**Date audit** : 2026-05-22
**Périmètre** : 250 templates Axion-IA
**Deadline** : 2026-08-02 (71 jours)

---

## 1. AiContentDisclaimer

**Trouvé** : OUI | src/components/marketing/AiContentDisclaimer.tsx:1-76

- Composant créé 2026-05-15 (Server component pur)
- Utilisé dans : actualites, blog, cas-concrets, centre-aide, glossaire, guides, implantations
- Texte : "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic)..."
- Top-fold : OUI | Lien : /transparence
- **Score : 95/100**

## 2. JSON-LD aiGenerated

**Trouvé** : OUI | src/lib/seo-content-gen-factories.ts:61

- Implémentation : aiGenerated:true + additionalType:AIGeneratedContent
- Types : Article, BlogPosting, NewsArticle, TechArticle
- Tests : 3 suites vitest (seo-content-gen-factories.test.ts)
- Persona Manon : AuthorProfile.aiGenerated:true + isPersona:true
- Deadline 2026-08-02 : CONFORME (déployé 2026-05-15)
- **Score : 98/100**

## 3. promptHash audit

**Trouvé** : OUI | Table GenerationProvenance + logProvenance()

- Champ : promptHash:String (SHA-256 hex 64 chars)
- Fonction : hashPrompt() src/server/content-gen/provenance/provenance-logger.ts:49
- Appelé par : 9 generators + content-publish-worker
- Chain hash : computeProvenanceHash() pour intégrité (previousHash:promptHash:timestamp)
- Stockage : articleId, step, provider, model, promptHash, tokens, cost, regulationVersion:AI-Act-2024/1689
- Admin access : getProvenanceForArticle() → JSON complet
- **Score : 92/100**

## 4. DPA providers IA

**Providers identifiés** :

- Anthropic (Claude Sonnet) : DPA Pending, SCC, Pending activation
- OpenAI (GPT-4o) : DPA Pending, SCC, Pending activation
- Perplexity (Sonar) : DPA Pending, SCC, Pending activation
- Unsplash : DPA Pending, SCC, Pending activation
- Voyage AI : DPA Pending, SCC, Pending activation

**SSOT** : src/content/subprocessors.ts:28 (2026-05-15)
**Page pub** : src/app/[locale]/sous-processeurs/page.tsx
**PII safeguard** : pii-safe.ts + hard-gate confidential/secret chunks
**CRÍTICO** : Tous providers pending + pending_activation (clés API absentes)
**Score : 68/100**

## 5. CNIL 2026 cookies

- Page : src/app/[locale]/cookies/page.tsx via LegalPageTemplate
- Plausible : Self-hosted Hetzner DE (0 cookies)
- Clarity : USA (Azure) | DPA pending | consent-gated
- IP hash : IP_HASH_SALT env var (≥32 chars) pour image_download_logs (SHA-256)
- Retrait consentement : À vérifier (doit être "aussi simple que consentement")
- **Score : 82/100**

## 6. Droits RGPD exercice

- Formulaire : src/app/[locale]/mes-donnees/page.tsx
- Droits : Accès, Rectification, Effacement, Portabilité, Opposition, Limitation
- Contact : contact@axion-ia.com | Délai : 30 jours | Escalade : CNIL (www.cnil.fr)
- Page RGPD : src/app/[locale]/rgpd/page.tsx
- API DSAR : Non détecté (email-only)
- **Score : 78/100**

## 7. SOC2 audit logs

- captureWorkerError : src/server/queue/lib/sentry-worker.ts:106 (23 workers)
- sanitizeJobData : src/server/queue/lib/sanitize-job-data.ts (secrets, emails, phones redacted)
- ContentGenAuditLog : Append-only (action, settingKey, oldValue, newValue, actorUserId, actorEmail, actorIp, actorUa)
- Rétention : TODO M11 (purge >24 mois)
- **Score : 85/100**

## 8. /transparence hub

- Page : src/app/[locale]/transparence/page.tsx (ISR 86400s)
- Sections : Contenus IA-assistés, Persona Manon, Sous-processeurs IA, Classification AI Act, Droits RGPD
- JSON-LD : WebPage (NOT aiGenerated, page est hub pas générée)
- Manque : dateModified, lien EUR-Lex
- **Score : 88/100**

---

## SCORE GLOBAL

| Axe                    | Score  | Status     |
| ---------------------- | ------ | ---------- |
| 1. AiContentDisclaimer | 95/100 | ✅         |
| 2. JSON-LD aiGenerated | 98/100 | ✅         |
| 3. promptHash audit    | 92/100 | ✅         |
| 4. DPA providers IA    | 68/100 | ⚠️ CRÍTICA |
| 5. CNIL cookies        | 82/100 | ⚠️         |
| 6. Droits RGPD         | 78/100 | ⚠️         |
| 7. SOC2 audit logs     | 85/100 | ✅         |
| 8. /transparence hub   | 88/100 | ✅         |

\*\*TOTAL : 686/800 (85,75
