-- AlterTable
ALTER TABLE "document_recipients" ADD COLUMN     "last_ressources_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ressources_magic_links" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ressources_magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ressource_telechargements" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ressource_telechargements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ressources_magic_links_token_hash_key" ON "ressources_magic_links"("token_hash");

-- CreateIndex
CREATE INDEX "ressources_magic_links_recipient_id_idx" ON "ressources_magic_links"("recipient_id");

-- CreateIndex
CREATE INDEX "ressources_magic_links_expires_at_idx" ON "ressources_magic_links"("expires_at");

-- CreateIndex
CREATE INDEX "ressource_telechargements_recipient_id_idx" ON "ressource_telechargements"("recipient_id");

-- CreateIndex
CREATE INDEX "ressource_telechargements_version_id_idx" ON "ressource_telechargements"("version_id");

-- CreateIndex
CREATE INDEX "document_recipients_email_idx" ON "document_recipients"("email");

-- AddForeignKey
ALTER TABLE "ressources_magic_links" ADD CONSTRAINT "ressources_magic_links_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "document_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ressource_telechargements" ADD CONSTRAINT "ressource_telechargements_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "document_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ressource_telechargements" ADD CONSTRAINT "ressource_telechargements_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "intervention_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

