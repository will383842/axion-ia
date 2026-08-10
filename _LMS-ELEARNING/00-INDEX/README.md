# Dossier de conception — Plateforme LMS e-learning Axion-IA

> Dossier de conception **de bout en bout** pour ajouter une plateforme e-learning / LMS **propriétaire** (sans dépendance Moodle/Teachable/360Learning) à la plateforme Axion-IA existante.
>
> Statut : **complet — 67/67 documents rédigés + 6 audits de vérification adversariale passés.**
> Verdict vérification : dossier solide et bien ancré sur le code réel ; **avant d'écrire du code**, traiter d'abord les corrections P0 (cohérence inter-docs) et les 4 non-conformités FOAD identifiées (voir `99-VERIFICATION/`).
> Dernière mise à jour : 2026-06-27.

---

## 1. Pourquoi ce dossier

Axion-IA (organisme de formation IA, SAS française, NDA DREETS, certifié Qualiopi) veut :

- des formations **présentiel OU live** (distanciel synchrone) — _déjà géré par le code existant_ ;
- **en plus**, un **e-learning asynchrone (FOAD)** dont on **ouvre l'accès à qui on veut** : participants de sessions, particuliers, **équipes d'entreprises** ;
- des **modules qui se déverrouillent** les uns après les autres, des **quiz bloquants** pour valider le module suivant, un **suivi de progression** complet, des **certificats** ;
- une **conformité Qualiopi / OPCO / CPF / France Compétences / RNCP** ;
- une **UX apprenant parfaite** et un **outil auteur facile à remplir** pour l'équipe ;
- l'**e-commerce prévu mais non branché** (pas encore de compte Stripe) ;
- le **multi-tenant entreprise** (espaces cloisonnés) ;
- de l'**IA pédagogique** (génération de quiz, tuteur).

Ce dossier traduit ces besoins en spécification implémentable, **ancrée sur le code réel** et **respectant les contraintes plateforme** (build `stub.invalid`, budgets Web Vitals, Nodemailer maison, Stripe gated, FR-only, migrations additives).

---

## 2. Comment lire ce dossier

1. Commence par le **[Résumé exécutif](./RESUME-EXECUTIF.md)** (en mots simples).
2. Lis les **[Décisions / arbitrages](./DECISIONS-ARBITRAGES.md)** (ADR) — ce qui est figé et pourquoi.
3. Le **[data model](../03-DATA-MODEL/)** est la colonne vertébrale : tout le reste y renvoie.
4. La **[roadmap](../11-ROADMAP/)** dit dans quel ordre construire (MVP → V1 → V2).
5. La **[conformité](../08-CONFORMITE/)** est non négociable (FOAD finançable).

---

## 3. Décisions structurantes (résumé)

| Sujet              | Décision                                                                                                          | Détail                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Auth apprenant** | Hybride : magic-link par défaut + email/mot de passe optionnel (équipes entreprise)                               | [ADR-0001](./DECISIONS-ARBITRAGES.md) |
| **Multi-tenant**   | Conçu entièrement, **livré en V2** ; MVP = accès individuels + import en masse                                    | [ADR-0002](./DECISIONS-ARBITRAGES.md) |
| **CPF / RNCP**     | Tout « certification-ready », intégration EDOF derrière un flag ; activable après autorisation France Compétences | [ADR-0003](./DECISIONS-ARBITRAGES.md) |
| **E-commerce**     | Infra Stripe existante gardée **éteinte** (flag) ; MVP = virement + octroi manuel                                 | [ADR-0004](./DECISIONS-ARBITRAGES.md) |
| **Vidéo**          | **Cloudflare Stream** (déjà chez Cloudflare) ou Bunny (UE) ; HLS + URLs signées                                   | [ADR-0005](./DECISIONS-ARBITRAGES.md) |
| **Standards**      | Pas de SCORM/xAPI/LTI au lancement ; tracking interne modélisé sur la grammaire xAPI (future-proof)               | [ADR-0006](./DECISIONS-ARBITRAGES.md) |

---

## 4. Structure du dossier (table des matières)

> ✅ = rédigé · 🔲 = à rédiger

### 00-INDEX

- ✅ `README.md` — cet index maître
- ✅ `RESUME-EXECUTIF.md` — synthèse pour Will (non-technique)
- ✅ `DECISIONS-ARBITRAGES.md` — journal des décisions (ADR)
- ✅ `CORRECTIONS-PRE-IMPLEMENTATION.md` — **⚠️ SSOT faisant autorité** : toutes les corrections (P0 + conformité FOAD + sécurité/RGPD + UX) à appliquer avant de coder. **À lire en premier.**
- ✅ `GLOSSAIRE.md` — termes métier & techniques

### 01-VISION-PERIMETRE

- ✅ `vision-objectifs.md`
- ✅ `perimetre-mvp-v1-v2.md`
- ✅ `personas-roles.md`
- ✅ `modele-economique-tarification.md`

