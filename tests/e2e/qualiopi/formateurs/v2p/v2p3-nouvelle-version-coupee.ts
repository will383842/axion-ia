// V2P3 — Nouvelle version du contrat (F45) : la direction COUPE
// `formateurs.nouvelle_version_contrat`. La page d'allumage promet « Couper (rien
// n'est émis ni envoyé) ». Les relances F45 (J+7, J+21) continuent-elles ?
//
// Deux formateurs dont la nouvelle version est partie il y a 8 jours (F45 de départ).
// Témoin : clé allumée par la console, le VRAI passage (campagne du registre,
// restreinte à la fiche) relance à J+7. Puis la clé est COUPÉE par la console et le
// passage repasse sur la seconde fiche : on compte ce qu'il enfile, et les liens de
// signature qu'il émet (une relance F45 émet un lien neuf, qui révoque le précédent).

import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

import {
  basculer,
  creerAdmin,
  dansLaFenetre,
  formateurAvecContrat,
  lignesCloses,
  menage,
  prisma,
  remettreInterrupteurs,
  type LigneEnvoi,
} from "./outils";

const F45 = "formateur-contrat-nouvelle-version";

export interface ObservationsV2p3 {
  readonly adresses: string[];
  readonly allume: boolean;
  readonly coupe: boolean;
  readonly temoin: { envoyes: number; lignes: LigneEnvoi[] };
  readonly apresCoupure: { envoyes: number; lignes: LigneEnvoi[]; liensEmis: number };
}

export default async function v2p3(): Promise<ObservationsV2p3> {
  try {
    const direction = await creerAdmin("super_admin");
    const campagne = REGISTRE_CAMPAGNES.find((c) => c.id === "contrat-version-relance");
    if (campagne === undefined) throw new Error("banc : campagne F45 absente du registre");
    const passage = (trainerId: string) =>
      passerCampagnes(dansLaFenetre(), {
        registre: [
          {
            ...campagne,
            lireFaits: async (m: Date) =>
              (await campagne.lireFaits(m)).filter((f) => f.entityId === trainerId),
          },
        ],
      });
    const temoin = await formateurAvecContrat(F45, 8);
    const coupee = await formateurAvecContrat(F45, 8);

    const allume = (await basculer(direction, "nouvelle_version_contrat", true)).ok;
    const p1 = await passage(temoin.id);
    const lignesTemoin = await lignesCloses(temoin.email, 2, 60_000);

    const coupe = (await basculer(direction, "nouvelle_version_contrat", false)).ok;
    const p2 = await passage(coupee.id);
    const lignesCoupee = await lignesCloses(coupee.email, p2.envoyes > 0 ? 2 : 1, 60_000);
    const liensEmis = await prisma.documentSignatureToken.count({
      where: { documentGenereId: coupee.documentId },
    });

    return {
      adresses: [temoin.email, coupee.email],
      allume,
      coupe,
      temoin: { envoyes: p1.envoyes, lignes: lignesTemoin },
      // Un lien vivant existait déjà : au-delà de 1, le passage en a émis un neuf.
      apresCoupure: { envoyes: p2.envoyes, lignes: lignesCoupee, liensEmis: liensEmis - 1 },
    };
  } finally {
    await remettreInterrupteurs();
    await menage();
  }
}
