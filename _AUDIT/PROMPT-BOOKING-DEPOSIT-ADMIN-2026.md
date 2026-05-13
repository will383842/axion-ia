# PROMPT — AUDIT BOOKING DEPOSIT-GATED + ADMIN CONSOLE 2026 — V3 COMPLET

> # 🚫🚫🚫 AUDIT-ONLY — ZÉRO BUILD — ZÉRO LIGNE DE CODE 🚫🚫🚫
>
> **Ce prompt déclenche un AUDIT pur. Tu n'écris RIEN d'autre que des fichiers `.md` dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`.**
>
> - ❌ AUCUN code applicatif modifié, ajouté, supprimé.
> - ❌ AUCUNE migration Prisma écrite ou appliquée.
> - ❌ AUCUN `pnpm add`, `pnpm install`, `pnpm remove`, `pnpm update`.
> - ❌ AUCUN nouveau fichier `.ts`, `.tsx`, `.js`, `.sql`, `.env`, `.yaml`, `.json` (sauf fichiers `.md` dans le dossier de sortie).
> - ❌ AUCUN `git add`, `git commit`, `git push`, `git tag`, `git stash`.
> - ❌ AUCUN appel POST à Stripe, Coolify, Cloudflare, Hetzner, Sentry, Telegram, Resend, Yousign.
> - ❌ AUCUN appel POST aux Server Actions du projet.
> - ❌ AUCUN `pnpm dev`, `pnpm build` brut, `pnpm db:*`, `prisma migrate *`.
>
> **Le seul output autorisé** : des fichiers Markdown dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`.
>
> Le plan d'exécution est **décrit sur papier** uniquement. L'implémentation se fait plus tard, dans des sprints séparés, déclenchés par Will sur des prompts distincts. **Si tu es tenté de fixer un truc « petit » pendant l'audit : non.** Tu le notes comme P0/P1 et tu continues.

---

