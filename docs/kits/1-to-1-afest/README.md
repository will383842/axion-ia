# Kit 1-to-1 AFEST — Axion-IA

Trames et grilles pour les accompagnements **1-to-1** (coaching individuel), cadrés en
**AFEST** (Action de Formation En Situation de Travail) — finançables Qualiopi/OPCO une
fois l'agrément en périmètre.

> **Esprit du 1-to-1** : on part de **la personne et de son travail réel**. Le but n'est
> **pas** de construire des automatisations le jour J, mais de **cartographier le
> fonctionnement actuel**, d'**identifier ce qu'on peut automatiser/optimiser** pour
> gagner du temps (et de l'argent), et de repartir avec un **plan personnalisé**.

## Contenu du kit → rayons de la console « Documents interventions »

| Fichier                                        | Rayon (slot) console                     | Public visé                                      |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `01-trame-journee-collaborateur.md`            | `guide_coach` (Cadre & objectifs)        | Coach — version **Collaborateur** (tous métiers) |
| `02-trame-journee-dirigeant.md`                | `guide_coach` (Cadre & objectifs)        | Coach — version **Dirigeant**                    |
| `03-grille-cartographie-analyse-activite.md`   | `analyse_activite` (Cadre & objectifs)   | Coach + bénéficiaire                             |
| `04-grille-optimisations.md`                   | `analyse_activite` / `plan_optimisation` | Coach + bénéficiaire                             |
| `05-plan-optimisation-personnalise.md`         | `plan_optimisation` (bénéficiaire)       | Bénéficiaire (livrable)                          |
| `06-guide-coach-phases-reflexives.md`          | `phase_reflexive` (Documents coach)      | Coach                                            |
| `07-convention-afest-contrat-objectifs.md`     | `cadrage_objectifs` (Cadre & objectifs)  | Organisme + entreprise + bénéficiaire            |
| `08-trame-compte-rendu-seance.md`              | `cr_seance` (Documents coach)            | Coach                                            |
| `09-journal-progression-plan-inter-seances.md` | `journal_progression` (Suivi)            | Coach + bénéficiaire (surtout Suivi régulier)    |

Les `.docx` prêts à déposer sont générés depuis ces `.md` via
`node scripts/md-to-docx.cjs docs/kits/1-to-1-afest <dossier-sortie>`.

## Couverture des 15 rayons 1-to-1

- **Modèles fournis ci-dessus (9)** : couvrent les rayons réutilisables (cadrage, analyse
  d'activité, guide/trame coach, phase réflexive, parcours, plan, compte-rendu, journal).
- **Générés par le Formation Engine (5)** : `positionnement_individuel`, `evaluation_progression`,
  `satisfaction_1to1`, `attestation_emargement` (+ instances de positionnement) — vraies
  données, QR, rétention 5 ans. Pas d'upload manuel.
- **Créés par bénéficiaire pendant la séance (3)** : `fiches_exercices`, `ressources_perso`,
  `corriges_1to1` — propres à la personne accompagnée, non pré-templatables.

## Déposer dans la console

Documents interventions → **1 to 1** → **Dirigeant** ou **Collaborateur · Optimisation du
poste** → déposer la source (`.docx`) dans le rayon correspondant → **Publier**. La même
trame couvre les formats **1 jour** et **2 jours** (le 2ᵉ jour = mises en situation et
optimisations plus poussées).

## Note AFEST / Qualiopi

Ces documents posent le cadre AFEST (analyse de l'activité, mises en situation, phases
réflexives). Le **positionnement**, l'**émargement** et l'**attestation** sont **générés
par le Formation Engine** (rayon Évaluation & qualité). ⚠️ Le financement OPCO effectif
suppose que l'agrément Qualiopi couvre le 1-to-1 / l'AFEST — à confirmer au certificateur.
