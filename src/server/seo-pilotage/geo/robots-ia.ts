/**
 * Robots d'IA : classement par famille et agrégat (P10). Module PUR.
 *
 * Trois familles, qui n'ont pas le même sens :
 * - `recherche` : indexe pour un moteur de réponses (peut mener à une citation) ;
 * - `entrainement` : collecte pour entraîner un modèle (aucune citation attendue) ;
 * - `utilisateur` : une personne a demandé la page à un assistant, à l'instant même.
 *
 * Le user-agent brut ne quitte jamais ce module : on n'en garde que l'identifiant de la liste
 * fermée ci-dessous. Un passage de robot n'est PAS une citation.
 */
import { typePageDepuisChemin } from "../donnees/types-page";

export const FAMILLES_ROBOT = ["recherche", "entrainement", "utilisateur"] as const;
export type FamilleRobot = (typeof FAMILLES_ROBOT)[number];

export interface RobotIa {
  /** Fragment du user-agent (insensible à la casse) ; sert aussi d'identifiant. */
  readonly jeton: string;
  readonly famille: FamilleRobot;
}

export const ROBOTS_IA: readonly RobotIa[] = [
  { jeton: "GPTBot", famille: "entrainement" },
  { jeton: "OAI-SearchBot", famille: "recherche" },
  { jeton: "ChatGPT-User", famille: "utilisateur" },
  { jeton: "ClaudeBot", famille: "entrainement" },
  { jeton: "Claude-SearchBot", famille: "recherche" },
  { jeton: "Claude-User", famille: "utilisateur" },
  { jeton: "anthropic-ai", famille: "entrainement" },
  { jeton: "PerplexityBot", famille: "recherche" },
  { jeton: "Perplexity-User", famille: "utilisateur" },
  { jeton: "MistralAI-User", famille: "utilisateur" },
  { jeton: "CCBot", famille: "entrainement" },
  { jeton: "Bytespider", famille: "entrainement" },
  { jeton: "Amazonbot", famille: "entrainement" },
  { jeton: "meta-externalagent", famille: "entrainement" },
  { jeton: "meta-externalfetcher", famille: "utilisateur" },
  { jeton: "cohere-ai", famille: "entrainement" },
  { jeton: "DuckAssistBot", famille: "utilisateur" },
];

const PAR_LONGUEUR = [...ROBOTS_IA].sort((a, b) => b.jeton.length - a.jeton.length);

export interface RobotClasse {
  readonly robot: string;
  readonly famille: FamilleRobot;
}

/** Le jeton le plus long gagne (« Claude-User » avant « ClaudeBot »). `null` : pas un robot d'IA. */
export function classerUserAgent(userAgent: string): RobotClasse | null {
  if (typeof userAgent !== "string" || userAgent === "") return null;
  const ua = userAgent.toLowerCase();
  for (const r of PAR_LONGUEUR) {
    const j = r.jeton.toLowerCase();
    if (ua.includes(j)) return { robot: j, famille: r.famille };
  }
  return null;
}

const FICHIERS_TECHNIQUES = /^\/(robots\.txt|llms(-full)?\.txt|sitemap[^/]*\.xml|sitemaps\/.*)$/i;

/** Famille de page visée par le robot : type de page du pilotage, ou « technique ». */
export function familleDeChemin(chemin: string): string {
  if (typeof chemin !== "string" || chemin === "") return "autre";
  const propre = chemin.split(/[?#]/)[0] ?? "";
  if (FICHIERS_TECHNIQUES.test(propre)) return "technique";
  return typePageDepuisChemin(propre);
}

export interface LigneRobotBrute {
  readonly date: string;
  readonly userAgent: string;
  readonly chemin: string;
  readonly nombre: number;
}

export interface RobotJour {
  readonly date: string;
  readonly robot: string;
  readonly famille: FamilleRobot;
  readonly familleChemin: string;
  readonly nombre: number;
}

/** Lignes brutes → `{jour, robot, famille, famille de chemins, nombre}`. Ni IP ni user-agent. */
export function agregerRobots(lignes: readonly LigneRobotBrute[]): RobotJour[] {
  const m = new Map<string, RobotJour>();
  if (!Array.isArray(lignes)) return [];
  for (const l of lignes) {
    if (!l || typeof l.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(l.date)) continue;
    if (!Number.isInteger(l.nombre) || l.nombre <= 0) continue;
    const c = classerUserAgent(l.userAgent);
    if (!c) continue;
    const familleChemin = familleDeChemin(l.chemin);
    const cle = `${l.date}|${c.robot}|${familleChemin}`;
    const ex = m.get(cle);
    m.set(cle, {
      date: l.date,
      robot: c.robot,
      famille: c.famille,
      familleChemin,
      nombre: (ex?.nombre ?? 0) + l.nombre,
    });
  }
  return [...m.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.robot.localeCompare(b.robot) ||
      a.familleChemin.localeCompare(b.familleChemin),
  );
}