**Cible** : Axion-IA (`https://axion-ia.com`) — _cabinet IA opérationnel B2B premium_
**Date prompt** : 2026-05-12 (V3 — Qualiopi/OPCO hors V1, structure juridique FR vs EE non tranchée)
**Statut prod** : V2.1 LIVE Hetzner CPX32 + Cloudflare Free + Coolify (auto-deploy GitHub Actions)
**Référence code** : `HEAD` de `main` (origin), worktree `Axion-IA/axionia/`
**Mode** : **AUDIT-ONLY + AUTO-PILOT 1-GATE — strictement lecture, AUCUNE écriture hors `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`**
**Profondeur** : _extrême_ — chaque route, chaque action serveur, chaque transition d'état, chaque écran admin, chaque email, chaque obligation légale
**Output racine** : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/` (créer si absent)

---

## 0. CONTRAT D'EXÉCUTION

Tu es **l'auditeur senior produit + tech + UX + juridique** mandaté par le fondateur (Will, `williamsjullin@gmail.com`). Mission : auditer de bout en bout le **système de réservation** (calendrier client, option 48h, call de cadrage, devis/NDA, booking ferme, paiement acompte, exécution, facture solde, calendrier admin, arbitrage admin, conformité légale) et proposer une **cible perfection extrême**.

### 0.0 Critères de perfection (la cible V1)

1. **Réservation ferme uniquement après acompte payé** (gating absolu, jamais d'exception).
2. **Call de cadrage avant acompte** (cohérence avec `interventions.ts:220` qui décrit 5 étapes : réserve → cadrage → acompte → journée → solde).
3. **Devis + NDA + signature électronique** déclenchés automatiquement sur seuils (montant + taille société).
4. **Conformité légale V1 saine** : CGV à jour, mentions légales correctes, RGPD complet, sous-processeurs déclarés, numérotation factures séquentielle immuable, archivage long terme. _Qualiopi/OPCO/e-invoicing PDP/régime TVA détaillé = V2+, hors scope V1._
5. **Arbitrage 100 % depuis la console admin** : aucune action critique n'exige `psql` ou édition manuelle DB.
6. **Automatisation maximale** : ~15 jobs/crons (relances acompte, expiration option, J-7 facture solde, J-1 reminder, J+1 debrief, balance overdue, refund, webhook DLQ, etc.).
7. **UX visiteur parfaite** : zéro friction inutile, état de la réservation toujours clair, lien magique self-service pour annuler/reschedule, Customer Portal Stripe pour factures/paiements.
8. **UX admin parfaite** : navigation organisée, dashboard KPIs et alertes, drawer détail riche, bulk operations, raccourcis clavier, mobile-responsive (Will gère en déplacement).
9. **Capacité Will respectée** : saturation hebdo/mensuelle visible, géo-awareness trajets pour audit flash on-site.
10. **Bout-en-bout cohérent** : `/audit`, `/interventions`, `/implementation`, `/contact` mènent vers le bon flow avec préfill et tracking.

### 0.0bis Périmètre temporel — V1 vs V2+

L'audit produit une **cible V1** (déposit-gated minimal complet, lançable post-sprints) et **identifie les hooks d'extension V2+** sans les implémenter ni les détailler.

**Dans le scope V1** :

- State machine deposit-gated avec cadrage + devis + NDA + signature électronique.
- Stripe Checkout + webhook + Customer Portal.
- Admin console réorganisée + calendrier v2 + factures basiques.
- 15 crons/workers, 18 templates emails.
- CGV/mentions légales à jour, sous-processeurs Stripe + Yousign + autres déclarés, RGPD complet.
- Numérotation factures séquentielle immuable, archivage long terme (durée à confirmer après décision structure juridique).
- PDF facture branding propre.

**Hors scope V1 — listé comme V2+, hooks d'extension uniquement** :

- **Qualiopi** : Will V1 n'est pas certifié. L'audit prévoit que les tables Booking/Invoice puissent recevoir des champs `trainingSessionId` plus tard, mais **ne crée pas** de spec TrainingSession/Attendance/Evaluation/Certificate. Pas de convention de formation, pas d'émargement, pas d'évaluation chaud/froid V1.
- **OPCO** : idem Qualiopi. Pas de workflow facture OPCO 60-90j, pas de tables/states dédiés. Hook futur : un champ `payerType` (`client` par défaut V1, `opco`/`autre` plus tard) dans `Invoice` peut être anticipé _sans l'implémenter_.
- **Régime fiscal détaillé** : la structure juridique (FR société classique vs OÜ estonienne vs autre) **n'est pas tranchée**. L'audit doit donc :
  - **Ne PAS présupposer** OÜ + reverse charge.
  - **Ne PAS présupposer** entité FR + TVA française.
  - Proposer une **architecture TVA-agnostique** : champ `vatRate` configurable, `vatReverseCharge` boolean, mention TVA paramétrable via `pricing.ts` ou `legal.ts`.
  - **Lister en annexe** les 2 scénarios (FR vs EE) avec leurs implications, sans recommander l'un ou l'autre — c'est une décision Will hors audit.
  - Mentions de facture obligatoires : audit liste les champs (numéro VAT émetteur, numéro VAT destinataire, mention TVA, etc.) en restant agnostique sur la juridiction.
- **E-invoicing France PPF/PDP** (loi PACTE 2026-2027) : **hors V1**. À mentionner brièvement dans l'agent conformité comme « à revisiter selon décision juridique » mais pas de sprint dédié, pas de spec Factur-X, pas de PDP candidat à benchmarker en profondeur.
- **VIES API** (validation VAT B2B intra-UE) : hors V1 — à revisiter après décision juridique.
- **OSS B2C** : hors V1 — Axion-IA est B2B uniquement.
- **Multi-currency** : EUR uniquement V1. GBP/USD = hook V2+ (le champ `currency` existe en DB mais seul `EUR` est exposé en UI).

L'audit doit **clairement marquer V1 vs V2+** dans chaque livrable. Les sprints V2+ apparaissent dans `04-PLAN-EXECUTION.md` mais étiquetés `P3 — REPORTÉ V2+`.

### 0.1 Doctrine non négociable (intouchables)

- **Naming** : _Axion-IA_ partout (FR + EN), _cabinet IA opérationnel_ (FR) / _operational AI consultancy_ (EN). **Jamais** : agence, studio, atelier, freelance, _AI agency_ (sauf en référence aux concurrents).
- **Couleurs** : Header terracotta figé, logo blanc `m_horizontal_white_2.png`. Anti-hex : aucune couleur hardcodée hors `globals.css` / tokens.
- **Typo** : `titleEm` serif italique, hero cap **88px** (ADR 0007), modular scale 2026.
- **Hero schema** : carré **576×576** lg+ (`.hero-schema`), viewBox SVG **560×560**.
- **Tarifs** : SSOT **`src/content/pricing.ts`**. Aucun montant hardcodé hors ce fichier. Phrases interdites : « pas de plan sur-mesure », « ½ journée », « basé en UE », sizes hors INSEE.
- **Code = SSOT** : si divergence code-vs-docs/copy, le **code fait foi**, sauf dérive non décidée (à flagger comme P0).
- **Telegram** : passer par `redactContactLine()` / helpers `pii-redaction.ts` — jamais email/téléphone en clair.
- **RGPD** : aucune donnée personnelle ne sort de l'UE sans DPA documenté. Stripe = sous-processeur à inscrire si absent.

### 0.2 Anti-hallucination (durci)

- Interdiction d'inventer un fichier, route, endpoint, table, colonne, action, sprint, métrique, obligation légale, seuil réglementaire.
- Toute affirmation est **citée** : `path/file.ext:LINE` ou `commit <sha>` ou URL officielle (legifrance.gouv.fr, impots.gouv.fr, service-public.fr, eur-lex.europa.eu, stripe.com/docs) ou `cmd <commande>` (avec sortie).
- Toute affirmation prod provient d'une réponse HTTP réelle (`curl -sI`) ou d'un log file. Sinon : `[NON VÉRIFIÉ EN PROD]`.
- Si tu ne sais pas : `[INCONNU — raison]`. Jamais combler par supposition.
- **Pass B obligatoire** : chaque P0/P1 doit être confirmé par ≥ 2 sources indépendantes (2 agents OU 1 agent + 1 grep code OU 1 agent + 1 doc officielle citée). Sinon dégradé d'un cran.
- **Sources légales** : citer URL officielle. Pas Wikipédia. Pas blog SEO. Sources acceptées : legifrance.gouv.fr, impots.gouv.fr, service-public.fr, eur-lex.europa.eu, stripe.com/docs, yousign.com/docs.

### 0.3 Mode AUTO-PILOT 1-GATE

**Décision Will 2026-05-12** : exécution automatique de bout en bout, **un seul gate final**.

- Phases 0 → 6 enchaînées **sans pause**.
- Décisions par défaut documentées en § 0.6 (aucune ne nécessite Will à ce stade).
- Phase 7 : verdict calculé.
  - 🟢 / 🟡 → finaliser audit, écrire `WHAT-TO-DO-NOW.md`, terminer.
  - 🔴 → STOP unique : écrire `🚨-NO-GO-ALERT.md` et attendre Will.
- Crash agent : marquer `FAILED` dans `MANIFEST.md`, continuer, rejouer une fois max.

### 0.4 Périmètre (code lu, exhaustif, lecture seule)

- `prisma/schema.prisma` — modèles `Booking`, `CalendarSlot`, `BookingOption`, `Submission`, `User`, `ActivityLog`, tous les enums.
- `src/features/booking/actions.ts`, `src/features/audit/actions.ts`, `src/features/implementation/actions.ts`, `src/features/contact/actions.ts`, `src/features/newsletter/actions.ts`.
- `src/features/admin-{calendar,submissions,options,users,activity-logs,settings,alerts,newsletter,blog,case-studies,faq,help,testimonials,categories,auth}/actions.ts`.
- `src/app/[locale]/reserver/page.tsx` + `src/components/calendar/BookingCalendar.tsx` (intégralement).
- `src/app/[locale]/(admin)/[adminPrefix]/**/*` (chaque section).
- `src/server/queue/**` (queues, workers, types).
- `src/lib/{prisma,rate-limit,turnstile,telegram,pii-redaction,client-ip,intervention-type,admin-path,auth*,schemas}.ts`.
- `src/content/{pricing,interventions,interventions-taxonomy,legal}.ts`.
- `src/emails/**` — tous templates.
- `src/app/api/**` — toutes les routes.
- `auth.ts`, `auth.config.ts`, `middleware.ts` (si existe), `next.config.ts`.
- Pages légales (`mentions-legales`, `conditions-generales`, `politique-confidentialite`, `cookies`, `sous-processeurs`, `rgpd`).

**Production live (curl GET uniquement)** :

- `curl -sI https://axion-ia.com/fr/reserver`
- `curl -s https://axion-ia.com/api/healthz`
- `curl -sI https://axion-ia.com/sitemap.xml`
- Aucun POST, aucun login en prod.

### 0.5 Garde-fous robustesse (durcis V3)

**Rappel du bandeau en tête** — interdits absolus :

- ❌ Modifier le code applicatif, configs, `.env`, `.github/workflows/`, `prisma/migrations/`, `tests/`.
- ❌ Créer de nouveaux fichiers `.ts`, `.tsx`, `.sql`, `.yaml`, `.json` (hors `.md` dans le dossier de sortie).
- ❌ `git commit`, `git push`, `git tag`, `git stash`, `git clean`, `git reset`, `git rebase`, `git checkout -b`.
- ❌ `pnpm add`, `pnpm install`, `pnpm remove`, `pnpm update`, `npm install`, `npx <quoi que ce soit qui mute>`.
- ❌ Modifier état distant Cloudflare/Coolify/Hetzner/Stripe/Resend/Yousign.
- ❌ Recopier secrets en clair (DSN Sentry, AUTH_SECRET, tokens API, mots de passe, clés Stripe).
- ❌ `pnpm dev` (bug prerender-manifest 500 Windows documenté).
- ❌ Lancer Lighthouse en prod.
- ❌ POST `/api/admin/*`, POST Server Actions, POST `/api/gdpr-export/request`.
- ❌ Toucher à la DB (SELECT en lecture OK si docker-compose Postgres local dispo, sinon `[NON MESURÉ]`).

**Scripts à NE JAMAIS lancer** : `pnpm build` brut, `pnpm villes:import`, `pnpm db:*`, `pnpm prisma:migrate`, `scripts/indexnow-ping.ts`, `scripts/test-email-e2e.ts`, `scripts/deploy-prod.sh`, `scripts/generate-prod-secrets.sh`, `scripts/backup-postgres.sh`, `scripts/restore-postgres-test.sh`.

**Autorisé** (lecture/typecheck uniquement) :

```bash
pnpm typecheck         # OK — lecture seule
pnpm test:unit         # OK — pas de write DB
pnpm lint              # OK
prisma generate        # OK — non destructif
```

**Si tentation de fixer un truc « petit »** : NON. Tu notes comme P0/P1/P2 dans le bon livrable et tu continues.

### 0.6 Décisions par défaut (Will n'a pas besoin de valider en phase audit)

| #   | Décision                        | Valeur par défaut                                                                                                                                                                                                                                                                                         | Justification                                                |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| D1  | % acompte                       | **30 %** par défaut, configurable par `InterventionType` via `pricing.ts`                                                                                                                                                                                                                                 | Standard B2B France ; les 50 % en copy actuelle à challenger |
| D2  | Délai paiement acompte          | **48h** (aligné option48h existante)                                                                                                                                                                                                                                                                      | Cohérence verrou pessimiste                                  |
| D3  | Mode paiement acompte           | **Stripe Checkout** (hosted, pas Elements)                                                                                                                                                                                                                                                                | PCI SAQ A, 3DS2 natif, refund API mature                     |
| D4  | Mode paiement solde             | **Stripe Payment Link** + **virement** (gros tickets)                                                                                                                                                                                                                                                     | Flexibilité B2B                                              |
| D5  | Acompte remboursable ?          | **Non-remboursable sauf force majeure Will**                                                                                                                                                                                                                                                              | Standard B2B, à formaliser dans CGV                          |
| D6  | Annulation client J-15+         | Refund 50 % de l'acompte                                                                                                                                                                                                                                                                                  | Politique à formaliser CGV                                   |
| D7  | Annulation client < J-15        | Acompte conservé                                                                                                                                                                                                                                                                                          | Politique à formaliser CGV                                   |
| D8  | Annulation Will (force majeure) | Refund total + reschedule prioritaire                                                                                                                                                                                                                                                                     | Politique à formaliser CGV                                   |
| D9  | Call de cadrage                 | **Obligatoire pour tout `InterventionType` ≠ `audit_flash_onsite`**                                                                                                                                                                                                                                       | Cohérent avec `interventions.ts:220`                         |
| D10 | Durée cadrage                   | **30 min en visio** (outil à recommander)                                                                                                                                                                                                                                                                 | Standard cabinet B2B                                         |
| D11 | Devis signé requis              | Au-dessus de **5 000 € HT**                                                                                                                                                                                                                                                                               | Standard B2B grands comptes                                  |
| D12 | NDA signé requis                | Société taille **ETI ou grande-entreprise** (INSEE) OU secteur sensible (finance/santé/défense)                                                                                                                                                                                                           | Pratique grands comptes                                      |
| D13 | Signature électronique          | **Yousign** (FR, eIDAS-conforme)                                                                                                                                                                                                                                                                          | Souveraineté FR, moins cher que DocuSign                     |
| D14 | E-invoicing FR PPF/PDP          | **HORS V1** — à revisiter selon décision structure juridique (FR vs EE). Mentionner dans annexe conformité, ne pas scoper sprint dédié                                                                                                                                                                    | Décision structure juridique pendante                        |
| D15 | Régime TVA                      | **TVA-agnostique en V1** : champ `vatRate` configurable + `vatReverseCharge` boolean. Audit liste les 2 scénarios FR/EE en annexe sans recommander                                                                                                                                                        | Structure juridique non tranchée                             |
| D16 | Qualiopi / OPCO                 | **HORS V1** — Will V1 = non certifié. Hooks d'extension prévus (champ `payerType` futur dans `Invoice`, champ `trainingSessionId` futur dans `Booking`) **sans implémentation V1**                                                                                                                        | Will explicite 2026-05-12                                    |
| D17 | États booking cible V1          | `draft → option_pending → cadrage_scheduled → cadrage_held → quote_sent → quote_signed → nda_pending → nda_signed → deposit_pending → confirmed → reminded_j7 → in_progress → completed → invoiced_balance → paid_balance → archived` (+ branches expired/cancelled*\*/refunded*\*/no_show/force_majeure) | State machine V1 complète                                    |
| D18 | Customer Portal Stripe          | **Activé** par défaut (gratuit, gain UX énorme)                                                                                                                                                                                                                                                           | Self-service factures + carte                                |
| D19 | Reschedule self-service client  | **Oui, ≥ J-7**, via lien magique signé dans email                                                                                                                                                                                                                                                         | Réduit charge admin Will                                     |
| D20 | Annulation self-service client  | **Oui**, lien magique signé, applique politique D6/D7 auto                                                                                                                                                                                                                                                | Réduit charge admin Will                                     |
| D21 | Time zone                       | UTC stocké, **Europe/Paris** affichage par défaut, locale-aware côté client                                                                                                                                                                                                                               | Standard                                                     |
| D22 | Multi-currency                  | **EUR uniquement V1**, GBP/USD V2+                                                                                                                                                                                                                                                                        | Simplicité MVP                                               |
| D23 | Capacité Will                   | **1 intervention/jour max**, **3/semaine max**, **8/mois max** (à valider)                                                                                                                                                                                                                                | Solo cabinet, charge mentale                                 |
| D24 | Géo-awareness audit on-site     | **Buffer trajet auto** : Paris/IDF = 0h, France métro = 0,5j, DOM-TOM/EU = 1j                                                                                                                                                                                                                             | Réaliste                                                     |
| D25 | Jours fériés FR                 | Import auto via lib `date-holidays` ou API gouv                                                                                                                                                                                                                                                           | Évite oublis                                                 |
| D26 | Substitution participant        | **Autorisée jusqu'à J-1** sans coût                                                                                                                                                                                                                                                                       | UX standard                                                  |
| D27 | Multi-participant emails        | Tous les participants reçoivent J-1 reminder                                                                                                                                                                                                                                                              | Pro                                                          |
| D28 | Onboarding docs post-acompte    | File request signé (R2 ou Hetzner Storage Box, signed URL 7j)                                                                                                                                                                                                                                             | Sécurité + simplicité                                        |
| D29 | Numérotation factures           | Format `AXION-2026-NNNN` séquentiel immuable, lock advisory Postgres                                                                                                                                                                                                                                      | Compliance minimum                                           |
| D30 | Archivage factures              | **10 ans** par défaut (durée à reconfirmer selon décision juridique)                                                                                                                                                                                                                                      | Minimum prudent                                              |
| D31 | PDF moteur                      | **react-pdf** ou **@react-email/render** + Puppeteer — à trancher Phase 4                                                                                                                                                                                                                                 | Souveraineté + branding                                      |
| D32 | Réconciliation comptable        | **Export CSV mensuel** V1, intégration comptable V2+                                                                                                                                                                                                                                                      | Pragmatique                                                  |

