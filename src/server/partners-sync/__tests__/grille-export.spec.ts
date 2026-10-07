/**
 * grille-export.spec.ts — DM-03-A : la grille de commission publiée vers Axion Partners.
 *
 * REQ-DM-014 (texte en vigueur ; absorbe REQ-ARG-031, REQ-GOV-019, REQ-JUR-019) et
 * REQ-INT-017. Garde `partners:grille:check`, côté axionia :
 *   1. COHÉRENCE (HYP-W6-BIS) : chaque palier de pricing.ts a SOIT un taux, SOIT une
 *      entrée `BAREMES_INDEFINIS` explicite et datée ; ligne absente → rouge ;
 *   2. DÉRIVATION : l'empreinte de la dernière `commissions.v<N>.json` publiée = celle
 *      recalculée depuis pricing.ts — « modifier pricing.ts sans republier » → rouge ;
 *   3. ARGENT : centimes HT et points de base, entiers, jamais un flottant ;
 *   4. ALERTE AU DÉMARRAGE, inerte sans `PARTNERS_SYNC_ENABLED`.
 *
 * Chaque garde a son TÉMOIN À DEUX FACES : le défaut injecté la fait rougir en nommant
 * la ligne, les données réelles la laissent verte.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { COMMERCIAL_COMMISSIONS, type PricingTier } from "@/content/pricing";
import { GRILLE_VERSION } from "@/server/partners/commission";
import {
  alerterBaremesIndefinisAuDemarrage,
  canonique,
  construireContenuGrille,
  empreinteGrille,
  empreintesDesLignes,
  entreesDepuisPricing,
  lirePublications,
  prochainePublication,
  pseudonymiserPublication,
  verifierCoherenceGrille,
  verifierPublications,
  type EntreesGrille,
} from "@/server/partners-sync/grille/export";

const reelles = (): EntreesGrille => entreesDepuisPricing();

/** Remplace un palier des entrées réelles. */
function avecPalier(id: string, patch: (t: PricingTier) => PricingTier): EntreesGrille {
  const e = reelles();
  const trouve = e.paliers.some((p) => p.tier.id === id);
  if (!trouve) throw new Error(`témoin mal posé : palier ${id} absent des données réelles`);
  return {
    ...e,
    paliers: e.paliers.map((p) => (p.tier.id === id ? { ...p, tier: patch(p.tier) } : p)),
  };
}

const codes = (e: EntreesGrille): string[] =>
  verifierCoherenceGrille(e).map((a) => `${a.code}:${a.id}`);

