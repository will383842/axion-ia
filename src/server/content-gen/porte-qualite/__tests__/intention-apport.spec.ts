import { describe, expect, it } from "vitest";
import {
  contientMarqueurApport,
  extraireApports,
  reserverApports,
  retirerMarqueursApport,
} from "../apports";
import { cleIntention, lignesDepuisCarte } from "../intentions-registre";
import { evaluerPorteAvec } from "../porte";
import { CRITERES } from "../registre";
import { construireCarte } from "../../strategie/carte-requetes";
import type { ContenuPorte, ContextePorte, IntentionRegistre } from "../types";
import { contenuValide, contexteValide, corpsValide } from "./fixtures";

const idsTous = CRITERES.map((k) => k.id);
const r = (id: string, c: Partial<ContenuPorte> = {}, x: Partial<ContextePorte> = {}) =>
  evaluerPorteAvec(contenuValide(c), contexteValide(x), { idsAttendus: idsTous }).criteres.find(
    (k) => k.id === id,
  )!;

const intention = (o: Partial<IntentionRegistre> = {}): ContextePorte["intention"] => ({
  etat: "ok",
  valeur: {
    requeteNormalisee: "financer ia pme",
    etat: "libre",
    pageProprietaire: null,
    reserveePourCeContenu: false,
    ...o,
  },
});

describe("B05 intention déclarée et libre", () => {
  it("registre B05 : classe dérogeable", () => {
    expect(CRITERES.find((k) => k.id === "B05")!.derogation).toBe(true);
  });
  it("libre : ok", () => expect(r("B05", {}, { intention: intention() }).statut).toBe("ok"));
  it("non évalué : source absente ou indisponible, état inconnu", () => {
    expect(r("B05", {}, { intention: undefined }).statut).toBe("non_evalue");
    expect(
      r("B05", {}, { intention: { etat: "indisponible", raison: "table absente" } }).statut,
    ).toBe("non_evalue");
    expect(r("B05", {}, { intention: intention({ etat: "n_importe_quoi" }) }).statut).toBe(
      "non_evalue",
    );
  });
  it("absente du registre : refus", () => {
    expect(r("B05", {}, { intention: { etat: "ok", valeur: null } }).statut).toBe("echec");
  });
  it("couverte ou à fusionner : refus, avec la page propriétaire", () => {
    for (const etat of ["couverte", "a_fusionner"]) {
      const x = r(
        "B05",
        {},
        { intention: intention({ etat, pageProprietaire: "/fr/blog/financer" }) },
      );
      expect(x.statut).toBe("echec");
      expect(x.preuves.join(" ")).toContain("/fr/blog/financer");
    }
  });
  it("réservée : ok seulement pour le contenu qui la détient", () => {
    expect(r("B05", {}, { intention: intention({ etat: "reservee" }) }).statut).toBe("echec");
    expect(
      r("B05", {}, { intention: intention({ etat: "reservee", reserveePourCeContenu: true }) })
        .statut,
    ).toBe("ok");
  });
});

describe("registre depuis la carte des requêtes (pur)", () => {
  it("une requête servie par une URL devient une intention couverte", () => {
    const carte = construireCarte([
      {
        requete: "Financer l'IA en PME",
        url: "https://axion-ia.com/fr/blog/financer",
        source: "plan",
      },
    ]);
    const lignes = lignesDepuisCarte(carte);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.etat).toBe("couverte");
    expect(lignes[0]!.requeteNormalisee).toBe(cleIntention("financer ia pme"));
  });
  it("carte vide : rien", () => expect(lignesDepuisCarte(construireCarte([]))).toEqual([]));
});

