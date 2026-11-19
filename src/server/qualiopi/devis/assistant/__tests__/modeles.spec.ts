import { describe, expect, it } from "vitest";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import { payloadVide } from "../payload";
import {
  appliquerModele,
  appliquerModelePhases,
  MODELES_DEVIS,
  MODELES_ECHEANCIER,
  MODELES_PHASES,
  type IdModeleDevis,
} from "../modeles";

const CHAMPS_PRIX = /prixEur|mensuelEur|mensuelCatalogueEur|hebergementMensuelEur/;

function prix(v: unknown, chemin = "", out: Array<[string, unknown]> = []) {
  if (Array.isArray(v)) v.forEach((x, i) => prix(x, `${chemin}.${i}`, out));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (CHAMPS_PRIX.test(k)) out.push([`${chemin}.${k}`, x]);
      else prix(x, `${chemin}.${k}`, out);
    }
  return out;
}

describe("modèles de devis", () => {
  it("aucun montant non vide après application de chaque modèle sur un devis vide", () => {
    for (const m of MODELES_DEVIS) {
      const trouves = prix(appliquerModele(payloadVide(20), m.id));
      expect(trouves.length).toBeGreaterThan(0);
      for (const [chemin, v] of trouves) expect(v, `${m.id} ${chemin}`).toBe("");
    }
  });

  it("aucun modèle ne contient de chiffre monétaire (euros, centimes, €)", () => {
    const texte = JSON.stringify([MODELES_DEVIS, MODELES_PHASES, MODELES_ECHEANCIER]);
    expect(texte).not.toMatch(/€|euro|cents|\d\s?%/i);
  });

  it("types : IA et site web → formules ; les trois autres → classique", () => {
    const type = Object.fromEntries(MODELES_DEVIS.map((m) => [m.id, m.typeDevis]));
    expect(type).toEqual({
      formation: "classique",
      coaching: "classique",
      audit: "classique",
      mise_en_place_ia: "formules",
      site_web: "formules",
    });
    const p = appliquerModele(payloadVide(20), "site_web");
    expect([p.typeDevis, p.activite, p.modeleId]).toEqual(["formules", "site_web", "site_web"]);
  });

  it("ne remplace pas un prix déjà saisi (lignes, maintenance, mensuel B)", () => {
    for (const m of MODELES_DEVIS) {
      const p = payloadVide(20);
      p.lignesClassiques[0]!.prixEur = "1 900";
      p.formules.achat.lignes[0]!.prixEur = "2 400";
      p.formules.achat.maintenance.mensuelEur = "190";
      p.formules.abonnement.mensuelCatalogueEur = "199,99";
      const apres = appliquerModele(p, m.id);
      expect(prix(apres)).toEqual(prix(p));
    }
  });

  it("taux = TAUX_TVA_STANDARD, jamais 0, même si l'entrée portait un autre taux", () => {
    const p = payloadVide(0);
    const apres = appliquerModele(p, "mise_en_place_ia");
    const taux = [
      ...apres.formules.achat.lignes.map((l) => l.tauxTvaPct),
      ...apres.formules.abonnement.lignes.map((l) => l.tauxTvaPct),
      apres.formules.abonnement.tauxTvaPct,
    ];
    expect(taux.length).toBeGreaterThan(0);
    for (const t of taux) expect(t).toBe(String(TAUX_TVA_STANDARD));
  });

  it("ne modifie pas son entrée (copie)", () => {
    const p = payloadVide(20);
    const avant = JSON.stringify(p);
    appliquerModele(p, "audit");
    appliquerModelePhases(p, "achat", "court");
    expect(JSON.stringify(p)).toBe(avant);
  });

  it("identifiant inconnu : payload inchangé", () => {
    const p = payloadVide(20);
    expect(appliquerModele(p, "inconnu" as IdModeleDevis)).toBe(p);
    expect(appliquerModelePhases(p, "achat", "inconnu")).toBe(p);
  });
});

describe("modèles de phases et d'échéancier", () => {
  const somme = (t: Array<string | number>) => t.reduce<number>((s, x) => s + Number(x), 0);

  it("toutes les sommes valent 100", () => {
    for (const m of MODELES_PHASES)
      expect(somme(m.phases.map((x) => x.pourcentage)), m.id).toBe(100);
    for (const m of MODELES_ECHEANCIER)
      expect(somme(m.phases.map((x) => x.pourcentage)), m.id).toBe(100);
  });

  it("répartitions attendues : 20/20/20/15/15/10, 30/40/30, 50/50, 30/30/40", () => {
    const pct = (id: string) =>
      MODELES_PHASES.find((m) => m.id === id)!.phases.map((x) => x.pourcentage);
    expect(pct("complet")).toEqual([20, 20, 20, 15, 15, 10]);
    expect(pct("court")).toEqual([30, 40, 30]);
    const e = (id: string) =>
      MODELES_ECHEANCIER.find((m) => m.id === id)!.phases.map((x) => x.pourcentage);
    expect(e("moitie")).toEqual(["50", "50"]);
    expect(e("trois")).toEqual(["30", "30", "40"]);
  });

  it("appliquerModelePhases remplace les phases de la formule choisie seulement", () => {
    const p = appliquerModelePhases(payloadVide(20), "abonnement", "complet");
    expect(p.formules.abonnement.phases.map((x) => x.pourcentage)).toEqual([
      "20",
      "20",
      "20",
      "15",
      "15",
      "10",
    ]);
    expect(p.formules.abonnement.phases.map((x) => x.declencheur)).toEqual([
      "signature",
      "avancement",
      "avancement",
      "avancement",
      "avancement",
      "livraison",
    ]);
    expect(p.formules.achat.phases).toEqual(payloadVide(20).formules.achat.phases);
  });

  it("« libre » seul désigne les phases ; « echeancier:libre » l'échéancier ; « trois » (sans ambiguïté) marche seul", () => {
    const seul = MODELES_PHASES.find((m) => m.id === "libre")!.phases;
    const a = appliquerModelePhases(payloadVide(20), "achat", "libre");
    expect(a.formules.achat.phases[0]!.libelle).toBe(seul[0]!.libelle);
    const l = appliquerModelePhases(payloadVide(20), "achat", "echeancier:libre");
    expect(l.formules.achat.phases[0]!.declencheur).toBe("signature");
    const b = appliquerModelePhases(payloadVide(20), "achat", "trois");
    expect(b.formules.achat.phases.map((x) => x.pourcentage)).toEqual(["30", "30", "40"]);
  });

  it("aucun modèle de phases n'invente de durée ni de livrable", () => {
    for (const m of MODELES_PHASES)
      for (const ph of m.phases) expect([ph.livrable, ph.semaines]).toEqual(["", 0]);
  });
});
