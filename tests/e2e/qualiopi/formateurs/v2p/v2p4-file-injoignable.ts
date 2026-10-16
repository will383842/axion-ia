// V2P4 — La file d'e-mails est INJOIGNABLE au moment où le passage des campagnes
// veut relancer le contrat-cadre (F18), puis elle revient. La relance repart-elle,
// et UNE seule fois ? Et le lien de signature du formateur survit-il à l'essai raté ?
//
// En trois processus (le spec les enchaîne) : `preparer` pose la fiche (contrat à
// signer, F16 parti il y a 5 jours) ; `passer` lance le VRAI passage (campagne F18 du
// registre, restreinte à la fiche) — une fois avec `REDIS_URL` pointé par le spec vers
// une file qui refuse toute commande, puis deux fois sur la vraie file ; `nettoyer`
// efface tout. Chaque processus a sa propre connexion à la file : c'est la seule façon
// de rendre la file injoignable pour le passage SANS la couper au worker ni aux autres.

import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

import {
  dansLaFenetre,
  effacerFormateur,
  formateurAvecContrat,
  lignesCloses,
  lignesVers,
  oublierEnvois,
  prisma,
} from "./outils";

interface Parametres {
  readonly phase: "preparer" | "passer" | "nettoyer";
  readonly trainerId?: string;
  readonly email?: string;
  readonly documentId?: string;
  /** Le spec a pointé `REDIS_URL` de CE processus vers une file qui refuse tout. */
  readonly injoignable?: boolean;
}

export default async function v2p4(p: Parametres): Promise<unknown> {
  if (p.phase === "preparer") {
    // Aucun ménage ici : la fiche doit survivre jusqu'à la phase `nettoyer`.
    const t = await formateurAvecContrat("formateur-contrat-a-signer", 5);
    return { trainerId: t.id, email: t.email, documentId: t.documentId };
  }
  const trainerId = p.trainerId ?? "∅";
  const email = p.email ?? "∅";
  if (p.phase === "nettoyer") {
    await oublierEnvois([email]);
    await effacerFormateur(trainerId);
    return { ok: true };
  }
  const campagne = REGISTRE_CAMPAGNES.find((c) => c.id === "contrat-relance");
  if (campagne === undefined) throw new Error("banc : campagne F18 absente du registre");
  let bilan: unknown;
  try {
    bilan = await passerCampagnes(dansLaFenetre(), {
      registre: [
        {
          ...campagne,
          lireFaits: async (m: Date) =>
            (await campagne.lireFaits(m)).filter((f) => f.entityId === trainerId),
        },
      ],
    });
  } catch (e) {
    bilan = { leve: e instanceof Error ? e.message : String(e) };
  }
  // Sur la vraie file, on laisse le worker clore ce qui a été enfilé.
  const lignes = p.injoignable ? await lignesVers(email) : await lignesCloses(email, 1, 60_000);
  const jetons = await prisma.documentSignatureToken.findMany({
    where: { documentGenereId: p.documentId ?? "∅", partie: "sous_traitant" },
    select: { revokedAt: true },
  });
  return {
    bilan,
    lignes,
    liensVivants: jetons.filter((j) => j.revokedAt === null).length,
    liens: jetons.length,
  };
}
