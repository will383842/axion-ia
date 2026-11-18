/**
 * `POST /api/console/v1/commandes/{numeroDevis}/etat` — état d'activation renvoyé par la console
 * des automatisations (contrat C1, ajout 1.1.0). Affichage seulement : voir
 * `src/server/console/etat-commande.ts`.
 *
 * `force-dynamic` n'est pas décoratif : une route évaluée au build lirait la base.
 * Secret absent ou build : 404, rien n'est lu.
 */
import { repondreEtatCommande } from "@/server/console/etat-commande";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  requete: Request,
  contexte: { params: Promise<{ numeroDevis: string }> },
): Promise<Response> {
  const { numeroDevis } = await contexte.params;
  return repondreEtatCommande(requete, numeroDevis);
}
