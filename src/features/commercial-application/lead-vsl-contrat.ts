/**
 * CONTRAT entre la page VSL apporteurs (lot 3, cette PR) et les deux actions
 * serveur de la capture en deux temps (lot 2, développeur « back », fichier
 * `lead-vsl-actions.ts` de la branche `feat/vsl-apporteurs-capture`).
 *
 * Types SEULEMENT, aucun import de zod : ce fichier est lu par le navigateur
 * (l'île `VslFormulaire`) — le schéma complet reste côté serveur.
 *
 * L'île reçoit les deux actions PAR PROPS : elle ne les importe pas. C'est ce
 * qui la rend testable sans serveur, et ce qui permet de livrer la page avant
 * la capture (voir `lead-vsl-branchement.ts`).
 */

/** « Combien de dirigeants connaissez-vous à peu près ? » — quatre réponses fermées. */
export type ReponseNombreDirigeants = "moins-5" | "5-20" | "20-50" | "plus-50";

export interface ContexteLeadVsl {
  /** `location.search` brut au moment de l'envoi (utm_* et fbclid). */
  query: string;
  /** Cookie `_fbp` (existe seulement si le pixel a été accepté). */
  fbp?: string;
  referrer?: string;
  /** `fbclid` prélevé à l'arrivée — SEULEMENT si le consentement publicitaire est « accepté ». */
  fbclid?: string;
  /** Heure (ms) d'arrivée du `fbclid`, pour fabriquer un `fbc` correct. */
  fbclidAt?: number;
  /** Heure (ms) d'affichage du formulaire : base du délai minimal anti-robot. */
  renderedAt: number;
}

export interface CapturerLeadVslInput {
  prenom: string;
  email: string;
  consent: boolean;
  /** Le visiteur a-t-il accepté la bannière publicitaire (pixel Meta) ? */
  consentPub?: boolean;
  honeypot?: string;
  ctx: ContexteLeadVsl;
}

export type CapturerLeadVslResultat =
  | { ok: true; jeton: string; leadId: string }
  | { ok: false; error: "invalid" | "rate" | "unknown" };

export interface CompleterLeadVslInput {
  jeton: string;
  telephone: string;
  reponseId: ReponseNombreDirigeants;
  consent: boolean;
}

export type CompleterLeadVslResultat =
  { ok: true; merciUrl: string } | { ok: false; error: "invalid" | "jeton" | "rate" | "unknown" };

export type CapturerLeadVslAction = (
  input: CapturerLeadVslInput,
) => Promise<CapturerLeadVslResultat>;

export type CompleterLeadVslAction = (
  input: CompleterLeadVslInput,
) => Promise<CompleterLeadVslResultat>;
