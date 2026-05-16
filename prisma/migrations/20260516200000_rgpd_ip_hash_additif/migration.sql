-- Sprint Correctif S+1 (P0-S1-3 RGPD) 2026-05-16.
--
-- Ajout ADDITIF de `ip_hash` sur Submission + NewsletterSubscriber.
-- La colonne `ip_address` est conservée pour back-compat — drop prévu S+2
-- après exécution du backfill `prisma/scripts/backfill-ip-hash-2026-05-16.ts`.
--
-- Doctrine : zero-downtime — code applicatif dual-write (ipAddress + ipHash)
-- pendant la fenêtre de transition. Une fois backfill OK + monitoring
-- confirme que tout nouveau write a `ip_hash` non-null, S+2 fait DROP COLUMN.

ALTER TABLE "submissions" ADD COLUMN "ip_hash" VARCHAR(64);
ALTER TABLE "newsletter_subscribers" ADD COLUMN "ip_hash" VARCHAR(64);

-- Index sur ip_hash pour les requêtes anti-fraude (burst-detect par hash).
CREATE INDEX "submissions_ip_hash_idx" ON "submissions" ("ip_hash") WHERE "ip_hash" IS NOT NULL;
CREATE INDEX "newsletter_subscribers_ip_hash_idx" ON "newsletter_subscribers" ("ip_hash") WHERE "ip_hash" IS NOT NULL;
