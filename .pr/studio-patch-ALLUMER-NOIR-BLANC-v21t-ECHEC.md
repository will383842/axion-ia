Pas de correction poussée : la branche studio-patch/ALLUMER-NOIR-BLANC-v21t existe déjà sur origin avec deux patchs de reprise (cas (e) de tests/briques/composition/noir-blanc-allume-v21t.test.ts), et un push normal aurait été refusé (non fast-forward) ; je n'ai pas forcé.
Sur video/ALLUMER-NOIR-BLANC-v21t (1d2f9165) : 0 PR et 0 check-run côté API GitHub, donc rien de rouge à lire ; en local tests/briques/composition = 125 passés, aucun test rouge dans les 3 fichiers de la fiche.
Mon patch n'aurait été qu'un commit vide, donc inférieur au patch existant : je ne l'ai pas poussé sous le nom normal.
Rouges hérités, non réparés : recollage, controle-piece-neuve, sequence-appel, mesure-v3 (échouent aussi avec plages-noir-blanc.ts à l'état master) ; 154 erreurs `tsc` hors fichiers de la fiche.
