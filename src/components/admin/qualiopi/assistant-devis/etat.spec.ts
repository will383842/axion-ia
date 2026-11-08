import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  controlerEtape,
  deserialiser,
  etatInitial,
  propositionEffective,
  raisonPrixUniqueImpose,
  reducteur,
  serialiser,
} from "./etat";
import { etatT1, etatT3, etatT4, etatT5, FIXTURES, SAISIES_EUROS } from "./fixtures";
import type { EtatAssistant } from "./types";

const PARAMS = { validiteParDefaut: "2026-12-08", formulesActives: true };
const neuf = (): EtatAssistant => etatInitial({ ...PARAMS, defaultClientId: "c-1" });
const avec = (e: EtatAssistant, patch: Partial<EtatAssistant>) =>
  reducteur(e, { type: "champs", patch });

describe("état initial et choix du type de devis", () => {
  it("reprend defaultClientId et la validité reçue, sans aucune ligne facultative", () => {
    const e = neuf();
    expect(e.clientId).toBe("c-1");
    expect(e.validite).toBe("2026-12-08");
    expect(e.automatisationsHeritees).toEqual([]);
    expect(JSON.stringify(e)).not.toContain('facultative":true');
    expect(e.lignes.every((l) => !("facultative" in l))).toBe(true);
  });

  it("« Mise en place d'une IA » pose l'activité et autorise A/B", () => {
    const e = avec(reducteur(neuf(), { type: "modele", modele: "implementation" }), {
      proposition: "AB",
    });
    expect(e.modele).toBe("implementation");
    expect(raisonPrixUniqueImpose(e)).toBeNull();
    expect(propositionEffective(e)).toBe("AB");
  });

  it("« Formation » impose le prix unique, avec une raison lisible", () => {
    const e = avec(reducteur(neuf(), { type: "modele", modele: "formation" }), {
      proposition: "A",
    });
    expect(propositionEffective(e)).toBe("prix_unique");
    expect(raisonPrixUniqueImpose(e)).toMatch(/formules/i);
  });

  it("client particulier ou interrupteur éteint imposent le prix unique", () => {
    const e = avec(reducteur(neuf(), { type: "modele", modele: "site_web" }), { proposition: "B" });
    expect(propositionEffective(e)).toBe("B");
    const part = reducteur(e, { type: "client", id: "c-2", clientType: "particulier" });
    expect(propositionEffective(part)).toBe("prix_unique");
    expect(propositionEffective(avec(e, { formulesActives: false }))).toBe("prix_unique");
  });
});

describe("controlerEtape", () => {
  it("étape 1 : refuse sans client, sans intitulé, sans ligne", () => {
    const e = etatT1();
    expect(controlerEtape(e, 1)).toEqual([]);
    expect(controlerEtape(avec(e, { clientId: "" }), 1)).toContain("Choisissez un client.");
    expect(controlerEtape(avec(e, { intitule: "  " }), 1)).toContain(
      "Donnez un intitulé au devis.",
    );
    expect(controlerEtape(avec(e, { lignes: [] }), 1)).toContain(
      "Ajoutez au moins une ligne au devis.",
    );
  });

  it("étape 1 : tranche chaque saisie d'euros du cas T6, jamais ramenée à 0", () => {
    for (const { saisie, cents } of SAISIES_EUROS) {
      const e = etatT1();
      const lignes = e.lignes.map((l, i) => (i === 0 ? { ...l, prixEur: saisie } : l));
      const erreurs = controlerEtape(avec(e, { lignes }), 1);
      if (cents === null) expect(erreurs.join(" "), saisie).toMatch(/Ligne 1 : prix illisible/);
      else expect(erreurs, saisie).toEqual([]);
    }
    const vide = etatT1().lignes.map((l, i) => (i === 0 ? { ...l, prixEur: "" } : l));
    expect(controlerEtape(avec(etatT1(), { lignes: vide }), 1).join(" ")).toMatch(/prix illisible/);
  });

  it("étape 1b : refuse un total différent de 100 %", () => {
    expect(controlerEtape(etatT1(), "1b")).toEqual([]);
    const phases = etatT1().achat.phases.map((p, i) => (i === 0 ? { ...p, pourcentage: "20" } : p));
    const e = reducteur(etatT1(), { type: "achat", patch: { phases } });
    expect(controlerEtape(e, "1b")[0]).toMatch(/100 %/);
    const trop = etatT1().achat.phases.map((p, i) => (i === 0 ? { ...p, pourcentage: "40" } : p));
    expect(
      controlerEtape(reducteur(etatT1(), { type: "achat", patch: { phases: trop } }), "1b")[0],
    ).toMatch(/110 %/);
  });

  it("étape 1b : une phase à 0 % (ou au-dessus de 100) est refusée, même si le total vaut 100", () => {
    const [p0, p1] = etatT1().achat.phases;
    const phases = [
      { ...p0!, pourcentage: "0" },
      { ...p1!, pourcentage: "100" },
    ];
    const e = reducteur(etatT1(), { type: "achat", patch: { phases } });
    expect(controlerEtape(e, "1b").join(" ")).toMatch(/entre 1 et 100/);
  });

  it("étape 2 : mois offerts de maintenance, entier >= 0 sinon refus lisible", () => {
    const avecMois = (moisOfferts: string) =>
      reducteur(etatT1(), {
        type: "achat",
        patch: { maintenance: { ...etatT1().achat.maintenance, moisOfferts } },
      });
    expect(etatInitial({ ...PARAMS, defaultClientId: "c-1" }).achat.maintenance.moisOfferts).toBe(
      "0",
    );
    for (const ok of ["0", "3", " 12 "]) {
      expect(controlerEtape(avecMois(ok), 2), ok).toEqual([]);
    }
    for (const ko of ["-1", "1.5", "abc", ""]) {
      expect(controlerEtape(avecMois(ko), 2).join(" "), ko).toMatch(/mois offerts.*entier/);
    }
  });

  it("les mois offerts sont gardés à l'aller-retour sérialisé", () => {
    const e = reducteur(etatT1(), {
      type: "achat",
      patch: { maintenance: { ...etatT1().achat.maintenance, moisOfferts: "4" } },
    });
    const lu = deserialiser(JSON.parse(JSON.stringify(serialiser(e, 2))));
    expect(lu.ok && lu.etat.achat.maintenance.moisOfferts).toBe("4");
  });

  it("étape 2 : plafond ou estimation illisibles ne bloquent qu'hors prix unique (E14)", () => {
    const base = avec(etatT3(), {
      proposition: "A",
      plafondSaisie: "",
      servicesSaisies: ["12,505"],
    });
    expect(propositionEffective(base)).toBe("A");
    expect(controlerEtape(base, 2).join(" ")).toMatch(/Plafond/);
    expect(controlerEtape(base, 2).join(" ")).toMatch(/estimation illisible/);
    // Passage en prix unique : la section disparaît, l'étape 2 et l'envoi ne doivent plus bloquer.
    const unique = avec(base, { proposition: "prix_unique" });
    expect(controlerEtape(unique, 2)).toEqual([]);
    expect(controlerEtape(unique, 4)).toEqual([]);
    // Prix unique imposé (formules désactivées) : même résultat.
    const impose = avec(base, { formulesActives: false });
    expect(controlerEtape(impose, 2)).toEqual([]);
    expect(controlerEtape(impose, 4)).toEqual([]);
  });

  it("les jeux d'essai T1 à T5 passent toutes les étapes", () => {
    for (const [nom, f] of Object.entries(FIXTURES)) {
      expect(controlerEtape(f(), 4), nom).toEqual([]);
    }
  });
});

