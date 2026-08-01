# PLAN — Refonte console admin (validé Will 2026-08-01)

> Canonique : à committer dans `_PLANS/` avec la branche phase 1.
> Décisions Will : architecture 7 familles OK ; phase 1 = « À traiter » + pastilles + sidebar ;
> exigence : voir TOUT (en cours / terminé / à faire / alertes) — plan vérifié par inventaire exhaustif.

## Principe

Chaque écran répond à 3 questions : Qu'est-ce que je dois faire ? (À traiter) ·
Où en est chaque affaire ? (Dossiers, phase 2) · Est-ce que tout va bien ? (pastilles + alertes).
Règle d'or : les compteurs RÉUTILISENT les règles de l'évaluateur (jamais de logique dupliquée).

## Inventaire exhaustif des états (schéma réel, vérifié 08-01)

| Objet                      | Statuts                                                             | En cours              | Terminé                              | Déclenche « À traiter »                                                                                                   |
| -------------------------- | ------------------------------------------------------------------- | --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Devis                      | brouillon, envoye, accepte, refuse, expire, transforme_convention   | envoye                | accepte/refuse/expire/transformé     | 🔴 GAP A : envoye > N j sans réponse → relance (AUCUNE règle aujourd'hui — à créer)                                       |
| Signature pièce            | non_requise, en_attente, partielle, signee, refusee, expiree        | en_attente, partielle | signee                               | 🔴 GAP B : partielle = « à contresigner » (compteur live) ; en_attente > N j = relancer le client                         |
| Dossier financement (OPCO) | a_monter, envoye, accord_recu, refuse, facture, paiement_recu, clos | a_monter→facture      | clos                                 | règles existantes : sans réponse +30 j, paiement en retard                                                                |
| Session formation          | planifiee, en_cours, realisee, annulee, reportee                    | planifiee, en_cours   | realisee (→ soldée qd facture payée) | règles : sans formateur, bloquée, émargement/satisfaction/évaluation/attestation manquantes                               |
| Coaching 1-to-1            | planifiee, realisee, annulee, reportee                              | planifiee             | realisee                             | (couvert par émargement AFEST + protocole)                                                                                |
| Audit                      | planifiee, en_cours, realisee, annulee, reportee                    | idem sessions         | realisee                             | —                                                                                                                         |
| Facture                    | (FactureFormation) émise/payée                                      | émise                 | payée                                | règle : factures_impayees                                                                                                 |
| Booking (entrées)          | ~15 statuts V1 (option*pending, cadrage*\*, …)                      | option/cadrage        | won/lost/refused                     | pastille « Entrées » = count des statuts d'attente                                                                        |
| E-mails sortants           | en attente de validation                                            | —                     | envoyé                               | compterEnAttente() (existant)                                                                                             |
| Formateurs                 | pièces + vérifs                                                     | —                     | —                                    | règles : cv_perime, sous_traitants_qualiopi (NDA 12 mois), vigilance_urssaf (neuf 08-01)                                  |
| Organisme                  | —                                                                   | —                     | —                                    | règles : referent_handicap, responsable_qualite, qualiopi_expiration, bpf, veille, revue, bareme_opco, rgpd, réclamations |

25 règles d'évaluateur au total + 2 compteurs live (signatures, e-mails) + 2 règles à créer (GAP A devis, GAP B signature client en attente).

## Phase 1 (1-2 j) — « À traiter » + pastilles + sidebar

1. Page `À traiter` (accueil console) : 4 blocs — Signatures (partielle/en_attente, live) ·
   E-mails à valider (live) · Relances (devis GAP A, OPCO, impayés — depuis la table d'alertes) ·
   Alertes du matin (critique/important). Chaque ligne = lien direct + action.
2. Système de pastilles : un endpoint compteurs (léger, agrégats indexés) → badge par entrée + par famille de la sidebar.
3. Sidebar : 7 familles (À traiter · Dossiers & clients · Catalogue & vente · Intervenants ·
   Conformité Qualiopi · Finances · Réglages & suivi) — aucune page supprimée, redirections des anciennes URLs.
4. GAP A : règle `devis_sans_reponse` (envoye > 7 j) dans l'évaluateur (même gabarit que dossiers_financement).
5. GAP B : compteur signatures + règle `signature_client_en_attente` (en_attente > 7 j → relancer).

## Phase 2 — Vue Dossiers (pipeline)

Une ligne par affaire client. Statut DÉRIVÉ (aucune nouvelle entité) :
devis.envoye → « Devis envoyé » ; signature partielle → « À contresigner » ; session planifiee → « À préparer » ;
en_cours → « En cours » ; realisee & (facture impayée ou OPCO ≠ clos) → « À solder » ; payé+clos → « Soldé ».
Filtres : Formation | AFEST | Coaching | Audit | Implémentation | Web · badge « périmètre Qualiopi ».

## Phase 3 — Distinction Qualiopi / hors périmètre + archivage des terminés partout.
