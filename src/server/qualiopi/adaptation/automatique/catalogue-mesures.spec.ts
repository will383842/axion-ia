import { describe, expect, it } from "vitest";
import {
  CHAMPS_DECLARATION,
  CLES_REPONSE_ADAPTATION,
  fusionnerConsignation,
  MESURES,
  TYPES_BESOIN,
  lireDeclaration,
  mesuresDisponibles,
  mesuresProposees,
  retirerChampsDeclaration,
  texteConsignationAutomatique,
  textePourReferent,
} from "./catalogue-mesures";

const LIBELLES_TYPES = TYPES_BESOIN.map((t) => t.libelle);

function saisie(v: Record<string, unknown>): Record<string, unknown> {
  return {
    [CHAMPS_DECLARATION.types]: v["types"],
    [CHAMPS_DECLARATION.mesures]: v["mesures"],
    [CHAMPS_DECLARATION.commentaire]: v["commentaire"],
    [CHAMPS_DECLARATION.consentement]: v["consentement"],
    [CHAMPS_DECLARATION.choix]: v["choix"],
  };
}

describe("catalogue des mesures d'adaptation", () => {
  it("chaque type a au moins une mesure, chaque mesure vise au moins un type", () => {
    for (const t of TYPES_BESOIN) {
      expect(mesuresDisponibles([t.code]).length, t.code).toBeGreaterThan(0);
    }
    for (const m of MESURES) expect(m.types.length, m.code).toBeGreaterThan(0);
  });

  it("propose des mesures STANDARD selon le type, jamais une mesure complexe", () => {
    const auditif = mesuresProposees(["auditif"]);
    expect(auditif).toContain("sous_titrage");
    expect(auditif).toContain("consignes_ecrites");
    expect(auditif).not.toContain("interprete_lsf");
    expect(auditif).not.toContain("salle_accessible");

    const mobilite = mesuresProposees(["mobilite"]);
    expect(mobilite).toContain("salle_accessible");
    expect(mobilite).not.toContain("sous_titrage");

    const dys = mesuresProposees(["dys"]);
    expect(dys).toContain("police_adaptee");
    expect(dys).toContain("temps_majore");

    // Deux types : l'union, sans doublon, dans l'ordre du catalogue.
    const deux = mesuresProposees(["visuel", "dys"]);
    expect(new Set(deux).size).toBe(deux.length);
    const ordre = MESURES.map((m) => m.code).filter((c) => deux.includes(c));
    expect(deux).toEqual(ordre);
  });

  it("les mesures complexes restent DISPONIBLES (cochables) pour le type concerné", () => {
    const codes = mesuresDisponibles(["auditif"]).map((m) => m.code);
    expect(codes).toContain("interprete_lsf");
    expect(codes).toContain("financement_agefiph");
    expect(mesuresDisponibles(["mobilite"]).map((m) => m.code)).not.toContain("interprete_lsf");
  });
});

