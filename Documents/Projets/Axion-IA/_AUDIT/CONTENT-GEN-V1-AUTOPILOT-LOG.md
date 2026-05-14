# Content Generator V1 — Autopilot Log

> Journal d'exécution sprint-par-sprint en mode autopilote (§ 24 master prompt). Reprise possible après interruption en lisant ce fichier.

Format de chaque entrée :

```markdown
## Sprint N — YYYY-MM-DD HH:MM → YYYY-MM-DD HH:MM
- AGT-X : ✅/❌ description courte. Hash commit.
- GATE SN : ✅ PASS / ❌ FAIL (raison).
- Coût Claude API session : $X.XX
- Next : Sprint N+1 OR STOP raison.
```

---

## Phase 0 — Reality-check

*À vérifier en début de Day 1 Sprint 1 (autopilote) — 4 clés API et profil Manon désormais documentés explicitement (Sprint S0 2026-05-14).*

Pré-requis fournis :
- [ ] **4 clés API actives en `.env.local` + Coolify env vars** :
  - [ ] `OPENAI_API_KEY` (text + embeddings, fallback Anthropic)
  - [ ] `ANTHROPIC_API_KEY` (long-form, fallback OpenAI)
  - [ ] `PERPLEXITY_API_KEY` (data récente, pas de fallback)
  - [ ] `UNSPLASH_ACCESS_KEY` (images doctrine v2.0 — `gpt-image-1` retiré)
  - Note : `OPENAI_IMAGE_API_KEY` OBSOLÈTE depuis Q4 v2.0 (Unsplash uniquement)
- [x] **Q13 Manon résolu** (Sprint S0 2026-05-14) :
  - Option visuelle : **Option 4 « Portrait IA disclosed »** (cf. `_AUDIT/seeds-templates/manon-profile.md` § 2)
  - Photo source : `axionia/public/auteurs/manon.png` (placée 2026-05-14)
  - Bio : ✅ validée Will OK tel quel (cf. § 3)
  - LinkedIn / Twitter : `null` (persona transparente Option A v2.0)
  - Disclaimer IA fort dans alt + caption + Person JSON-LD description
- [ ] **KB ready (≥ 300 chunks AxionIA-canonical) OU `KB_BYPASS=true` accepté** (cf. session KB séparée)
- [ ] **Vérifier `NEXT_PUBLIC_SITE_URL=https://axion-ia.com` dans Coolify env vars** (sinon fallback prod déclenché par `src/lib/seo.ts` SITE_URL, mais SSOT propre = mieux). Commit fix : `1fd1518` (2026-05-14).
- [ ] Git push origin/main OK
- [ ] Coolify API token valide

### Sprint S0 (2026-05-14) — pré-requis appliqués

- ✅ Q13 Manon résolu (seed + photo + bio + disclaimer)
- ✅ Bugs SEO pré-existants fixés (commit `1fd1518` : sitemap.xml 301 + og:image SITE_URL force prod)
- ✅ P1 cosmétiques master prompt : enum `quality_improving` + titre § 20 « 13 questions » + § 5.1bis inventaire complet + note ordre § 24
- ✅ Commit #22 Sprint 1 Day 4 renommé : Unsplash-only (retiré gpt-image-1)
- ✅ SKILL.md description harmonisée v2.4
- → Audit re-vérification cible **≥ 180/200** attendu (était 173/200 avant S0)

---

## Sprint 1 — Foundations DB + Providers + Quality + SEO

*Statut : pending — à démarrer*

Agents prévus : AGT-A (DB) + AGT-B (Providers) + AGT-E (Quality) + AGT-F (SEO)

GATE attendu :
- pnpm prisma migrate deploy ✅
- pnpm typecheck ✅
- pnpm test:unit src/server/content-gen/ ✅
- pnpm verify:all ✅
- 1 call OpenAI test ✅
- Commit `feat(content-gen): foundations DB + providers + quality + seo`
- Push origin/main + Coolify auto-deploy ✅

---

*Les sprints 2 à 6 seront documentés ici au fur et à mesure.*
