/**
 * Changement d'IBAN d'un apporteur : règles pures (plan §2.2, §4.2, §11 lot 1). Toutes les bornes.
 */
import { describe, expect, it } from "vitest";
import {
  ALERTE_ECHEANCE_JOURS,
  DELAI_ALERTE_SANS_DECISION_MS,
  DELAI_CONFIRMATION_MS,
  DELAI_OPPOSITION_MS,
  LIMITES_DE_DEBIT,
  STATUTS_CHANGEMENT_IBAN,
  TRANSITIONS_CHANGEMENT_IBAN,
  choixDuCompteDemande,
  compteMasque,
  confirmationExpiree,
  seuilExpiration,
  decisionEnRetard,
  delaiOppositionEcoule,
  demandePermiseSurLaFenetre,
  echeanceConfirmation,
  estOuverte,
  gelActif,
  masquerAdresse,
  numeroRecemmentModifie,
  quatreDerniersCaracteres,
  transitionPermise,
  validationPermiseA,
  type StatutChangementIban,
} from "../changement-iban-regles";

const T0 = new Date("2026-11-25T10:00:00.000Z");
const apres = (base: Date, ms: number) => new Date(base.getTime() + ms);
const HEURE = 3_600_000;
const JOUR = 24 * HEURE;

describe("les délais sont ceux du plan", () => {
  it("24 h, 72 h, 10 jours, J-5", () => {
    expect(DELAI_CONFIRMATION_MS).toBe(24 * HEURE);
    expect(DELAI_OPPOSITION_MS).toBe(72 * HEURE);
    expect(DELAI_ALERTE_SANS_DECISION_MS).toBe(10 * JOUR);
    expect(ALERTE_ECHEANCE_JOURS).toBe(5);
  });
});

describe("transitions", () => {
  it("autorise exactement celles du plan", () => {
    const permises: Array<[StatutChangementIban, StatutChangementIban]> = [
      ["a_confirmer", "confirmee"],
      ["a_confirmer", "opposee"],
      ["a_confirmer", "annulee"],
      ["a_confirmer", "expiree"],
      ["confirmee", "validee"],
      ["confirmee", "refusee"],
      ["confirmee", "opposee"],
      ["confirmee", "annulee"],
    ];
    for (const de of STATUTS_CHANGEMENT_IBAN) {
      for (const vers of STATUTS_CHANGEMENT_IBAN) {
        const attendu = permises.some(([a, b]) => a === de && b === vers);
        expect(transitionPermise(de, vers), `${de} -> ${vers}`).toBe(attendu);
      }
    }
  });

  it("on ne valide jamais sans avoir confirmé, et un état final ne bouge plus", () => {
    expect(transitionPermise("a_confirmer", "validee")).toBe(false);
    expect(transitionPermise("a_confirmer", "refusee")).toBe(false);
    for (const final of ["validee", "refusee", "opposee", "annulee", "expiree"] as const) {
      expect(TRANSITIONS_CHANGEMENT_IBAN[final]).toEqual([]);
    }
  });

  it("seules a_confirmer et confirmee sont ouvertes", () => {
    expect(STATUTS_CHANGEMENT_IBAN.filter(estOuverte)).toEqual(["a_confirmer", "confirmee"]);
  });
});

describe("expiration de la confirmation", () => {
  const demande = { statut: "a_confirmer" as const, demandeeAt: T0 };
  it("vit à 24 h pile, expirée une milliseconde après", () => {
    expect(confirmationExpiree(demande, apres(T0, DELAI_CONFIRMATION_MS - 1))).toBe(false);
    expect(confirmationExpiree(demande, apres(T0, DELAI_CONFIRMATION_MS))).toBe(false);
    expect(confirmationExpiree(demande, apres(T0, DELAI_CONFIRMATION_MS + 1))).toBe(true);
  });
  it("une demande confirmée n'expire jamais seule", () => {
    expect(
      confirmationExpiree({ statut: "confirmee", demandeeAt: T0 }, apres(T0, 400 * JOUR)),
    ).toBe(false);
  });
  it("le seuil de l'écriture conditionnelle est la même borne, strictement", () => {
    const maintenant = apres(T0, DELAI_CONFIRMATION_MS);
    expect(seuilExpiration(maintenant).getTime()).toBe(T0.getTime());
    // `demandee_at < seuil` : à 24 h pile la demande vit encore, une milliseconde avant le seuil elle est expirée.
    expect(T0.getTime() < seuilExpiration(maintenant).getTime()).toBe(false);
    expect(apres(T0, -1).getTime() < seuilExpiration(maintenant).getTime()).toBe(true);
  });
  it("l'échéance du lien est la même borne", () => {
    expect(echeanceConfirmation(T0).getTime()).toBe(T0.getTime() + DELAI_CONFIRMATION_MS);
  });
});

