/**
 * Élagueur du cache ISR écrit sur disque par le serveur Next.
 *
 * ## Le défaut que ce module ferme
 *
 * Mesuré le 2026-10-23 sur axion-prod : le conteneur du site pesait **25,5 Go**
 * deux jours après sa mise en ligne, dont 31 Go sous `.next/server/app`
 * (27 000 fichiers écrits en 24 h, une page pèse 1 à 2 Mo en `.html` + autant
 * en `.rsc`). Next écrit chaque page générée ou régénérée à la demande dans le
 * calque inscriptible du conteneur et **ne supprime jamais rien** : la seule
 * remise à zéro est un nouveau conteneur, c'est-à-dire une mise en ligne. Or
 * depuis le 2026-10-08 les créneaux sans nouveau commit sont sautés : quelques
 * jours sans code neuf suffisent à remplir le disque du VPS — qui porte aussi
 * la base, déjà tombée pour disque plein le 2026-10-10.
 *
 * S'y ajoutent des adresses absurdes (liens d'image tronqués par des robots,
 * p. ex. `/fr/implantations/%2Fillustrations%2F…avif&w=1080&q=75`) : chacune
 * est une page 404 rendue PUIS mise en cache, sans limite.
 *
 * ## Pourquoi élaguer, et pas `experimental.isrFlushToDisk: false`
 *
 * Sans écriture disque, une page sortie du cache mémoire (50 Mo ≈ 25 pages)
 * est relue depuis le disque… dans sa version DU BUILD, rendue avec la base
 * `stub.invalid`. On servirait donc, au hasard des évictions, des pages vides.
 * Supprimer une entrée rendue À LA DEMANDE est au contraire sans risque :
 * `FileSystemCache.get` (next/dist/server/lib/incremental-cache/
 * file-system-cache.js) lit d'abord le `.html` ; s'il manque, l'exception est
 * avalée et l'entrée vaut `null` → Next rend la page fraîche et la réécrit.
 *
 * ## Les quatre règles
 *
 * 1. **Ne jamais toucher au build.** Une entrée dont UN fichier est daté de
 *    moins de `MARGE_BUILD_MS` après `.next/BUILD_ID` est protégée (mesure du
 *    2026-10-23 : tout le build tient en 49 s autour de `BUILD_ID`, le
 *    conteneur démarre au plus tôt 7 min après).
 * 2. **Ne jamais toucher une route du `prerender-manifest`, même régénérée.**
 *    Sur une route `dynamicParams = false` (glossaire, centre d'aide, cas
 *    concrets, catégories du blog…), une entrée absente donne `fallbackMode
 *    NOT_FOUND` → **404 jusqu'au déploiement suivant**, même pour une page
 *    prérendue (`build/templates/app-page-runtime.js`, l. 705-715 en 16.3.1 ;
 *    trouvé par la relecture du 2026-10-23). Aucune perte d'efficacité : une
 *    page du manifeste réécrit toujours les mêmes fichiers (3,2 Go stables en
 *    prod) ; ce qui grossit sans fin, ce sont les clés hors manifeste (20 Go).
 *    Manifeste illisible → on ne supprime rien.
 * 3. **Le `.html` part en premier.** Il fait de l'entrée un « absent » pour
 *    Next ; `.meta`, `.rsc` et les segments ne partent qu'après une pause, et
 *    seulement s'ils n'ont pas été réécrits entre-temps (page re-rendue
 *    pendant la pause : ses fichiers neufs restent).
 * 4. **Fichiers seulement, jamais de dossier.** `MultiFileWriter` crée le
 *    dossier puis écrit dedans : retirer un dossier vide ferait échouer une
 *    écriture concurrente.
 *
 * Les plus vieilles entrées partent d'abord, jusqu'à repasser sous 80 % du
 * budget. 100 % fail-soft : une erreur est journalisée, jamais propagée.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";

export const MARGE_BUILD_MS = 10 * 60 * 1000;
export const BUDGET_PAR_DEFAUT_OCTETS = 6 * 1024 ** 3;
export const PAUSE_AVANT_COMPAGNONS_MS = 5_000;

/** Suffixes des entrées de cache écrites par `FileSystemCache.set`. */
const SUFFIXES_ENTREE = [".html", ".rsc", ".meta", ".body", ".segment.rsc"] as const;
const SEGMENTS = ".segments";

