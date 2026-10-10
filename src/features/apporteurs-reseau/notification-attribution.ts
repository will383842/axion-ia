// Réseau d'apporteurs — après le choix de Williams sur une commande « à attribuer » (contrat 2.6,
// art. 3.1 ; relectures de a1, 09/10/2026) :
//   · chaque apporteur candidat ÉCARTÉ est informé par écrit, avec un motif EXACT, et peut
//     contester (gabarit `apporteur-commande-non-attribuee`) — jamais l'identité d'un autre ;
//     l'information est une obligation (art. 3.1) : un envoi PAR destinataire, clé propre, un
//     nouvel essai, puis une alerte interne si l'envoi échoue encore ;
//   · l'apporteur choisi reçoit l'annonce « commande signée » (même clé que le passage).

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import { envoyer, type ResultatEnvoi } from "./envois";
import { lireEtablissements } from "./etablissement-presentation";
import { signalerErreurReseau } from "./signaler";

/** Le motif par défaut, exact selon le cas (relecture de a1). */
export function motifParDefaut(e: {
  siretCommande: string | null;
  siretEcarte: string | null;
  autreChoisi: boolean;
}): string {
  if (e.autreChoisi && e.siretCommande && e.siretCommande === e.siretEcarte)
    return "la commande revient à une autre déclaration de cet établissement, antérieure à la vôtre (article 3.5).";
  if (e.autreChoisi)
    return "la commande revient à l'attribution de l'établissement qui l'a passée (article 3.1).";
  if (!e.siretCommande)
    return "la commande ne porte aucun numéro SIRET permettant de la rattacher à l'établissement qui vous est attribué (article 3.1).";
  return `la commande a été passée par l'établissement SIRET ${e.siretCommande}, qui ne vous est pas attribué (article 3.1).`;
}

const PARTI = new Set<ResultatEnvoi>(["envoye", "en-validation", "retenu"]);

/** Un envoi, un nouvel essai ; rend vrai s'il est parti (ou gardé pour validation). */
async function envoyerAvecReprise(e: Parameters<typeof envoyer>[0]): Promise<boolean> {
  for (let essai = 0; essai < 2; essai++) {
    try {
      if (PARTI.has(await envoyer(e))) return true;
    } catch {
      // nouvel essai
    }
  }
  return false;
}

async function alerterEchec(factureId: string, presentationId: string) {
  try {
    await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_information_non_envoyee",
        titre: "Apporteur écarté NON informé : à prévenir à la main",
        message:
          "L'e-mail qui informe un apporteur candidat écarté d'une commande (contrat 2.6, art. 3.1 : information écrite et motivée) n'a pas pu partir. Prévenez-le à la main, ou relancez l'envoi depuis l'outbox des e-mails.",
        cibleType: "PresentationEntreprise",
        cibleId: presentationId,
        createdAt: new Date().toLocaleDateString("fr-FR"),
      },
      { jobId: `apporteur-non-attribuee-echec-${factureId}-${presentationId}` },
    );
  } catch (err) {
    signalerErreurReseau("alerte : apporteur écarté non informé", err);
  }
}

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
  siretCommande: string | null;
}): Promise<void> {
  const etabs = await lireEtablissements([...e.ecartes]).catch(() => new Map());
  for (const id of e.ecartes) {
    try {
      const p = await lirePresentation(id);
      if (!p) continue;
      const motif =
        e.motif ||
        motifParDefaut({
          siretCommande: e.siretCommande,
          siretEcarte: etabs.get(id)?.siret ?? null,
          autreChoisi: e.choisie !== null,
        });
      const parti = await envoyerAvecReprise({
        gabarit: "apporteur-commande-non-attribuee",
        destinataire: decryptPii(p.apporteur.email) ?? "",
        payload: {
          contactName: decryptPii(p.apporteur.prenom) ?? "",
          entreprise: p.denomination,
          motif,
        },
        entityType: "PresentationEntreprise",
        entityId: p.id,
        jobId: `apporteur-commande-non-attribuee-${e.factureId}-${p.id}`,
      });
      if (!parti) await alerterEchec(e.factureId, p.id);
    } catch (err) {
      signalerErreurReseau("notification d'attribution : écarté", err);
      await alerterEchec(e.factureId, id);
    }
  }
  if (!e.choisie) return;
  try {
    const p = await lirePresentation(e.choisie);
    const f = await prisma.factureFormation.findUnique({
      where: { id: e.factureId },
      select: { devisId: true },
    });
    if (!p) return;
    await envoyerAvecReprise({
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
  } catch (err) {
    signalerErreurReseau("notification d'attribution : choisi", err);
  }
}
