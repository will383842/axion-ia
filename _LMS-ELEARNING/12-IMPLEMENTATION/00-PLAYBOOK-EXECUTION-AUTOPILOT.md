# Playbook d'exécution — implémentation autopilot par lots

> **But.** Décrire **comment** le LMS sera réellement construit : lots séquencés, **portes de vérification / croisement / tests** à chaque étape, ce qui est **autonome** vs ce qui exige **Will**, et les **règles de sécurité** (branche isolée, jamais de prod sans revue). C'est le mode d'emploi de l'implémentation, pas une nouvelle spec.
>
> Référence d'autorité : `00-INDEX/CORRECTIONS-PRE-IMPLEMENTATION.md` (SSOT). Séquence : `11-ROADMAP/01`. Backlog : `11-ROADMAP/02`.
>
> Dernière mise à jour : 2026-06-27.

---

## 1. Modèle d'exécution « autopilot par lots »

L'implémentation n'est pas un run unique : c'est une **suite de lots**, chacun mené en autonomie puis **vérifié** avant de passer au suivant. Reprise automatique après toute interruption (limite d'usage, pause).

### 1.1 Cycle standard d'UN lot (la boucle)

```
1. PRÉPARER   → relire le doc source + corrections + le code existant concerné (anti-duplication)
2. CONSTRUIRE → écrire le code (modèles, services, actions, routes, composants, workers)
3. PORTE A — Compilation : pnpm tsc (0 erreur) + eslint (0 erreur)
4. PORTE B — Tests : écrire + lancer les tests (Vitest) du lot ; rouge interdit
5. PORTE C — Croisement : vérifier la cohérence avec les lots précédents (noms Prisma, guards, routes)
6. PORTE D — Vérification adversariale : 1 agent relit le diff (bugs, sécurité, conformité, anti-duplication)
7. CORRIGER  → traiter les findings de la porte D
8. JOURNALISER → noter l'état dans 12-IMPLEMENTATION/JOURNAL.md (resumable)
9. CHECKPOINT → si le lot exige une décision/clé de Will → STOP & ASK ; sinon lot suivant
```

**Aucun lot ne passe au suivant si une porte est rouge.** Un lot interrompu reprend à l'étape où il s'est arrêté (le JOURNAL est la source de reprise).

### 1.2 Règles de sécurité non négociables

- **Branche isolée** : tout le travail sur une branche dédiée `feat/lms-elearning` (worktree). **Jamais de commit direct sur `main`, jamais de déploiement prod sans revue de Will.**
- **Migrations strictement additives** (ADR-0008) : `prisma migrate dev` en local sur une DB de dev ; jamais de DROP ; jamais `migrate deploy` en prod sans Will.
- **Contrat `stub.invalid`** (ADR-0026) respecté : pages derrière auth + `force-dynamic` ; pages publiques tolèrent le stub au build.
- **Budgets Web Vitals** : `pnpm lhci` + `size-limit` sur les pages publiques/portail touchées.
- **Doctrines repo** : Nodemailer (pas de service tiers), `pricing.ts` SSOT, FR-only, cloisonnement `src/server/elearning/**`.
- **Secrets jamais inventés** : si une clé réelle manque (Stream, Stripe), la feature est codée **gated** (flag off) et testée avec mocks ; on n'invente pas de secret.

### 1.3 Ce qui est AUTONOME vs ce qui exige WILL

| Autonome (je le fais)                                     | Exige Will (STOP & ASK)                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Écrire modèles/services/actions/routes/composants/workers | Fournir le **compte Stripe** + clés (active la CB)                |
| Migrations additives en **local** + tests                 | Fournir les **clés Cloudflare Stream** réelles (prod vidéo)       |
| tsc / eslint / Vitest / vérif adversariale                | **Dossier de certification RNCP/RS** (France Compétences)         |
| Gating par flags (EDOF/Stream/password off par défaut)    | **Valider le design** visuel (maquettes/rendu)                    |
| Journaliser, reprendre, croiser les lots                  | **Merger sur `main`** + déclencher le **déploiement**             |
| Seeds de démo (1 cours pilote)                            | Décisions produit ouvertes (prix réels, contenu pédagogique réel) |

