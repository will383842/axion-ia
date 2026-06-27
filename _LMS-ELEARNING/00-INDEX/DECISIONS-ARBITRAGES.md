# Décisions d'architecture (ADR) — LMS e-learning

Journal des décisions structurantes. Chaque décision est **réversible** sauf mention contraire ; modifier une décision = mettre à jour cet ADR + les docs impactés.

---

## ADR-LMS-0001 — Authentification apprenant hybride

**Contexte.** Aujourd'hui, les participants accèdent au portail uniquement par **token magique** (`PortailAcces`, cookie HttpOnly 90j). NextAuth v5 ne gère **que les `AdminUser`** (email + mot de passe + 2FA). Le besoin : des particuliers ET des **équipes d'entreprise** qui veulent « accès + mot de passe ».

**Options.**

1. Tout en magic-link (statu quo étendu) — simple, mais pas de « mot de passe » attendu par les entreprises.
2. Tout en email/mot de passe — lourd, casse l'existant passwordless.
3. **Hybride** : magic-link par défaut + mot de passe **optionnel**.

**Décision.** Option 3. Le magic-link reste le chemin par défaut (zéro friction, déjà sécurisé). On ajoute un `passwordHash` **optionnel** (argon2id) sur l'apprenant, activable pour les comptes entreprise. L'auth apprenant est un **système séparé de NextAuth** (cookie/middleware dédiés) pour ne pas risquer de régression sur l'admin.

**Conséquences.** Voir `04-BACKEND/05-authentification-apprenant.md`. Cohabitation stricte avec NextAuth (deux mondes : admin vs apprenant).

---

## ADR-LMS-0002 — Multi-tenant conçu maintenant, livré en V2

**Contexte.** `Client` est un **CRM** (prospect, devis, OPCO), **pas** un multi-tenant : aucune donnée n'est cloisonnée par entreprise, pas d'admin entreprise, pas de branding par client. Le vrai multi-tenant est le morceau le plus lourd (filtrer **toutes** les requêtes par `tenant_id`).

**Options.**

1. Multi-tenant complet dès le MVP — retarde le lancement de plusieurs mois.
2. Jamais de multi-tenant — ne répond pas au besoin entreprise.
3. **Concevoir maintenant, livrer en V2** ; MVP = accès individuels + octroi/import en masse côté admin Axion-IA.

**Décision.** Option 3. Le data model est posé dès le départ pour ne pas créer de dette bloquante (clé d'appartenance entreprise sur l'apprenant, scoping prévu), mais le **cloisonnement strict + espace entreprise autonome** arrive en V2.

**Conséquences.** Voir `02-ARCHITECTURE/multi-tenant-strategie.md`. MVP : une entreprise commande, Axion-IA ouvre les accès en masse (CSV). V2 : l'entreprise gère ses équipes elle-même.

---

## ADR-LMS-0003 — CPF/RNCP « certification-ready », activable plus tard