describe("DM-03-A · cohérence de la grille (HYP-W6-BIS, REQ-DM-014)", () => {
  it("les données réelles : aucune anomalie, sur un périmètre NON vide", () => {
    const e = reelles();
    // Un vert sur zéro palier ne prouverait rien.
    expect(e.paliers.length).toBeGreaterThan(20);
    expect(e.commissions.length).toBeGreaterThan(0);
    expect(verifierCoherenceGrille(e)).toEqual([]);
    console.warn(
      `[grille] ${e.paliers.length} paliers et ${e.commissions.length} commissions confrontés, ` +
        `${e.baremesIndefinis.length} barèmes indéfinis déclarés`,
    );
  });

  it("chaque palier sort « taux » XOR « bareme_indefini » daté ; sans commissionId → bareme_indefini", () => {
    const contenu = construireContenuGrille();
    for (const p of contenu.paliers) {
      if (p.statut === "taux") {
        expect(p.commissionId, p.tierId).not.toBeNull();
        expect(p.baremeIndefini, p.tierId).toBeNull();
      } else {
        expect(p.baremeIndefini?.depuis, p.tierId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.baremeIndefini?.motif, p.tierId).not.toBe("non_declare");
      }
      if (p.commissionId === null) expect(p.statut, p.tierId).toBe("bareme_indefini");
    }
  });

  it("TÉMOIN — un palier ajouté sans commissionId ni entrée datée : rouge, et il est NOMMÉ", () => {
    const e = reelles();
    const nouveau: PricingTier = {
      id: "palier-temoin",
      labelFr: "t",
      labelEn: "t",
      descriptionFr: "t",
      descriptionEn: "t",
    };
    const avec = { ...e, paliers: [...e.paliers, { categorie: "interventions", tier: nouveau }] };
    expect(codes(avec)).toEqual(["palier_absent:palier-temoin"]);
    // Et à l'export, il BLOQUE — jamais un taux par défaut.
    const ligne = construireContenuGrille(avec).paliers.find((p) => p.tierId === "palier-temoin");
    expect(ligne).toMatchObject({
      statut: "bareme_indefini",
      baremeIndefini: { depuis: null, motif: "non_declare" },
    });
  });

  it("TÉMOIN — retirer son commissionId à un palier réel à taux : rouge", () => {
    const { commissionId: _retire, ...sans } = reelles().paliers.find(
      (p) => p.tier.id === "intervention-temps",
    )!.tier;
    expect(codes(avecPalier("intervention-temps", () => sans))).toEqual([
      "palier_absent:intervention-temps",
    ]);
  });

  it("TÉMOIN — un palier à taux ET déclaré indéfini : rouge (double statut)", () => {
    const e = reelles();
    const avec = {
      ...e,
      baremesIndefinis: [
        ...e.baremesIndefinis,
        { tierId: "audit-flash", depuis: "2026-09-27", motif: "palier_sans_bareme" as const },
      ],
    };
    expect(codes(avec)).toEqual(["double_statut:audit-flash"]);
  });

  it("TÉMOIN — une entrée orpheline, une date fausse, un motif hors vocabulaire : trois rouges nommés", () => {
    const e = reelles();
    const avec = {
      ...e,
      baremesIndefinis: [
        ...e.baremesIndefinis.filter((b) => b.tierId !== "codage-web"),
        { tierId: "palier-disparu", depuis: "2026-09-27", motif: "hors_perimetre_w6" as const },
        { tierId: "codage-web", depuis: "2026-02-30", motif: "inconnu" as never },
      ],
    };
    expect(codes(avec).sort()).toEqual(
      [
        "date_invalide:codage-web",
        "entree_orpheline:palier-disparu",
        "motif_invalide:codage-web",
      ].sort(),
    );
  });

  it("TÉMOIN — un palier qui vise une commission inexistante, ou `scale` sans déclaration : rouge", () => {
    expect(codes(avecPalier("impl-poc", (t) => ({ ...t, commissionId: "com-fantome" })))).toEqual(
      expect.arrayContaining(["commission_inconnue:impl-poc", "basis_incoherent:com-integration"]),
    );
    const e = reelles();
    // Depuis le 07/10, plus aucune commission n'est « sur barème » (le 1-to-1 est à 30 %) : le
    // témoin en FABRIQUE une, sans déclaration, et doit voir ses paliers signalés.
    const sansDeclaration = {
      ...e,
      commissions: e.commissions.map((c) =>
        c.id === "com-integration" ? { ...c, kind: "scale" as const, percent: undefined } : c,
      ),
    };
    expect(codes(sansDeclaration)).toEqual(
      expect.arrayContaining(["sans_taux_non_declare:impl-poc"]),
    );
  });

  it("TÉMOIN — basisTierId et commissionId qui divergent : rouge", () => {
    expect(
      codes(avecPalier("audit-cible", (t) => ({ ...t, commissionId: "com-integration" }))),
    ).toEqual(["basis_incoherent:com-audit"]);
  });
});

