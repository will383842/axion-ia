/**
 * Content Generator — options par défaut des files créées hors `queues.ts`.
 *
 * Fix 2026-08-15 (audit e2e). Plusieurs workers et Server Actions instancient
 * leur propre `new Queue(...)` pour enfiler vers `content-gen`,
 * `content-quality-improver` ou `content-publish` (le module `queues.ts` ne peut
 * pas être importé partout sans tirer des dépendances côté requête). Ces files
 * ad-hoc étaient créées SANS `defaultJobOptions` : elles héritaient donc du
 * défaut BullMQ, soit **une seule tentative**, là où `queues.ts` en prévoit
 * plusieurs avec backoff.
 *
 * Conséquence observée : un job qui rencontrait le kill switch (le worker lève
 * volontairement pour se faire re-livrer plus tard) échouait définitivement dès
 * la première tentative, laissant une ligne en base dans un état non terminal que
 * plus aucun job BullMQ ne portait — un zombie de plus.
 *
 * Le backoff est plus long que celui de `queues.ts` (30 s au lieu de 5 s) parce
 * que les causes d'échec de cette chaîne sont lentes à se résoudre : pause
 * d'exploitation, rate-limit provider, redéploiement. Cinq tentatives espacées
 * exponentiellement à partir de 30 s couvrent environ huit minutes, ce qui
 * absorbe l'essentiel des interruptions courtes sans occuper un worker.
 */

import type { JobsOptions } from "bullmq";

export const CONTENT_GEN_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
};
