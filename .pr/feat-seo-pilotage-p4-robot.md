> ⚠️ **Dépend de #2421, à fusionner après.** Cette branche part de `feat/seo-pilotage-p2-mesure` (les tables de la collecte) puis a reçu `main`.

## Ce que fait cette PR

Le robot « pilotage SEO » (lot P4) : chaque jour, il va chercher dans la Search Console les clics et affichages de **tous** les chemins du site, et les range dans les tables de P2 pour garder un historique.

- **Collecte quotidienne** (`ingestion-gsc`, 6 h 37 heure de Paris) : le dernier jour dont Google a les chiffres définitifs (il est détecté, pas codé en dur). Trois appels : totaux par page, détail par requête, total du site (simple contrôle).
- **Rattrapage** (`rattrapage-gsc`) : un jour d'historique par passage, du plus récent au plus ancien, jusqu'à 16 mois (≈ 7 jours pour tout remplir).
- **Ménage** (`purge`, dimanche 3 h 17) : le détail par requête est cumulé par semaine puis supprimé après 90 jours ; les cumuls hebdomadaires partent après 25 mois ; le texte des requêtes à moins de 3 affichages (et de plus de 90 jours d'âge) est effacé.
- Une seule file nouvelle, `seo-pilotage`, un seul worker (1 tâche à la fois).

## Sécurité

- **ÉTEINT par défaut.** Seul `CONTENT_PILOTAGE_SEO="true"` (exact) l'allume. Éteint : aucune lecture de base, aucun appel Google, aucune écriture. Le mode (`observation` par défaut) se lit dans `ContentGenConfig`, clé `pilotage_seo`.
- **Le worker atterrit avant l'app** (AGENTS.md) : si les tables de P2 n'existent pas encore (erreur P2021/P2022), la tâche saute sans échec et sans compter de tentative.
- Une tâche inconnue est journalisée et **ignorée** (jamais exécutée par défaut).
- Build GitHub (`stub.invalid`) : saut.
- **Données personnelles** : les requêtes contenant un e-mail, un téléphone ou le nom d'une personne connue (formateurs, candidats, clients, stagiaires, contacts, équipe) ne sont **jamais stockées**, seulement comptées. Les journaux ne contiennent que des nombres.
- Rejouer un jour donne le même état : le jour est remplacé en une transaction ; un jour réussi n'est jamais rejoué ; un jour qui plante est abandonné après 5 tentatives (visible à l'écran de santé, prévu plus tard). Un quota Google atteint n'use pas de tentative.

## Ce qui n'est PAS dans cette PR

- Le recalcul de `SiteRoute.gsc*` et de `KeywordTracking`, et le retrait de `site-route-gsc` / `content-keyword-sync` : prévus en PR séparées, une fois l'historique rempli.
- Inspection d'URL (P5), opportunités, écran.

## Vérifications

- `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint` (0 erreur), prettier : OK.
- Vitest : specs du pilotage SEO, du worker et de `src/server/queue` : OK (316 tests sur le pilotage + worker ; `tests/unit/ci` voisin OK).
- ⚠️ Un test existant, `tests/unit/ci/contacts-guide-reseau-origine-optionnelle.spec.ts`, échoue : sa liste fermée de migrations ne connaît pas `20261127170000_pilotage_seo_mesure` (migration de #2421, pas de cette PR). À corriger dans #2421.

## Limites connues (relecture)

- Pendant la première semaine de rattrapage, une requête rare peut voir son texte purgé le dimanche puis recréée : impact faible.
- Deux conteneurs worker simultanés pendant un déploiement : couvert par un verrou sur la ligne du jour, sauf un cas très étroit dans la purge (jour à sa 5e tentative encore actif) maintenant exclu.

## Relecture

Deux relectures Opus indépendantes (exactitude ; jobs BullMQ / idempotence / coût), 2 tours. Défauts trouvés au tour 1 et corrigés : cumul hebdomadaire écrasé, jour qui plante repris sans fin, sources de noms incomplètes, purge de requêtes récentes. Tour 2 : correctifs confirmés ; trois points mineurs restants (commentaire périmé, tentative consommée par une colonne absente, lecture hors transaction dans la purge) corrigés ensuite, hors relecture.

VERDICT OPUS : BON

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGcWQV45CtXehC8wxBw
