import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

// `acces.ts` importe `@/auth` (next-auth) pour ses gardes de PAGE — hors sujet
// ici, et next-auth exige un `next/server` que vitest ne résout pas. Même
// simulation que `admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
// Le limiteur de débit parle à Redis : simulé, comme dans `route.test.ts`.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, remaining: 1, resetAt: 0 }),
}));

import { z } from "zod/v4";

import {
  DATA_CLASSES,
  EFFECTS,
  ID_ADAPTATEUR,
  MODE_ADAPTATEUR,
  NOMS_RESERVES_AU_CONTEXTE,
  nomComplet,
  PROFILS_DU_SOCLE,
  SCEAU_PROFILS,
  SECRETS_DE_L_ADAPTATEUR,
  type OutilQuelconque,
} from "../contrat";
import { canoniser, octetsCanoniques, versValeurJson, type ValeurJson } from "../json-canonique";
import { analyserOutils, construireManifeste, empreinteDuManifeste } from "../manifeste";
import { OUTILS } from "../registre";
import { SYMBOLES_AUTORISES } from "../symboles-autorises";

/**
 * **LE HARNAIS DE CONFORMITÉ — NEUF CONTRÔLES** (cahier des charges, § 09),
 * plus le contrôle C13.3 (rang 2 optionnel) et le sceau des profils.
 *
 * ═══ CHAQUE CONTRÔLE ANNONCE CE QU'IL A MESURÉ ═══
 *
 * Un contrôle vert sur zéro élément n'est pas un contrôle : c'est le défaut
 * mesuré sur `surface-server-actions.spec.ts`, où une regex qui cessait de
 * reconnaître sa cible rendait le fichier entièrement vert. Ici, chaque
 * contrôle compte, et un plancher-témoin le fait rougir s'il compte trop peu.
 *
 * ═══ ET LES DEUX SENS ═══
 *
 * Là où c'est possible, un témoin FABRIQUÉ vérifie que la garde rougit :
 * un schéma d'entrée ouvert, un nom réservé glissé dans l'entrée, un champ de
 * rang 2 obligatoire. Une garde qui n'a jamais rougi n'a jamais été vue garder.
 */

const RACINE_MCP = resolve(__dirname, "..");
const RACINE_DEPOT = resolve(__dirname, "../../../..");

/** Plancher-témoin : le nombre de fichiers d'adaptateur que la garde DOIT lire. */
const PLANCHER_FICHIERS = 12;

function fichiersDeLAdaptateur(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "fixtures") continue;
      out.push(...fichiersDeLAdaptateur(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(nom) || /\.(?:test|spec)\.tsx?$/.test(nom)) continue;
    out.push(chemin);
  }
  return out;
}

const FICHIERS = fichiersDeLAdaptateur(RACINE_MCP);

/** Retire commentaires et chaînes pour ne mesurer que le CODE. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Un outil témoin, minimal et VALIDE, sur lequel on greffe une seule faute. */
function outilTemoin(surcharge: Partial<OutilQuelconque>): OutilQuelconque {
  return {
    name: "temoin.lecture",
    version: "1.0.0",
    description: "Témoin de garde.",
    effect: "read",
    dataClass: "none",
    idempotency: "n/a",
    pagination: "none",
    input: z.strictObject({ limite: z.number().int().optional() }),
    output: z.strictObject({
      items: z.array(z.strictObject({ id: z.string(), extra: z.string().optional() })),
    }),
    maxBytes: 1024,
    compaction: { free: [], tier2: ["extra"], aggregateBy: null },
    idFields: ["id"],
    governanceFields: [],
    fixtureMax: "fixtures/temoin.json",
    handler: async () => ({ items: [] }),
    ...surcharge,
  };
}

describe("contrôle 9 — la garde annonce combien de fichiers d'adaptateur elle a lus", () => {
  it(`lit au moins ${String(PLANCHER_FICHIERS)} fichiers — sinon elle mesure le vide`, () => {
    console.info(
      `[harnais·9] ${String(FICHIERS.length)} fichier(s) d'adaptateur lu(s) sous ` +
        `${relative(RACINE_DEPOT, RACINE_MCP)} (plancher ${String(PLANCHER_FICHIERS)})`,
    );
    expect(FICHIERS.length).toBeGreaterThanOrEqual(PLANCHER_FICHIERS);
  });
});

