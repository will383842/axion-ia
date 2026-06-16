-- Relabel de la catégorie "implementations" → branding public exact
-- "Implémentation & automatisation IA" (la verticale /implementation couvre
-- agents IA, automatisation des processus, intégrations CRM/ERP). Le label initial
-- "Implémentations IA" sous-vendait le périmètre. Idempotent (UPDATE par slug).
UPDATE "categories"
SET "name_fr"      = 'Implémentation & automatisation IA',
    "name_en"      = 'AI implementation & automation',
    "seo_title_fr" = 'Implémentation & automatisation IA — articles | Axion-IA',
    "seo_desc_fr"  = 'Agents IA, automatisation des processus et intégrations CRM/ERP : articles, retours terrain et bonnes pratiques.',
    "updated_at"   = now()
WHERE "slug" = 'blog-implementations-ia';
