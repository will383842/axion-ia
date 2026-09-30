/**
 * G16 — L'ACCORD RETROUVÉ, VÉRIFIÉ COMME UNE CITATION (plan §3.13 ; ADR 0054).
 *
 * Le clic « Accord obtenu » de Williams est la preuve première
 * (`declaration_axion`). La transcription en apporte une seconde : la phrase
 * par laquelle le client accepte, dans les 3 minutes qui suivent l'annonce.
 *
 *   · elle est cherchée sur la piste CLIENT seulement, par une liste fermée
 *     de formules d'accord ;
 *   · elle n'est retenue que si elle se RETROUVE mot pour mot dans un segment
 *     réel du jour (même fonction que G1) — jamais une phrase reformulée ;
 *   · DEUX VOIX CLIENT = DEUX ACCORDS : chaque voix de la piste client
 *     (étiquette de diarisation `A`, `B`…) doit avoir le sien. Une voix sans
 *     accord retrouvé est un SIGNAL, montré à Will ; rien n'est validé en lot
 *     tant que la correspondance des voix n'est pas faite.
 *
 * Module PUR.
 */

import { normaliserPourCitation } from "./g01-citation";

export const FENETRE_ACCORD_MS = 180_000;

const FORMULES_D_ACCORD: readonly RegExp[] = [
  /\b(?:oui|ok|okay|d'accord|bien sur|pas de (?:souci|probleme)|allez-y|aucun (?:souci|probleme)|ca me va|volontiers|je suis d'accord|vous pouvez enregistrer)\b/,
];

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface SegmentAccord {
  readonly piste: "client" | "axion";
  readonly debutMs: number;
  readonly finMs: number;
  /** Étiquette de voix brute rendue par la transcription (`A`, `B`…). */
  readonly locuteurBrut: string | null;
  readonly texte: string;
}

export interface AccordRetrouve {
  readonly voix: string;
  readonly texte: string;
  readonly debutMs: number;
}

export interface BilanAccords {
  readonly voixClient: readonly string[];
  readonly retrouves: readonly AccordRetrouve[];
  readonly voixSansAccord: readonly string[];
}

/**
 * Cherche, pour chaque voix de la piste client, la première phrase d'accord
 * dans la fenêtre [annonce, annonce + 3 min]. `annonceMs` = instant de
 * l'accord déclaré (ms depuis le début de la rencontre) ; `null` : depuis 0.
 */
export function retrouverAccords(
  segments: readonly SegmentAccord[],
  annonceMs: number | null,
): BilanAccords {
  const debut = Math.max(0, (annonceMs ?? 0) - 60_000);
  const fin = (annonceMs ?? 0) + FENETRE_ACCORD_MS;
  const client = segments.filter((s) => s.piste === "client").sort((a, b) => a.debutMs - b.debutMs);
  const voixClient = [...new Set(client.map((s) => s.locuteurBrut ?? "A"))];
  const retrouves: AccordRetrouve[] = [];
  for (const voix of voixClient) {
    const s = client.find(
      (x) =>
        (x.locuteurBrut ?? "A") === voix &&
        x.debutMs >= debut &&
        x.debutMs <= fin &&
        FORMULES_D_ACCORD.some((m) => m.test(sansAccents(normaliserPourCitation(x.texte)))),
    );
    if (s) retrouves.push({ voix, texte: s.texte, debutMs: s.debutMs });
  }
  return {
    voixClient,
    retrouves,
    voixSansAccord: voixClient.filter((v) => !retrouves.some((r) => r.voix === v)),
  };
}

/**
 * La preuve d'accord est-elle une citation EXACTE d'un segment réel de la
 * piste client ? (Contrôle refait au moment d'écrire la preuve.)
 */
export function accordVerifieCommeUneCitation(
  accord: Pick<AccordRetrouve, "texte" | "debutMs">,
  segments: readonly SegmentAccord[],
): boolean {
  const cherche = normaliserPourCitation(accord.texte);
  if (cherche === "") return false;
  return segments.some(
    (s) =>
      s.piste === "client" &&
      s.debutMs === accord.debutMs &&
      ` ${normaliserPourCitation(s.texte)} `.includes(` ${cherche} `),
  );
}
