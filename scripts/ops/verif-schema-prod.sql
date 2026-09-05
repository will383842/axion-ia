-- ── PREUVE DURE : les migrations de recrutement sont-elles EN PRODUCTION ? ──
--
-- Lecture seule. On interroge le SCHÉMA, jamais le seul journal.
--
-- ⚠️ SONDE MANUELLE, ET C'EST ASSUMÉ. Aucun workflow, aucun cron, aucune entrée de
--    `package.json` ne la joue : elle ne vaut que lancée à la main, après un
--    atterrissage qui porte une migration. Elle n'ASSERTE rien non plus — les
--    « doit valoir N » sont des libellés, la comparaison est faite par un humain
--    qui lit la colonne de droite.
--
-- 🔑 LA COMMANDE DE REJEU EST ICI, dans le fichier, et nulle part ailleurs. Elle a
--    vécu jusqu'au 2026-09-05 dans un document de session — `_SESSIONS/…-pilotage.md`
--    pointait d'ailleurs encore vers l'ancien emplacement `scratchpad/`, périmé par
--    le déplacement sous `scripts/ops/`. Un fichier exécutable qui dépend d'un
--    journal pour être exécutable n'est pas exécutable.
--
--    tr -d '\r' < scripts/ops/verif-schema-prod.sql \
--      | ssh -o BatchMode=yes root@178.105.55.15 \
--          'docker exec -i <conteneur-app> psql -U axionia -d axionia -X -P pager=off'
--
--    (le conteneur se lit avec `docker ps` : celui qui porte `server.js`, pas le worker)
--
-- 🔴 TROIS FAMILLES DE TÉMOINS, ET IL FAUT LES TROIS.
--
-- 1. NÉGATIF (objet inexistant → 0) : prouve que la sonde ne fabrique pas de
--    faux positifs. Ne prouve PAS qu'elle sait rendre autre chose que 0.
-- 2. POSITIF (objet qui existe déjà → non-zéro) : sans lui, avant
--    l'atterrissage toutes les lignes valent 0, et « absent » ne se distingue
--    pas de « ma sonde ne mesure rien » (mauvaise base, rôle sans visibilité,
--    `table_schema` non filtré). Le meilleur est le compte de
--    `_prisma_migrations` : il croise un chiffre obtenu par `migrate status`,
--    c'est-à-dire par un binaire différent dans un conteneur différent.
-- 3. IDENTITÉ DE LA CIBLE (`current_database()`) : « bonne requête, mauvaise
--    base » ne se voit sur aucun autre témoin.
--
-- 🔑 ET LES NOMS SE DÉRIVENT DU DDL, JAMAIS DU MODÈLE PRISMA NI DU SOUVENIR.
--    Prisma mappe : le modèle `Interview` crée la table `job_interviews`, et
--    l'enum `JobRejectionReason` crée le type `job_rejection_reason`. Une
--    première version de cette sonde cherchait `interviews` et
--    `JobRejectionReason` — deux zéros garantis APRÈS une migration réussie,
--    qui auraient fait conclure « migration avalée » et bloquer la file.
--    Chaque nom ci-dessous est copié d'un `CREATE TABLE` / `CREATE TYPE` /
--    `ADD COLUMN` des fichiers `prisma/migrations/*/migration.sql`.

SELECT '0 TEMOIN+ base courante (doit valoir 1)' AS objet,
       (SELECT count(*) WHERE current_database() = 'axionia') AS present
UNION ALL SELECT '0 TEMOIN+ table:job_applications (doit valoir 1)',
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public' AND table_name='job_applications')
UNION ALL SELECT '0 TEMOIN+ _prisma_migrations finies (>= 213)',
       (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)
UNION ALL SELECT '0 TEMOIN- objet inexistant (doit valoir 0)',
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public' AND table_name='table_qui_nexiste_pas_xyz')

-- ── Lot 1 — journal du candidat (20260903120000) ─────────────────────────────
UNION ALL SELECT '1 table:job_application_events',
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public' AND table_name='job_application_events')
UNION ALL SELECT '1 table:job_application_replies',
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public' AND table_name='job_application_replies')
UNION ALL SELECT '1 type:job_application_event_type',
       (SELECT count(*) FROM pg_type WHERE typname='job_application_event_type')
UNION ALL SELECT '1 type:job_application_reply_status',
       (SELECT count(*) FROM pg_type WHERE typname='job_application_reply_status')

