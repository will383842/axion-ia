/**
 * LA LISTE « FUTURS APPORTEURS » — ce que disent ses colonnes (Candidatures
 * unifiées L8d, maquette v2 validée le 2026-10-07). Module PUR.
 *
 *   Nom · Zone · Dossier · Étape · Dernier échange   (+ « Nous a connus par »)
 *
 * Tout est DÉRIVÉ de ce qui existe déjà : `details` de la fiche (ville, zones,
 * canal déclaré, source de l'annonce), l'étape du formulaire, le suivi de
 * l'invitation. Aucun mot de recrutement (garde : `liste-reseau.spec.ts`).
 */

import { optionLabel, SOURCE_OPTIONS, zoneResume } from "./model";
import type { EtapeApporteur } from "./etape-apporteur";

function objet(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** « Grenoble · Isère (38), Savoie (73) » ; `null` si la fiche ne dit rien. */
export function zoneDeLaFiche(details: unknown): string | null {
  const d = objet(details);
  if (!d) return null;
  const c = objet(d["candidature"]);
  const villeBrute = c?.["ville"] ?? d["ville"];
  const ville = typeof villeBrute === "string" && villeBrute.trim() ? villeBrute.trim() : null;
  const zones = Array.isArray(c?.["zones"])
    ? (c!["zones"] as unknown[]).filter((z): z is string => typeof z === "string")
    : [];
  const mobile = c?.["zoneMobile"] === true;
  const resume = mobile || zones.length > 0 ? zoneResume({ zoneMobile: mobile, zones }) : null;
  return [ville, resume].filter(Boolean).join(" · ") || null;
}

/**
 * « Nous a connus par… » : le canal DÉCLARÉ par la personne (chips du
 * tunnel), sinon la source de l'annonce qui l'a amenée (`utm_source`).
 */
export function connuPar(details: unknown): string | null {
  const d = objet(details);
  if (!d) return null;
  const declare = objet(d["candidature"])?.["sourceConnaissance"];
  if (typeof declare === "string" && declare) return optionLabel(SOURCE_OPTIONS, declare);
  const utm = objet(objet(d["funnel"])?.["utm"]);
  const source = utm?.["utm_source"] ?? utm?.["source"];
  if (typeof source === "string" && source) {
    return SOURCE_OPTIONS.find((o) => o.id === source)?.label ?? source;
  }
  return null;
}

/** Les origines proposées dans le filtre « Nous a connus par ». */
export const ORIGINES_FILTRABLES: ReadonlyArray<string> = SOURCE_OPTIONS.map((o) => o.label);

/** L'état du dossier en un mot (maquette : Premier contact / Commencé / Complet). */
export function dossierCourt(etape: EtapeApporteur | null): string {
  switch (etape) {
    case "premier-contact":
      return "Premier contact";
    case "dossier-commence":
      return "Commencé";
    case "dossier-complet":
    case null:
      return "Complet";
  }
}

/** « 06/10 », heure de Paris. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/** Le dernier fait de l'échange, et son sens (↙ reçu / ↗ envoyé). */
export function dernierEchange(d: {
  readonly invitation: Date | null;
  readonly relances: ReadonlyArray<Date>;
  readonly reponse: Date | null;
  /** Dernière réponse envoyée depuis la console. */
  readonly envoyeLe: Date | null;
}): { sens: "recu" | "envoye"; libelle: string } | null {
  const faits: Array<{ le: Date; sens: "recu" | "envoye"; quoi: string }> = [];
  if (d.invitation) faits.push({ le: d.invitation, sens: "envoye", quoi: "invitation" });
  for (const r of d.relances) faits.push({ le: r, sens: "envoye", quoi: "rappel" });
  if (d.reponse) faits.push({ le: d.reponse, sens: "recu", quoi: "reçu" });
  if (d.envoyeLe) faits.push({ le: d.envoyeLe, sens: "envoye", quoi: "envoyé" });
  if (faits.length === 0) return null;
  const f = faits.reduce((a, b) => (b.le.getTime() > a.le.getTime() ? b : a));
  return {
    sens: f.sens,
    libelle: `${f.sens === "recu" ? "↙" : "↗"} ${f.quoi} le ${jourMois(f.le)}`,
  };
}
