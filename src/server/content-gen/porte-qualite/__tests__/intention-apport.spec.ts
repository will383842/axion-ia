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
  it("couverte mais contenu = mise à jour de la page propriétaire : ok", () => {
    const x = r(
      "B05",
      {},
      {
        intention: intention({ etat: "couverte", pageProprietaire: "/fr/blog/financer" }),
        miseAJourDeLaPageProprietaire: true,
      },
    );
    expect(x.statut).toBe("ok");
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
    expect(x.raison).toContain("A et D ne suffisent pas");
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
    // D est un apport SUPPLÉMENTAIRE : A + D ne suffit pas, même avec une donnée réelle (§ 8).
    expect(
      r("B07", { corpsHtml: "<h1>T</h1>" + a + d }, { donneeProprePresente: true }).statut,
    ).toBe("echec");
    const c = "<!--apport:C--><p>L'AI Act concerne les PME françaises.</p><!--/apport-->";
    expect(
      r("B07", { corpsHtml: "<h1>T</h1>" + a + c + d }, { donneeProprePresente: true }).statut,
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

describe("B07 : durcissements de la relecture", () => {
  const a =
    "<!--apport:A--><p>Exemple type : une PME de 1 salarié gagne 6 heures.</p><!--/apport-->";
  it("B : une année seule n'est pas un chiffre ; un lien interne n'est pas une source", () => {
    const sansChiffre =
      '<!--apport:B--><p>Selon l\'<a href="https://www.insee.fr/x">Insee</a> (2025), la majorité.</p><!--/apport-->';
    const interne =
      '<!--apport:B--><p>Selon <a href="https://axion-ia.com/fr/blog/x">nous</a> (2025), 18 % des PME.</p><!--/apport-->';
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + sansChiffre }).statut).toBe("echec");
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + interne }).statut).toBe("echec");
  });
  it("A : « 1 salarié » (singulier accentué) est reconnu ; C : « employeur » seul ne suffit pas", () => {
    const c = "<!--apport:C--><p>L'employeur choisit un outil.</p><!--/apport-->";
    const x = r("B07", { corpsHtml: "<h1>T</h1>" + a + c });
    expect(x.statut).toBe("echec");
    expect(x.preuves.join(" ")).toContain("A : vérifié");
  });
  it("B : date seule, lien caché en commentaire et sous-domaine du site ne sont pas des preuves", () => {
    const date =
      '<!--apport:B--><p>Publié le 12 mars 2024 par l\'<a href="https://www.insee.fr/x">Insee</a>.</p><!--/apport-->';
    const cache =
      '<!--apport:B--><p>18 % des PME (2025).<!-- <a href="https://www.insee.fr/x">x</a> --></p><!--/apport-->';
    const sousDomaine =
      '<!--apport:B--><p>18 % des PME (2025), <a href="https://blog.axion-ia.com/x">notre blog</a>.</p><!--/apport-->';
    for (const b of [date, cache, sousDomaine]) {
      expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + b }).statut).toBe("echec");
    }
  });
  it("B : dates en chiffres, nombre caché en commentaire, hôte avec point final ne comptent pas", () => {
    const lien = '<a href="https://www.insee.fr/x">INSEE</a>';
    const cas = [
      `<!--apport:B--><p>Le 12/03/2024, ${lien}.</p><!--/apport-->`,
      `<!--apport:B--><p>Le 2024-03-12, ${lien}.</p><!--/apport-->`,
      `<!--apport:B--><p>Le 1er mars 2024, ${lien}.</p><!--/apport-->`,
      `<!--apport:B--><p><!-- a > 42 --> en 2024, ${lien}.</p><!--/apport-->`,
      '<!--apport:B--><p>18 % des PME (2025), <a href="https://axion-ia.com./x">nous</a>.</p><!--/apport-->',
    ];
    for (const b of cas)
      expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + b }).statut, b).toBe("echec");
  });
  it("C : fin de mot exigée", () => {
    const c = "<!--apport:C--><p>La fiscalitéx des PME.</p><!--/apport-->";
    expect(r("B07", { corpsHtml: "<h1>T</h1>" + a + c }).statut).toBe("echec");
  });
  it("une clé d'intention trop longue n'est jamais tronquée", () => {
    expect(
      cleIntention(
        "mot "
          .repeat(200)
          .trim()
          .replace(/mot/g, (_m, i: number) => `m${i}x`),
      ),
    ).toBe("");
  });
  it("retrait : fermeture --!> et nom voisin non touché", () => {
    expect(contientMarqueurApport(retirerMarqueursApport("<!--apport:A--!>x"))).toBe(false);
    expect(retirerMarqueursApport("<!--apports-->")).toBe("<!--apports-->");
  });
  it("un marqueur non fermé invalide son bloc (pas de contenu de C compté pour A)", () => {
    const h = "<!--apport:A--><p>x</p><!--apport:C--><p>c</p><!--/apport-->";
    expect(extraireApports(h)).toEqual([]);
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
  it("retrait : casse, espaces, type inconnu et fermant espacé", () => {
    for (const m of [
      "<!--apport:a-->",
      "<!--APPORT:A-->",
      "<!-- apport : A -->",
      "<!--apport:E-->",
      "<!--/ apport-->",
    ]) {
      expect(contientMarqueurApport(retirerMarqueursApport(`<p>x</p>${m}`)), m).toBe(false);
    }
  });
  it("extraireApports lit type et contenu", () => {
    const l = extraireApports("<!--apport:C--><p>x</p><!--/apport-->");
    expect(l).toEqual([{ type: "C", html: "<p>x</p>" }]);
  });
  it("réservation : sans B ni C, non générable ; D seulement avec donnée réelle", () => {
    expect(
      reserverApports({ chiffresSources: 0, anglesFrance: 0, donneePropre: true }).generable,
    ).toBe(false);
    expect(
      reserverApports({
        chiffresSources: Number.NaN,
        anglesFrance: Number.NaN,
        donneePropre: false,
      }).generable,
    ).toBe(false);
    expect(
      reserverApports({ chiffresSources: 2, anglesFrance: 0, donneePropre: false }, 3).generable,
    ).toBe(false);
    const p = reserverApports({ chiffresSources: 2, anglesFrance: 0, donneePropre: false });
    expect(p.generable).toBe(true);
    expect(p.apportsReserves).toEqual(["A", "B"]);
  });
});
