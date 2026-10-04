/**
 * Lot OPCO A8 — calendrier des relances, éligibilité de l'envoi, alertes « à
 * appeler ». Témoins : pas de relance le week-end ni à partir du début de la
 * session ; au plus une par jour ; « oui » (dépôt posé) fait passer aux
 * relances de réponse ; l'accord et le refus arrêtent tout ; alerte après
 * trois relances.
 */

import { describe, expect, it } from "vitest";
import {
  alertesSuivi,
  calendrierRelances,
  decalerJour,
  depotParEntreprise,
  eligibiliteEnvoi,
  estWeekEnd,
  prochaineRelance,
  prochaineRelancePrevue,
  type DossierPourEnvoi,
  type DossierPourRelance,
  type MessageLu,
  type SuiviLu,
} from "./planning";

/** Midi à Paris (10:00 UTC en été) : jamais d'ambiguïté de jour. */
const midi = (jour: string) => new Date(`${jour}T10:00:00.000Z`);
const date = (jour: string) => new Date(`${jour}T00:00:00.000Z`);

function dossier(p: Partial<DossierPourRelance> = {}): DossierPourRelance {
  return {
    statut: "a_monter",
    depotFaitLe: null,
    accordEcritLe: null,
    accordAt: null,
    envoyeAt: null,
    dateDebutSession: midi("2026-11-16"),
    dateLimiteDepot: null,
    ...p,
  };
}

function message(
  p: Partial<MessageLu> & Pick<MessageLu, "etape" | "rang" | "jourParis">,
): MessageLu {
  return {
    question: p.etape === "relance_reponse" ? "reponse" : "depot",
    envoyeLe: midi(p.jourParis),
    reponse: null,
    reponduLe: null,
    ...p,
  };
}

/** Envoi le jeudi 1er octobre 2026. */
function suivi(p: Partial<SuiviLu> = {}): SuiviLu {
  return {
    envoyeLe: midi("2026-10-01"),
    relancesArreteesLe: null,
    refusDeclareLe: null,
    messages: [message({ etape: "envoi", rang: 0, jourParis: "2026-10-01" })],
    ...p,
  };
}

describe("jours civils", () => {
  it("décale et reconnaît le week-end", () => {
    expect(decalerJour("2026-10-01", 3)).toBe("2026-10-04");
    expect(decalerJour("2026-10-01", -1)).toBe("2026-09-30");
    expect(estWeekEnd("2026-10-03")).toBe(true); // samedi
    expect(estWeekEnd("2026-10-04")).toBe(true); // dimanche
    expect(estWeekEnd("2026-10-05")).toBe(false); // lundi
  });
});

describe("qui dépose", () => {
  it("Atlas : constaté par le référentiel ; Afdas : non constaté", () => {
    expect(depotParEntreprise("atlas")).toBe("constate");
    expect(depotParEntreprise("opco2i")).toBe("constate");
    expect(depotParEntreprise("afdas")).toBe("non_constate");
  });
});

