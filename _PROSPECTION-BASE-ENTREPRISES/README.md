# Dossier de conception — Module « Prospection & Base Entreprises » (Axion-IA)

Collecte gratuite des entreprises françaises **par département × activité (NAF) × taille (TPE/PME/ETI/GE)**,
enrichissement de contacts (dirigeants **+ responsables de secteur/équipe**, email, téléphone, ville),
pilotage depuis la console d'administration + suivi de couverture (dép → région → France), export.
**V1 = constitution de base + export uniquement (pas de cold-outreach). Sources 100 % gratuites.
Infrastructure axionia (Next.js 16 + Prisma + BullMQ + Server Actions).** Statut : **PLAN, aucun code.**

## Index des documents

| Doc                                          | Objet                                                                                                 | Statut                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `PLAN-DIRECTEUR-V1.md`                       | Plan directeur v1.1 (vue d'ensemble, audit adversarial intégré). **Lire en premier.**                 | ✅ Écrit                                          |
| `00-ADR/ADR-0001-architecture-collecte.md`   | Décision : collecte de masse via Stock Sirene + delta (pas l'API paginée)                             | ✅ Écrit                                          |
| `00-ADR/ADR-0002-rgpd-base-legale-aipd.md`   | Décision : base légale, AIPD, non-diffusible/opposition RNE, opt-out, minimisation                    | ✅ Écrit                                          |
| `00-ADR/ADR-0003-perimetre-v1.md`            | Décision : V1 base+export, 0 payant, infra axionia (pas Fastify SOS-Expat)                            | ✅ Écrit                                          |
| `01-DATA-MODEL.md`                           | Modèle de données détaillé (entités, champs, index, dédup, enums, migration additive)                 | ✅ Écrit                                          |
| `02-SPEC-SOURCES-COLLECTE-ENRICHISSEMENT.md` | Sources gratuites, pipeline Stock, dénombrement, rate-limit, mini-crawl 2 passes                      | ✅ Écrit                                          |
| `03-SPEC-STATS-REPORTING.md`                 | StockReference / GeoCoverageStat / StatsSnapshot, formules, KPI, carte, alertes                       | ✅ Écrit                                          |
| `04-SPEC-UI-ROUTES.md`                       | Pôle nav, toutes les routes/pages admin, wizard, contacts, RBAC, Web Vitals                           | ✅ Écrit                                          |
| `05-CONFORMITE-RGPD-AIPD.md`                 | AIPD (modèle CNIL), LIA, art.14, opt-out bloquant, journal d'accès, registre                          | ✅ Écrit                                          |
| `06-MATRICE-ACCEPTATION.md`                  | Oracle du « done » : exigence → artefact → test → critère, par tranche T0→T9                          | ✅ Écrit                                          |
| `07-DECISIONS.md`                            | Les 10 questions §14 **tranchées** (décisions verrouillées)                                           | ✅ Écrit                                          |
| `08-TEST-STRATEGY.md`                        | Stratégie de test/vérification autopilot (fixtures, mocks, non-régressions, vérif adversariale)       | ✅ Écrit                                          |
| `AIPD-ET-MENTIONS-PRETES.md`                 | **AIPD + LIA + mention d'information + registre PRÉ-REMPLIS** (rien à rédiger, relecture recommandée) | ✅ Prêt                                           |
| `STATE.md`                                   | **Suivi d'implémentation de bout en bout** (T0→T9, cases à cocher, statut, journal de reprise)        | ✅ Prêt (pré-rempli, implémentation non démarrée) |

## Décisions verrouillées (Will)

Gratuit uniquement (collecte + enrichissement) · V1 base + export (pas d'outreach) · infra axionia ·
plan d'abord, skill + code ensuite. Détail + 10 questions ouvertes : voir `PLAN-DIRECTEUR-V1.md` §0 et §14.

## Reprise

**Dossier complet (10 documents rédigés).** Prochaines étapes : (1) Will lit le dossier + tranche les
10 questions ouvertes (`PLAN-DIRECTEUR-V1.md` §14, dont validation juridique AIPD/LIA) ; (2) créer le
skill `axionia-prospection` (SKILL.md + reference/) ; (3) dérouler les tranches T0→T9 sur branche isolée.
**Aucun code applicatif n'est écrit tant que le dossier n'est pas validé.**
