/**
 * `POST /api/interne/oppositions-par-conv` — LECTURE : le Studio demande, par lot, si des conversations sont
 * opposées côté site. Même interrupteur (`OPPOSITIONS_RESEAU_ENABLED`, vérifié EN PREMIER), même secret que
 * `/oppositions-page-guide`, SON seau de débit. Aucune écriture, aucune adresse dans la requête ni la réponse.
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { refus } from "@/server/videos/reponse";
import {
  CORPS_MAX_OPPOSITIONS,
  PREFIXE_DEBIT_OPPOSITIONS_PAR_CONV,
  oppositionsReseauActives,
  secretsOppositionsReseau,
} from "@/server/guides-reseau/config";
import { repondreOppositionsParConv } from "@/server/guides-reseau/oppositions-par-conv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN = "/api/interne/oppositions-par-conv";

export async function POST(req: NextRequest): Promise<Response> {
  // Interrupteur vérifié EN PREMIER : éteint = rien n'est lu.
  if (!oppositionsReseauActives()) return refus(503, "reception_eteinte");
  if (req.nextUrl.search !== "") return refus(400, "chaine_de_requete_refusee");
  const entree = await controlerEntree(req, {
    methode: "POST",
    chemin: CHEMIN,
    drapeau: oppositionsReseauActives,
    secrets: () => secretsOppositionsReseau(),
    prefixeDebit: PREFIXE_DEBIT_OPPOSITIONS_PAR_CONV,
    corpsMaxOctets: CORPS_MAX_OPPOSITIONS,
  });
  if (!entree.ok) return entree.reponse;
  return repondreOppositionsParConv(entree);
}
