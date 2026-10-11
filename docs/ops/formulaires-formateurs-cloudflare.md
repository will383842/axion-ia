# Formulaires du parcours formateur indépendant derrière Cloudflare (lot L5-bis)

- **Statut** : inventaire. **Aucune règle n'est déployée par ce document.**
- **Lot** : L5-bis du chantier « formateurs freelance » (ADR 0066).
- **Préalable de** : l'allumage de `formateurs.dossier_en_ligne` (écran Interrupteurs).

## Pourquoi

Une protection automatique de Cloudflare peut bloquer l'envoi d'un formulaire
public (un POST de Server Action ressemble, vu du pare-feu, à une requête
automatisée). L'exception en place pour les candidatures ne couvre que
`/postuler` et la candidature spontanée. Le parcours des formateurs ajoute
d'autres chemins publics qui reçoivent un envoi ; ils sont listés ici pour
qu'une exception soit rédigée **sur le même modèle**, puis posée **à la main**
par une personne habilitée, la veille de l'allumage.

Toute modification Cloudflare qui affaiblit une protection est un geste humain
(inscrit au registre des gestes humains). Ce document ne contient ni
l'expression de la règle, ni aucun réglage du pare-feu.

## Rappel : où une Server Action envoie-t-elle ?

Une Server Action déclenchée depuis une page part en `POST` **vers l'URL de la
page** qui porte le formulaire (en-tête `Next-Action`), pas vers une route
`/api`. L'exception doit donc couvrir le **chemin de la page**, préfixe de
langue compris quand la page en a un.

## Inventaire des chemins

| #     | Chemin (motif)                                                                    | Ce qui y est envoyé                                                                                                                                                                           | Existe aujourd'hui | Lot qui l'ouvre |
| ----- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------- |
| 1     | `/formateur/dossier/<id>/<jeton>`                                                 | les 4 étapes du dossier (« Vous », « Votre activité », « Vos documents », « Votre contrat ») : saisie, dépôt de pièces, déclarations, signature du contrat-cadre avec le code reçu par e-mail | non                | L5              |
| 2     | `/formateur/dossier/retrouver`                                                    | « Retrouver mon espace » : une adresse e-mail, réponse neutre                                                                                                                                 | non                | L5, L6 (F14)    |
| 3     | `/<langue>/espace-formateur`                                                      | signature de la lettre de mission et du contrat (espace connecté)                                                                                                                             | oui                | —               |
| 4     | `/<langue>/espace-formateur/connexion`                                            | demande du lien de connexion                                                                                                                                                                  | oui                | —               |
| 5     | `/<langue>/espace-formateur/mission/<jeton>`                                      | « J'accepte » / désistement d'une mission                                                                                                                                                     | oui                | —               |
| 6     | `/<langue>/espace-formateur/sessions/<id>`                                        | émargement, relevé de connexion, réponse à une mission                                                                                                                                        | oui                | —               |
| 6 bis | `/<langue>/espace-formateur/seances`                                              | création d'une séance d'accompagnement                                                                                                                                                        | oui                | —               |
| 7     | `/<langue>/espace-formateur/*` (pages à venir)                                    | dépôt de pièces et de factures, « Signaler un désaccord », demande de changement d'IBAN                                                                                                       | non                | L13, L13b       |
| 8     | `/<langue>/appel/formateur-independant`                                           | page de choix du créneau de l'échange (l'envoi de la réservation part vers `/<langue>/appel/reserver`, ligne 9)                                                                               | oui                | F-CAL-1         |
| 9     | `/<langue>/appel/reserver`, `/<langue>/appel/reporter`, `/<langue>/appel/annuler` | réservation, report et annulation d'un rendez-vous (communs à tous les types)                                                                                                                 | oui                | —               |
| 10    | `/<langue>/portail/signer/<jeton>`                                                | signature d'une pièce par lien (contrat d'une nouvelle version, organisme, mise à niveau ; sert aussi aux devis)                                                                              | oui                | S6, L7b         |

`<langue>` vaut aujourd'hui `fr` (l'anglais est redirigé vers le français, voir
`AGENTS.md`). Le dossier formateur, comme celui des apporteurs, vit **hors** du
préfixe de langue (`src/app/formateur/**`, calque de `src/app/apporteur/**`).

Les chemins 3 à 6 bis et 8 à 10 existent déjà et n'ont pas signalé de blocage à ce
jour ; ils sont listés pour que l'exception soit **complète** au moment où le
volume de formateurs augmente, et pour que l'essai en production les couvre.

## Ce qui reste hors de l'exception

- Les routes `/api/**` (téléchargements, webhooks) : elles ont leurs propres
  protections et ne reçoivent pas de formulaire public du parcours.
- La console d'administration : jamais concernée.

## Après la pose

1. Chaque chemin de l'inventaire est essayé **en production** avec le témoin
   interne (fiche du banc), et le résultat est noté (passé / bloqué).
2. La semaine suivante, les journaux de blocage de Cloudflare sont relus, en
   lecture seule ; un blocage d'un chemin du tableau ci-dessus rouvre ce lot.

## Maintenance

Tout lot qui ajoute une page publique portant un formulaire ou une Server
Action dans le parcours formateur ajoute sa ligne ici, dans la même PR.
