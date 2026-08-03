# Revue visuelle console — 2026-08-03

Prod au moment de la revue : PR #517 déployée, #518 en cours de build.
Viewport de revue : 1440 × 960. 12 vues parcourues.

Légende : 🔴 bloquant · 🟠 gênant · 🟡 finition · ✅ corrigé dans cette passe

---

## Deux causes racines, corrigées

### 1. `.admin-card` ne pose jamais `display` ✅

`.admin-card` (admin.css) pose padding, fond, bordure, ombre — pas `display`.
Sur un `<div>` ou un `<li>`, sans conséquence. Sur un `<a>` / `<Link>`, la
carte reste `display: inline` : le `padding: 16px` n'entre pas dans la mise en
page et **le fond de la carte se peint par-dessus le contenu voisin**.

Rendu réel sur `/image-bank/library` (60 vignettes) : la ligne de métadonnées
« ville · score 90 · publié » s'affichait « le · score 90 · publié ».

Le défaut avait déjà été rencontré et rustiné localement (`.admin-infra-card`
pose `display: block`, `InfraV2.tsx:74` ajoute `block` à la main) sans jamais
être nommé. Correctif : `a.admin-card-inline { display: block }` +
`admin-card-anchor-display.test.ts` (toute ancre `admin-card` doit poser un
`display`).

### 2. Le cliquet anti-emoji ne mesurait pas ce qu'il annonçait ✅

Il affichait **1**. Compte réel : **53**. Deux trous cumulés :

- sa plage de caractères sautait `U+2600`–`U+26FF`, soit le bloc des glyphes
  les plus employés de la console : ⚠ ⚙ ⛔ ⚪ ★ ⚖ ♻ (43 occurrences invisibles
  dans ses propres dossiers de scan) ;
- il ne scanne que `src/app/[locale]/(admin)` et `src/components/admin`. Or
  `QUALIOPI_POLE_LABELS` (`src/lib/admin-nav.ts`) affichait **6 emojis dans la
  barre latérale, donc sur CHAQUE page**, et `PERIMETRE_LABELS`
  (`src/server/qualiopi/perimetre.ts`) 2 de plus sur la page Dossiers.

