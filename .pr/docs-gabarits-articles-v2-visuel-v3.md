# docs(gabarits-articles) : maquettes v3, en-tête du site, héros terracotta, tendances 2027

Suite de la PR #2423. Aucun code du site ne change : seulement des maquettes HTML (`docs/design/gabarits-articles/maquettes-v2/`), le socle CSS, la maquette des liens et une note de recherche.

## Ce qui a changé, et pourquoi

1. **En-tête identique à celui du site.** La maquette avait un bandeau mocha qui ne ressemblait pas au site. Il est maintenant copié sur `Header.tsx` et `NavLink.tsx` : barre terracotta (95 % + flou), filet bas, logo dans un badge blanc, onglets ivoire, pastille « La Journée IA », loupe et « Nous écrire » en pastilles blanches, « Réserver un appel » en bleu. Hauteur 80 px sur téléphone comme sur ordinateur, tailles 18 px, tiroir de menu sans JavaScript sous 1280 px. Vérifié par un relecteur Opus contre le code du composant.
2. **Héros (grand titre) de nouveau terracotta.** Dégradé du terracotta `#b23f16` vers un terracotta plus foncé, titre blanc, mots en italique en terracotta-soft, pastilles blanche et terracotta-deep, signe du modèle sur terracotta-deep, image posée dans un passe-partout ivoire. Règle : tout décor sous du texte est plus foncé que le fond, jamais plus clair. Contrastes mesurés au pixel dans le navigateur (762 mesures, 10 modèles, téléphone et ordinateur) : aucun couple sous 4,5:1. Pires valeurs : onglets 4,78:1 (voile 95 % sur fond clair), italique du titre 4,63:1 (grand texte).
3. **Vraies polices.** Les maquettes n'en chargeaient aucune (elles s'affichaient en Georgia). Elles utilisent maintenant les fichiers du site (`src/fonts`) et les mêmes polices de secours calibrées que `globals.css`. Le décalage de mise en page au chargement des polices passe de 0,17 au pire à 0,014 au pire (mesure avec polices retardées de 1,2 s). Il n'est pas strictement nul sur 6 cas sur 20 (chapô qui change de ligne) : à revérifier sur le vrai site avec Lighthouse.
4. **Typographie.** Texte limité à environ 70 caractères par ligne sur ordinateur (corps 19 px), échelle de titres commune aux 10 modèles (h1 Fraunces 500 comme le site, h3 et h4 définis une fois), réponse courte plus nette, apostrophes courbes, coupures de ligne propres.
5. **Défauts de la critique design corrigés** : libellé « En bref » (une règle le rendait en 22 px), comparatif A/B lisible sur téléphone (cartes), chiffre clé en terracotta, tableaux plus étroits avec ombres de défilement, appel d'action du milieu au style unique (il ressemblait à un encadré), « Bon à savoir » fondu avec « Le saviez-vous ? », grilles sans élément orphelin, héros plus court sur téléphone, barre de progression sous l'en-tête, impression propre (titres, liens, blocs sombres, sources avec adresse).
6. **Tendances 2027 appliquées** (voir la liste plus bas) : bloc « Relu et validé par », « Historique des mises à jour », « Citer cet article » partout, emplacement vidéo avec transcription, phrase de neutralité et de méthode en haut de Sélection et Comparatif.
7. **Maquette des liens** (branche `docs/gabarits-liens-visuel`) ajoutée dans `liens/`. Ses idées validables sont à intégrer au socle à l'étape de code : lien interne bleu avec flèche, lien externe avec pastille du domaine, appels de note, lien de glossaire en pointillé terracotta, cartes « À lire aussi ».
8. **Index** aligné sur la nouvelle charte.

## Tendances retenues (détail et sources datées : `TENDANCES-2027.md`)

- Les Aperçus IA et le Mode IA de Google sont en France depuis le 22 juillet 2026 : 2027 est la première année pleine.
- Moins de clics par recherche : chaque visite doit mieux convertir, être cité devient un objectif.
- Google dit que le GEO « reste du SEO » (guide du 15 mai 2026) : pas de `llms.txt` à développer, pas de texte découpé « pour l'IA », pas de balisage empilé. Les résultats enrichis FAQ ont disparu le 7 mai 2026.
- Ce qui est cité : une réponse placée tôt, des titres en questions, des définitions nettes. Les maquettes le font déjà.
- Données originales et chiffres sourcés et datés : le modèle Chiffres (Observatoire) est le levier propre à Axion-IA.
- Fraîcheur réelle : dates vraies et historique de ce qui a changé.
- Auteur réel ou IA clairement annoncée, avec un humain responsable nommé (faux profils d'auteur traités comme une tromperie par Google ; article 50 du règlement européen sur l'IA).
- Listes et comparatifs très cités, mais une liste qui se classe soi-même première est du spam : méthode remontée, aucune offre Axion-IA dans la liste.
- Vidéo (YouTube) parmi les premières sources citées par les IA : emplacement avec transcription, seulement si une vraie vidéo existe.
- Page lisible sans JavaScript et mesure dédiée (rapport « IA générative » de la Search Console, « AI Performance » de Bing).

## À décider par Will

- **Relecteur humain nommé** : le bloc existe en maquette avec un emplacement `[Prénom Nom]`. Il demande une donnée « relecteur » en console, ce qui touche au schéma de données (interdit dans ce chantier) : PR séparée ?
- **Deux boutons bleus vers la réservation** sur ordinateur (« Réserver un appel » dans la barre, « Diagnostic IA, 45 min » dans la carte) : à accepter ou à différencier.
- Chiffres des maquettes à rafraîchir avant toute mise en production (Insee, France Num : voir `TENDANCES-2027.md` §3.9). Ce sont des exemples.

## Limites connues

- Recherche des tendances : les pages web n'étaient pas ouvrables dans la session, vérification par moteur de recherche, recoupée par un second relecteur qui a corrigé cinq erreurs (déjà reportées). Rouvrir la source avant de citer un chiffre sur le site.
- Pour l'intégration : le tiroir du vrai site est un panneau Radix (portail) ; la barre d'action fixe devra rester sous lui. Ne pas recopier le `z-index` de la maquette.
- Interdits vérifiés par deux relecteurs : aucun « Grenoble », aucun frais de déplacement, aucun prix barré, aucun faux témoignage ni faux logo ; « partout en France ».

## Vérifications

- `prettier --check` (même configuration, sans le plugin Tailwind absent de cet environnement) sur `_socle.css`, `TENDANCES-2027.md` : vert.
- Relecture Opus tour 1 (fidélité, contraste, CLS : à corriger) puis tour 2 (aucun bloquant) ; relecture Opus des tendances (à corriger, corrections appliquées).
- Aucun défilement horizontal de 320 à 1440 px ; console sans erreur.

VERDICT OPUS : BON
