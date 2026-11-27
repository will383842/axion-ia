import { describe, expect, it } from "vitest";
import {
  DELAI_RELANCE_MIN_JOURS,
  DELAI_SANS_REPONSE_JOURS,
  PLAFOND_BROUILLONS_PRETS,
  STATUTS,
  peutRelancer,
  sansReponseDue,
  verifierTransition,
} from "../statuts";

const humain = { acteur: "humain" } as const;
const JOUR = 86_400_000;

describe("verifierTransition : chemin nominal", () => {
  const chemin = [
    "idee",
    "a_qualifier",
    "qualifiee",
    "brouillon_pret",
    "brouillon_valide",
    "contacte_par_will",
    "reponse",
  ] as const;
  it("autorise chaque pas du chemin, par un humain", () => {
    for (let i = 0; i < chemin.length - 1; i++) {
      expect(verifierTransition(chemin[i]!, chemin[i + 1]!, humain)).toEqual({ ok: true });
    }
  });
  it("autorise reponse vers lien_obtenu (avec lien présent), refus, sans_reponse", () => {
    expect(verifierTransition("reponse", "lien_obtenu", { ...humain, lienPresent: true }).ok).toBe(
      true,
    );
    expect(verifierTransition("reponse", "refus", humain).ok).toBe(true);
    expect(verifierTransition("reponse", "sans_reponse", humain).ok).toBe(true);
  });
});

describe("verifierTransition : interdits", () => {
  it("refuse de sauter des étapes (brouillon_pret vers lien_obtenu)", () => {
    const r = verifierTransition("brouillon_pret", "lien_obtenu", { ...humain, lienPresent: true });
    expect(r.ok).toBe(false);
  });
  it("lien_obtenu exige un lien rattaché et présent", () => {
    expect(verifierTransition("reponse", "lien_obtenu", humain).ok).toBe(false);
    expect(verifierTransition("reponse", "lien_obtenu", { ...humain, lienPresent: false }).ok).toBe(
      false,
    );
    expect(
      verifierTransition("contacte_par_will", "lien_obtenu", { ...humain, lienPresent: true }).ok,
    ).toBe(true);
  });
  it("le système ne passe jamais brouillon_valide à contacte_par_will", () => {
    const r = verifierTransition("brouillon_valide", "contacte_par_will", { acteur: "systeme" });
    expect(r.ok).toBe(false);
  });
  it("le système ne fait avancer aucune idée au-delà de « idee »", () => {
    expect(verifierTransition("idee", "a_qualifier", { acteur: "systeme" }).ok).toBe(false);
    expect(verifierTransition("qualifiee", "brouillon_pret", { acteur: "systeme" }).ok).toBe(false);
  });
  it("refuse une transition vers soi-même et un statut inconnu", () => {
    expect(verifierTransition("idee", "idee", humain).ok).toBe(false);
    // @ts-expect-error statut volontairement invalide
    expect(verifierTransition("idee", "envoye", humain).ok).toBe(false);
  });
  it("les statuts terminaux ne repartent pas", () => {
    for (const t of ["lien_obtenu", "refus", "sans_reponse"] as const) {
      expect(verifierTransition(t, "a_qualifier", humain).ok).toBe(false);
    }
  });
  it("aucun statut « envoye » n'existe", () => {
    expect(STATUTS).not.toContain("envoye");
  });
});

describe("verifierTransition : file de brouillons prêts", () => {
  it("refuse un 11e brouillon prêt", () => {
    expect(PLAFOND_BROUILLONS_PRETS).toBe(10);
    expect(
      verifierTransition("qualifiee", "brouillon_pret", { ...humain, nbBrouillonsPrets: 10 }).ok,
    ).toBe(false);
    expect(
      verifierTransition("qualifiee", "brouillon_pret", { ...humain, nbBrouillonsPrets: 9 }).ok,
    ).toBe(true);
  });
});