describe("éligibilité de l'envoi", () => {
  const base: DossierPourEnvoi = {
    type: "opco",
    statut: "a_monter",
    depotFaitLe: null,
    accordEcritLe: null,
    opco: "atlas",
    conventionSignee: true,
    contactEmail: "rh@exemple.fr",
    dateDebutSession: midi("2026-11-16"),
    dejaEnvoye: false,
  };
  const now = midi("2026-10-05");

  it("dossier prêt : envoi automatique possible", () => {
    expect(eligibiliteEnvoi(base, "auto", now)).toEqual({ ok: true });
  });

  it("convention non signée → pas d'envoi", () => {
    const r = eligibiliteEnvoi({ ...base, conventionSignee: false }, "auto", now);
    expect(r).toMatchObject({ ok: false, motif: "convention" });
  });

  it("aucun e-mail de contact → pas d'envoi", () => {
    expect(eligibiliteEnvoi({ ...base, contactEmail: null }, "manuel", now)).toMatchObject({
      ok: false,
      motif: "contact",
    });
  });

  it("envoi automatique UNIQUE : un dossier déjà envoyé n'est pas renvoyé tout seul", () => {
    expect(eligibiliteEnvoi({ ...base, dejaEnvoye: true }, "auto", now)).toMatchObject({
      ok: false,
      motif: "deja_envoye",
    });
    // Le bouton de la console, lui, peut renvoyer.
    expect(eligibiliteEnvoi({ ...base, dejaEnvoye: true }, "manuel", now)).toEqual({ ok: true });
  });

  it("OPCO dont le mode de dépôt n'est pas constaté : console seulement", () => {
    expect(eligibiliteEnvoi({ ...base, opco: "afdas" }, "auto", now)).toMatchObject({
      ok: false,
      motif: "depot_non_constate",
    });
    expect(eligibiliteEnvoi({ ...base, opco: "afdas" }, "manuel", now)).toEqual({ ok: true });
  });

  it("financement non OPCO, dossier clos, accord déjà là → refus", () => {
    expect(eligibiliteEnvoi({ ...base, type: "cpf" }, "manuel", now).ok).toBe(false);
    expect(eligibiliteEnvoi({ ...base, statut: "clos" }, "manuel", now).ok).toBe(false);
    expect(eligibiliteEnvoi({ ...base, statut: "accord_recu" }, "manuel", now).ok).toBe(false);
    expect(eligibiliteEnvoi({ ...base, type: "mixte" }, "auto", now)).toEqual({ ok: true });
  });

  it("session commencée → pas d'envoi automatique", () => {
    expect(eligibiliteEnvoi(base, "auto", midi("2026-11-16"))).toMatchObject({
      ok: false,
      motif: "session_commencee",
    });
  });
});

describe("relances de dépôt", () => {
  it("J+3, J+7, J+12 après l'envoi, puis J-5 de la date limite", () => {
    const cal = calendrierRelances(dossier({ dateLimiteDepot: midi("2026-11-10") }), suivi());
    expect(cal.map((c) => `${c.rang}@${c.jour}`)).toEqual([
      "1@2026-10-04",
      "2@2026-10-08",
      "3@2026-10-13",
      "4@2026-11-05",
    ]);
  });

  it("🔴 jamais le week-end : J+3 tombe un dimanche, rien ne part ; lundi, elle part", () => {
    expect(prochaineRelance(dossier(), suivi(), midi("2026-10-04"))).toBeNull();
    expect(prochaineRelance(dossier(), suivi(), midi("2026-10-05"))).toMatchObject({
      etape: "relance_depot",
      rang: 1,
    });
  });

  it("🔴 au plus une par jour : un e-mail déjà parti aujourd'hui bloque la relance", () => {
    const s = suivi({
      messages: [
        message({ etape: "envoi", rang: 0, jourParis: "2026-10-01" }),
        message({ etape: "relance_depot", rang: 1, jourParis: "2026-10-08" }),
      ],
    });
    expect(prochaineRelance(dossier(), s, midi("2026-10-08"))).toBeNull();
    // Le lendemain, la relance 2 (due le 08) part — une seule.
    expect(prochaineRelance(dossier(), s, midi("2026-10-09"))).toMatchObject({ rang: 2 });
  });

  it("rattrapage un jour après l'autre, jamais en rafale", () => {
    // Worker arrêté dix jours : la relance 1 part d'abord, seule.
    expect(prochaineRelance(dossier(), suivi(), midi("2026-10-14"))).toMatchObject({ rang: 1 });
  });

  it("🔴 jamais à partir du début de la session", () => {
    const d = dossier({ dateDebutSession: midi("2026-10-07") });
    // J+7 (08/10) et J+12 tombent après le début : seule J+3 existe.
    expect(calendrierRelances(d, suivi()).map((c) => c.rang)).toEqual([1]);
    const s = suivi({
      messages: [
        message({ etape: "envoi", rang: 0, jourParis: "2026-10-01" }),
        message({ etape: "relance_depot", rang: 1, jourParis: "2026-10-05" }),
      ],
    });
    expect(prochaineRelance(d, s, midi("2026-10-07"))).toBeNull();
    expect(prochaineRelance(d, s, midi("2026-10-09"))).toBeNull();
  });

  it("« oui, c'est déposé » (date posée) arrête les relances de dépôt et ouvre celles de réponse", () => {
    const d = dossier({ depotFaitLe: date("2026-10-06") });
    expect(prochaineRelance(d, suivi(), midi("2026-10-08"))).toBeNull();
    expect(calendrierRelances(d, suivi()).map((c) => `${c.etape}:${c.jour}`)).toEqual([
      "relance_reponse:2026-10-16",
      "relance_reponse:2026-10-26",
      "relance_reponse:2026-11-05",
    ]);
    expect(prochaineRelance(d, suivi(), midi("2026-10-16"))).toMatchObject({
      etape: "relance_reponse",
      rang: 1,
    });
  });

  it("arrêt console, refus, accord : plus aucune relance", () => {
    const now = midi("2026-10-05");
    expect(
      prochaineRelance(dossier(), suivi({ relancesArreteesLe: midi("2026-10-02") }), now),
    ).toBeNull();
    expect(
      prochaineRelance(dossier(), suivi({ refusDeclareLe: midi("2026-10-02") }), now),
    ).toBeNull();
    expect(prochaineRelance(dossier({ statut: "accord_recu" }), suivi(), now)).toBeNull();
    expect(
      prochaineRelance(dossier({ accordEcritLe: date("2026-10-02") }), suivi(), now),
    ).toBeNull();
  });

  it("prochaine relance prévue : jamais un samedi ni un dimanche", () => {
    expect(prochaineRelancePrevue(dossier(), suivi(), midi("2026-10-02"))).toMatchObject({
      rang: 1,
      jour: "2026-10-05",
    });
  });
});

