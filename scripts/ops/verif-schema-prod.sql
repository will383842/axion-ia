-- ── PREUVE DURE : les migrations de recrutement sont-elles EN PRODUCTION ? ──
--
-- Lecture seule. On interroge le SCHÉMA, jamais le seul journal.
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
UNION ALL SELECT '6 TEMOIN candidatures conservees (86 avant migration)',
       (SELECT count(*) FROM job_applications)
ORDER BY 1;
