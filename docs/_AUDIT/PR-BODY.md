## Scanner de fausse présence locale (outil, aucune modification de contenu)

- `scripts/villes/scan-fausse-presence.ts` : parcourt `src/content/villes/copy/*.ts` (ou un dossier en argument) et sort un CSV `fichier;ligne;motif;extrait;verdict` (FAUTIF | A_VERIFIER). Liste blanche documentée en tête de fichier (« Nous intervenons partout en France, sur place ou à distance » et variantes neutres).
- `tests/unit/content/scan-fausse-presence.spec.ts` : 22 tests (10 phrases fautives, 10 saines).
- Deux scans commités : `docs/_AUDIT/scan-fausse-presence-main-2026-11-11.csv` (1720 FAUTIF / 1217 A_VERIFIER) et `...-feat-v3-villes-lot-2-2026-11-11.csv` (1724 / 1169), résumé par motif dans `scan-fausse-presence-RESUME-2026-11-11.md`.
- Vérifications locales : `docs/_AUDIT/feat-scan-fausse-presence-VERIFS.md`.

Le verdict est heuristique (analyse par ligne) : à relire avant tout nettoyage.
