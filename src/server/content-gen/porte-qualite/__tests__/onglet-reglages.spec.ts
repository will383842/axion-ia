import { describe, expect, it } from "vitest";
import { MOTIFS_INTERDITS } from "@/lib/contenu/interdits-publication";
import { REGLAGES_PAR_DEFAUT } from "../reglages";
import {
  fusionnerReglages,
  lireDerogations,
  lireJournal,
  listerInterdits,
} from "../onglet-reglages";

const saisieDefaut = (): Record<string, string> =>
  Object.fromEntries(Object.entries(REGLAGES_PAR_DEFAUT).map(([k, v]) => [k, String(v)]));

describe("onglet 4 : réglages", () => {
  it("accepte une saisie valide et conserve les autres clés de la config", () => {
    const r = fusionnerReglages(
      { phase: "observation", plafondSecuriteParJour: 3, seuilPublication: 85 },
      { ...saisieDefaut(), seuilPublication: "90" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.phase).toBe("observation");
      expect(r.config.plafondSecuriteParJour).toBe(3);
      expect(r.config.seuilPublication).toBe(90);
    }
  });

  it("refuse une saisie hors schéma (seuilBloque > seuilPublication) sans rien écrire", () => {
    const r = fusionnerReglages({}, { ...saisieDefaut(), seuilBloque: "95" });
    expect(r.ok).toBe(false);
  });

  it("refuse une valeur vide ou non numérique, jamais 0 par défaut", () => {
    expect(fusionnerReglages({}, { ...saisieDefaut(), h2Min: "" }).ok).toBe(false);
    expect(fusionnerReglages({}, { ...saisieDefaut(), h2Min: "abc" }).ok).toBe(false);
  });

  it("ignore toute clé inconnue de la saisie (ne l'écrit pas)", () => {
    const r = fusionnerReglages({}, { ...saisieDefaut(), phase: "reel", mode: "reel" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.phase).toBeUndefined();
      expect(r.config.mode).toBeUndefined();
    }
  });

  it("une config existante invalide n'empêche pas d'enregistrer une saisie valide", () => {
    expect(fusionnerReglages("n'importe quoi", saisieDefaut()).ok).toBe(true);
  });
});

describe("onglet 4 : interdits en lecture seule", () => {
  it("liste exactement les motifs importés, sans les modifier", () => {
    const l = listerInterdits();
    expect(l).toHaveLength(MOTIFS_INTERDITS.length);
    for (const m of MOTIFS_INTERDITS) {
      expect(l.some((x) => x.code === m.code && x.raison === m.raison)).toBe(true);
    }
  });
  it("« partout en France » n'est refusée par aucun motif listé", () => {
    for (const m of MOTIFS_INTERDITS) {
      m.re.lastIndex = 0;
      expect(m.re.test("partout en france")).toBe(false);
    }
  });
});

describe("onglet 4 : journal et dérogations", () => {
  it("le journal montre qui, quand, avant, après", () => {
    const j = lireJournal([
      {
        id: "a",
        actorEmail: "w@x.fr",
        createdAt: new Date("2026-11-28T10:00:00Z"),
        oldValue: { seuilPublication: 85 },
        newValue: { seuilPublication: 90 },
        description: null,
      },
    ]);
    expect(j[0]).toMatchObject({
      qui: "w@x.fr",
      changements: [{ cle: "seuilPublication", avant: "85", apres: "90" }],
    });
  });
  it("une valeur absente s'affiche « indisponible », pas 0", () => {
    const j = lireJournal([
      {
        id: "a",
        actorEmail: null,
        createdAt: new Date(),
        oldValue: null,
        newValue: { h2Min: 3 },
        description: null,
      },
    ]);
    expect(j[0]?.qui).toBe("système");
    expect(j[0]?.changements[0]?.avant).toBe("indisponible");
  });
  it("les dérogations sont les verdicts décidés par un humain, avec leur motif", () => {
    const d = lireDerogations([
      {
        id: "1",
        jobId: "j",
        contentKind: "blog_article",
        verdict: "publiable",
        note: 80,
        decidePar: "w@x.fr",
        motifDerogation: "coquille",
        createdAt: new Date(),
      },
      {
        id: "2",
        jobId: "k",
        contentKind: "blog_article",
        verdict: "bloque",
        note: null,
        decidePar: null,
        motifDerogation: null,
        createdAt: new Date(),
      },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ decidePar: "w@x.fr", motif: "coquille", note: 80 });
  });
});
