/**
 * Relevé mensuel des apporteurs : RELEVÉ RECTIFICATIF (lot 4b, plan § 2.4 et § 6.5).
 *
 * Un relevé envoyé ne change jamais (trigger SQL) : une erreur se corrige par un rectificatif,
 * ligne NEUVE `rang = max + 1`, numéro `<origine>-Rk`, lien `rectifieId`, mention « Rectifie le
 * relevé n° … du … » sur le PDF. L'original reste intact. Le rectificatif est créé `prepare` et
 * N'EST PAS ENVOYÉ ici : aucun envoi sans le clic du dirigeant (le bouton global ne vise que
 * `rang = 0`). Aucun montant recalculé hors de `calcul.ts`.
 */
import { prisma } from "@/lib/prisma";

import { calculerReleve } from "./calcul";
import { empreinteControle } from "./empreinte";
import { lireEntreeReleve } from "./lecture";
import { formaterNumeroReleve } from "./numerotation";
import { rendreEtStockerPdfReleve } from "./pdf";
import { cleR2Releve, colonnesDeContenu, entetePdf } from "./preparation";
import type { ContenuReleveV1 } from "./types";

export type ResultatRectificatif =
  { ok: true; id: string; numero: string } | { ok: false; message: string };

const refus = (message: string): ResultatRectificatif => ({ ok: false, message });

export const numeroRectificatif = (numeroOrigine: string, rang: number): string => {
  const m = /^REL-(\d{4}-\d{2})-(\d{4})$/.exec(numeroOrigine);
  if (!m || rang < 1) throw new Error(`numéro d'origine invalide : ${numeroOrigine}`);
  return formaterNumeroReleve(m[1]!, Number(m[2]), rang);
};

/**
 * Établit le rectificatif de la version ENVOYÉE la plus récente de la période, à partir des
 * données d'aujourd'hui, bornées par la coupure fixe de la période.
 */
export async function etablirRectificatif(
  releveId: string,
  maintenant: Date = new Date(),
): Promise<ResultatRectificatif> {
  const cible = await prisma.releveMensuelApporteur.findUnique({
    where: { id: releveId },
    select: {
      id: true,
      numero: true,
      apporteurId: true,
      periode: true,
      rang: true,
      statut: true,
      contenu: true,
      envoyeAt: true,
      prepareAt: true,
    },
  });
  if (!cible) return refus("Relevé inconnu.");
  if (cible.statut !== "envoye") {
    return refus("Seul un relevé déjà envoyé se rectifie : un relevé préparé se recalcule.");
  }
  const versions = await prisma.releveMensuelApporteur.findMany({
    where: { apporteurId: cible.apporteurId, periode: cible.periode },
    orderBy: { rang: "desc" },
    select: { id: true, numero: true, rang: true, statut: true },
  });
  const derniere = versions[0];
  if (!derniere || derniere.id !== cible.id) {
    return refus(
      derniere && derniere.statut !== "envoye"
        ? "Un rectificatif est déjà en préparation pour cette période."
        : "Rectifiez la version la plus récente de la période.",
    );
  }
  const origine = versions.find((v) => v.rang === 0);
  if (!origine) return refus("Relevé d'origine introuvable.");

  const entree = await lireEntreeReleve(cible.apporteurId, cible.periode, maintenant);
  const { contenu } = calculerReleve(entree);
  if (
    empreinteControle(contenu) === empreinteControle(cible.contenu as unknown as ContenuReleveV1)
  ) {
    return refus("Aucun changement depuis le relevé envoyé : rien à rectifier.");
  }

  const rang = derniere.rang + 1;
  const numero = numeroRectificatif(origine.numero, rang);
  const colonnes = colonnesDeContenu(contenu);
  let id: string;
  try {
    const ligne = await prisma.releveMensuelApporteur.create({
      data: {
        numero,
        apporteurId: cible.apporteurId,
        periode: cible.periode,
        rang,
        rectifieId: cible.id,
        coupureAt: new Date(contenu.coupureAt),
        prepareAt: maintenant,
        ...colonnes,
      },
      select: { id: true },
    });
    id = ligne.id;
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "P2002") {
      return refus("Un rectificatif existe déjà pour cette période.");
    }
    throw err;
  }
  const pdf = await rendreEtStockerPdfReleve(
    contenu,
    cleR2Releve(cible.apporteurId, numero, colonnes.empreinteSha256),
    await entetePdf(cible.apporteurId, numero, {
      numero: cible.numero,
      date: (cible.envoyeAt ?? cible.prepareAt).toISOString().slice(0, 10),
    }),
  );
  await prisma.releveMensuelApporteur.updateMany({
    where: { id, statut: "prepare" },
    data: { pdfR2Key: pdf.r2Key, pdfSha256: pdf.sha256 },
  });
  return { ok: true, id, numero };
}
