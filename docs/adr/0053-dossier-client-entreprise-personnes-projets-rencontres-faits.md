# ADR 0053 — Dossier client : entreprise, personnes, projets, rencontres, faits avec provenance

- **Statut** : **ACCEPTÉ** (A2, A3 et A4 tranchés par Will le 28/09/2026 ; B18 : recommandation du plan retenue, « une fiche par client, l'anti-doublon à la création, la fusion en filet »).
- **Date** : 2026-09-29
- **Auteur** : Will + Claude (chantier « enregistrement des visios »)
- **Référence** : `prisma/schema.prisma` (`Client`, `CalendlyEvent`, `RendezVousSuivi`, `Devis`) ; `src/features/personne/fiche-personne.ts` ; `src/features/admin-calendly/acces.ts` ; ADR 0054 (enregistrement), 0055 (transcription et compte rendu), 0056 (consentement et conservation), 0057 (pré-remplissage), 0058 (poids de la console).

## Contexte

La fiche client de la console (`Client`) est une ligne plate : une société, **un** contact et trois champs libres (`contexteIa`, `besoinsIdentifies`, `notes`).

Aucun lien n'existe entre `Client` et les rendez-vous Calendly, et le projet n'existe pas en tant qu'objet. Un client qui revient plusieurs fois, avec plusieurs projets, n'a nulle part où ranger ce qu'il a dit, projet par projet.

Will veut que les comptes rendus de ses visioconférences (ADR 0054 et 0055) alimentent **cette** fiche, sans que les informations de deux projets ne se mélangent jamais, et sans que rien ne soit rangé chez un client sans son accord.

## Décision

1. **`Client` reste inchangée** : aucune colonne ajoutée. `Client.contact*` devient la copie du contact de facturation, écrite **uniquement** par `definirContactFacturation`.
2. **Tables nouvelles** (posées par une seule migration additive, PR `schema` du chantier) : `ClientContact`, `ClientContactAdresse`, `Projet`, `ProjetEvenement`, `ProjetContact`, `ProjetDevis`, `ClientFusion` et `ClientFusionElement`, `ClientTestInterne`, `Rencontre`, `RencontreParticipant`, `RencontreRattachementEvenement`, `RencontreSuivi`, `CalendlyReport`, `QuestionnaireCadrage`, `QuestionnaireQuestion`, `EmailSuivi`, `CompteRendu`, `Fait`, `FaitEvenement`, `PreRemplissage`, et les tables techniques `AlerteVisio`, `BattementCircuit`, `EffacementJournal`. Le modèle s'appelle **`Rencontre`** et non `Echange`, parce que « échange » désigne déjà le rendez-vous apporteur dans le code.
3. **`ClientContact` n'est pas une table « personne »** : c'est une **relation** personne ↔ entreprise ↔ rôle. L'identité reste l'empreinte d'adresse (`hashEmailForLookup`), portée par `ClientContactAdresse`, qui accepte plusieurs adresses. La doctrine de `fiche-personne.ts` est respectée : pas de troisième vérité sur l'identité.
4. **Un fait = une information, une provenance, un rattachement.**
   - Le contenu du fait est **immuable** (trigger). L'effacement RGPD passe par un drapeau de session que seul `src/lib/rgpd-erase.ts` peut poser.
   - Portée explicite : `entreprise`, `projet` ou `a_ranger`. Un fait `a_ranger` n'est pas validable.
   - Le fait porte un état de **suivi** (`ouvert`, `tenu`, `repondu`, `leve`, `abandonne`, `a_reconfirmer`), une **relation** vers un fait antérieur et, une fois la correspondance des voix validée, son **locuteur nominatif**.
5. **« Même client » est tenu par la base** : clés étrangères composées vers `projets(id, client_id)`, `client_contacts(id, client_id)` et `devis(id, client_id)` (l'index unique sur `devis` est un index, pas une colonne) ; CHECK `projet_id IS NULL OR client_id IS NOT NULL` ; trigger différé « un fait appartient au client de sa rencontre ».
6. **La synthèse est calculée** par une fonction pure (`consoliderFaits`) : une valeur courante par `(type, clé)` et par portée ; « à trancher » dès que deux valeurs validées diffèrent ; jamais de comparaison entre la portée entreprise et la portée projet ; un fait sans valeur n'est jamais la valeur courante ; les faits d'avant une réouverture de projet sont « à reconfirmer ».
7. **L'IA propose, Will valide (A4).** **Aucun rattachement automatique** : un rendez-vous est **proposé** chez un client, Will valide en un clic. Motifs de proposition : `email_calendly`, `contact_connu`, `domaine_email` (hors `DOMAINES_WEBMAIL`), `entreprise_declaree`, `demande_liee`, `report`, `choix_extension`, `contenu_compte_rendu`.
8. **Corrections journalisées** : déplacer une rencontre ou un fait (une transaction) ; fusionner deux fiches, deux projets ou deux rencontres. Lors d'une fusion de fiches, les pièces émises restent sur la fiche absorbée, en lecture seule.
   - **Fusion de fiches déclenchée par Will, journalisée, réversible (A3)** : « Défaire la fusion » rend exactement ce que `client_fusion_elements` a enregistré, rétablit le SIREN d'origine de la fiche absorbée, et garde la ligne de journal (`defaite_le`). Une seule fusion vivante par fiche absorbée (index partiel, avec garde de dérive du SQL brut).
   - Axion Partners rattache l'apporteur au **SIREN**, pas à la fiche. La fusion est donc **autorisée** si les deux fiches ont le même SIREN, aucun, ou un seul (report du SIREN proposé) ; **refusée toujours** si les deux SIREN diffèrent. Un événement `client.fusionne` est préparé sans être émis, et rejoué depuis `client_fusions` le jour où le contrat de Partners le portera ; une fusion défaite n'est jamais rejouée. Par prudence, tant que Partners n'a pas confirmé qu'aucun calcul n'utilise l'identifiant de fiche, la fusion « un SIREN d'un côté, rien de l'autre » est refusée si une facture existe sur la fiche sans SIREN.
9. **Accès (A2)** : une liste unique `ROLES_DOSSIER_ECHANGES = ["super_admin", "admin"]`. Seuls ces rôles lisent comptes rendus, transcriptions et citations ; pour `editor`, `responsable_qualite`, `secretaire` et `reader`, les onglets concernés ne sont **ni rendus ni requêtés**. Régime FILTRE par onglet sur la fiche 360°, REFUS ailleurs ; garde dérivée des modèles annotés `/// rgpd: dossier-client`.
10. **Numéro de projet** : `AXI-PRJ-AAAA-NNN`, série millésimée, **hors** `DOCUMENT_NUMBER_REGEX` : un projet n'est pas une pièce officielle.
11. **Purge des 36 mois de `calendly_events`** : le statut et l'issue sont figés dans `Rencontre` avant la suppression (CHECK `source <> 'calendly' OR calendly_event_id IS NULL OR statut IS NULL`).
12. Le circuit n'écrit **jamais** `Client.notes`, `contexteIa`, `besoinsIdentifies`, ni `calendly_events.status`. Aucune table du dossier n'est lue par `crm-sync` ni par le serveur MCP (gardes).
13. **Le suivi appartient à la rencontre**, pas au rendez-vous Calendly : `RencontreSuivi` (issue, suite, échéance) devient l'autorité. `RendezVousSuivi` reste écrit par recopie, dans la même transaction, par une fonction unique `enregistrerSuivi()`, tant que le lien Calendly vit.
14. **Une rencontre peut naître dans la console** (`source = saisie_manuelle`), **seulement sur une fiche client existante et validée** (CHECK). C'est ainsi qu'entrent les rendez-vous suivants d'un client et la rencontre de test du pilote. Aucun enregistrement ad hoc depuis l'extension.
15. **Le questionnaire de cadrage est une donnée du projet** : `QuestionnaireCadrage` (versionné par projet) et `QuestionnaireQuestion` (question chiffrée, fait qui l'a motivée, réponse chiffrée). Un fait issu d'une réponse porte `questionnaireQuestionId` (CHECK + FK RESTRICT).
16. **L'historique n'entre pas par le balayage** : le balayage ne crée des rencontres qu'après la date d'allumage de son drapeau. L'historique passe par un script unique, idempotent, qui marque `repriseHistorique` (exclu des alertes).
17. **Projets créés au bon moment** : « Créer ce projet » (depuis « Après l'appel ») et « Nouveau projet » (depuis la fiche) créent le projet et rangent les faits cochés **dans la même transaction**.
18. **Participants** : `assurerRencontrePourCalendly` crée les participants (titulaire, invités, Williams) ; la fiche prospect crée le `ClientContact` du titulaire. La correspondance des voix est validée par Will avant tout « Valider tous ».
19. **Vocabulaire ajouté** : `FaitType.mise_en_relation` (« recommandé par… », validé un par un, jamais envoyé à Partners par ce chantier) ; `ClientContact.oppositionIaLe` (art. 21) ; `CompteRenduStatut.a_regenerer` (effacement ciblé). Chaque valeur est définie par un commentaire `///` dans le schéma.
20. **Où vivent les écrans** : sous l'onglet `[adminPrefix]/rendez-vous/…` et sous la fiche client ; aucune nouvelle entrée de menu épinglée.
21. **Un client = une fiche : l'anti-doublon à la création (B18).** Une **porte unique**, `creerOuRetrouverClient`, par laquelle passent `definirContactFacturation`, la création de prospect et la fusion. Avant toute création, `trouverFichesProches` cherche : même SIREN (**bloquant**), même e-mail (motif obligatoire pour créer quand même), même domaine professionnel hors webmails, nom normalisé + même ville (propositions). Une personne de plus devient un `ClientContact` de la fiche existante. Le SIREN est dérivé du SIRET, ou proposé depuis l'annuaire public à partir du nom et de la ville, et confirmé d'un clic. En base : index `clients(siren)` et verrou consultatif par SIREN dans la transaction de création ; **pas** de contrainte `UNIQUE` (une fiche absorbée garde son SIREN) ; la règle « un seul SIREN parmi les fiches non absorbées » est prouvée par un test d'intégration.

## Conséquences

- **Positives** : plusieurs projets par client sans mélange possible, garanti par la base. Historique complet, sans écrasement. Le dossier est utile dès sa mise en ligne, sans aucun enregistrement. Rien de ce que lisent les factures, les devis ou le worker ne change.
- **Négatives** :
  - une vingtaine de tables, du SQL brut (CHECK, clés composées, triggers) et des gardes de plus en Gate D ;
  - Will doit valider les faits ; le coût de ce geste est borné par l'écran unique « Après l'appel » (6 à 8 clics) ;
  - la fusion de fiches introduit une règle nouvelle, qui s'écarte de « rapprocher, jamais fusionner » : cette règle visait la séparation apporteurs / candidats, pas les doublons d'une même société.

## Alternatives écartées

- Des colonnes sur `Client` : cela casse la règle « table dédiée » et ne permet ni plusieurs contacts ni plusieurs projets.
- Une synthèse stockée : elle finit par dériver des faits qu'elle résume.
- Un projet porté seulement par la rencontre : cela échoue dès qu'un rendez-vous parle de deux projets.
- Rattacher `Client` à `ProspectionCompany` : c'est un référentiel d'entreprises local, refusé.
- Le rattachement automatique d'un rendez-vous à une fiche : l'adresse d'un invité Calendly n'est pas vérifiée (A4).

## Ce que cet ADR ne décide pas

Les durées de conservation (ADR 0056). Le pré-remplissage (ADR 0057). Le poids de la console (ADR 0058). La fiche client comme pièce Qualiopi (B13, phase 2).

## Annexe — correspondance des identifiants de décision

Seules les lettres de la liste des décisions de Will font foi (A0 à A11, B1 à B20). Correspondance avec les anciens identifiants des brouillons : A1 = D1 + D14 ; A2 = D12 ; A4 = D4 ; A5 = D9 ; B1 = D2 + D13 ; B2 = D3 ; B3 = D10 ; B4 = D11 ; B5 = D-U1 ; B6 = D-U3 ; B7 = D-U6 ; B8 = D-U4 + D-U5 ; B9 = D15 ; B12 = D7 ; B13 = D8. D5, D6 et D-U2 sont tranchés par le plan (plus de question).

## Amendement du 29/09/2026 — `AlerteVisio` est abandonnée (anti-doublon A3)

La table technique `alertes_visio` (modèle `AlerteVisio`, énumération `CategorieAlerteVisio`), posée par la migration du chantier, **n'est plus écrite**. L'audit anti-doublon du 29/09 a tranché : pas de table ni de service d'alerte parallèle. Les alertes du circuit passent par `AlerteSysteme` et `creerOuDedup` (`src/server/qualiopi/alertes/alertes-service.ts`), avec des codes `visio.*` déclarés dans `ALERTE_CATALOGUE` (guichet « direction », `resolutionAuto: false` : le balayage du circuit les ferme lui-même quand la cause disparaît).

La table reste en base, vide : aucune migration destructive. Sa suppression, si elle est décidée, se fera par une PR `schema` dédiée. Garde : `tests/unit/ci/la-table-alertes-visio-reste-vide.spec.ts` (aucun code de `src/` ne touche au modèle).
