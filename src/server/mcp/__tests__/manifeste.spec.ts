import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

import { ID_ADAPTATEUR, MODE_ADAPTATEUR, SCEAU_PROFILS, nomComplet } from "../contrat";
import { canoniser, octetsCanoniques, type ValeurJson } from "../json-canonique";
import {
  construireManifeste,
  empreinteDuManifeste,
  texteDuManifeste,
  type Manifeste,
} from "../manifeste";
import { OUTILS } from "../registre";

/**
 * **LE MANIFESTE VERSIONNÉ EST CELUI DU CODE — SINON LE SOCLE REFUSE L'ADAPTATEUR.**
 *
 * Le socle épingle `manifestSha` dans son `adapters.lock.json`. Si un outil
 * change (une description, un plafond, un champ) sans que `manifeste.json` soit
 * régénéré, deux documents circulent sous le même nom : celui que le socle a
 * épinglé et celui que la route sert. Le refus tombe à l'enregistrement, en
 * production, sous « empreinte divergente ». Ici, il tombe en CI, avec la
 * commande à relancer.
 */

interface Instantane {
  readonly manifestSha: string;
  readonly octetsCanoniques: number;
  readonly manifeste: Manifeste;
}

const CHEMIN = resolve(__dirname, "../manifeste.json");
const instantane = JSON.parse(readFileSync(CHEMIN, "utf8")) as Instantane;

describe("manifeste.json — l'instantané épinglé", () => {
  it("porte exactement l'empreinte du manifeste construit depuis le code", () => {
    const courant = construireManifeste();
    const empreinte = empreinteDuManifeste(courant);
    console.info(`[manifeste] code ${empreinte} · fichier ${instantane.manifestSha}`);
    expect(
      instantane.manifestSha,
      "manifeste.json est en retard sur le code : lancer `pnpm mcp:manifeste` et commiter",
    ).toBe(empreinte);
    // Le SHA couvre le TEXTE CANONIQUE : le fichier indenté doit y ramener.
    expect(canoniser(instantane.manifeste as unknown as ValeurJson)).toBe(
      texteDuManifeste(courant),
    );
    expect(instantane.octetsCanoniques).toBe(Buffer.byteLength(texteDuManifeste(courant), "utf8"));
  });

  it("décrit un adaptateur fédéré, sans secret, sur des profils du socle, au bon sceau", () => {
    const m = instantane.manifeste;
    expect(m.manifestVersion).toBe(1);
    expect(m.id).toBe(ID_ADAPTATEUR);
    expect(m.mode).toBe(MODE_ADAPTATEUR);
    expect(m.secrets).toEqual([]);
    expect(m.profiles).toEqual(["admin"]);
    expect(m.profilesVersion).toBe(SCEAU_PROFILS.version);
    expect(m.profilesSha).toBe(SCEAU_PROFILS.empreinte);
  });

  it("publie les six outils du registre, chacun avec ses `bytes` recalculables", () => {
    const attendus = OUTILS.map((o) => o.name).sort();
    const publies = instantane.manifeste.tools.map((t) => t.name).sort();
    expect(publies).toEqual(attendus);
    let recalcules = 0;
    for (const outil of instantane.manifeste.tools) {
      const { bytes, ...sansBytes } = outil;
      expect(octetsCanoniques(sansBytes as unknown as ValeurJson), nomComplet(outil.name)).toBe(
        bytes,
      );
      recalcules += 1;
    }
    console.info(`[manifeste] ${String(recalcules)} entrée(s) d'outil, bytes recalculés`);
    expect(recalcules).toBe(OUTILS.length);
  });

  it("chaque schéma d'entrée publié est fermé (`additionalProperties: false`)", () => {
    for (const outil of instantane.manifeste.tools) {
      const schema = outil.inputSchema as { additionalProperties?: unknown };
      expect(schema.additionalProperties, nomComplet(outil.name)).toBe(false);
    }
  });
});
