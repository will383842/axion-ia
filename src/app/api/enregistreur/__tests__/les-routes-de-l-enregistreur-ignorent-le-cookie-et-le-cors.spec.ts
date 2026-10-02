/**
 * ⛔ LES ROUTES DE L'ENREGISTREUR IGNORENT LE COOKIE ET LE CORS (PR 5).
 *
 * L'appelant est le service worker de l'extension (`host_permissions`, hors
 * CORS). Donc :
 *   · aucune réponse ne porte d'en-tête `Access-Control-*` (sinon n'importe
 *     quelle page web pourrait appeler ces routes depuis le navigateur de Will) ;
 *   · `OPTIONS` → 405 (pas de pré-vol accepté) ;
 *   · aucune route ne lit de cookie ni de session : un cookie de console valide
 *     SANS jeton reste un 401 ;
 *   · chaque `route.ts` déclare `runtime = "nodejs"`, `dynamic = "force-dynamic"`
 *     et sort sur `stub.invalid` en tête de handler (ADR 0026).
 *
 * Exceptions NOMMÉES : `ouvrir/route.ts` et `relier/route.ts` (1.4.0, « Relier
 * à ma console ») lisent la session (onglets ouverts par Will, pas des appels
 * de l'extension) et ne rendent jamais de CORS.
 *
 * Mutation qui rougit : ajouter `"access-control-allow-origin": "*"` aux
 * en-têtes de `repondre()` → le 1er cas rougit ; importer `cookies` dans une
 * route → le 3ᵉ rougit. Contre-témoin : le balayage trouve bien 11 routes.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { traiterCreerSession, traiterRencontresDuJour } from "@/server/visio/routes-enregistreur";
import { indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import {
  depsDeTest,
  fausseBase,
  requete,
  semerAppareil,
} from "../../../../../tests/outils/fixtures-enregistreur";

const RACINE = join(process.cwd(), "src", "app", "api", "enregistreur");

function routes(dossier = RACINE): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const c = join(dossier, e);
    if (statSync(c).isDirectory()) {
      if (e !== "__tests__") out.push(...routes(c));
    } else if (e === "route.ts") out.push(c);
  }
  return out;
}

function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("⛔ les routes de l'enregistreur ignorent le cookie et le CORS", () => {
  it("aucune réponse ne porte d'en-tête CORS (succès, refus, 503, 405)", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const reponses = [
      await traiterRencontresDuJour(requete("rencontres-du-jour", { jeton }), depsDeTest(db)),
      await traiterRencontresDuJour(requete("rencontres-du-jour", { jeton: null }), depsDeTest(db)),
      await traiterRencontresDuJour(
        requete("rencontres-du-jour", { jeton }),
        depsDeTest(db, { env: {} }),
      ),
      indisponibleAuBuild(),
      methodeRefusee(),
    ];
    for (const r of reponses) {
      const cors = [...r.headers.keys()].filter((k) =>
        k.toLowerCase().startsWith("access-control"),
      );
      expect(cors).toEqual([]);
    }
    expect(methodeRefusee().status).toBe(405);
  });

  it("un cookie de console sans jeton reste un 401", async () => {
    const db = fausseBase();
    semerAppareil(db);
    const req = requete("sessions", {
      methode: "POST",
      corps: {},
      entetes: { cookie: "authjs.session-token=une-session-de-console-valide" },
    });
    const res = await traiterCreerSession(req, depsDeTest(db));
    expect(res.status).toBe(401);
  });

  const fichiers = routes();

  it("le balayage trouve les routes — sinon il ne garde rien", () => {
    expect(fichiers.length).toBe(11);
  });

  it.each(fichiers.map((f) => [relative(process.cwd(), f), f]))(
    "%s : ni cookie, ni session, ni CORS",
    (_n, f) => {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      expect(src).not.toMatch(/access-control-allow/i);
      expect(src).not.toMatch(/from "next\/headers"/);
      expect(src).not.toMatch(/\bcookies\s*\(/);
      if (
        !f.includes(`${join("enregistreur", "ouvrir")}`) &&
        !f.includes(`${join("enregistreur", "relier")}`)
      ) {
        expect(src).not.toMatch(/from "@\/auth"/);
        expect(src).not.toMatch(/\bauth\s*\(/);
      }
    },
  );

  it.each(fichiers.map((f) => [relative(process.cwd(), f), f]))(
    "%s : nodejs, force-dynamic, sortie stub.invalid en tête, OPTIONS 405",
    (_n, f) => {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      expect(src).toContain('export const runtime = "nodejs"');
      expect(src).toContain('export const dynamic = "force-dynamic"');
      expect(src).toMatch(/export function OPTIONS\(\): Response \{\s*return methodeRefusee\(\);/);
      const handlers = [
        ...src.matchAll(
          /export async function (GET|POST|PUT)\([\s\S]*?\): Promise<Response> \{\s*([^\n]*)/g,
        ),
      ];
      expect(handlers.length, "aucun handler reconnu : le motif ne voit plus rien").toBeGreaterThan(
        0,
      );
      for (const m of handlers) {
        expect(m[2], `${m[1]} doit sortir sur stub.invalid en première instruction`).toMatch(
          /^if \(estBuildHorsLigne\(\)\) return indisponibleAuBuild\(\);/,
        );
      }
    },
  );

  it("503 au build hors ligne (stub.invalid), avant tout", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const res = await traiterRencontresDuJour(
      requete("rencontres-du-jour", { jeton }),
      depsDeTest(db, {
        env: {
          DATABASE_URL: "postgresql://stub:stub@stub.invalid:5432/stub",
          ENREGISTREMENT_VISIO_PILOTE: "true",
        },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("503 en mode fermé, 401 sans jeton en pilote (critère d'acceptation)", async () => {
    const db = fausseBase();
    semerAppareil(db);
    const ferme = await traiterRencontresDuJour(
      requete("rencontres-du-jour", { jeton: null }),
      depsDeTest(db, { env: {} }),
    );
    expect(ferme.status).toBe(503);
    const pilote = await traiterRencontresDuJour(
      requete("rencontres-du-jour", { jeton: null }),
      depsDeTest(db),
    );
    expect(pilote.status).toBe(401);
    // Le `curl` du critère : ni jeton NI en-tête de contrat → 401, pas 400.
    const curlNu = await traiterRencontresDuJour(
      new Request("https://axion-ia.com/api/enregistreur/rencontres-du-jour"),
      depsDeTest(db),
    );
    expect(curlNu.status).toBe(401);
    // Contre-témoin : avec un jeton, un contrat absent reste un 400.
    const { jeton } = semerAppareil(db);
    const sansContrat = await traiterRencontresDuJour(
      new Request("https://axion-ia.com/api/enregistreur/rencontres-du-jour", {
        headers: { authorization: `Bearer ${jeton}` },
      }),
      depsDeTest(db),
    );
    expect(sansContrat.status).toBe(400);
  });

  it("aucune réponse ne contient le préfixe de la console", async () => {
    process.env["ADMIN_URL_PREFIX"] = "prefixe-secret-de-test";
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const res = await traiterRencontresDuJour(
      requete("rencontres-du-jour", { jeton }),
      depsDeTest(db),
    );
    expect(await res.text()).not.toContain("prefixe-secret-de-test");
  });
});
