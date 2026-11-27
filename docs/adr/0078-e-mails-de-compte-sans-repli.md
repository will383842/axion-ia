# ADR 0078 — E-mails de changement de compte bancaire : aucun `gabaritRepli`

- **Statut** : proposé — livré avec le lot 2 du plan « changement de compte bancaire »
- **Date** : 2026-11-27
- **Référence** : `docs/plans/apporteurs-changement-iban-2026-11-25.md` (section 6.1) ; `AGENTS.md` (règle `gabaritRepli`) ; `src/lib/email/templates/apporteur-compte.tsx`

## 1. Contexte

`AGENTS.md` demande qu'un nouveau nom de gabarit porte, dans sa charge, un `gabaritRepli` :
le nom d'un gabarit ancien et sûr, pour un worker plus ancien que le gabarit.

## 2. Décision

Les cinq gabarits `apporteur-compte-*` n'ont **pas** de repli.

- Un repli doit être connu du worker ancien. Un gabarit « neutre » créé dans ce lot ne l'est pas.
- Parmi les gabarits existants, aucun ne dit vrai à la place d'une alerte de sécurité.
  Le seul neutre, `apporteur-lien-espace`, redonne le lien personnel : c'est ce qu'un e-mail
  de sécurité ne doit jamais faire. « Dossier bien reçu » à la place de « Confirmez votre
  changement de compte » serait trompeur.
- Sans repli, le pire cas est sûr : le worker reporte 90 minutes puis échoue franchement.
  L'avis n'est pas marqué envoyé, la demande ne peut pas être validée, elle expire à 24 heures.
  Personne ne reçoit un texte faux et l'argent ne bouge pas.

## 3. Protections qui remplacent le repli

1. Ordre de mise en ligne : ce lot en ligne sur le worker, vérifié par son contenu, un
   créneau avant le lot 4 (premier émetteur).
2. L'émetteur (lot 4) refuse d'émettre si l'interrupteur est éteint.
3. Test `apporteur-compte.spec.tsx` : le gabarit ne contient aucun `gabaritRepli` et cite
   la section 6.1 du plan, pour qu'une session future ne « corrige » pas ce choix.
   **Limite connue** : ce test ne lit que le fichier du gabarit. Un `gabaritRepli` se poserait
   dans la charge, chez l'émetteur (`envois.ts`) : le lot 4 doit étendre ce verrou à ce fichier.

## 4. Autres règles verrouillées par le lot

- Jamais d'IBAN entier : le gabarit ramène toute fin de compte à 4 caractères et retire
  d'un motif libre toute suite qui a la forme d'un IBAN.
- Aucun lien personnel de l'espace dans le rendu, même si la charge porte `lienEspace` :
  `GABARITS_SANS_LIEN_ESPACE` (`templates/index.tsx`) coupe le bouton et « Lien perdu ? ».
- E-mail 1 : sans `lienConfirmer` et `lienBloquer` valides (https, origine du site, chemin
  `/apporteur/dossier/compte/<id>/<signature>`), le rendu lève : l'e-mail ne part pas.
- Trois objets (« demande bloquée », « refusée », « annulée ») dépassent les 45 caractères du
  référentiel : textes validés mot pour mot, dérogation écrite dans `familles-email.spec.tsx`.
