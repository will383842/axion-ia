// Banc @formateurs (missions) — piloter le processus serveur depuis un spec.
//
// Un `tsx` par fichier de spec (`missions-serveur.ts`), lancé une fois, qui reçoit
// les gestes un par un. Le spec ne fait QUE choisir les gestes et constater en
// base avec son propre client Prisma (`base.ts`).
//
// Un geste a deux formes :
//   · `appeler(module, fonction, args, contexte)` : le code tel quel ;
//   · les raccourcis `console(...)` (administrateur fictif connecté) et
//     `espace(trainerId, ...)` (formateur connecté à son espace).

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const SERVEUR = path.join(ICI, "missions-serveur.ts");
const CROCHETS = path.join(ICI, "missions-crochets.mjs");
const MARQUEUR = "@@BANC-MISSIONS@@";

/**
 * La base Redis des scénarios missions : la MÊME instance, une autre base (n° 1).
 *
 * 🔑 Les e-mails des scénarios entrent dans la VRAIE file BullMQ (`enqueueEmail`,
 * journal `email_logs` écrit, job rangé avec ses données) — mais une file que le
 * worker du job ne consomme pas. Raison : le worker plafonne à 40 envois par heure
 * (`email-worker.ts`, `limiter`) et un passage des scénarios en enfile environ 70 ;
 * consommés, ils épuiseraient le plafond et la preuve de LIVRAISON au puits
 * (`envois-par-la-file.spec.ts`) attendrait une heure derrière eux. Les scénarios
 * prouvent ce qui est enfilé et son contenu rendu (`envoiRendu`) ; la livraison
 * elle-même est prouvée, une fois, par ce spec-là.
 */
function redisDuBanc(): string {
  const u = new URL(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  u.pathname = "/1";
  return u.toString();
}

/** Démarrage (~10 s, les actions tirent beaucoup de modules) puis un geste. */
const DELAI_GESTE_MS = 60_000;

export interface AdminBanc {
  readonly id: string;
  readonly role: string;
  readonly email: string;
}

export interface ContexteGeste {
  readonly admin?: AdminBanc;
  readonly formateurId?: string;
}

export class GesteEnEchec extends Error {
  constructor(
    readonly geste: string,
    readonly erreur: string,
    readonly digest: string | undefined,
    pile: string,
  ) {
    super(`geste ${geste} en échec : ${erreur}\n${pile}`);
  }
}

interface Reponse {
  readonly id: number;
  readonly ok: boolean;
  readonly valeur?: unknown;
  readonly erreur?: string;
  readonly digest?: string;
  readonly pile?: string;
}

/** Dates → `{$date}` à l'aller ; `{$date}` → Date au retour. */
function aplatir(x: unknown): unknown {
  if (x instanceof Date) return { $date: x.toISOString() };
  if (x instanceof FormData) {
    const o: Record<string, string[]> = {};
    for (const [k, v] of x.entries()) (o[k] ??= []).push(String(v));
    return { $formData: o };
  }
  if (Array.isArray(x)) return x.map(aplatir);
  if (x !== null && typeof x === "object") {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, aplatir(v)]));
  }
  return x;
}

function raviver(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(raviver);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (typeof o["$date"] === "string" && Object.keys(o).length === 1) return new Date(o["$date"]);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, raviver(v)]));
  }
  return x;
}

export interface Pilote {
  /** Appelle `fonction` du module, rend sa valeur ; lève `GesteEnEchec` si elle lève. */
  appeler<T = unknown>(
    module: string,
    fonction: string,
    args?: readonly unknown[],
    contexte?: ContexteGeste,
  ): Promise<T>;
  /** Comme `appeler`, mais rend l'erreur au lieu de lever (une action qui `throw`). */
  essayer<T = unknown>(
    module: string,
    fonction: string,
    args?: readonly unknown[],
    contexte?: ContexteGeste,
  ): Promise<{ ok: true; valeur: T } | { ok: false; erreur: string; digest?: string }>;
  /** La sortie d'erreur du processus (pour les messages d'échec). */
  journal(): string;
  arreter(): Promise<void>;
}

