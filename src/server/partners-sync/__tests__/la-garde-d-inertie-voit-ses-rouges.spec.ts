// @vitest-environment node
/**
 * Les contre-témoins de `scripts/gates/inertie.ts` (INT-T02, REQ-INT-008).
 *
 * Une garde dont on n'a jamais vu le rouge ne garde rien : chaque règle est jouée ici sur une
 * source fautive, et doit la refuser. Puis la garde est jouée sur le dépôt réel, où elle doit être
 * verte ET avoir mesuré quelque chose.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { verifierInertie } from "../../../../scripts/gates/inertie";

const RACINE = path.resolve(__dirname, "../../../..");

function lire(rel: string): string {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}

/** Le dépôt réel, limité aux fichiers que la garde regarde. */
function depot(): Map<string, string> {
  const m = new Map<string, string>();
  for (const rel of [
    "src/server/partners-sync/config.ts",
    "src/server/partners-sync/outbox.ts",
    "src/server/partners-sync/relais.ts",
    "src/server/partners-sync/relecture.ts",
    "src/server/queue/workers/partners-sync-worker.ts",
    "src/server/queue/worker.ts",
    "src/app/api/partners/evenements/route.ts",
  ]) {
    m.set(rel, lire(rel));
  }
  return m;
}

function regles(sources: Map<string, string>): string[] {
  return verifierInertie(sources).violations.map((v) => v.regle);
}

describe("scripts/gates/inertie.ts", () => {
  it("est VERTE sur le dépôt, et a mesuré chaque population", () => {
    const bilan = verifierInertie(depot());
    expect(bilan.violations).toEqual([]);
    expect(bilan.fichiersZone).toBe(6);
    expect(bilan.pointsDEntree).toBeGreaterThanOrEqual(8);
    expect(bilan.appelsWorker).toBe(2);
    expect(bilan.routes).toBe(1);
  });

  it("R1 — refuse un effet au chargement du module", () => {
    const s = depot();
    s.set(
      "src/server/partners-sync/relais.ts",
      `${s.get("src/server/partners-sync/relais.ts")}\nvoid relayer();\n`,
    );
    expect(regles(s)).toContain("R1");

    const t = depot();
    t.set(
      "src/server/partners-sync/nouveau.ts",
      'import { prisma } from "@/lib/prisma";\nexport const n = prisma.partnersSyncOutbox.count();\n',
    );
    expect(regles(t)).toContain("R1");
  });

  it("R2 — refuse un point d'entrée qui ne commence pas par le verrou", () => {
    const s = depot();
    const outbox = s.get("src/server/partners-sync/outbox.ts") ?? "";
    const retire = outbox.replace("  if (!canalPartnersOuvert()) return null;\n", "");
    expect(retire).not.toBe(outbox);
    s.set("src/server/partners-sync/outbox.ts", retire);
    expect(regles(s)).toEqual(["R2"]);

    const t = depot();
    t.set(
      "src/server/partners-sync/nouveau.ts",
      "export async function fuir(): Promise<void> {\n  await fetch('https://x');\n}\n",
    );
    expect(regles(t)).toEqual(["R2"]);
  });

  it("R3 — refuse un démarrage du worker hors de la condition du verrou", () => {
    const s = depot();
    const w = s.get("src/server/queue/worker.ts") ?? "";
    const nu = w.replace(
      "...(canalPartnersOuvert() ? [startPartnersSyncWorker()] : []),",
      "startPartnersSyncWorker(),",
    );
    expect(nu).not.toBe(w);
    s.set("src/server/queue/worker.ts", nu);
    expect(regles(s)).toEqual(["R3"]);

    const t = depot();
    const contourne = w.replace(
      "if (canalPartnersOuvert()) await programmerRelaisPartners();",
      "if (canalPartnersOuvert() || true) await programmerRelaisPartners();",
    );
    expect(contourne).not.toBe(w);
    t.set("src/server/queue/worker.ts", contourne);
    expect(regles(t)).toEqual(["R3"]);
  });

  it("R4 — refuse une page qui importe le canal, et une route sans force-dynamic", () => {
    const s = depot();
    s.set(
      "src/app/[locale]/page.tsx",
      'import { relayer } from "@/server/partners-sync/relais";\nexport default function P() { return null; }\n',
    );
    expect(regles(s)).toContain("R4");

    const t = depot();
    const route = t.get("src/app/api/partners/evenements/route.ts") ?? "";
    t.set(
      "src/app/api/partners/evenements/route.ts",
      route.replace('export const dynamic = "force-dynamic";\n', ""),
    );
    expect(regles(t)).toEqual(["R4"]);
  });

  it("R5 — refuse un verrou qui ne regarde plus le build, ou plus le drapeau", () => {
    for (const moitie of ["estPartnersSyncActif() && ", " && !estAuBuild()"]) {
      const s = depot();
      const c = s.get("src/server/partners-sync/config.ts") ?? "";
      const ampute = c.replace(moitie, "");
      expect(ampute).not.toBe(c);
      s.set("src/server/partners-sync/config.ts", ampute);
      expect(regles(s)).toEqual(["R5"]);
    }
  });
});
