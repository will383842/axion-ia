# EXEC SUMMARY — Deploy débloqué (2026-05-18 ~09:00 CEST)

## Bottom line

🟢 **Tout est en prod, tout marche, plus rien à faire dans l'immédiat.**

- URL prod : https://axion-ia.com (build SHA `229a0ff…`)
- Admin : https://axion-ia.com/admin-xfz5hk0j7hrk → login OK
- Healthz : `{db:ok, redis:ok}`
- 10/10 smoke routes vertes

## Coût session

- **0 € additionnel** (runner GitHub Actions standard, pas de paid runner).
- Tous les workflows passent sur la formule GitHub gratuite.

## 3 actions Will (non-urgentes)

### 1. Surveiller 24 h (auto, rien à faire)

Le pipeline est sain. Tu peux pusher des changements normalement, ils passeront comme avant.

### 2. Cleanup 2 zombies GH Actions (optionnel, 30 sec)

Tu as 2 runs queued depuis 2026-05-15 jamais démarrés (problème runner upgrade que j'ai voulu tenter en cycle 5, cf. verdict). Pour les cancel :

- https://github.com/will383842/axion-ia/actions/runs/25906878058 → bouton **Cancel workflow**
- https://github.com/will383842/axion-ia/actions/runs/25906810693 → bouton **Cancel workflow**

Pas critique, mais propre.

### 3. Décision long-terme : SSG villes complète ou pas ?

Aujourd'hui le build prend **24 min** au lieu de **45 min** parce que j'ai désactivé la pré-génération des 6 450 pages villes/services au build (3 templates × 2 150 villes). Elles restent accessibles via ISR (premier hit slow ~1-2 s puis cached 24 h). Cohérent SEO car ces villes sont `noindex` tant qu'elles n'ont pas de `copy.services`.

**Trois options possibles** :

- **A** (actuel) : `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`. Build rapide, prod sereine, villes indexables seulement (Paris pour l'instant). Tu rajoutes des villes indexables une à une au fil de la copy.
- **B** : revenir à toutes les villes en SSG → besoin d'activer `ubuntu-latest-large` (32 GB RAM payant ~$3-4/build) sur ton compte GitHub. Voir https://github.com/settings/billing/spending_limit.
- **C** : self-hosted runner sur le VPS Hetzner. Plus puissant, gratuit, mais maintenance.

**Reco** : rester en A, ramper progressivement les villes indexables. Tant que `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`, le build reste sous 16 GB RAM = safe.

## Ce qui s'est passé en 5 lignes

1. Tu m'as demandé de débloquer le pipeline OOM. Diagnostic profond : SSG 6 450 villes mangeait toute la RAM 16 GB du runner GH Actions.
2. Fix : env var qui réduit le SSG aux villes indexables seulement. Pipeline GREEN ✅.
3. Mais après deploy, admin crash : 5 migrations Prisma jamais appliquées en DB depuis 2026-05-16. Cause : binaire prisma cassé au boot container (pnpm symlinks).
4. Fix immédiat : workflow GitHub Actions one-off qui SSH dans le VPS, installe prisma fresh, applique les 5 migrations, restart container. Admin débloqué.
5. Fix durable : patch Dockerfile pour installer prisma + engines proprement via npm au build → plus jamais ce drift silencieux.

## Workflow utilitaire conservé

`gh workflow run admin-emergency-migrate.yml -f action=status` → diagnostic état migrations.
`gh workflow run admin-emergency-migrate.yml -f action=migrate` → applique + restart container.

À garder même quand tout va bien. Filet de sécurité.

## Manon (autre conversation en parallèle)

Pendant cette session, Manon (autre instance Claude) a poussé 8 commits SEO/indexation P0+P1. Sa note "Pipeline OOM-bloqué" était **obsolète** au moment où elle l'a écrite : mon cycle 6 avait déjà passé. Elle peut push ses 8 commits sans risque maintenant (DB schema à jour, pipeline débloqué via D4-QW1).

Si tu vois encore ses 8 commits non-pushés dans `git log origin/main..HEAD`, dis-lui qu'elle peut `git push`.
