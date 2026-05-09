# DPA Register — Axion-IA OÜ

**Responsable** : Will (gérant Axion-IA OÜ) · DPO email `dpo@axion-ia.com`
**Tenue** : ce fichier sert de registre RGPD art. 30 (registre des activités
de traitement) côté sous-processeurs. Révision trimestrielle minimum.
**Statut juridique** : RGPD (UE) 2016/679, droit estonien (AKI compétent).

---

## 1. Synthèse — sous-processeurs déclarés

| #   | Sous-processeur           | Finalité                          | Localisation            | DPA    | Base légale transfert      | Statut         |
| --- | ------------------------- | --------------------------------- | ----------------------- | ------ | -------------------------- | -------------- |
| 1   | Hetzner Online GmbH       | VPS + Storage Box backups offsite | Allemagne (Frankfurt)   | papier | UE intra-zone              | 🟡 à signer    |
| 2   | Cloudflare, Inc.          | CDN + DDoS + Turnstile captcha    | États-Unis              | online | SCC + EU-US DPF            | 🟡 à accepter  |
| 3   | Telegram FZ-LLC           | Notifications admin (Bot API)     | Émirats Arabes Unis     | aucun  | Art. 49 + minimisation PII | ✅ ADR 0010    |
| 4   | Sentry (self-hosted)      | Crash reporting + traces          | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted |
| 5   | Plausible (self-hosted)   | Analytics anonymes                | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted |
| 6   | Uptime Kuma (self-hosted) | Monitoring uptime                 | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted |

> ⚠️ **Backblaze N'EST PAS utilisé**. Le code utilise Hetzner Storage Box uniquement
> (`HETZNER_STORAGE_*` env vars). La mention Backblaze dans `src/content/legal.ts`
> Sprint 24/A1 doit être retirée — voir Action correctif §5 ci-dessous.

---

## 2. Hetzner Online GmbH (priorité 1 — bloquant cutover)

| Champ                     | Valeur                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Nom légal**             | Hetzner Online GmbH                                                                         |
| **Adresse**               | Industriestr. 25, 91710 Gunzenhausen, Allemagne                                             |
| **Finalité**              | Hébergement VPS CPX32 + Storage Box BX11 (backups offsite chiffrés AES-256)                 |
| **Données traitées**      | Toutes les données applicatives (DB Postgres, Redis, fichiers uploads, backups DB chiffrés) |
| **Localisation physique** | Datacenter Frankfurt (UE)                                                                   |
| **Garanties**             | ISO 27001, ISO 9001, BSI C5, EU-DSGVO compliant                                             |
| **DPA**                   | À signer (papier ou électronique)                                                           |
| **Lien template**         | https://docs.hetzner.com/de/dsgvo/ (FR/DE/EN)                                               |
| **Procédure**             | Connexion Hetzner Robot → Compliance → DSGVO/GDPR → Sign Auftragsverarbeitungsvertrag       |
| **Durée conservation**    | Liée au contrat (résiliation = 30 j de purge auto)                                          |
| **Statut**                | 🟡 **À SIGNER** par Will avant cutover                                                      |
| **Date signature**        | _(à compléter)_                                                                             |
| **Référence interne**     | _(à compléter — n° ticket Hetzner)_                                                         |

---

## 3. Cloudflare, Inc.

| Champ                     | Valeur                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Nom légal**             | Cloudflare, Inc.                                                              |
| **Adresse**               | 101 Townsend St, San Francisco, CA 94107, USA                                 |
| **Finalité**              | CDN + protection DDoS + Turnstile (captcha anti-spam formulaires)             |
| **Données traitées**      | IP visiteur, User-Agent, requêtes HTTP (logs CDN)                             |
| **Localisation physique** | Edge mondial — données peuvent être routées via des POPs hors UE              |
| **Garanties**             | DPA + clauses contractuelles types (SCC) + EU-US Data Privacy Framework (DPF) |
| **DPA**                   | Online — auto-acceptable depuis dashboard CF                                  |
| **Lien**                  | https://www.cloudflare.com/cloudflare-customer-dpa/                           |
| **Procédure**             | Dashboard Cloudflare → Manage Account → Configurations → Privacy → Sign DPA   |
| **Durée conservation**    | Logs CDN : 30 j max                                                           |
| **Statut**                | 🟡 **À ACCEPTER** par Will avant cutover                                      |
| **Date signature**        | _(à compléter)_                                                               |