-- ── Lot 2 — entretiens (20260903140000) ──────────────────────────────────────
UNION ALL SELECT '2 table:job_interviews (PAS "interviews" — @@map)',
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public' AND table_name='job_interviews')
UNION ALL SELECT '2 types:job_interview_mode/state/outcome (doit valoir 3)',
       (SELECT count(*) FROM pg_type
         WHERE typname IN ('job_interview_mode','job_interview_state','job_interview_outcome'))
UNION ALL SELECT '2 col:calendly_events.linked_job_application_id',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name='calendly_events' AND column_name='linked_job_application_id')
UNION ALL SELECT '2 enum:entretien_sans_suite',
       (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
         WHERE t.typname='job_application_event_type'
           AND e.enumlabel='entretien_sans_suite')

-- ── Lot 3 — statuts + décision (20260903160000 / 163000) ─────────────────────
UNION ALL SELECT '3 enum:statut interview/offer/withdrawn (doit valoir 3)',
       (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
         WHERE t.typname='JobApplicationStatus'
           AND e.enumlabel IN ('interview','offer','withdrawn'))
UNION ALL SELECT '3 type:job_rejection_reason (PAS "JobRejectionReason")',
       (SELECT count(*) FROM pg_type WHERE typname='job_rejection_reason')
UNION ALL SELECT '3 cols:job_applications decision (doit valoir 9)',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name='job_applications' AND column_name IN
           ('rejection_reason','decided_at','decided_by_id','hired_at','start_date',
            'trainer_id','assigned_to_id','last_activity_at','first_response_at'))
UNION ALL SELECT '3 contrainte:job_applications_motif_coherent_check',
       (SELECT count(*) FROM pg_constraint
         WHERE conname='job_applications_motif_coherent_check')

-- ── Le journal, et surtout les ÉCHECS ────────────────────────────────────────
-- 🔴 2026-09-04 — cette ligne annonçait « doit valoir 4 » et rendait 5. Ce
-- n'était PAS le schéma : l'attente avait été écrite avant que le lot 5
-- (`recrutement_provenance`, capture UTM) n'ajoute la cinquième migration.
-- Une assertion dont le nombre attendu retarde sur la réalité n'alerte pas,
-- elle apprend au lecteur à ignorer la ligne. Le compte est donc désormais
-- ADOSSÉ AUX NOMS, dérivés de `ls prisma/migrations | grep recrutement` :
--   20260903120000_recrutement_journal
--   20260903140000_recrutement_entretiens
--   20260903160000_recrutement_statuts_enum
--   20260903163000_recrutement_decision
--   20260903200000_recrutement_provenance
-- Ajouter une 6e migration `*recrutement*` fera rendre 6 à cette ligne alors
-- qu'elle en annonce 5 : l'écart se voit, et il se corrige ici même.
UNION ALL SELECT '4 journal:migrations recrutement finies (doit valoir 5)',
       (SELECT count(*) FROM _prisma_migrations
         WHERE migration_name LIKE '%recrutement%' AND finished_at IS NOT NULL)
-- ⚠️ « absente » et « enregistrée mais cassée en cours de route » sont deux
-- pannes différentes qui n'appellent pas la même réaction. Sans cette ligne, la
-- seconde se lit comme la première.
UNION ALL SELECT '5 journal:migrations recrutement EN ECHEC (doit valoir 0)',
       (SELECT count(*) FROM _prisma_migrations
         WHERE migration_name LIKE '%recrutement%'
           AND (finished_at IS NULL OR rolled_back_at IS NOT NULL))

-- ── Lot 6b — l'offre n'emporte plus les dossiers (20260904010000) ────────────
-- 🔴 LA LIGNE LA PLUS IMPORTANTE DU TABLEAU. `confdeltype` doit valoir 'n'
-- (SET NULL). S'il vaut 'c' (CASCADE), supprimer une offre efface encore les
-- candidatures qu'elle a reçues — y compris les dossiers `hired` que la
-- décision D4 protège de la purge. Mesuré à 'c' en prod avant la migration.
UNION ALL SELECT '6 FK offer_id = SET NULL (1 = ok, 0 = CASCADE encore la)',
       (SELECT count(*) FROM pg_constraint
         WHERE conname='job_applications_offer_id_fkey' AND confdeltype='n')
UNION ALL SELECT '6 col:job_applications.offer_id NULLABLE (doit valoir 1)',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name='job_applications' AND column_name='offer_id'
           AND is_nullable='YES')
UNION ALL SELECT '6 journal:candidature_sans_offre finie (doit valoir 1)',
       (SELECT count(*) FROM _prisma_migrations
         WHERE migration_name='20260904010000_candidature_sans_offre'
           AND finished_at IS NOT NULL)
