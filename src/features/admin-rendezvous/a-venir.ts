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

/**
 * LES règles qui reconnaissent une question du formulaire Calendly — une
 * seule source pour la carte « à venir », le rattachement proposé du dossier
 * client et la reprise de l'historique (chantier visio, PR 4). Deux règles
 * différentes feraient afficher une entreprise sur la carte sans que le
 * rattachement la voie.
 */

/** Une question qui demande un téléphone : sa réponse est déjà dans `inviteePhone`. */
export function estQuestionTelephone(question: string): boolean {
  return /t[ée]l[ée]phone|phone|mobile|portable/i.test(question);
}

/** « Ville de l'entreprise » : un lieu, pas un nom. */
export function estQuestionVille(question: string): boolean {
  return /ville|commune/i.test(question);
}

/** La question « Nom de l'entreprise » (ou de la société, de l'organisation…). */
export function estQuestionEntreprise(question: string): boolean {
  return (
    /entreprise|soci[ée]t[ée]|structure|organisation|organisme/i.test(question) &&
    !estQuestionVille(question)
  );
}

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
    if (estQuestionTelephone(q)) return [];
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
  const i = reponses.findIndex((r) => estQuestionEntreprise(r.question));
  if (i === -1) return { entreprise: null, besoin: [...reponses] };
  return {
    entreprise: reponses[i]?.reponse ?? null,
    besoin: reponses.filter((_, j) => j !== i),
  };
}

/**
 * L'entreprise que l'invité a déclarée, et sa ville, telles que le formulaire
 * les porte. Le rattachement proposé et « Créer la fiche prospect » la lisent.
 */
export function entrepriseDeclaree(rawPayload: unknown): {
  nom: string | null;
  ville: string | null;
} {
  const reponses = reponsesFormulaire(rawPayload);
  return {
    nom: entrepriseEtBesoin(reponses).entreprise,
    ville: reponses.find((r) => estQuestionVille(r.question))?.reponse ?? null,
  };
}