**Contexte.** Will veut pouvoir vendre l'e-learning en **finançable**. **Fait réglementaire dur** : le **CPF exige une certification RNCP ou RS** ; un e-learning non certifiant **n'est pas éligible CPF** (ce n'est pas la modalité qui bloque, c'est l'absence de certification). Obtenir une certification = dossier long auprès de France Compétences, **indépendant du code**.

**Options.**

1. Ne rien prévoir pour le CPF — il faudra tout refaire le jour venu.
2. **Tout construire « certification-ready »** + intégration EDOF derrière un flag.

**Décision.** Option 2. La plateforme produit **dès le MVP** toutes les preuves exigées (assiduité, progression, évaluations, certificat de réalisation, traces d'assistance) → **finançable OPCO + entreprise + vente directe immédiatement**. L'intégration **CPF/EDOF** (entrée effective, service fait, FranceConnect+) est codée mais **gated par un flag** (ex. `EDOF_ENABLED=false`). Will l'activera quand l'autorisation France Compétences sera obtenue. Le **dossier de certification RNCP/RS** à déposer est documenté à part (`08-CONFORMITE/04-...`).

**Conséquences.** « Mettre en ligne quand j'aurai les autorisations » = poser un flag + brancher EDOF. Pas de refonte.

---

## ADR-LMS-0004 — E-commerce : infra Stripe gardée éteinte

**Contexte.** L'infra Stripe **existe et est complète** (`Invoice`/`Payment`/`Refund`/webhook) mais **neutralisée** via `STRIPE_ENABLED=false` (bascule SAS française, paiement virement/manuel). Will n'a pas encore de compte Stripe.

**Décision.** MVP = **virement + octroi d'accès manuel** (Axion-IA encaisse, ouvre l'accès en 1 clic). On ajoute un modèle de commande e-learning (`Order`) qui sait octroyer l'accès, mais le paiement CB reste **éteint**. Le jour où Will a un compte Stripe : `STRIPE_ENABLED=true` + clés → CB active, sans refonte.

**Conséquences.** Voir `03-DATA-MODEL/05-schema-ecommerce-commandes.md`.

---

## ADR-LMS-0005 — Vidéo : Cloudflare Stream (ou Bunny), pas d'auto-hébergement

**Contexte.** R2 **stocke** mais ne **streame** pas (pas de HLS adaptatif). Servir du MP4 brut = mauvaise UX mobile + pas de protection.

**Décision.** **Cloudflare Stream** par défaut (tu es déjà chez Cloudflare ; HLS + encodage + bande passante inclus ; ~6× moins cher que Mux). **Bunny Stream** en alternative si la **résidence des données en UE** devient prioritaire (RGPD). Protection = **URLs signées + watermark dynamique par utilisateur** (le DRM lourd n'est justifié que pour du premium à forte valeur). **Pas d'auto-hébergement** (coût egress prohibitif).

**Conséquences.** Voir `04-BACKEND/07-pipeline-video-streaming.md`.

---

## ADR-LMS-0006 — Pas de standards SCORM/xAPI/LTI au lancement

**Contexte.** On crée notre **propre contenu natif**. SCORM/xAPI/LTI servent surtout à importer/exporter du contenu entre LMS ou répondre à des appels d'offres entreprise.

**Décision.** **Lancer 100 % natif, sans standard.** Mais **modéliser le tracking interne sur la grammaire xAPI** (verbe/objet) pour ne pas se bloquer. Ajouter un **import SCORM/cmi5** et un **émetteur xAPI** seulement si un besoin commercial concret apparaît (V2+).

**Conséquences.** Voir `03-DATA-MODEL/02-schema-progression-tracking.md`.

---

## ADR-LMS-0007 — Cloisonnement du code sous `src/server/elearning/**`

**Contexte.** Le repo impose un cloisonnement strict par domaine (cf. skills existants image-bank/qualiopi).

**Décision.** Tout le code LMS vit sous des chemins dédiés : `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/app/[locale]/portail/**` (extension), `src/components/admin/elearning/**`, `src/components/elearning/**`, workers `src/server/queue/workers/elearning-*-worker.ts`. Réutilisation explicite des briques existantes (jamais de duplication).

**Conséquences.** Voir `02-ARCHITECTURE/reutilisation-existant.md` et `10-SKILLS/skill-axionia-lms-core.md`.

---

## ADR-LMS-0008 — Migrations Prisma strictement additives

**Contexte.** Contrat plateforme : build externalisé + stub `stub.invalid`, prod live. Une migration destructive casserait la prod.

**Décision.** Toutes les migrations LMS sont **additives** (CREATE TABLE / ADD COLUMN nullable). Aucun DROP. Champs ajoutés à des tables existantes (`Trainee.passwordHash`) = **nullable**. Voir `03-DATA-MODEL/06-strategie-migrations.md`.
