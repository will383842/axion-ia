-- KB V4 (Sprint KB-13) — Table idempotency-key pour factory ingest API.

CREATE TABLE IF NOT EXISTS "knowledge_ingest_requests" (
    "idempotency_key" VARCHAR(64) NOT NULL,
    "factory_id" VARCHAR(80) NOT NULL,
    "entry_id" UUID,
    "status" VARCHAR(40) NOT NULL DEFAULT 'queued',
    "reject_reason" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_ingest_requests_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX IF NOT EXISTS "knowledge_ingest_requests_factory_id_status_idx"
  ON "knowledge_ingest_requests"("factory_id", "status");

CREATE INDEX IF NOT EXISTS "knowledge_ingest_requests_received_at_idx"
  ON "knowledge_ingest_requests"("received_at");
