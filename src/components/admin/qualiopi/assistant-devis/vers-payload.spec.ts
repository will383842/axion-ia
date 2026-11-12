import { describe, expect, it } from "vitest";

import { lirePayload } from "@/server/qualiopi/devis/assistant/payload";
import { payloadVersCreation } from "@/server/qualiopi/devis/assistant/conversion";
import { validerEtape } from "@/server/qualiopi/devis/assistant/validation-etapes";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";

import { reducteur } from "./etat";
import { etatT1, etatT2, etatT3, etatT4, etatT5, FIXTURES } from "./fixtures";
import { versOffre, versSaisie } from "./vers-offre";
import { etatVersPayload, payloadVersEtat } from "./vers-payload";
import type { Etape, EtatAssistant } from "./types";

const TVA = 20;
const CTX = { tvaStandardPct: TVA, textes: [] };
const SERVEUR = {
  formulesActives: true,
  typeClient: "entreprise" as const,
  maintenant: new Date("2026-11-08T10:00:00Z"),
  tauxStandard: TVA,
};
const NOMS = Object.keys(FIXTURES) as Array<keyof typeof FIXTURES>;

describe("aller-retour écran → payload → lirePayload → écran", () => {
  for (const nom of NOMS) {
    for (const etape of [1, "1b", 2, 3, 4] as Etape[]) {
      it(`${nom}, étape ${etape} : état identique, payload relisible`, () => {
        const etat = FIXTURES[nom]();
        const payload = etatVersPayload(etat, etape, CTX);
        const lu = lirePayload(JSON.parse(JSON.stringify(payload)));
        expect(lu.ok).toBe(true);
        if (!lu.ok) return;
        const retour = payloadVersEtat(lu.payload);
        expect(retour.source).toBe("ecran");
        expect(retour.etat).toStrictEqual(etat);
        expect(retour.etape).toBe(etape);
        // L'étape « 1b » (phases) est l'étape 1 du serveur.
        expect(lu.payload.etape).toBe(etape === "1b" ? 1 : etape);
      });
    }
  }

  it("le choix d'IA de l'écran survit malgré la garde « aucun montant d'IA » du serveur", () => {
    const e = reducteur(etatT1(), {
      type: "champs",
      patch: {
        ia: {
          achat: { mode: "incluse", moisInclus: "6" },
          abonnement: { mode: "incluse", niveau: "pro" },
        },
      },
    });
    const payload = etatVersPayload(e, 3, CTX);
    expect(payload.nonImprime["ia"]).toEqual({
      achat: { mode: "incluse", mois: 6 },
      abonnement: { inclus: true, niveau: "pro" },
    });
    expect(validerEtape(payload, 3, SERVEUR).erreurs).toEqual([]);
    expect(payloadVersEtat(payload).etat.ia).toStrictEqual(e.ia);
  });

  it("aucun montant d'IA ne passe : la garde du serveur voit toujours un montant ajouté à la main", () => {
    const payload = etatVersPayload(etatT1(), 3, CTX);
    (payload.nonImprime["ia"] as Record<string, unknown>)["forfait"] = 10;
    expect(validerEtape(payload, 3, SERVEUR).ok).toBe(false);
  });
});

describe("le serveur accepte ce que les écrans produisent", () => {
  for (const nom of NOMS) {
    it(`${nom} : validerEtape(4) sans erreur`, () => {
      const payload = etatVersPayload(FIXTURES[nom](), 4, CTX);
      expect(validerEtape(payload, 4, SERVEUR).erreurs).toEqual([]);
    });
  }

  it("fiche prix unique : type classique, aucune formule imprimée", () => {
    const p = etatVersPayload(etatT4(), 4, CTX);
    expect(p.typeDevis).toBe("classique");
    expect(p.activite).toBe("formation");
    expect(p.clientId).toBe("client-test");
  });
});

