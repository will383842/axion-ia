# AUDIT FINAL — AGT-RGPD-LEGAL

**Périmètre** : audit RGPD/legal/DPA/cookies/droits utilisateurs/transferts de données pour Axion-IA, post Pass B, en vue de la mise en production publique.

**Cabinet** : Axion-IA OÜ (Estonie, UE) · cabinet IA opérationnel B2B premium.
**Auditeur** : AGT-RGPD-LEGAL (lecture seule, écriture `_AUDIT/` uniquement).
**Date** : 2026-05-09.
**Scope code** : `src/app/[locale]/{mentions-legales,politique-confidentialite,conditions-generales,cookies,rgpd,desabonnement,mes-donnees,preferences-cookies}` + `src/content/legal.ts` + `src/features/{newsletter,booking,contact,audit,implementation}/actions.ts` + `src/features/admin-{newsletter,submissions}/actions.ts` + `src/lib/{email/client.ts,email/templates/_layout.tsx,turnstile.ts,telegram.ts,client-ip.ts}` + `src/auth.{config,}.ts` + `src/{instrumentation-client,sentry.{server,edge}.config}.ts` + `src/components/analytics/Plausible.tsx` + `src/app/api/unsubscribe/route.ts` + `prisma/schema.prisma` + `docs/adr/0009-*.md` + `docs/ops/*.md`.

---

## 0. Verdict global

**Statut** : **CONDITIONAL GO PROD** — la plateforme est très majoritairement RGPD-conforme dans la copy légale, l'architecture (self-hosting Hetzner UE, double opt-in newsletter, double-token confirm/unsubscribe, hash argon2id, JWT Auth.js par défaut, schémas Zod avec consent obligatoire), et le bilinguisme (FR + EN). Mais **3 P0** bloquent une mise en prod publique honnête :

