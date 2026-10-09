-- Contrat 2.7 (art. 11.1) : la résiliation est NOTIFIÉE avec son préavis (30, 60 ou 90 jours selon
-- l'ancienneté quand la Société résilie, 30 jours quand l'Apporteur résilie) ; le contrat continue
-- jusqu'à `fin_at`, puis le passage quotidien applique la fin. Table séparée, sans clé étrangère
-- déclarée, comme `apporteur_reseau_retrait` : aucune requête existante sur `apporteurs_reseau`
-- n'en dépend (fenêtre app/worker). Aucune ligne = aucune résiliation notifiée. Ajout seul.
CREATE TABLE "apporteur_reseau_resiliation" (
    "apporteur_id" UUID NOT NULL,
    "par" VARCHAR(20) NOT NULL,
    "notifiee_at" TIMESTAMPTZ(3) NOT NULL,
    "preavis_jours" INTEGER NOT NULL,
    "fin_at" TIMESTAMPTZ(3) NOT NULL,
    "notifiee_par" VARCHAR(64),
    "annulee_at" TIMESTAMPTZ(3),
    "appliquee_at" TIMESTAMPTZ(3),
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apporteur_reseau_resiliation_pkey" PRIMARY KEY ("apporteur_id")
);

CREATE INDEX "apporteur_reseau_resiliation_fin_at_idx" ON "apporteur_reseau_resiliation"("fin_at");
