-- CreateTable
CREATE TABLE "qr_links" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "destination_url" TEXT NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "category" VARCHAR(80) NOT NULL DEFAULT 'general',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "last_scan_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qr_links_slug_key" ON "qr_links"("slug");

-- CreateIndex
CREATE INDEX "qr_links_active_idx" ON "qr_links"("active");

-- CreateIndex
CREATE INDEX "qr_links_category_idx" ON "qr_links"("category");
