# Axion-IA — À faire maintenant (état 2026-05-11)

## Verdict : 🔴 NO-GO transitoire (score 78.7/100)

> Arbitrage Will 2026-05-11 : **Option A** — traiter les 12 P0 → re-audit attendu 🟢/🟡 (~92-93/100).
> Ce fichier est **autonome** : lis-le seul, tu n'as pas besoin du reste pour démarrer.
> Volume travail estimé : **2-3 jours dev + ~2 h actions Will + ~10 min DNS/CF dashboard**.

---

## 🚨 Avant tout — Vérification urgence absolue (5 min)

**Question critique** : `TURNSTILE_SECRET_KEY` est-il set sur Coolify prod ?

- **Si OUI** → toutes les soumissions `/reserver` `/contact` `/audit` `/newsletter` `/implementation` **échouent silencieusement depuis le dernier deploy** (fail-closed serveur, widget client absent). Perte de leads continue.
- **Si NON** → fail-open temporaire, pas d'urgence absolue, mais à câbler quand même.

**Action immédiate** :

```bash
# via Coolify dashboard → app Axion-IA → Environment Variables
# OU via API :
curl -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  $COOLIFY_API_URL/applications/$COOLIFY_APP_UUID/envs | jq '.[] | select(.key=="TURNSTILE_SECRET_KEY")'
```

→ Si set, **désactiver temporairement** la clé OU **désactiver `verifyTurnstile`** côté code (PR rollback éclair) le temps de câbler le widget client. Sinon **business cassé**.

---

## ⚡ Cette semaine (12 P0 — bloquant)

Séquence optimisée : quick wins externes d'abord (effet immédiat zéro risque), puis code dans l'ordre dépendance.

### Phase A — Quick wins externes (~30 min, sans code)

- [ ] **1. DMARC DNS** — Namecheap → DNS → ajouter TXT `_dmarc` `v=DMARC1; p=none; rua=mailto:dmarc@axion-ia.com; sp=none; pct=100` — **5 min** — pourquoi : ferme la fenêtre de spoofing axion-ia.com. Mode `p=none` = observation 2-4 semaines puis montée `p=quarantine`.
- [ ] **2. CF Managed Content OFF** — Cloudflare dashboard → Security → Bots → désactiver "Cloudflare Managed Content `robots.txt`" — **5 min** — pourquoi : débloque ClaudeBot/GPTBot/Google-Extended → l'investissement AEO/GEO (18 factories JSON-LD) devient effectif. Vérif après : `curl -A "ClaudeBot/1.0" https://axion-ia.com/robots.txt | head -10` doit montrer `Allow: /` en tête (origin Next).
- [ ] **3. DPA Hetzner** — Hetzner Console → DPA → accepter en ligne — **15 min** — pourquoi : Article 28 RGPD documenté pour le sous-processeur infra principal.
- [ ] **4. DPA Cloudflare** — Cloudflare dashboard → account → DPA → accepter — **5 min** — pourquoi : idem pour le CDN/WAF.

### Phase B — Code patches monitoring (~2 h) — fondation pour tout le reste

- [ ] **5. `withSentryConfig` réintégration** — `next.config.ts:140` — **30 min** — pourquoi : sourcemaps uploadées au build → stacks Sentry lisibles en prod. Pré-requis pour tout diagnostic d'incident. Sans ce fix, n°6 est partiellement gâché.
  - Patch type : envelopper le `export default nextConfig` avec `withSentryConfig(nextConfig, { silent: !process.env.CI, ...sentryOptions })`. Vérifier que `SENTRY_AUTH_TOKEN` est bien dans env CI.
- [ ] **6. Sentry PII scrub** — `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts` — **1 h** — pourquoi : ferme la brèche RGPD Art. 32 (IP/cookies/Authorization headers fuitent par défaut vers Sentry SaaS).
  - Ajouter dans les 3 configs : `sendDefaultPii: false`, puis `beforeSend(event) { /* scrub email, IP, cookies, auth headers via regex */ return event; }`.
