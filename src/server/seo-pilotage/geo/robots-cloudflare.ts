/**
 * Collecte quotidienne des robots d'IA via l'API GraphQL Analytics de Cloudflare (P10).
 *
 * - Lecture SEULE, en AGRÉGATS : le user-agent brut est classé puis jeté (voir `robots-ia.ts`) ;
 *   aucune adresse IP n'est demandée à Cloudflare.
 * - Sans jeton ou sans zone (le droit `Analytics:Read` est une décision de Will), avec le stub de
 *   build, sur un refus ou une panne : `{ statut: "indisponible" }`, jamais d'exception, jamais
 *   d'écho du corps de la réponse.
 * - Fenêtre : les 3 derniers jours finis (UTC), chaque jour remplacé en bloc : rejouable, et un
 *   passage manqué se rattrape au suivant.
 * - Limites à vérifier côté Cloudflare : rétention et champs selon l'offre.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";
import { agregerRobots, ROBOTS_IA, type LigneRobotBrute, type RobotJour } from "./robots-ia";

export const URL_GRAPHQL_CLOUDFLARE = "https://api.cloudflare.com/client/v4/graphql";
export const JOURS_RELUS = 3;
export const RETENTION_JOURS = 400;
const DELAI_MS = 20_000;
const LIMITE_LIGNES = 10_000;

type Env = Readonly<Record<string, string | undefined>>;

export type CollecteRobots =
  | {
      readonly statut: "ok";
      readonly jours: readonly string[];
      readonly lignes: readonly RobotJour[];
    }
  | { readonly statut: "indisponible"; readonly raison: string };

const enJour = (d: Date): string => d.toISOString().slice(0, 10);

/** Les `JOURS_RELUS` derniers jours FINIS (UTC), du plus ancien au plus récent. */
export function fenetreJours(maintenant: Date): string[] {
  const t = Date.parse(`${enJour(maintenant)}T00:00:00Z`);
  return Array.from({ length: JOURS_RELUS }, (_, i) =>
    enJour(new Date(t - (JOURS_RELUS - i) * 86_400_000)),
  );
}

// Jetons issus d'une liste fermée de constantes : sûrs à poser dans le texte de la requête.
const FILTRE_ROBOTS = ROBOTS_IA.map((r) => `{userAgent_like:"%${r.jeton}%"}`).join(",");

const REQUETE = `query($zone:String!,$debut:Date!,$fin:Date!){viewer{zones(filter:{zoneTag:$zone}){httpRequestsAdaptiveGroups(limit:${LIMITE_LIGNES},filter:{date_geq:$debut,date_leq:$fin,OR:[${FILTRE_ROBOTS}]},orderBy:[count_DESC]){count dimensions{date userAgent clientRequestPath}}}}}`;

export interface DepsCollecte {
  readonly env?: Env;
  readonly fetchFn?: typeof fetch;
  readonly maintenant?: () => Date;
}

export async function collecterRobotsCloudflare(deps: DepsCollecte = {}): Promise<CollecteRobots> {
  const env = deps.env ?? process.env;
  const jeton = env["CLOUDFLARE_API_TOKEN"];
  const zone = env["CLOUDFLARE_ZONE_ID"];
  if (!jeton || !zone) {
    return { statut: "indisponible", raison: "Jeton ou zone Cloudflare non configurés." };
  }
  if (env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      statut: "indisponible",
      raison: "Mesure non disponible pendant la construction du site.",
    };
  }
  const jours = fenetreJours((deps.maintenant ?? (() => new Date()))());
  try {
    const res = await (deps.fetchFn ?? fetch)(URL_GRAPHQL_CLOUDFLARE, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
      body: JSON.stringify({
        query: REQUETE,
        variables: { zone, debut: jours[0], fin: jours[jours.length - 1] },
      }),
      signal: AbortSignal.timeout(DELAI_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        statut: "indisponible",
        raison:
          res.status === 401 || res.status === 403
            ? "Le jeton Cloudflare n'a pas le droit de lire les statistiques (Analytics:Read)."
            : "Cloudflare ne répond pas pour le moment.",
      };
    }
    const json = (await res.json()) as {
      data?: { viewer?: { zones?: Array<{ httpRequestsAdaptiveGroups?: unknown }> } };
      errors?: unknown[];
    };
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      return { statut: "indisponible", raison: "Cloudflare a refusé la requête de statistiques." };
    }
    const groupes = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
    if (!Array.isArray(groupes)) {
      return { statut: "indisponible", raison: "Réponse de Cloudflare inattendue." };
    }
    const brutes: LigneRobotBrute[] = groupes.map(
      (g: { count?: unknown; dimensions?: Record<string, unknown> }) => ({
        date: String(g?.dimensions?.["date"] ?? ""),
        userAgent: String(g?.dimensions?.["userAgent"] ?? ""),
        chemin: String(g?.dimensions?.["clientRequestPath"] ?? ""),
        nombre: typeof g?.count === "number" ? g.count : 0,
      }),
    );
    return {
      statut: "ok",
      jours,
      lignes: agregerRobots(brutes).filter((l) => jours.includes(l.date)),
    };
  } catch {
    return { statut: "indisponible", raison: "Cloudflare ne répond pas pour le moment." };
  }
}

/** Remplace chaque jour de la fenêtre par ses lignes, en UNE transaction (rejouable). */
export async function enregistrerRobotsJours(
  prisma: Pick<PrismaClient, "$transaction">,
  jours: readonly string[],
  lignes: readonly RobotJour[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const j of jours)
      await tx.robotIaJour.deleteMany({ where: { date: new Date(`${j}T00:00:00Z`) } });
    if (lignes.length > 0) {
      await tx.robotIaJour.createMany({
        data: lignes.map((l) => ({
          date: new Date(`${l.date}T00:00:00Z`),
          robot: l.robot,
          famille: l.famille,
          familleChemin: l.familleChemin,
          nombre: l.nombre,
        })),
      });
    }
  });
}

export type IssueRobotsIa =
  | { readonly tache: "robots-ia"; readonly issue: "saute"; readonly motif: string }
  | { readonly tache: "robots-ia"; readonly issue: "fait"; readonly lignes: number };

export async function tacheRobotsIa(
  deps: DepsCollecte & { readonly prisma: Pick<PrismaClient, "$transaction" | "robotIaJour"> },
): Promise<IssueRobotsIa> {
  const c = await collecterRobotsCloudflare(deps);
  if (c.statut !== "ok") return { tache: "robots-ia", issue: "saute", motif: "indisponible" };
  await enregistrerRobotsJours(deps.prisma, c.jours, c.lignes);
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const limite = new Date(
    Date.parse(`${enJour(maintenant)}T00:00:00Z`) - RETENTION_JOURS * 86_400_000,
  );
  await deps.prisma.robotIaJour.deleteMany({ where: { date: { lt: limite } } });
  return { tache: "robots-ia", issue: "fait", lignes: c.lignes.length };
}
