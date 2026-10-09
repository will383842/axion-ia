// Réseau d'apporteurs — après le choix de Williams sur une commande « à attribuer » (contrat 2.6,
// art. 3.1 ; relecture de a1, 09/10/2026) :
//   · chaque apporteur candidat ÉCARTÉ est informé par écrit, avec le motif, et peut contester
//     (gabarit `apporteur-commande-non-attribuee`) — jamais l'identité d'un autre apporteur ;
//   · l'apporteur choisi reçoit l'annonce « commande signée », comme une commande attribuée
//     d'office (même clé que le passage : jamais deux annonces).

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { envoyer } from "./envois";
import { signalerErreurReseau } from "./signaler";

const MOTIF_PAR_DEFAUT =
  "la commande a été passée par un établissement de l'entreprise qui ne vous est pas attribué.";

async function lirePresentation(id: string) {
  return prisma.presentationEntreprise.findUnique({
    where: { id },
    select: {
      id: true,
      denomination: true,
      apporteurId: true,
      apporteur: { select: { prenom: true, nom: true, email: true } },
    },
  });
}

export async function notifierDecisionAttribution(e: {
  factureId: string;
  choisie: string | null;
  ecartes: readonly string[];
  motif: string;
}): Promise<void> {
  try {
    for (const id of e.ecartes) {
      const p = await lirePresentation(id);
      if (!p) continue;
      await envoyer({
        gabarit: "apporteur-commande-non-attribuee",
        destinataire: decryptPii(p.apporteur.email) ?? "",
        payload: {
          contactName: decryptPii(p.apporteur.prenom) ?? "",
          entreprise: p.denomination,
          motif: e.motif || MOTIF_PAR_DEFAUT,
        },
        entityType: "PresentationEntreprise",
        entityId: p.id,
        jobId: `apporteur-commande-non-attribuee-${e.factureId}-${p.id}`,
      });
    }
    if (e.choisie) {
      const p = await lirePresentation(e.choisie);
      const f = await prisma.factureFormation.findUnique({
        where: { id: e.factureId },
        select: { devisId: true },
      });
      if (p) {
        await envoyer({
          gabarit: "apporteur-commande-signee",
          destinataire: decryptPii(p.apporteur.email) ?? "",
          payload: {
            contactName: [decryptPii(p.apporteur.prenom), decryptPii(p.apporteur.nom)]
              .filter(Boolean)
              .join(" "),
            entreprise: p.denomination,
          },
          entityType: "PresentationEntreprise",
          entityId: p.id,
          // Même clé que le passage (`etapeCommandeSignee`) quand la commande a un devis.
          jobId: f?.devisId
            ? `apporteur-commande-signee-${f.devisId}-${p.apporteurId}`
            : `apporteur-commande-signee-facture-${e.factureId}-${p.apporteurId}`,
        });
      }
    }
  } catch (err) {
    // Prévenir ne fait jamais échouer la décision, déjà écrite et tracée.
    signalerErreurReseau("notification d'attribution", err);
  }
}
