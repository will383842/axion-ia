/**
 * Qualiopi — Server Action « Pièces de facturation OPCO » (lot A8c).
 *
 * Depuis la fiche d'une facture financée par un OPCO, télécharge en un ZIP la
 * facture et ses justificatifs :
 *   · SUBROGATION (facture à l'OPCO) : ce que l'organisme dépose chez l'OPCO —
 *     facture + certificat(s) de réalisation + feuille d'émargement à jour (ou
 *     relevés de connexion) ;
 *   · REMBOURSEMENT (facture à l'entreprise) : ce que l'entreprise présente à
 *     son OPCO — facture + certificat(s) de réalisation (+ présences).
 *
 * Produire ≠ remettre : rien n'est envoyé ni déposé, rien n'est numéroté.
 */

"use server";

import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { rendreTirageEmargementAJour } from "@/server/qualiopi/documents/emargement-tirage";
import { chargerPiecesFacturation } from "@/server/qualiopi/financements/pieces-facturation-opco-lecture";
import { construirePaquetFacturation } from "@/server/qualiopi/financements/pieces-facturation-opco";
import { z } from "zod";

type ActionResult<T> = { data: T } | { error: string };

const schema = z.object({ factureId: z.string().uuid() });

export async function telechargerPiecesFacturationOpcoAction(input: {
  factureId: string;
}): Promise<
  ActionResult<{ base64: string; filename: string; joints: string[]; manquantes: string[] }>
> {
  // Même droit que l'émission : ce paquet accompagne une pièce comptable.
  const adminSession = await requireHabilitation("facturer");
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Génération désactivée en mode build (stub)" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const f = await chargerPiecesFacturation(parsed.data.factureId);
  if (f === null) return { error: "Facture introuvable" };
  if (f.avoirDeId !== null) return { error: "Un avoir n'a pas de pièces de facturation OPCO." };

  const circuitDeLaFacture =
    f.circuit === "subrogation" && f.destinataire === "opco"
      ? "subrogation"
      : f.circuit === "remboursement" && f.destinataire === "entreprise"
        ? "remboursement"
        : null;
  if (circuitDeLaFacture === null || f.session === null) {
    return {
      error:
        "Ces pièces concernent la facture à l'OPCO d'une session subrogée, ou la facture à l'entreprise d'une session en remboursement OPCO.",
    };
  }
  if (f.document === null) {
    return { error: "PDF de la facture absent : générez-le avant de préparer les pièces." };
  }

  let emargement: { buffer: Buffer; mention: string } | null = null;
  try {
    const tirage = await rendreTirageEmargementAJour(f.session.id);
    if (tirage.ok) emargement = { buffer: tirage.buffer, mention: tirage.mention };
  } catch (err) {
    console.error("[pieces-facturation-opco] tirage d'émargement impossible", err);
  }

  try {
    const paquet = await construirePaquetFacturation({
      circuit: circuitDeLaFacture,
      facture: {
        numero: f.numero,
        document: f.document,
        destinataireNom: f.destinataireNom,
        numeroDossierOpco: f.numeroDossierOpco,
      },
      numeroSession: f.session.numero,
      contexte: f.client?.raisonSociale ?? null,
      justificatifs: f.justificatifs,
      emargement,
    });
    await logQualiopiActivity({
      action: "qualiopi.facture.pieces_opco.telechargees",
      targetType: "FactureFormation",
      targetId: f.id,
      changes: {
        circuit: circuitDeLaFacture,
        joints: paquet.joints,
        manquantes: paquet.manquantes,
      },
      session: adminSession,
    });
    return { data: paquet };
  } catch (err) {
    console.error("[telechargerPiecesFacturationOpcoAction] ZIP impossible", err);
    return { error: "Impossible de préparer les pièces de facturation." };
  }
}
