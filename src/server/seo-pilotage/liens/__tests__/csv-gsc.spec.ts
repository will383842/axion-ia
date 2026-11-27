import { describe, expect, it } from "vitest";
import { lireExportGsc, reconnaitreExport } from "../csv-gsc";

describe("reconnaitreExport", () => {
  it("reconnaît les quatre exports, en anglais et en français", () => {
    expect(reconnaitreExport(["Site", "Linking pages"])).toBe("gsc_sites_principaux");
    expect(reconnaitreExport(["Site", "Pages de liens"])).toBe("gsc_sites_principaux");
    expect(reconnaitreExport(["Linking text", "Count"])).toBe("gsc_ancres");
    expect(reconnaitreExport(["Texte du lien", "Nombre"])).toBe("gsc_ancres");
    expect(reconnaitreExport(["Target page", "Incoming links"])).toBe("gsc_pages_cibles");
    expect(reconnaitreExport(["Page cible", "Liens entrants"])).toBe("gsc_pages_cibles");
    expect(reconnaitreExport(["Linking page", "Last crawled"])).toBe("gsc_liens_externes_recents");
    expect(reconnaitreExport(["Page de liens", "Dernière exploration"])).toBe(
      "gsc_liens_externes_recents",
    );
  });
  it("tolère casse, accents, apostrophes et espaces", () => {
    expect(reconnaitreExport(["  SITE ", "pages de liens"])).toBe("gsc_sites_principaux");
    expect(reconnaitreExport(["Page cible", "liens ENTRANTS"])).toBe("gsc_pages_cibles");
    expect(reconnaitreExport(["Derniere exploration", "Page de liens"])).toBe(
      "gsc_liens_externes_recents",
    );
  });
  it("refuse un fichier inconnu", () => {
    expect(reconnaitreExport(["Nom", "Prénom", "Email"])).toBeNull();
    expect(reconnaitreExport([])).toBeNull();
  });
});

describe("lireExportGsc", () => {
  it("lit un export de sites principaux, séparateur virgule, BOM compris", () => {
    const csv = "﻿Site,Linking pages\nwww.Exemple.fr,12\nblog.autre.com,3\n";
    const r = lireExportGsc(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.type).toBe("gsc_sites_principaux");
    expect(r.lignes).toEqual([
      { type: "gsc_sites_principaux", domaine: "exemple.fr", nbPagesLiantes: 12 },
      { type: "gsc_sites_principaux", domaine: "blog.autre.com", nbPagesLiantes: 3 },
    ]);
    expect(r.ignorees).toBe(0);
  });
  it("détecte le point-virgule (Excel français)", () => {
    const r = lireExportGsc("Page cible;Liens entrants\nhttps://axion-ia.com/fr/faq/;4\n");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lignes).toEqual([{ type: "gsc_pages_cibles", cheminCible: "/fr/faq", nombre: 4 }]);
  });
  it("lit les ancres et tronque à 200", () => {
    const r = lireExportGsc(`Linking text,Count\n${"a".repeat(400)},2\n`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = r.lignes[0]!;
    expect(l.type).toBe("gsc_ancres");
    if (l.type === "gsc_ancres") expect(l.ancre).toHaveLength(200);
  });
  it("lit les liens récents : page source normalisée, date de dernière exploration", () => {
    const r = lireExportGsc(
      "Linking page,Last crawled\nhttps://www.Exemple.fr/a#x,2026-11-03\nhttps://axion-ia.com/fr,2026-11-04\nn'importe quoi,2026-11-05\n",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lignes).toEqual([
      {
        type: "gsc_liens_externes_recents",
        pageSource: "https://www.exemple.fr/a",
        domaineSource: "exemple.fr",
        derniereExploration: "2026-11-03",
      },
    ]);
    expect(r.ignorees).toBe(2);
    expect(r.erreurs).toHaveLength(2);
  });
  it("refuse un fichier d'un type inconnu, avec un message clair", () => {
    const r = lireExportGsc("Nom,Email\nA,a@b.fr\n");
    expect(r).toEqual({ ok: false, raison: "type_inconnu" });
  });
  it("refuse un fichier vide", () => {
    expect(lireExportGsc("")).toEqual({ ok: false, raison: "vide" });
    expect(lireExportGsc("Site,Linking pages\n")).toMatchObject({ ok: true, lignes: [] });
  });
  it("ne garde aucun contenu de cellule au-delà de 200 caractères dans les erreurs, et 20 erreurs au plus", () => {
    const lignes = Array.from({ length: 30 }, () => `${"z".repeat(500)},1`).join("\n");
    const r = lireExportGsc(`Site,Linking pages\n${lignes}\n`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ignorees).toBe(30);
    expect(r.erreurs).toHaveLength(20);
    for (const e of r.erreurs) expect(e.extrait.length).toBeLessThanOrEqual(200);
  });
  it("n'appelle aucune fonction réseau : lecture pure", () => {
    const r = lireExportGsc("Site,Linking pages\nexemple.fr,1\n");
    expect(r.ok).toBe(true);
  });
});

describe("lireExportGsc : fichiers qui ressemblent sans l'être", () => {
  it("refuse un export de prospection qui contient une colonne « Site »", () => {
    expect(lireExportGsc("Nom,Email,Site\nDupont,j@x.fr,www.dupont-btp.fr\n")).toEqual({
      ok: false,
      raison: "type_inconnu",
    });
    expect(reconnaitreExport(["Ancre", "Email"])).toBeNull();
  });
  it("refuse une URL source trop longue au lieu de la tronquer", () => {
    const r = lireExportGsc(
      `Linking page,Last crawled\nhttps://exemple.fr/${"a".repeat(2100)},2026-11-03\n`,
    );
    expect(r).toMatchObject({ ok: true, lignes: [], ignorees: 1 });
  });
  it("une date impossible devient null", () => {
    const r = lireExportGsc(
      "Linking page,Last crawled\nhttps://exemple.fr/a,13/25/2026\nhttps://exemple.fr/b,31/12/2026\n",
    );
    expect(
      r.ok &&
        r.lignes.map((l) => (l.type === "gsc_liens_externes_recents" ? l.derniereExploration : 0)),
    ).toEqual([null, "2026-12-31"]);
  });
});
