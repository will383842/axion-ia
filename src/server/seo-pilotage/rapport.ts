/**
 * Section « Pilotage » du rapport hebdomadaire (P9). Module PUR : aucun accès base, aucun
 * réseau, aucune variable d'environnement. Il reçoit des chiffres déjà lus et rend du texte.
 *
 * Règles :
 * - pilotage éteint → pas de section (`null`) ;
 * - source indisponible → la phrase l'annonce, jamais un « 0 » inventé ;
 * - aucune requête citée sous le plancher de 30 affichages sur 28 jours (donnée personnelle).
 */

export const PLANCHER_IMPRESSIONS_28J = 30;
export const NB_OPPORTUNITES_MAX = 5;
export const FENETRE_JOURS = 7;

export interface Totaux {
  readonly clics: number;
  readonly impressions: number;
  /** position × impressions : la moyenne reste exacte une fois cumulée. */
  readonly positionSum: number;
  readonly pages: number;
  /** Jours de la fenêtre dont la collecte a réussi (sur FENETRE_JOURS). */
  readonly joursMesures: number;
}

export interface OpportuniteRapport {
  readonly detecteur: string;
  readonly cible: string;
  readonly priorite: number;
  readonly requete: string | null;
  /** Affichages de la requête sur 28 jours ; `null` si inconnu (la requête n'est alors pas citée). */
  readonly impressions28j: number | null;
}

export interface DonneesRapport {
  /** Dernier jour mesuré (AAAA-MM-JJ), `null` s'il n'y a aucune donnée. */
  readonly fin: string | null;
  readonly courante: Totaux | null;
  readonly precedente: Totaux | null;
  readonly opportunites: readonly OpportuniteRapport[];
  readonly sourcesIndisponibles: readonly string[];
}

export type EntreeSection =
  | { readonly etat: "eteint" }
  | { readonly etat: "indisponible" }
  | { readonly etat: "ok"; readonly donnees: DonneesRapport };

export interface SectionRapport {
  readonly html: string;
  readonly text: string;
}

/** Codes de `CodeDetecteur` (P7, `opportunites/types.ts`), libellés du PLAN § 4.1. */
const LIBELLES_DETECTEUR: Readonly<Record<string, string>> = {
  a: "page proche de la première page",
  b: "peu de clics pour ses affichages",
  c: "requête sans page adaptée",
  d: "deux pages se font concurrence",
  e: "page en baisse",
  f: "page jamais affichée",
};

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function evolution(courant: number, precedent: number | undefined): string {
  if (precedent === undefined || precedent <= 0) return "—";
  const p = Math.round(((courant - precedent) / precedent) * 100);
  return `${p > 0 ? "+" : ""}${p} %`;
}

function position(t: Totaux): string {
  return t.impressions > 0 ? (t.positionSum / t.impressions).toFixed(1).replace(".", ",") : "—";
}

function ctr(t: Totaux): string {
  return t.impressions > 0
    ? `${((t.clics / t.impressions) * 100).toFixed(1).replace(".", ",")} %`
    : "—";
}

export function dateFr(jour: string): string {
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a}`;
}

function lignesChiffres(c: Totaux, p: Totaux | null): string[] {
  // Une semaine précédente incomplète ne sert pas de base : pas d'évolution inventée.
  const base = p && p.joursMesures >= FENETRE_JOURS ? p : null;
  const note = p && !base ? " — semaine précédente incomplète" : "";
  return [
    `Clics : ${c.clics} (${evolution(c.clics, base?.clics)})${note}`,
    `Affichages : ${c.impressions} (${evolution(c.impressions, base?.impressions)})`,
    `Taux de clics : ${ctr(c)}`,
    `Pages affichées dans Google : ${c.pages} (${evolution(c.pages, base?.pages)})`,
    `Position moyenne dans Google : ${position(c)}`,
  ];
}

function lignesOpportunites(opps: readonly OpportuniteRapport[]): string[] {
  return [...opps]
    .sort((a, b) => b.priorite - a.priorite)
    .slice(0, NB_OPPORTUNITES_MAX)
    .map((o) => {
      const libelle = LIBELLES_DETECTEUR[o.detecteur] ?? "à regarder";
      const citable = o.requete !== null && (o.impressions28j ?? 0) >= PLANCHER_IMPRESSIONS_28J;
      return `${o.cible} — ${libelle}${citable ? ` (requête : « ${o.requete} »)` : ""}`;
    });
}

function rendre(titre: string, blocs: ReadonlyArray<{ t: string; lignes: string[] }>) {
  const text = [titre, ...blocs.flatMap((b) => [b.t, ...b.lignes.map((l) => `- ${l}`)])].join("\n");
  const html = `<h3 style="color:#c24a1b;margin-top:30px">${echapper(titre)}</h3>${blocs
    .map(
      (b) =>
        `<p style="margin:12px 0 4px;font-weight:bold">${echapper(b.t)}</p><ul style="margin:0;padding-left:20px">${b.lignes
          .map((l) => `<li>${echapper(l)}</li>`)
          .join("")}</ul>`,
    )
    .join("")}`;
  return { html, text };
}

export function construireSectionPilotage(entree: EntreeSection): SectionRapport | null {
  if (entree.etat === "eteint") return null;
  const titre = "Pilotage SEO";
  if (entree.etat === "indisponible") {
    return rendre(titre, [
      { t: "Données", lignes: ["Les chiffres du pilotage sont indisponibles cette semaine."] },
    ]);
  }
  const d = entree.donnees;
  const blocs: Array<{ t: string; lignes: string[] }> = [];
  if (d.courante && d.fin && d.courante.joursMesures >= FENETRE_JOURS) {
    blocs.push({
      t: `Chiffres clés (7 jours jusqu'au ${dateFr(d.fin)}, évolution face aux 7 jours d'avant)`,
      lignes: lignesChiffres(d.courante, d.precedente),
    });
  } else if (d.courante && d.fin) {
    blocs.push({
      t: "Chiffres clés",
      lignes: [
        `Chiffres incomplets : ${d.courante.joursMesures} jour(s) mesuré(s) sur ${FENETRE_JOURS} jusqu'au ${dateFr(d.fin)}.`,
      ],
    });
  } else {
    blocs.push({ t: "Chiffres clés", lignes: ["Pas encore de données collectées."] });
  }
  const opps = lignesOpportunites(d.opportunites);
  if (opps.length > 0) blocs.push({ t: "Meilleures opportunités", lignes: opps });
  if (d.sourcesIndisponibles.length > 0) {
    blocs.push({
      t: "Sources indisponibles",
      lignes: [...d.sourcesIndisponibles],
    });
  }
  blocs.push({
    t: "Pas encore mesuré",
    lignes: ["Modifications appliquées et leurs verdicts", "Visites venues des moteurs IA"],
  });
  return rendre(titre, blocs);
}

const REPERE_PIED = '<p style="margin-top:30px;font-size:12px;color:#999">';

/** Ajoute la section au courriel du lundi. Section absente : le courriel reste IDENTIQUE. */
export function ajouterSectionAuCourriel(
  courriel: { readonly subject: string; readonly html: string; readonly text: string },
  section: SectionRapport | null,
): { subject: string; html: string; text: string } {
  if (section === null) return { ...courriel };
  const i = courriel.html.lastIndexOf(REPERE_PIED);
  const html =
    i === -1
      ? courriel.html + section.html
      : courriel.html.slice(0, i) + section.html + courriel.html.slice(i);
  return { subject: courriel.subject, html, text: `${courriel.text}\n\n${section.text}` };
}
