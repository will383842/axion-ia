/**
 * Où en est le compte rendu de l'ENREGISTREMENT d'une rencontre (M-2, 2e
 * vérification du chantier visio) : « Après l'appel » s'ouvre souvent juste
 * après la visio, quelques minutes avant que le compte rendu soit prêt.
 *
 *   · `en_preparation` : un enregistrement est en cours de traitement, ou son
 *     compte rendu est encore en brouillon / à réécrire ;
 *   · `pret`           : un compte rendu attend la validation de Will ;
 *   · `aucun`          : pas d'enregistrement exploitable (refusé, échec…).
 *
 * Une seule règle, lue par la vue (bandeau, titre de la note) et par
 * `validerApresLAppel` (la note n'est pas exigée tant qu'un compte rendu vient).
 * Module neutre : aucun import d'exécution.
 */

/** Statuts d'un enregistrement dont le compte rendu viendra (ni détruit, ni en échec). */
export const STATUTS_ENREGISTREMENT_EN_PREPARATION = [
  "en_cours",
  "interrompu",
  "depose",
  "en_traitement",
  "transcrit",
] as const;

export type EtatCompteRenduEnregistre = "en_preparation" | "pret" | "aucun";

interface BaseLue {
  readonly enregistrement: {
    count(a: { where: Record<string, unknown> }): Promise<number>;
  };
  readonly compteRendu: {
    count(a: { where: Record<string, unknown> }): Promise<number>;
  };
}

export async function compteRenduEnregistre(
  db: BaseLue,
  rencontreId: string,
): Promise<EtatCompteRenduEnregistre> {
  const [pret, brouillons, enregistrements] = await Promise.all([
    db.compteRendu.count({
      where: { rencontreId, origine: { in: ["ia", "dictee"] }, statut: "a_valider" },
    }),
    db.compteRendu.count({
      where: {
        rencontreId,
        origine: { in: ["ia", "dictee"] },
        statut: { in: ["brouillon", "a_regenerer"] },
      },
    }),
    db.enregistrement.count({
      where: { rencontreId, statut: { in: [...STATUTS_ENREGISTREMENT_EN_PREPARATION] } },
    }),
  ]);
  if (pret > 0) return "pret";
  if (brouillons > 0 || enregistrements > 0) return "en_preparation";
  return "aucun";
}

/** Le titre de la carte « Note » : facultative dès qu'un compte rendu vient. */
export function titreDeLaNote(etat: EtatCompteRenduEnregistre): string {
  return etat === "aucun" ? "Note (pas d'enregistrement)" : "Note (facultative)";
}
