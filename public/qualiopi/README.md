# Logo officiel Qualiopi — emplacement

Ce dossier accueille le **fichier logo officiel Qualiopi**, livré par l'organisme
certificateur dans le **kit de communication**, au moment de l'obtention de la
certification (et **pas avant** — l'usage du logo avant certification est
interdit).

## Procédure (jour de la certification)

1. Déposer ici le fichier logo officiel **non modifié** (ex. `qualiopi-logo.png`
   ou `.svg`), fourni par le certificateur. Ne **jamais** recolorer, déformer,
   recadrer ni recomposer le logo (règle d'usage de la marque). Conserver la
   version avec le bandeau « République française » / Marianne si elle est
   fournie.
2. Renseigner le chemin dans l'admin Qualiopi → config :
   clé `qualiopi_logo_path` = `/qualiopi/qualiopi-logo.png` (adapter au nom réel).
3. Le composant `QualiopiBadge` affichera alors le logo sur fond blanc, toujours
   accompagné de la mention obligatoire (catégorie(s) d'actions certifiées).

Tant que `qualiopi_logo_path` est vide, le badge affiche un libellé textuel
conforme (« Organisme de formation certifié Qualiopi ») — aucun logo n'est
inventé.

## Rappel d'usage (Ministère du Travail)

- Le logo est **toujours** accompagné de la mention : « La certification qualité
  a été délivrée au titre de la ou des catégories d'actions suivantes : … ».
- Affichage sur **fond blanc**, sans modification graphique.
- **Interdit** sur les attestations, certificats de réalisation et tout support
  lié exclusivement à une action de formation. Réservé à la **communication
  générale** (site, présentations, supports institutionnels).
