# 01-INVENTAIRE — DB / Prisma

## Schéma

**`prisma/schema.prisma`** : 706 lignes, **22 modèles**, **16 enums**.

### Models (22)

```
Submission              CalendarSlot         BookingOption
Booking                 Article              ArticleTranslation
ArticleTag              ArticleTagOnArticle  Author
Testimonial             CaseStudy            CaseStudyTranslation
FAQ                     HelpArticle          HelpArticleTranslation
Survey                  SurveyResponse       Category
AdminUser               ActivityLog          Setting
NewsletterSubscriber
```

### Enums (16)

```
Locale  SubmissionType  SubmissionStatus  InterventionType
BookingStatus  CalendarSlotStatus  BookingOptionStatus
PublishStatus  TestimonialStatus  FAQCategory
SurveyTrigger  SurveyStatus
AdminRole  AdminStatus  NewsletterStatus  ModuleKind
```

### Indices

- **38 `@@index`** (count via grep)
- **7 `@@unique`** (contraintes uniques composites)

## Migrations

Sous `prisma/migrations/` :

```
20260508175629_init/                          ← Sprint 0 init
20260508193001_intervention_type_align/       ← réalignement enum
20260509120000_sprint_24_tiptap_json_text/    ← Tiptap JSON+text Sprint 24
migration_lock.toml                           ← postgresql
```

→ 3 migrations linéaires, Postgres. Bonne hygiène pour V1.

### Migrations FTS

`prisma/migrations_fts/0002_fts_setup.sql` — script FTS Postgres séparé (full-text search pour `/recherche`). À documenter dans R-06 et AGT-11.

## Côté Prisma client

- `prisma/generated/client/` présent (custom output) — cf. `prisma/schema.prisma`.
- `src/lib/prisma.ts` exporte singleton.
- Modèles consommés par 19 server actions admin + 5 server actions public + endpoints API.

## Citations

- `prisma/schema.prisma` (706 lignes)
- `prisma/migrations/*` (3 dirs + lock)
- `prisma/migrations_fts/0002_fts_setup.sql`
- `src/lib/prisma.ts`

## Détails AGT-11 DB-PRISMA

N+1, transactions, soft-delete, backup tested, pooling, timezone : voir rapport AGT-11.