---

## 2. Pré-requis avant le lot 1 (corrections à fondre)

Avant d'écrire `schema.prisma`, **intégrer le SSOT** `CORRECTIONS-PRE-IMPLEMENTATION.md` dans les docs sources (ou s'y référer directement) : `@db.Uuid` partout (A1), `ElearningOrgMembership` unique (A2), registre workers (A3), enum 12 types + statut commande + onDelete + env (A4), modèles `ElearningTutorAssignment`/`ElearningAssistanceRequest` (NC-1), pont quiz→`EvaluationAcquis` (NC-2), heures réalisées (NC-3), rétention (NC-4).

**Décisions de Will — CONFIRMÉES (2026-06-27), à appliquer le jour de l'implémentation :**

- ✅ **Ne pas implémenter maintenant.** Le dossier est gelé « prêt à coder » ; l'implémentation sera lancée ultérieurement (sur décision explicite de Will).
- ✅ **Auth apprenant** : **magic-link au MVP** ; le **mot de passe entreprise est reporté en V1** (codé gated, `LEARNER_PASSWORD_ENABLED=false` au MVP).
- ✅ **Premier cours (seed pilote)** : tronc commun **« Maîtriser l'IA au quotidien »**.
- ✅ **Provider vidéo** : **Cloudflare Stream** par défaut (ADR-0005).

> Quand l'implémentation démarrera, reprendre ce playbook au LOT 1 ; ces décisions sont figées (pas à re-poser).

---

## 3. Les lots (séquence + portes + ce qui est testé)

> Chaque lot = un cycle §1.1 complet. Estimations indicatives (cf. `11-ROADMAP/03`).

### LOT 1 — Data model + migrations (fondation)

- **Construire** : tous les modèles Prisma LMS (cours/modules/leçons/ressources, progression, quiz, accès/auth, e-commerce, tuteur/assistance) en `@db.Uuid`, additif ; relations inverses sur `Trainee`/`Client`/`Formation`/`Invoice` ; enums ; `suppressionPrevueAt` sur les preuves.
- **Porte B (tests)** : `prisma validate` + migration locale qui applique sans erreur + tests de schéma (relations, contraintes, onDelete).
- **Porte C (croisement)** : noms identiques au SSOT ; FK typées ; pas de collision avec l'existant.
- **Porte D** : agent vérifie additivité (zéro DROP), cohérence enums, réutilisation (pas de modèle « Learner » dupliqué).
- **Checkpoint** : aucun (autonome).

### LOT 2 — Auth apprenant (magic-link + mot de passe optionnel)

- Service `learner-auth-service.ts`, `learner-guard.ts`, cookie, `assertLearnerCanAccessCourse` (anti-IDOR, E1), token haché (E3), rate-limit fail-closed (E7).
- **Tests** : login OK/KO, expiration, révocation, **test IDOR** (un apprenant n'accède pas au cours d'un autre), anti-énumération.
- **Porte D** : audit sécurité du lot (SEC-01/03/04/E7).

### LOT 3 — Octroi d'accès + import en masse

- Octroi auto (session réalisée → e-learning), octroi manuel admin, import CSV idempotent + réactivation (D1), worker `elearning-provisioning-worker`.
- **Tests** : import 100 lignes (doublons, erreurs, dry-run), réactivation accès expiré, idempotence.

### LOT 4 — Pipeline vidéo (Cloudflare Stream, gated)

- Ingestion, URL signée par-utilisateur + watermark (E2), webhook transcodage, sous-titres VTT (D7), worker `elearning-video-worker`.
- **Tests** : génération URL signée (mock Stream), expiration, accès refusé sans enrollment. **Checkpoint** : clés Stream réelles = Will (sinon mock).

### LOT 5 — Lecteur de cours + progression

- Player (reprise auto serveur F1, vitesse, sous-titres), heartbeat `/api/elearning/progress`, agrégats progression (rollup worker), fusion multi-appareils (D3), `unlockReason` (F2), déverrouillage (drip + gating).
- **Tests** : reprise exacte, complétion, déverrouillage par score, concurrence multi-appareils, budget INP (lhci).

### LOT 6 — Moteur de quiz + pont conformité

