/**
 * S10-1 · Statuts d'une occasion de lien et transitions autorisées (§ 4.3). Module PUR.
 *
 * Aucun statut « envoyé » : quand Will a écrit depuis sa propre messagerie, il passe l'occasion
 * en `contacte_par_will` d'un clic. Le système ne fait avancer rien au-delà de `idee`, sauf deux
 * exceptions : `en_opposition` (sécurité) et `sans_reponse` (45 jours après le contact).
 */
export const STATUTS = [
  "idee",
  "a_qualifier",
  "qualifiee",
  "brouillon_pret",
  "brouillon_valide",
  "contacte_par_will",
  "reponse",
  "lien_obtenu",
  "refus",
  "sans_reponse",
  "ecartee",
  "en_opposition",
] as const;
export type StatutOccasion = (typeof STATUTS)[number];

export const PLAFOND_BROUILLONS_PRETS = 10;
export const DELAI_SANS_REPONSE_JOURS = 45;
export const DELAI_RELANCE_MIN_JOURS = 30;
export const RELANCES_MAX = 1;

const STATUTS_FINAUX: readonly StatutOccasion[] = ["lien_obtenu", "refus", "sans_reponse"];
const JOUR_MS = 86_400_000;

export interface ContexteTransition {
  readonly acteur: "humain" | "systeme";
  /** Un `LienRecu` rattaché à l'occasion est dans l'état `present`. */
  readonly lienPresent?: boolean;
  readonly nbBrouillonsPrets?: number;
  readonly dernierContactLe?: Date | null;
  readonly maintenant?: Date;
}

export type ResultatTransition =
  { readonly ok: true } | { readonly ok: false; readonly raison: string };

const SUIVANTS: Readonly<Record<StatutOccasion, readonly StatutOccasion[]>> = {
  idee: ["a_qualifier"],
  a_qualifier: ["qualifiee"],
  qualifiee: ["brouillon_pret"],
  brouillon_pret: ["brouillon_valide", "qualifiee"],
  brouillon_valide: ["contacte_par_will", "qualifiee"],
  contacte_par_will: ["reponse", "sans_reponse", "lien_obtenu"],
  reponse: ["lien_obtenu", "refus", "sans_reponse"],
  lien_obtenu: [],
  refus: [],
  sans_reponse: ["reponse"], // une réponse peut arriver après les 45 jours
  ecartee: ["a_qualifier"],
  en_opposition: [],
};

export function sansReponseDue(dernierContactLe: Date, maintenant: Date): boolean {
  return maintenant.getTime() - dernierContactLe.getTime() >= DELAI_SANS_REPONSE_JOURS * JOUR_MS;
}

export function verifierTransition(
  de: StatutOccasion,
  vers: StatutOccasion,
  ctx: ContexteTransition,
): ResultatTransition {
  const non = (raison: string): ResultatTransition => ({ ok: false, raison });
  if (!STATUTS.includes(de) || !STATUTS.includes(vers)) return non("statut inconnu");
  if (de === vers) return non("même statut");
  if (de === "en_opposition") return non("une opposition est définitive");

  if (vers === "en_opposition") return { ok: true }; // à tout moment, humain ou système
  if (ctx.acteur === "systeme") {
    if (vers === "sans_reponse" && de === "contacte_par_will") {
      if (!ctx.dernierContactLe || !ctx.maintenant) return non("date de contact inconnue");
      return sansReponseDue(ctx.dernierContactLe, ctx.maintenant)
        ? { ok: true }
        : non(`moins de ${DELAI_SANS_REPONSE_JOURS} jours depuis le contact`);
    }
    return non("seul un humain fait avancer une occasion");
  }

  if (vers === "ecartee") {
    return STATUTS_FINAUX.includes(de) ? non("statut final") : { ok: true };
  }
  if (!SUIVANTS[de].includes(vers)) return non(`transition ${de} vers ${vers} interdite`);
  if (vers === "lien_obtenu" && ctx.lienPresent !== true) {
    return non("aucun lien présent et vérifié n'est rattaché");
  }
  if (vers === "brouillon_pret" && (ctx.nbBrouillonsPrets ?? 0) >= PLAFOND_BROUILLONS_PRETS) {
    return non(`déjà ${PLAFOND_BROUILLONS_PRETS} brouillons prêts`);
  }
  return { ok: true };
}

/** Aucune relance avant 30 jours, et une seule au plus. */
export function peutRelancer(c: {
  readonly statut: StatutOccasion;
  readonly dernierContactLe: Date | null;
  readonly nbRelances: number;
  readonly maintenant: Date;
}): boolean {
  // Seule une occasion contactée est relançable : jamais une opposition, un refus, un lien obtenu.
  if (c.statut !== "contacte_par_will" || !c.dernierContactLe || c.nbRelances >= RELANCES_MAX)
    return false;
  return c.maintenant.getTime() - c.dernierContactLe.getTime() >= DELAI_RELANCE_MIN_JOURS * JOUR_MS;
}