1. **List-Unsubscribe SMTP headers absents** (`src/lib/email/client.ts`) → newsletter non conforme RFC 8058 côté envoi (alors que l'endpoint `/api/unsubscribe` est prêt).
2. **Liste des sous-traitants / sous-processeurs absente** des pages légales (`src/content/legal.ts` § politique-confidentialite et cookies) → violation RGPD art. 13.1.e (information sur destinataires) et art. 28.
3. **Privacy policy claim « Aucun transfert hors UE »** contredit par la stack réelle (Cloudflare Turnstile US, Telegram US/UK, Backblaze B2 default = US, Sentry Cloud si non self-hosted en V1) → mention trompeuse à régulariser AVANT publication.

Dès que ces 3 P0 sont corrigés (≈ 4-6 h dev + copy), la plateforme passe à **GO PROD**.

### Compteurs

| Sévérité | Nombre | Bloque prod ?          |
| -------- | ------ | ---------------------- |
| **P0**   | **3**  | OUI                    |
| P1       | 9      | non, à fixer Sprint 24 |
| P2       | 6      | non, polish            |
| P3       | 4      | non, future            |

---

## 1. Bandeau cookies — Verdict : **OK** (P3 sur précision Plausible)

**Doctrine respectée**. Aucun cookie tiers publicitaire détecté. Aucune dépendance Google Analytics / Facebook Pixel / Hotjar / etc. Plausible self-hosted (`src/components/analytics/Plausible.tsx`) ne pose **aucun cookie persistant** (validation CNIL/AKI 2022). `Sentry init` (`src/instrumentation-client.ts:7-19`) ne charge pas Replay (`replaysSessionSampleRate: 0`), donc pas de cookie Sentry navigateur. **Pas de bandeau cookies → conforme**.

- **P3-1** : la page `/preferences-cookies` (`src/app/[locale]/preferences-cookies/page.tsx:67-73`) écrit « Si vous activez explicitement notre analytics auto-hébergé Plausible (Sprint 23) ». Or Plausible **est déjà actif** (Sprint 23 = M11 livré selon mémoire). Phrase à mettre à l'imparfait/présent simple : « Notre analytics auto-hébergé Plausible ne pose aucun cookie ni empreinte numérique ».

## 2. Consentement marketing — Verdict : **OK** (P2 sur archive consent log)

**Toutes les actions enforcent le consent au schéma Zod** :

| Form           | Schéma                 | Consent                                     | Fichier:ligne                      |
| -------------- | ---------------------- | ------------------------------------------- | ---------------------------------- |
| Newsletter     | `newsletterSchema`     | `z.literal(true)`                           | `src/lib/schemas/forms.ts:20-23`   |
| Contact        | `contactSchema`        | `z.literal(true)`                           | `src/lib/schemas/forms.ts:10-16`   |
| Audit (5-step) | `auditSchema`          | `z.literal(true)`                           | `src/lib/schemas/forms.ts:46-48`   |
| Audit demande  | `auditRequestSchema`   | `z.literal(true)`                           | `src/lib/schemas/forms.ts:98-100`  |
| Implementation | `implementationSchema` | `z.literal(true)`                           | `src/lib/schemas/forms.ts:131`     |
| Booking        | `bookingSchema`        | `z.literal(true)`                           | `src/lib/schemas/forms.ts:147`     |
| Option 48h     | `option48hSchema`      | `z.literal(true)` + `consentDisplay` séparé | `src/lib/schemas/forms.ts:166-173` |

Newsletter **double opt-in RFC 8058** correctement implémenté :

- `subscribeNewsletterAction` (`src/features/newsletter/actions.ts:25-103`) → status `pending`, génère `confirmToken` + `unsubscribeToken`, enqueue email `newsletter-confirm-optin` avec `marketing: true`.
- `confirmNewsletterAction` (`src/features/newsletter/actions.ts:117-164`) → consomme le confirm token, idempotent.
- Schéma `NewsletterSubscriber` (`prisma/schema.prisma:671-694`) trace `confirmedAt`, `confirmSentAt`, `unsubscribedAt`, `ipAddress`, `source`. **Suffit comme preuve d'opt-in** RGPD art. 7.1.

- **P2-1** : aucune `submissions.consentGivenAt`/`consentVersion` dans le schéma `Submission` (`prisma/schema.prisma:154-`). Cela rend tracée la **case cochée** (via type `z.literal(true)`) mais pas la **version du texte de consentement** affiché à l'utilisateur. Recommandation : ajouter `consentVersion VARCHAR(40)` + `consentText TEXT` (ou ID renvoyant à `src/content/legal.ts`) — utile en cas de contestation 2-3 ans plus tard.

## 3. Droit à l'effacement (RGPD art. 17) — Verdict : **PARTIEL / P1**

**Page legale existe** : `/rgpd` (`src/content/legal.ts:354-357`) + `/mes-donnees` (`src/app/[locale]/mes-donnees/page.tsx:48`) annoncent le droit avec contact `dpo@axion-ia.com`.

**Mais aucune action admin de suppression côté code** :

- `prisma.submission.delete` → **0 occurrence** dans `src/`.
- `prisma.newsletterSubscriber.delete` → **0 occurrence** (uniquement `update {status: 'unsubscribed'}` dans `src/features/admin-newsletter/actions.ts:174-177` — ce qui est correct pour l'unsubscribe RGPD-art-17 conservant la preuve de retrait, mais pas pour un effacement total).
- `forceUnsubscribeAction` (`src/features/admin-newsletter/actions.ts:140-181`) ne supprime pas la PII (email gardé indéfiniment).

**Conséquence opérationnelle** : DPO doit faire `psql` brut pour effacer un user qui exerce art. 17, sans procédure tracée → risque d'erreur, pas d'audit trail, pas de scope check pour conserver les pièces comptables (5 ans Estonie).

- **P1-1** : ajouter Server Action `eraseSubmissionAction(submissionId)` réservée `super_admin` qui :
  1. anonymise `contactName/contactEmail/contactPhone/companyName` (tombstone : `Anonymisé · RGPD art.17 · 2026-XX-XX`)
  2. conserve `id/type/locale/submittedAt` + `details` purgé
  3. log dans `activity_logs.action='gdpr.erasure_request'`
  4. preserve les bookings liés (5 ans accounting).
- **P1-2** : ajouter Server Action `eraseSubscriberAction(id)` qui delete hard la ligne `newsletter_subscribers` (autorisé puisque pas de pièce comptable rattachée à un opt-in).
- **P1-3** : ajouter UI `/admin-dev-x7k2n9/rgpd` listant les demandes RGPD reçues + bouton « Anonymiser » / « Effacer définitivement » + export JSON portabilité.

## 4. Droit à la portabilité (RGPD art. 20) — Verdict : **PARTIEL / P1**

**Exports CSV admin existent** :

- `exportSubmissionsCsvAction` (`src/features/admin-submissions/actions.ts:229-312`) — restreinte `super_admin/admin/editor`, audit log dans `activity_logs.action='submission.exported'`. ✅
- `exportSubscribersCsvAction` (`src/features/admin-newsletter/actions.ts:188-263`) — restreinte `super_admin/admin`, refuse status `unsubscribed/bounced` (anti-exfiltration art. 17 — bonne pratique), audit log `newsletter.exported`. ✅

Mais **AUCUN endpoint user-facing pour qu'un user récupère ses propres données** (RGPD art. 20.2 « format structuré, couramment utilisé et lisible par machine »).

- **P1-4** : aucun `/api/me` / `/api/gdpr/export?token=…` n'existe. Pour respecter strictement art. 20, le DPO peut faire un export CSV manuel à la demande (process documenté dans `/mes-donnees`), MAIS la doctrine 2026 (CNIL « guide RGPD pour le développeur » + EDPB 02/2024) recommande un mécanisme self-service basé sur lien signé email, similaire au token unsubscribe. **Action** : créer `/api/gdpr-export` produisant un JSON groupant `submissions` (where contactEmail) + `bookings` (via submissionId) + `newsletter_subscribers` (where email) + `activity_logs` (where adminUserId si admin). Cf. modèle `unsubscribe`.
- **P1-5** : la page `/mes-donnees` (`src/app/[locale]/mes-donnees/page.tsx:91-99`) renvoie **uniquement** vers email `dpo@axion-ia.com`. Pas de lien direct « Demander mes données maintenant ». Acceptable V1 mais à industrialiser dans Sprint 24.

## 5. Mentions légales — Verdict : **OK avec réserves / P1**

**Page FR `/mentions-legales` + EN `/legal-notice` présentes**, contenu bilingue dans `src/content/legal.ts:31-102`. Sections : Éditeur, Directeur de publication, Hébergeur, Propriété intellectuelle, Loi applicable.

**Champs présents** :

- ✅ Raison sociale (Axion-IA OÜ) + forme juridique (SARL droit estonien)
- ✅ Siège social (Tallinn, Estonie)
- ✅ Hébergeur complet (Hetzner Online GmbH · Industriestr. 25 · 91710 Gunzenhausen · DE · UE)
- ✅ Loi applicable (droit estonien)
- ✅ Email contact (`contact@axion-ia.com`)

**Manques** :

- **P1-6** : `registrikood` (Estonian commercial registry code, équivalent SIREN) marqué « communiqué sur demande » (`src/content/legal.ts:44, 77`). Or il s'agit d'une donnée **publique** (ariregister.rik.ee) que tout site marchand UE doit afficher en clair. Will l'a en attente côté immat-OÜ. **Bloquant pour B2C UE — contournable en B2B pur**, mais à intégrer dans `env.COMPANY_REGISTRATION_NUMBER` dès réception.
- **P1-7** : `EU VAT` (numéro de TVA EE) idem « sur demande ». Pour facturation B2B intra-communautaire (reverse charge), le numéro TVA doit figurer sur les factures, et il est de bonne pratique de l'afficher sur les mentions légales (Stripe/Lemon Squeezy/Paddle l'exigent pour B2B EU sales). Idem `env.COMPANY_VAT_ID`.
- **P2-2** : pas de mention du **DPO email** dans `/mentions-legales`. Bonne pratique : ajouter une section « Délégué à la protection des données » avec `dpo@axion-ia.com` (déjà présent dans `/politique-confidentialite` § Responsable du traitement).

## 6. CGU/CGV — Verdict : **OK** (P3 sur médiation)

**Page bilingue** `/conditions-generales` (FR) / `/terms` (EN) présente. `src/content/legal.ts:103-189`. Contient : Objet, Devis et commande, Tarifs et paiement, Livraison, Garanties et limites de responsabilité, Annulation et remboursement, Loi applicable.

- ✅ Couvre les 7 points indispensables CGV B2B
- ✅ Politique d'annulation chiffrée (100/50/0 % selon délai)
- ✅ TVA estonienne EU disclosed
- ✅ Limitation de responsabilité (montant facturé)

**Manques** :

- **P3-2** : pas de clause de **médiation conventionnelle**. Pour B2C ou utilisateur « consommateur » UE, l'art. 14 du Règlement UE 524/2013 impose un lien vers la plateforme RLL européenne (`https://ec.europa.eu/consumers/odr`). Comme Axion-IA est **B2B pur**, la clause est techniquement non requise — mais à ajouter à neutralité de risque si un dirigeant TPE pouvait être considéré comme consommateur (jurisprudence française).
- **P3-3** : pas de clause de **rétractation 14 jours**. Idem, B2B pur → non requis (art. L221-3 Code conso français), mais à clarifier dans la section Annulation pour éviter ambiguïté.

## 7. Politique de confidentialité — Verdict : **OK avec gros trou DPA / P0**

Page `/politique-confidentialite` (FR) + `/privacy-policy` (EN) présentes. `src/content/legal.ts:190-275`. Sections : Responsable du traitement, Données collectées, Finalités, Base légale, Durée de conservation, Vos droits, Hébergement et transferts.

**Couverture des 12 points RGPD obligatoires (art. 13)** :

| #   | Point obligatoire (art. 13)                            | Présent ?                 | Fichier:ligne                                                                                   |
| --- | ------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Identité du responsable + DPO                          | ✅                        | `legal.ts:201-203`                                                                              |
| 2   | Finalités du traitement                                | ✅                        | `legal.ts:209-211`                                                                              |
| 3   | Base légale                                            | ✅                        | `legal.ts:213-215`                                                                              |
| 4   | Intérêts légitimes poursuivis                          | ✅ (sécurité)             | `legal.ts:214`                                                                                  |
| 5   | Destinataires / catégories de destinataires            | ❌ **P0**                 | manque                                                                                          |
| 6   | Transferts hors UE + garanties (CCT, BCR, …)           | ⚠️ **P0**                 | `legal.ts:225-227` ment                                                                         |
| 7   | Durée de conservation                                  | ✅                        | `legal.ts:217-219`                                                                              |
| 8   | Droits (accès, rectification, …, opposition)           | ✅                        | `legal.ts:221-223`                                                                              |
| 9   | Droit retrait du consentement                          | ⚠️ implicite              | mention « consentement » mais pas de phrase « vous pouvez retirer à tout moment » dédiée (P2-3) |
| 10  | Droit de réclamation auprès d'autorité contrôle        | ✅                        | `legal.ts:222`                                                                                  |
| 11  | Si traitement obligatoire / contractuel + conséquences | ⚠️ implicite              | non explicite (P2-4)                                                                            |
| 12  | Décision automatisée / profilage                       | ✅ (« pas de profilage ») | `legal.ts:210`                                                                                  |

- **P0-1** : ajouter section **« Destinataires / sous-traitants »** listant tous les sous-processeurs (cf. §8 ci-dessous). Sans cette liste → violation RGPD art. 13.1.e ET art. 28.3 (le responsable doit informer la personne concernée des sous-traitants).
- **P0-2** : la phrase `« Toutes les données sont hébergées dans l'UE (Hetzner Frankfurt). Aucun transfert hors UE sauf consentement explicite »` (`src/content/legal.ts:225-227, 266-267`) est **factuellement inexacte au vu de la stack** :
  - **Cloudflare** (proxy frontal + DNS + Turnstile captcha) — Cloudflare Inc. US, mais filiales EU + adhésion EU-US Data Privacy Framework. L'IP utilisateur transite par les PoPs Cloudflare (potentiellement non-UE selon routing).
  - **Cloudflare Turnstile** envoie `remoteip` à `https://challenges.cloudflare.com/turnstile/v0/siteverify` (`src/lib/turnstile.ts:42-47`).
  - **Telegram Bot API** (`https://api.telegram.org`, `src/lib/telegram.ts:11`) reçoit le **contenu des notifications** qui inclut souvent l'email du soumissionnaire (`src/features/contact/actions.ts:64`, `src/features/booking/actions.ts:130`, etc.). Telegram = serveurs hors UE.
  - **Backblaze B2** (backups Coolify, ADR 0009 ligne 78) — Backblaze Inc. US (US-CA). Si bucket US-West (default), les sauvegardes contenant la DB Postgres (avec PII clients) sortent de l'UE.
  - **Sentry** : self-hosted (ADR 0009 + `docs/ops/runbook-deploy.md:22`), donc OK **si** déployé Sprint 23. Si Sentry Cloud (sentry.io) est utilisé en transition, transfert US.

  → Soit ces transferts sont **acceptables avec disclosure correcte + base légale** (intérêt légitime + EU-US DPF pour Cloudflare/Backblaze, exception art. 49 pour Telegram), soit on les remplace (e.g. Backblaze → bucket Hetzner Storage Box ou région Backblaze EU `eu-central-003`). **Action minimale**: corriger le wording + lister.

- **P2-3** : ajouter phrase explicite « Vous pouvez retirer votre consentement à tout moment, sans frais ni préjudice » dans § Vos droits.
- **P2-4** : ajouter mention du caractère obligatoire ou facultatif des champs (l'email est obligatoire pour répondre, le téléphone optionnel — utile pour art. 13.2.e).

## 8. DPA / sous-traitants — Verdict : **NO-GO / P0**

**Aucun registre des sous-traitants** dans le repo. Aucune mention de DPA signés. Aucune liste publique des sous-processeurs.

**Sous-processeurs effectivement utilisés (déduits du code + ADR 0009)** :

| Sous-processeur          | Usage                                                                                | Localisation données                    | Mécanisme transfert                         | Disclosed code?                         | DPA signed?                                                    |
| ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| **Hetzner Online GmbH**  | VPS CPX32 hosting (DB Postgres + Redis + Next + Caddy + Sentry self-hosted)          | Frankfurt DE (UE)                       | UE intra-communautaire — pas de transfert   | ✅ mentions-legales                     | À signer (template Hetzner gratuit `hetzner.com/legal/gdpr`)   |
| **Cloudflare Inc.**      | DNS + CDN + WAF + Turnstile captcha                                                  | PoPs globaux (US/EU/global)             | EU-US Data Privacy Framework (DPF) certifié | ❌ non disclosed                        | À signer DPA gratuit `cloudflare.com/cloudflare-customer-dpa/` |
| **Telegram FZ-LLC**      | Notifications admin (tag `[CONTACT]`, `[NEWSLETTER]`, etc. avec emails utilisateurs) | Dubai/Tashkent/UK                       | Pas de DPA standard, pas de cadre BCR/CCT   | ❌ non disclosed                        | ⚠️ pas de DPA dispo. **Problème.**                             |
| **Backblaze Inc.**       | Backups B2 (Coolify auto)                                                            | US (default us-west) ou UE (eu-central) | DPA + SCC standard EU                       | ❌ non disclosed                        | À signer + forcer `eu-central-003` bucket                      |
| **PowerMTA (Bird)**      | Relai SMTP local (envoi emails) — local sur VPS                                      | Frankfurt DE (UE)                       | UE — pas de transfert (relai uniquement)    | ✅ implicite mentions-legales (Hetzner) | n/a (logiciel embedded)                                        |
| **MailWizz**             | (mémoire utilisateur) — gestion campagnes newsletter                                 | self-hosted Hetzner ?                   | UE si self-hosted                           | ❌ non disclosed                        | À confirmer (self-hosted ou SaaS ?)                            |
| **Plausible Analytics**  | Analytics web (self-hosted Sprint 23)                                                | Frankfurt DE (UE)                       | UE — pas de transfert                       | ✅ /cookies                             | n/a (self-hosted)                                              |
| **Sentry**               | Error tracking (self-hosted Sprint 23)                                               | Frankfurt DE (UE)                       | UE — pas de transfert                       | ❌ non disclosed                        | n/a (self-hosted)                                              |
| **Cabinet comptable EE** | Comptabilité OÜ                                                                      | Tallinn EE (UE)                         | UE — pas de transfert                       | ❌ non disclosed                        | À signer                                                       |
| **Banque (LHV/Wise)**    | Compte bancaire pro                                                                  | EE/EE+UK                                | Cadre bancaire SEPA                         | ❌ non disclosed                        | n/a                                                            |

- **P0-3** : créer la section « Destinataires et sous-traitants » dans `src/content/legal.ts` (politique-confidentialite) qui liste **au moins les 5 critiques** : Hetzner, Cloudflare, Telegram, Backblaze, MailWizz. Avec pour chacun : finalité + localisation + base légale du transfert (DPF/SCC/dérogation art. 49). Format suggéré : tableau ou liste structurée.
- **P0-4** : créer `_AUDIT/DPA-REGISTER.md` (interne, non publié) listant tous les DPA signés avec lien vers PDF Drive + date renouvellement. Avant prod, **signer DPA Hetzner + Cloudflare** (les deux templates standards sont gratuits). Pour Telegram (pas de DPA dispo), évaluer si on bascule vers **alertes Sentry → self-hosted Mattermost UE** ou si on garde Telegram avec une décision documentée d'intérêt légitime + minimisation (tronquer les emails à 4 caractères + domaine, ex `wj***@gmail.com`).

## 9. Cookies de fonctionnement (Auth.js JWT) — Verdict : **OK** (P2 sur durci config)

**Auth.js v5 JWT strategy** (`src/auth.config.ts:17-21`). Par défaut Auth.js v5 émet le cookie `authjs.session-token` (ou `__Secure-authjs.session-token` en prod HTTPS) avec :

- `HttpOnly: true`
- `Secure: true` (en prod HTTPS)
- `SameSite: lax`
- `Path: /`

**Pas de config explicite `cookies: {…}` dans `src/auth.config.ts`** → Auth.js applique les defaults sécurisés. C'est **acceptable mais à durcir**.

- **P2-5** : ajouter dans `src/auth.config.ts` un block `cookies` explicite :
  ```ts
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-authjs.session-token" : "authjs.session-token",
      options: { httpOnly: true, secure: true, sameSite: "strict", path: "/" }
    }
  }
  ```
  → `__Host-` prefix + `SameSite: strict` mitige tout vol via subdomain hijack et tout CSRF. Auth.js gère bien `__Host-` (testé).
- **P2-6** : la durée `maxAge: 30*24*60*60` (30 jours) est généreuse. Pour console admin contenant PII clients, recommandation OWASP ASVS 4.0 = ≤ 7 jours. À discuter avec Will (UX vs sécu).

## 10. Newsletter unsubscribe RFC 8058 — Verdict : **NO-GO / P0**

**Endpoint réception OK** (`src/app/api/unsubscribe/route.ts:1-77`) — supporte RFC 8058 One-Click POST + form POST + GET fallback. ✅

**Mais l'envoi des emails NE pose AUCUN header `List-Unsubscribe` / `List-Unsubscribe-Post`** :

- `src/lib/email/client.ts:64-75` : `sendEmail()` appelle `transporter.sendMail({from, to, subject, html, text, replyTo})` — **aucune option `headers`**.
- `src/server/queue/workers/email-worker.ts:21-27` : passe les mêmes 5 paramètres au transporter, jamais d'override headers.
- Grep `List-Unsubscribe` retourne **0 occurrence** dans `src/lib/email/`.
- Le footer du `_layout.tsx` (`src/lib/email/templates/_layout.tsx:152-159`) inclut bien un lien `unsubscribeHref`, mais c'est uniquement le **lien cliquable HTML**, pas le header SMTP.

**Conséquence** :

- Gmail / Outlook / Apple Mail / Yahoo n'afficheront **pas** le bouton « Désabonner » natif au-dessus de l'email.
- Risque de classement spam élevé pour newsletter Axion-IA dès le premier envoi de masse.
- **Non-conformité RFC 8058 + non-conformité aux nouvelles règles Gmail/Yahoo « Sender Requirements 2024 »** (qui exigent List-Unsubscribe-Post pour tout sender > 5000 emails/jour).

- **P0-5** : patch obligatoire dans `src/lib/email/client.ts` :

  ```ts
  export interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    marketing?: boolean;
    replyTo?: string;
    /** RFC 8058. URL absolue avec token, ex: https://axion-ia.com/api/unsubscribe?token=abc */
    unsubscribeUrl?: string;
  }

  export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
    const headers: Record<string, string> = {};
    if (params.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${params.unsubscribeUrl}>, <mailto:unsubscribe@axion-ia.com?subject=unsubscribe>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const t = getTransport();
    const info = await t.sendMail({ from, to, subject, html, text, replyTo, headers });
    ...
  }
  ```

  Et propager `unsubscribeUrl` depuis l'email-worker (`src/server/queue/workers/email-worker.ts`) vers `sendEmail()` quand `marketing === true` ou quand le payload contient `unsubscribeToken`.

- **P0-5b** (corollaire) : ajouter `Precedence: bulk` header pour les emails marketing (signal anti-bounce loop selon RFC 3834).

## 11. Logs & rétention — Verdict : **PARTIEL / P1**

**Politique de confidentialité annonce** (`src/content/legal.ts:217-219`) :

- Données clients : 5 ans après fin de prestation (obligation comptable estonienne) ✅ aligné droit estonien
- Demandes commerciales : 3 ans
- Logs techniques : 12 mois maximum

**Réalité du code** : aucune cron purge implémentée :

- `src/server/queue/queues.ts:77-101` (`bootRepeatableJobs`) lance 2 crons : `option-expiration` (5min) + `option-reminder` (1h). **Aucun cron `retention` ni `gdpr-purge`**.
- `prisma/schema.prisma` n'a pas de TTL Postgres (extension `pg_cron` non setup).
- Aucun script `scripts/retention-purge.{ts,sh}` (verified `ls scripts/` + grep).

**Conséquence** : la phrase « Logs techniques : 12 mois maximum » est un engagement écrit qui **n'est tenu par aucun mécanisme**. Si le DPO n'agit pas manuellement après 12 mois, on garde 18-36 mois de logs PII (IPs hashées dans `submissions.ipAddress`, `activity_logs.ipAddress`).

- **P1-8** : ajouter cron BullMQ `retention-purge-cron` (pattern: `0 4 * * 0` = dimanche 04:00) qui :
  ```sql
  DELETE FROM activity_logs WHERE created_at < now() - interval '12 months';
  DELETE FROM submissions WHERE submitted_at < now() - interval '3 years' AND status IN ('archived','processed');
  -- Submissions liées à des bookings facturés : 5 ans (joint sur bookings)
  UPDATE submissions SET ip_address=NULL, user_agent=NULL WHERE submitted_at < now() - interval '12 months';
  ```
  Avec `activity_logs.action='gdpr.retention_purge'` log d'audit.
- **P1-9** : ajouter `data/retention-policy.md` documentant les durées + validation DPO + lien vers le cron BullMQ + alerte Telegram tag `[GDPR]` à chaque exécution avec compteurs de lignes purgées.

## 12. CCPA / autres juridictions (US/UK) — Verdict : **N/A V1** (P3)

Audit cabinet **B2B premium UE** ciblant FR/BE/LU/CH (politique de déplacement `src/content/legal.ts:434`). Audience US/UK marginale. CCPA (Californie) ne s'applique qu'aux entreprises >$25M revenue ou >100k résidents CA.

- **P3-4** : ajouter respect du **Global Privacy Control (GPC) signal** côté Plausible (qui le respecte natively, c'est OK) et côté tracking custom (aucun custom tracking actuel — OK). Ajouter une mention bilingue dans `/cookies` : « We honor the Global Privacy Control browser signal » — bonne pratique 2026 même hors juridiction CCPA.
- **P3-5** : pas de mention `Do Not Track` (DNT). Plausible ne respecte plus DNT (deprecated par Apple/Mozilla 2019). Pas d'action.

---

## Annexe A — Inventaire P0/P1/P2/P3

### P0 (3) — Bloque la prod publique

| ID       | Description                                                                                       | Fichier(s)                                                                                                               | Effort      |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **P0-1** | Lister destinataires/sous-processeurs dans politique de confidentialité (RGPD art. 13.1.e + 28)   | `src/content/legal.ts:225-227` (insérer nouvelle section « Destinataires »)                                              | 30 min copy |
| **P0-2** | Corriger claim « Aucun transfert hors UE » qui contredit Cloudflare/Telegram/Backblaze            | `src/content/legal.ts:225-227, 266-267`                                                                                  | 30 min copy |
| **P0-3** | Créer `_AUDIT/DPA-REGISTER.md` + signer DPA Hetzner + Cloudflare                                  | nouveau fichier + actions externes                                                                                       | 2 h         |
| **P0-4** | Décision Telegram : minimisation PII (tronquer emails) ou switch Mattermost                       | `src/lib/telegram.ts` + `src/features/{contact,booking,audit,implementation,newsletter}/actions.ts` (5 call-sites)       | 1 h         |
| **P0-5** | Implémenter SMTP `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers | `src/lib/email/client.ts:54-75`, `src/server/queue/workers/email-worker.ts:18-27`, `src/lib/email/templates/_layout.tsx` | 1 h         |

### P1 (9) — À fixer Sprint 24

| ID   | Description                                                                                       | Fichier                                                                    |
| ---- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P1-1 | Server Action `eraseSubmissionAction` (anonymisation tombstone, conservation comptable)           | `src/features/admin-submissions/actions.ts` (nouveau export)               |
| P1-2 | Server Action `eraseSubscriberAction` (delete hard newsletter)                                    | `src/features/admin-newsletter/actions.ts` (nouveau export)                |
| P1-3 | UI admin `/admin/rgpd` (workflow demandes RGPD)                                                   | `src/app/[locale]/(admin)/admin-dev-x7k2n9/rgpd/page.tsx` (nouveau)        |
| P1-4 | Endpoint `/api/gdpr-export?token=...` JSON portabilité auto-service                               | `src/app/api/gdpr-export/route.ts` (nouveau)                               |
| P1-5 | Lien direct « Demander mes données » dans `/mes-donnees`                                          | `src/app/[locale]/mes-donnees/page.tsx`                                    |
| P1-6 | Afficher `registrikood` dès réception (env `COMPANY_REGISTRATION_NUMBER`)                         | `src/content/legal.ts:44, 77` + `src/env.ts` + déployé                     |
| P1-7 | Afficher `EU VAT` dès réception (env `COMPANY_VAT_ID`)                                            | idem                                                                       |
| P1-8 | Cron BullMQ `retention-purge-cron` (12 mois activity_logs, 3 ans submissions, anonym 12 mois IPs) | `src/server/queue/queues.ts:77-101` + nouveau worker `retention-worker.ts` |
| P1-9 | `data/retention-policy.md` + alertes Telegram `[GDPR]`                                            | nouveau fichier docs                                                       |

### P2 (6) — Polish, non-bloquant

| ID   | Description                                                                      | Fichier                                       |
| ---- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| P2-1 | Tracer `consentVersion` + `consentText` dans `Submission`/`NewsletterSubscriber` | `prisma/schema.prisma:154-, 671-` + migration |
| P2-2 | Ajouter section DPO dans `/mentions-legales`                                     | `src/content/legal.ts:36-67`                  |
| P2-3 | Phrase explicite « Vous pouvez retirer votre consentement à tout moment »        | `src/content/legal.ts:221-223`                |
| P2-4 | Mention obligatoire/facultatif des champs                                        | `src/content/legal.ts` § Données collectées   |
| P2-5 | Durcir cookies Auth.js : `__Host-` prefix + `SameSite: strict`                   | `src/auth.config.ts:12-79`                    |
| P2-6 | Réduire `session.maxAge` de 30 à 7 jours pour console admin                      | `src/auth.config.ts:19`                       |

### P3 (4) — Future / nice-to-have

| ID   | Description                                                      | Fichier                                               |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| P3-1 | Corriger phrasing « si vous activez Plausible » (déjà actif M11) | `src/app/[locale]/preferences-cookies/page.tsx:67-73` |
| P3-2 | Clause médiation conventionnelle B2C                             | `src/content/legal.ts` § conditions-generales         |
| P3-3 | Clause rétractation 14 jours (B2B mais protective)               | idem                                                  |
| P3-4 | Mention GPC honor + DNT future-proofing                          | `src/content/legal.ts` § cookies                      |

---

## Annexe B — Verdict par chapitre

| #         | Chapitre                            | Verdict         | P0    | P1    | P2    | P3    |
| --------- | ----------------------------------- | --------------- | ----- | ----- | ----- | ----- |
| 1         | Bandeau cookies                     | **OK**          | 0     | 0     | 0     | 1     |
| 2         | Consentement marketing              | **OK**          | 0     | 0     | 1     | 0     |
| 3         | Droit à l'effacement                | **PARTIEL**     | 0     | 3     | 0     | 0     |
| 4         | Droit à la portabilité              | **PARTIEL**     | 0     | 2     | 0     | 0     |
| 5         | Mentions légales                    | **OK** réserves | 0     | 2     | 1     | 0     |
| 6         | CGU/CGV                             | **OK**          | 0     | 0     | 0     | 2     |
| 7         | Politique de confidentialité        | **PARTIEL**     | 2     | 0     | 2     | 0     |
| 8         | DPA / sous-traitants                | **NO-GO**       | 2     | 0     | 0     | 0     |
| 9         | Cookies de fonctionnement (Auth.js) | **OK**          | 0     | 0     | 2     | 0     |
| 10        | Newsletter unsubscribe RFC 8058     | **NO-GO**       | 1     | 0     | 0     | 0     |
| 11        | Logs & rétention                    | **PARTIEL**     | 0     | 2     | 0     | 0     |
| 12        | CCPA / autres juridictions          | **N/A V1**      | 0     | 0     | 0     | 1     |
| **TOTAL** |                                     |                 | **3** | **9** | **6** | **4** |

(Le total P0 = 3 issues uniques exprimées en 5 lignes de fix dans le tableau Annexe A — P0-1+P0-2 portent le même fix copy, P0-3+P0-4 portent le fix DPA/sous-traitants, P0-5 porte RFC 8058. Pour clarté DPO, on regroupe en 3 P0 « catégoriels » : DOC LÉGALE / DPA REGISTRE / RFC 8058.)

---

## Annexe C — Checklist pre-prod RGPD signée DPO

À cocher **physiquement** par le DPO d'Axion-IA OÜ avant publication de production. Aucune case ne peut être pré-cochée par un développeur.

```
[ ] 1. La politique de confidentialité (/politique-confidentialite + /privacy-policy)
       liste explicitement Hetzner, Cloudflare, Telegram, Backblaze (ou alternative)
       et MailWizz comme sous-traitants, avec leur localisation et le mécanisme
       de transfert (DPF / SCC / dérogation art. 49). [P0-1, P0-2]

[ ] 2. Un DPA est signé et archivé (PDF) avec Hetzner Online GmbH, Cloudflare Inc.
       et Backblaze Inc. (ou Backblaze switché bucket eu-central-003 + DPA EU).
       Telegram tranché : minimisation PII OU remplacement Mattermost UE.
       Registre interne `_AUDIT/DPA-REGISTER.md` à jour. [P0-3, P0-4]

[ ] 3. Les emails newsletter portent les headers SMTP `List-Unsubscribe`
       (URL HTTPS + mailto) et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
       Test smoke : send → Mailhog → vérifier headers présents → Gmail teste
       que le bouton natif "Désabonner" apparaît au-dessus du sujet. [P0-5]

[ ] 4. Le `registrikood` Axion-IA OÜ et le numéro EU VAT EE sont affichés en clair
       dans /mentions-legales (pas "communiqués sur demande"). [P1-6, P1-7]

[ ] 5. Procédure RGPD documentée : un cron BullMQ purge automatiquement
       activity_logs > 12 mois, anonymise les IPs des submissions > 12 mois,
       et delete les submissions archivées > 3 ans (sauf bookings facturés < 5 ans).
       Première exécution validée en staging avec dump avant/après. [P1-8, P1-9]

[ ] 6. Une procédure RGPD admin permet de répondre à une demande d'effacement
       (art. 17) ET de portabilité (art. 20) via interface admin /rgpd ou
       endpoint signé /api/gdpr-export. Documenté en runbook DPO. [P1-1..P1-5]

[ ] 7. Les cookies admin (Auth.js JWT) sont durcis : préfixe __Host- en prod,
       SameSite=strict, HttpOnly, Secure. maxAge ≤ 7 jours pour console admin
       contenant PII clients. [P2-5, P2-6]

[ ] 8. La boîte mail dpo@axion-ia.com est provisionnée, redirigée vers Will
       (ou avocat partenaire), et un SLA de réponse < 30 jours est documenté
       dans le runbook DPO. Gabarit de réponse RGPD prêt en FR + EN.

[ ] 9. Le formulaire d'opposition / réclamation auprès de l'AKI (Estonian DPA,
       www.aki.ee) est documenté en interne, ainsi que la procédure de
       signalement de violation de données (RGPD art. 33 — 72h DPA).

[ ] 10. Le sitemap.ts publie /mentions-legales, /politique-confidentialite,
        /conditions-generales, /cookies, /rgpd, /politique-deplacement,
        /mes-donnees, /preferences-cookies, /desabonnement (en FR ET en EN).
        Lighthouse SEO ≥ 95. Toutes les pages chargent <1.5 s LCP.
```

---

## Annexe D — Décisions DPO à arbitrer avant publication

1. **Telegram** : on garde avec minimisation PII (tronquer email à 4 chars + domaine) OU on bascule vers Mattermost UE self-hosted ? → impact 5 call-sites + nouveau service docker-compose.
2. **Backblaze B2** : on force `eu-central-003` bucket (3,5x plus cher mais UE) OU on switch vers Hetzner Storage Box (€3/mois 1 TB UE) ?
3. **Sentry** : effectivement self-hosté en prod ? Si Sentry Cloud transitoire → disclosure dans politique.
4. **MailWizz** : self-hosted Hetzner ou SaaS ? Si SaaS → DPA + transfer mechanism à clarifier.
5. **Durée session admin** : 30 jours (UX) ou 7 jours (sécu OWASP) ?

---

## Annexe E — Citations doctrine

- RGPD : Règlement (UE) 2016/679 du 27 avril 2016
- RFC 8058 : "Signaling One-Click Functionality for List Email Headers" (Feb 2017)
- AKI : Andmekaitse Inspektsioon (Estonian Data Protection Inspectorate), www.aki.ee
- CNIL guidance Plausible 2022 : « Solutions analytics non concernées par l'exigence de consentement »
- Gmail/Yahoo Sender Requirements (oct 2024) : List-Unsubscribe-Post requis pour > 5000 emails/jour
- EU-US Data Privacy Framework (DPF) : adéquation 10 juillet 2023, Cloudflare/Backblaze certifiés
- Estonia Accounting Act § 12 : durée de conservation pièces comptables = 7 ans (notre claim 5 ans dans la politique est conservateur — OK)

---

**Fin du rapport AGT-RGPD-LEGAL.**