describe("délai d'opposition de 72 heures", () => {
  it("refusé à 71 h 59 min 59,999 s, permis à 72 h pile", () => {
    expect(delaiOppositionEcoule(T0, apres(T0, DELAI_OPPOSITION_MS - 1))).toBe(false);
    expect(delaiOppositionEcoule(T0, apres(T0, 71 * HEURE + 59 * 60_000))).toBe(false);
    expect(delaiOppositionEcoule(T0, apres(T0, DELAI_OPPOSITION_MS))).toBe(true);
  });
  it("le premier instant permis est calculé", () => {
    expect(validationPermiseA(T0).toISOString()).toBe("2026-11-28T10:00:00.000Z");
  });
});

describe("gel des virements", () => {
  it("gelé pendant a_confirmer (non expirée) et confirmee, levé sinon", () => {
    expect(gelActif({ statut: "a_confirmer", demandeeAt: T0 }, apres(T0, HEURE))).toBe(true);
    expect(gelActif({ statut: "confirmee", demandeeAt: T0 }, apres(T0, 30 * JOUR))).toBe(true);
    for (const s of ["validee", "refusee", "opposee", "annulee", "expiree"] as const) {
      expect(gelActif({ statut: s, demandeeAt: T0 }, apres(T0, HEURE)), s).toBe(false);
    }
    expect(gelActif(null, T0)).toBe(false);
  });
  it("une demande non confirmée de plus de 24 h ne gèle plus, même avant l'écriture « expiree »", () => {
    expect(
      gelActif({ statut: "a_confirmer", demandeeAt: T0 }, apres(T0, DELAI_CONFIRMATION_MS + 1)),
    ).toBe(false);
  });
});

describe("décision en retard (10 jours)", () => {
  it("à 10 jours moins une milliseconde : non ; à 10 jours : oui", () => {
    const d = { statut: "confirmee" as const, confirmeeAt: T0 };
    expect(decisionEnRetard(d, apres(T0, DELAI_ALERTE_SANS_DECISION_MS - 1))).toBe(false);
    expect(decisionEnRetard(d, apres(T0, DELAI_ALERTE_SANS_DECISION_MS))).toBe(true);
  });
  it("ne vise que « confirmée »", () => {
    expect(decisionEnRetard({ statut: "validee", confirmeeAt: T0 }, apres(T0, 99 * JOUR))).toBe(
      false,
    );
    expect(decisionEnRetard({ statut: "confirmee", confirmeeAt: null }, apres(T0, 99 * JOUR))).toBe(
      false,
    );
  });
});

describe("trois demandes au plus sur 30 jours", () => {
  const jours = (n: number) => apres(T0, -n * JOUR);
  it("deux demandes récentes : permis ; trois : refusé", () => {
    expect(demandePermiseSurLaFenetre([jours(1), jours(2)], T0)).toBe(true);
    expect(demandePermiseSurLaFenetre([jours(1), jours(2), jours(3)], T0)).toBe(false);
  });
  it("une demande de plus de 30 jours ne compte plus (strictement)", () => {
    expect(demandePermiseSurLaFenetre([jours(1), jours(2), jours(30)], T0)).toBe(true);
    expect(demandePermiseSurLaFenetre([jours(1), jours(2), apres(jours(30), 1)], T0)).toBe(false);
  });
  it("aucune demande : permis", () => {
    expect(demandePermiseSurLaFenetre([], T0)).toBe(true);
  });
});

