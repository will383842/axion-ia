/**
 * X-4 (vague 3) — données factuelles par ville : schéma, interrupteur, bloc, script.
 *
 * Ce que ces tests verrouillent :
 *  1. interrupteur ÉTEINT (absent ou "false") → aucune donnée rendue, la page ne monte pas le
 *     bloc : rendu identique à avant ;
 *  2. interrupteur ALLUMÉ + échantillon → le bloc s'affiche, chaque ligne avec source et date ;
 *  3. aucun fait sans source/URL/date n'est accepté (schéma) ni affiché ;
 *  4. le fichier versionné est valide, marqué ECHANTILLON, sans chiffre Sirene inventé ;
 *  5. l'agrégation Sirene du script compte juste sur un extrait de TEST (jamais affiché).
 */
import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  VilleDonneesFactuelles,
  formaterDateFait,
} from "@/components/ville/VilleDonneesFactuelles";
import {
  donneesFactuellesActivees,
  getVilleDonneesFactuellesAffichables,
  lireFichierDonneesFactuelles,
} from "@/content/villes/donnees-factuelles";
import donneesBrutes from "@/content/villes/donnees-factuelles/donnees.json";
import {
  fichierDonneesFactuellesSchema,
  villeDonneesFactuellesSchema,
  type VilleDonneesFactuelles as Donnees,
} from "@/content/villes/donnees-factuelles/schema";
import {
  AgregateurSirene,
  agregerLignesSirene,
  communeDeRattachement,
  construireVille,
  decouperLigneCsv,
  lireLibellesNaf,
} from "../../../../scripts/villes/lib/donnees-factuelles";
import type { VilleData } from "@/content/villes/data/types";

const RACINE = path.resolve(__dirname, "../../../..");
const PAGE = path.join(RACINE, "src/app/[locale]/implantations/[region]/[ville]/page.tsx");

const ALLUME = { VILLE_DONNEES_FACTUELLES: "true" };

const fait = <T,>(valeur: T, natureDate: "millesime" | "releve" = "millesime") => ({
  valeur,
  source: "INSEE, base Sirene (test)",
  url: "https://www.data.gouv.fr/",
  date: natureDate === "millesime" ? "2026-10" : "2026-11-11",
  natureDate,
});