À noter : `admin-nav.ts` justifiait ses emojis par « voulus par Will », un
commentaire écrit **avant** que Will ne tranche l'inverse le 2026-08-01
(lucide, jamais l'emoji). Le commentaire a survécu à la décision qui l'annulait.

Correctif : plage élargie, liste nominative des SSOT hors dossiers admin,
retrait des 8 emojis vus sur tous les écrans (remplacés par des icônes lucide
au niveau du composant, pas du module `lib`), plafond reposé à **45** —
valeur réellement mesurée. Reste à reprendre : ≈ 25 « ⚠ » de bandeaux, les
« ★ » des notes d'avis, les « ⛔ » des états bloqués.

---

## Par page

### /qualiopi/sessions
- 🟠 Colonne ACTIONS : 4 liens texte orange empilés sans encadrement.
  → couvert par #518, **à revérifier après déploiement**.
- 🟡 « 31/07/2026 ⟶ 31/07/2026 » : intervalle dégénéré sur une session d'un
  jour. Afficher la date une fois.
- 🟡 Aucune recherche, alors que la liste voisine (Clients) en a une.

### /qualiopi/clients
- 🔴 La colonne « ÉDITION BRANCHE » injecte un mini-formulaire (IDCC + Taille +
  OPCO + Enregistrer) **dans chaque ligne**. La liste n'est plus lisible comme
  liste. → panneau latéral ou ligne dépliable.
- 🟠 « INVEST SUN Éditer » : lien soudé à la raison sociale.
- 🟠 Deux boutons pleins terracotta concurrents (« + Nouveau client » /
  « Rechercher »). « Rechercher » doit être secondaire.

### /qualiopi/stagiaires
- 🟠 Colonne d'actions **sans en-tête** ; « Gérer » = lien souligné nu.
- 🟠 « CONSENT. » : une pastille verte seule, sans texte ni infobulle —
  invisible au lecteur d'écran, ambiguë à l'œil.
- 🟡 Sous-titre « le détail handicap est chiffré (AES-256-GCM) » : jargon
  d'implémentation exposé.

### /qualiopi/facturation (Hub)
- 🔴 Quatre boutons de même poids en tête, dont trois pleins terracotta.
  « Plans récurrents » et « FEC / Import » sont de la NAVIGATION, pas des
  actions : ils ne doivent pas être des boutons primaires.
- 🟠 Les 7 KPI (Émis / Encaissé / En retard / À échoir / 3 tranches de retard)
  sont posés en ligne sans carte ni séparation, collés aux boutons.
- 🟠 Deux styles pour deux actions de ligne (« Encaisser » encadré blanc,
  « Détail » teinté).
- 🟡 Bloc encadré « DOSSIERS DE FINANCEMENT EN COURS » vide.
- 🟡 En-tête de colonne « CANAL 2026 » : jargon.

### /devis
- 🟡 Colonne « ACTION » au singulier ; « ACTIONS » ailleurs.
- 🟠 **Trois emplacements différents pour la même action** selon la page :
  « + Nouveau X » est en haut à droite du titre (Sessions), sur la ligne de
  recherche (Clients), ou seul au-dessus des tuiles (Devis, Stagiaires).

### /qualiopi/facturation/plans (cible de /echeanciers)
- 🔴 Pas d'en-tête de page normalisé : « ← Retour au Hub facturation » est
  posé AU-DESSUS du titre, en lien souligné.
- 🟠 Le paragraphe sous les filtres répète le sous-titre presque mot pour mot.
- 🟠 « le cron » : jargon exposé.
- 🟠 État vide réduit à « Aucun plan récurrent. », sans encadrement ni appel
  à l'action.

### /planning/hub
- 🟠 « ← juillet » et « septembre → » : deux poids de bouton différents pour
  deux actions symétriques.
- 🟡 Le mois courant (« août 2026 ») est noyé en fin de paragraphe de
  description au lieu d'être entre les deux flèches.
- ✅ État vide bien formulé (« Rien à arbitrer… Un hub vide est le bon
  résultat »).

### /contacts/messages
- 🔴 La nav dit « Messages », le titre de page dit « Soumissions ».
- 🔴 « Aucun soumission pour ce filtre » — faute d'accord. **Systémique** :
  `AdminListScaffold` composait « Aucun » + le nom de l'élément fourni par la
  page, donc toutes les listes à nom féminin étaient fautives. ✅ corrigé au
  niveau du scaffold (« Aucun résultat pour ce filtre »).
- 🟠 Le compteur « 0 soumission · page 1/1 » est affiché **deux fois**, dans
  deux formats différents (deux implémentations d'en-tête).
- 🟠 Panneau de 7 filtres occupant 60 % de l'écran sur une page à 0 élément.
- 🟠 `<input type="date">` natifs (jj/mm/aaaa + icône Chrome) hors charte.

### /qualiopi/dossiers
- 🟠 La ligne répète le client deux fois : « INVEST SUN — IA pour l'immobilier
  — INVEST SUN (Saint-Étienne) ».
- ✅ Badges « ✅ Qualiopi » / « ⚙️ Hors périmètre » → emojis retirés.

### /qualiopi/indicateurs
- 🔴 Mise en page cassée : chaque indicateur est fait de trois blocs empilés
  non reliés (carte + ruban ambre pleine largeur SOUS la carte + paragraphe
  hors carte). Le ruban déborde de la carte qu'il qualifie.
- 🔴 Le ruban « en cours de constitution » s'affiche sur « Taux de complétion
  100 % » (valeur complète) mais pas sur « Délai d'accès moyen ». Le critère
  d'affichage est incohérent — à trancher.
- 🟠 Les paragraphes de méthode, de longueur inégale, désalignent la grille.
- 🟠 « Cache Redis 1 h » : jargon exposé.
- ✅ « ⚠ » du ruban remplacé par une icône lucide.

### /qualiopi/formateurs
- 🟠 Deux primaires : « Générer la liste (PDF) » et « + Nouveau formateur ».
- 🟠 « HABILITATIONS 57 » pour un formateur : nombre brut, sans accès au
  détail depuis la liste.
- 🟠 Colonne « VÉRIFIÉ » à « — » (cf. indicateur 21 : `verifiedAt` jamais
  renseignable).
- 🟡 « off.6/19 » dans le sous-titre : référence non explicitée.

### /site-explorer
- 🔴 **Palette hors charte** : 12 tuiles bleu / vert / ambre / rouge vifs.
  Seule page de la console à faire ça — rupture totale avec le papier
  terracotta.
- 🔴 « ❌ Routes API `/api/*` : non cataloguées — ❌ Server Actions : non
  cataloguées » : emojis + jargon développeur en clair.
- 🟠 6 `<select>` natifs au style navigateur + 3 cases à cocher nues, aucun à
  la charte admin ; libellés tronqués sous le chevron (« Indexable : tout »).
- 🟠 Trois pastilles colorées en tête de chaque ligne, sans légende.
- 🟠 « 29c · 85i · p2.6 » : abréviations non explicitées.
- 🟠 « 39 anomalies high » : anglicisme.

### /users
- 🔴 Colonne « 2FA » affichant « X » — caractère brut, sens indéterminé.
- 🟠 Badges « SUPER ADMIN » (bleu) et « ACTIF » (vert) hors charte.
- 🟠 Rôles en `snake_case` dans l'aide, en majuscules espacées dans le tableau.
- ✅ Renvoi « (CLAUDE.md §15) » retiré de l'écran.

### /settings
- 🔴 La colonne « VALEUR (JSON) » est faite de zones de texte à **barre de
  défilement interne** : 6 mini-fenêtres de code de 80 px de haut.
- 🔴 `legal_overrides` expose **IBAN et BIC en clair** dans la liste.
- 🟠 « Settings centralisés » (anglicisme) sous un titre « Paramètres » ;
  « Tarifs HT en cents ».
- 🟠 Les clés techniques (`pricing.audit.flash`) occupent la colonne
  principale, la description lisible est en troisième position.

### /image-bank/library
- 🔴 Métadonnées recouvertes par le fond de carte → cause racine n° 1. ✅
- 🟠 « 60 images affichées (max 60) » : plafond sans pagination ni « voir
  plus ».
- 🟡 Titres quasi identiques d'une vignette à l'autre (« Axion-IA — Hero Ville
  X Consultant IA Formation PME ») : la grille est illisible.
- ⚪ **Fausse alerte écartée** : les vignettes paraissent vides sur capture,
  mais les images sont bien chargées et peintes (`naturalWidth` > 0, pixels
  variés). C'est la capture d'écran qui ne composite pas les images en
  `loading="lazy"` — pas un défaut d'interface.

### /content-gen
- 🔴 **Deux en-têtes empilés** : une barre « Content Generator · 1 alerte ·
  + Nouvelle campagne », puis 80 px plus bas le vrai titre « Générateur de
  contenus » avec un **second bouton « + Nouvelle campagne » identique**. La
  même action primaire est offerte deux fois à l'écran.
- 🔴 Le produit s'appelle « Content Generator » dans la barre et « Générateur
  de contenus » dans le titre.
- 🔴 « Kill switch ACTIF — toutes générations stoppées » est noyé dans la ligne
  de description grise, à égalité avec « auteur Manon ». Un arrêt total de
  production doit être un bandeau, pas un fragment de sous-titre.
- 🟠 Bandeau d'anomalie : « Pipeline bloque : 1 campagne(s) running, 0 job cree
  depuis 4h » — **accents manquants** (bloque, cree), anglicismes (running,
  job), « campagne(s) ».
- 🟠 Le bouton « Kill switch » ne dit pas s'il active ou désactive.
- 🟡 « Sites web augmentes » (sans accent) dans les tuiles.
- 🟡 « KB seedée », « drip-window », « cap quotidien », « tier-1 » : jargon
  dense dans un texte destiné à l'opérateur.

### /qualiopi/conformite
- 🟠 « ★ » devant certains numéros d'indicateurs, sans légende nulle part.
- 🟠 Trois nombres (32 indicateurs / 23 applicables / 9 couverts) sans que rien
  n'explique le passage de 32 à 23.
- 🟠 Colonne « Éléments constatés » : puces de phrases techniques dans une
  cellule → hauteurs de lignes très inégales.
- 🟠 « Registre des signatures — qui a signé quoi » : lien souligné nu, isolé
  entre le sous-titre et les tuiles.
- 🟡 Le score « 39 % » n'est pas coloré selon sa gravité.
- 🟡 « Exporter le manifeste (JSON + MD) » : jargon dans un libellé de bouton.

### /coaching
- 🔴 **Aucun encadrement sur toute la page** : les 4 tuiles du haut n'ont ni
  fond ni bordure, tout le reste est du texte nu posé sur le canvas. C'est
  exactement le reproche « manque d'encadrement / trop textuel ».
- 🔴 « Statut des séances » : titre de section suivi de **rien** — pas même un
  état vide.
- 🔴 « Gain de temps par métier » : les en-têtes de colonnes (Prestation /
  Séances / Gain h/sem) s'affichent avec « Aucune donnée » posé en dehors du
  tableau → tableau fantôme.
- 🟠 Pas d'`AdminPageHeader` : ni sous-titre, ni bouton — « Voir les séances »
  est un lien texte.
- 🟡 « 0.0 » (point décimal anglais) au lieu de « 0,0 ».

### /presse/communiques
- 🟠 Le `<select>` « Ordre manuel » est trop étroit : le libellé passe sous le
  chevron.
- 🟠 Quatre contrôles de filtre de hauteurs et largeurs différentes sur une
  même ligne, non alignés.
- 🟠 Flèches ↑/↓ de réordonnancement : deux petits boutons gris sans infobulle,
  expliqués dans une note 40 px plus bas.
- 🟠 « Éditer » : lien nu sans en-tête de colonne (**3ᵉ page avec ce défaut**).
- 🟡 Deux styles de badge sur la même ligne (« JALON » gris, « ● PUBLIÉ » vert).

### /documents-interventions
- 🔴 **Trois barres de navigation empilées avant le titre** (« Documents de
  prestation / Boîte à documents », puis « Formations / 1-to-1 / Audit », puis
  « Annuaire équipe / Importer un kit » en liens soulignés). Le titre arrive en
  quatrième position, à 190 px du haut — et ces entrées sont déjà toutes dans
  la barre latérale.
- 🟠 Chaque carte affiche le **slug technique** (`ia-pour-bien-commencer`) en
  chasse fixe, aussi présent que le nom lisible.
- 🟠 Les cartes n'ont aucune action visible ni indice qu'elles sont cliquables.
- 🟡 La première carte occupe une ligne seule, les suivantes sont sur deux
  colonnes : grille irrégulière.

### /chatbot
- 🔴 **« $0.00 »** — devise dollar et point décimal anglais dans une console
  française. Doit être « 0,00 € ».
- 🟠 Tuile « Escalades ouvertes 4 » sous-titrée « 4 au total » : redondant et
  déroutant.
- 🟠 « Lancer l'ingestion » : bouton sans indication de ce qu'il déclenche ni
  confirmation.
- 🟠 Grille de 5 tuiles en 3 + 2, avec un vide à droite de la seconde rangée.
- 🟡 Badges « OUVERTE » alignés à droite hors colonne (pas d'en-tête).

### /qualiopi/a-traiter ✅
- 🔴 **La pastille disait 2, la page disait « Rien à traiter — tout est à
  jour »**, et `/qualiopi/alertes` confirmait 0 alerte active. Le compteur de
  la pastille faisait un `count` brut là où la page retire les pièces
  remplacées (convention `-003` et `-011` d'INVEST SUN, doublées par `-009`
  signée). ✅ filtre remonté dans un module partagé + test d'égalité.

### /avis
- 🟠 Le filtre par défaut est « En attente (0) » : la page d'atterrissage
  montre systématiquement du vide alors que « Publié » en compte 77.
- 🟠 « Rechercher » + « Réinitialiser » : deux boutons pour un seul champ.

### /blog
- 🟠 Colonne AUTEUR à « — » sur les 173 articles ; colonne VUES à 0 partout.
  Deux colonnes qui n'apportent rien en l'état.
- 🟠 La colonne SLUG (chasse fixe) occupe un cinquième de la largeur.

### /qualiopi/formations
- 🟠 **Trois colonnes de statut côte à côte** (STATUT GÉNÉRATION « Publié »,
  STATUT « Actif », VALIDÉE « Non ») sans qu'on sache laquelle fait foi.
- 🟠 La colonne OFFRE répète mot pour mot le titre de la formation, sur les
  22 lignes.
- 🟠 66 boutons d'action à l'écran (3 × 22 lignes).
- 🟡 « offres_site » (nom de table) et « Formation Engine » dans le sous-titre.

### /web-vitals ✅
- 🔴 Le bloc « Budgets référence (AGENTS.md) » recopiait la **documentation
  développeur** à l'écran : chemin d'un fichier d'audit, nom d'un module de
  helpers, numéro de runbook, nom d'un tag Telegram. ✅ remplacé par les
  seuils en langage clair.
- 🔴 « 1 mesure(s) sur 16 (sur 4 page(s) suivies) » — deux pluriels entre
  parenthèses dans la première ligne de la page. ✅ accordé.
- 🟠 « Forcer un recompute », « Snapshot worker », « 1 breaches notifiées ».
  ✅ les deux premiers et le troisième reformulés.
- 🟠 La page annonce « les dernières 24 heures » alors que la source affichée
  date du 24/07 — dix jours. **Non corrigé** : soit la mesure ne tourne plus,
  soit le libellé ment. À trancher avec les logs du worker.

### /qualiopi/pilotage ✅
- 🔴 Trois tuiles sur quatorze affichaient « En cours de constitution / — » sans
  dire de quelle métrique il s'agissait. ✅ `libelle` reprend le nom, l'état
  passe dans `detail` — exports CSV/PDF corrigés du même coup.
- 🟠 33 boutons de filtre (année / période / type d'action) avant le premier
  chiffre.

### /qualiopi/emails ✅
- 🔴 Donnée de test en production dans « Traités récemment ». ✅ supprimée en
  base le 2026-08-03 (`DELETE 1`, table désormais vide).
- 🟠 Les natures d'e-mail s'affichent en identifiants techniques, dont deux en
  anglais (`contract-sent`, `contract-reminder`) et trois en français.
- ✅ « Emails » → « E-mails », aligné sur le reste de la console.

### /qualiopi/offres
- 🟠 « Le prix est dérivé de **pricing.ts** » et l'en-tête « PRIX (PRICING.TS) » :
  un nom de fichier source affiché deux fois à l'écran.
- 🟡 Pastilles de gamme en identifiants sans accent (`seminaire`, `generale`).

### /qualiopi/appreciations ✅
- 🔴 Trois champs demandaient de **coller un UUID à la main**. ✅ remplacés par
  des listes déroulantes lisibles.
- ✅ Formulaire replié derrière un bouton.

### /activity-logs ✅
- 🔴 Colonne Action et bloc « Top 20 » en **codes techniques** alors que
  `decrireAction` existe et sert déjà le tableau de bord. ✅ traduits.
- 🟠 Colonne « IP » contenant un hash, pas une adresse — colonne mal nommée.
- 🟠 Colonne « Changements » : JSON brut à défilement interne.

### /qualiopi/rgpd
- 🟠 « soft-delete », « export JSON » : jargon d'implémentation en sous-titre.
- 🟡 Deux tuiles sur trois portent une pastille colorée, la troisième non.

### /qualiopi/revue-direction — ⚠️ NE PAS TOUCHER
- 🔴 **Trois états pour un seul objet** : la tuile dit « Revue 2026 : Créée »,
  la ligne dit « Archivée », et « Validées : 0 ».
- 🔴 « 0 décision » / « 0 action » en orange, sans dire que c'est une
  non-conformité majeure (indicateur 32) ni comment la lever.
- ⚠️ **La PR #524 d'un autre chantier traite déjà cette page** (« la revue de
  direction devient remplissable »). Rien n'a été modifié ici pour éviter le
  conflit — à revérifier après sa fusion.

---

## Reste à parcourir

170 vues sur 204 (routes statiques). Prochains lots par ordre d'usage :
content-gen (58 vues restantes), image-bank (12), qualiopi (30),
contacts (11), presse (6).
