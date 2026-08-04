-- Sous-traitance : aligner les DEUX natures d'intervenant externe sur les mêmes pièces.
--
-- ── Le défaut corrigé ────────────────────────────────────────────────────────
--
-- Axion a deux natures de sous-traitant, et elles n'étaient pas outillées pareil :
--
--   `trainers` (statut = 'sous_traitant')  → une PERSONNE PHYSIQUE indépendante
--   `sous_traitants_of`                    → un ORGANISME (autre OF)
--
-- L'indicateur 27 ne comptait que la seconde table (`conformite-service.ts`,
-- « NDA + vérification data.gouv + contrat signé »), tandis que les alertes ne
-- surveillaient que la première (`evaluateur.ts`). Les deux colonnes étaient donc
-- exactement inversées : le modèle réellement utilisé était surveillé mais pas
-- compté, l'autre compté mais pas surveillé.
--
-- Conséquence : Axion pouvait référencer dix formateurs indépendants parfaitement
-- conformes et voir l'indicateur 27 rester à zéro.
--
-- Cette migration donne aux deux tables les mêmes pièces, pour que le moteur de
-- conformité et les alertes puissent enfin porter sur les deux.
--
-- ── RC pro : NON BLOQUANTE (décision Will, 2026-08-03) ───────────────────────
--
-- Aucun texte n'impose la responsabilité civile professionnelle à un formateur
-- indépendant, et en faire une condition de sélection réduirait le vivier sans
-- nécessité. Elle est demandée, archivée avec son échéance, et son absence lève une
-- ALERTE — elle n'entre PAS dans le critère de conformité de l'indicateur 27.
-- Cf. `_AUDIT/QUALIOPI-PRE-VISITE-2026-08-03/PROCEDURE-SOUS-TRAITANCE.md` § 4.2.
--
-- ── Sûreté ──────────────────────────────────────────────────────────────────
--
-- Colonnes NULLABLES et `IF NOT EXISTS` : aucune ligne existante n'est touchée,
-- aucun défaut rétroactif n'est inventé. Un champ vide dit « pièce non fournie »,
-- ce qui est l'information exacte — un défaut aurait affirmé le contraire.

-- ── trainers : personne physique sous-traitante ──────────────────────────────

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "sous_traitant_screenshot_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "sous_traitant_screenshot_date"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sous_traitant_contrat_signe_at"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sous_traitant_prochaine_verif_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rc_pro_attestation_url"           TEXT,
  ADD COLUMN IF NOT EXISTS "rc_pro_echeance_at"               TIMESTAMP(3);

-- ── sous_traitants_of : organisme sous-traitant ──────────────────────────────

ALTER TABLE "sous_traitants_of"
  ADD COLUMN IF NOT EXISTS "prochaine_verif_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rc_pro_attestation_url"  TEXT,
  ADD COLUMN IF NOT EXISTS "rc_pro_echeance_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cv_url"                  TEXT,
  ADD COLUMN IF NOT EXISTS "cv_uploaded_at"          TIMESTAMP(3);

-- ── Index de surveillance ───────────────────────────────────────────────────
--
-- Les alertes balaient par ÉCHÉANCE (« quelles pièces expirent dans 60 jours »),
-- jamais par identité. Sans ces index, chaque passage du cron ferait un seek
-- complet sur des tables destinées à grossir avec le vivier d'intervenants.

CREATE INDEX IF NOT EXISTS "trainers_rc_pro_echeance_at_idx"
  ON "trainers" ("rc_pro_echeance_at");
CREATE INDEX IF NOT EXISTS "trainers_sous_traitant_prochaine_verif_at_idx"
  ON "trainers" ("sous_traitant_prochaine_verif_at");
CREATE INDEX IF NOT EXISTS "sous_traitants_of_rc_pro_echeance_at_idx"
  ON "sous_traitants_of" ("rc_pro_echeance_at");
CREATE INDEX IF NOT EXISTS "sous_traitants_of_prochaine_verif_at_idx"
  ON "sous_traitants_of" ("prochaine_verif_at");