describe("alertes « à appeler »", () => {
  const trois = suivi({
    messages: [
      message({ etape: "envoi", rang: 0, jourParis: "2026-10-01" }),
      message({ etape: "relance_depot", rang: 1, jourParis: "2026-10-05" }),
      message({ etape: "relance_depot", rang: 2, jourParis: "2026-10-08" }),
      message({ etape: "relance_depot", rang: 3, jourParis: "2026-10-13", reponse: "pas_encore" }),
    ],
  });

  it("🔴 trois relances de dépôt sans « oui » → appeler l'entreprise", () => {
    expect(alertesSuivi(dossier(), trois, midi("2026-10-14")).map((a) => a.code)).toEqual([
      "entreprise_a_appeler_depot",
    ]);
  });

  it("deux relances seulement → rien ; J-3 de la date limite → appeler", () => {
    expect(alertesSuivi(dossier(), suivi(), midi("2026-10-05"))).toEqual([]);
    const d = dossier({ dateLimiteDepot: midi("2026-10-09") });
    expect(alertesSuivi(d, suivi(), midi("2026-10-06")).map((a) => a.code)).toEqual([
      "entreprise_a_appeler_depot",
    ]);
  });

  it("dépôt fait : se referme ; la réponse attendue alerte à 10 jours du début", () => {
    const d = dossier({ depotFaitLe: date("2026-10-06") });
    expect(alertesSuivi(d, trois, midi("2026-10-14"))).toEqual([]);
    expect(alertesSuivi(d, trois, midi("2026-11-06")).map((a) => a.code)).toEqual([
      "entreprise_a_appeler_reponse_opco",
    ]);
    expect(alertesSuivi({ ...d, statut: "accord_recu" }, trois, midi("2026-11-06"))).toEqual([]);
  });

  it("refus déclaré → à traiter, jusqu'à la clôture ou au renvoi du dossier", () => {
    const s = suivi({ refusDeclareLe: midi("2026-10-10") });
    const d = dossier({ statut: "refuse", depotFaitLe: date("2026-10-06") });
    expect(alertesSuivi(d, s, midi("2026-10-12")).map((a) => a.code)).toEqual([
      "opco_refus_a_traiter",
    ]);
    expect(alertesSuivi({ ...d, statut: "clos" }, s, midi("2026-10-12"))).toEqual([]);
    expect(
      alertesSuivi({ ...d, statut: "envoye", envoyeAt: midi("2026-10-11") }, s, midi("2026-10-12")),
    ).toEqual([]);
  });

  it("relances arrêtées par l'admin : plus d'alerte « à appeler »", () => {
    const s = { ...trois, relancesArreteesLe: midi("2026-10-14") };
    expect(alertesSuivi(dossier(), s, midi("2026-10-15"))).toEqual([]);
  });
});