### 02-ARCHITECTURE

- ✅ `architecture-globale.md`
- ✅ `reutilisation-existant.md` — carte de réutilisation (anti-duplication)
- ✅ `multi-tenant-strategie.md`

### 03-DATA-MODEL (colonne vertébrale)

- ✅ `01-schema-cours-modules-lecons.md`
- ✅ `02-schema-progression-tracking.md`
- ✅ `03-schema-quiz-evaluations.md`
- ✅ `04-schema-comptes-acces-auth.md`
- ✅ `05-schema-ecommerce-commandes.md`
- ✅ `06-strategie-migrations.md`

### 04-BACKEND

- ✅ `01-services-domaine.md`
- ✅ `02-server-actions.md`
- ✅ `03-workers-bullmq-crons.md`
- ✅ `04-api-routes.md`
- ✅ `05-authentification-apprenant.md`
- ✅ `06-import-masse-provisioning.md`
- ✅ `07-pipeline-video-streaming.md`
- ✅ `08-ia-pedagogique-generation.md`
- ✅ `09-tuteur-rag-assistant.md`
- ✅ `10-emails-notifications.md`

### 05-FRONTEND-APPRENANT

- ✅ `01-espace-apprenant-dashboard.md`
- ✅ `02-lecteur-cours-player.md`
- ✅ `03-moteur-quiz-ui.md`
- ✅ `04-progression-deverrouillage.md`
- ✅ `05-mobile-accessibilite-wcag.md`
- ✅ `06-certificats-badges.md`
- ✅ `07-catalogue-public-seo.md`

### 06-CONSOLE-ADMIN

- ✅ `01-navigation-structure.md`
- ✅ `02-pilotage-dashboard.md`
- ✅ `03-outil-auteur-course-builder.md`
- ✅ `04-gestion-apprenants.md`
- ✅ `05-gestion-acces-entreprises.md`
- ✅ `06-gestion-banque-quiz.md`
- ✅ `07-gestion-certificats.md`
- ✅ `08-reporting-analytics.md`

### 07-ROUTES

- ✅ `cartographie-routes-complete.md`

### 08-CONFORMITE

- ✅ `01-foad-d6313-3-1.md`
- ✅ `02-qualiopi-indicateurs-foad.md`
- ✅ `03-cpf-edof-readiness.md`
- ✅ `04-dossier-certification-rncp-rs.md`
- ✅ `05-rgpd-conservation-preuves.md`
- ✅ `06-tracabilite-preuves-realisation.md`

### 09-QUALITE

- ✅ `01-plan-tests.md`
- ✅ `02-securite.md`
- ✅ `03-web-vitals-performance.md`
- ✅ `04-accessibilite-wcag22.md`

### 10-SKILLS (skills Claude Code à créer)

- ✅ `00-skills-overview.md`
- ✅ `skill-axionia-lms-core.md`
- ✅ `skill-axionia-lms-authoring.md`
- ✅ `skill-axionia-foad-conformite.md`

### 11-ROADMAP

- ✅ `01-phasage-mvp-v1-v2.md`
- ✅ `02-backlog-epics-stories.md`
- ✅ `03-estimation-charges.md`
- ✅ `04-risques-mitigations.md`

### 12-IMPLEMENTATION

- ✅ `00-PLAYBOOK-EXECUTION-AUTOPILOT.md` — **mode d'emploi de l'implémentation** : 11 lots, portes de vérification/tests, autonome vs Will, règles de sécurité

### 99-VERIFICATION (audits adversariaux)

- ✅ `01-critique-completude.md`
- ✅ `02-coherence-data-model.md`
- ✅ `03-audit-conformite.md`
- ✅ `04-audit-securite-rgpd.md`
- ✅ `05-audit-ux-bestpractices.md`
- ✅ `06-coherence-existant.md`

---

## 5. Ce qui est réutilisé vs neuf (vue rapide)

**Réutilisé tel quel / étendu :** `Trainee`, `Enrollment`, `Client` (CRM), `PortailAcces`, Cloudflare R2 (`src/lib/r2-storage.ts`), infra Stripe (`Invoice`/`Payment`/`Refund`, flag `STRIPE_ENABLED`), Formation Engine IA (`qualiopi-formation-engine-worker.ts`), `DocumentGenere`+QR, emails Nodemailer + BullMQ, console admin (`AdminPageShell`, `admin-nav.ts`, RBAC `requireAdmin*`), `pricing.ts`.

**Neuf à construire :** cœur LMS (`Course`/`Module`/`Lesson`), suivi de progression, moteur de quiz interactif + déverrouillage, auth apprenant, import en masse, multi-tenant (V2), streaming vidéo HLS, outil auteur, IA quiz-gen + tuteur RAG.

> Détail complet dans `02-ARCHITECTURE/reutilisation-existant.md`.
