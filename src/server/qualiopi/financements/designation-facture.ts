/**
 * Désignation d'une ligne de facture de FORMATION. Module PUR.
 *
 * ## Le défaut (facture réelle AXI-FACT-2026-001, relue le 2026-09-30)
 *
 * 🔴 La seule ligne de la facture disait « Formation professionnelle —
 * forfait ». L'art. 242 nonies A de l'annexe II du CGI exige « la dénomination
 * précise » des services rendus, et un OPCO rapproche la facture de son accord
 * de prise en charge par l'intitulé, les dates, la durée et les stagiaires :
 * aucun ne figurait sur la pièce. La facture était régulière en montant et
 * inexploitable en contrôle de service fait.
 *
 * ## La règle
 *
 * La désignation nomme la PRESTATION : intitulé de la formation, n° de session,
 * dates de réalisation, durée, et nom(s) du ou des stagiaires, puis le mode de
 * calcul (« forfait », ventilation horaire) qui existait déjà. Tout champ absent
 * est omis — jamais remplacé par un blanc ou un « — ».
 *
 * ⚠️ UNE SEULE LIGNE de texte, séparateurs « — » : la désignation part aussi
 * dans la facture électronique (CII `ram:Name`) et à l'écran de la facture ;
 * un saut de ligne y serait perdu ou casserait la mise en page.
 */

export interface ContexteDesignationFormation {
  readonly intitule?: string | null;
  readonly numeroSession?: string | null;
  /** « du 15/09/2026 au 16/09/2026 » ou « 15/09/2026 » (cf. `periodePrestationSession`). */
  readonly periode?: string | null;
  readonly dureeHeures?: number | null;
  readonly stagiaires?: ReadonlyArray<{ readonly nom: string; readonly prenom: string }>;
}

function nonVide(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** 7 → « 7 h » ; 3.5 → « 3 h 30 ». */
export function dureeLisible(heures: number): string {
  const minutes = Math.round(heures * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** « MARTIN Jean » — la forme de l'émargement et de la convention. */
function nomStagiaire(s: { nom: string; prenom: string }): string {
  return `${s.nom.trim().toUpperCase()} ${s.prenom.trim()}`.trim();
}

/**
 * Compose la désignation. `mode` est la désignation historique du calcul
 * (« Formation professionnelle — forfait »…) : elle est conservée en tête,
 * enrichie de ce qui identifie la prestation.
 */
export function designationFormation(mode: string, ctx: ContexteDesignationFormation): string {
  const morceaux: string[] = [];
  const intitule = nonVide(ctx.intitule);
  morceaux.push(intitule !== null ? `${mode.trim()} — « ${intitule} »` : mode.trim());

  const numero = nonVide(ctx.numeroSession);
  if (numero !== null) morceaux.push(`session ${numero}`);

  const periode = nonVide(ctx.periode);
  if (periode !== null) morceaux.push(`réalisée ${periode.startsWith("du ") ? periode : `le ${periode}`}`);

  if (typeof ctx.dureeHeures === "number" && Number.isFinite(ctx.dureeHeures) && ctx.dureeHeures > 0) {
    morceaux.push(`durée ${dureeLisible(ctx.dureeHeures)}`);
  }

  const noms = (ctx.stagiaires ?? []).map(nomStagiaire).filter((n) => n !== "");
  if (noms.length > 0) {
    morceaux.push(`${noms.length > 1 ? "stagiaires" : "stagiaire"} : ${noms.join(", ")}`);
  }

  return morceaux.join(" — ");
}
