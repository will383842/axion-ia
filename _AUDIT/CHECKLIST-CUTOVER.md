# Checklist Cutover Axion-IA — `axion-ia.com`

**Cible** : passage V1 LIVE (Coolify sslip.io) → prod publique sur `axion-ia.com`.
**Source** : `_AUDIT/AUDIT-FINAL-VERDICT.md` checklist 28 cases + Sprint 24
livraisons.

> Lecture : exécute dans l'ordre, coche au fur et à mesure. Les commandes sont
> copy-paste prêtes. Effort total estimé : 3-5 h hors warmup IP email
> (qui prend 7 jours en background).

---

## Phase A — RGPD & legal (action Will/DPO, ~1 h)

- [ ] **A1** Signer DPA Hetzner papier
  - URL : https://docs.hetzner.com/de/dsgvo/
  - Procédure : Hetzner Robot → Compliance → DSGVO/GDPR → Sign
  - Mettre à jour `_AUDIT/DPA-REGISTER.md` §2 (date + référence ticket)
- [ ] **A2** Accepter DPA Cloudflare online
  - URL : https://www.cloudflare.com/cloudflare-customer-dpa/
  - Procédure : Dashboard CF → Manage Account → Configurations → Privacy → Sign
  - Mettre à jour `_AUDIT/DPA-REGISTER.md` §3 (date)
