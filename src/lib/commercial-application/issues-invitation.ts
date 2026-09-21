// Ce que l'invitation à un échange de 15 minutes dit quand elle part — ou quand
// elle ne part pas. UNE phrase par issue, pour TOUS les écrans (2026-09-21).
//
// ── Le défaut réparé ──────────────────────────────────────────────────────
// Les phrases existaient en DEUX exemplaires : `invitation-apporteur.ts` en
// produisait une (lue par la saisie manuelle, qui affiche `r.message`), et
// `BlocInvitationApporteur.tsx` en retapait une autre, choisie par le code
// d'erreur. **Sept des neuf avaient déjà divergé.** Le même refus se lisait donc
// différemment selon la porte par laquelle on était entré — et pour
// `file-indisponible`, l'action elle-même disait deux choses opposées selon
// l'endroit où elle échouait (« l'historique est illisible », « la file d'envoi
// est indisponible »).
//
// 🔑 Une divergence de texte n'est pas une faute d'orthographe : c'est ce que
// l'admin lit pour décider s'il réessaie, s'il coche une case, ou s'il renonce.
// « Coche Renvoyer quand même » et « une invitation est déjà partie » n'appellent
// pas le même geste.
//
// ── La règle, tenue par un test ───────────────────────────────────────────
// Aucun de ces textes ne se retape ailleurs. `issues-invitation.spec.ts` lit les
// DEUX fichiers appelants et refuse toute phrase écrite sur place.

/** Toutes les issues possibles d'une demande d'invitation, succès compris. */
export type CodeIssueInvitation =
  | "envoyee"
  | "en-validation"
  | "lien-invalide"
  | "introuvable"
  | "pas-un-apporteur"
  | "efface"
  | "retenu"
  | "file-indisponible"
  | "historique-illisible"
  | "deja-invitee"
  | "origine-interdite"
  | "accord-manquant"
  | "une-seule-personne"
  | "non-autorise";

export interface PhraseIssue {
  ton: "success" | "error";
  texte: string;
}

/**
 * ⚠️ `historique-illisible` EST UN CODE À PART, et c'est une correction, pas un
 * ajout de confort. Les deux situations n'appellent pas le même geste : on ne
 * peut pas LIRE l'historique (donc on refuse par prudence, une invitation en
 * double étant pire qu'un essai perdu), ou on ne peut pas ÉCRIRE dans la file.
 * Elles partageaient `file-indisponible` et deux messages contradictoires.
 */
const PHRASES: Readonly<Record<CodeIssueInvitation, PhraseIssue>> = {
  envoyee: {
    ton: "success",
    texte:
      "Invitation mise en file : elle part dans la minute, avec le document de présentation et le catalogue.",
  },
  "en-validation": {
    ton: "success",
    texte:
      "Invitation en attente de validation dans Envois à valider : elle partira une fois approuvée.",
  },
  "deja-invitee": {
    ton: "error",
    texte:
      "Rien n'est parti : une invitation est déjà partie (ou attend validation) pour cette personne. Coche « Renvoyer quand même » pour la renvoyer.",
  },
  "origine-interdite": {
    ton: "error",
    texte: "Rien n'est parti : adresse relevée sur l'annonce d'un tiers, pas d'invitation.",
  },
  "accord-manquant": {
    ton: "error",
    texte:
      "Rien n'est parti : l'adresse vient d'ailleurs. Coche « La personne a accepté d'être contactée » pour l'inviter.",
  },
  "une-seule-personne": {
    ton: "error",
    texte: "Rien n'est parti : une invitation s'envoie à une seule personne à la fois.",
  },
  "lien-invalide": {
    ton: "error",
    texte: "Rien n'est parti : le lien doit être une adresse https://calendly.com/… complète.",
  },
  retenu: {
    ton: "error",
    texte:
      "Rien n'est parti : cette adresse est retenue (désinscription, opposition ou adresse en erreur).",
  },
  "file-indisponible": {
    ton: "error",
    texte: "Rien n'est parti : la file d'envoi est indisponible. Réessaie dans un instant.",
  },
  "historique-illisible": {
    ton: "error",
    texte:
      "Rien n'est parti : l'historique des invitations est illisible, on ne peut pas vérifier qu'une invitation n'est pas déjà partie. Réessaie dans un instant.",
  },
  efface: {
    ton: "error",
    texte: "Rien n'est parti : les coordonnées de cette personne ont été effacées.",
  },
  "pas-un-apporteur": {
    ton: "error",
    texte: "Rien n'est parti : cette fiche n'est pas un contact du réseau d'apporteurs.",
  },
  introuvable: { ton: "error", texte: "Rien n'est parti : cette fiche n'existe plus." },
  "non-autorise": {
    ton: "error",
    texte: "Rien n'est parti : ton rôle ne permet pas d'envoyer d'e-mail depuis la console.",
  },
};

/** Les codes, pour les tests et pour toute boucle exhaustive. */
export const CODES_ISSUE_INVITATION = Object.keys(PHRASES) as CodeIssueInvitation[];

/**
 * La phrase d'une issue. `le` enrichit « déjà invitée » de sa date quand elle
 * est connue — la fiche la jetait, et `jourMois()` ne servait plus qu'à ça.
 *
 * 🔑 La date reste FACULTATIVE : la saisie manuelle n'a pas d'historique à
 * montrer, et un « le undefined » partirait sans lever.
 */
export function phraseInvitation(
  code: CodeIssueInvitation,
  contexte?: { le?: string | null },
): PhraseIssue {
  const base = PHRASES[code];
  if (code !== "deja-invitee") return base;
  const le = typeof contexte?.le === "string" ? contexte.le.trim() : "";
  if (le === "") return base;
  return {
    ton: base.ton,
    texte:
      "Rien n'est parti : une invitation est déjà partie (ou attend validation) le " +
      le +
      ". Coche « Renvoyer quand même » pour la renvoyer.",
  };
}

/** Un code inconnu (URL bricolée à la main) ne doit rien afficher du tout. */
export function estCodeIssue(v: unknown): v is CodeIssueInvitation {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PHRASES, v);
}
