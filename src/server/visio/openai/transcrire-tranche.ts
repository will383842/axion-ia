/**
 * TRANSCRIRE UNE TRANCHE de 180 s d'une piste (ADR 0055 ; LOTS-EXECUTION §1.2).
 *
 *   1. plafond de dépense vérifié AVANT l'appel ;
 *   2. `gpt-4o-transcribe-diarize`, `diarized_json`, `language: "fr"` ;
 *   3. dépense écrite APRÈS l'appel — même si la réponse est ensuite refusée
 *      (on a été facturé) ;
 *   4. réponse REVALIDÉE par Zod (`ReponseDiarizee`) : le SDK ne la type pas ;
 *   5. CONTRÔLE DE TRONCATURE : le modèle rend au plus 2 000 jetons de sortie.
 *      Si le dernier segment finit à plus de 20 s de la fin de la tranche ET
 *      que la piste n'était pas muette à la fin (niveau mesuré par
 *      l'extension), la sortie a été coupée : la tranche passe en échec
 *      `sortie_tronquee`, JAMAIS prise pour complète.
 *
 * Les horodatages rendus (secondes depuis le début du FICHIER) sont convertis
 * en millisecondes depuis le début de la RENCONTRE (`decalageMs` =
 * début de capture de la tranche − début réel de la rencontre).
 *
 * Aucune parole n'est journalisée ici, ni dans les erreurs.
 */

import { z } from "zod";

import { LANGUE_TRANSCRIPTION, MODELE_TRANSCRIPTION, ESTIMATION_TRANCHE_USD } from "./modeles";
import type { ClientOpenAIVisio } from "./client";
import { apresAppel, appelAnnuleEnVol, avantAppel, type PortCout } from "./cout";
import { AppelInterrompu, classerErreurOpenAI, ErreurVisio } from "./erreurs";
import type { UsageAppel } from "./tarifs";

/** Écart toléré entre la fin du dernier segment et la fin de la tranche. */
export const TOLERANCE_TRONCATURE_MS = 20_000;

/** La réponse `diarized_json` telle que le circuit l'accepte. */
export const ReponseDiarizee = z.object({
  text: z.string(),
  segments: z.array(
    z.object({
      start: z.number().nonnegative(),
      end: z.number().nonnegative(),
      speaker: z.string().min(1).max(8),
      text: z.string(),
    }),
  ),
  usage: z
    .union([
      z.object({
        type: z.literal("tokens"),
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      }),
      z.object({ type: z.literal("duration"), seconds: z.number().nonnegative() }),
    ])
    .nullish(),
});
export type ReponseDiarizee = z.infer<typeof ReponseDiarizee>;

/** Un segment rendu, en millisecondes depuis le début de la rencontre. */
export interface SegmentTranscrit {
  readonly debutMs: number;
  readonly finMs: number;
  readonly locuteurBrut: string;
  readonly texte: string;
}

export interface TrancheATranscrire {
  readonly octets: Buffer;
  readonly dureeMs: number;
  /** Niveau mesuré par l'extension à la fin de la tranche (null = inconnu). */
  readonly niveauFinMuet: boolean | null;
  readonly decalageMs: number;
  readonly jobId: string;
}

export interface DepsTranscription {
  readonly client: ClientOpenAIVisio;
  readonly cout: PortCout;
}

function usageDe(brut: unknown): UsageAppel {
  const u = (brut as { usage?: unknown } | null)?.usage as
    { type?: string; input_tokens?: number; output_tokens?: number; seconds?: number } | undefined;
  if (u?.type === "tokens") {
    return {
      jetonsEntree: u.input_tokens ?? 0,
      jetonsEntreeEnCache: 0,
      jetonsSortie: u.output_tokens ?? 0,
      secondesAudio: null,
    };
  }
  if (u?.type === "duration") {
    return {
      jetonsEntree: 0,
      jetonsEntreeEnCache: 0,
      jetonsSortie: 0,
      secondesAudio: u.seconds ?? 0,
    };
  }
  return { jetonsEntree: 0, jetonsEntreeEnCache: 0, jetonsSortie: 0, secondesAudio: null };
}

/** Vrai si la sortie a manifestement été coupée avant la fin de la tranche. */
export function trancheTronquee(
  segments: ReadonlyArray<{ readonly end: number }>,
  dureeMs: number,
  niveauFinMuet: boolean | null,
): boolean {
  if (niveauFinMuet === true) return false;
  const finDernier = segments.reduce((max, s) => Math.max(max, s.end * 1000), 0);
  return finDernier < dureeMs - TOLERANCE_TRONCATURE_MS;
}

/** Transcrit une tranche. Lève une `ErreurVisio` classée. */
export async function transcrireTranche(
  deps: DepsTranscription,
  t: TrancheATranscrire,
): Promise<SegmentTranscrit[]> {
  await avantAppel(deps.cout, ESTIMATION_TRANCHE_USD);
  let brut: unknown;
  try {
    brut = await deps.client.transcrire({
      octets: t.octets,
      modele: MODELE_TRANSCRIPTION,
      langue: LANGUE_TRANSCRIPTION,
    });
  } catch (err) {
    if (err instanceof AppelInterrompu) {
      if (err.envoye) {
        await appelAnnuleEnVol(deps.cout, {
          jobId: t.jobId,
          modele: MODELE_TRANSCRIPTION,
          estimationUsd: ESTIMATION_TRANCHE_USD,
        });
      }
      throw err;
    }
    throw classerErreurOpenAI(err);
  }
  await apresAppel(deps.cout, {
    jobId: t.jobId,
    modele: MODELE_TRANSCRIPTION,
    usage: usageDe(brut),
  });

  const lu = ReponseDiarizee.safeParse(brut);
  if (!lu.success) {
    throw new ErreurVisio("contenu", "sortie_invalide", "réponse de transcription invalide");
  }
  if (trancheTronquee(lu.data.segments, t.dureeMs, t.niveauFinMuet)) {
    throw new ErreurVisio("contenu", "sortie_tronquee", "transcription coupée avant la fin");
  }
  return lu.data.segments
    .filter((s) => s.text.trim() !== "")
    .map((s) => ({
      debutMs: Math.round(s.start * 1000) + t.decalageMs,
      finMs: Math.round(s.end * 1000) + t.decalageMs,
      locuteurBrut: s.speaker.slice(0, 8),
      texte: s.text.trim(),
    }));
}