describe("interrupteur VILLE_DONNEES_FACTUELLES", () => {
  it("éteint par défaut : absent, vide ou 'false' → rien", () => {
    for (const env of [
      {},
      { VILLE_DONNEES_FACTUELLES: "" },
      { VILLE_DONNEES_FACTUELLES: "false" },
    ]) {
      expect(donneesFactuellesActivees(env)).toBe(false);
      expect(getVilleDonneesFactuellesAffichables("paris", env)).toBeNull();
    }
  });

  it("toute autre valeur que 'true' reste éteinte", () => {
    expect(donneesFactuellesActivees({ VILLE_DONNEES_FACTUELLES: "1" })).toBe(false);
    expect(donneesFactuellesActivees({ VILLE_DONNEES_FACTUELLES: "TRUE" })).toBe(false);
  });

  it("allumé : une ville de l'échantillon a des données, une ville absente n'en a pas", () => {
    expect(getVilleDonneesFactuellesAffichables("paris", ALLUME)?.slug).toBe("paris");
    expect(getVilleDonneesFactuellesAffichables("ville-inexistante", ALLUME)).toBeNull();
  });

  it("la page ne monte le bloc QUE si le chargeur rend une donnée (éteint = rendu identique)", () => {
    const src = fs.readFileSync(PAGE, "utf8");
    // Un seul point d'entrée, gardé par l'interrupteur via le chargeur.
    expect(src).toContain("getVilleDonneesFactuellesAffichables(ville.slug)");
    expect(src).toMatch(/\{donneesFactuelles \? \(\s*<VilleDonneesFactuelles[\s\S]*?\) : null\}/);
    expect(src.match(/<VilleDonneesFactuelles\b/g)).toHaveLength(1);
    // Aucune lecture directe de l'interrupteur ni de réseau dans la page.
    expect(src).not.toContain("process.env.VILLE_DONNEES_FACTUELLES");
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it("l'interrupteur est déclaré dans src/env.ts et documenté commenté dans .env.example", () => {
    const env = fs.readFileSync(path.join(RACINE, "src/env.ts"), "utf8");
    expect(env).toMatch(/VILLE_DONNEES_FACTUELLES: z\.enum\(\["true", "false"\]\)\.optional\(\)/);
    expect(env).toContain("VILLE_DONNEES_FACTUELLES: process.env.VILLE_DONNEES_FACTUELLES");
    const exemple = fs.readFileSync(path.join(RACINE, ".env.example"), "utf8");
    expect(exemple).toMatch(/^# VILLE_DONNEES_FACTUELLES=false$/m);
  });
});

describe("fichier versionné donnees.json", () => {
  it("respecte le schéma (aucun fait sans source, URL ni date)", () => {
    const r = fichierDonneesFactuellesSchema.safeParse(donneesBrutes);
    expect(r.success, JSON.stringify(r.error?.issues ?? [])).toBe(true);
    expect(lireFichierDonneesFactuelles()).not.toBeNull();
  });

  it("est l'échantillon de 10 villes, marqué ECHANTILLON, sans Grenoble ni chiffre Sirene", () => {
    const f = fichierDonneesFactuellesSchema.parse(donneesBrutes);
    expect(f.statut).toBe("ECHANTILLON");
    expect(f.note).toMatch(/^ECHANTILLON/);
    expect(f.villes).toHaveLength(10);
    expect(f.villes.map((v) => v.slug)).not.toContain("grenoble");
    for (const v of f.villes) {
      expect(v.etablissementsActifs).toBeUndefined();
      expect(v.secteursDominants).toBeUndefined();
    }
  });

  it("chaque population reprend EXACTEMENT la donnée INSEE versionnée du dépôt", async () => {
    const { getVilleCore } = await import("@/content/villes/core");
    const f = fichierDonneesFactuellesSchema.parse(donneesBrutes);
    for (const v of f.villes) {
      const ref = getVilleCore(v.slug);
      expect(ref, v.slug).toBeDefined();
      expect(v.inseeCode).toBe(ref?.inseeCode);
      expect(v.population?.valeur).toBe(ref?.population);
      expect(v.departement?.valeur).toBe(ref?.departement);
    }
  });
});

describe("schéma : un fait sans source est refusé", () => {
  const base: Donnees = { slug: "exemple", inseeCode: "12345", population: fait(1000, "releve") };
  it.each([
    ["source vide", { ...fait(1000), source: "" }],
    ["URL absente", { ...fait(1000), url: undefined }],
    ["URL non https", { ...fait(1000), url: "http://exemple.fr" }],
    ["date absente", { ...fait(1000), date: undefined }],
    ["date mal formée", { ...fait(1000), date: "octobre 2026" }],
    ["nature de date inconnue", { ...fait(1000), natureDate: "estimation" }],
    ["valeur estimée en texte", { ...fait("environ 1000") }],
  ])("%s", (_, population) => {
    expect(villeDonneesFactuellesSchema.safeParse({ ...base, population }).success).toBe(false);
  });

  it("un champ inconnu (ex. ordre de grandeur) est refusé", () => {
    expect(
      villeDonneesFactuellesSchema.safeParse({ ...base, ordreDeGrandeur: fait(5000) }).success,
    ).toBe(false);
  });
});

describe("bloc VilleDonneesFactuelles (composant serveur)", () => {
  const rendre = (d: Donnees) =>
    renderToStaticMarkup(<VilleDonneesFactuelles donnees={d} villeNameFr="Exemple" isFr />);

  it("n'est pas un composant client", () => {
    const src = fs.readFileSync(
      path.join(RACINE, "src/components/ville/VilleDonneesFactuelles.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/^["']use client["']/m);
    expect(src).not.toMatch(/\buse(State|Effect|Ref|Memo|Callback)\b/);
  });

  it("allumé avec l'échantillon : chaque ligne affichée porte sa source et sa date", () => {
    const d = getVilleDonneesFactuellesAffichables("lyon", ALLUME);
    expect(d).not.toBeNull();
    const html = renderToStaticMarkup(
      <VilleDonneesFactuelles donnees={d as Donnees} villeNameFr="Lyon" isFr />,
    );
    expect(html).toContain('data-testid="ville-donnees-factuelles"');
    expect(html).toContain("Population municipale");
    expect(html).toContain("Auvergne-Rhône-Alpes");
    const lignes = html.match(/<dt/g) ?? [];
    const sources = html.match(/data-source/g) ?? [];
    expect(lignes.length).toBe(3);
    expect(sources.length).toBe(lignes.length);
    expect(html).toContain("relevé le 8 mai 2026");
    // Pas de ligne Sirene : la donnée n'existe pas dans l'échantillon.
    expect(html).not.toContain("Établissements actifs");
  });

  it("un champ absent n'a pas de ligne ; sans aucun fait, rien n'est rendu", () => {
    expect(rendre({ slug: "exemple", inseeCode: "12345" })).toBe("");
    const html = rendre({
      slug: "exemple",
      inseeCode: "12345",
      region: fait("Bretagne", "releve"),
    });
    expect(html.match(/<dt/g)).toHaveLength(1);
    expect(html).not.toContain("Population");
  });

  it("Sirene : millésime affiché comme tel, secteurs sans libellé affichés par leur code", () => {
    const html = rendre({
      slug: "exemple",
      inseeCode: "12345",
      etablissementsActifs: fait(4321),
      secteursDominants: fait([
        { division: "62", etablissements: 120 },
        {
          division: "47",
          libelle: "Commerce de détail, à l'exception des automobiles et des motocycles",
          etablissements: 80,
        },
      ]),
    });
    expect(html).toContain("données de octobre 2026");
    expect(html).toContain("Division NAF 62");
    expect(html).toContain("Commerce de détail");
  });

  it("aucune fausse présence, aucun prix, aucune promesse", () => {
    const d = getVilleDonneesFactuellesAffichables("paris", ALLUME) as Donnees;
    const html = renderToStaticMarkup(
      <VilleDonneesFactuelles donnees={d} villeNameFr="Paris" isFr />,
    );
    expect(html).not.toMatch(/nos consultants|depuis \d{4}|bureau|agence|implantés?|€|garanti/i);
    expect(html).not.toMatch(/\b(EUR|HT)\b/);
    expect(html).not.toMatch(/Grenoble/);
  });

  it("formate les dates sans fuseau horaire", () => {
    expect(formaterDateFait("2026-10")).toBe("octobre 2026");
    expect(formaterDateFait("2026-01-01")).toBe("1 janvier 2026");
  });
});

describe("script : agrégation du Stock Sirene (extrait de TEST, jamais affiché)", () => {
  const EXTRAIT = [
    "siren,nic,codeCommuneEtablissement,etatAdministratifEtablissement,activitePrincipaleEtablissement",
    "000000001,00011,99001,A,62.01Z",
    "000000002,00012,99001,A,62.02A",
    "000000003,00013,99001,A,47.11B",
    "000000004,00014,99001,F,62.01Z",
    "000000005,00015,99002,A,10.71C",
    '000000006,00016,75108,A,"70.22Z"',
    "000000007,00017,75120,A,",
    "000000008,00018,99001,A,code-illisible",
  ];

  it("ne compte que les établissements actifs des communes cibles, arrondissements rattachés", () => {
    const ag = new AgregateurSirene(new Set(["99001", "75056"]));
    agregerLignesSirene(EXTRAIT, ag);
    const r = ag.resultat();
    expect(r.get("99001")?.total).toBe(4); // le fermé (F) est exclu, l'illisible compte au total
    expect(r.get("99001")?.parDivision.get("62")).toBe(2);
    expect(r.get("99001")?.parDivision.get("47")).toBe(1);
    expect(r.has("99002")).toBe(false); // commune non ciblée
    expect(r.get("75056")?.total).toBe(2);
    expect(r.get("75056")?.parDivision.get("70")).toBe(1);
  });

  it("construireVille : sources Sirene datées au millésime, secteurs triés", () => {
    const ag = new AgregateurSirene(new Set(["99001"]));
    agregerLignesSirene(EXTRAIT, ag);
    const ville: VilleData = {
      slug: "exemple",
      nameFr: "Exemple",
      region: "bretagne",
      departement: "99",
      inseeCode: "99001",
      population: 12000,
      geo: { lat: 0, lon: 0 },
    };
    const d = construireVille({
      ville,
      regionNom: "Bretagne",
      releve: "2026-11-11",
      sirene: {
        agregat: ag.resultat().get("99001"),
        millesime: "2026-10",
        libelles: lireLibellesNaf(["62;Programmation, conseil et autres activités informatiques"]),
      },
    });
    expect(villeDonneesFactuellesSchema.safeParse(d).success).toBe(true);
    expect(d.etablissementsActifs).toMatchObject({
      valeur: 4,
      date: "2026-10",
      natureDate: "millesime",
    });
    expect(d.secteursDominants?.valeur[0]).toEqual({
      division: "62",
      libelle: "Programmation, conseil et autres activités informatiques",
      etablissements: 2,
    });
    expect(d.population).toMatchObject({ valeur: 12000, natureDate: "releve" });
  });

  it("sans Sirene, aucun champ Sirene n'est produit (jamais d'estimation)", () => {
    const d = construireVille({
      ville: {
        slug: "x",
        nameFr: "X",
        region: "r",
        departement: "01",
        inseeCode: "01001",
        population: 5000,
        geo: { lat: 0, lon: 0 },
      },
      regionNom: undefined,
      releve: "2026-11-11",
    });
    expect(d.etablissementsActifs).toBeUndefined();
    expect(d.secteursDominants).toBeUndefined();
    expect(d.region).toBeUndefined();
  });

  it("outils CSV et rattachement", () => {
    expect(decouperLigneCsv('a,"b,c","f""g",')).toEqual(["a", "b,c", 'f"g', ""]);
    expect(communeDeRattachement("69385")).toBe("69123");
    expect(communeDeRattachement("13216")).toBe("13055");
    expect(communeDeRattachement("13217")).toBe("13217");
    expect(communeDeRattachement("75121")).toBe("75121");
  });
});
