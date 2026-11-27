Rouge : verdict d'audit sur b78179da — la phrase de notification (FeuilleSerie.tsx:97) n'était exécutée par aucun test, la mutation `${aCompleter}` à la place de `${horsDomaine}` restait verte.
Changé : extraction de `phraseLancementSerie({ partis, restes, horsDomaine, aCompleter })` (fonction pure exportée de FeuilleSerie.tsx, appelée par le composant) ; le test (e) l'exécute avec des comptes distincts (3/1/2/1 et 1/4/3/2) au lieu de lire le source.
Tests : serie-hors-domaine-v21s 10/10 ; la mutation M6 rend désormais (e) rouge ; e2e-verif1-bc-serie et l2-13c-plafonds-claude verts ; tsc : 154 erreurs, identiques à master.
Rouges hérités non réparés (identiques sur master) : paquet4-jonctions « geste TikTok » (ZERNIO_NON_RELIE) et garde-ecran « jargon technique ».
