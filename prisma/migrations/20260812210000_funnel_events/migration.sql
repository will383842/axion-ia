-- Journal des parcours de tunnel d'acquisition.
--
-- ── Ce que cette table permet ─────────────────────────────────────────────
-- Plausible sait dire combien de visiteurs ont démarré le simulateur et
-- combien l'ont terminé. Il ne sait pas dire à quel écran partent ceux qui
-- abandonnent — or c'est la seule information qui indique quoi corriger. Le
-- chaînage par `session_id` reconstitue le parcours écran par écran.
--
-- ── Ce qu'elle ne contient jamais ─────────────────────────────────────────
-- Aucune donnée nominative, aucune adresse IP (même hachée), aucun montant
-- exact — uniquement des tranches (`gain_bucket`). Un montant exact croisé au
-- secteur et à l'effectif réidentifierait une entreprise.
--
-- `session_id` vient de `sessionStorage` et NON d'un cookie : il meurt à la
-- fermeture de l'onglet et ne suit personne d'un site à l'autre. Première
-- partie, finalité unique, pas de recoupement, rétention bornée par le
-- balayage de rétention existant : c'est ce qui range cette mesure sous
-- l'exemption de consentement de la CNIL. Les pages de tunnel n'ont
-- volontairement pas de bannière — y ajouter une donnée identifiante ferait
-- tomber l'exemption.

CREATE TABLE "funnel_events" (
  "id"           TEXT         NOT NULL,
  "funnel"       VARCHAR(40)  NOT NULL,
  "event"        VARCHAR(48)  NOT NULL,
  "session_id"   VARCHAR(64)  NOT NULL,
  "locale"       VARCHAR(10),
  "route"        VARCHAR(255),
  "device_type"  VARCHAR(10),
  "step"         VARCHAR(60),
  "step_index"   INTEGER,
  "step_total"   INTEGER,
  "sector"       VARCHAR(60),
  "headcount"    VARCHAR(40),
  "gain_bucket"  VARCHAR(20),
  "utm_source"   VARCHAR(80),
  "utm_medium"   VARCHAR(80),
  "utm_campaign" VARCHAR(120),
  "landing"      VARCHAR(60),
  "placement"    VARCHAR(40),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- Lecture principale du tableau de bord : un tunnel, un événement, par date.
CREATE INDEX "funnel_events_funnel_event_created_at_idx"
  ON "funnel_events" ("funnel", "event", "created_at" DESC);

-- Reconstitution d'un parcours complet.
CREATE INDEX "funnel_events_session_id_idx"
  ON "funnel_events" ("session_id");

-- Sert le balayage de rétention, qui supprime par date.
CREATE INDEX "funnel_events_created_at_idx"
  ON "funnel_events" ("created_at");
