Porte qualité Q1 : migration additive des tables de verdicts et de cohortes

## Ce que fait cette PR
- Crée deux tables neuves : `content_quality_verdicts` (un verdict par évaluation d'un contenu) et `porte_cohortes` (instantané hebdomadaire d'une cohorte).
- Pose la ligne de réglages `porte_qualite` dans `content_gen_config` avec les valeurs de la phase d'observation (mode ombre, seuil 85, blocage sous 70, relecture humaine à 100 %, plafond de sécurité bas). Une valeur déjà présente n'est jamais écrasée.
- Ajoute `down.sql` (s'arrête si les tables ne sont pas vides) et un test de migration additive.

## Ce qu'elle ne fait pas
- Aucune lecture ni écriture branchée : rien dans `src/` n'utilise ces tables.
- Aucune table existante modifiée, aucune énumération, aucune clé étrangère.
- Aucun changement visible pour le public.

## Sûreté app / worker
Tables neuves que personne ne lit encore : l'ancien et le nouveau conteneur s'ignorent mutuellement, dans les deux sens. Horodatage `20261127210000`, postérieur à la dernière migration de main (`20261127200000`). Après atterrissage, vérifier `prisma migrate status` avant d'allumer quoi que ce soit.

## Vérifications faites
- `prisma validate` et `generate` : OK. `tsc --noEmit` : OK. Tests ciblés (migration additive, objets SQL bruts) : OK. Prettier : OK.
- SQL identique au `prisma migrate diff` ; essayé sur un vrai Postgres 16, y compris l'insertion répétée (idempotente).

## Remarques de la relecture, non bloquantes (à traiter en Q2 ou avant le passage en « prête »)
1. Six colonnes sont obligatoires sans défaut (`content_kind`, `version_porte`, `mode`, `verdict`, `semaine`, `updated_at`) : la phrase « toute colonne nullable » du § 3 règle 7 n'est pas vraie à la lettre. Sans risque sur des tables neuves.
2. `plafondSecuriteParJour: 3` n'est fixé par aucune décision ; Q1b parle d'une « clé existante » pour le plafond : désigner la source qui fait foi avant Q11.
3. Plusieurs seuils des § 10.2 et § 10.3 sont absents de la clé ; comme l'insertion est en `DO NOTHING`, le schéma Zod de Q2 doit donner une valeur par défaut à chaque clé absente.
4. L'insertion contourne le journal d'audit des réglages (compensé par `updatedBy`).

La PR reste à ouvrir en brouillon par Will.

VERDICT OPUS : BON
