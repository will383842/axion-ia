/**
 * Relevé mensuel des apporteurs : PASSAGE QUOTIDIEN du worker (lot 4c, plan § 7).
 *
 * Il PRÉPARE, il n'ENVOIE JAMAIS (D7) : aucun import de `envoi.ts`, aucun e-mail à un apporteur.
 * À partir du 1ᵉʳ jour ouvré de M+1 (heure de Paris) : reprise des `envoi_en_cours` (lecture du
 * journal et de la file seulement), préparation de TOUTES les tranches de la période M, puis UNE
 * alerte interne « prêts à vérifier » (clé `releve-mensuel-pret-AAAA-MM`). Le dirigeant vérifie
 * puis clique : c'est le seul envoi. Un passage quotidien donne le rattrapage si le worker était
 * arrêté. Table absente (migration pas encore passée) : passage sauté, journalisé.
 * Sans `server-only` : atteint par le worker (`tsx`).
 */
import { jourParis, libelleMois } from "../autofacture-donnees";
import { alerteInterne } from "../alerte-interne";
import { signalerErreurReseau } from "../signaler";
import { moisParis, moisPrecedent, premierJourOuvre } from "./periode";
import { anomaliesDeCompletude, preparerTranche } from "./preparation";
import { abandonnerLotsMorts, reprendreEnvoisEnCours } from "./reprise";

const TRANCHES_MAX = 200;

export interface ResultatPassageReleves {
  statut: "hors_fenetre" | "table_absente" | "ok";
  periode: string | null;
  crees: number;
  echecs: number;
  reste: number;
  alerte: boolean;
}

const VIDE = { crees: 0, echecs: 0, reste: 0, alerte: false } as const;

function tableAbsente(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "P2021";
}

export async function passerReleveMensuel(
  maintenant: Date = new Date(),
): Promise<ResultatPassageReleves> {
  const periode = moisPrecedent(maintenant);
  if (jourParis(maintenant) < premierJourOuvre(moisParis(maintenant))) {
    return { statut: "hors_fenetre", periode: null, ...VIDE };
  }
  try {
    await reprendreEnvoisEnCours(maintenant);
    await abandonnerLotsMorts(maintenant);

    let crees = 0;
    let echecs = 0;
    let reste = 0;
    for (let i = 0; i < TRANCHES_MAX; i += 1) {
      const t = await preparerTranche(periode, maintenant);
      crees += t.crees;
      echecs += t.echecs.length;
      reste = t.reste;
      // Fini, ou aucun progrès (cibles en échec) : inutile de boucler, le lendemain rattrape.
      if (t.reste === 0 || t.crees === 0) break;
    }

    const manquants = await anomaliesDeCompletude(periode);
    const mois = libelleMois(periode);
    let alerte = false;
    if (manquants.length === 0 && echecs === 0 && reste === 0) {
      alerte = await alerteInterne({
        jobId: `releve-mensuel-pret-${periode}`,
        code: "releve-mensuel-pret",
        titre: `Relevés de ${mois} prêts à vérifier`,
        message:
          `Les relevés de ${mois} sont préparés. Aucun e-mail n'est parti : vérifiez les PDF, ` +
          "puis cliquez « Envoyer les relevés à tout le monde ».",
        cibleType: "ReleveMensuelPeriode",
        cibleId: periode,
        chemin: `apporteurs/releves/${periode}`,
        maintenant,
      });
    } else {
      // Une seule alerte « incomplet » par jour : le rattrapage du lendemain en redit une autre.
      alerte = await alerteInterne({
        jobId: `releve-mensuel-incomplet-${periode}-${jourParis(maintenant)}`,
        code: "releve-mensuel-incomplet",
        titre: `Relevés de ${mois} : préparation incomplète`,
        message:
          `${manquants.length} apporteur(s) attendu(s) sans relevé, ${echecs} échec(s) de préparation. ` +
          "Rien n'est envoyé ; ouvrez l'écran de vérification.",
        cibleType: "ReleveMensuelPeriode",
        cibleId: periode,
        chemin: `apporteurs/releves/${periode}`,
        niveau: "critique",
        maintenant,
      });
    }
    return { statut: "ok", periode, crees, echecs, reste, alerte };
  } catch (err) {
    if (tableAbsente(err)) {
      console.warn("[apporteur-crons] relevé mensuel : table absente, passage sauté");
      return { statut: "table_absente", periode, ...VIDE };
    }
    signalerErreurReseau("relevé mensuel : passage quotidien", err);
    throw err;
  }
}
