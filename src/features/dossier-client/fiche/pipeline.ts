/**
 * Pipeline d'une fiche (lot B1). PUR : somme des montants HT des prestations ni terminées ni
 * perdues, et chances de signer moyennées PAR MONTANT. Rien n'est écrit.
 */

export interface PrestationPourPipeline {
  readonly etape: string;
  readonly montantCents: number | null;
  /** 0 à 100 ; `null` : non estimée. */
  readonly probabilitePct: number | null;
}

export interface PipelineCalcule {
  readonly nb: number;
  readonly htCents: number;
  /** Moyenne pondérée par montant, arrondie ; `null` : aucune chance estimée. */
  readonly chancesPct: number | null;
}

const EXCLUES: ReadonlySet<string> = new Set(["terminee", "perdue"]);

export function calculerPipeline(
  prestations: ReadonlyArray<PrestationPourPipeline>,
): PipelineCalcule {
  const actives = prestations.filter((p) => !EXCLUES.has(p.etape));
  const htCents = actives.reduce((s, p) => s + (p.montantCents ?? 0), 0);
  const estimees = actives.filter(
    (p) => p.probabilitePct !== null && p.montantCents !== null && p.montantCents > 0,
  );
  const poids = estimees.reduce((s, p) => s + p.montantCents!, 0);
  const chancesPct =
    poids === 0
      ? null
      : Math.round(estimees.reduce((s, p) => s + p.montantCents! * p.probabilitePct!, 0) / poids);
  return { nb: actives.length, htCents, chancesPct };
}