-- ⚠️ TÉMOIN DE NON-DESTRUCTION : la migration ne devait toucher AUCUNE ligne.
-- 86 candidatures avant. Un nombre différent voudrait dire qu'elle a détruit
-- ou dupliqué — ce qu'aucune vérification de schéma ne verrait.
--
-- 🔴 2026-09-05 — la première version comptait `count(*)` sur la table VIVANTE et
-- annonçait 86. Elle a rendu 89 : trois candidatures étaient arrivées depuis. Ce
-- n'était ni une destruction ni une duplication, mais le lecteur ne pouvait pas
-- le savoir — et c'est le défaut que le § 4 ci-dessus dénonce déjà : une attente
-- adossée à un nombre qui BOUGE n'alerte pas, elle apprend à ignorer la ligne.
-- Le témoin porte désormais sur la COHORTE GELÉE — les candidatures soumises
-- avant l'instant où la migration s'est terminée. Ce sous-ensemble ne peut plus
-- GRANDIR.
--
-- 🔴 2026-09-05, second correctif — « 86 est vrai pour toujours » était FAUX, et
-- c'était le même défaut une fois de plus, retourné. `retention-purge-worker.ts`
-- supprime chaque jour les candidatures non-`hired` de plus de 24 mois (norme
-- CNIL). La cohorte gelée va donc RÉTRÉCIR toute seule, et « doit valoir 86 »
-- aurait crié à la destruction sur une purge parfaitement conforme. On avait
-- troqué un faux positif « duplication » contre un faux positif « destruction ».
--
-- L'attente juste n'est pas un nombre, c'est un SENS : la cohorte ne peut que
-- décroître, et le seul déficit légitime est celui qu'explique la purge. Les deux
-- lignes ci-dessous se lisent ENSEMBLE :
--   · > 86            → duplication : la seule vraie alerte de cette famille ;
--   · = 86            → intacte ;
--   · < 86, et l'écart est couvert par la ligne 6c → purge RGPD, rien à signaler ;
--   · < 86 sans que 6c l'explique → destruction. C'est là qu'il faut s'arrêter.
--
-- 🔑 `max(finished_at)` et pas `finished_at` : une migration re-jouée après un
--    `migrate resolve --rolled-back` laisse DEUX lignes du même nom, et une
--    sous-requête scalaire non bornée fait alors avorter la sonde ENTIÈRE avec
--    « more than one row returned by a subquery » — précisément dans le scénario
--    d'incident pour lequel on l'ouvre.
UNION ALL SELECT '6 TEMOIN cohorte d''avant 6b, survivante (<= 86 ; > 86 = duplication)',
       (SELECT count(*) FROM job_applications
         WHERE submitted_at < (SELECT max(finished_at) FROM _prisma_migrations
                                WHERE migration_name='20260904010000_candidature_sans_offre'))
-- 6c — le déficit LÉGITIME. Ce que la purge RGPD a déjà le droit d'avoir retiré de
-- la cohorte : non-`hired`, soumises il y a plus de 24 mois. Tant que
-- (86 − ligne 6) <= ligne 6c, la décroissance est expliquée et conforme.
UNION ALL SELECT '6c INFO cohorte deja eligible a la purge 24 mois (borne le deficit)',
       (SELECT count(*) FROM job_applications
         WHERE submitted_at < (SELECT max(finished_at) FROM _prisma_migrations
                                WHERE migration_name='20260904010000_candidature_sans_offre')
           AND submitted_at < now() - interval '24 months'
           -- `::text` et pas une comparaison d'enum : si la valeur `hired` était
           -- un jour renommée, un littéral non castable ferait avorter la sonde
           -- ENTIÈRE. Une sonde de diagnostic doit rendre un chiffre discutable
           -- plutôt que rien du tout.
           AND status::text <> 'hired')
-- Contre-mesure de la ligne précédente : si la sous-requête rendait NULL (migration
-- absente du journal), le compte vaudrait 0 et se lirait comme une destruction
-- totale. Cette ligne sépare les deux : 1 = le point d'ancrage existe.
UNION ALL SELECT '6 TEMOIN+ ancre de la cohorte existe (doit valoir 1)',
       (SELECT count(*) FROM _prisma_migrations
         WHERE migration_name='20260904010000_candidature_sans_offre'
           AND finished_at IS NOT NULL)
-- Informatif, sans attente figée : le total vivant, qui lui a le droit de croître.
UNION ALL SELECT '6 INFO candidatures au total (croissant, sans attente)',
       (SELECT count(*) FROM job_applications)
ORDER BY 1;