describe("contrôle 1 — chaque outil déclare effect et dataClass, sans défaut permissif", () => {
  it("les six outils portent des valeurs de l'énumération du socle", () => {
    let mesures = 0;
    for (const outil of OUTILS) {
      expect(EFFECTS, `${outil.name} : effect`).toContain(outil.effect);
      expect(DATA_CLASSES, `${outil.name} : dataClass`).toContain(outil.dataClass);
      // Aucune lecture ne se déclare « none » : toutes touchent des personnes.
      expect(outil.dataClass, `${outil.name} touche des personnes`).not.toBe("none");
      mesures += 1;
    }
    console.info(`[harnais·1] ${String(mesures)} outil(s) confronté(s) aux énumérations`);
    expect(mesures).toBe(OUTILS.length);
    expect(OUTILS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("contrôle 2 — aucun accès direct à process.env ni à un secret", () => {
  it("aucun fichier de l'adaptateur ne lit process.env", () => {
    const fautifs: string[] = [];
    for (const chemin of FICHIERS) {
      const code = sansCommentaires(readFileSync(chemin, "utf8"));
      if (/process\.env/.test(code)) fautifs.push(relative(RACINE_DEPOT, chemin));
    }
    console.info(
      `[harnais·2] ${String(FICHIERS.length)} fichier(s) scanné(s), ${String(fautifs.length)} fautif(s)`,
    );
    expect(fautifs).toEqual([]);
  });

  it("mode fédéré ⇒ secrets: [] — le socle refuserait l'enregistrement sinon", () => {
    expect(MODE_ADAPTATEUR).toBe("fédéré");
    expect(SECRETS_DE_L_ADAPTATEUR).toHaveLength(0);
  });
});

describe("contrôle 3 — aucun appel qui contourne la couche service", () => {
  const MOTIF_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  const autorises = new Map(SYMBOLES_AUTORISES.map((a) => [a.module, new Set(a.symboles)]));

  it("chaque import hors de src/server/mcp est dans la liste NOMMÉE — et annonce son compte", () => {
    let importsConfrontes = 0;
    const fautifs: string[] = [];
    for (const chemin of FICHIERS) {
      const code = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of code.matchAll(MOTIF_IMPORT)) {
        const spec = m[3] ?? "";
        // Les imports internes à l'adaptateur et ceux de bibliothèques sont hors sujet :
        // ce contrôle vise la COUCHE SERVICE du produit.
        if (
          spec.startsWith("./") ||
          spec.startsWith("../contrat") ||
          spec.startsWith("../sortie")
        ) {
          continue;
        }
        if (spec.startsWith("../") && !spec.includes("prisma/generated")) continue;
        if (!spec.startsWith("@/") && !spec.includes("prisma/generated")) continue;
        // Un TYPE n'existe pas à l'exécution : il ne peut contourner aucune couche.
        if (m[1] !== undefined) continue;
        const symboles = (m[2] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !/^type\s/.test(s))
          .map((s) => s.split(/\s+as\s+/)[0] ?? "");
        for (const symbole of symboles) {
          importsConfrontes += 1;
          if (!autorises.get(spec)?.has(symbole)) {
            fautifs.push(`${relative(RACINE_DEPOT, chemin)} → ${symbole} depuis ${spec}`);
          }
        }
      }
    }
    console.info(
      `[harnais·3] ${String(importsConfrontes)} import(s) de couche service confronté(s)`,
    );
    expect(importsConfrontes).toBeGreaterThanOrEqual(10);
    expect(fautifs).toEqual([]);
  });

  it("chaque symbole autorisé EXISTE encore — une entrée morte fait rougir le cliquet", async () => {
    // Chargeurs à spécificateur LITTÉRAL : un import dynamique à variable ne
    // passe pas par l'alias `@/` de façon fiable, et une résolution ratée
    // ressemblerait à un symbole disparu.
    const chargeurs: Record<string, () => Promise<Record<string, unknown>>> = {
      "@/features/admin-inbox/queries": () => import("@/features/admin-inbox/queries"),
      "@/features/admin-agenda/queries": () => import("@/features/admin-agenda/queries"),
      "@/lib/calendar-grid": () => import("@/lib/calendar-grid"),
      "@/features/admin-rendezvous/queries": () => import("@/features/admin-rendezvous/queries"),
      "@/features/admin-rendezvous/types": () => import("@/features/admin-rendezvous/types"),
      "@/features/admin-planning/hub-queries": () =>
        import("@/features/admin-planning/hub-queries"),
      "@/server/qualiopi/alertes/alertes-service": () =>
        import("@/server/qualiopi/alertes/alertes-service"),
      "../../../../prisma/generated/client": () => import("../../../../prisma/generated/client"),
      "@/features/admin-calendly/acces": () => import("@/features/admin-calendly/acces"),
    };
    let verifies = 0;
    for (const { module, symboles } of SYMBOLES_AUTORISES) {
      const charger = chargeurs[module];
      expect(charger, `aucun chargeur pour « ${module} » — en ajouter un ici`).toBeDefined();
      const mod = await charger!();
      for (const symbole of symboles) {
        expect(mod[symbole], `« ${symbole} » n'est plus exporté par ${module}`).toBeDefined();
        verifies += 1;
      }
    }
    console.info(`[harnais·3] ${String(verifies)} symbole(s) autorisé(s) vérifié(s) à l'exécution`);
    expect(verifies).toBeGreaterThanOrEqual(10);
  });
});

describe("contrôle 4 — aucune sortie ne dépasse son maxBytes sur son fixtureMax", () => {
  it("valide chaque jeu maximal contre son schéma et son plafond — et annonce combien", () => {
    let executes = 0;
    for (const outil of OUTILS) {
      const chemin = resolve(RACINE_MCP, outil.fixtureMax);
      expect(
        existsSync(chemin),
        `${outil.name} : ${outil.fixtureMax} manque (pnpm mcp:fixtures)`,
      ).toBe(true);
      const jeu = JSON.parse(readFileSync(chemin, "utf8")) as ValeurJson;
      const validation = outil.output.safeParse(jeu);
      expect(validation.success, `${outil.name} : le jeu ne respecte plus son schéma`).toBe(true);
      const octets = octetsCanoniques(jeu);
      console.info(
        `[harnais·4] ${nomComplet(outil.name)} · ${String(octets)} / ${String(outil.maxBytes)} octets`,
      );
      expect(octets, `${outil.name} dépasse maxBytes`).toBeLessThanOrEqual(outil.maxBytes);
      // Un jeu « maximal » qui ne remplirait qu'un quart du plafond ne mesurerait rien.
      expect(octets, `${outil.name} : jeu trop léger pour être maximal`).toBeGreaterThan(
        outil.maxBytes / 4,
      );
      executes += 1;
    }
    console.info(`[harnais·4] ${String(executes)} fixture(s) exécutée(s)`);
    expect(executes).toBe(OUTILS.length);
  });
});

describe("contrôle 5 — les préfixes sont dérivés de l'id, jamais saisis", () => {
  it("aucun nom d'outil ne porte l'id ; le nom complet le porte exactement une fois", () => {
    for (const outil of OUTILS) {
      expect(outil.name.startsWith(`${ID_ADAPTATEUR}.`)).toBe(false);
      expect(nomComplet(outil.name)).toBe(`${ID_ADAPTATEUR}.${outil.name}`);
    }
    const noms = OUTILS.map((o) => nomComplet(o.name));
    expect(new Set(noms).size).toBe(noms.length);
    console.info(`[harnais·5] ${String(noms.length)} nom(s) : ${noms.join(", ")}`);
  });

  it("rougit sur un préfixe saisi à la main", () => {
    const analyse = analyserOutils([outilTemoin({ name: `${ID_ADAPTATEUR}.temoin` })]);
    expect(analyse.manifeste).toBeNull();
    expect(analyse.anomalies.join(" ")).toMatch(/préfixe est DÉRIVÉ/);
  });
});

describe("contrôle 6 — le manifeste est produit et son SHA est stable", () => {
  it("deux constructions donnent la même empreinte", () => {
    const a = empreinteDuManifeste(construireManifeste());
    const b = empreinteDuManifeste(construireManifeste());
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    console.info(`[harnais·6] ${a}`);
  });
});

describe("contrôle 7 — aucun champ d'autorisation ne provient du schéma d'entrée", () => {
  it("les six schémas d'entrée sont FERMÉS et sans nom réservé — via l'analyse du manifeste", () => {
    const analyse = analyserOutils();
    expect(analyse.anomalies).toEqual([]);
    expect(analyse.outilsInspectes).toBe(OUTILS.length);
    console.info(
      `[harnais·7] ${String(analyse.outilsInspectes)} schéma(s) d'entrée inspecté(s) contre ` +
        `${String(NOMS_RESERVES_AU_CONTEXTE.length)} nom(s) réservé(s)`,
    );
  });

  it("rougit sur CHAQUE nom réservé glissé dans une entrée, fabriqué un par un", () => {
    let refuses = 0;
    for (const nom of NOMS_RESERVES_AU_CONTEXTE) {
      const analyse = analyserOutils([
        outilTemoin({ input: z.strictObject({ [nom]: z.string() }) }),
      ]);
      expect(analyse.manifeste, `« ${nom} » devait être refusé`).toBeNull();
      expect(analyse.anomalies.join(" ")).toContain(nom);
      refuses += 1;
    }
    console.info(`[harnais·7] ${String(refuses)} témoin(s) de nom réservé, tous refusés`);
    expect(refuses).toBe(NOMS_RESERVES_AU_CONTEXTE.length);
  });

  it("rougit sur un schéma d'entrée OUVERT (z.object sans strict), même imbriqué", () => {
    const plat = analyserOutils([outilTemoin({ input: z.object({ a: z.string() }) })]);
    expect(plat.manifeste).toBeNull();
    expect(plat.anomalies.join(" ")).toMatch(/OUVERT/);

    const imbrique = analyserOutils([
      outilTemoin({ input: z.strictObject({ filtre: z.object({ a: z.string() }) }) }),
    ]);
    expect(imbrique.manifeste).toBeNull();
    expect(imbrique.anomalies.join(" ")).toMatch(/OUVERT en .*filtre/);
  });
});

describe("contrôle 8 — la route, appelée sans le secret partagé, rend 401 ou 503", () => {
  // Le premier import de la route charge toute la couche service : marge.
  it("503 sans configuration, 401 avec un secret faux", { timeout: 30_000 }, async () => {
    const sauvegarde = { db: process.env.DATABASE_URL, secret: process.env.MCP_SHARED_SECRET };
    try {
      process.env.DATABASE_URL = "postgresql://reel:reel@localhost:5432/reel";
      delete process.env.MCP_SHARED_SECRET;
      const { POST } = await import("@/app/api/mcp/route");
      const requete = (secret?: string) =>
        new Request("https://exemple.test/api/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(secret ? { "x-mcp-secret": secret } : {}),
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });
      expect((await POST(requete("x") as never)).status).toBe(503);
      process.env.MCP_SHARED_SECRET = "un-secret-de-garde";
      expect((await POST(requete("pas-le-bon") as never)).status).toBe(401);
      expect((await POST(requete() as never)).status).toBe(401);
      console.info("[harnais·8] sans secret → 503 ; secret faux → 401 ; sans en-tête → 401");
    } finally {
      if (sauvegarde.db === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = sauvegarde.db;
      if (sauvegarde.secret === undefined) delete process.env.MCP_SHARED_SECRET;
      else process.env.MCP_SHARED_SECRET = sauvegarde.secret;
    }
  });
});

describe("C13.3 — un champ de rang 2 est OPTIONNEL au schéma de sortie", () => {
  it("les six outils passent ; un témoin à rang 2 obligatoire est refusé", () => {
    expect(analyserOutils().anomalies).toEqual([]);
    const analyse = analyserOutils([
      outilTemoin({
        output: z.strictObject({
          items: z.array(z.strictObject({ id: z.string(), extra: z.string() })),
        }),
      }),
    ]);
    expect(analyse.manifeste).toBeNull();
    expect(analyse.anomalies.join(" ")).toMatch(/rang 2 mais OBLIGATOIRE/);
  });
});

describe("le sceau des profils — recalculé depuis l'énumération, avec l'algorithme du socle", () => {
  it("l'empreinte de PROFILS_DU_SOCLE est celle de SCEAU_PROFILS", () => {
    // `core/profiles/profiles.ts` : sha256 du JSON canonique de
    // { version, profils: [{ nom, depuis }] } — clés triées, sans espace.
    const canonique = canoniser(
      versValeurJson({
        version: SCEAU_PROFILS.version,
        profils: PROFILS_DU_SOCLE.map((p) => ({ nom: p.nom, depuis: p.depuis })),
      }),
    );
    const empreinte = createHash("sha256").update(canonique, "utf8").digest("hex");
    console.info(`[harnais·sceau] ${String(PROFILS_DU_SOCLE.length)} profil(s) · ${empreinte}`);
    expect(empreinte).toBe(SCEAU_PROFILS.empreinte);
  });
});
