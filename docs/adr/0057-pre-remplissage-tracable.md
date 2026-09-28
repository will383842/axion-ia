# ADR 0057 — Pré-remplissage traçable : devis, formation, fiche prospect, questionnaire de cadrage, e-mail de suivi

- **Statut** : **ACCEPTÉ** (B7, B8, B9 et B11 : recommandations du plan retenues le 28/09/2026).
- **Date** : 2026-09-29
- **Auteur** : Will + Claude (chantier « enregistrement des visios »)
- **Référence** : `src/server/actions/qualiopi/devis.ts` (`createDevisAction`, `reviseDevisAction`) ; formulaire de devis de la console ; `src/server/qualiopi/offres/pricing-resolver.ts` ; `src/server/qualiopi/offres/tarif-catalogue.ts` ; `prisma/schema.prisma` (`Questionnaire` Qualiopi) ; ADR 0053, 0055, 0056.

## Contexte

Les faits validés d'un rendez-vous (ADR 0053) décrivent ce que le client veut, pour combien de personnes, sous quel financement. Les ressaisir à la main dans un devis ou une formation fait perdre le bénéfice du compte rendu, et chaque ressaisie est une occasion d'erreur. Mais une case pré-remplie doit rester vérifiable : d'où vient cette valeur, et Will l'a-t-il gardée ?

## Décision

1. **`PreRemplissage`** trace chaque case pré-remplie : cible (`devis`, `formation`, `questionnaire_cadrage`, `client`, `email_suivi`), fait source, valeur proposée, valeur retenue (chiffrées) et sort (`garde`, `modifie`, `retire`). La trace est écrite **dans la transaction** de l'action de création. **L'enregistrement du devis vaut validation de l'ébauche.**
2. **Les prix viennent toujours du catalogue**, jamais de l'IA ni de la parole.
   - Trois types de tarif : `fixe` (pré-rempli), `plancher` (affiché « à partir de », jamais pré-rempli) et `sur_devis`.
   - Un lieu d'intervention en présentiel ajoute une ligne « Frais de déplacement : à chiffrer ».
   - **La TVA n'est jamais proposée** : le devis la fige lui-même.
3. `createDevisAction` et `reviseDevisAction` passent en `prisma.$transaction` **à l'intérieur** de `withNumberRetry` (devis, `ProjetDevis`, `PreRemplissage`). Une révision recopie le lien vers le projet.
4. Une valeur « à trancher », « à reconfirmer » ou « d'avant la réouverture » laisse la case **vide**, avec la mention.
5. La citation n'est affichée qu'aux rôles `ROLES_DOSSIER_ECHANGES`. Les autres rôles voient « pré-rempli depuis un rendez-vous ».
6. **Paliers `TIER:`** : le formulaire de devis apprend les paliers de tarif (B7).
7. **Fiche prospect depuis une rencontre** : un clic, par la porte unique `creerOuRetrouverClient` (ADR 0053 §21). SIREN proposé par l'annuaire public. `notes`, `contexteIa` et `besoinsIdentifies` ne sont jamais écrits.
8. **Formation sur mesure** : on duplique la formation liée à l'offre envisagée. `niveau`, `prerequis`, `secteurCible` et `outilsClient` sont proposés. `tarifHtCents` n'est jamais pré-rempli.
9. **Questionnaire de cadrage**, un modèle distinct du `Questionnaire` Qualiopi (qui exige un stagiaire inscrit). Il **ne remplace jamais** le positionnement.
   - V1 : **à copier** (B8). Construit à partir des faits **validés** et des questions `suivi = ouvert`, avec une liste fermée de types (jamais `objection`, `concurrent`, `budget` ni `prix_annonce_axion`), sans URL ni adresse e-mail, sans reprendre ce qu'a dit un collègue. Douze questions au plus.
   - Les réponses collées reviennent en faits `questionnaire_cadrage`, dont la citation est vérifiée **mot pour mot dans la réponse**, à valider ; le fait source passe `repondu` après validation.
   - Stockage (ADR 0053 §15) : `QuestionnaireCadrage` (statut `brouillon → copie → reponse_recue → clos`) et `QuestionnaireQuestion`. `PreRemplissage(cible = questionnaire_cadrage).cibleId` = `QuestionnaireCadrage.id`.
   - Rédaction et lecture des réponses par le **même** module OpenAI que le compte rendu (ADR 0055), coût tracé.
   - Mesure d'utilité : 2 scénarios × 3 exécutions, au moins 2 « utilisable tel quel » sur 3 par scénario.
   - V2 : formulaire en ligne rendu côté serveur (`mode = en_ligne`), hors de ce chantier.
10. **E-mail de suivi** : construit à partir des faits validés (en bref, engagements, prochaine étape), sans prix, sans TVA, sans rapporter les paroles d'un tiers, **toujours** mis en file avec `exigerValidation: true` : Will le relit avant qu'il parte.
    - **Destinataire** : un participant client **validé** de la rencontre, ou un autre contact de la même fiche choisi par Will ; jamais une adresse produite par l'IA.
    - **Trace** : `EmailSuivi` (rencontre, contact, `emailOutboxId`) ; le statut d'envoi se lit dans `email_outbox`.
    - **Exception assumée** : le texte de l'e-mail vit en clair dans `email_outbox.payload` jusqu'à la purge de cette table, comme tout e-mail sortant. Il ne contient jamais de citation.
    - Gabarit fixe en repli si la rédaction échoue ; rien vers MailWizz ni le CRM Pro.
11. **Mise en relation** : un fait `mise_en_relation` validé est proposé sur la ligne « Mise en relation par » du devis ; rien n'est envoyé à Axion Partners par ce chantier.
12. **Zone partagée** : ce chantier ne touche jamais `src/content/pricing.ts` (grille modifiée par Axion Partners) ; si Partners émet un événement à la création du devis, l'appel est conservé dans la transaction.

## Conséquences

- **Positives** : un devis juste en quelques clics ; une provenance vérifiable, case par case ; aucun prix inventé ; aucun e-mail ne part sans Will.
- **Négatives** : deux actions de devis réécrites (risque de régression maîtrisé par des tests de collision de numéro) ; un formulaire de devis à étendre.

## Alternatives écartées

- Un prix proposé par l'IA à partir de la conversation : un prix se lit dans le catalogue, jamais dans une parole.
- Réutiliser le `Questionnaire` Qualiopi : il exige un stagiaire inscrit et porte une valeur de preuve Qualiopi que ce questionnaire n'a pas.
- Envoyer l'e-mail de suivi sans validation : contraire à l'ordre permanent de Will.

## Ce que cet ADR ne décide pas

Le compte rendu comme pièce officielle Qualiopi (B13). Les relances automatiques des questionnaires en ligne (phase 2).
