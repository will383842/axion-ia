-- KB V4 (Sprint KB-18) — Annotations team + collections éditoriales

CREATE TABLE "knowledge_annotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "anchor_ref" VARCHAR(120),
    "body_markdown" TEXT NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'review_comment',
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_annotations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_annotations_entry_id_status_idx"
  ON "knowledge_annotations"("entry_id", "status");
CREATE INDEX "knowledge_annotations_author_id_created_at_idx"
  ON "knowledge_annotations"("author_id", "created_at" DESC);

ALTER TABLE "knowledge_annotations"
  ADD CONSTRAINT "knowledge_annotations_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Collections
CREATE TABLE "knowledge_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(120) NOT NULL,
    "title_fr" VARCHAR(255) NOT NULL,
    "title_en" VARCHAR(255),
    "description_fr" TEXT,
    "description_en" TEXT,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "cover_asset_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_collections_slug_key" ON "knowledge_collections"("slug");
CREATE INDEX "knowledge_collections_visibility_published_at_idx"
  ON "knowledge_collections"("visibility", "published_at");

-- Join collection items
CREATE TABLE "knowledge_collection_items" (
    "collection_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "note_fr" TEXT,
    "note_en" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_collection_items_pkey" PRIMARY KEY ("collection_id", "entry_id")
);
CREATE UNIQUE INDEX "knowledge_collection_items_collection_id_position_key"
  ON "knowledge_collection_items"("collection_id", "position");
CREATE INDEX "knowledge_collection_items_entry_id_idx"
  ON "knowledge_collection_items"("entry_id");

ALTER TABLE "knowledge_collection_items"
  ADD CONSTRAINT "knowledge_collection_items_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "knowledge_collections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_collection_items"
  ADD CONSTRAINT "knowledge_collection_items_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
