-- CreateTable
CREATE TABLE "acquisition_spend" (
    "id" UUID NOT NULL,
    "spent_on" DATE NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "campagne" VARCHAR(120),
    "montant_centimes" INTEGER NOT NULL,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_email" VARCHAR(255),

    CONSTRAINT "acquisition_spend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acquisition_spend_spent_on_idx" ON "acquisition_spend"("spent_on");