describe("mêmes centimes que le convertisseur des écrans (E04), cas T1 à T5", () => {
  for (const nom of NOMS) {
    it(`${nom}`, () => {
      const etat: EtatAssistant = FIXTURES[nom]();
      const ecran = versOffre(etat, CTX);
      const serveur = payloadVersCreation(etatVersPayload(etat, 4, CTX), SERVEUR);
      expect("erreurs" in serveur).toBe(false);
      if ("erreurs" in serveur || !ecran.ok) return;
      if (serveur.type === "classique") {
        expect(ecran.type).toBe("classique");
        if (ecran.type !== "classique") return;
        expect(serveur.input.lignes.map((l) => [l.quantite, l.prixUnitaireHtCents])).toEqual(
          ecran.classique.lignes.map((l) => [l.quantite, l.prixUnitaireHtCents]),
        );
        return;
      }
      expect(ecran.type).toBe("formules");
      if (ecran.type !== "formules") return;
      // Hors textes (le serveur y injecte le récit) : tout l'argent de l'offre est identique.
      const { textes: _t1, ...a } = serveur.input.offre;
      const { textes: _t2, ...b } = ecran.offre;
      expect(a).toEqual(b);
      expect(vueFormules(serveur.input.offre).formules.map((f) => f.totalHtCents)).toEqual(
        vueFormules(ecran.offre).formules.map((f) => f.totalHtCents),
      );
    });
  }

  it("valeurs de la table T1 : 448 393 HT, 89 679 TVA, versements 134 517 / 134 517 / 179 359", () => {
    const r = payloadVersCreation(etatVersPayload(etatT1(), 4, CTX), SERVEUR);
    if ("erreurs" in r || r.type !== "formules") throw new Error("conversion attendue");
    const f = vueFormules(r.input.offre).formules[0]!;
    expect([f.totalHtCents, f.totalTvaCents, f.totalTtcCents]).toEqual([448393, 89679, 538072]);
    expect(f.phases.map((p) => p.montantHtCents)).toEqual([134517, 134517, 179359]);
  });

  it("T3 puis T5 : A + B n'imprime pas les lignes dans B ; B seule les porte (bascule)", () => {
    const ab = payloadVersCreation(etatVersPayload(etatT3(), 4, CTX), SERVEUR);
    const b = payloadVersCreation(etatVersPayload(etatT5(), 4, CTX), SERVEUR);
    if ("erreurs" in ab || ab.type !== "formules") throw new Error("T3");
    if ("erreurs" in b || b.type !== "formules") throw new Error("T5");
    expect(ab.input.offre.abonnement?.miseEnServiceLignes.map((l) => l.prixHtCents)).toEqual([
      190000,
    ]);
    expect(vueFormules(b.input.offre).formules[0]!.totalHtCents).toBe(448393);
    // « 1 900 » reste dans le brouillon de la bascule (retour en A + B).
    expect(
      payloadVersEtat(etatVersPayload(etatT5(), 4, CTX)).etat.abonnement.miseEnServiceSaisie,
    ).toBe("1 900");
  });
});

describe("point argent : mois de maintenance offerts", () => {
  it("versSaisie les transmet au lieu de les forcer à 0", () => {
    const e = reducteur(etatT1(), {
      type: "achat",
      patch: { maintenance: { ...etatT1().achat.maintenance, moisOfferts: "3" } },
    });
    expect(versSaisie(e, TVA).saisie.achat.maintenance.moisOfferts).toBe("3");
  });

  it("de l'écran jusqu'à l'offre signée par le client : 3 mois offerts, vus par la vue imprimée", () => {
    const e = reducteur(etatT1(), {
      type: "achat",
      patch: { maintenance: { ...etatT1().achat.maintenance, moisOfferts: "3" } },
    });
    const payload = etatVersPayload(e, 4, CTX);
    expect(payload.formules.achat.maintenance.moisOfferts).toBe("3");
    const r = payloadVersCreation(payload, SERVEUR);
    if ("erreurs" in r || r.type !== "formules") throw new Error("conversion attendue");
    expect(r.input.offre.achat?.maintenance.moisOfferts).toBe(3);
    expect(vueFormules(r.input.offre).formules[0]!.maintenance?.moisOfferts).toBe(3);
  });

  it("T2 (B seule) n'a pas de maintenance : rien à transmettre", () => {
    const r = payloadVersCreation(etatVersPayload(etatT2(), 4, CTX), SERVEUR);
    if ("erreurs" in r || r.type !== "formules") throw new Error("conversion attendue");
    expect(r.input.offre.achat).toBeUndefined();
  });
});

describe("payloadVersEtat sans état d'écran", () => {
  it("rend un état vide avec le client et le projet du payload", () => {
    const p = etatVersPayload(etatT1(), 1, CTX);
    p.nonImprime = {};
    p.projetId = "projet-1";
    const r = payloadVersEtat(p, { validiteParDefaut: "2026-12-08", formulesActives: true });
    expect(r.source).toBe("payload");
    expect(r.etat.clientId).toBe("client-test");
    expect(r.etat.origine.projetId).toBe("projet-1");
    expect(r.etat.lignes).toHaveLength(1);
    expect(r.etat.lignes[0]!.prixEur).toBe("");
  });

  it("un état d'écran illisible retombe sur l'état vide plutôt que de lever", () => {
    const p = etatVersPayload(etatT1(), 1, CTX);
    p.nonImprime = { ecran: { v: 2 } };
    expect(payloadVersEtat(p).source).toBe("payload");
  });
});
