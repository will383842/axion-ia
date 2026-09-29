/**
 * Le DIALOGUE ENTRELACÉ envoyé à P1 (plan §3.12 ; `compte-rendu-et-extraction.md` §5.2).
 *
 * Les deux pistes (le son de l'onglet Meet = le client ; le micro = Williams)
 * sont transcrites séparément, tranche par tranche. Ce module les ENTRELACE
 * par l'horodatage en un seul dialogue, numéroté `S0001`, `S0002`… — ces
 * identifiants sont ceux que P1 cite dans ses preuves, et que la vérification
 * (V1) retraduit en segments réels.
 *
 *   · un segment HORS ACCORD (une personne arrivée sans accord, son coupé) ou
 *     APRÈS UN REFUS n'est JAMAIS transmis : il n'entre pas dans le dialogue ;
 *   · la piste de Williams s'étiquette `AXION` ; chaque voix de la piste
 *     client (`A`, `B`… de la diarisation), dans l'ordre où elle apparaît,
 *     `CLIENT_1`, `CLIENT_2`… ;
 *   · le texte est NEUTRALISÉ (G17) : aucun chevron ne peut fermer la balise
 *     `<transcription>` depuis une parole.
 *
 * Module PUR.
 */

import type { SegmentDuJour } from "./verification/g01-citation";
import { neutraliserDonnees } from "./verification/regles";

/** Un segment tel que stocké (texte DÉCHIFFRÉ en mémoire du worker). */
export interface SegmentStocke {
  readonly ordre: number;
  readonly piste: "client" | "axion";
  /** Millisecondes depuis le début de la rencontre. */
  readonly debutMs: number;
  readonly finMs: number;
  readonly locuteurBrut: string | null;
  readonly texte: string;
  readonly horsAccord: boolean;
  readonly apresRefus: boolean;
}

export interface Periode {
  readonly debutMs: number;
  readonly finMs: number;
}

/**
 * Vrai si le segment (en epoch ms) chevauche une fenêtre hors accord (en ms
 * depuis le début de la CAPTURE, telle que l'extension l'envoie).
 */
export function estHorsAccord(
  segmentEpoch: Periode,
  fenetres: readonly Periode[],
  debutCaptureEpochMs: number,
): boolean {
  return fenetres.some(
    (f) =>
      segmentEpoch.debutMs < debutCaptureEpochMs + f.finMs &&
      segmentEpoch.finMs > debutCaptureEpochMs + f.debutMs,
  );
}

export function horodatage(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export interface Dialogue {
  /** Les segments TRANSMIS, dans l'ordre, avec leur identifiant du jour. */
  readonly segments: readonly SegmentDuJour[];
  /** `S0003` → ordre du segment stocké (pour retrouver la ligne en base). */
  readonly ordreParId: ReadonlyMap<string, number>;
  /** Le texte envoyé dans `<transcription>`. */
  readonly texte: string;
  /** Voix de la piste client, dans l'ordre d'apparition (`A`, `B`…). */
  readonly voixClient: readonly string[];
}

/** Entrelace les deux pistes. Seuls les segments transmissibles entrent. */
export function entrelacer(segments: readonly SegmentStocke[]): Dialogue {
  const transmis = segments
    .filter((s) => !s.horsAccord && !s.apresRefus && s.texte.trim() !== "")
    .sort(
      (a, b) =>
        a.debutMs - b.debutMs ||
        a.finMs - b.finMs ||
        (a.piste === b.piste ? 0 : a.piste === "axion" ? -1 : 1) ||
        a.ordre - b.ordre,
    );
  const voixClient: string[] = [];
  const largeur = Math.max(4, String(transmis.length).length);
  const sortie: SegmentDuJour[] = [];
  const ordreParId = new Map<string, number>();
  for (const [i, s] of transmis.entries()) {
    let etiquette = "AXION";
    if (s.piste === "client") {
      const voix = s.locuteurBrut ?? "A";
      if (!voixClient.includes(voix)) voixClient.push(voix);
      etiquette = `CLIENT_${voixClient.indexOf(voix) + 1}`;
    }
    const id = `S${String(i + 1).padStart(largeur, "0")}`;
    sortie.push({
      id,
      piste: s.piste,
      debutMs: s.debutMs,
      finMs: s.finMs,
      etiquette,
      texte: s.texte,
    });
    ordreParId.set(id, s.ordre);
  }
  const texte = sortie
    .map((s) => `[${s.id} ${horodatage(s.debutMs)} ${s.etiquette}] ${neutraliserDonnees(s.texte)}`)
    .join("\n");
  return { segments: sortie, ordreParId, texte, voixClient };
}