describe("B07 apport original", () => {
  it("le corps de référence (A + C vérifiés) passe", () => expect(r("B07").statut).toBe("ok"));
  it("aucun marqueur : refus", () => {
    const corps = retirerMarqueursApport(corpsValide());
    expect(r("B07", { corpsHtml: corps }).statut).toBe("echec");
  });
  it("un seul type : refus (A seul ne suffit pas)", () => {
    const corps = corpsValide().replace(/<!--apport:C-->[\s\S]*?<!--\/apport-->/, "");
    const x = r("B07", { corpsHtml: corps });
    expect(x.statut).toBe("echec");
    expect(x.raison).toContain("1 apport");
  });
  it("deux marqueurs du MÊME type ne comptent qu'une fois", () => {
    const m =
      "<!--apport:A--><p>Exemple type : une PME de 40 salariés gagne 6 heures.</p><!--/apport-->";
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + m + m }).statut).toBe("echec");
  });
  it("un exemple sans effectif ou sans résultat/étiquette ne compte pas", () => {
    const a = "<!--apport:A--><p>Une entreprise a gagné du temps.</p><!--/apport-->";
    const c = "<!--apport:C--><p>L'AI Act concerne l'employeur.</p><!--/apport-->";
    const x = r("B07", { corpsHtml: "<h1>T</h1>" + a + c });
    expect(x.statut).toBe("echec");
    expect(x.preuves.join(" ")).toContain("A : exemple sans effectif");
  });
  it("A + B : chiffre avec lien et date, ok ; sans lien, refus", () => {
    const a = "<!--apport:A--><p>Exemple type : une PME de 40 salariés.</p><!--/apport-->";
    const bBon =
      "<!--apport:B--><p>Selon l'<a href=\"https://www.insee.fr/x\">Insee</a> (2025), 18 % des PME utilisent l'IA.</p><!--/apport-->";
    const bSansLien = "<!--apport:B--><p>Selon l'Insee (2025), 18 % des PME.</p><!--/apport-->";
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + bBon }).statut).toBe("ok");
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + bSansLien }).statut).toBe("echec");
  });
  it("D indisponible sans donnée réelle : ne compte jamais", () => {
    const a = "<!--apport:A--><p>Exemple type : une PME de 40 salariés.</p><!--/apport-->";
    const d = "<!--apport:D--><p>Nos diagnostics montrent 70 % de gain.</p><!--/apport-->";
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + d }).statut).toBe("echec");
    expect(
      r("B07", { corpsHtml: "<h1>T</h1>" + a + d }, { donneeProprePresente: true }).statut,
    ).toBe("ok");
  });
  it("un contenu sans apport est dérogeable : a_corriger, pas publiable", () => {
    const v = evaluerPorteAvec(
      contenuValide({ corpsHtml: retirerMarqueursApport(corpsValide()) }),
      contexteValide(),
      { idsAttendus: idsTous },
    );
    expect(v.motifs.map((m) => m.id)).toContain("B07");
    expect(v.verdict).toBe("a_corriger");
  });
});

describe("marqueurs : retrait au rendu et réservation par le brief", () => {
  it("retirerMarqueursApport garde le contenu, retire les balises, même orphelines", () => {
    const h = "<p>a</p><!--apport:A--><p>b</p><!--/apport--><!-- apport:B -->";
    const sortie = retirerMarqueursApport(h);
    expect(sortie).toBe("<p>a</p><p>b</p>");
    expect(contientMarqueurApport(sortie)).toBe(false);
    expect(contientMarqueurApport(h)).toBe(true);
  });
  it("extraireApports lit type et contenu", () => {
    const l = extraireApports("<!--apport:C--><p>x</p><!--/apport-->");
    expect(l).toEqual([{ type: "C", html: "<p>x</p>" }]);
  });
  it("réservation : sans B ni C, non générable ; D seulement avec donnée réelle", () => {
    expect(
      reserverApports({ chiffresSources: 0, anglesFrance: 0, donneePropre: true }).generable,
    ).toBe(false);
    const p = reserverApports({ chiffresSources: 2, anglesFrance: 0, donneePropre: false });
    expect(p.generable).toBe(true);
    expect(p.apportsReserves).toEqual(["A", "B"]);
  });
});
