/**
 * ÉTAPE `precontroler` — ce que le code vérifie AVANT tout appel à la
 * rédaction (plan §3.12 ; `compte-rendu-et-extraction.md` §4.2).
 *
 *   · G0c — une phrase de refus ou de demande d'arrêt sur la piste client
 *     TRONQUE la transcription à ce segment : ce qui suit est marqué « après
 *     refus » et sa parole est EFFACÉE avant tout envoi à OpenAI ;
 *   · G0  — piste client muette : AUCUNE passe n'est appelée ; une note
 *     manuelle est proposée (échec définitif `piste_muette`) ;
 *   · G16 — l'accord du client est RETROUVÉ dans la transcription et vérifié
 *     comme une citation ; DEUX VOIX CLIENT = DEUX ACCORDS (une voix sans
 *     accord retrouvé est un signal montré à Will) ;
 *   · APRÈS « Arrêter » puis une relance, chaque enregistrement a son plan ;
 *     une demande d'arrêt dans l'un coupe tout ce qui suit ;
 *   · une DICTÉE (Williams seul, après l'appel) n'a PAS d'étape de
 *     consentement ni de contrôle de piste client : elle est rapportée par
 *     Williams (`rapporte_par_williams`).
 *
 * Le plan est une fonction PURE (`planDePrecontrole`) ; le gestionnaire ne
 * fait que lire et écrire.
 */

import { CODES_ALERTES_CIRCUIT } from "./alertes-circuit";
import type { SegmentStocke } from "./dialogue";
import { ArretVisio, type Gestionnaire } from "./etapes";
import type { DonneesPrecontrole } from "./port-donnees";
import { pisteClientMuette, tronquerALaDemandeDArret } from "./verification/g00-precontroles";
import { accordVerifieCommeUneCitation, retrouverAccords } from "./verification/g16-accord";

export interface PlanPrecontrole {
  /** Piste client muette : on s'arrête là, sans aucun appel à OpenAI. */
  readonly muette: boolean;
  /** Segments à marquer « après refus » (parole effacée). */
  readonly ordresApresRefus: readonly number[];
  /** Étapes de consentement exécutées (jamais pour une dictée). */
  readonly controleAccord: boolean;
  readonly accords: ReadonlyArray<{ readonly texte: string; readonly reponseMs: number }>;
  readonly voixClient: number;
  readonly voixSansAccord: number;
}

export function planDePrecontrole(d: DonneesPrecontrole): PlanPrecontrole {
  const utiles = d.segments.filter((s) => !s.horsAccord && !s.apresRefus);
  const { gardes, ecartes } = tronquerALaDemandeDArret<SegmentStocke>(utiles);
  const ordresApresRefus = ecartes.map((s) => s.ordre);

  if (d.nature === "dictee") {
    return {
      muette: gardes.length === 0,
      ordresApresRefus,
      controleAccord: false,
      accords: [],
      voixClient: 0,
      voixSansAccord: 0,
    };
  }
  const muette = pisteClientMuette(gardes, d.dureeMs);
  const bilan = retrouverAccords(gardes, d.accordDeclareMs);
  const accords = bilan.retrouves
    .filter((a) => accordVerifieCommeUneCitation(a, gardes))
    .map((a) => ({ texte: a.texte, reponseMs: a.debutMs }));
  return {
    muette,
    ordresApresRefus,
    controleAccord: true,
    accords,
    voixClient: bilan.voixClient.length,
    voixSansAccord: bilan.voixClient.length - accords.length,
  };
}

/**
 * Les plans de TOUS les enregistrements de la rencontre, du plus ancien au
 * plus récent. Une demande d'arrêt entendue dans l'un coupe aussi TOUT ce qui
 * suit : la parole d'une relance après un refus n'est jamais gardée.
 */
export function plansDePrecontrole(
  liste: readonly DonneesPrecontrole[],
): Array<{ readonly d: DonneesPrecontrole; readonly plan: PlanPrecontrole }> {
  let refusAvant = false;
  return liste.map((d) => {
    let plan = planDePrecontrole(d);
    if (refusAvant) {
      plan = {
        ...plan,
        muette: true,
        ordresApresRefus: d.segments
          .filter((s) => !s.horsAccord && !s.apresRefus)
          .map((s) => s.ordre),
        accords: [],
      };
    }
    if (plan.ordresApresRefus.length > 0) refusAvant = true;
    return { d, plan };
  });
}

export const precontroler: Gestionnaire = async (ctx) => {
  const { deps, t } = ctx;
  const liste = await deps.donnees.pourPrecontrole(t.rencontreId);
  if (liste.length === 0) throw new ArretVisio("audio_incomplet");
  const plans = plansDePrecontrole(liste);

  // G0c d'abord, et dans tous les cas : la parole d'après un refus est
  // effacée même si l'on s'arrête ensuite.
  const coupes = plans.filter((p) => p.plan.ordresApresRefus.length > 0);
  if (coupes.length > 0) {
    await ctx.ecrireEnCours(async (tx) => {
      for (const { d, plan } of coupes)
        await deps.donnees.marquerApresRefus(tx, d.transcriptionId, plan.ordresApresRefus);
    });
    await deps.alerter({
      code: CODES_ALERTES_CIRCUIT.demandeDArret,
      niveau: "important",
      titre: "Rendez-vous : une demande d'arrêt de l'enregistrement a été entendue",
      message:
        "La transcription a été coupée à cet endroit ; rien de ce qui suit n'est gardé. Vérifiez s'il faut enregistrer un retrait de l'accord.",
      rencontreId: t.rencontreId,
    });
  }
  // Muette partout (une relance courte ne sauve pas une première partie muette, et inversement).
  if (plans.every((p) => p.plan.muette)) throw new ArretVisio("piste_muette");

  return {
    ecrire: async (tx) => {
      for (const { d, plan } of plans) {
        if (plan.controleAccord && plan.accords.length > d.preuvesDejaEcrites) {
          await deps.donnees.ecrirePreuvesAccord(tx, {
            rencontreId: t.rencontreId,
            enregistrementId: d.enregistrementId,
            accords: plan.accords.slice(d.preuvesDejaEcrites),
          });
        }
        await deps.donnees.noterAuJournal(tx, d.enregistrementId, {
          type: "precontrole",
          controleAccord: plan.controleAccord,
          voixClient: plan.voixClient,
          voixSansAccord: plan.voixSansAccord,
          accordsRetrouves: plan.accords.length,
          apresRefus: plan.ordresApresRefus.length,
        });
      }
      return [{ etape: "extraire", compteRenduId: null, reinitialiser: true }];
    },
  };
};