export async function demarrerPilote(): Promise<Pilote> {
  const enfant: ChildProcessWithoutNullStreams = spawn(TSX, ["--import", CROCHETS, SERVEUR], {
    cwd: RACINE,
    env: {
      ...process.env,
      // Les mêmes valeurs FICTIVES que l'exécuteur commun (`execution.ts`).
      CRM_SYNC_ENABLED: "true",
      REDIS_URL: redisDuBanc(),
    },
  });
  let tampon = "";
  let erreurs = "";
  let suivant = 1;
  const attentes = new Map<number, (r: Reponse) => void>();
  let pret: (() => void) | null = null;
  let mort: ((e: Error) => void) | null = null;
  const demarre = new Promise<void>((resolve, reject) => {
    pret = resolve;
    mort = reject;
  });

  enfant.stdout.setEncoding("utf8");
  enfant.stdout.on("data", (morceau: string) => {
    tampon += morceau;
    let i: number;
    while ((i = tampon.indexOf("\n")) >= 0) {
      const ligne = tampon.slice(0, i);
      tampon = tampon.slice(i + 1);
      const j = ligne.indexOf(MARQUEUR);
      if (j < 0) continue;
      const r = JSON.parse(ligne.slice(j + MARQUEUR.length)) as Reponse;
      if (r.id === 0) {
        pret?.();
        continue;
      }
      attentes.get(r.id)?.(r);
      attentes.delete(r.id);
    }
  });
  enfant.stderr.setEncoding("utf8");
  enfant.stderr.on("data", (m: string) => {
    erreurs = (erreurs + m).slice(-20_000);
  });
  enfant.on("exit", (code) => {
    const e = new Error(
      `processus serveur du banc arrêté (code ${code}) :\n${erreurs.slice(-4000)}`,
    );
    mort?.(e);
    for (const [, r] of attentes) r({ id: -1, ok: false, erreur: e.message });
    attentes.clear();
  });

  const delaiDemarrage = setTimeout(
    () => mort?.(new Error(`processus serveur du banc muet :\n${erreurs.slice(-4000)}`)),
    DELAI_GESTE_MS,
  );
  await demarre;
  clearTimeout(delaiDemarrage);

  function envoyer(
    module: string,
    fonction: string,
    args: readonly unknown[],
    contexte: ContexteGeste | undefined,
  ): Promise<Reponse> {
    const id = suivant++;
    return new Promise<Reponse>((resolve, reject) => {
      const minuteur = setTimeout(() => {
        attentes.delete(id);
        reject(new Error(`geste ${module}#${fonction} sans réponse :\n${erreurs.slice(-4000)}`));
      }, DELAI_GESTE_MS);
      attentes.set(id, (r) => {
        clearTimeout(minuteur);
        resolve(r);
      });
      enfant.stdin.write(
        `${JSON.stringify({ id, module, fonction, args: aplatir(args), contexte: contexte ?? {} })}\n`,
      );
    });
  }

  return {
    async appeler<T>(
      module: string,
      fonction: string,
      args: readonly unknown[] = [],
      contexte?: ContexteGeste,
    ): Promise<T> {
      const r = await envoyer(module, fonction, args, contexte);
      if (!r.ok) {
        throw new GesteEnEchec(`${module}#${fonction}`, r.erreur ?? "?", r.digest, r.pile ?? "");
      }
      return raviver(r.valeur) as T;
    },
    async essayer<T>(
      module: string,
      fonction: string,
      args: readonly unknown[] = [],
      contexte?: ContexteGeste,
    ) {
      const r = await envoyer(module, fonction, args, contexte);
      if (r.ok) return { ok: true as const, valeur: raviver(r.valeur) as T };
      return {
        ok: false as const,
        erreur: r.erreur ?? "?",
        ...(r.digest !== undefined ? { digest: r.digest } : {}),
      };
    },
    journal: () => erreurs,
    async arreter() {
      if (enfant.exitCode !== null) return;
      const fini = new Promise<void>((resolve) => enfant.once("exit", () => resolve()));
      enfant.stdin.end();
      const force = setTimeout(() => enfant.kill("SIGKILL"), 10_000);
      await fini;
      clearTimeout(force);
    },
  };
}
