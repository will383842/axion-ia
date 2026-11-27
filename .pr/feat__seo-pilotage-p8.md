Écran « Pilotage SEO & IA » dans la console, en lecture seule

## Ce que fait la PR

Ajoute l'écran `content-gen/pilotage` (P8 du cahier « pilotage SEO/GEO »), en mode observation :

- 5 onglets : Vue d'ensemble (28 jours contre les 28 jours d'avant, par type de page, « Données jusqu'au JJ/MM », état de la source), Pages (filtre par type), Requêtes (intention, page qui répond, concurrence entre pages), Opportunités (signalements « à décider par une personne » à part), Santé des données (derniers imports, erreurs).
- Lecture seule : aucune écriture, aucun appel à un fournisseur. Lectures dans `src/server/seo-pilotage/ecran/` (calculs purs + lecture Prisma), action dans `src/server/actions/content-gen/pilotage.ts`.
- Éteint par défaut : sans `CONTENT_PILOTAGE_SEO=true` exact, l'écran affiche « Pilotage éteint » et ne lit rien.
- Une donnée absente ou une lecture en échec s'écrit « indisponible », jamais 0 (position et part de clics nulles sans affichage).
- Requêtes rares (moins de 3 affichages) masquées, par prudence sur les données personnelles.
- Accès : `gardePage("ecriture")` puis refus nommé hors super_admin, admin et editor (le texte brut des requêtes n'est pas montré aux rôles de simple consultation) ; l'action revérifie par `requireAdmin`.
- Les évolutions sur 28 jours ne sont calculées que si les deux fenêtres sont complètes (jours importés comptés) ; sinon « indisponible » et un avertissement. Requêtes lues dans le détail journalier récent ; filtre par type appliqué en base.
- Entrée de menu « Pilotage SEO & IA » (+ test de compte du menu : 184) et lien depuis « Suivi des positions ».

Limites assumées : le score de citabilité n'est pas stocké en base (P12 est un module pur) : la colonne dit « pas encore mesurée ». L'onglet Opportunités lit la table `seo_opportunites` ; aucune tâche ne l'alimente encore, il affiche donc « aucune opportunité » tant que ce calcul hebdomadaire n'est pas branché. Les onglets Propositions, En mesure et Moteurs IA viennent avec leurs PR. Aucune migration.

## Base

`main`, à ouvrir après la fusion de P4 (branche créée depuis `feat/seo-pilotage-p4-robot`, `main` fusionné dedans).

## Tests

- Vitest : vue d'ensemble, sources, requêtes, lecture (éteint, « indisponible », section en panne), rendu de l'écran (éteint, indisponible sans zéro, onglets, signalements à part, pas de « Grenoble »), accès admin, verrou d'absence d'import de `seo-pilotage` depuis `src/components` hors console et pages publiques.
- `pnpm typecheck`, `pnpm lint` (0 erreur), `content-gen:isolation-check`, `image-bank:isolation-check`, `admin-gardes:check`, `prettier --check` : verts.
- `bundle:check` non mesuré ici (pas de build dans cet environnement) : l'écran est en composants serveur, sans JavaScript client ajouté ; à lire dans l'étape « Poids du bundle » de la CI (bucket admin, cliquet 470 KB).

VERDICT OPUS : À CORRIGER (3 tours faits ; les deux points du tour 3 — lecture de 120 imports et refus nommé hors admin/éditeur — sont corrigés après coup, avec tests, mais non revus)
