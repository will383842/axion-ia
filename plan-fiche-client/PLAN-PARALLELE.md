# PLAN PARALLÈLE — refonte de la fiche client (console) + CRM Pro — 29/10/2026, 20 h 30

Inventaire : `INVENTAIRE-DEJA-CONSTRUIT.md`. Un fichier `LOT-*.md` par routine cloud : il est AUTONOME (règles communes recopiées à la fin de chaque lot console). Coller le fichier entier comme consigne de la routine (Sonnet, dépôt indiqué, sans connecteurs, partant d'origin/main). Une routine = une PR. La session pilote fusionne et décide des mises en ligne.

## Principe anti-conflit
1. `page.tsx` de la fiche n'est modifiée QU'UNE FOIS, par le lot 0 (SOCLE) : il pose 11 emplacements nommés (`EMPLACEMENT:<NOM>`), chacun délégué à un fichier neuf de `src/components/admin/dossier-client/fiche/`, importé par UN module `fiche/emplacements.ts`. Une garde (`les-emplacements-sont-poses.spec.ts`) échoue si un lot touche la page.
2. Chaque fichier existant modifié a UN propriétaire (colonne « Fichiers existants modifiés »). Tout le reste est neuf.
3. Les fichiers partagés sensibles ont un seul lot : RGPD (A1), schéma Prisma (C3), synchro (C1), `Onglets.tsx` (A3, fonction `OngletEchanges` seulement).
4. Les tests de la page simulent `fiche/emplacements` (lot 0) : un lot qui remplit son emplacement ne casse pas les tests des autres.

## Tableau des lots
| Lot | Objet | Part quand | Dépend de (fusionné) | Fusion autorisée quand | Fichiers existants modifiés (propriétaire unique) | Relecture | Risque de conflit |
|---|---|---|---|---|---|---|---|
| A1 RGPD | export art. 15 + effacement art. 17 des 4 tables | MAINTENANT | — | tout de suite | `src/lib/rgpd-erase.ts`, `src/lib/rgpd-dossier-client.ts`, `tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts` | Opus + auditeur RGPD | faible (#1694 touche `rgpd-erase.ts` l.1132, loin) |
| A2 MODIFIER | formulaire complet | MAINTENANT | — | tout de suite | `ClientEditForm.tsx`, `src/server/actions/qualiopi/clients.ts`, `clients/[id]/edit/page.tsx`, select de `getClient` | Opus 1 tour | nul |
| A3 RENDEZ-VOUS | type, objet, compte rendu à relire | MAINTENANT | — | tout de suite | `FDC/queries.ts` (`lireRencontresDuClient` seul), `DC/Onglets.tsx` (`OngletEchanges` seul) | Opus allégé | nul |
| A4 CRM-TÂCHES | tâches CRM + étiquettes (dépôt CRM) | MAINTENANT | — | tout de suite | `CompanyDetailPage.tsx` (ancre après `EvenementsCard`), `backend/routes/api.php` | Opus 1 tour | faible avec C2 (ancres distinctes) |
| 0 SOCLE | emplacements, `Frise`, `htEtTtc` | dès #1695 ET #1694 fusionnées | #1694, #1695 | tout de suite | `FICHE` + ses 6 tests | Opus 1 tour | aucun après lui |
| B1 EN-TÊTE | prochaine action, 4 tuiles, frise, compteurs | après 0 | 0 | tout de suite | `fiche/EnTeteFiche.tsx`, `fiche/compteurs-onglets.ts` | Opus (montants) | nul |
| B2 ACTIVITÉ | chronologie filtrée + e-mails | après 0 | 0 | tout de suite | `fiche/OngletActivite.tsx`, `DC/FilDesEchanges.tsx` | Opus 1 tour | nul |
| B5 PERSONNES | carte de décision, départ | après 0 | 0 | tout de suite | `fiche/PersonnesDecision.tsx`, `fiche/ActionsDeLaPersonne.tsx` | Opus 1 tour | nul |
| B7 DEVIS-FACTURES | HT/TTC, déjà facturé, partiel | après 0 | 0 | tout de suite | `fiche/OngletDevisFactures.tsx` | Opus + auditeur argent | nul (garde l'élément `RelanceDevis`) |
| B9 RELANCE-DEVIS | brouillon garé à valider | après 0 | 0 | tout de suite | `fiche/RelanceDevis.tsx` + registre des gabarits d'outbox | Opus + auditeur | faible avec B10 (registre : 1 ligne chacun) |
| B10 QUESTIONNAIRE | phrase + relance de l'équipe par le dirigeant | après 0 | 0 | tout de suite | `fiche/QuestionnaireEnBref.tsx` + registre des gabarits | Opus | idem B9 |
| B3 TÂCHES | écrivain `client_taches` | après 0 + A1 | 0, A1 | prod sert #1732 (après 22 h) | `fiche/ResumeTaches.tsx` | Opus 1 tour | nul |
| B4 NOTES | écrivain `client_notes` chiffrées | après 0 + A1 | 0, A1 | prod sert #1732 | `fiche/ResumeNotes.tsx` | Opus obligatoire | nul |
| B6 PROFIL-ARCHIVAGE | responsable, étiquettes, archivage | après 0 + A1 + A2 | 0, A1, A2 | prod sert #1732 | `fiche/ProfilDeLaFiche.tsx` (créé par A2), `fiche/ArchivageFiche.tsx`, `qualiopi/clients/page.tsx` | Opus obligatoire | nul |
| B8 PIPELINE | chances, clôture, pondéré, frise 4 étapes | après 0 (#1694 inclus) | 0, #1694 | prod sert #1732 | `DC/SuiviPrestations.tsx`, `FDC/actions-prestations.ts`, `FDC/suivi-prestations.ts`, `fiche/ResumePrestations.tsx` | Opus (montants) | nul |
| C2 CRM-REÇU | carte « Reçu de la console » (dépôt CRM) | après #379 fusionnée | #379 | tout de suite | `CompanyDetailPage.tsx` (ancre en haut de l'`aside`), `CompaniesController::show` | Opus 1 tour | faible avec A4 |
| C3 RÔLES | influence, bloque (migration d'énumération) | après B5 | B5 | créneau sans autre migration | `prisma/schema.prisma`, `FDC/libelles.ts` | Opus obligatoire | nul |
| C1 SYNCHRO | nouvelles clés vers le CRM | après B1, B3, B6, B8 (+ C3 si voulu) | ces lots + #379 DÉPLOYÉE et essayée | prod sert #1732 ; jamais dans les 50 min d'un déploiement | `src/server/crm-sync/instantane-dossier.ts`, `lire-dossier.ts` | Opus + auditeur sécurité | nul |

Charge totale estimée : ~17 jours d'agent, répartis en 4 vagues.

## Vagues
- **Vague 1 (MAINTENANT, 4 routines en parallèle)** : A1, A2, A3, A4. Aucune ne touche la page.
- **Pendant la vague 1 (session pilote, pas une routine)** : finir #1694 (CI « Gate A · couverture » rouge : ajouter les tests qui manquent), fusionner #1695, rebaser puis fusionner #1694 (conflit attendu sur les imports de `page.tsx`, l.36-40 : garder les deux blocs). Faire fusionner CRM #379 quand sa CI est verte, la déployer côté CRM et essayer la route avec un dossier d'essai.
- **Vague 2 (dès 0 fusionné ; lancer 0 juste après #1694)** : B1, B2, B5, B7, B9, B10 en parallèle (6 routines). Aucune n'écrit dans les tables de #1732.
- **Vague 3 (dès A1 fusionné ; fusion après 22 h, quand la prod sert #1732)** : B3, B4, B6, B8 (+ C2 dès #379 fusionnée).
- **Vague 4** : C3 puis C1 (synchro), en dernier.

## Fusion et mise en ligne (session pilote)
- Ordre de fusion conseillé : A1, A2, A3, 0, B1, B2, B7, B5, B9, B10, B3, B4, B6, B8, C3, C1. Chaque PR repasse sa CI après rebase (file GitHub saturée : fusionner par lots, un seul déploiement groupé par créneau).
- Savoir si la prod sert #1732 : lire l'en-tête `x-axion-build-sha` de https://axion-ia.com/fr (curl -sI), puis vérifier que `e26a587c4` en est un ancêtre (git merge-base --is-ancestor).
- C1 touche du code lu par le WORKER (~50 min d'avance sur l'app) : fusionner hors des 50 minutes qui suivent un déploiement, et seulement après la mise en ligne de C3 si C1 envoie les rôles influence et bloque.
- Après C1 en ligne : essai sur la fiche de TEST, puis seulement ouverture de l'étape « client » côté CRM (`CRM_SYNC_DOSSIER_CLIENT_STAGE`), décision déjà donnée par Will.

## Rebase des routines
Chaque routine fait git fetch puis git rebase sur origin/main juste avant de pousser. Conflit dans SES fichiers : elle le résout. Conflit ailleurs : abandon du rebase, push de la branche telle quelle, « CONFLIT : … » en tête de la PR ; la session pilote rebase à la fusion. Conflits prévisibles : B9 et B10 sur le registre des gabarits d'outbox (une ligne chacun, trivial) ; A4 et C2 sur `CompanyDetailPage.tsx` (ancres séparées) ; #1694 et #1695 sur `page.tsx` (avant le lot 0).

## Relecture
Opus obligatoire + auditeur : A1 (RGPD), B7 (argent), B9 (e-mail au client), C1 (synchro). Opus obligatoire : B1, B4, B6, B8, B10, C3. Opus 1 tour : 0, A2, B2, B3, B5, A4, C2. Opus allégé : A3.

## Risques principaux
1. **Synchro arrêtée en silence** : une clé envoyée par la console avant que le CRM ne la connaisse donne 422 puis `gave_up`. Parade : C1 en dernier, prérequis vérifiés et collés dans la PR (#379 déployée + essai).
2. **Écrivain avant la table** : B3, B4, B6, B8 écrivent dans les tables ou colonnes de #1732, pas encore en ligne. Parade : fusion seulement quand la prod descend de `e26a587c4` ; A1 fusionné avant (sinon la garde RGPD rougit).
3. **Chaîne #1694 puis lot 0** : #1694 a sa CI rouge depuis le 26/10 et sa session propriétaire est inconnue ; tant qu'elle n'est pas fusionnée, la vague 2 ne part pas. Parade : la session pilote la reprend tout de suite ; à défaut, fusionner #1695 seule, lancer le lot 0 sans #1694, et B8 attend #1694.
4. Autres : un lot qui ENVOIE un e-mail au lieu de le garer (B9, B10 : tests d'espion exigés) ; montants HT/TTC faux (B1, B7, B8 : auditeur) ; poids (`pnpm bundle:check` bloque : Server Components seulement) ; `retirerEtiquette` (B6) est le seul `delete` du chantier (un libellé de classement, pas une donnée client).
