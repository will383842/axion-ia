import { describe, expect, it } from "vitest";

import { calculerApercu } from "@/server/qualiopi/devis/assistant/apercu";

import { etatT1, etatT2, etatT3, etatT4 } from "./fixtures";
import { etatVersPayload } from "./vers-payload";
import { libelleDate, versApercuPrepare, type Numerotation } from "./vers-vue-apercu";
import type { EtatAssistant } from "./types";

const TVA = 20;
const NUM: Numerotation = {
  devisId: "d-1",
  numero: "AXI-DEV-2026-0001",
  devisMajLe: "2026-11-08T10:00:00.000Z",
  revision: 4,
};
const CTX = {
  clientNom: "Client Test",
  validite: "2026-12-08",
  objectif: "",
  versionCgv: "version lue en configuration",
};

function vue(etat: EtatAssistant, ctx = CTX) {
  const apercu = calculerApercu(etatVersPayload(etat, 4, { tvaStandardPct: TVA, textes: [] }), {
    regime: "assujetti",
    tauxStandard: TVA,
    formulesActives: true,
    typeClient: "entreprise",
    maintenant: new Date("2026-11-08T10:00:00Z"),
  });
  const r = versApercuPrepare(apercu, NUM, ctx);
  if (!r.ok) throw new Error(r.erreur);
  return { apercu, prepare: r.prepare };
}

describe("versApercuPrepare : les centimes du serveur sont recopiés, rien n'est calculé", () => {
  it("T1 (A seule) : 448 393 HT · 89 679 TVA · 538 072 TTC, versements HT 134 517 / 134 517 / 179 359", () => {
    const { prepare } = vue(etatT1());
    const v = prepare.vue;
    expect([v.totalHtCents, v.tvaCents, v.totalTtcCents]).toEqual([448393, 89679, 538072]);
    expect(v.lignes.map((l) => l.totalHtCents)).toEqual([240000, 180000, 28393]);
    expect(v.phases.map((p) => p.montantCents)).toEqual([134517, 134517, 179359]);
    expect(v.phases.every((p) => p.libelle.endsWith("(HT)"))).toBe(true);
    expect(v.formules).toHaveLength(1);
    expect(v.formules[0]!.cle).toBe("A");
    expect(v.formules[0]!.titre).not.toMatch(/^Formule/);
  });

  it("T4 (prix unique) : 31 402 HT · 6 280 TVA · 37 682 TTC, ni phase ni formule", () => {
    const v = vue(etatT4()).prepare.vue;
    expect([v.totalHtCents, v.tvaCents, v.totalTtcCents]).toEqual([31402, 6280, 37682]);
    expect(v.phases).toEqual([]);
    expect(v.formules).toEqual([]);
  });

  it("T2 (B seule) : mise en service 190 000 HT, abonnement au tarif catalogue", () => {
    const v = vue(etatT2()).prepare.vue;
    expect([v.totalHtCents, v.tvaCents, v.totalTtcCents]).toEqual([190000, 38000, 228000]);
    expect(v.formules[0]!.cle).toBe("B");
    expect(v.formules[0]!.lignes.map((l) => l.montantHtCents)).toContain(19999);
  });

  it("T3 (A + B) : aucun total global (il dépend du choix), chaque formule porte le sien", () => {
    const { apercu, prepare } = vue(etatT3());
    const v = prepare.vue;
    expect(v.formules.map((f) => f.cle)).toEqual(["A", "B"]);
    expect([v.totalHtCents, v.tvaCents, v.totalTtcCents, v.lignes.length, v.phases.length]).toEqual(
      [0, 0, 0, 0, 0],
    );
    // Le libellé ne prétend pas à une somme : `totalHtCents` ne compte que la mise en place.
    const miseEnPlace = v.formules.map(
      (f) => f.lignes.find((l) => l.libelle === "Mise en place hors taxes")!.montantHtCents,
    );
    expect(miseEnPlace).toEqual([448393, 190000]);
    expect(v.formules.some((f) => f.lignes.some((l) => l.libelle === "Total hors taxes"))).toBe(
      false,
    );
    // TVA et TTC de chaque formule recopiés du serveur, sans recalcul.
    const serveur = apercu.formules!.formules;
    expect(v.formules.map((f) => [f.totalTvaCents, f.totalTtcCents])).toEqual(
      serveur.map((f) => [f.totalTvaCents, f.totalTtcCents]),
    );
    expect(v.formules.map((f) => f.totalTtcCents)).toEqual([538072, 228000]);
    expect(v.plafondAConfirmer).toEqual(serveur ? apercu.formules!.plafondAConfirmer : null);
  });

  it("T3 : les périodes remisées de l'abonnement montrent le mensuel net du serveur", () => {
    const { apercu, prepare } = vue(etatT3());
    const periodes = apercu.formules!.formules.flatMap((f) => f.abonnement?.periodes ?? []);
    for (const p of periodes.filter((x) => x.remisePercent > 0)) {
      const l = prepare.vue.formules
        .flatMap((f) => f.lignes)
        .find((x) => x.libelle.includes(`remisé de ${p.remisePercent} %`));
      expect(l?.montantHtCents).toBe(p.mensuelNetHtCents);
    }
  });

  it("mois offerts de la maintenance : dits au client", () => {
    const e = etatT1();
    e.achat.maintenance.moisOfferts = "3";
    const lignes = vue(e).prepare.vue.formules[0]!.lignes;
    expect(lignes.find((l) => l.libelle.startsWith("Maintenance"))!.libelle).toContain(
      "3 mois offerts",
    );
  });

  it("identifiants, numéro, révision de l'envoi et adresse du PDF viennent de la numérotation", () => {
    const p = vue(etatT1()).prepare;
    expect([p.devisId, p.numero, p.majLe, p.apercuPdfUrl]).toEqual([
      "d-1",
      "AXI-DEV-2026-0001",
      "2026-11-08T10:00:00.000Z",
      "/api/qualiopi/devis/d-1/apercu",
    ]);
  });

  it("CGV, nom du client, objectif et validité : lus du contexte, jamais écrits en dur", () => {
    const v = vue(etatT1(), { ...CTX, objectif: "Répondre plus vite" }).prepare.vue;
    expect(v.versionCgv).toBe("version lue en configuration");
    expect(v.clientNom).toBe("Client Test");
    expect(v.objectif).toBe("Répondre plus vite");
    expect(v.validiteLibelle).toBe("8 décembre 2026");
    expect(vue(etatT1()).prepare.vue.objectif).toBeNull();
  });

  it("une erreur du serveur n'affiche AUCUN chiffre", () => {
    const apercu = calculerApercu(
      etatVersPayload(etatT1(), 4, { tvaStandardPct: TVA, textes: [] }),
      { regime: "assujetti", tauxStandard: TVA, formulesActives: false, typeClient: "entreprise" },
    );
    expect(apercu.erreurs.length).toBeGreaterThan(0);
    const r = versApercuPrepare(apercu, NUM, CTX);
    expect(r.ok).toBe(false);
  });

  it("libelleDate : illisible = texte tel quel", () => {
    expect(libelleDate("2026-01-01")).toBe("1 janvier 2026");
    expect(libelleDate("demain")).toBe("demain");
  });
});
