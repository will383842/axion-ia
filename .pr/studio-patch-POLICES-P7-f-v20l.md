Rouge : aucune CI lisible (pas de PR ni de check-run pour 481d981a) ; en local, `tests/segments-rendu/version-compositions.test.ts` échouait (5 empreintes périmées : briques-v4 et commun-lot1 à lot4).
Changé : régénération de `tests/segments-rendu/version-compositions.json` (`ECRIRE_EMPREINTES=1`), seul fichier touché, déjà dans le diff de la branche ; aucun test affaibli.
Tests : version-compositions, tests/polices, controle-piece-neuve → 13 fichiers, 106 verts ; tsc : pas d'erreur neuve sur les fichiers de la branche (153 erreurs d'environnement : RouteContext, remotion).
Rouges hérités non réparés (identiques sur master) : garde-charte (4 tests), panne-passagere-rendu (4) ; tests facecam-animee en échec ici faute du paquet `remotion` (workspace studio-rendu non installé).