describe("lireDeclaration", () => {
  it("cas standard confirmé : aucune alerte", () => {
    const r = lireDeclaration(
      saisie({
        types: ["visuel"],
        mesures: ["supports_agrandis", "place_proche"],
        consentement: true,
        choix: "confirme",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.declaration.casComplexe).toBe(false);
    expect(r.declaration.mesuresStandard).toEqual(["supports_agrandis", "place_proche"]);
    expect(r.declaration.mesuresComplexes).toEqual([]);
  });

  it("interprète LSF, matériel, financement Agefiph, échange : cas complexes", () => {
    const lsf = lireDeclaration(
      saisie({
        types: ["auditif"],
        mesures: ["sous_titrage", "interprete_lsf"],
        consentement: true,
        choix: "confirme",
      }),
    );
    expect(lsf.ok && lsf.declaration.casComplexe).toBe(true);
    expect(lsf.ok && lsf.declaration.motifs).toEqual(["interprete"]);
    expect(lsf.ok && lsf.declaration.mesuresStandard).toEqual(["sous_titrage"]);

    const materiel = lireDeclaration(
      saisie({
        types: ["mobilite"],
        mesures: ["materiel_specifique", "financement_agefiph"],
        consentement: true,
        choix: "confirme",
      }),
    );
    expect(materiel.ok && materiel.declaration.motifs).toEqual(["materiel", "financement"]);

    const echange = lireDeclaration(
      saisie({ types: ["dys"], mesures: [], consentement: true, choix: "echange" }),
    );
    expect(echange.ok && echange.declaration.motifs).toEqual(["echange"]);
  });

  it("sans consentement : rien de détaillé n'est retenu, et c'est un échange", () => {
    const r = lireDeclaration(
      saisie({
        types: ["psychique"],
        mesures: ["pauses"],
        commentaire: "texte",
        consentement: false,
        choix: "echange",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.declaration.types).toEqual([]);
    expect(r.declaration.mesuresStandard).toEqual([]);
    expect(r.declaration.commentaire).toBe("");
    expect(r.declaration.motifs).toEqual(["sans_precision"]);

    const confirmeSansAccord = lireDeclaration(
      saisie({ types: ["dys"], mesures: ["pauses"], consentement: false, choix: "confirme" }),
    );
    expect(confirmeSansAccord.ok).toBe(false);
  });

  it("la précision est OBLIGATOIRE : type absent, inconnu, mesure hors type → refus", () => {
    expect(lireDeclaration(saisie({ types: [], consentement: true, choix: "echange" })).ok).toBe(
      false,
    );
    expect(
      lireDeclaration(saisie({ types: ["cardiaque"], consentement: true, choix: "echange" })).ok,
    ).toBe(false);
    expect(
      lireDeclaration(
        saisie({
          types: ["mobilite"],
          mesures: ["interprete_lsf"],
          consentement: true,
          choix: "confirme",
        }),
      ).ok,
    ).toBe(false);
    expect(
      lireDeclaration(
        saisie({ types: ["dys"], mesures: [], consentement: true, choix: "confirme" }),
      ).ok,
    ).toBe(false);
    expect(lireDeclaration(saisie({ types: ["dys"], consentement: true })).ok).toBe(false);
  });
});

describe("fusionnerConsignation — rien ne s'efface", () => {
  const t1 = texteConsignationAutomatique(["pauses"], new Date("2026-11-02T09:00:00Z"));
  const t1bis = texteConsignationAutomatique(["pauses"], new Date("2026-11-03T09:00:00Z"));
  const t2 = texteConsignationAutomatique(["sous_titrage"], new Date("2026-11-03T09:00:00Z"));

  it("colonne vide : la nouvelle réponse", () => {
    expect(fusionnerConsignation(null, t1)).toBe(t1);
    expect(fusionnerConsignation("  ", t1)).toBe(t1);
  });

  it("une réponse du référent est gardée, la nouvelle s'ajoute", () => {
    const r = fusionnerConsignation("Interprète LSF réservé le 3/11.", t2);
    expect(r.startsWith("Interprète LSF réservé le 3/11.")).toBe(true);
    expect(r).toContain(t2);
  });

  it("la même déclaration resoumise ne s'ajoute pas deux fois", () => {
    expect(fusionnerConsignation(t1, t1bis)).toBe(t1);
    expect(fusionnerConsignation(t1, t2)).toBe(`${t1}\n\n${t2}`);
  });
});

describe("🔴 la donnée de santé ne sort que vers le référent", () => {
  it("le texte consigné (fiche formateur, convocation) ne nomme aucun type de besoin", () => {
    const texte = texteConsignationAutomatique(
      ["sous_titrage", "supports_agrandis", "pauses"],
      new Date("2026-11-02T09:15:00Z"),
    );
    expect(texte).toContain("Sous-titrage");
    for (const l of LIBELLES_TYPES) expect(texte.toLowerCase()).not.toContain(l.toLowerCase());
    expect(texte).toContain("2 novembre 2026");
  });

  it("le texte pour le référent porte types, mesures, commentaire et choix", () => {
    const r = lireDeclaration(
      saisie({
        types: ["auditif"],
        mesures: ["interprete_lsf"],
        commentaire: "Je lis sur les lèvres.",
        consentement: true,
        choix: "confirme",
      }),
    );
    if (!r.ok) throw new Error("attendu valide");
    const texte = textePourReferent(r.declaration, {
      declareLe: new Date("2026-11-02T09:15:00Z"),
      sessionTitre: "IA générative",
    });
    expect(texte).toContain("Auditif");
    expect(texte).toContain("Interprète");
    expect(texte).toContain("Je lis sur les lèvres.");
    expect(texte).toContain("IA générative");
  });

  it("les champs saisis sont TOUJOURS retirés des réponses, et les clés serveur ne se forgent pas", () => {
    const nettoye = retirerChampsDeclaration({
      besoinAdaptation: true,
      attentes: "x",
      ...saisie({ types: ["dys"], mesures: ["pauses"], commentaire: "c", consentement: true }),
      [CLES_REPONSE_ADAPTATION.consentement]: true,
      [CLES_REPONSE_ADAPTATION.choix]: "confirme",
    });
    expect(nettoye).toEqual({ besoinAdaptation: true, attentes: "x" });
  });
});
