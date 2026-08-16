# DIGEST DE CONTEXTE COMMUN — à lire par CHAQUE agent avant sa mission

Audit GEO/AEO end-to-end 50 agents, 2026-08-14. Ta mission détaillée est dans
`_AUDIT/PROMPT-AUDIT-GEO-AEO-END-TO-END-50-AGENTS-2026-08-14.md` — lis
IMPÉRATIVEMENT dans ce fichier : (1) le bloc « CONTEXTE OPÉRATIONNEL
CRITIQUE », (2) le bloc « DÉCISIONS ACTÉES PAR WILL — NE PAS ROUVRIR »,
(3) le paragraphe de TON agent (ex. « **D4 — pSEO villes** »), (4) les
« Règles communes » de la Phase 1.

## État de session (mesuré 2026-08-14 17:45 UTC)

- Repo : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (chemin absolu ;
  le dossier parent est un dossier bureautique, ne pas y chercher du code).
- Branche locale : `fix/cgv-mediation-engagement` = `main` + 1 commit CGV
  (sans impact GEO). NE PAS changer de branche, NE PAS toucher à git
  (arbre de travail partagé entre conversations). Audite le code tel quel.
- ⚠️ **Déploiement EN VOL** : run GH Actions parti à 17:33 UTC (~1 h de
  build), atterrissage prod estimé 18:30–19:00 UTC, suivi d'un restart
  container + job warm. Dernier deploy stable : atterri ~14:57 UTC.
  Conséquence : si tu mesures un sitemap/page DB-driven VIDE après ~18:30
  UTC, vérifie d'abord `gh run list -L 2 --workflow deploy-coolify.yml`
  avant de conclure à un bug (fenêtre ISR ≤ 1 h post-deploy = normal).
  Horodate TOUTES tes mesures live (UTC).

## Règles d'exécution STRICTES (audit-only)

- Écriture autorisée UNIQUEMENT dans `_AUDIT/GEO-AEO-E2E-2026-08-14/`.
- Zéro commande git mutante, zéro commit/push, zéro `pnpm build`, zéro
  `next dev`, zéro Lighthouse local (machine partagée — piège connu :
  saturation = faux timeouts). Si un script de lecture dépasse ~2 min ou
  charge la machine, abandonne-le et fais l'analyse statique.
- Prod : GET/HEAD uniquement (curl). Jamais de POST/PUT/DELETE, jamais de
  soumission d'URL (GSC, Bing, IndexNow, Indexing API).
- DB prod (agents A3, B6, D1, D5, D8, F7 SEULEMENT) : `ssh axion-prod`
  puis `docker ps` pour trouver le container postgres, puis
  `docker exec <ctr> psql -U postgres -d axionia -c "SELECT ..."` —
  **SELECT only**, requêtes ciblées avec LIMIT. ⚠️ `jq` absent du VPS.
  ⚠️ En local, le port 5433 = postgres d'un AUTRE projet (BOOKFORGE) :
  ne pas s'en servir.
- Recherches web : charge d'abord les outils via
  `ToolSearch("select:WebSearch,WebFetch")`. Pas d'outils navigateur
  (réservés à la session principale).
- Windows : Git Bash pour les commandes POSIX ; attention un pipe Git
  Bash peut fabriquer des `\r` — ne jamais écrire de fichier via pipe.

## Format de rapport (obligatoire, en français)

Écris ton rapport dans `_AUDIT/GEO-AEO-E2E-2026-08-14/<ton-fichier>.md` :

1. `# <ID> — <titre>` + date/heure UTC + périmètre réellement couvert
2. `## Résumé exécutif` (≤ 8 lignes, verdict de ta surface)
3. `## Findings` — chacun : `### [P0|P1|P2] <titre court>` puis
   Symptôme / Preuve code (`fichier:ligne`) / Preuve live (horodatée) /
   Root-cause / Patch prescrit / Effort S-M-L / Impact GEO-AEO
   fort-moyen-faible / Risque de régression du patch + fichiers
   do-not-touch. Un finding sans double preuve (code ET live quand la
   surface est en prod) doit être marqué `[À CONFIRMER]`.
4. `## Mesures brutes` (tableaux : URLs testées, status, volumes, temps)
5. `## Limites` — ce que tu n'as PAS pu vérifier et pourquoi.

Rappels anti-faux-positifs : beaucoup de choses existent déjà dans
`src/lib/seo.ts` (2 242 l.) et `src/lib/seo/**` — cherche avant de dire
« manquant ». Un chiffre affiché (avis, prix, volumes) se vérifie à la
source (état connu : 77 avis réels, moyenne 4,88/5). Toute recommandation
contredisant une « décision actée » du prompt maître est un faux positif.