describe("DM-03-A · argent : centimes HT et points de base, entiers (REQ-DM-014)", () => {
  it("chaque forfait = flatEur × 100 en entier ; chaque pourcentage = percent × 100 bps ; scale sans montant", () => {
    const contenu = construireContenuGrille();
    expect(contenu.unites).toEqual({ montant: "centimes_ht", taux: "points_de_base" });
    for (const c of COMMERCIAL_COMMISSIONS) {
      const l = contenu.commissions.find((x) => x.commissionId === c.id)!;
      expect(l.kind).toBe(c.kind);
      if (c.kind === "flat") {
        expect(Number.isSafeInteger(l.montantCents)).toBe(true);
        expect(l.montantCents).toBe(c.flatEur! * 100);
        expect(l.tauxBps).toBeNull();
      } else if (c.kind === "percent") {
        expect(Number.isSafeInteger(l.tauxBps)).toBe(true);
        expect(l.tauxBps).toBe(c.percent! * 100);
        expect(l.montantCents).toBeNull();
      } else {
        expect(l.montantCents).toBeNull();
        expect(l.tauxBps).toBeNull();
      }
    }
  });

  it("TÉMOIN — un forfait qui ne tombe pas sur un centime entier est REFUSÉ, jamais arrondi", () => {
    const e = reelles();
    const avec = {
      ...e,
      commissions: e.commissions.map((c) =>
        c.id === "com-formation-1j" ? { ...c, flatEur: 500.005 } : c,
      ),
    };
    expect(codes(avec)).toContain("montant_invalide:com-formation-1j");
    const ligne = construireContenuGrille(avec).commissions.find(
      (c) => c.commissionId === "com-formation-1j",
    );
    expect(ligne?.montantCents).toBeNull();
    // Et les paliers qui la visaient BLOQUENT au lieu de porter un montant faux.
    expect(
      construireContenuGrille(avec).paliers.find((p) => p.tierId === "intervention-essentielle")
        ?.statut,
    ).toBe("bareme_indefini");
  });

  it("canonique refuse un flottant : aucun montant à virgule ne peut atteindre l'empreinte", () => {
    expect(() => canonique({ montantCents: 12.5 })).toThrow(/entiers sûrs/);
  });
});

