/**
 * Onglet « Rendez-vous » — ce qu'une carte montre avant un appel (2026-09-27).
 *
 * Demande de Will : un écran des rendez-vous à venir, avec QUI, l'HEURE et le
 * lien de visio, qui les retire 30 minutes après la fin. Ces fonctions lisent
 * ce que la charge Calendly sait et que les colonnes ne portent pas : les
 * réponses au formulaire (le besoin, l'entreprise) et les autres invités.
 *
 * Fonctions pures : aucune lecture en base ici, tout vient de `rawPayload`.
 */

export interface ReponseFormulaire {
  readonly question: string;
  readonly reponse: string;
}

function invite(rawPayload: unknown): Record<string, unknown> | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null;
  const v = (rawPayload as Record<string, unknown>)["invitee"];
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

/** Une question qui demande un téléphone : sa réponse est déjà dans `inviteePhone`. */
const QUESTION_TELEPHONE = /t[ée]l[ée]phone|phone|mobile|portable/i;

/** La question « Nom de l'entreprise » du formulaire Calendly. */
const QUESTION_ENTREPRISE = /entreprise|soci[ée]t[ée]|structure|organisation/i;

/**
 * Les réponses du formulaire Calendly, dans l'ordre où l'invité les a données.
 *
 * Le téléphone est écarté : il a sa propre ligne sur la carte.
 */
export function reponsesFormulaire(rawPayload: unknown): ReponseFormulaire[] {
  const qa = invite(rawPayload)?.["questions_and_answers"];
  if (!Array.isArray(qa)) return [];
  return qa.flatMap((x): ReponseFormulaire[] => {
    if (typeof x !== "object" || x === null) return [];
    const q = (x as Record<string, unknown>)["question"];
    const a = (x as Record<string, unknown>)["answer"];
    if (typeof q !== "string" || typeof a !== "string" || !a.trim()) return [];
    if (QUESTION_TELEPHONE.test(q)) return [];
    return [{ question: q.trim(), reponse: a.trim() }];
  });
}

/**
 * Sépare l'entreprise des autres réponses : c'est une information d'identité
 * (« qui »), elle se lit à côté du nom, pas au milieu du besoin.
 */
export function entrepriseEtBesoin(reponses: readonly ReponseFormulaire[]): {
  entreprise: string | null;
  besoin: ReponseFormulaire[];
} {
  const i = reponses.findIndex((r) => QUESTION_ENTREPRISE.test(r.question));
  if (i === -1) return { entreprise: null, besoin: [...reponses] };
  return {
    entreprise: reponses[i]?.reponse ?? null,
    besoin: reponses.filter((_, j) => j !== i),
  };
}