type Entree = {
  /** Clé de l'entrée : chemin sans suffixe, relatif à la racine. */
  cle: string;
  principal: string | null;
  compagnons: string[];
  octets: number;
  mtimeMs: number;
  /** Un fichier date du build : l'entrée entière est intouchable. */
  protegee: boolean;
};

export type RapportElagage = {
  octetsAvant: number;
  octetsSupprimes: number;
  entreesSupprimees: number;
};

export type OptionsElagage = {
  /** `.next/server/app` */
  racine: string;
  /** Date (ms) de `.next/BUILD_ID`. */
  dateBuildMs: number;
  budgetOctets: number;
  /** Clés des routes du `prerender-manifest` (cf. `clesDuManifeste`). */
  routesProtegees: ReadonlySet<string>;
  pauseMs?: number;
};

/** `"/"` → `index`, `/fr/glossaire/x` → `fr/glossaire/x` (chemins de `getFilePath`). */
export function clesDuManifeste(manifeste: { routes?: Record<string, unknown> }): Set<string> {
  if (!manifeste.routes || typeof manifeste.routes !== "object") {
    throw new Error("prerender-manifest sans `routes`");
  }
  return new Set(
    Object.keys(manifeste.routes).map((r) => (r === "/" ? "index" : r.replace(/^\//, ""))),
  );
}

/** Rattache un fichier à la clé de son entrée, ou `null` s'il n'en est pas une. */
export function cleDeFichier(relatif: string): { cle: string; principal: boolean } | null {
  const posSegments = relatif.indexOf(`${SEGMENTS}/`);
  if (posSegments !== -1) {
    return { cle: relatif.slice(0, posSegments), principal: false };
  }
  for (const suffixe of SUFFIXES_ENTREE) {
    if (relatif.endsWith(suffixe)) {
      const cle = relatif.slice(0, -suffixe.length);
      return { cle, principal: suffixe === ".html" || suffixe === ".body" };
    }
  }
  return null;
}

async function parcourir(
  dossier: string,
  racine: string,
  vu: Map<string, Entree>,
  seuilMs: number,
): Promise<void> {
  let enfants;
  try {
    enfants = await fsp.readdir(dossier, { withFileTypes: true });
  } catch {
    return; // dossier retiré entre-temps : rien à faire
  }
  for (const enfant of enfants) {
    const complet = path.join(dossier, enfant.name);
    if (enfant.isDirectory()) {
      await parcourir(complet, racine, vu, seuilMs);
      continue;
    }
    if (!enfant.isFile()) continue;
    const relatif = path.relative(racine, complet).split(path.sep).join("/");
    const rattache = cleDeFichier(relatif);
    if (!rattache) continue;
    let stat;
    try {
      stat = await fsp.stat(complet);
    } catch {
      continue;
    }
    let entree = vu.get(rattache.cle);
    if (!entree) {
      entree = {
        cle: rattache.cle,
        principal: null,
        compagnons: [],
        octets: 0,
        mtimeMs: 0,
        protegee: false,
      };
      vu.set(rattache.cle, entree);
    }
    entree.octets += stat.size;
    entree.mtimeMs = Math.max(entree.mtimeMs, stat.mtimeMs);
    // Drapeau à part : indépendant de l'ordre de `readdir` (ext4 ne trie pas).
    if (stat.mtimeMs <= seuilMs) entree.protegee = true;
    if (rattache.principal) entree.principal = complet;
    else entree.compagnons.push(complet);
  }
}

async function existe(fichier: string): Promise<boolean> {
  return fsp.stat(fichier).then(
    () => true,
    () => false,
  );
}

/** Supprime le fichier sauf s'il a été réécrit depuis `depuisMs`. */
async function supprimerSiInchange(fichier: string, depuisMs: number): Promise<void> {
  try {
    if ((await fsp.stat(fichier)).mtimeMs >= depuisMs) return;
  } catch {
    return;
  }
  await supprimer(fichier);
}

async function supprimer(fichier: string): Promise<boolean> {
  try {
    await fsp.unlink(fichier);
    return true;
  } catch {
    return false; // déjà parti : sans conséquence
  }
}

export async function elaguerCacheIsr(options: OptionsElagage): Promise<RapportElagage> {
  const { racine, dateBuildMs, budgetOctets, routesProtegees } = options;
  const pauseMs = options.pauseMs ?? PAUSE_AVANT_COMPAGNONS_MS;
  const debutMs = Date.now();
  const vu = new Map<string, Entree>();
  await parcourir(racine, racine, vu, dateBuildMs + MARGE_BUILD_MS);

  const candidates = [...vu.values()].filter((e) => !e.protegee && !routesProtegees.has(e.cle));
  const octetsAvant = candidates.reduce((s, e) => s + e.octets, 0);
  const rapport: RapportElagage = { octetsAvant, octetsSupprimes: 0, entreesSupprimees: 0 };
  if (octetsAvant <= budgetOctets) return rapport;

  const cible = budgetOctets * 0.8;
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const choisies: Entree[] = [];
  let restant = octetsAvant;
  for (const e of candidates) {
    if (restant <= cible) break;
    choisies.push(e);
    restant -= e.octets;
  }

  for (const e of choisies) if (e.principal) await supprimer(e.principal);
  if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  for (const e of choisies) {
    // Page re-rendue pendant la pause : son `.html` est revenu, on garde tout.
    if (e.principal && (await existe(e.principal))) continue;
    for (const f of e.compagnons) await supprimerSiInchange(f, debutMs);
    rapport.octetsSupprimes += e.octets;
    rapport.entreesSupprimees += 1;
  }
  return rapport;
}

/**
 * Lance l'élagage périodique dans le serveur Node, suivi à chaque tour du
 * contrôle du disque (alerte Telegram au-delà de 85 %). Inerte au build
 * (`stub.invalid`), hors production, et avec `ISR_ELAGAGE=false`.
 * Budget réglable par `ISR_CACHE_BUDGET_GO` (défaut 6).
 */
export function demarrerElagueurCacheIsr(): void {
  if (process.env["NODE_ENV"] !== "production") return;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return; // build (ADR 0026)
  if (process.env["ISR_ELAGAGE"] === "false") return; // kill-switch

  const go = Number(process.env["ISR_CACHE_BUDGET_GO"]);
  const budgetOctets = Number.isFinite(go) && go > 0 ? go * 1024 ** 3 : BUDGET_PAR_DEFAUT_OCTETS;
  const dotNext = path.join(process.cwd(), ".next");
  let enCours = false;

  const tour = async (): Promise<void> => {
    if (enCours) return;
    enCours = true;
    try {
      const { mtimeMs: dateBuildMs } = await fsp.stat(path.join(dotNext, "BUILD_ID"));
      // Illisible → exception → tour annulé sans rien supprimer (règle 2).
      const routesProtegees = clesDuManifeste(
        JSON.parse(await fsp.readFile(path.join(dotNext, "prerender-manifest.json"), "utf8")) as {
          routes?: Record<string, unknown>;
        },
      );
      const r = await elaguerCacheIsr({
        racine: path.join(dotNext, "server", "app"),
        dateBuildMs,
        budgetOctets,
        routesProtegees,
      });
      const { memoriserDernierElagage, alerterSiDisquePlein } =
        await import("@/server/admin/etat-serveur");
      memoriserDernierElagage(r);
      await alerterSiDisquePlein();
      if (r.entreesSupprimees > 0) {
        console.warn(
          `[cache-isr:elagage] ${r.entreesSupprimees} entrées retirées (${(r.octetsSupprimes / 1024 ** 3).toFixed(2)} Go) sur ${(r.octetsAvant / 1024 ** 3).toFixed(2)} Go écrits depuis le build.`,
        );
      }
    } catch (err) {
      console.error(
        "[cache-isr:elagage] échec (sans effet sur le site) :",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      enCours = false;
    }
  };

  setTimeout(() => void tour(), 5 * 60 * 1000).unref();
  setInterval(() => void tour(), 20 * 60 * 1000).unref();
}
