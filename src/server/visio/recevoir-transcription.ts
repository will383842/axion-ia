/**
 * ÉTAPE `transcrire` — le son déposé devient une transcription (ADR 0055 §1.2).
 *
 *   1. un enregistrement refusé, non confirmé ou abandonné n'est JAMAIS
 *      transcrit : son audio est purgé tout de suite ;
 *   2. G0b — moins de 90 s (hors refus) : on attend la réponse de Will ;
 *   3. tranche par tranche, UNE À LA FOIS (le worker a 1 Go) : les morceaux
 *      sont relus dans R2 dans l'ordre, déchiffrés, leur empreinte vérifiée
 *      contre celle annoncée par l'extension ; puis `transcrireTranche`
 *      (plafond avant, coût après, troncature contrôlée) ;
 *   4. IDEMPOTENT : une tranche `transcrite` n'est jamais refaite (une panne
 *      au milieu ne refait pas payer ce qui est déjà transcrit) ;
 *   5. un segment qui tombe dans une FENÊTRE HORS ACCORD (une personne arrivée
 *      sans accord, son coupé) est marqué `horsAccord` et sa parole n'est PAS
 *      gardée — elle ne sera jamais transmise plus loin ;
 *   6. la transcription est RETENUE, puis `precontroler` ;
 *   7. TOUS les enregistrements déposés de la rencontre sont transcrits (après
 *      « Arrêter » puis une relance, aucune partie de l'appel n'est perdue) ;
 *      un enregistrement déjà transcrit n'est pas refait, et un refus dans la
 *      rencontre arrête tout.
 */

import { createHash } from "node:crypto";

import { DUREE_TRANCHE_S } from "./audio/constantes";
import { estHorsAccord } from "./dialogue";
import { AttenteWill, type Gestionnaire } from "./etapes";
import { LANGUE_TRANSCRIPTION, MODELE_TRANSCRIPTION } from "./openai/modeles";
import { transcrireTranche } from "./openai/transcrire-tranche";
import type { EnregistrementATraiter, SegmentAEcrire, TrancheATraiter } from "./port-donnees";
import { enregistrementTropCourt } from "./verification/g00-precontroles";

/** États d'enregistrement dont le son n'est jamais transcrit. */
export const ETATS_JAMAIS_TRANSCRITS = new Set(["refuse", "accord_non_confirme", "abandonne"]);

const RANG_PISTE = { client: 0, axion: 1 } as const;

/** L'ordre (unique par transcription) d'un segment : piste, tranche, rang. */
export function ordreSegment(piste: "client" | "axion", numeroTranche: number, i: number): number {
  return RANG_PISTE[piste] * 10_000_000 + numeroTranche * 1000 + Math.min(i, 999);
}

/** Tranches à transcrire, dans l'ordre ; les incomplètes et déjà faites sont exclues. */
export function tranchesATranscrire(tranches: readonly TrancheATraiter[]): TrancheATraiter[] {
  return tranches
    .filter((t) => t.statut === "complete")
    .sort((a, b) => RANG_PISTE[a.piste] - RANG_PISTE[b.piste] || a.numero - b.numero);
}

/** États d'un enregistrement dont le son reste à transcrire (déposé, ou repris après une panne). */
export const ETATS_A_TRANSCRIRE = new Set(["depose", "en_traitement"]);

/** Un enregistrement dont le son a déjà été transcrit (une version antérieure est retenue). */
const ETATS_DEJA_TRANSCRITS = new Set(["transcrit", "compte_rendu_pret", "valide"]);

interface Transcrit {
  readonly e: EnregistrementATraiter;
  readonly transcriptionId: string;
  readonly dureeAudioMs: number;
}