Toute déviation par rapport à ces défauts → flagger comme `DECISION-WILL-NEEDED` dans `STOP-AND-ASK.md`.

### 0.7 Outils & MCP

- `Grep`, `Glob`, `Read`, `Bash` (lecture seule), `WebFetch` (URL publiques officielles uniquement).
- Pas de `WebSearch` agressif — préférer la doc officielle.
- Pas d'appel API tier (Cloudflare/Coolify/Hetzner/Sentry/Stripe/Resend/Yousign) en phase audit.

---

## 1. PHASE 0 — REALITY CHECK (avant tout)

Doctrine **code = SSOT** : avant d'auditer quoi que ce soit, on **mesure l'existant**.

Livrable : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md`

### 1.1 Inventaire DB

- Liste exhaustive des modèles touchés (schema.prisma) : colonnes, types, contraintes, relations, soft-delete.
- Liste exhaustive des enums.
- Migrations Prisma touchant booking/calendar/payment.
- Présence/absence : `Payment`, `Invoice`, `Refund`, `Webhook`, `StripeCustomer`, `Quote`, `NDA`, `SignatureRequest`, `CadrageMeeting`, `CapacityWindow`, `OnboardingDoc` — OUI/NON avec preuve.

### 1.2 Inventaire Server Actions

| Action | Fichier:Ligne | Rôle requis | États input → output | Idempotente ? | Rate-limit ? | Turnstile ? | Telegram ? | Email ? |
| ------ | ------------- | ----------- | -------------------- | ------------- | ------------ | ----------- | ---------- | ------- |

### 1.3 Inventaire UI visiteur

- `/reserver` : composants, state, Server Actions, accessibilité, responsive.
- Tous les CTAs `href="/reserver"` (recherche exhaustive Grep).
- Composants calendrier `src/components/calendar/**`.

### 1.4 Inventaire UI admin

Pour chaque section `src/app/[locale]/(admin)/[adminPrefix]/**` : route, rôle requis, champs, actions, layout, responsive mobile.

### 1.5 Inventaire Queue/Workers

- 4 workers actuels (`email`, `option-expiration`, `option-reminder`, `retention-purge`).
- Workers manquants à lister.

### 1.6 Inventaire emails transactionnels

Lister chaque template dans `src/emails/**`.

### 1.7 Inventaire intégrations externes

- Stripe : présent/absent ? Mode test/live ? Webhook signé ? `[INCONNU — raison]` si non vérifiable.
- Cal.com / Calendly : legacy `calendarEventId` dans `Booking` — encore utilisé ?
- Telegram, Resend : déjà confirmés.
- Yousign/DocuSign : présent ? non probablement.
- Visio (Jitsi/Whereby/Meet) : présent ?

### 1.8 Inventaire conformité légale actuelle

- CGV actuelles (`/conditions-generales`) : clause acompte ? clause annulation ? clause force majeure ? clause RGPD ?
- Mentions légales : forme juridique actuelle, immatriculation, IBAN, capital, DPO, hébergeur.
- Sous-processeurs (`/sous-processeurs`) : liste actuelle.
- Politique cookies : à jour ?
- **NE PAS auditer** : Qualiopi (hors V1), e-invoicing PPF/PDP (hors V1), régime TVA spécifique (structure juridique non tranchée). Mentionner uniquement en `[À REVISITER V2+]`.

### 1.9 Doctrine vs réalité — diff

| Affirmation copy/doc            | Source                 | Vérité code                 | Source code                                 | Verdict             |
| ------------------------------- | ---------------------- | --------------------------- | ------------------------------------------- | ------------------- |
| « Acompte 50 % »                | `interventions.ts:236` | Aucune intégration paiement | `booking/actions.ts` ne crée pas de Payment | **GAP CRITIQUE P0** |
| « Call de cadrage » (étape 2/5) | `interventions.ts:220` | Aucune table CadrageMeeting | `prisma/schema.prisma`                      | **GAP CRITIQUE P0** |
| « Facture immédiate »           | `interventions.ts:236` | Aucune génération PDF       | …                                           | **GAP CRITIQUE P0** |

**Stop si** Phase 0 révèle des données fondamentales manquantes (DB inaccessible, code corrompu) → `🚨-PHASE0-BLOCKED.md`.

---

## 2. PHASE 1 — INVENTAIRE BOUT-EN-BOUT

Livrable : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/01-INVENTAIRE-E2E.md`

### 2.1 Flux visiteur actuel (ASCII ou mermaid)

```
[Landing intervention] → [Hub /interventions ou /audit] → [/reserver]
   → [BookingCalendar UI] → [Choix slot + form] → [Server Action]
   → [Postgres: Submission + Booking OU BookingOption + CalendarSlot]
   → [Telegram + Email queue]
   → [Confirmation page]
```

### 2.2 Flux admin actuel

Diagramme actuel : voir une réservation, accepter/refuser, bloquer, gérer conflits, annuler, reporter.

### 2.3 Cycle de vie actuel d'une réservation

Diagramme d'états **observés en code**. Culs-de-sac, transitions manquantes.

### 2.4 Lien interventions ↔ booking ↔ audits ↔ implementation

- `InterventionType` (7 valeurs) → `pricing.ts` → `interventions.ts` → `/reserver` (préfill ?) → `Booking`.
- Audit (`SubmissionType.audit`) : `/audit` → `Submission` (pas de `Booking` direct sauf `audit_flash_onsite`).
- Implementation : `/implementation` → `Submission` seulement.

### 2.5 Notifications actuelles

| Trigger | Destinataire | Canal | Template | Localisation | Variables |
| ------- | ------------ | ----- | -------- | ------------ | --------- |

### 2.6 Flux légal/contractuel actuel

- Quand le visiteur clique « Réserver », il accepte quoi ? Lien CGV affiché ? Case à cocher ?
- Quand reçoit-il : devis, NDA, facture acompte, facture solde ?
- Aujourd'hui : rien de tout ça n'existe — confirmer.

---

## 3. PHASE 2 — AUDITS PARALLÈLES (11 agents en //)

Chaque agent écrit `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-NN-<slug>.md`.

Structure obligatoire :

1. **Périmètre audité**
2. **Constats positifs** (≥ 3)
3. **Constats négatifs P0/P1/P2/P3**
4. **Recommandations** classées par impact × effort inverse
5. **Sources citées**
6. **Score /100**
7. **Marquage V1 vs V2+** explicite pour chaque reco.

### Agent 1 — Flow visiteur /reserver (UX premium)

- Parcours visiteur depuis page intervention → CTA → calendrier → form → confirmation.
- Clarté option 48h vs réservation ferme.
- Promesse acompte (vs « payez maintenant »).
- Benchmarks : Cal.com, Calendly, Doctolib, Acuity, Stripe Checkout.
- Critères : mobile fluidity, WCAG 2.2 AA, focus management, keyboard nav, error/loading states, dark mode.
- Score `/100` + Top 10 frictions.

### Agent 2 — Admin Console organisation (best practices 2026)

- 17 sections actuelles → cartographier 3 regroupements (actuel, par fréquence, par domaine).
- Benchmarks : Stripe Dashboard, Linear, Vercel, Notion admin, Posthog, Doctolib pro, Cal.com admin.
- Architecture cible avec mockup ASCII.
- Mobile responsive admin (Will en déplacement) — critique.
- Doublons (`submissions` vs `options`), manques (Dashboard, CRM, Factures, Capacité).
- Raccourcis clavier.
- Score `/100` + plan réorg.

### Agent 3 — State machine booking (cible deposit-gated + cadrage + devis + NDA)

State machine cible V1 :

```
draft (form en cours)
   → option_pending (option 48h posée, slot.reserved)
      → cadrage_scheduled (call de cadrage planifié)
         → cadrage_held (call effectué, Will valide intervention pertinente)
            ├─ quote_required ? (montant > 5000€)
            │     → quote_sent (Yousign signature request envoyée)
            │        → quote_signed
            └─ nda_required ? (ETI/grandcompte/secteur sensible)
                  → nda_pending
                     → nda_signed
            → deposit_pending (Stripe Checkout Session créée)
               → confirmed (webhook payment_intent.succeeded)
                  → reminded_j7 (cron J-7 facture solde émise)
                     → in_progress (jour J)
                        → completed (J+1 admin OU cron auto)
                           → invoiced_balance
                              → paid_balance
                                 → archived

Branches d'erreur/sortie :
   → expired (cron 48h sans paiement)
   → cancelled_by_user (lien magique self-service)
   → cancelled_by_admin (rétractation Will)
   → no_show (J+1 admin marque)
   → force_majeure (refund total + reschedule prio)
   → refunded_partial / refunded_full
   → quote_declined / nda_declined / cadrage_declined
```

- Transitions manuelles vs automatiques.
- Effets de bord (email, Telegram, slot, invoice, refund Stripe).
- Invariants (1 slot reserved = 1 booking actif ; confirmed ⇒ Payment succeeded ; pas de transition arrière sans audit-log).
- Score `/100`.

### Agent 4 — Paiement acompte/solde (Stripe + alternatives)

- Comparer Stripe Checkout vs Payment Element vs Payment Link vs GoCardless vs virement classique.
- Recommandation : Stripe Checkout (acompte) + Payment Link ou virement (solde).
- Architecture cible :
  - `POST /api/stripe/create-checkout-session`.
  - `POST /api/stripe/webhook` (signature + idempotency `event.id`).
  - Tables `Payment`, `Invoice`, `Refund`, `StripeWebhookEvent`.
  - Customer Portal Stripe.
  - **TVA-agnostique** : `vatRate` configurable + `vatReverseCharge` boolean, exposés via `pricing.ts` ou `legal.ts`. **L'audit ne tranche pas** entre FR (20 %) et EE (0 % reverse charge). Annexe : 2 scénarios listés.
  - Edge cases : 3DS échoué, carte refusée, dispute, fraude, Radar.
- Multi-currency : EUR V1.
- Stripe sous-processeur RGPD : à ajouter `legal.ts` + `/sous-processeurs`.
- Score `/100` + Top 10 risques.

### Agent 5 — Calendrier admin (arbitrage + UX power-user + géo + capacité)

- Audit `admin/calendrier/page.tsx` + `CalendarBlockPanel.tsx`.
- Benchmarks : Cal.com admin, Calendly admin, Doctolib pro, Acuity, Notion calendar.
- Fonctionnalités cibles :
  - Vues mois / semaine / jour / agenda.
  - Drag & drop reschedule (coût/bénéfice).
  - Quick actions par slot.
  - Filtres (intervention, statut, ville pSEO).
  - Conflits visuels.
  - Heatmap capacité hebdo/mensuelle.
  - Bulk operations.
  - Sync iCal export (Google Calendar perso Will), signed token, lecture seule.
  - Drawer dossier client complet.
  - **Capacité Will** : badge saturation hebdo (vert/jaune/rouge) selon D23.
  - **Géo-awareness** : pour `audit_flash_onsite`, afficher ville cible + estimation trajet + buffer auto (D24).
- Mobile-first.
- Raccourcis clavier.
- Score `/100` + maquette ASCII.

### Agent 6 — Automatisations (queue, crons, workers)

- Audit des 4 workers actuels.
- Cible ~15 jobs :
  - `payment-deposit-expiration`, `payment-deposit-reminder`.
  - `cadrage-reminder` (J-1, H-2).
  - `quote-expiration`, `nda-expiration`.
  - `booking-j7-invoice`, `booking-j1-reminder`, `booking-j0-checkin`, `booking-j1-debrief`, `booking-completion-auto`.
  - `invoice-balance-due` (J+15), `invoice-balance-overdue` (J+30).
  - `refund-trigger`.
  - `webhook-dlq-retry`.
  - `capacity-recompute`.
- Résilience : retry, DLQ, monitoring (Sentry crons), alerting (Telegram).
- Idempotence : clé naturelle (bookingId + jobType + day).
- Score `/100`.

### Agent 7 — Notifications & emails (visiteur + admin)

- Audit templates existants.
- Cible ~18 templates :
  - Option : `option-posted` (existe), `option-confirmed`, `option-expired`, `option-converted-to-cadrage`.
  - Cadrage : `cadrage-scheduled` (invite + .ics), `cadrage-reminder-j1`, `cadrage-reminder-h2`, `cadrage-recap`.
  - Devis/NDA : `quote-sent`, `quote-signed`, `nda-sent`, `nda-signed`.
  - Acompte : `deposit-checkout-link`, `deposit-received` (PDF facture acompte), `deposit-expired`.
  - Booking : `booking-j7-balance-invoice` (PDF), `booking-j1-reminder`, `booking-j1-debrief` (NPS).
  - Solde : `balance-paid`, `balance-overdue-soft`, `balance-overdue-firm`.
  - Annulation : `cancellation-confirmed-by-user`, `cancellation-confirmed-by-admin`, `refund-issued`, `force-majeure-notice`.
- Admin Telegram : audit + triggers manquants.
- Multi-langue FR + EN.
- Preheaders, subjects optimisés, plain-text fallback.
- Unsubscribe RGPD + DOI.
- Score `/100`.

### Agent 8 — RGPD / OWASP / Anti-fraude / Auditabilité

- **RGPD** :
  - Stripe sous-processeur (à ajouter `legal.ts` + `/sous-processeurs`).
  - Yousign sous-processeur (idem).
  - DPA signés ou non ? `[À DEMANDER WILL]`.
  - Right to erasure vs obligation archivage : politique d'anonymisation.
  - `/api/gdpr-export` couvre `Payment`, `Invoice`, `BookingOption`, `Quote`, `NDA` ? Vérifier.
- **OWASP** :
  - IDOR `/admin/bookings/[id]`.
  - CSRF Server Actions (Next 16 protégé natif, vérifier `serverActions.allowedOrigins`).
  - Webhook Stripe : signature obligatoire, replay protection via `event.id` en DB.
  - Rate-limit création checkout.
  - Idempotency keys Stripe.
  - Lien magique self-service : signature HMAC, expiration courte, scope précis.
- **Anti-fraude** :
  - Stripe Radar (gratuit niveau base).
  - Dispute handling workflow.
  - Anti-spam booking.
- **Auditabilité** :
  - `ActivityLog` couvre quelles actions admin ? Snapshot avant/après JSON ?
  - Traçabilité chaîne : click → checkout → webhook → log → audit RGPD.
- **PCI-DSS** : Stripe Checkout = SAQ A. À documenter.
- Score `/100` + Top 10 risques.

### Agent 9 — Bout-en-bout (interventions ↔ audits ↔ implementation ↔ booking ↔ pSEO villes)

- Cohérence narrative et fonctionnelle entre les 4 entrées :
  1. `/audit` → audit flash 890 € réservable direct.
  2. `/interventions` → 4 familles × 14 formats → `/reserver` préfillé.
  3. `/implementation` → submission → contact humain.
  4. `/contact` → submission générique.
- Pages pSEO villes (`/fr/implantations/<region>/<ville>`) : CTAs préfillent-ils `audit_flash_onsite` + `companyCity` ?
- URL paramétrée cible : `/fr/reserver?type=audit_flash_onsite&from=audit&city=paris&utm_source=…`.
- Tracking conversion (Plausible, PostHog, ou homemade) : where do users drop ?
- Score `/100` + parcours idéal en 8-10 étapes par entrée.

### Agent 10 — Pre-booking (cadrage + devis + NDA + signature électronique)

- **Call de cadrage** :
  - Booking d'un slot 30 min visio.
  - Outil : Jitsi (self-hosted) vs Whereby vs Google Meet vs Zoom. Recommandation.
  - Lien visio dans email + .ics calendar attachment.
  - Annulation/reschedule cadrage par client.
  - Post-call : Will valide « intervention pertinente OUI/NON » → transition state machine.
- **Devis** :
  - Génération PDF (`Quote` table : `number`, `bookingId`, `amountHtCents`, `vatRate`, `vatReverseCharge`, `validUntil`, `pdfUrl`, `signatureRequestId`).
  - **TVA configurable** (pas de présomption FR ou EE).
  - Yousign signature request workflow.
  - Webhook Yousign → `quote_signed`.
  - Expiration 7j.
- **NDA** :
  - Détection automatique : `companySize` ETI/grande-entreprise INSEE OU `companySector` finance/santé/défense.
  - Template NDA standard + variables (parties, date, durée 3-5 ans, juridiction **paramétrable** car structure non tranchée).
  - Yousign signature request.
  - Expiration 7j.
- **Convention de formation** : **HORS V1** (Qualiopi reporté). Hook : `Booking.trainingSessionId` peut être anticipé en colonne nullable, _sans_ table `TrainingSession` créée V1.
- **Onboarding docs** post-acompte :
  - File request signé (Hetzner Storage Box ou Cloudflare R2).
  - Liste types docs (organigramme, mapping process, outils en place, accès lecture seule éventuels).
  - Signed URL 7j.
  - Notification admin quand client upload.
- Score `/100`.

### Agent 11 — Conformité légale (CGV / RGPD / facturation / archivage)

**Périmètre V1 strict** — Qualiopi/OPCO/e-invoicing PPF-PDP/régime fiscal détaillé sont HORS V1.

- **CGV / CGU à mettre à jour V1** :
  - Clause acompte 30 % non-remboursable.
  - Clause annulation D5/D6/D7 (J-15 = 50 % refund acompte, < J-15 = acompte conservé).
  - Clause force majeure.
  - Clause RGPD + sous-processeurs.
  - Clause TVA **paramétrable** (mention adaptable selon décision juridique future — l'audit prévoit la _structure_ sans figer le _contenu_).
  - Clause juridiction (paramétrable car structure non tranchée).
- **Mentions légales V1** : à reformuler pour qu'elles puissent accueillir l'une ou l'autre structure (FR ou EE) sans réécriture massive. Champs requis : forme juridique, immatriculation, capital social (le cas échéant), adresse siège, IBAN, DPO contact, hébergeur (Hetzner DE déjà déclaré).
- **Sous-processeurs V1** : ajouter Stripe + Yousign + Hetzner (déjà) + Cloudflare (déjà) + Resend (déjà) + (futur PDP si décidé). DPA à signer pour chacun.
- **Politique cookies** : à jour.
- **Numérotation factures V1** : séquentielle immuable, format `AXION-2026-NNNN`, lock advisory Postgres. Annulation = avoir (`credit_note`).
- **Archivage factures V1** : **10 ans minimum par défaut prudent**. Durée définitive à confirmer après décision structure juridique. Stockage : R2/Hetzner Storage Box + hash SHA256 + horodatage.
- **TVA architecture V1 (agnostique)** :
  - Champ `vatRate` configurable par facture.
  - Champ `vatReverseCharge` boolean.
  - Mention TVA paramétrable via `legal.ts` (string template multi-langue).
  - **Annexe scénarios** (2 scénarios listés, **sans recommandation** de l'audit) :
    - **Scénario A — structure FR** : TVA 20 % B2B France, mention « TVA acquittée sur les débits », régime réel normal ou simplifié, déclaration mensuelle/trimestrielle FR, soumise à e-invoicing PPF/PDP 2026-2027.
    - **Scénario B — OÜ Estonie** : reverse charge intra-UE B2B (mention « Autoliquidation — Article 196 directive 2006/112/CE »), 0 % hors UE, VIES validation, OSS B2C si applicable. Comptabilité OÜ règles Estonie.
  - **Décision Will hors audit**. Audit pose les rails techniques pour les 2.
- **HORS V1, mentions courtes uniquement** :
  - Qualiopi : `[À REVISITER V2+]` — hook futur `Booking.trainingSessionId` nullable.
  - OPCO : `[À REVISITER V2+]` — hook futur `Invoice.payerType` (`client` par défaut V1).
  - E-invoicing FR PPF/PDP : `[À REVISITER V2+ — dépend décision structure juridique]`. Mention brève dans annexe Scénario A.
  - VIES API : `[À REVISITER V2+ — dépend décision structure juridique]`. Mention brève dans annexe Scénario B.
- Score `/100` + Top 10 risques légaux V1.

---

## 4. PHASE 3 — BENCHMARKS 2026

Livrable : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/02-BENCHMARKS-2026.md`

Pour chaque benchmark : **3 points retenus** + **3 points à NE PAS reproduire** + **1 idée actionable**.

- **Booking & calendrier** : Calendly, Cal.com, Doctolib, Acuity Scheduling.
- **Paiement & facturation** : Stripe Checkout, Stripe Billing, Stripe Customer Portal, Stripe Payment Link.
- **Signature électronique** : Yousign, DocuSign, Skribble, SignaturIt.
- **Admin dashboards** : Linear, Vercel, Stripe Dashboard, Notion admin, Posthog, GitHub org settings, Doctolib pro.
- **Visio cadrage** : Jitsi Meet, Whereby, Google Meet (UX intégration).
- **File request docs** : Notion file request, Loom file requests, Dropbox file request.

**Hors benchmark V1** : PDP e-invoicing FR (Pennylane/Sage/Cegid…), Qualiopi software (Beedeez/Workelo/Edusign/Digiforma) — à benchmarker plus tard quand V2+ est scopé.

---

## 5. PHASE 4 — ARCHITECTURE CIBLE V1 (PAPIER UNIQUEMENT)

Livrable : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md`

> ⚠️ Cette phase **décrit** l'architecture cible V1. **Aucun fichier source n'est créé**. Tout est dans le `.md`.

### 5.1 Schéma DB cible V1

Tables à ajouter V1 (nullable, default, indexes, FK) :

- `Payment` : provider, providerEventId unique, providerCustomerId, providerPaymentIntentId, providerCheckoutSessionId, amountCents, currency (EUR V1), type (deposit/balance/refund), status, paidAt, failedAt, failureReason, bookingId.
- `Invoice` : number unique séquentiel, bookingId, type (deposit/balance/full/credit_note), amountHtCents, amountTtcCents, **vatRate (configurable)**, **vatReverseCharge (boolean)**, **vatMention (string nullable)**, pdfUrl, hashSha256, issuedAt, dueAt, paidAt, status, archivedUntil, **payerType (`client` default V1, extensible V2+)**.
- `Refund` : invoiceId, paymentId, amountCents, reason, status, stripeRefundId, createdAt.
- `StripeWebhookEvent` : stripeEventId unique, type, payload JSONB, processedAt, error, retryCount.
- `Quote` : number, bookingId, amountHtCents, **vatRate**, **vatReverseCharge**, validUntil, pdfUrl, signatureRequestId, status.
- `Nda` : bookingId, signatureRequestId, signedAt, expiresAt, pdfUrl, parties JSONB.
- `SignatureRequest` : provider (yousign), providerId, type (quote/nda), status, sentAt, signedAt, declinedAt, signerEmail, signerName.
- `CadrageMeeting` : bookingId, scheduledAt, duration, visioUrl, visioProvider, status, heldAt, validationDecision, notes.
- `OnboardingDoc` : bookingId, type, filename, storageUrl, uploadedAt, signedUrlExpiresAt.
- `CapacityWindow` : weekStart, maxInterventions, currentBookings, recomputedAt.

Extension `BookingStatus` enum (16 valeurs V1) — voir Agent 3.

Extension `Booking` V1 : `depositAmountCents`, `depositPaidAt`, `balanceAmountCents`, `balancePaidAt`, `cadrageMeetingId`, `quoteId`, `ndaId`, `confirmedAt`, `completedAt`, `cancelledAt`, `cancellationReason`, `cancelledByUserId`, `forceMajeureNotes`, `companyCityNormalized`, `travelBufferDays`, **`trainingSessionId` (nullable, hook V2+ Qualiopi sans table associée V1)**.

**Hors V1 — tables non créées, listées comme V2+ uniquement** :

- `TrainingSession`, `Attendance`, `Evaluation`, `Certificate` (Qualiopi V2+).
- Tables e-invoicing FR (V2+).

### 5.2 Server Actions cible V1 (description)

- `scheduleCadrageMeetingAction(optionId, slotPreferences)`
- `markCadrageHeldAction(meetingId, validationDecision, notes)`
- `triggerQuoteSignatureAction(bookingId)`
- `triggerNdaSignatureAction(bookingId)`
- `createDepositCheckoutSessionAction(bookingId)`
- `cancelBookingByUserAction(bookingId, reason, magicToken)`
- `rescheduleBookingByUserAction(bookingId, newSlotId, magicToken)`
- `cancelBookingByAdminAction(bookingId, reason)`
- `markCompletedAction(bookingId, notes, debriefSent)`
- `markNoShowAction(bookingId)`
- `markForceMajeureAction(bookingId, notes)`
- `triggerBalanceInvoiceAction(bookingId)`
- `markBalancePaidAction(invoiceId, method)`
- `requestOnboardingDocsAction(bookingId, docTypes[])`
- `recomputeCapacityAction(weekStart)`

### 5.3 Route handlers cible V1 (description)

- `POST /api/stripe/webhook`
- `POST /api/yousign/webhook`
- `GET /api/admin/calendar/ical/:token`
- `POST /api/admin/bookings/:id/refund`
- `GET /api/booking/self-service/:token`
- `POST /api/onboarding/upload/:token`

### 5.4 Admin navigation cible V1 (mockup ASCII)

```
[Logo Axion-IA]
─────────────────────────
🏠 Tableau de bord            ← KPIs + alertes + capacité Will
🗓️  Calendrier                ← vue mois/semaine/jour + drag + heatmap capacité
📋 Réservations               ← liste + filtres + bulk
   ├─ Toutes
   ├─ Cadrage à faire         ⚠️ 2
   ├─ Devis en attente        ⚠️ 1
   ├─ NDA en attente
   ├─ Acompte en attente      ⚠️ 3
   ├─ Confirmées
   ├─ À venir J-7
   ├─ Terminées
   └─ Annulées
⏳ Options 48h
👥 Clients (CRM 360)
💳 Factures & paiements
   ├─ Factures émises
   ├─ Paiements reçus
   ├─ Refunds
   ├─ Disputes (Stripe)
   ├─ Solde en retard
   └─ Export comptable (CSV V1)
📜 Devis & NDA (Yousign)
   ├─ Devis envoyés/signés
   └─ NDA envoyés/signés
─────────────────────────
✍️  Contenu
   ├─ Blog · Études de cas · FAQ · Aide · Témoignages
📧 Marketing
   ├─ Newsletter · Alertes
─────────────────────────
⚙️  Système
   ├─ Utilisateurs (RBAC)
   ├─ Paramètres (acompte %, capacité, jours fériés, TVA params)
   ├─ Journal d'activité
   ├─ Infrastructure
   └─ 2FA

(HORS V1 — non affiché : 🎓 Sessions formation / Qualiopi → V2+)
```

### 5.5 État machine cible V1 (diagramme complet)

Reprendre Agent 3 — version finale validée V1.

### 5.6 Crons & workers cible V1

Liste exhaustive ~15 jobs avec cadence + idempotence + monitoring + DLQ.

### 5.7 Templates emails cible V1

Liste exhaustive ~18 templates avec nom, langue (FR/EN), trigger, sujet, contenu condensé, CTAs, plain-text fallback.

### 5.8 Architecture conformité légale V1

- CGV/mentions légales paramétrables (string templates dans `legal.ts`).
- Sous-processeurs déclarés (Stripe, Yousign, Hetzner, Cloudflare, Resend).
- Numérotation séquentielle immuable (lock advisory Postgres).
- Archivage 10 ans par défaut (durée révisable selon décision juridique).
- TVA architecture **agnostique** (vatRate + vatReverseCharge + vatMention paramétrables).
- **Hors V1** : intégration PDP, VIES API, modules Qualiopi/OPCO.

### 5.9 Intégrations externes cible V1

- Stripe (acompte + solde + Customer Portal + Radar + webhooks).
- Yousign (devis + NDA).
- Outil visio cadrage (Jitsi self-hosted recommandé pour souveraineté + zéro coût — à valider).
- Storage docs (Cloudflare R2 ou Hetzner Storage Box).
- API jours fériés FR.

**Hors V1** : VIES API, PDP e-invoicing FR, intégration comptable (Pennylane/Indy/Tiime).

### 5.10 Hooks d'extension V2+ (décrits, non implémentés V1)

Section dédiée listant ce qui est **prévu** pour V2+ mais **non scopé** V1 :

- Champ `Booking.trainingSessionId` nullable (sans table associée V1).
- Champ `Invoice.payerType` (`client` par défaut V1, extensible `opco`/`autre` V2+).
- Architecture TVA paramétrable prête à accueillir scénario FR ou EE.
- Slots libres dans schéma DB pour `TrainingSession`/`Attendance`/`Evaluation`/`Certificate` (V2+ Qualiopi).
- Slot libre pour intégration PDP e-invoicing (V2+).

---

## 6. PHASE 5 — PLAN D'EXÉCUTION CHIFFRÉ V1 (PAPIER UNIQUEMENT)

Livrable : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md`

> ⚠️ Ce plan **décrit** les sprints futurs. **Aucun sprint n'est exécuté pendant l'audit**. Will déclenchera chaque sprint séparément.

### Sprints V1 (P0/P1 — must avant lancement deposit-gated)

- **Sprint X.1 — Foundation paiement & DB (~4-5j)** : migrations Payment/Invoice/Refund/StripeWebhookEvent + Stripe SDK install + `.env.example` + ADR Stripe. **TVA-agnostique**.
- **Sprint X.2 — Checkout & webhook (~2-3j)** : create checkout session + webhook handler + idempotency + dispatch state.
- **Sprint X.3 — State machine deposit-gated (~3-4j)** : refactor `createBookingAction` + `postOption48hAction` + transitions + invariants + tests vitest.
- **Sprint X.4 — Pre-booking cadrage (~3j)** : CadrageMeeting table + actions schedule/hold + visio integration + email .ics + drawer admin.
- **Sprint X.5 — Devis & NDA Yousign (~3-4j)** : Quote/Nda/SignatureRequest tables + Yousign SDK + webhook + templates + drawer admin.
- **Sprint X.6 — Admin Réservations (~3j)** : liste + filtres + drawer détail + actions + activity log + bulk.
- **Sprint X.7 — Admin Calendrier v2 (~3j)** : vues mois/semaine/jour + drag-drop + bulk block + iCal export + heatmap capacité + géo-awareness.
- **Sprint X.8 — Admin Factures V1 (~3j)** : génération PDF + numérotation séquentielle + statut + relance + export CSV. **TVA paramétrable**.
- **Sprint X.9 — Crons & workers (~3j)** : 15 jobs + DLQ + retry + monitoring Sentry crons.
- **Sprint X.10 — Emails (~2-3j)** : 18 templates FR+EN + tests + RGPD unsubscribe + preheaders.
- **Sprint X.11 — Admin nav refactor + Dashboard (~2j)** : nouvelle structure + dashboard accueil KPIs + breadcrumbs + raccourcis clavier.
- **Sprint X.12 — Self-service client (~2j)** : lien magique annulation/reschedule + Customer Portal Stripe.
- **Sprint X.13 — Onboarding docs (~1-2j)** : file request + storage R2/Hetzner + signed URLs + notification admin.
- **Sprint X.14 — Capacité Will + géo (~1j)** : CapacityWindow + recompute + UI badge + géo trajet audit on-site.
- **Sprint X.15 — Conformité légale V1 (~3-4j)** : Stripe/Yousign sous-processeurs + DPA + CGV update agnostiques + mentions légales paramétrables + politique annulation + archivage 10 ans + numérotation immuable.
- **Sprint X.16 — Bout-en-bout préfill + tracking (~1j)** : URL paramétrée + analytics funnel.
- **Sprint X.17 — Tests E2E Playwright (~2-3j)** : full happy path + edge cases.
- **Sprint X.18 — Doc + ADRs + CHANGELOG (~1j)**.

**Total V1 estimé : 38-50 j ingé.**

### Sprints V2+ (P3 — REPORTÉ, listés pour traçabilité, non scopés audit)

- **Sprint V2.Q1 — Qualiopi (~5-7j)** : `[P3 REPORTÉ V2+]` — TrainingSession/Attendance/Evaluation/Certificate + convention formation + émargement digital + évaluation chaud/froid + certificat PDF.
- **Sprint V2.Q2 — OPCO workflow (~3-4j)** : `[P3 REPORTÉ V2+]` — Invoice.payerType=opco, facture OPCO 60-90j, relance OPCO, intégration éventuelle EDOF/AKTO/etc.
- **Sprint V2.EI — E-invoicing FR PPF/PDP (~5-7j)** : `[P3 REPORTÉ V2+ — dépend décision juridique]` — intégration PDP candidat (Pennylane/Sage/etc.) + Factur-X PDF/A-3 + soumission PDP + monitoring statut.
- **Sprint V2.VIES — VIES API + multi-régime TVA (~1-2j)** : `[P3 REPORTÉ V2+ — dépend décision juridique]`.
- **Sprint V2.MC — Multi-currency GBP/USD (~1-2j)** : `[P3 REPORTÉ V2+]`.
- **Sprint V2.CR — Réconciliation comptable API (~2-3j)** : `[P3 REPORTÉ V2+]` — intégration Pennylane/Indy/Tiime.

**Total V2+ estimé : 17-25 j ingé** (à scoper plus tard, hors audit actuel).

Pour chaque sprint V1 : préciser P0 (must avant lancement deposit-gated) / P1 (should V1) / P2 (could V1 si temps) / P3 (won't V1 — bascule V2+).

---

## 7. PHASE 6 — SYNTHÈSE + VERDICT

Livrables : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/SYNTHESE-FINALE.md` + `WHAT-TO-DO-NOW.md`

### 7.1 Score consolidé

| Agent                                | Score /100 | Poids     | Score pondéré |
| ------------------------------------ | ---------- | --------- | ------------- |
| 1 — Flow visiteur                    | …          | 12 %      | …             |
| 2 — Admin organisation               | …          | 10 %      | …             |
| 3 — State machine                    | …          | 13 %      | …             |
| 4 — Paiement Stripe                  | …          | 13 %      | …             |
| 5 — Calendrier admin                 | …          | 9 %       | …             |
| 6 — Automatisations                  | …          | 9 %       | …             |
| 7 — Notifications                    | …          | 7 %       | …             |
| 8 — RGPD/OWASP                       | …          | 9 %       | …             |
| 9 — Bout-en-bout                     | …          | 5 %       | …             |
| 10 — Pre-booking (cadrage/devis/NDA) | …          | 8 %       | …             |
| 11 — Conformité légale V1            | …          | 5 %       | …             |
| **Total**                            |            | **100 %** | …             |

### 7.2 Verdict

- 🟢 GO : ≥ 85 % et zéro P0 ouvert → audit clôt, plan exécutable.
- 🟡 GO CONDITIONNEL : ≥ 70 % et P0 ≤ 3 → audit clôt, sprint correctif requis.
- 🔴 NO-GO : < 70 % ou P0 ≥ 4 → audit clôt, plan refactor majeur.

### 7.3 Top 10 P0 (must-fix avant lancement deposit-gated V1)

Format ordonné par impact × effort inverse :

- **Titre** + **Source** + **Impact** (revenu, RGPD, UX, sécurité) + **Effort** (j ingé) + **Sprint cible**.

### 7.4 Top décisions Will (STOP-AND-ASK.md)

- Pourcentage acompte (30 % par défaut OK ?).
- Politique annulation J-15 (50 % refund acompte OK ?).
- Mode paiement primaire (Stripe Checkout vs Payment Link vs les deux).
- Numérotation factures (format `AXION-2026-NNNN` OK ?).
- Outil visio cadrage (Jitsi self-hosted vs Google Meet vs autre).
- Capacité Will (1/jour, 3/sem, 8/mois OK ?).
- Drag & drop admin calendrier (oui/non).
- Refunds automatiques vs manuel.
- J+1 debrief NPS (oui/non).
- Admin EN (FR only ou bilingue ?).
- Storage docs (R2 vs Hetzner Storage Box).
- PDF moteur (react-pdf vs Puppeteer).
- **Structure juridique** (FR vs EE) — à trancher plus tard, l'audit reste agnostique mais doit la mentionner comme décision à prendre.

### 7.5 WHAT-TO-DO-NOW.md

Format court, ≤ 2 pages, lisible en 3 min :

1. **Décisions Will à prendre cette semaine** (≤ 5).
2. **Actions techniques P0 à lancer en premier** (≤ 5).
3. **Sprint suivant recommandé** (durée + livrable principal).
4. **Risques bloquants** (≤ 3).
5. **Quick wins** (≤ 3).

---

## 8. LIVRABLES (récapitulatif)

Tous dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/` :

```
_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/
├── MANIFEST.md
├── 00-REALITY-CHECK.md
├── 01-INVENTAIRE-E2E.md
├── 02-BENCHMARKS-2026.md
├── 03-ARCHITECTURE-CIBLE.md     ← description papier V1 + hooks V2+
├── 04-PLAN-EXECUTION.md         ← sprints V1 + sprints V2+ listés mais reportés
├── agent-01-flow-visiteur.md
├── agent-02-admin-organisation.md
├── agent-03-state-machine.md
├── agent-04-paiement-stripe.md
├── agent-05-calendrier-admin.md
├── agent-06-automatisations.md
├── agent-07-notifications.md
├── agent-08-rgpd-owasp.md
├── agent-09-bout-en-bout.md
├── agent-10-pre-booking-cadrage-devis-nda.md
├── agent-11-conformite-legale-v1.md
├── SYNTHESE-FINALE.md
├── WHAT-TO-DO-NOW.md
├── STOP-AND-ASK.md
└── (optionnel) 🚨-NO-GO-ALERT.md
```

`MANIFEST.md` : agent responsable, statut `OK|FAILED|PARTIAL`, durée, sources principales.

**Tous les fichiers sont `.md`**. Aucun autre format autorisé.

---

## 9. STYLE & FORMAT DES LIVRABLES

- **Français** partout.
- **Markdown propre**, headings hiérarchiques cohérents.
- **Citations systématiques** : `path/file.ext:LINE`, `[curl GET URL → 200 OK]`, `[grep -rn "stripe" src/ → 0 résultat]`, `[doc URL officielle]`.
- **Pas de jargon inutile**. Pas d'emojis hors entêtes (🚨, ⚠️, ✅, 🚫, 🟢, 🟡, 🔴).
- **Tableaux Markdown** pour comparaisons, listes ordonnées pour priorités, blocs code pour exemples.
- **Diagrammes** : ASCII art ou mermaid.
- **Concision** : chaque livrable ≤ 800 lignes, sauf `03-ARCHITECTURE-CIBLE.md` et `04-PLAN-EXECUTION.md` ≤ 1500 lignes.
- **Marquer V1 vs V2+** explicitement partout où une reco apparaît.

---

## 10. DÉMARRAGE

Quand tu reçois ce prompt :

1. **Re-lire le bandeau en tête** (🚫 AUDIT-ONLY — ZÉRO BUILD — ZÉRO LIGNE DE CODE).
2. **Re-lire § 0.0bis** (V1 vs V2+ : Qualiopi/OPCO/structure juridique hors V1).
3. Créer `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/` + `MANIFEST.md`.
4. Lancer **Phase 0 (REALITY CHECK)** — ~30-45 min agent unique.
5. Si Phase 0 OK → lancer les **11 agents Phase 2 en parallèle** + Phase 1 inventaire E2E + Phase 3 benchmarks (agents dédiés).
6. Consolidation **Phase 4 + Phase 5** en série.
7. **Phase 6 (Synthèse + Verdict)** en dernier.
8. Si verdict 🔴 → STOP + `🚨-NO-GO-ALERT.md`.
9. Sinon → `WHAT-TO-DO-NOW.md` + fin.

---

## 11. ENGAGEMENT FINAL (relecture obligatoire avant de commencer)

> Je m'engage à :
>
> - Ne **pas** écrire une ligne de code applicatif (TypeScript, JavaScript, SQL, YAML, JSON hors `.md` de sortie).
> - Ne **pas** créer ou modifier de fichiers `.ts`, `.tsx`, `.js`, `.sql`, `.env`, `.yaml`, `.json`, `.prisma`, `.lock`.
> - Ne **pas** lancer `pnpm add`, `pnpm install`, `pnpm remove`, `pnpm build` brut, `pnpm db:*`, `prisma migrate *`.
> - Ne **pas** faire de `git add`, `git commit`, `git push`, `git tag`, `git stash`.
> - Ne **pas** appeler d'API POST externe (Stripe, Coolify, Cloudflare, Hetzner, Sentry, Resend, Yousign).
> - Ne **pas** POST aux Server Actions ou aux endpoints admin du projet.
> - **Ne pas scoper Qualiopi/OPCO/régime fiscal détaillé dans V1** — V2+ seulement, hooks d'extension uniquement.
> - **Rester agnostique sur la structure juridique** (FR vs EE) — proposer une architecture qui marche pour les deux.
> - Tout écrire dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/` au format `.md` exclusivement.
> - Citer chaque affirmation (file:line, URL officielle, cmd).
> - Flagger toute tentation de « petit fix » comme P0/P1 et continuer.
> - Si je doute : `[INCONNU — raison]` plutôt que d'inventer.

**Si l'une de ces lignes est violée, l'audit est considéré comme INVALIDE et doit être recommencé.**

Go.