- 12 types de questions, scoring **100 % serveur** (E5), banque + tirage + shuffle, politique « meilleure note » (F5), gating, **pont quiz→`EvaluationAcquis`** (NC-2), `zone_cliquable` accessible (D8).
- **Tests** : scoring par type, anti-triche (barème jamais exposé), gating bloquant, création `EvaluationAcquis` à la finale.

### LOT 7 — Certificats + conformité FOAD

- Certificat de réalisation (heures réalisées NC-3, QR, réutilise `DocumentGenere`), attestation partielle, **assistance humaine** (NC-1 : `ElearningAssistanceRequest`, délais affichés, alerte SLA), traçabilité preuves (faisceau), rétention + purge (NC-4).
- **Tests** : calcul heures centièmes, émission/non-émission selon complétion, faisceau de preuves exportable, purge par nature.
- **Porte D** : **audit conformité** (un agent « contrôleur DREETS/OPCO » rejoue `99-VERIFICATION/03` sur le code réel).

### LOT 8 — Console admin e-learning (pôle dédié)

- Pôle « E-learning » dans `admin-nav.ts` (`AdminSidebarNav`), dashboard pilotage, **outil auteur** (drag&drop + alternative clavier D6, aperçu as-student, brouillon→publi, sous-titres bloquants), gestion apprenants/entreprises/quiz/certificats, reporting + exports conformité.
- **Tests** : CRUD cours, publication gated (sous-titres/a11y), octroi en masse, exports.

### LOT 9 — Vitrine publique + e-commerce (gated)

- Catalogue/fiche `/formations-en-ligne` (SEO JSON-LD Course, aperçu gratuit D4), tunnel commande virement (MVP), bascule Stripe quand `STRIPE_ENABLED=true`.
- **Tests** : SEO/structured data, stub-safe au build, Web Vitals, octroi à la commande.

### LOT 10 — IA pédagogique (V1)

- Génération quiz/leçons (extension Formation Engine), tuteur RAG ancré + citations (V1), worker `elearning-ai-worker`.
- **Tests** : qualité (grille), grounding/citations, coûts (cost-tracker).

### LOT 11 — Multi-tenant entreprise (V2) + CPF/EDOF (gated)

- Cloisonnement par `tenant_id`, admin entreprise délégué, branding, reporting par org ; EDOF derrière `EDOF_ENABLED` (activé quand certification obtenue).
- **Tests** : isolation inter-tenant (un tenant ne voit pas l'autre), guards délégués.

### Porte finale — Vérification end-to-end globale

- Suite complète (tsc + eslint + Vitest + lhci + size-limit) verte.
- Workflow d'audit adversarial multi-agents rejoué sur le **code réel** (complétude, cohérence, conformité, sécurité, UX, non-duplication).
- E2E parcours apprenant complet (octroi → cours → quiz bloquant → certificat) + parcours admin (créer cours → publier → suivre).

---

## 4. Reprise & journalisation

- `12-IMPLEMENTATION/JOURNAL.md` (créé au lot 1) : pour chaque lot, état des portes A/B/C/D, findings, décisions. **Source de reprise** après toute interruption.
- En cas de limite d'usage : reprise automatique au lot/étape courant via le JOURNAL (même mécanisme que la rédaction du dossier, par lots).

## 5. Réponse honnête à « est-ce 100 % autopilot jusqu'au bout ? »

- **Le code** : oui, mené en autonomie lot par lot, avec portes de vérif/tests, reprise auto. Réaliste sur **plusieurs sessions** (taille ~80-120 j-homme).
- **Pas 100 % sans toi** : 5 points exigent Will → compte Stripe, clés Cloudflare Stream réelles, dossier certification RNCP/RS, validation design, merge `main`/déploiement.
- **Jamais en prod sans revue** : tout sur branche isolée, additif, gated.

## Liens

- `00-INDEX/CORRECTIONS-PRE-IMPLEMENTATION.md` — SSOT à appliquer
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — séquence MVP/V1/V2
- `11-ROADMAP/02-backlog-epics-stories.md` — user stories par lot
- `11-ROADMAP/04-risques-mitigations.md` — risques
- `99-VERIFICATION/*` — audits rejoués comme portes D
