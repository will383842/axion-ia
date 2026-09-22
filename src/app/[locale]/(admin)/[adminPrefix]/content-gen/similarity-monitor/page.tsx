/**
 * Content Generator — Détection de doublons (§ 25.5 couche C v1.7).
 *
 * Lecture seule de `ContentGenConfig.similarity_pairs`, écrite chaque nuit par
 * `content-similarity-monitor-worker`. Les gestes de masse (archiver, fusionner,
 * ignorer) ne sont pas branchés : la page montre, elle ne modifie rien.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import {
  CLE_PAIRES_SIMILAIRES,
  lirePairesSimilaires,
  type PaireSimilaire,
} from "@/server/content-gen/paires-similaires";
import { SimilarityMonitorV2 } from "./_v2/SimilarityMonitorV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

async function chargerPaires(): Promise<readonly PaireSimilaire[]> {
  // Contrat de build (AGENTS.md) : sous l'URL stub, aucune requête ne part.
  // La page est `force-dynamic`, donc elle ne devrait pas être rendue au build —
  // « ne devrait pas » n'est pas « ne peut pas », et le repli coûte une ligne.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  try {
    const brut = await readContentGenConfig<unknown>(CLE_PAIRES_SIMILAIRES, []);
    return lirePairesSimilaires(brut);
  } catch {
    // Une page de surveillance qui tombe parce que sa source est indisponible
    // remplace une information manquante par une panne. Elle dit « aucune ».
    return [];
  }
}

export default async function SimilarityMonitorPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const paires = await chargerPaires();
  const detecteLe = paires[0]?.detectedAt ?? null;

  return <SimilarityMonitorV2 adminPrefix={adminPrefix} paires={paires} detecteLe={detecteLe} />;
}