---

## 4. Telegram FZ-LLC

| Champ                     | Valeur                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Telegram FZ-LLC                                                                                                                                 |
| **Adresse**               | 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ (UK) — opérations FZ-LLC Dubai                                                            |
| **Finalité**              | Notifications admin via Bot API (~14 messages/jour côté ops)                                                                                    |
| **Données traitées**      | **PII minimisée** (cf. ADR 0010) : email partiel `j****@acme.com`, initiales `J. D.`, téléphone partiel, sociétés en clair, dates/prix/IDs UUID |
| **Localisation physique** | Émirats Arabes Unis (EAU) — pays sans décision d'adéquation                                                                                     |
| **Garanties**             | Aucun DPA standard. **Base légale = RGPD art. 49.1.a (consentement explicite admin)** + minimisation PII (ADR 0010).                            |
| **DPA**                   | NA — pas de DPA standard pour Telegram Bot API                                                                                                  |
| **Procédure mitigation**  | ADR 0010 acté + helper `src/lib/pii-redaction.ts` + 14 sites patchés                                                                            |
| **Statut**                | ✅ **CONFORME** post-Sprint-24.1 (minimisation appliquée)                                                                                       |
| **Révision**              | Si volume > 100 msg/jour ou multi-utilisateur ops → migrer Mattermost UE (option B ADR 0010)                                                    |

---

## 5. Action correctif Backblaze (clarification legal.ts)

`src/content/legal.ts` Sprint 24/A1 mentionne Backblaze comme sous-processeur.
**C'est une erreur** : le code n'utilise que Hetzner Storage Box pour les
backups offsite. Backblaze était mentionné dans des audits anciens.

**Action** : retirer la mention Backblaze de la section "Sous-processeurs"
FR + EN. Voir patch Sprint 24.1.

---

## 6. Procédure d'ajout d'un nouveau sous-processeur

1. **Avant ajout** :
   - Vérifier localisation (UE = automatique, hors UE = base légale requise).
   - Identifier finalité + minimisation PII applicable.
2. **Documentation** :
   - Ajouter ligne dans la table §1 ci-dessus.
   - Ajouter section dédiée (template §2/§3/§4).
   - Mettre à jour `src/content/legal.ts` (FR + EN).
3. **Signature** :
   - DPA online → screenshot daté + référence interne ticket.
   - DPA papier → scan PDF stocké chiffré (Storage Box `/legal/dpa/`).
4. **Communication** :
   - Si ajout post-cutover : notification utilisateurs newsletter + bandeau
     site (RGPD art. 13.3 — modification finalité/destinataires).
5. **Audit** :
   - Mise à jour de ce registre.
   - Activity log `prisma.activityLog` action `dpa.signed` ou `dpa.accepted`.

---

## 7. Procédure de droits RGPD utilisateur

Cf. `src/app/[locale]/mes-donnees/page.tsx` (page exposée) +
`/api/gdpr-export` (Sprint 24/D2) + Server Actions admin
`eraseSubmissionAction` / `eraseSubscriberAction` (Sprint 24/D1).

**Réponses standard** : 4 templates emails RGPD prêts dans
`docs/dpo-templates/` (Sprint 24.1).

---

## 8. Historique

| Date       | Événement                                                                     |
| ---------- | ----------------------------------------------------------------------------- |
| 2026-05-09 | Création du registre (Sprint 24.1). 4 lignes à signer/accepter avant cutover. |
| 2026-05-09 | ADR 0010 acté (minimisation PII Telegram Option A).                           |
| _(date)_   | DPA Hetzner signé (Will). Référence : ********\_********                      |
| _(date)_   | DPA Cloudflare accepté (Will).                                                |
| _(date)_   | Audit AKI annuel (rappel : prévoir Q4 2026).                                  |