- [ ] **7. Cleanup debug auth.ts** — `src/auth.ts:99-117` — **15 min** — pourquoi : retire le `[DEBUG TEMPORAIRE 2026-05-10]` qui dump email + IP credentials, aggravant n°6. Tag P1 normalement mais à grouper.
- [ ] **8. Sentry self-hosted promesse** — `docker/monitoring/docker-compose.monitoring.yml` — **15 min** — pourquoi : aligne doc/runbook/code. Décision rapide : **option courte** = retirer les commentaires "Sentry self-hosted prévu" + update runbook-monitoring.md. (Option longue = câbler self-hosted, ~1 j hors scope sprint.)

### Phase C — Code patches business + RGPD (~4-6 h)

- [ ] **9. Turnstile widget client** — 6 forms dans `src/components/forms/` (AuditForm, BookingForm, ContactForm, ImplementationForm, NewsletterForm + RoiForm si applicable) — **2-3 h** — pourquoi : restaure le flow business `/reserver` + tous les formulaires si Turnstile secret set en prod.
  - Recommandation lib : `@marsidev/react-turnstile` (typé React, maintenu). Alternative native iframe : `<div className="cf-turnstile" data-sitekey={NEXT_PUBLIC_TURNSTILE_SITE_KEY} />` + script `https://challenges.cloudflare.com/turnstile/v0/api.js`.
  - Le token doit être injecté dans le FormData sous le nom `cf-turnstile-response` AVANT submit. Vérifier les 7 sites server qui appellent `verifyTurnstile`.
- [ ] **10. Page `/mes-donnees/export`** — créer `src/app/[locale]/mes-donnees/export/page.tsx` + entrée `i18n/routing.ts:pathnames` (`/mes-donnees/export` ↔ `/my-data/export`) — **2-4 h** — pourquoi : route référencée en dur dans `gdpr-export/request/route.ts:48` (lien email RGPD) → corrige le 404 et opérationnalise RGPD Art. 20 (portabilité).
  - Contenu page : formulaire mini ou résumé "Votre lien d'export expire dans X. Téléchargez-le ici" + appel `/api/gdpr-export?token=...` côté client.

### Phase D — Tests + CI gates (~1-2 jours)

- [ ] **11. Spec E2E `/reserver` booking submit** — créer `tests/e2e/flows/booking-submit.spec.ts` (chromium-only) — **2-3 h** — pourquoi : détecte en CI toute régression du flow conversion principal (préviens un re-cassage Turnstile).
  - Couvrir : ouverture `/reserver`, sélection slot, remplissage form, mock Turnstile token (`page.evaluate(() => window.__test_turnstile__ = 'ok')`), submit, attente confirmation, vérif insertion DB via Prisma test client.
- [ ] **12. Vraie intégration `tests/integration/server-actions.test.ts`** — réécrire en pipeline complète Zod → Prisma `*_test` schema → activityLog → BullMQ → vérif état DB — **4-6 h** — pourquoi : actuellement le fichier ne fait que `safeParse()` mais promet en commentaire un pipeline complet. **Faux signal de sécurité** à fermer.
  - Pré-requis : DB de test isolée (`DATABASE_URL_TEST` ou schema namespacé `*_e2e`). Documenter Q-T1 ouverte.
- [ ] **13. LHCI hard fail dans `deploy-coolify.yml`** — `.github/workflows/deploy-coolify.yml` — **1 h** — pourquoi : gate PR Web Vitals annoncée AGENTS.md mais inopérante (`ci.yml:101` `continue-on-error: true` + note morte "Sprint 14 enables hard fail").
  - Étapes : `pnpm lhci collect --config=lighthouserc.json` sur 5 URLs (`/fr`, `/en`, `/fr/audit`, `/fr/reserver`, `/fr/implantations/ile-de-france/paris`) → `pnpm lhci assert` avec budgets stricts. Retirer `continue-on-error: true`.
- [ ] **14. Nightly Gate D — décommenter 5 steps** — `.github/workflows/nightly.yml` — **2-4 h × 5 = 1-2 j** — pourquoi : passe du nightly fantôme à un vrai filet de sécurité nocturne.
  - Steps à activer : Playwright full chromium, ZAP OWASP scan, mail-tester deliverability probe, backup-drill `scripts/restore-postgres-test.sh` + fix `bookings_simple` → `bookings`, Lighthouse Top 15.

---

## 🎯 Sprint suivant (≤ 2 semaines) — Top P1 critiques

Issus de la `SYNTHESE-FINALE.md`. À traiter après le sprint P0.