describe("DM-03-A · dérivation : empreinte publiée = empreinte recalculée (REQ-INT-017, REQ-JUR-019)", () => {
  it("la dernière commissions.v<N>.json publiée porte l'empreinte de pricing.ts", () => {
    const pubs = lirePublications();
    expect(pubs.length).toBeGreaterThan(0);
    expect(verifierPublications(pubs)).toEqual([]);
    const derniere = pubs.at(-1)!;
    const recalculee = empreinteGrille(construireContenuGrille());
    expect(
      derniere.hash,
      `pricing.ts a changé sans republier la grille : lancer « pnpm exec tsx scripts/gates/grille-check.ts --publier »`,
    ).toBe(recalculee);
    expect(derniere.contenu).toEqual(construireContenuGrille());
  });

  it("TÉMOIN — modifier pricing.ts (un taux) sans republier : l'empreinte diverge et une v<N+1> est due", () => {
    const e = reelles();
    const modifiee = {
      ...e,
      commissions: e.commissions.map((c) => (c.id === "com-audit" ? { ...c, percent: 29 } : c)),
    };
    const pubs = lirePublications();
    const contenu = construireContenuGrille(modifiee);
    expect(empreinteGrille(contenu)).not.toBe(pubs.at(-1)!.hash);
    const suivante = prochainePublication(pubs, contenu, new Date("2026-10-01T00:00:00.000Z"));
    expect(suivante?.version).toBe(pubs.at(-1)!.version + 1);
    // Contre-témoin : sans changement, aucune version nouvelle.
    expect(prochainePublication(pubs, construireContenuGrille(), new Date())).toBeNull();
  });

  it("TÉMOIN — un centime changé dans une publication sans toucher son hash : rouge", () => {
    const [pub] = lirePublications();
    const trafiquee = {
      ...pub!,
      contenu: {
        ...pub!.contenu,
        commissions: pub!.contenu.commissions.map((c) =>
          c.montantCents === null ? c : { ...c, montantCents: c.montantCents + 1 },
        ),
      },
    };
    expect(verifierPublications([trafiquee]).join("\n")).toMatch(
      /hash embarqué .* ≠ hash recalculé/,
    );
    // L'empreinte de la ligne touchée ne tient plus non plus : c'est elle que Partners nomme.
    expect(verifierPublications([trafiquee]).join("\n")).toMatch(
      /empreintes de ligne absentes ou ≠ recalculées/,
    );
  });

  it("chaque ligne publiée porte son empreinte ; une publication sans elles est rouge", () => {
    const [pub] = lirePublications();
    expect(pub!.empreintesLignes).toEqual(empreintesDesLignes(pub!.contenu));
    expect(Object.keys(pub!.empreintesLignes.paliers)).toHaveLength(pub!.contenu.paliers.length);
    const { empreintesLignes: _retiree, ...sans } = pub!;
    expect(verifierPublications([sans as unknown as NonNullable<typeof pub>]).join("\n")).toMatch(
      /empreintes de ligne absentes/,
    );
  });

  it("l'empreinte ne dépend pas de l'ordre des clés (relecture jsonb) : aller-retour JSON inchangé", () => {
    const contenu = construireContenuGrille();
    const relu = JSON.parse(JSON.stringify(contenu)) as typeof contenu;
    const renverse = JSON.parse(
      JSON.stringify(contenu, (_k, v: unknown) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse())
          : v,
      ),
    ) as typeof contenu;
    expect(empreinteGrille(relu)).toBe(empreinteGrille(contenu));
    expect(empreinteGrille(renverse)).toBe(empreinteGrille(contenu));
    expect(empreinteGrille(contenu)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("la grille porte la grilleVersion des événements, dérivée et non recopiée", () => {
    expect(construireContenuGrille().grilleVersionEvenement).toBe(GRILLE_VERSION);
  });
});

describe("DM-03-A · la fixture pseudonymisée de Partners (DM-03-P, RM-03)", () => {
  it("même structure, mêmes identifiants et statuts ; aucun montant ni taux réel ; empreinte recalculée", () => {
    const vraie = lirePublications().at(-1)!;
    const fixture = pseudonymiserPublication(vraie);
    expect(fixture.version).toBe(vraie.version);
    expect(fixture.contenu.paliers).toEqual(vraie.contenu.paliers);
    expect(fixture.contenu.commissions.map((c) => [c.commissionId, c.kind])).toEqual(
      vraie.contenu.commissions.map((c) => [c.commissionId, c.kind]),
    );
    const valeurs = (p: typeof vraie) =>
      p.contenu.commissions.flatMap((c) => [c.montantCents, c.tauxBps]).filter((v) => v !== null);
    // Chaque valeur non nulle devient son rang : 1, 2, 3… — aucune valeur réelle ne survit.
    expect(valeurs(fixture)).toEqual(valeurs(fixture).map((_v, i) => i + 1));
    for (const v of valeurs(vraie)) expect(valeurs(fixture)).not.toContain(v);
    expect(fixture.hash).toBe(empreinteGrille(fixture.contenu));
    expect(fixture.hash).not.toBe(vraie.hash);
    // La fixture prend la place de la dernière publication DANS sa chaîne : seule, une v2 ou plus
    // violerait la contiguïté depuis la v1 (INT-T53-A, première republication).
    expect(verifierPublications([...lirePublications().slice(0, -1), fixture])).toEqual([]);
  });

  it("TÉMOIN — aucune empreinte calculée sur les VRAIES valeurs ne traverse la fixture (grilleVersionEvenement compris)", () => {
    const vraie = lirePublications().at(-1)!;
    const texte = JSON.stringify(pseudonymiserPublication(vraie));
    // Toute empreinte dont l'entrée contient un montant ou un taux réel est forçable par
    // énumération, les identifiants étant en clair : aucune ne doit survivre.
    const derivees = [
      vraie.hash,
      vraie.contenu.grilleVersionEvenement,
      ...vraie.contenu.commissions
        .filter((c) => c.montantCents !== null || c.tauxBps !== null)
        .map((c) => vraie.empreintesLignes.commissions[c.commissionId]!),
    ];
    for (const d of derivees) expect(texte, d).not.toContain(d);
    // Et la version d'événement de la fixture dérive des seules valeurs pseudonymisées.
    const fixture = pseudonymiserPublication(vraie);
    expect(fixture.contenu.grilleVersionEvenement).toMatch(/^[0-9a-f]{12}$/);
    expect(fixture.contenu.grilleVersionEvenement).not.toBe(GRILLE_VERSION);
  });

  it("aucun libellé de commission n'écrit un montant ou un taux en clair", () => {
    for (const c of lirePublications().at(-1)!.contenu.commissions)
      expect(c.libelleFr, c.commissionId).not.toMatch(/\d\s*(?:€|%|eur\b)/i);
  });
});

describe("DM-03-A · alerte au démarrage (HYP-W6-BIS) — inerte sans PARTNERS_SYNC_ENABLED", () => {
  const avant = process.env.PARTNERS_SYNC_ENABLED;
  afterEach(() => {
    if (avant === undefined) delete process.env.PARTNERS_SYNC_ENABLED;
    else process.env.PARTNERS_SYNC_ENABLED = avant;
  });

  it("drapeau posé : alerte nommant chaque palier en barème indéfini", () => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    const alerter = vi.fn();
    const r = alerterBaremesIndefinisAuDemarrage(alerter);
    expect(r.actif).toBe(true);
    const attendus = construireContenuGrille()
      .paliers.filter((p) => p.statut === "bareme_indefini")
      .map((p) => p.tierId);
    expect(attendus.length).toBeGreaterThan(0);
    expect(r.baremesIndefinis).toEqual(attendus);
    expect(alerter).toHaveBeenCalledTimes(1);
    for (const id of attendus) expect(alerter.mock.calls[0]![0]).toContain(id);
  });

  it("drapeau posé + palier non déclaré : l'anomalie est AUSSI alertée", () => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    const e = reelles();
    const nouveau: PricingTier = {
      id: "palier-temoin",
      labelFr: "t",
      labelEn: "t",
      descriptionFr: "t",
      descriptionEn: "t",
    };
    const alerter = vi.fn();
    alerterBaremesIndefinisAuDemarrage(alerter, {
      ...e,
      paliers: [...e.paliers, { categorie: "audit", tier: nouveau }],
    });
    expect(alerter.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(
      /palier_absent:palier-temoin/,
    );
  });

  it("l'alerte est RÉELLEMENT appelée au démarrage Node (src/instrumentation.ts), pas seulement écrite", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src", "instrumentation.ts"), "utf8");
    const register = source.slice(
      source.indexOf("export async function register"),
      source.indexOf('=== "edge"'),
    );
    expect(register).toContain("await alerterGrillePartnersOnBoot(");
    // L'import vit DANS la branche nodejs : ailleurs, le bundle edge le compile et
    // refuse `node:crypto` (build rouge de #1181, Gate B et Gate C).
    expect(register).toMatch(/import\(\s*"@\/server\/partners-sync\/grille\/export"\s*\)/);
    expect(source).toMatch(/alerterBaremesIndefinisAuDemarrage\(\);/);
  });

  it.each([undefined, "false", "1", "TRUE"])(
    "drapeau %s : rien n'est calculé ni alerté (mêmes entrées que ci-dessus)",
    (v) => {
      if (v === undefined) delete process.env.PARTNERS_SYNC_ENABLED;
      else process.env.PARTNERS_SYNC_ENABLED = v;
      const alerter = vi.fn();
      const r = alerterBaremesIndefinisAuDemarrage(alerter);
      expect(r).toEqual({ actif: false, baremesIndefinis: [], anomalies: [] });
      expect(alerter).not.toHaveBeenCalled();
    },
  );
});