describe("formules : rien ne se perd, rien n'est inventé", () => {
  it("A → B → A ne perd aucune donnée", () => {
    const a = etatT1();
    const aller = reducteur(reducteur(a, { type: "proposer", proposition: "B" }), {
      type: "proposer",
      proposition: "A",
    });
    expect(aller).toEqual(a);
  });

  it("T3 → B seule → A + B garde la mise en service saisie (T5)", () => {
    const t3 = etatT3();
    const t5 = etatT5();
    expect(t5.abonnement.miseEnServiceSaisie).toBe("1 900");
    expect(t5.lignes).toEqual(t3.lignes);
    const retour = reducteur(t5, { type: "proposer", proposition: "AB" });
    expect(retour.abonnement.miseEnServiceSaisie).toBe("1 900");
    expect(retour).toEqual(t3);
  });

  it("supprimer une ligne retire les dépendances qui la visaient", () => {
    let e = etatT4();
    e = reducteur(e, { type: "ligne_modifier", id: "p-b", patch: { necessite: ["p-a"] } });
    e = reducteur(e, { type: "ligne_supprimer", id: "p-a" });
    expect(e.lignes.map((l) => l.id)).toEqual(["p-b", "p-c", "p-d"]);
    expect(e.lignes[0]?.necessite).toEqual([]);
  });

  it("aucun état ne porte de montant d'IA : le choix d'IA est sans montant", () => {
    const cles = (x: unknown, chemin = ""): string[] =>
      typeof x !== "object" || x === null
        ? []
        : Object.entries(x).flatMap(([k, v]) => [`${chemin}.${k}`, ...cles(v, `${chemin}.${k}`)]);
    for (const f of Object.values(FIXTURES)) {
      const ia = cles(f().ia).join(" ");
      expect(ia).not.toMatch(/eur|cents|forfait|montant|prix/i);
    }
    expect(Object.keys(neuf().ia.achat).sort()).toEqual(["mode", "moisInclus"]);
  });

  it("l'état ne porte ni taux de TVA ni mode d'avance", () => {
    const json = JSON.stringify(etatT3());
    expect(json).not.toMatch(/tva|modeAvance/i);
  });
});

describe("forme sérialisée", () => {
  it("sérialise et désérialise à l'identique, avec l'étape", () => {
    for (const f of Object.values(FIXTURES)) {
      const s = serialiser(f(), "1b");
      const lu = deserialiser(JSON.parse(JSON.stringify(s)));
      expect(lu).toEqual({ ok: true, etape: "1b", etat: f() });
    }
  });

  it("version inconnue ou contenu illisible : erreur lisible, pas d'exception", () => {
    const s = serialiser(etatT1(), 2);
    const r = deserialiser({ ...s, v: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/Version de brouillon inconnue \(2\)/);
    for (const brut of [null, "x", 3, [], { v: 1 }, { ...s, etape: "9" }, { ...s, etat: {} }]) {
      expect(deserialiser(brut).ok).toBe(false);
    }
  });
});

describe("code client-safe", () => {
  it("types.ts, etat.ts et fixtures.ts n'importent rien de serveur", () => {
    for (const f of ["types.ts", "etat.ts", "fixtures.ts"]) {
      const src = readFileSync(join(__dirname, f), "utf8");
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1] ?? "");
      for (const i of imports) {
        expect(i, f).not.toMatch(/prisma|node:|pricing|json-canonique|server-only|facture-libre/);
      }
      expect(src, f).not.toMatch(/Grenoble|Aucun gain garanti|Will\b/);
    }
  });
});
