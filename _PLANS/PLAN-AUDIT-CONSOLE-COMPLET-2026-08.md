# PLAN — Audit complet de la console admin + tableau de bord de pilotage

> Commandé par Will le 2026-08-01 : « toute la console d'administration est mal
> organisée et mal optimisée, pas intuitive du tout ». Armée de 32 agents en
> deux vagues (14 auditeurs par onglet + 1 vérificateur de routes ; 12
> auditeurs par pôle + glossaire + données factices + panel de 3 juges pour le
> tableau de bord). Chaque trouvaille est vérifiée dans le code réel — aucune
> n'est inventée.

## Verdict global

**Zéro lien mort sur 145 entrées de nav.** Le problème n'est jamais la
robustesse, toujours la lisibilité : données techniques qui fuitent à l'écran
(UUID, JSON brut, enums non traduits, commandes terminal), redondances entre
pages qui répondent à la même question, et une porte d'entrée (tableau de
bord) qui ne montre pas l'activité réelle.

## Sévérité — P0 (bloque la compréhension ou l'action)

| #   | Où                                                     | Défaut                                                                                                                                    | Correctif                                                             |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `qualiopi/a-traiter`                                   | Une alerte peut afficher un titre « dead letter queue » + UUID + message d'erreur JS brut — **sur la toute première page de la console**  | Résoudre en libellé métier, jamais interpoler `err.message` à l'écran |
| 2   | `qualiopi/a-traiter`                                   | `rienAFaire` ne compte pas les mêmes catégories que celles affichées → la page peut sembler **totalement vide** sans le message rassurant | Aligner le calcul sur exactement les blocs rendus                     |
| 3   | `qualiopi/dossiers` (Vue d'ensemble)                   | La page racine du pôle recrée l'ancienne organisation par table, **doublon direct** avec « Dossiers (pipeline) » juste au-dessus          | Retirer la page ou la fusionner dans À traiter                        |
| 4   | `content-gen/jobs` + `.../review-queue`                | Les deux listes quotidiennes **n'affichent pas le titre** du contenu concerné                                                             | Colonne Titre cliquable, en 2ᵉ position                               |
| 5   | `content-gen/embeddings`                               | Titre et description 100 % anglais/jargon, variable d'env affichée en toutes lettres                                                      | Titre FR, description métier                                          |
| 6   | `content-gen/onboarding` (étape 2) + `qualiopi/offres` | Demande à Will de **taper une commande `pnpm` en terminal**                                                                               | Bouton d'action serveur, ou message support                           |
| 7   | Banque d'images (3 pages)                              | **Aucune miniature nulle part** ; page RGPD exige un hash SHA-256 ; file de validation sans bouton pour valider                           | Vraies vignettes, IP en clair, boutons d'action                       |
| 8   | `content-gen/cities-*` (7 pages)                       | Deux pages presque homonymes mesurent des choses différentes ; 4 pages se chevauchent                                                     | Fusion/clarification du pôle Villes                                   |
| 9   | `system/config` (Configuration)                        | **57 réglages sur 58** affichent la clé de base de données brute (risque réel de mal renseigner une valeur légale/financière)             | Table de libellés FR, motif déjà à moitié écrit ailleurs              |
| 10  | `system/params` (incident réel 31/07)                  | Éditeur JSON qui **remplace tout** à l'enregistrement — a failli effacer le SIRET                                                         | Formulaires typés par clé, fusion champ à champ                       |
| 11  | `infra`                                                | 3 cartes de statut (Hetzner, GitHub repo, GitHub Actions) affichent `"ok"` **codé en dur**, sans vérification réseau                      | Vrai `fetch()` ou retirer la fausse certitude                         |
| 12  | `ops/web-vitals`                                       | Page 100 % jargon ingénieur (p75, RUM, CrUX)                                                                                              | Ouvrir par un verdict simple, détail replié                           |

## Sévérité — P1 (le motif qui revient partout)

- **Dates en ISO brut** (`2026-07-31`) au lieu du français — au moins 10 pages
- **Filtres affichés mais inopérants** — 4 pages de contacts (presse, partenariats, investisseurs, recrutement) écrasent les paramètres au lieu d'utiliser le mécanisme `forcedTypes` déjà prouvé sur `/contacts/clients`
- **UUID/slugs bruts en colonne** — Sessions, Formations, Configuration, Catégories (le pire : un UUID **tronqué** utilisé comme nom de catégorie parente)
- **Titre de page ≠ libellé sidebar** — « Messages » → « Soumissions », « Générations en cours » → « Jobs content-gen »
- **Deux formats de filtre coexistent** — chips-liens serveur (la référence) vs formulaires select+Appliquer (la majorité de la console)
- **Pas de pastille de compteur** en dehors des zones refondues le 2026-08-01

## Redondances à trancher

- Ancien module « Calendrier »/« Devis »/« Factures » (Booking, mort) vs les vrais, sous Qualiopi/Finances — même nom, données différentes, accessible par ⌘K sans bannière
- « Conformité » et « Mode auditeur » affichent la **même matrice** de 32 indicateurs sous deux entrées
- « Alertes financement (sessions) » réaffiche la liste que le Hub Facturation pilote déjà
- Pôle Villes : 7 pages, 4 se chevauchent
- `kb-readonly` (Génération de contenu) duplique `Connaissances` (Contenu)

## Glossaire — termes à traduire partout où trouvés

`doc.type` brut, « Backfill », « Status » (label resté anglais alors que la valeur est traduite juste à côté), `BookingStatus`/`PaymentStatus` non traduits, incohérence Client/Société/Entreprise selon la page (3 pages, 3 combinaisons différentes des mêmes mots).

## Données factices — un seul cas confirmé

`infra/page.tsx` : 3 cartes de statut hardcodées à `"ok"` sans vérification réelle, contrairement aux ~14 autres cartes de la même grille qui font un vrai `fetch()`.

---

## Le tableau de bord de pilotage — spec finale (panel de 3 juges, synthèse)

Chaque KPI ci-dessous est **ancré dans une fonction ou un modèle Prisma réel**, vérifié ligne par ligne par le jury (une imprécision de citation a été détectée et corrigée : « 26 règles » → 28 réelles ; une affirmation sur `marge.ts` invalidée par lecture directe).

Ordre d'affichage (haut → bas) :

1. **En-tête pilotage** — sélecteur Semaine / Mois / Année (querystring, RSC) + 5 tuiles cockpit (dossiers actifs, à solder/impayés, alertes critiques, CA réalisé + delta N-1, marge du mois). Zéro graphique ici — c'est la zone « 10 secondes ».
2. **Alertes critiques** — toujours visible, jamais repliée, juste sous les KPIs (pas en bas de page).
3. **Calendrier & prévisionnel** — le cœur du système : vue semaine (planning par formateur + congés grisés), vue mois (heatmap), vue année (12 mini-heatmaps + CA superposé), bandeau « prévisionnel bloqué » (sessions à J-7 sans formateur).
4. **Activité** — formations/coachings/audits : planifié/en cours/réalisé/annulé par période, taux de réalisation, tendance 12 mois.
5. **Formateurs** — actifs (salariés/sous-traitants), heures et coût (top 5), alertes CV/vigilance URSSAF/NDA.
6. **Financier** — CA planifié/réalisé/encaissé/impayé, marge et top/flop formations, dossiers OPCO en retard, devis sans réponse. Limite assumée et dite : pas de « CA coaching » à ce niveau (vit sur `CoachingContract`, pas `CoachingSession`).
7. **Pipeline commercial** — dossiers par colonne, répartition par activité — vue de détail secondaire, lien vers Dossiers pour le détail.

Sources exactes : `dossiers-pipeline.ts`, `alertes-service.ts`, `remuneration/marge.ts`, `previsionnel/calcul.ts`, `conformite/pilotage-service.ts` (M1/M3/M5/M6/M11 déjà calculés), `evaluateur.ts` (28 règles), modèles `TrainingSession`/`CoachingSession`/`AuditMission`/`TrainerAvailability`. Aucune lib graphique client — SVG/CSS Grid serveur, cohérent avec le budget perf.

## Phasage de correction proposé

1. **Vague fix P0/P1 techniques** (sans décision de Will) : libellés, dates, UUID, filtres cassés, `infra` hardcodé — un agent par lot de pages, aucun choix structurel.
2. **Décisions structurelles** (nécessitent l'avis de Will) : suppression de « Vue d'ensemble » dossiers, fusion Conformité/Mode auditeur, refonte du pôle Villes, redirection du module Booking mort.
3. **Construction du tableau de bord** selon la spec ci-dessus.