describe("écarter et opposition", () => {
  it("ecartee et en_opposition sont possibles à tout moment, y compris par le système pour l'opposition", () => {
    for (const s of STATUTS) {
      if (s === "ecartee" || s === "en_opposition") continue;
      expect(verifierTransition(s, "ecartee", humain).ok).toBe(
        !["lien_obtenu", "refus", "sans_reponse"].includes(s),
      );
      expect(verifierTransition(s, "en_opposition", humain).ok).toBe(true);
      expect(verifierTransition(s, "en_opposition", { acteur: "systeme" }).ok).toBe(true);
    }
  });
  it("le système n'écarte pas", () => {
    expect(verifierTransition("idee", "ecartee", { acteur: "systeme" }).ok).toBe(false);
  });
  it("en_opposition est définitif ; ecartee peut être rouvert par un humain", () => {
    expect(verifierTransition("en_opposition", "a_qualifier", humain).ok).toBe(false);
    expect(verifierTransition("en_opposition", "ecartee", humain).ok).toBe(false);
    expect(verifierTransition("ecartee", "a_qualifier", humain).ok).toBe(true);
    expect(verifierTransition("ecartee", "a_qualifier", { acteur: "systeme" }).ok).toBe(false);
  });
});

describe("sans_reponse automatique et relance", () => {
  const contacte = new Date("2026-01-01T00:00:00Z");
  it("sans_reponse est dû 45 jours après le contact, pas avant", () => {
    expect(DELAI_SANS_REPONSE_JOURS).toBe(45);
    expect(sansReponseDue(contacte, new Date(contacte.getTime() + 44 * JOUR))).toBe(false);
    expect(sansReponseDue(contacte, new Date(contacte.getTime() + 45 * JOUR))).toBe(true);
  });
  it("le système peut poser sans_reponse depuis contacte_par_will seulement après 45 jours", () => {
    const tot = {
      acteur: "systeme",
      dernierContactLe: contacte,
      maintenant: new Date(contacte.getTime() + 10 * JOUR),
    } as const;
    const tard = { ...tot, maintenant: new Date(contacte.getTime() + 46 * JOUR) } as const;
    expect(verifierTransition("contacte_par_will", "sans_reponse", tot).ok).toBe(false);
    expect(verifierTransition("contacte_par_will", "sans_reponse", tard).ok).toBe(true);
  });
  it("aucune relance avant 30 jours, et une seule", () => {
    expect(DELAI_RELANCE_MIN_JOURS).toBe(30);
    const ap = (j: number) => new Date(contacte.getTime() + j * JOUR);
    expect(
      peutRelancer({
        statut: "contacte_par_will",
        dernierContactLe: contacte,
        nbRelances: 0,
        maintenant: ap(29),
      }),
    ).toBe(false);
    expect(
      peutRelancer({
        statut: "contacte_par_will",
        dernierContactLe: contacte,
        nbRelances: 0,
        maintenant: ap(30),
      }),
    ).toBe(true);
    expect(
      peutRelancer({
        statut: "contacte_par_will",
        dernierContactLe: contacte,
        nbRelances: 1,
        maintenant: ap(60),
      }),
    ).toBe(false);
    expect(
      peutRelancer({
        statut: "contacte_par_will",
        dernierContactLe: null,
        nbRelances: 0,
        maintenant: ap(60),
      }),
    ).toBe(false);
  });
});

describe("durcissements", () => {
  it("la relance exige le statut contacte_par_will", () => {
    const base = {
      dernierContactLe: new Date("2026-01-01T00:00:00Z"),
      nbRelances: 0,
      maintenant: new Date("2026-06-01T00:00:00Z"),
    };
    expect(peutRelancer({ ...base, statut: "contacte_par_will" })).toBe(true);
    for (const statut of ["en_opposition", "refus", "lien_obtenu", "ecartee"] as const) {
      expect(peutRelancer({ ...base, statut })).toBe(false);
    }
  });
  it("un statut final ne se rouvre pas par « écartée » ; une réponse tardive est possible", () => {
    for (const s of ["lien_obtenu", "refus", "sans_reponse"] as const) {
      expect(verifierTransition(s, "ecartee", humain).ok).toBe(false);
    }
    expect(verifierTransition("sans_reponse", "reponse", humain).ok).toBe(true);
  });
});