- [ ] Cleanup CSP migration strict-dynamic (ouvrir ADR 0011 — parking Sprint 16 PERF)
- [ ] Booking lock pessimiste `FOR UPDATE` (cohérence avec `postOption48hAction`)
- [ ] Honeypot HTML caché dans 6 forms (le check serveur existe sans champ)
- [ ] Sentry sous-processeurs ajouter dans `legal.ts` + corriger contradiction "pas de transfert hors UE"
- [ ] CVE postcss → bump >= 8.5.10
- [ ] `consentVersion` Prisma Submission
- [ ] Pino logger câblage code (remplacer ~50 `console.log`)
- [ ] Speculation Rules : retirer `eager` wildcards `/audit/*` `/interventions/*` (cap egress mobile)
- [ ] `og:locale=en_US` → `en_GB`, hreflang régionaux `fr-FR`/`en-GB`
- [ ] Page `/methodologie` étoffer 1500+ mots (sous plancher doctrine)
- [ ] `<img>` → `next/image` dans `TeamGrid.tsx:29`, `PressSpokesperson.tsx:46`
- [ ] Footer cap `MAX_FOOTER_VILLES` avant industrialisation Auvergne
- [ ] DB `@db.Timestamptz` migration (UTC garanti)

---

## 🔍 Actions Will (hors code)

- [ ] **DNSSEC** activation Namecheap (ajouter DS record côté registrar pour zone CF) — **5 min**
- [ ] **Search Console** vérifier coverage post-fix CF Managed Content (28 j après) — confirme indexation AEO bots
- [ ] **mail-tester.com** envoyer un mail prod et lire le score — confirme SPF+DKIM+DMARC + chaîne PowerMTA
- [ ] **Vérifier Plausible referrers** : `claude.ai`, `chatgpt.com`, `perplexity.ai`, `gemini.google.com` après 30 j post CF Managed Content OFF
- [ ] **Boîte `dpo@axion-ia.com`** : confirmer redirection effective (MX Namecheap forwarder)
- [ ] **Re-mesurer Lighthouse local** après les 12 P0 :
  ```bash
  INDEXNOW_DISABLED=true npm_config_ignore_scripts=true pnpm build
  pnpm start --port 3010 &
  pnpm lhci collect --url=http://localhost:3010/fr --url=http://localhost:3010/fr/reserver \
                    --url=http://localhost:3010/fr/implantations/ile-de-france/paris
  ```

---

## ✅ Critères de re-validation (≈ J+3)

Avant de relancer le re-audit :

1. `pnpm typecheck` + `pnpm lint` + `pnpm test` verts (baseline 127 tests).
2. `pnpm test:e2e --grep "booking-submit"` vert.
3. `pnpm test:integration` vraiment intégré (DB write + worker dispatch vérifié).
4. `curl -A "ClaudeBot/1.0" https://axion-ia.com/robots.txt | head -10` → `Allow: /`.
5. `nslookup -type=TXT _dmarc.axion-ia.com` → record DMARC présent.
6. `curl -sI https://axion-ia.com/fr/mes-donnees/export` → 200.
7. Sentry test event en prod → stack lisible + 0 PII dans breadcrumbs.
8. `.github/workflows/nightly.yml` 0 step `if: false`.
9. `.github/workflows/deploy-coolify.yml` LHCI hard fail actif.

→ Si 9/9 verts, relancer audit E2E (15 agents). Score cible : **≥ 92/100, 0 P0 sécu/RGPD ⇒ 🟢 GO**.

---

## 📁 Pour aller plus loin

- **Synthèse complète** : `_AUDIT/E2E-2026-05-09/SYNTHESE-FINALE.md`
- **Détail Pass B** : `_AUDIT/E2E-2026-05-09/05-PASS-B/PASS-B-CROISEMENT-P0.md`
- **15 rapports agents** : `_AUDIT/E2E-2026-05-09/02-AGENTS/`
- **8 prod-live probes** : `_AUDIT/E2E-2026-05-09/04-PROD-LIVE/`
- **Alerte NO-GO contexte** : `_AUDIT/E2E-2026-05-09/🚨-NO-GO-ALERT.md`

---

**Statut** : audit clos. Si Will veut que j'enchaîne sur l'implémentation des 12 P0 directement (sortie du mode AUDIT-ONLY), il suffit de donner le feu vert et je commence par Phase A (quick wins) puis Phase B-C-D en série.
