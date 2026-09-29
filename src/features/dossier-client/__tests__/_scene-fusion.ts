/**
 * Une scène de FUSION commune aux tests de fusion et de « Défaire » : deux
 * fiches, une personne, un projet et un rendez-vous (avec un fait) sur la
 * fiche qui sera absorbée.
 */

import type { Ligne } from "./_prisma-en-memoire";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

export const ADMIN = "00000000-0000-4000-8000-0000000000ad";
export const MOTIF = "Même entreprise, deux fiches créées avant la porte unique.";

export function sceneFusion(
  p: {
    sirenAbsorbee?: string | null;
    sirenAbsorbante?: string | null;
    factureSurAbsorbee?: boolean;
  } = {},
) {
  const absorbee = fiche({ raisonSociale: "Fiche en double", siren: p.sirenAbsorbee ?? null });
  const absorbante = fiche({ raisonSociale: "Fiche qui reste", siren: p.sirenAbsorbante ?? null });
  const contactId = id(7);
  const projetId = id(8);
  const rencontreId = id(5);
  const faitId = id(6);
  const tables: Record<string, Ligne[]> = {
    client: [absorbee, absorbante],
    clientContact: [{ id: contactId, clientId: absorbee["id"], nom: "Camille", statut: "actif" }],
    projet: [
      { id: projetId, clientId: absorbee["id"], numero: "AXI-PRJ-2026-001", titre: "Formation" },
    ],
    rencontre: [
      {
        id: rencontreId,
        source: "calendly",
        type: "visio",
        titre: "t",
        clientId: absorbee["id"],
        projetId,
        rattachementStatut: "valide",
        calendlyEventId: null,
        estTestInterne: false,
      },
    ],
    rencontreParticipant: [
      {
        id: id(9),
        rencontreId,
        role: "client",
        clientId: absorbee["id"],
        contactId,
        emailHash: "h",
      },
    ],
    fait: [
      {
        id: faitId,
        clientId: absorbee["id"],
        portee: "projet",
        projetId,
        type: "besoin",
        cle: "former",
        enonce: "",
        rencontreId,
        statut: "valide",
      },
    ],
    factureFormation: p.factureSurAbsorbee ? [{ id: id(3), clientId: absorbee["id"] }] : [],
  };
  const base = dossierEnMemoire(tables);
  return {
    base,
    absorbeeId: absorbee["id"] as string,
    absorbanteId: absorbante["id"] as string,
    contactId,
    projetId,
    rencontreId,
    faitId,
  };
}
