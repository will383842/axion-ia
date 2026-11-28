/**
 * Collecte quotidienne des robots d'IA via l'API GraphQL Analytics de Cloudflare (P10).
 *
 * - Lecture SEULE, en AGRÉGATS : le user-agent brut est classé puis jeté (voir `robots-ia.ts`) ;
 *   aucune adresse IP n'est demandée à Cloudflare.
 * - Sans jeton ou sans zone (le droit `Analytics:Read` est une décision de Will), avec le stub de
 *   build, sur un refus ou une panne : `{ statut: "indisponible" }`, jamais d'exception, jamais
 *   d'écho du corps de la réponse.
 * - Fenêtre : les 3 derniers jours finis (UTC), UNE requête par jour, chaque jour remplacé en bloc : rejouable, et un
 *   passage manqué se rattrape au suivant.
 * - Un jour tronqué (10 000 lignes) ou vide n'est PAS écrit. Le filtre `userAgent_like` est
 *   probablement sensible à la casse : une casse inhabituelle n'est pas comptée.
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
      /** Jours laissés tels quels parce que la réponse était tronquée (limite de lignes). */
      readonly incomplets: number;
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

// Types de variables de l'API Analytics : `string` (minuscules) pour `zoneTag`, `Date` pour les jours.
const REQUETE = `query($zone:string,$jour:Date){viewer{zones(filter:{zoneTag:$zone}){httpRequestsAdaptiveGroups(limit:${LIMITE_LIGNES},filter:{date:$jour,OR:[${FILTRE_ROBOTS}]},orderBy:[count_DESC]){count dimensions{date userAgent clientRequestPath}}}}}`;
export const REQUETE_ROBOTS_CLOUDFLARE = REQUETE;

export interface DepsCollecte {
  readonly env?: Env;
  readonly fetchFn?: typeof fetch;
  readonly maintenant?: () => Date;
}

type LectureJour =
  | { readonly ok: true; readonly lignes: readonly RobotJour[]; readonly incomplet: boolean }
  | { readonly ok: false; readonly raison: string };

/** UNE requête par jour (la plage par requête est limitée selon l'offre Cloudflare). */
async function lireJour(
  jour: string,
  jeton: string,
  zone: string,
  fetchFn: typeof fetch,
): Promise<LectureJour> {
  const res = await fetchFn(URL_GRAPHQL_CLOUDFLARE, {
    method: "POST",
    headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
    body: JSON.stringify({ query: REQUETE, variables: { zone, jour } }),
    signal: AbortSignal.timeout(DELAI_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      ok: false,
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
    return { ok: false, raison: "Cloudflare a refusé la requête de statistiques." };
  }
  const groupes = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
  if (!Array.isArray(groupes)) return { ok: false, raison: "Réponse de Cloudflare inattendue." };
  const brutes: LigneRobotBrute[] = groupes.map(
    (g: { count?: unknown; dimensions?: Record<string, unknown> }) => ({
      date: String(g?.dimensions?.["date"] ?? ""),
      userAgent: String(g?.dimensions?.["userAgent"] ?? ""),
      chemin: String(g?.dimensions?.["clientRequestPath"] ?? ""),
      nombre: typeof g?.count === "number" ? g.count : 0,
    }),
  );
  return {
    ok: true,
    incomplet: groupes.length >= LIMITE_LIGNES,
    lignes: agregerRobots(brutes).filter((l) => l.date === jour),
  };
}

/**
 * `jours` ne contient que les jours À REMPLACER : un jour tronqué (limite de lignes atteinte) ou
 * vide n'y figure pas, pour ne jamais écraser un état meilleur (rétention de l'offre Cloudflare).
 */
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
  const fenetre = fenetreJours((deps.maintenant ?? (() => new Date()))());
  const jours: string[] = [];
  const lignes: RobotJour[] = [];
  let incomplets = 0;
  try {
    for (const jour of fenetre) {
      const r = await lireJour(jour, jeton, zone, deps.fetchFn ?? fetch);
      if (!r.ok) return { statut: "indisponible", raison: r.raison };
      if (r.incomplet) {
        incomplets += 1;
        continue;
      }
      if (r.lignes.length === 0) continue;
      jours.push(jour);
      lignes.push(...r.lignes);
    }
  } catch {
    return { statut: "indisponible", raison: "Cloudflare ne répond pas pour le moment." };
  }
  return { statut: "ok", jours, lignes, incomplets };
}

/** Remplace chaque jour de la fenêtre par ses lignes, en UNE transaction (rejouable). */
export async function enregistrerRobotsJours(
  prisma: Pick<PrismaClient, "$transaction">,
  jours: readonly string[],
  lignes: readonly RobotJour[],
): Promise<void> {
  if (jours.length === 0) return;
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
  | {
      readonly tache: "robots-ia";
      readonly issue: "saute";
      readonly motif: string;
      /** Faux seulement quand la mesure n'est pas configurée (jeton absent) : c'est un état normal. */
      readonly anormal: boolean;
    }
  | {
      readonly tache: "robots-ia";
      readonly issue: "fait";
      readonly lignes: number;
      readonly incomplets: number;
    };

export async function tacheRobotsIa(
  deps: DepsCollecte & { readonly prisma: Pick<PrismaClient, "$transaction" | "robotIaJour"> },
): Promise<IssueRobotsIa> {
  const c = await collecterRobotsCloudflare(deps);
  if (c.statut !== "ok") {
    return {
      tache: "robots-ia",
      issue: "saute",
      motif: c.raison,
      anormal: !c.raison.startsWith("Jeton ou zone"),
    };
  }
  await enregistrerRobotsJours(deps.prisma, c.jours, c.lignes);
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const limite = new Date(
    Date.parse(`${enJour(maintenant)}T00:00:00Z`) - RETENTION_JOURS * 86_400_000,
  );
  await deps.prisma.robotIaJour.deleteMany({ where: { date: { lt: limite } } });
  return { tache: "robots-ia", issue: "fait", lignes: c.lignes.length, incomplets: c.incomplets };
}