describe("choix du compte après validation (10 jours)", () => {
  it("demandé pendant 10 jours, jamais sans validation", () => {
    expect(choixDuCompteDemande(null, T0)).toBe(false);
    expect(choixDuCompteDemande(T0, apres(T0, 10 * JOUR - 1))).toBe(true);
    expect(choixDuCompteDemande(T0, apres(T0, 10 * JOUR))).toBe(false);
  });
});

describe("limites de débit (plan §2.2, point 9)", () => {
  it("les chiffres du plan", () => {
    expect(LIMITES_DE_DEBIT.demandeParIp).toMatchObject({ essais: 5, fenetreSecondes: 3600 });
    expect(LIMITES_DE_DEBIT.demandeParApporteur).toMatchObject({
      essais: 3,
      fenetreSecondes: 86_400,
    });
    expect(LIMITES_DE_DEBIT.confirmerParIp).toMatchObject({ essais: 10, fenetreSecondes: 900 });
    expect(LIMITES_DE_DEBIT.bloquerParIp).toMatchObject({ essais: 10, fenetreSecondes: 900 });
    expect(LIMITES_DE_DEBIT.bloquerParDemande).toMatchObject({
      essais: 5,
      fenetreSecondes: 86_400,
    });
    expect(LIMITES_DE_DEBIT.annulerParIp).toMatchObject({ essais: 10, fenetreSecondes: 900 });
  });
  it("aucune clé ne porte d'adresse IP brute : seulement le gabarit `<ip>` (hachée à l'appel)", () => {
    for (const l of Object.values(LIMITES_DE_DEBIT))
      expect(l.cle).toMatch(/^apporteur:iban:[a-z]+:(ip|demande|apporteur):<(ip|id)>$/);
  });
});

describe("masques : jamais plus que la fin du compte", () => {
  // IBAN fictif de forme valide, jamais réel : écrit ICI seulement, jamais rendu.
  const IBAN_FICTIF = "FR76 3000 6000 0112 3456 7890 189";
  it("quatre derniers caractères de l'IBAN normalisé", () => {
    expect(quatreDerniersCaracteres(IBAN_FICTIF)).toBe("0189");
    expect(quatreDerniersCaracteres(IBAN_FICTIF.toLowerCase())).toBe("0189");
  });
  it("trop court pour être un IBAN : rien", () => {
    expect(quatreDerniersCaracteres("FR76")).toBeNull();
    expect(quatreDerniersCaracteres("")).toBeNull();
  });
  it("une fin qui n'a pas la forme exigée par la base (« - », « . ») : rien, pas une erreur 500", () => {
    expect(quatreDerniersCaracteres("FR76-3000-6000-0112-3456-7890-01.9")).toBeNull();
    expect(quatreDerniersCaracteres("FR7630006000011234567890-89")).toBeNull();
  });
  it("« se termine par … » ne contient que ces quatre caractères", () => {
    const rendu = compteMasque(quatreDerniersCaracteres(IBAN_FICTIF));
    expect(rendu).toBe("se termine par 0189");
    expect(rendu).not.toContain("FR76");
    expect(compteMasque(null)).toBe("compte non renseigné");
    expect(compteMasque("FR76 3000")).toBe("compte non renseigné");
  });
  it("adresse masquée", () => {
    expect(masquerAdresse("jeanne.martin@exemple.fr")).toBe("j•••@exemple.fr");
    expect(masquerAdresse("")).toBe("•••");
    expect(masquerAdresse("sans-arobase")).toBe("•••");
  });
  it("numéro modifié depuis moins de 30 jours", () => {
    expect(numeroRecemmentModifie(null, T0)).toBe(false);
    expect(numeroRecemmentModifie(apres(T0, -29 * JOUR), T0)).toBe(true);
    expect(numeroRecemmentModifie(apres(T0, -30 * JOUR), T0)).toBe(false);
  });
});
