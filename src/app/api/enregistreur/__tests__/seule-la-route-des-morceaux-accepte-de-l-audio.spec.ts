/**
 * ⛔ SEULE LA ROUTE DES MORCEAUX ACCEPTE DE L'AUDIO (PR 5, ADR 0054).
 *
 * Toutes les autres routes de l'enregistreur refusent `audio/*` et
 * `application/octet-stream` (415) AVANT de lire le corps ; la route des
 * morceaux refuse tout autre type (415) et tout corps au-delà de 262 144
 * octets (413), annoncé ou réel.
 *
 * Mutation qui rougit : retirer le test `TYPES_DE_SON` de `garderEnregistreur`
 * → les routes JSON acceptent un `audio/webm` (le `it.each` rougit).
 * Contre-témoin : un JSON ordinaire passe la garde sur les mêmes routes.
 * Angle mort : un corps JSON qui ENCODERAIT du son (base64) passerait le type ;
 * il est borné à 64 Ko et refusé par les schémas (aucun champ libre assez grand).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  traiterAccord,
  traiterBattementAppareil,
  traiterBattementSession,
  traiterCreerSession,
  traiterFin,
  traiterFinTranche,
  traiterMorceau,
  traiterRefus,
  traiterRencontresDuJour,
} from "@/server/visio/routes-enregistreur";
import { TAILLE_MAX_MORCEAU_OCTETS } from "@/lib/schemas/enregistreur";
import {
  CLE_DE_TEST,
  depsDeTest,
  entetesMorceau,
  fausseBase,
  requete,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
} from "../../../../../tests/outils/fixtures-enregistreur";

const ID = "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b";

type Appel = (req: Request, deps: ReturnType<typeof depsDeTest>) => Promise<Response>;

const ROUTES_SANS_SON: ReadonlyArray<[string, Appel]> = [
  ["rencontres-du-jour", (r, d) => traiterRencontresDuJour(r, d)],
  ["sessions", (r, d) => traiterCreerSession(r, d)],
  ["accord", (r, d) => traiterAccord(r, ID, d)],
  ["refus", (r, d) => traiterRefus(r, ID, d)],
  ["battement", (r, d) => traiterBattementSession(r, ID, d)],
  ["tranches", (r, d) => traiterFinTranche(r, ID, d)],
  ["fin", (r, d) => traiterFin(r, ID, d)],
  ["appareil/battement", (r, d) => traiterBattementAppareil(r, d)],
];

describe("⛔ seule la route des morceaux accepte de l'audio", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  const CAS_SON: Array<[string, string, Appel]> = [];
  for (const [n, f] of ROUTES_SANS_SON) {
    CAS_SON.push([n, "audio/webm", f], [n, "application/octet-stream", f]);
  }

  it.each(CAS_SON)("%s refuse %s (415)", async (_nom, type, appel) => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const res = await appel(
      requete("x", { methode: "POST", jeton, octets: Buffer.from("son"), type }),
      depsDeTest(db),
    );
    expect(res.status).toBe(415);
  });

  it.each(ROUTES_SANS_SON)(
    "contre-témoin : %s passe la garde avec du JSON",
    async (_nom, appel) => {
      const db = fausseBase();
      const { jeton } = semerAppareil(db);
      const res = await appel(requete("x", { methode: "POST", jeton, corps: {} }), depsDeTest(db));
      expect(res.status).not.toBe(415);
      expect(res.status).not.toBe(401);
    },
  );

  it("la route des morceaux refuse un autre type que octet-stream (415)", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    for (const type of ["audio/webm", "application/json", "text/plain", "multipart/form-data"]) {
      const res = await traiterMorceau(
        requete("x", { methode: "PUT", jeton, octets: Buffer.from("son"), type }),
        ID,
        depsDeTest(db),
      );
      expect(res.status, type).toBe(415);
    }
  });

  it("la route des morceaux refuse plus de 262 144 octets (413)", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const res = await traiterMorceau(
      requete("x", { methode: "PUT", jeton, octets: Buffer.alloc(TAILLE_MAX_MORCEAU_OCTETS + 1) }),
      ID,
      depsDeTest(db),
    );
    expect(res.status).toBe(413);
  });

  it("contre-témoin : un morceau octet-stream, sous la limite, après l'accord, est reçu (200)", async () => {
    const db = fausseBase();
    const { jeton, appareilId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const son = Buffer.from("son fictif");
    const deps = depsDeTest(db);
    const res = await traiterMorceau(
      requete("x", { methode: "PUT", jeton, octets: son, entetes: entetesMorceau(son) }),
      id,
      deps,
    );
    expect(res.status).toBe(200);
    expect(deps.stockage.objets.size).toBe(1);
  });
});
