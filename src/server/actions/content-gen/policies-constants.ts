/**
 * Content Generator — Constantes policies (déplacées hors "use server").
 *
 * Next.js 16+ interdit l'export de symboles non-async dans un fichier
 * marqué `"use server"`. Cette constante était historiquement co-localisée
 * dans `policies.ts` ; isolée ici pour permettre le build webpack production.
 */

import type { ContentType } from "../../../../prisma/generated/client";

export const CONTENT_TYPES_ALL: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
];
