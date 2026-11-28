import { prisma } from "@/lib/prisma";
import {
  dateDeCommande,
  lirePresentationsProtegees,
  presentationPourEtablissement,
} from "@/features/apporteurs-reseau/passage-quotidien";
import {
  lireEtablissements,
  lireSiretsDevis,
  siretDeLaCommande,
} from "@/features/apporteurs-reseau/etablissement-presentation";

/**
 * Vrai si la facture porte, ou portera, une commission d'apporteur :
 *  - elle-même ou une facture sœur du même devis (acompte / solde) porte une commission non
 *    annulée (même périmètre que la reprise, avoir-client.ts, et que le garde-fou de
 *    garanties-journee-ia.ts) ;
 *  - ou son client est couvert par une présentation d'apporteur protégée qui commissionnerait la
 *    commande, même si la ligne n'est pas encore créée (le passage quotidien la crée une fois la
 *    commande soldée, nette des avoirs). Même lecture que le passage quotidien, pas une seconde.
 * Lecture seule.
 */
export async function factureCommissionneeParApporteur(factureId: string): Promise<boolean> {
  const facture = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      devisId: true,
      emiseAt: true,
      devis: { select: { acceptedAt: true } },
      client: { select: { siren: true, siret: true } },
    },
  });
  if (!facture) return false;
  const soeurs = facture.devisId
    ? await prisma.factureFormation.findMany({
        where: { devisId: facture.devisId, avoirDeId: null },
        select: { id: true },
      })
    : [];
  const n = await prisma.commissionApporteur.count({
    where: {
      factureId: { in: [facture.id, ...soeurs.map((f) => f.id)] },
      statut: { not: "annulee" },
    },
  });
  if (n > 0) return true;
  return presentationCouvreLaCommande(facture);
}

async function presentationCouvreLaCommande(facture: {
  devisId: string | null;
  emiseAt: Date | null;
  devis: { acceptedAt: Date | null } | null;
  client: { siren: string | null; siret: string | null } | null;
}): Promise<boolean> {
  const siren = facture.client?.siren;
  const signeeAt = dateDeCommande({ devis: facture.devis, emiseAt: facture.emiseAt });
  if (!siren || !signeeAt) return false;
  const candidates = (await lirePresentationsProtegees()).filter((p) => p.siren === siren);
  if (candidates.length === 0) return false;
  const etablissements = await lireEtablissements(candidates.map((p) => p.id));
  const siretsDevis = await lireSiretsDevis(facture.devisId ? [facture.devisId] : []);
  const siret = siretDeLaCommande({
    devisSiret: facture.devisId ? siretsDevis.get(facture.devisId) : null,
    clientSiret: facture.client?.siret,
  });
  // « À attribuer » compte aussi : la commande sera commissionnée dès que Williams aura choisi.
  return presentationPourEtablissement(candidates, etablissements, signeeAt, siret) !== null;
}

export const MESSAGE_AVOIR_COMMISSION =
  "Cette facture porte ou portera une commission d'apporteur : un avoir la reprend au prorata. Un bon d'achat offert à titre exceptionnel (geste commercial) ne la reprend pas : cochez « Geste commercial ». Sinon, cochez la confirmation pour un vrai remboursement.";
