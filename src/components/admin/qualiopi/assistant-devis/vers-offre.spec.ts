import { describe, expect, it } from "vitest";

import { sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";

import { construireOffre, offreVersSaisie, type TexteCopie } from "../devis-formules/saisie";
import { reducteur } from "./etat";
import { etatT1, etatT2, etatT3, etatT4, etatT5 } from "./fixtures";
import type { EtatAssistant } from "./types";
import { versOffre } from "./vers-offre";

const CTX = { tvaStandardPct: 20, textes: [] as TexteCopie[] };

function formules(e: EtatAssistant, ctx = CTX) {
  const r = versOffre(e, ctx);
  if (!r.ok || r.type !== "formules") throw new Error(JSON.stringify(r));
  return r;
}

describe("formules proposées (D1)", () => {
  it("A seule : formulesProposees = [achat], pas de bloc abonnement, lignes de l'étape 1", () => {
    const { offre } = formules(etatT1());
    expect(offre.formulesProposees).toEqual(["achat"]);
    expect(offre.abonnement).toBeUndefined();
    expect(offre.achat!.lignes.map((l) => [l.quantite, l.prixHtCents])).toEqual([
      [1, 240000],
      [1, 180000],
      [2.3, 12345],
    ]);
    expect(offre.automatisations).toEqual([]);
  });

  it("B seule : formulesProposees = [abonnement], pas de bloc achat, mise en service = lignes", () => {
    const { offre } = formules(etatT5());
    expect(offre.formulesProposees).toEqual(["abonnement"]);
    expect(offre.achat).toBeUndefined();
    expect(offre.abonnement!.miseEnServiceLignes).toHaveLength(3);
    expect(offre.abonnement!.miseEnServiceLignes[0]!.libelle).toBe("Assistant de réponse");
  });

  it("A + B : B porte UNE ligne de mise en service saisie, aucune ligne de l'étape 1", () => {
    const { offre } = formules(etatT3());
    expect(offre.formulesProposees).toEqual(["achat", "abonnement"]);
    expect(offre.achat!.lignes).toHaveLength(3);
    expect(offre.abonnement!.miseEnServiceLignes).toEqual([
      expect.objectContaining({
        libelle: "Mise en service et adaptation",
        quantite: 1,
        prixHtCents: 190000,
      }),
    ]);
  });

  it("T5 : bascule en B seule puis retour en A + B ; le montant saisi reste dans le brouillon", () => {
    const e = etatT5();
    expect(e.abonnement.miseEnServiceSaisie).toBe("1 900");
    const retour = reducteur(e, { type: "proposer", proposition: "AB" });
    expect(formules(retour).offre.abonnement!.miseEnServiceLignes[0]!.prixHtCents).toBe(190000);
  });

  it.each(["", "   ", "0", "0,00"])(
    "mise en service B « %s » en A + B : aucune ligne, jamais 0 €",
    (v) => {
      const e = reducteur(etatT3(), { type: "abonnement", patch: { miseEnServiceSaisie: v } });
      expect(formules(e).offre.abonnement!.miseEnServiceLignes).toEqual([]);
    },
  );

  it("mise en service illisible : message lisible, pas de conversion", () => {
    const e = reducteur(etatT3(), { type: "abonnement", patch: { miseEnServiceSaisie: "12 €" } });
    const r = versOffre(e, CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/mise en service/i);
  });

  it("prix de ligne avec espace insécable lu correctement (« 2 400 » → 240 000)", () => {
    const e = etatT1();
    const lignes = e.lignes.map((l, i) => (i === 0 ? { ...l, prixEur: "2 400" } : l));
    const { offre } = formules({ ...e, lignes });
    expect(offre.achat!.lignes[0]!.prixHtCents).toBe(240000);
  });

  it("hébergement chez Axion-IA : mensuel converti en centimes", () => {
    const e = reducteur(etatT1(), {
      type: "achat",
      patch: { hebergement: "axion", hebergementMensuelEur: "1 200" },
    });
    expect(formules(e).offre.achat!.hebergementMensuelHtCents).toBe(120000);
  });

  it("mois de maintenance offerts : transmis à l'offre (le moteur les porte), jamais forcés à 0", () => {
    const e = reducteur(etatT1(), {
      type: "achat",
      patch: { maintenance: { ...etatT1().achat.maintenance, moisOfferts: "3" } },
    });
    expect(formules(e).offre.achat!.maintenance.moisOfferts).toBe(3);
    expect(formules(etatT1()).offre.achat!.maintenance.moisOfferts).toBe(0);
  });
});

describe("TVA, textes, modeAvance", () => {
  it("le taux de chaque ligne et de l'abonnement vient du paramètre reçu", () => {
    const { offre } = formules(etatT3(), { ...CTX, tvaStandardPct: 25 });
    expect(offre.achat!.lignes.every((l) => l.tauxTvaBps === 2500)).toBe(true);
    expect(offre.abonnement!.tauxTvaBps).toBe(2500);
    expect(offre.abonnement!.miseEnServiceLignes.every((l) => l.tauxTvaBps === 2500)).toBe(true);
  });

  it("jamais sous le taux standard : un taux de 19 % est refusé par le moteur", () => {
    const r = versOffre(etatT1(), { ...CTX, tvaStandardPct: 19 });
    expect(r.ok).toBe(false);
  });

  it("textes recopiés tels quels", () => {
    const textes: TexteCopie[] = [
      { bibliothequeId: "b1", version: "3", texte: "Texte exact.", actif: true },
    ];
    expect(formules(etatT1(), { ...CTX, textes }).offre.textes).toEqual(textes);
  });

  it("aucune modeAvance n'est écrite dans la saisie (défaut du schéma)", () => {
    const r = formules(etatT3());
    expect("modeAvance" in r.saisie.abonnement).toBe(false);
  });
});

describe("prix unique (T4)", () => {
  it("produit des lignes classiques en centimes, sans taux de TVA, sans construireOffre", () => {
    const r = versOffre(etatT4(), CTX);
    expect(r.ok && r.type).toBe("classique");
    if (!r.ok || r.type !== "classique") return;
    expect(r.classique.activite).toBe("formation");
    expect(r.classique.lignes).toEqual([
      { designation: "Module a", quantite: 1, prixUnitaireHtCents: 1003 },
      { designation: "Module b", quantite: 1, prixUnitaireHtCents: 1003 },
      { designation: "Module c", quantite: 1, prixUnitaireHtCents: 1003 },
      { designation: "Formation", quantite: 2.3, prixUnitaireHtCents: 12345 },
    ]);
    expect(JSON.stringify(r)).not.toContain("tauxTva");
    expect("offre" in r).toBe(false);
  });

  it("les lignes classiques emportent offreTierId quand la ligne en a un, jamais sinon", () => {
    const e = etatT4();
    const lignes = e.lignes.map((l, i) =>
      i === 0 ? { ...l, offreCode: "AXI-OFF-006", offreTierId: "intervention-dirigeants" } : l,
    );
    const r = versOffre({ ...e, lignes }, CTX);
    if (!r.ok || r.type !== "classique") throw new Error("classique attendu");
    expect(r.classique.lignes[0]).toMatchObject({
      offreCode: "AXI-OFF-006",
      offreTierId: "intervention-dirigeants",
    });
    expect(r.classique.lignes[1]).not.toHaveProperty("offreTierId");
    expect(r.classique.lignes[1]).not.toHaveProperty("offreCode");
  });

  it("un client particulier impose le prix unique même si A + B est demandé", () => {
    const e = reducteur(etatT3(), { type: "client", id: "c", clientType: "particulier" });
    expect(versOffre(e, CTX)).toMatchObject({ ok: true, type: "classique" });
  });

  it("un prix illisible est refusé avec message, jamais ramené à 0", () => {
    const e = etatT4();
    const lignes = e.lignes.map((l, i) => (i === 0 ? { ...l, prixEur: "2.400" } : l));
    const r = versOffre({ ...e, lignes }, CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/ligne 1.*prix/i);
  });

  it("financement OPCO : champs convertis en nombres et centimes", () => {
    const e = reducteur(etatT4(), {
      type: "champs",
      patch: {
        financement: {
          mode: "opco",
          modaliteOpco: "intra",
          nbParticipants: "8",
          dureeHeures: "14",
          enveloppeRestante: "5 000",
          dateDebutSession: "2026-12-01",
        },
      },
    });
    const r = versOffre(e, CTX);
    expect(r.ok && r.type === "classique" && r.classique).toMatchObject({
      financementSuggere: "opco",
      nbParticipants: 8,
      dureeHeures: 14,
      modaliteOpco: "intra",
      opcoEnveloppeRestanteCents: 500000,
      dateDebutSessionPrevue: "2026-12-01",
    });
  });
});

describe("offre héritée et aller-retour", () => {
  const AUTO = {
    code: "AUTO-1",
    libelle: "Option héritée",
    facultative: true,
    dependDe: [],
    prixHtCents: 150000,
    tauxTvaBps: 2000,
    modeIA: "client_direct" as const,
  };

  it("automatisations héritées recopiées telles quelles ; devis neuf = []", () => {
    const e = { ...etatT1(), automatisationsHeritees: [AUTO] };
    expect(formules(e).offre.automatisations).toEqual([AUTO]);
    expect(formules(etatT1()).offre.automatisations).toEqual([]);
  });

  it("offre → saisie → offre : même sha256Offre, avec automatisations héritées", () => {
    const e = { ...etatT3(), automatisationsHeritees: [AUTO] };
    const { offre } = formules(e);
    const retour = construireOffre(offreVersSaisie(offre), offre.textes);
    expect(retour.ok && sha256Offre(retour.offre)).toBe(sha256Offre(offre));
  });

  it("la vue moteur de l'offre produite est calculable (offre valide)", () => {
    expect(vueFormules(formules(etatT2()).offre).formules).toHaveLength(1);
  });
});
