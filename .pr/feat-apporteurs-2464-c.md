feat(apporteurs): PR C #2464 — les annexes jointes sont figées, hachées et tracées (point 11)

## Ce qui change

Avant, la fiche des commissions, le livret et le guide vivaient à **une clé fixe** sur R2 : déposer un nouveau fichier remplaçait l'ancien, et rien ne prouvait quelle version un apporteur avait reçue.

Maintenant :

- chaque fichier est une **version** déposée **une seule fois** à une clé dérivée de son empreinte : `documents-apporteurs/<document>/<sha256>.pdf`. Elle ne bouge plus ;
- la version courante (la plus récente non retirée) est celle qui est jointe aux e-mails et servie par les routes de l'espace (fiche, livret, guide). Sans version (table absente ou vide), on retombe sur l'ancienne clé fixe ;
- chaque envoi **en file** note ce qui a été remis (document, 8 premiers caractères visibles de l'empreinte, contexte, date) : contrat signé, renvoi du contrat, lien du dossier (envoi manuel et relances du passage quotidien). Un échec de mise en file n'écrit rien ; un double clic ne double rien ;
- nouveau composant de lecture seule `DocumentsRemis` (fiche apporteur).

Fichiers : `annexes-versions.ts` (nouveau), `documents-joints.ts`, `documents-prives.ts`, `guide-demarrage.ts`, `verification.ts`, `passage-quotidien.ts`, schéma Prisma, migration.

## Tests (écrits d'abord, rouges)

- `annexes-versionnees.spec.ts` : clé dérivée de l'empreinte, même fichier deux fois = une version, nouveau fichier = nouvelle clé (l'ancienne reste), versions retirées ignorées, table absente = repli sur la clé fixe, refus d'un non-PDF.
- `contrat-signe-trace-les-annexes-remises.spec.ts` : une ligne par annexe jointe avec la bonne empreinte, annexe absente = aucune ligne, rejeu = `skipDuplicates`, table absente = silence.
- `contrat-signe-trace-envoi.spec.ts` : contresignature, renvoi et lien tracent seulement si l'e-mail est en file ; échec ou « retenu » = aucune trace ; une trace en échec ne bloque pas l'envoi.
- `migration-annexes-versionnees.spec.ts` : déclencheurs anti-DELETE / TRUNCATE / UPDATE, CHECK, aucun DROP, aucun ALTER sur une table existante, `rollback.sql` présent.
- Restent verts : `documents-joints.spec.ts`, `garde-pdf-apporteurs.spec.ts` et tout `src/features/apporteurs-reseau` (153 fichiers). Trois tests existants ajustés : `documents-joints.spec.ts` (le registre est simulé pour garder le test des minuteries indépendant de la base, et le nouveau module est ajouté à la liste des lecteurs du préfixe) et `releve-mensuel/.../migration-additive.spec.ts` (la nouvelle migration s'ajoute à la liste de celles qui peuvent suivre).

## Migration : oui

`20261128100000_apporteurs_annexes_versionnees` (plus récente que `20261128000000_chaine_editoriale_tables`). Deux tables neuves, **sans clé étrangère**, états en `VARCHAR` + `CHECK`, aucune énumération Postgres, aucune table existante touchée. Déclencheurs : ni DELETE ni TRUNCATE ; `documents_annexes_versions` n'accepte que `retiree_at` de NULL à une date ; `apporteur_documents_remis` refuse tout UPDATE. `rollback.sql` : sauvegarde `COPY` puis `RENAME … _retire_20261128`, jamais de `DROP TABLE`, « seulement sur décision du fondateur ». `prisma validate` OK.

Fenêtre app/worker : tout lecteur tolère la table absente, et l'ancienne clé fixe reste écrite à chaque dépôt (« à retirer après une version »).

## Audit argent : non

La fiche porte des montants, mais rien n'est calculé.

## Dépendances

Aucune. Le composant `DocumentsRemis` est **livré mais pas inséré** dans `[id]/page.tsx` : #2454 n'est pas fusionnée (même fichier). À insérer après sa fusion. Pas de réglage ni d'e-mail nouveau.

## Points laissés ouverts

- ⛔ **`scripts/apporteurs/deposer-document-joint.ts` n'a PAS été modifié** (point bloquant 1 de la relecture) : `scripts/` est monté en lecture seule dans l'environnement de cette session (`ro` dans `/proc/mounts`), je n'ai pas contourné la limite. **À faire à la main avant le premier dépôt** : remplacer la fin de `main()` (à partir du calcul du `sha256`) par `deposerVersionAnnexe(doc, pdf, { deposePar: "script-deposer-document-joint" })` (déjà écrit et testé), retirer l'archivage daté, et réécrire l'en-tête : le retrait d'un document se fait par `retiree_at`, plus par suppression de l'objet à la clé fixe. Tant que ce n'est pas fait, aucune version n'existe et aucune remise n'est tracée.
- Corrections de relecture : `versionCourante` signale (Sentry, sans donnée personnelle) toute panne autre que « table absente » ; `rollback.sql` retire aussi les quatre fonctions de déclencheur ; le composant précise que la remise est notée à la mise en file.
- Une annexe jointe par l'ancienne clé fixe (avant le premier dépôt versionné) n'a pas d'empreinte connue : rien n'est tracé pour elle.
- L'e-mail « Retenu » (`issue-apporteur-envoi.ts`) joint aussi les annexes, mais son entité est la candidature, pas l'apporteur : il n'est pas tracé ici.
- `pnpm-lock.yaml` : inchangé, pas de réinstallation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
