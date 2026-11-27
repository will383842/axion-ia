# Contenus générés : lisibilité et valeur (CONTENU_LISIBILITE_V2)

## But

Que tout dirigeant de petite ou moyenne entreprise comprenne facilement les articles générés par Claude, y trouve une vraie valeur et ait envie de lire jusqu'au bout, pour les 22 types de contenu et tous les articles à venir.

## Interrupteur

`CONTENU_LISIBILITE_V2` doit valoir exactement `true`. Éteint (absent, vide, `TRUE`, `1`…), les consignes sont identiques à l'existant : les fonctions rendent une chaîne vide et les prompts ne changent pas d'un caractère (test à l'appui).

## Ce qui change quand il est allumé

Bloc commun ajouté à tous les types : réponse d'abord en 2 phrases, phrases courtes (20 mots en moyenne, jamais plus de 30), paragraphes courts, jargon expliqué, un exemple de PME par section (étiqueté illustratif, sans chiffre, sans nom), intertitres en questions (5 à 10 mots, au moins la moitié), encadrés balisés « À retenir », « En bref », « Exemple », « Chiffre clé », transitions qui relancent la lecture, conclusion avec 3 actions concrètes, appel vers le Diagnostic IA gratuit de 45 minutes puis la Journée IA, sans prix.

Blocs spécifiques par type :
- Actualité (`blog_from_rss`) : courte et factuelle, « Ce que cela change pour vous », ligne finale vers le Diagnostic seul.
- Comparatifs (`comparison`, `vs_comparator`, `alternative_to`, `best_for_x_in_y`) : tableau, verdict par profil, équité, pas de colonne « Coût ».
- Guides et modes d'emploi (`guide_pilier`, `how_to_x_in_y`) : étapes numérotées, résultat attendu, erreur fréquente.
- FAQ (`faq_standalone`, `faq_geo`) : la réponse d'abord, puis une explication courte.
- Définitions (`glossary_term`, `what_is_x`) : définition de 20 mots au plus, exemple, usage concret.
- `qa_derived`, `long_tail_keyword` : réponse dès la première phrase.
- `pain_point_solution`, `case_study_local` : scène illustrative, aucun témoignage ni résultat chiffré inventé.
- `top_x_in_y` : usages et catégories, pas de société réelle ni de classement inventé.
- `calculator_roi` : une méthode, pas un résultat.
- `barometer_insight` : chiffre vérifié d'abord, chaque chiffre avec sa source.
- `blog_article`, `blog_from_keywords`, `blog_from_title`, `landing_ville` : ossature en questions, encadrés.

Le bloc prime sur les consignes de style précédentes (il lève l'ancien interdit d'un « exemple de PME » seulement pour l'exemple étiqueté illustratif) mais ne lève aucun interdit : prix, frais de déplacement, chiffres sans source, faux témoignage, promesses de gain.

## Mesure automatique

`quality/lisibilite-v2.ts` (module pur) mesure les mots par phrase, la part de phrases de plus de 30 mots, les paragraphes longs, la part d'intertitres en question et les encadrés. Branchée :
- dans `evaluerBarrieresRelecture` : nouvelle barrière `lisibilite-v2` (relecture uniquement, jamais un refus ; seuils tolérants ; sans effet éteint) ;
- dans la boucle de retour qualité des 12 types phase 8.

## Balisage des encadrés

Documenté dans `docs/design/gabarits-articles/BALISAGE-ENCADRES.md` (classes `ax-encadre ax-retenir|ax-bref|ax-exemple`, doublées de `callout*` déjà stylées ; `ax-stat` existant pour le chiffre clé).

## Fichiers

- Nouveaux : `brand/consigne-lisibilite.ts`, `quality/lisibilite-v2.ts`, `brand/__tests__/consigne-lisibilite.spec.ts`, `quality/__tests__/lisibilite-v2.spec.ts`, `docs/design/gabarits-articles/BALISAGE-ENCADRES.md`.
- Modifiés : `brand/brand-voice.ts` (`injectBrandVoice` accepte le type), les 8 générateurs de blog/comparatif/guide/FAQ/QA/baromètre (passent leur type), `blog-from-rss.ts`, `ville-hub-copy.ts`, `v7-phase8-shared.ts`, `template-resolver.ts`, `quality/barrieres-publication.ts`.
- Non touchés : `journee-ia-commun.ts`, `legal.ts`, `pricing.ts`, `positionnement.ts`, prisma, plafonds en dollars.

## Tests et vérifications — À LIRE

⚠️ `node_modules` était absent de l'environnement, et l'installation des dépendances a été refusée par le système d'autorisation. Je n'ai donc PAS pu lancer `vitest`, `tsc`, `eslint` ni `prettier`. Les tests ont été écrits (et relus à la main), mais ne sont pas exécutés. À faire avant fusion : `pnpm exec prettier --write` sur les fichiers ajoutés et ce .pr, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run src/server/content-gen/brand src/server/content-gen/quality`.

## Limites et risques

- L'article d'essai jugé « très bien » est un brouillon en base, introuvable ici : travail sur les consignes seules ; les seuils de mesure sont à caler sur un texte réel.
- Les générateurs de blog calculent leur prompt au chargement du module : l'interrupteur y est lu au démarrage du worker (redémarrage nécessaire pour le changer). Seuls les types phase 8, la page ville et les modèles de pages le lisent à chaque appel ; l'actualité aussi le lit au chargement.
- Constats du rédacteur en chef NON traités (consignes existantes à corriger dans une PR séparée, car les modifier changerait les prompts éteints) : réponses `data-aeo` « en une phrase » de 40 à 60 mots, « KPI avant/après » et « témoignage anonymisé » de l'étude de cas, colonne « Coût » du comparatif, « tarifs SSOT », texte provisoire SIREN du guide, minimum de 1 200 mots / 6 H2 / 10 H3 uniforme en phase 8, `readabilityFitScore` trop indulgent, appel à l'action discordant. Le bloc V2 les neutralise par priorité de consigne quand il est allumé.
- Les prompts qui ne rédigent qu'un morceau (expansion par tranches, sections du guide) reçoivent une version « section » du bloc, sans réponse d'ouverture ni appel final.
- Dans la boucle phase 8, la mesure n'ajoute un retour qualité que si un autre motif déclenche déjà un nouvel essai.
- La Journée IA n'est citée que si sa fiche figure dans le prompt.
- Le formatage prettier des 8 générateurs (appel à deux arguments) est à refaire : l'outil n'était pas disponible.
- Le bloc rallonge les prompts (coût en jetons légèrement supérieur).

VERDICT OPUS : À CORRIGER