export const transcrire: Gestionnaire = async (ctx) => {
  const { deps, t } = ctx;
  // TOUS les enregistrements de la rencontre : après « Arrêter » puis une
  // relance, chaque partie de l'appel est transcrite.
  const liste = await deps.donnees.aTranscrire(t.rencontreId);
  // Un refus dans la rencontre : rien n'est transcrit. Un REFUS enregistré
  // est purgé par la PR 5 (`purgerLeSonDUnRefus`) ; un arrêt pour refus
  // déclaré, ou rien de transcriptible, fait purger le son tout de suite.
  if (liste.some((e) => e.statut === "refuse")) return { ecrire: async () => [] };
  const refusDeclare = liste.some((e) => e.motifArret === "refus_participant");
  const aFaire = refusDeclare ? [] : liste.filter((e) => ETATS_A_TRANSCRIRE.has(e.statut));
  if (refusDeclare) {
    return {
      ecrire: async () => [{ etape: "purger_audio", compteRenduId: null, reinitialiser: true }],
    };
  }
  if (aFaire.length === 0) {
    // Déjà transcrit (une relance du balayage sans rien de neuf) : rien à faire.
    // Jamais transcrit (non confirmé, abandonné) : le son est purgé tout de suite.
    const dejaFait = liste.some((e) => ETATS_DEJA_TRANSCRITS.has(e.statut));
    return {
      ecrire: async () =>
        dejaFait ? [] : [{ etape: "purger_audio", compteRenduId: null, reinitialiser: true }],
    };
  }
  for (const e of aFaire) {
    const dureeMs = (e.fin ?? deps.maintenant()).getTime() - e.debut.getTime();
    if (!e.courtConfirme && enregistrementTropCourt(dureeMs, e.motifArret)) {
      throw new AttenteWill("enregistrement de moins de 90 secondes : le client a-t-il refusé ?");
    }
  }

  const faits: Transcrit[] = [];
  for (const e of aFaire) faits.push(await transcrireUn(ctx, e));

  return {
    ecrire: async (tx) => {
      for (const x of faits) {
        await deps.donnees.retenirTranscription(tx, {
          enregistrementId: x.e.id,
          transcriptionId: x.transcriptionId,
          dureeAudioSecondes: Math.round(x.dureeAudioMs / 1000),
        });
      }
      return [{ etape: "precontroler", compteRenduId: null, reinitialiser: true }];
    },
  };
};

async function transcrireUn(
  ctx: Parameters<Gestionnaire>[0],
  e: EnregistrementATraiter,
): Promise<Transcrit> {
  const { deps } = ctx;
  const toutes = [...e.tranches].sort((a, b) => a.numero - b.numero);
  const empreinteEntree = createHash("sha256")
    .update(toutes.map((x) => `${x.piste}:${x.numero}:${x.empreinteAnnoncee ?? "-"}`).join("|"))
    .digest("hex");
  const transcriptionId = await ctx.ecrireEnCours(async (tx) => {
    await deps.donnees.marquerEnregistrement(tx, e.id, "en_traitement");
    return deps.donnees.ouvrirTranscription(tx, {
      enregistrementId: e.id,
      empreinteEntree,
      modele: MODELE_TRANSCRIPTION,
      langue: LANGUE_TRANSCRIPTION,
    });
  });

  let dureeAudioMs = toutes
    .filter((x) => x.statut === "transcrite")
    .reduce((s, x) => s + (x.dureeMs ?? DUREE_TRANCHE_S * 1000), 0);
  for (const tranche of tranchesATranscrire(e.tranches)) {
    await ctx.verifierMain();
    const octets = await deps.donnees.lireSonTranche(tranche.id);
    const dureeTranche = tranche.dureeMs ?? DUREE_TRANCHE_S * 1000;
    const segments = await transcrireTranche(
      { client: deps.openai(), cout: deps.cout },
      {
        octets,
        dureeMs: dureeTranche,
        niveauFinMuet: tranche.niveauFinMuet,
        decalageMs: tranche.debutCaptureEpochMs - e.origineMs,
        jobId: `${ctx.jobId}-${e.id.slice(0, 8)}-${tranche.piste}-${tranche.numero}`,
      },
    );
    const aEcrire: SegmentAEcrire[] = segments.map((s, i) => {
      const epoch = { debutMs: s.debutMs + e.origineMs, finMs: s.finMs + e.origineMs };
      const horsAccord = estHorsAccord(epoch, e.fenetresHorsAccord, e.debut.getTime());
      return {
        ordre: ordreSegment(tranche.piste, tranche.numero, i),
        piste: tranche.piste,
        debutMs: s.debutMs,
        finMs: s.finMs,
        locuteurBrut: tranche.piste === "client" ? s.locuteurBrut : null,
        // Hors accord : la parole n'est pas gardée, seulement la place du segment.
        texte: horsAccord ? "" : s.texte,
        horsAccord,
      };
    });
    await ctx.ecrireEnCours((tx) =>
      deps.donnees.ecrireSegmentsTranche(tx, {
        transcriptionId,
        trancheId: tranche.id,
        segments: aEcrire,
      }),
    );
    dureeAudioMs += dureeTranche;
  }
  return { e, transcriptionId, dureeAudioMs };
}
