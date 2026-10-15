// Banc @formateurs (missions) — le PROCESSUS SERVEUR persistant, lancé par `tsx`.
//
// ── Pourquoi persistant ─────────────────────────────────────────────────────
// Un scénario de mission enchaîne quinze à trente gestes (choisir, proposer,
// refuser, passer l'heure, signer…). L'exécuteur commun (`serveur/executer.ts`)
// démarre un `tsx` par geste (~5 s) : trente gestes dépasseraient le budget du
// job. Ici, UN processus par fichier de spec charge les modules une fois, puis
// reçoit les gestes un par un sur son entrée standard.
//
// ── Ce qu'il appelle ────────────────────────────────────────────────────────
// Le code RÉEL : les actions de la console et de l'espace formateur (avec leurs
// gardes), les services, les passages planifiés. Un geste = « tel module, telle
// fonction exportée, tels arguments ». Le spec choisit, ce processus exécute.
//
// ── Ce qu'il a de simulé, et rien d'autre ───────────────────────────────────
//   · la REQUÊTE : `@/auth`, `next/headers`, `next/cache` sont remplacés par
//     `missions-crochets.mjs` — la session de console est l'administrateur
//     fictif du banc, le cookie formateur est signé par la vraie fonction ;
//   · le RÉSEAU : coupé (`reseau-simule.ts`, aucune route). Telegram, Plausible…
//     sont best-effort dans le code : une coupure est leur cas nominal.
// La base, Redis, la file d'e-mails et le worker sont RÉELS. L'horloge n'est
// jamais truquée : un passage planifié reçoit son `maintenant` en argument ;
// une action de la console lit l'heure réelle, comme en production.
//
// Protocole (lignes JSON) :
//   entrée  {"id":n,"module":"@/…","fonction":"…","args":[…],"contexte":{…}}
//   sortie  @@BANC-MISSIONS@@{"id":n,"ok":true,"valeur":…}
//        ou @@BANC-MISSIONS@@{"id":n,"ok":false,"erreur":"…","digest":"…"}
// Dates : `{"$date":"ISO"}` dans les deux sens. FormData : `{"$formData":{…}}`.

import readline from "node:readline";

import { signFormateurSession } from "@/lib/formateur-session";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";

import { installerReseauSimule } from "./reseau-simule";

const MARQUEUR = "@@BANC-MISSIONS@@";

interface ContexteAppel {
  readonly admin?: { readonly id: string; readonly role: string; readonly email: string };
  /** Le formateur CONNECTÉ à son espace (cookie signé par `signFormateurSession`). */
  readonly formateurId?: string;
}

interface Requete {
  readonly id: number;
  readonly module: string;
  readonly fonction: string;
  readonly args: readonly unknown[];
  readonly contexte?: ContexteAppel;
}

/** ⛔ Jamais ailleurs que sur une base locale : le banc écrit et efface. */
function exigerBaseLocale(): void {
  let hote = "";
  try {
    hote = new URL(process.env["DATABASE_URL"] ?? "").hostname;
  } catch {
    // URL illisible : refusée ci-dessous.
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    throw new Error(`banc @formateurs : base non locale refusée (hôte « ${hote || "?"} »)`);
  }
}

function raviver(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(raviver);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (typeof o["$date"] === "string" && Object.keys(o).length === 1) {
      return new Date(o["$date"]);
    }
    if (o["$formData"] !== undefined && Object.keys(o).length === 1) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(o["$formData"] as Record<string, unknown>)) {
        for (const valeur of Array.isArray(v) ? v : [v]) fd.append(k, String(valeur));
      }
      return fd;
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, raviver(v)]));
  }
  return x;
}

function aplatir(x: unknown, vus = new WeakSet<object>()): unknown {
  if (x instanceof Date) return { $date: x.toISOString() };
  if (typeof x === "bigint") return Number(x);
  if (Buffer.isBuffer(x) || x instanceof Uint8Array) return { $octets: x.length };
  if (x instanceof Set) return [...x].map((v) => aplatir(v, vus));
  if (x instanceof Map) return Object.fromEntries([...x].map(([k, v]) => [k, aplatir(v, vus)]));
  if (Array.isArray(x)) return x.map((v) => aplatir(v, vus));
  if (x !== null && typeof x === "object") {
    if (vus.has(x)) return "[cycle]";
    vus.add(x);
    // Prisma.Decimal et consorts : leur forme texte.
    if (typeof (x as { toFixed?: unknown }).toFixed === "function") return String(x);
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, aplatir(v, vus)]));
  }
  if (typeof x === "function") return "[fonction]";
  return x;
}

function ecrire(reponse: Record<string, unknown>): void {
  process.stdout.write(`\n${MARQUEUR}${JSON.stringify(aplatir(reponse))}\n`);
}

async function traiter(r: Requete): Promise<void> {
  const contexte: Record<string, unknown> = { cookies: {} };
  if (r.contexte?.admin) contexte["admin"] = r.contexte.admin;
  if (r.contexte?.formateurId) {
    contexte["cookies"] = {
      [FORMATEUR_COOKIE_NAME]: await signFormateurSession(r.contexte.formateurId, "formateur"),
    };
  }
  (globalThis as Record<string, unknown>)["__BANC_CONTEXTE__"] = contexte;
  try {
    // `./…` : un module d'aide du banc, à côté de ce fichier (`missions-aides-serveur.ts`).
    const specifier = r.module.startsWith("./")
      ? new URL(r.module, import.meta.url).href
      : r.module;
    const mod = (await import(specifier)) as Record<string, unknown>;
    const f = mod[r.fonction];
    if (typeof f !== "function") throw new Error(`${r.module} n'exporte pas « ${r.fonction} »`);
    const valeur: unknown = await (f as (...a: unknown[]) => unknown)(
      ...(raviver(r.args) as unknown[]),
    );
    ecrire({ id: r.id, ok: true, valeur: valeur ?? null });
  } catch (e) {
    const err = e as { message?: string; digest?: string; stack?: string };
    ecrire({
      id: r.id,
      ok: false,
      erreur: err?.message ?? String(e),
      ...(typeof err?.digest === "string" ? { digest: err.digest } : {}),
      pile: (err?.stack ?? "").split("\n").slice(0, 8).join("\n"),
    });
  } finally {
    (globalThis as Record<string, unknown>)["__BANC_CONTEXTE__"] = undefined;
  }
}

function principal(): void {
  exigerBaseLocale();
  // Réseau coupé pour tout le processus : rien du banc n'atteint un vrai service.
  installerReseauSimule([]);
  const lignes = readline.createInterface({ input: process.stdin });
  // Un geste à la fois, dans l'ordre : un scénario est une suite, pas un lot.
  let file = Promise.resolve();
  lignes.on("line", (ligne) => {
    if (ligne.trim() === "") return;
    const requete = JSON.parse(ligne) as Requete;
    file = file.then(() => traiter(requete));
  });
  lignes.on("close", () => {
    void file.then(() => process.exit(0));
  });
  process.stdout.write(`\n${MARQUEUR}${JSON.stringify({ id: 0, ok: true, valeur: "pret" })}\n`);
}

principal();
