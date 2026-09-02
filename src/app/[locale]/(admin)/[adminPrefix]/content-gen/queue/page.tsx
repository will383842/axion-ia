/**
 * Redirect 308 (FUSION) — DECISION-IA §5-E, 2026-06-16.
 *
 * `/queue` (ancienne « File d'attente / inspection BullMQ ») faisait doublon
 * avec `/jobs` (même source Prisma `ContentGenJob`). Fusionné dans
 * `/jobs?view=queue` (onglet « File d'attente »). Redirection 308 conservée
 * 6 mois pour les bookmarks ; si `/jobs` ne gère pas encore l'onglet, le
 * paramètre `view` est simplement ignoré (rien ne casse).
 *
 * Aucune capacité perdue : tout est dans `/jobs`.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QueueRedirect({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  // 2026-09-02 — `view=queue` n'était lu par personne : la « file » affichait
  // les 2 498 jobs, publiés et échoués compris. `status=queued` est le filtre
  // que la liste sait appliquer.
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen/jobs?status=queued`);
}
