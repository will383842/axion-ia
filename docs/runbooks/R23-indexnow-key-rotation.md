# R23 — Rotation INDEXNOW_KEY (annuel ou si leak)

- **Code** : R23
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (annuel) · 🟡 **P1** si leak.
- **Impact si non traité** : key compromise → squatter peut ping des URLs malicieuses comme axion-ia.com → pénalité SEO.

## Trigger

- Hebdo : SOP `review-sop.md` flag annuel.
- Leak détecté : key visible dans logs publics, repo public, Sentry breadcrumbs.
- Audit sécurité régulier.

## Prérequis

- Same as R14 — clé `INDEXNOW_KEY` env Coolify + fichier `public/{key}.txt`.

## Étapes

Suivre **R14 §2-§6 + §Vérifications** intégralement (procédure identique). Différences :

1. **Avant** : pas d'urgence — peut être fait en daytime.
2. **Annonce** : Telegram low-priority `[MAINTENANCE]` 24h avant.
3. **Documenter** dans `_AUDIT/SECRETS-ROTATION-LOG.md` :

```markdown
| Date       | Secret       | Reason          | Old key fingerprint | New key fingerprint |
| ---------- | ------------ | --------------- | ------------------- | ------------------- |
| 2026-05-15 | INDEXNOW_KEY | annual rotation | abc123...           | xyz789...           |
```

## Cycle préventif

- **Tous les 12 mois** depuis dernière rotation.
- Cron rappel dans SOP `review-sop.md` (T1 chaque année).

## Liens

- R14 — IndexNow rejected (procédure technique)
- `review-sop.md` — calendrier rotation
- Mémoire `axionia_will_decisions_2026-05-09` — "pas de rotation pour l'instant" (à revoir mensuel)
