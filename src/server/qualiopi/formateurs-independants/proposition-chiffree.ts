/**
 * La proposition de mission CHIFFRÉE (lot L11b-ux) : les six lignes que le
 * formateur lit avant « J'accepte » (page F-8, accueil « À faire », e-mail F23).
 *
 * Le montant vient des conditions FIGÉES sur la mission (recopiées du choix,
 * `conditions-figees.ts`) et des journées de la session, calculé par la même
 * règle que la lettre (`honorairesProposition` → `honorairesLettre`). Une
 * mission sans tarif figé (proposée avant les cartes, ou à un salarié) n'a pas
 * de montant : `null`, et les écrans gardent leur forme d'avant.
 *
 * Module NEUTRE (Prisma seulement) : le worker le charge. Ne lève jamais.
 */

import { prisma } from "@/lib/prisma";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";

import { eurosCourts, honorairesProposition, ligneJour, sessionADistance } from "./choix-formateur";
import { interrupteurAllume } from "./interrupteur-allume";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";

export interface PropositionChiffree {
  readonly intitule: string;
  /** Une ligne par journée, « mardi 4 novembre · matin et après-midi ». */
  readonly lignesJours: ReadonlyArray<string>;
  /** Adresse, ou « à distance ». */
  readonly lieu: string;
  readonly ligneHonoraires: string;
  readonly ligneDeplacement: string;
  /** Forfait par journée de déplacement ; `null` = compris. */
  readonly forfaitParJourHtCents: number | null;
  readonly totalHtCents: number;
}

function dateCivile(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** La proposition chiffrée d'une mission, ou `null` (pas de tarif figé, pas de journée). */
export async function lirePropositionChiffree(
  missionId: string,
): Promise<PropositionChiffree | null> {
  try {
    const m = await prisma.missionFormateur.findUnique({
      where: { id: missionId },
      select: {
        tarifHtCents: true,
        forfaitDeplacementParJourHtCents: true,
        session: {
          select: {
            titreSession: true,
            lieuType: true,
            modalite: true,
            lieuIntitule: true,
            lieuAdresse: true,
            lieuCodePostal: true,
            lieuVille: true,
            lieuSalle: true,
            lieuVisioUrl: true,
            jours: { select: { date: true, heureDebut: true, heureFin: true } },
          },
        },
      },
    });
    if (m === null || m.tarifHtCents === null) return null;
    const s = m.session;
    const jours = [...s.jours]
      .map((j) => ({ date: dateCivile(j.date), heureDebut: j.heureDebut, heureFin: j.heureFin }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const distanciel = sessionADistance(s);
    const h = honorairesProposition({
      jours,
      tarifJourneeHtCents: m.tarifHtCents,
      forfaitDeplacementParJourHtCents: m.forfaitDeplacementParJourHtCents,
      distanciel,
    });
    if (h === null) return null;
    return {
      intitule: s.titreSession,
      lignesJours: jours.map(ligneJour),
      lieu: distanciel
        ? "à distance"
        : (formatLieu({
            ...s,
            lieuType: s.lieuType as "sur_site" | "nos_locaux" | "distanciel" | null,
          }) ?? "lieu communiqué par Axion"),
      ligneHonoraires: h.ligneHonoraires,
      ligneDeplacement: h.ligneDeplacement,
      forfaitParJourHtCents:
        h.deplacementHtCents > 0 ? (m.forfaitDeplacementParJourHtCents ?? null) : null,
      totalHtCents: h.totalHtCents,
    };
  } catch {
    return null;
  }
}

/** La variante « honoraires » du gabarit partagé F23 (`formateur-mission-proposee`). */
export const VARIANTE_F23_HONORAIRES = "honoraires";

/**
 * Les champs à ajouter au payload de F23 pour la variante chiffrée, ou `null`.
 *
 * Trois conditions : interrupteur `formateurs.choix_cartes` allumé, la
 * variante validée par Will (interrupteur `textes_valides` ET registre, par
 * VARIANTE : `textes_valides.formateur-mission-proposee#honoraires`), et une
 * mission chiffrée. Sinon l'ANCIEN texte part, inchangé octet pour octet.
 */
export async function champsF23Honoraires(
  missionId: string,
): Promise<Record<string, unknown> | null> {
  try {
    if (!(await interrupteurAllume("choix_cartes"))) return null;
    const etats = await lireEtatsInterrupteurs();
    if (!lireDrapeauEnvoi(etats, "textes_valides")) return null;
    const registre = await lireTextesValides();
    if (!estTexteValide(registre, "formateur-mission-proposee", VARIANTE_F23_HONORAIRES)) {
      return null;
    }
    const p = await lirePropositionChiffree(missionId);
    if (p === null) return null;
    return {
      variante: VARIANTE_F23_HONORAIRES,
      lignesJours: [...p.lignesJours],
      lieuMission: p.lieu,
      ligneHonoraires: p.ligneHonoraires,
      ligneDeplacement:
        p.forfaitParJourHtCents === null
          ? "compris"
          : `forfait de ${eurosCourts(p.forfaitParJourHtCents)} HT par journée de déplacement`,
    };
  } catch {
    return null;
  }
}
