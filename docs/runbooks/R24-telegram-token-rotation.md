# R24 — Rotation Telegram bot token (annuel ou si leak)

- **Code** : R24
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (annuel) · 🟡 **P1** si leak.
- **Impact si non traité** : token compromise → attaquant peut envoyer messages au nom du bot → confusion / phishing.

## Trigger

- SOP `review-sop.md` annuel.
- Leak : token visible logs publics, GitGuardian alert, repo public.
- Suspicion : message inattendu reçu du bot.

## Prérequis

- Accès `@BotFather` (login Will, créateur du bot).
- Coolify env vars.

## Étapes

Suivre **R16 §2-§6** intégralement (procédure identique au cas révoqué).

Différences pour rotation préventive :

1. **Avant** : Will planifie créneau low-traffic.
2. **Annonce** : Telegram `[MAINTENANCE] Token rotation in 5 min`.
3. **Old token reste fonctionnel** jusqu'au `Revoke current token` BotFather → planifier le revoke à T+10 min après update env.
4. **Documenter** dans `_AUDIT/SECRETS-ROTATION-LOG.md` (cf. R23).

## Cycle préventif

- **Tous les 12 mois**.
- Avant rotation → checker mémoire `axionia_will_decisions_2026-05-09` :
  > Will OK 2026-05-09 "pas de rotation pwd Redis ni token Coolify pour l'instant" — décision à revoir.

## Liens

- R16 — Telegram bot revoked (procédure technique)
- `review-sop.md` — calendrier rotation
- Code : `src/lib/telegram.ts`