- [x] **A3** ~~Créer boîte mail DPO~~ → **résolu** : Axion-IA OÜ utilise `contact@axion-ia.com` (boîte existante) comme adresse RGPD/DPO unique. Pas de boîte dédiée à créer. Will = DPO de fait pour V1 (gérant unique, < 250 employés → pas d'obligation de désigner un DPO formel RGPD art. 37).

---

## Phase B — Secrets prod (action Will, ~15 min)

- [ ] **B1** Générer secrets via le script :
  ```bash
  bash scripts/generate-prod-secrets.sh
  ```
  Le script sort 4 secrets prêts à copier-coller dans Coolify :
  - `AUTH_SECRET` (≥ 32 chars random)
  - `ADMIN_URL_PREFIX` (≥ 16 chars random alphanum)
  - `BACKUP_ENCRYPTION_PASSPHRASE` (≥ 32 chars random)
  - `INDEXNOW_KEY` (32 chars hex)
- [ ] **B2** Injecter dans Coolify env vars (toutes les 4 secrets ci-dessus).
- [ ] **B3** Renseigner aussi les vars existantes dans Coolify :
  - `TURNSTILE_SECRET_KEY` (depuis dashboard Cloudflare → Turnstile prod widget)
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (depuis @BotFather)
  - `COMPANY_REGISTRATION_NUMBER` (registrikood EE) + `COMPANY_VAT_NUMBER`
  - `HETZNER_STORAGE_USER` + `HETZNER_STORAGE_HOST` (depuis Storage Box dashboard)
  - `RETENTION_LOGS_MONTHS=12` + `RETENTION_SUBS_ARCHIVE_MONTHS=24` +
    `RETENTION_NEWSLETTER_UNSUB_MONTHS=36` + `RETENTION_BOOKINGS_CANCELLED_MONTHS=12`
    (Sprint 24/D3 — defaults appliqués si non définies)
- [ ] **B4** Vérifier qu'aucun secret ne reste en `dev_*` ou en fallback dev :
  ```bash
  # Côté Coolify dashboard, scan visuel des env vars
  ```

---

## Phase C — DNS Cloudflare 8 records (action Will, ~30 min)

Référence : `docs/ops/dns-records.md`. IP cible Hetzner : `178.105.55.15`.

- [ ] **C1** Apex `axion-ia.com` :
  - Type A · Nom `@` · Valeur `178.105.55.15` · Proxy ✅ (orange cloud)
- [ ] **C2** WWW :
  - Type CNAME · Nom `www` · Valeur `axion-ia.com` · Proxy ✅
- [ ] **C3** Admin (sous-domaine) :
  - Type A · Nom `admin` · Valeur `178.105.55.15` · Proxy ✅
- [ ] **C4** Mail PowerMTA :
  - Type A · Nom `mail` · Valeur `178.105.55.15` · Proxy ❌ (gris — SMTP requiert IP réelle)
- [ ] **C5** MailWizz :
  - Type A · Nom `mailwizz` · Valeur `178.105.55.15` · Proxy ✅
- [ ] **C6** Sentry :
  - Type A · Nom `sentry` · Valeur `178.105.55.15` · Proxy ✅
- [ ] **C7** Plausible :
  - Type A · Nom `plausible` · Valeur `178.105.55.15` · Proxy ✅
- [ ] **C8** Uptime Kuma :
  - Type A · Nom `uptime` · Valeur `178.105.55.15` · Proxy ✅
- [ ] **C9** MX (email reception) :
  - Type MX · Nom `@` · Priorité `10` · Valeur `mail.axion-ia.com`
- [ ] **C10** TXT email security (4 records) :
  - SPF : `v=spf1 mx ip4:178.105.55.15 -all`
  - DKIM : `default._domainkey` → `v=DKIM1; k=rsa; p=<2048-bit-key>`
  - DMARC : `_dmarc` → `v=DMARC1; p=quarantine; rua=mailto:contact@axion-ia.com; pct=100; adkim=s; aspf=s`
  - BIMI (optionnel) : `default._bimi` → `v=BIMI1; l=https://axion-ia.com/bimi-logo.svg`
- [ ] **C11** CAA :
  - Type CAA · Nom `@` · Tag `issue` · Valeur `letsencrypt.org`
- [ ] **C12** SSL/TLS Cloudflare :
  - Dashboard CF → SSL/TLS → Overview → Mode `Full (strict)`
  - Always Use HTTPS ✅
  - Min TLS Version 1.2

---

## Phase D — Email PowerMTA + DKIM (action Will, ~2-4 h)

- [ ] **D1** PowerMTA installé sur VPS Hetzner (suivre `docs/ops/runbook-deploy.md` §email).
- [ ] **D2** DKIM 2048 bits généré + clé publique posée dans DNS C10.
- [ ] **D3** SPF + DMARC validés via mxtoolbox.com :
  - https://mxtoolbox.com/SuperTool.aspx?action=mx%3aaxion-ia.com
  - Doit retourner ✓ pour SPF, DKIM, DMARC, MX.
- [ ] **D4** Warmup IP démarré (10/jour S1 → 50 → 200 → 500 → 1000+ sur 4 semaines).

---

## Phase E — Coolify deployment (~30 min)

- [ ] **E1** Custom domain `axion-ia.com` configuré dans Coolify pour le service web.
- [ ] **E2** SSL Let's Encrypt déclenché (auto-Caddy 2). Attendre validation HTTP-01.
- [ ] **E3** Build + deploy depuis `main` (auto via GitHub App déjà branché).
- [ ] **E4** Healthcheck `/api/healthz` → 200.
- [ ] **E5** Page `/fr` charge sans erreur (DOM check + console clean).

---

## Phase F — Monitoring (action Will, ~30 min)

- [ ] **F1** Sentry self-hosted up :
  ```bash
  ssh hetzner "cd /opt/sentry && docker compose up -d"
  ```
  Vérifier `https://sentry.axion-ia.com` accessible. Premier event capturé.
- [ ] **F2** Plausible self-hosted up :
  ```bash
  ssh hetzner "cd /opt/plausible && docker compose up -d"
  ```
  Vérifier `https://plausible.axion-ia.com` accessible. Site `axion-ia.com` ajouté.
- [ ] **F3** Uptime Kuma self-hosted up :
  ```bash
  ssh hetzner "cd /opt/uptime-kuma && docker compose up -d"
  ```
  Vérifier `https://uptime.axion-ia.com` accessible. **9 monitors actifs** :
  apex, www, admin, healthz, sentry, plausible, mail SMTP, mailwizz, postgres.
- [ ] **F4** Telegram bot test :
  ```bash
  curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
       -d "chat_id=$TELEGRAM_CHAT_ID" -d "text=[TEST] Cutover Axion-IA OK"
  ```
- [ ] **F5** Backup PostgreSQL premier run :
  ```bash
  ssh hetzner "cd /opt/axion-ia && bash scripts/backup-postgres.sh daily"
  ```
- [ ] **F6** Test restauration backup :
  ```bash
  ssh hetzner "cd /opt/axion-ia && bash scripts/restore-postgres-test.sh"
  ```

---

## Phase G — Tests post-cutover (~30 min)

- [ ] **G1** Lighthouse production via CI :
  ```bash
  pnpm lhci
  ```
  Cible : ≥ 95 perf/a11y/BP, = 100 SEO sur 16 URLs (`lighthouserc.json`).
- [ ] **G2** Playwright E2E :
  ```bash
  E2E_BASE_URL=https://axion-ia.com pnpm e2e
  ```
- [ ] **G3** Headers sécurité audit :
  ```bash
  curl -I https://axion-ia.com/fr | grep -E "(strict-transport|content-security|cross-origin|x-frame)"
  curl -I https://axion-ia.com/fr/<ADMIN_URL_PREFIX> | grep -i content-security-policy
  ```
  Admin doit avoir `'strict-dynamic'` sans `'unsafe-inline'`. Public doit avoir CSP soft.
- [ ] **G4** Test formulaire contact bout-en-bout :
  - Soumettre depuis `https://axion-ia.com/fr/contact`
  - Vérifier Telegram → `[CONTACT] J. D. (j****@example.com)`
  - Vérifier email confirmation reçu (vérifier `List-Unsubscribe-Post` header)
- [ ] **G5** Test booking + cancellation flow :
  - Soumettre `/fr/reserver`
  - Vérifier `[INTERVENTION]` Telegram avec PII redacted
  - Login admin → `/fr/<prefix>/calendrier` onglet Annuler → annule la résa
  - Vérifier `[ANNULATION]` Telegram + email annulation reçu
- [ ] **G6** Test self-service GDPR export :
  ```bash
  curl -X POST https://axion-ia.com/api/gdpr-export/request \
       -H "content-type: application/json" \
       -d '{"email":"<test-email>","locale":"fr"}'
  ```
  Vérifier email reçu avec lien `/fr/mes-donnees/export?token=...`.

---

## Phase H — Communication & finalisation (~10 min)

- [ ] **H1** Bandeau site (si update privacy depuis dernière publication) — si majeur (ajout sous-processeur), sinon skip.
- [ ] **H2** `_AUDIT/AUDIT-FINAL-VERDICT.md` checklist 28 cases : cocher les ✅ correspondants à cette session.
- [ ] **H3** `_AUDIT/DPA-REGISTER.md` : remplir les dates de signature et références.
- [ ] **H4** Tag git `v1.0.0` :
  ```bash
  git tag -a v1.0.0 -m "Cutover prod publique axion-ia.com"
  git push origin v1.0.0
  ```
- [ ] **H5** Annonce Telegram ops `[DEPLOY] Cutover v1.0.0 axion-ia.com OK`.

---

## Phase I — Sprint 16 PERF (post-cutover, non-bloquant)

À planifier après ~7 jours de stabilité prod :

- [ ] **I1** Mesurer CrUX baseline réelle via Chrome UX Report API.
- [ ] **I2** Profiler bundle Sentry (`pnpm build && du -sh .next/static/chunks/`).
- [ ] **I3** Implémenter split Sentry vendor + lazy import → cible First Load JS ≤ 75 KB gz.
- [ ] **I4** Décider SSG vs dynamic pour activer CSP `strict-dynamic` complet sur public
      (alternative : hash-based CSP pour les inline JSON-LD + speculation rules).

---

**Validation finale du cutover** : toutes les cases A1 → H5 cochées + 0 alerte
critique Sentry + 0 incident Uptime Kuma pendant 24 h consécutives.
