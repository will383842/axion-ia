/**
 * `GET /api/interne/reglages-publics` — prérequis P3 : le studio lit les réglages
 * du site qui bornent ce qu'il peut dire (plan PLAN-W1-W4 §4).
 *
 * Signature du §3.2 (corps vide ⇒ sha256 de la chaîne vide). Le nonce est vérifié
 * EN FORME mais pas journalisé : une lecture rejouée est inoffensive, et ne pas
 * écrire en base sur un GET évite qu'un studio en boucle remplisse la table.
 *
 * Booléens SEULEMENT : aucun compte, aucune moyenne, aucun identifiant.
 */
import type { NextRequest } from "next/server";
import {
  isQualiopiCertificationObtenue,
  isQualiopiPublicDisclosureEnabled,
} from "@/server/qualiopi/config/flag";
import { avisPublies } from "@/server/reviews/presence";
import { videosSiteActives } from "@/server/videos/config";
import type { ReglagesPublics } from "@/server/videos/contrat";
import { controlerEntree } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const entree = await controlerEntree(req, {
    methode: "GET",
    chemin: "/api/interne/reglages-publics",
  });
  if (!entree.ok) return entree.reponse;

  const corps: ReglagesPublics = {
    schemaVersion: 1,
    luLe: new Date().toISOString(),
    qualiopiCertificationObtenue: isQualiopiCertificationObtenue(),
    ofPublicDisclosure: isQualiopiPublicDisclosureEnabled(),
    avisPublies: await avisPublies(),
    videosSiteActives: videosSiteActives(),
  };
  return reponseJson(200, corps);
}
