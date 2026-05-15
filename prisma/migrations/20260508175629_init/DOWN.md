# DOWN — init (2026-05-08)

Migration initiale du schéma Axion-IA. Crée toutes les tables core
(Users, Submissions, Bookings, etc.).

## Doctrine projet (méta-cert 2026-05-15 AGENT 14 P1)

**R22-first** : rollback = `pg_restore` depuis le backup pré-migration le
plus récent. Ne PAS tenter de DROP TABLE manuel sur cette migration init
— dépendances FK cross-tables nombreuses + données business non récupérables.

## Risque

🔴 **Critique** — perte totale données si rollback manuel. Tout drop
casse en cascade des dizaines de FK.

## Procédure cible (si vraiment nécessaire)

1. Identifier le backup PG pré-init (n'existe probablement pas — init = T0)
2. Si pas de backup → **NE PAS rollback** ; recréer une DB neuve serait
   équivalent en terme de data loss
3. Pour les migrations suivantes, R22 standard via `pnpm restore-postgres-test-r2`
