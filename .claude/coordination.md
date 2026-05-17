# Multi-agent Claude coordination — Axion-IA

Quand plusieurs sessions Claude (CLI, IDE, ou autres clients) travaillent
sur ce repo en parallèle, suivre les règles ci-dessous pour éviter les
collisions destructrices (HEAD switch, commits interleaved, branches
multi-thématiques).

## Pourquoi ce fichier existe

Le sprint **image-bank V1 + S+1 securite-rgpd** (2026-05-16) a vécu deux
sessions Claude simultanées (session Will + session Manon) sur la branche
`feat/image-bank-v1` :

- Switches HEAD automatiques → des edits 2-3 fois perdus
- Commits interleaved (`8433bba`, `fde9fa7`) qui ont écrasé certains
  patches d'audit
- Commit fantôme `6d51bb7` (titre trompeur, contenu hors scope primaire)
- Branche devenue multi-thématique sans qu'aucune session ne s'en rende
  compte

Le présent fichier + `active-sessions.md` est un garde-fou collaboratif
**facultatif côté tooling** mais **obligatoire côté process** pour toute
session Claude qui touche le repo.

## Règles obligatoires

1. **Une session = une branche feature**.
   Jamais deux sessions sur la même branche en simultané.

2. **`main` est en lecture seule** sauf instruction explicite + scoping
   précis de Will. Toute écriture sur `main` doit passer par PR (avec
   exception unique : commits `[skip ci]` doc / ops urgentes).

3. **Au démarrage d'une session qui va écrire**, ajouter une ligne dans
   `.claude/active-sessions.md` :

   ```
   - session-<uuid> | branch=<name> | started=<YYYY-MM-DDThh:mm:ssZ> | scope=<one-line> | owner=<conv-id>
   ```

4. **Avant tout `git checkout <branch>` / `git switch <branch>`**, lire
   `.claude/active-sessions.md`. Si une autre session est déjà sur cette
   branche → **STOP & ASK Will** (override autopilote autorisé). Ne pas
   forcer le switch.

5. **À la fin (ou crash)** d'une session, **nettoyer** son entrée dans
   `.claude/active-sessions.md` (delete la ligne).

## En cas de conflit constaté

- Switches HEAD inopinés (perte d'edits) → `git reflog` pour récupérer
  l'état pré-switch.
- Commits interleaved → `git log --oneline --pretty='%h %an %s' -20` pour
  identifier le committer de chaque hash.
- Overwrite détecté → `git reflog` pour retrouver le HEAD ancien, puis
  `git cherry-pick <hash>` du commit perdu.
- En cas de doute : **arrêter toute écriture, demander à Will**.

## Outils complémentaires

- `CODEOWNERS` (si configuré) protège certains chemins critiques (à
  considérer : `prisma/migrations/**`, `axionia/.github/workflows/**`,
  `axionia/Dockerfile*`).
- Pre-push hook (`.husky/pre-push`) bloque déjà les pushs avec tests
  fail / typecheck fail — garde-fou primaire.

## Doctrine session unique préférée

Quand c'est possible, **une seule session Claude active à la fois**
sur Axion-IA. Le coût d'une session séquentielle additionnelle est
nettement inférieur au coût d'un débugging de commits écrasés.

## Pointeur

- `axionia/.claude/active-sessions.md` — registre live des sessions
- `_AUDIT/DEPLOY-RECOVERY-2026-05-17/02-root-cause.md` cause #3 §1.5 —
  contexte historique de ce garde-fou.
