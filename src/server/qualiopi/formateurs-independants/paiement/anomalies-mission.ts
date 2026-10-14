/**
 * Formateurs indépendants — les ANOMALIES d'un relevé de mission (lot D2, M22 ;
 * écran W-9 : « pourquoi + quoi faire »).
 *
 * Le passage du paiement par mission les constate ; elles sont CONSERVÉES sur le
 * relevé (`anomaliesMission`, JSON) et affichées sur son écran. Elles ne valident
 * ni ne bloquent rien : chaque relevé de mission reste validé par un humain
 * (décision prise : aucune validation automatique).
 *
 * Pur : aucun import. Codes et chiffres seulement, aucune donnée personnelle.
 */

export type CodeAnomalieMission =
  /** Le relevé diffère de la part PRÉVUE du mois (demi-journées ou déplacement). */
  | "ecart_prevu"
  /** Des demi-journées ont été signées APRÈS l'écriture du relevé : non payées. */
  | "complement_signe"
  /**
   * Le relevé diffère de la part du mois ANNONCÉE par la lettre signée (étape 4).
   * Constatée à la lecture, jamais conservée : la lettre fait foi.
   */
  | "ecart_lettre";

export interface AnomalieMission {
  readonly code: CodeAnomalieMission;
  /** Chiffres seulement (« prévu 130 000 c HT, calculé 100 000 c HT »). */
  readonly detail: string;
  /** Jour civil (Paris) du premier constat. */
  readonly constateLe: string;
}

const CODES: ReadonlySet<string> = new Set(["ecart_prevu", "complement_signe", "ecart_lettre"]);

/** Lecture tolérante de la colonne JSON : ce qui n'a pas la forme attendue est ignoré. */
export function lireAnomaliesMission(json: unknown): AnomalieMission[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (a): a is AnomalieMission =>
      a !== null &&
      typeof a === "object" &&
      CODES.has((a as AnomalieMission).code) &&
      typeof (a as AnomalieMission).detail === "string" &&
      typeof (a as AnomalieMission).constateLe === "string",
  );
}

/**
 * Ajoute une anomalie si elle n'est pas déjà là (même code, même détail) :
 * le passage quotidien la constate chaque jour, elle n'est conservée qu'une fois.
 * `null` : rien à écrire.
 */
export function ajouterAnomalie(
  existantes: ReadonlyArray<AnomalieMission>,
  nouvelle: AnomalieMission,
): AnomalieMission[] | null {
  if (existantes.some((a) => a.code === nouvelle.code && a.detail === nouvelle.detail)) return null;
  return [...existantes, nouvelle];
}

/**
 * La part d'un mois (`AAAA-MM`) annoncée par une lettre de mission, lue dans ses
 * métadonnées (`annonceLettre.parMois`, rangé à l'émission). `null` : lettre
 * d'avant l'étape 4, mois absent, ou forme inattendue — jamais deviné.
 */
export function annonceDuMois(metadata: unknown, mois: string): number | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const a = (metadata as Record<string, unknown>).annonceLettre;
  if (a === null || typeof a !== "object" || Array.isArray(a)) return null;
  const parMois = (a as Record<string, unknown>).parMois;
  if (parMois === null || typeof parMois !== "object" || Array.isArray(parMois)) return null;
  const v = (parMois as Record<string, unknown>)[mois];
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * Les anomalies d'un relevé de mission FACE À LA LETTRE SIGNÉE (étape 4) : ce
 * qui a été annoncé au formateur est la référence de l'écart.
 *  - sans annonce lisible : les anomalies conservées, inchangées ;
 *  - avec : l'écart au prévu recalculé (`ecart_prevu`) cède la place à la
 *    comparaison avec la lettre — `ecart_lettre` si le HT payé (animation et
 *    déplacement) diffère de la part annoncée du mois.
 * Rien n'est écrit : les anomalies conservées restent en base telles quelles.
 */
export function anomaliesFaceALaLettre(
  conservees: ReadonlyArray<AnomalieMission>,
  annonceHtCents: number | null,
  payeHtCents: number,
  constateLe: string,
): AnomalieMission[] {
  if (annonceHtCents === null) return [...conservees];
  const autres = conservees.filter((a) => a.code !== "ecart_prevu" && a.code !== "ecart_lettre");
  if (annonceHtCents === payeHtCents) return autres;
  return [
    ...autres,
    {
      code: "ecart_lettre",
      detail: `annoncé ${annonceHtCents} c HT par la lettre signée, calculé ${payeHtCents} c HT`,
      constateLe,
    },
  ];
}

/** Pourquoi, et quoi faire — toujours un geste (W-9 : aucune anomalie sans bouton). */
export const LIBELLE_ANOMALIE_MISSION: Readonly<
  Record<CodeAnomalieMission, { readonly pourquoi: string; readonly quoiFaire: string }>
> = {
  ecart_prevu: {
    pourquoi: "Le relevé diffère de ce qui était prévu pour ce mois.",
    quoiFaire:
      "Vérifiez les journées et le forfait de la mission, puis validez le relevé s'il est juste.",
  },
  ecart_lettre: {
    pourquoi: "Le relevé diffère de ce que la lettre de mission signée annonçait pour ce mois.",
    quoiFaire:
      "Vérifiez les journées signées face à la lettre ; si les dates ont changé, rectifiez la lettre, puis validez le relevé s'il est juste.",
  },
  complement_signe: {
    pourquoi:
      "Des demi-journées ont été signées après l'écriture de ce relevé : elles ne sont pas payées.",
    quoiFaire:
      "Corrigez par un avoir et une réémission (bouton « Désaccord accepté » si le formateur l'a signalé), ou payez le complément à la main.",
  },
};
