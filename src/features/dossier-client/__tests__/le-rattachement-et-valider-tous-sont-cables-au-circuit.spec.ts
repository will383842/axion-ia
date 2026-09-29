// @vitest-environment node
/**
 * ⛔ LE RATTACHEMENT TARDIF ET « VALIDER TOUS » SONT CÂBLÉS AU CIRCUIT (PR 6).
 *
 * La PR 4 avait posé deux points d'accroche, INERTES en attendant le circuit :
 *   · `relancerApresRattachement` (rattacher.ts) rendait `false` sans rien
 *     enfiler : un rendez-vous rangé après coup ne voyait jamais son compte
 *     rendu complété ;
 *   · « Valider et préparer le devis » validait les faits cochés même quand
 *     plusieurs voix côté client n'étaient pas attribuées (fiche PR 6).
 * Et la PR 6 avait sa propre `relancerApresRattachement`, homonyme : il n'en
 * reste qu'une, dans rattacher.ts, qui appelle `completerApresRattachement`.
 *
 * Mutations qui rougissent : rendre `false` dans `relancerApresRattachement` ;
 * retirer `exigerVoixAttribuees` de `validerApresLAppel` ; retirer l'appel du
 * point d'enfilage d'une des deux actions qui rangent un rendez-vous.
 * Contre-témoins : sans compte rendu, rien n'est enfilé ; une seule voix
 * n'exige rien. Angle mort : l'action serveur elle-même (session, redirection)
 * n'est pas exécutée ici — sa source est lue.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { etatInitial } from "@/server/visio/etat-compte-rendu";
import * as gestes from "@/server/visio/gestes-compte-rendu";
import { relancerApresRattachement } from "../rattacher";
import { validerApresLAppel } from "../valider";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { CLE_DE_TEST } from "../../../../tests/outils/fixtures-enregistreur";

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
});

const RENCONTRE = "00000000-0000-4000-8000-000000000001";

function avecCompteRendu(present: boolean) {
  return baseEspion({
    "compteRendu.findFirst": () =>
      present
        ? {
            id: "cr1",
            statut: "a_valider",
            version: 1,
            verification: chiffrerParole(
              JSON.stringify(etatInitial(new Date("2026-10-06T10:00:00Z"), "x")),
            ),
          }
        : null,
    "compteRendu.create": () => ({ id: "cr2" }),
  });
}

function avecVoix(voix: string[]) {
  return baseEspion({
    "rencontre.findUnique": () => ({
      id: RENCONTRE,
      clientId: "c1",
      projetId: null,
      rattachementStatut: "valide",
      debutPrevu: null,
      debutReel: null,
    }),
    "transcriptionSegment.findMany": () => voix.map((v) => ({ locuteurBrut: v })),
    "rencontreParticipant.findMany": () => [],
  });
}

function valider(base: ReturnType<typeof baseEspion>) {
  return validerApresLAppel(base.base, {
    rencontreId: RENCONTRE,
    parAdminId: "admin",
    projet: { mode: "aucun" },
    faitsCoches: ["f1"],
    note: null,
    suivi: { issue: "a_rappeler" as never, suite: null, suiteLe: null },
  });
}

describe("le rattachement tardif et « Valider tous » sont câblés au circuit", () => {
  it("le point d'enfilage programme `rattacher` sur une nouvelle version", async () => {
    const e = avecCompteRendu(true);
    expect(await relancerApresRattachement(e.base, RENCONTRE)).toBe(true);
    const planifs = e.sqls.filter((s) => s.sql.includes('INSERT INTO "traitements_visio"'));
    expect(planifs.map((s) => s.valeurs[1])).toEqual(["rattacher"]);
  });

  it("contre-témoin : sans compte rendu, rien n'est enfilé", async () => {
    const e = avecCompteRendu(false);
    expect(await relancerApresRattachement(e.base, RENCONTRE)).toBe(false);
    expect(e.sqls).toEqual([]);
  });

  it("une seule implémentation : plus d'homonyme dans les gestes du compte rendu", () => {
    expect(Object.keys(gestes)).not.toContain("relancerApresRattachement");
    expect(Object.keys(gestes)).toContain("completerApresRattachement");
  });

  it("les deux actions qui rangent un rendez-vous appellent le point d'enfilage", () => {
    const src = readFileSync(path.resolve(__dirname, "../actions-rencontres.ts"), "utf8");
    for (const action of ["rangerRencontreAction", "creerProspectAction"]) {
      const debut = src.indexOf(`export async function ${action}`);
      const fin = src.indexOf("\nexport ", debut + 1);
      expect(src.slice(debut, fin === -1 ? undefined : fin), action).toMatch(
        /relancerApresRattachement\(prisma, rencontreId\)/,
      );
    }
  });

  it("« Valider tous » est refusé tant que deux voix client ne sont pas attribuées", async () => {
    await expect(valider(avecVoix(["A", "B"]))).rejects.toThrow(/qui est qui/);
  });

  it("contre-témoin : une seule voix n'exige rien", async () => {
    await expect(valider(avecVoix(["A"]))).rejects.not.toThrow(/qui est qui/);
  });
});
