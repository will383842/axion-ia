import { describe, expect, it } from "vitest";

import { construireBandeau, type EntreeBandeau } from "../bandeau-ou-en-est";

const maintenant = new Date("2026-10-25T10:00:00Z");
const vide: EntreeBandeau = {
  maintenant,
  rendezVous: [],
  questionnaires: [],
  fil: [],
  prestations: [],
  nbDevis: 0,
};
const rep = (aTraiter: number, dirigeant = aTraiter) => ({
  dirigeant,
  referentInformatique: 0,
  collaborateurs: 0,
  aTraiter,
});

describe("bandeau « Où en est ce client »", () => {
  it("fiche vide : quatre lignes qui disent « rien », sans mot interdit", () => {
    const l = construireBandeau(vide);
    expect(l.map((x) => x.onglet)).toEqual([
      "rendez-vous",
      "questionnaire",
      "emails",
      "prestations",
    ]);
    expect(l.map((x) => x.texte)).toEqual([
      "aucun rendez-vous à venir",
      "pas encore envoyé",
      "aucun e-mail envoyé",
      "aucune prestation · aucun devis",
    ]);
  });

  it("garde le prochain rendez-vous à venir, ignore passé, annulé et test interne", () => {
    const l = construireBandeau({
      ...vide,
      rendezVous: [
        {
          titre: "Passé",
          debutPrevu: new Date("2026-10-01T08:00:00Z"),
          statut: "tenu",
          estTestInterne: false,
        },
        {
          titre: "Annulé",
          debutPrevu: new Date("2026-10-26T08:00:00Z"),
          statut: "annule",
          estTestInterne: false,
        },
        {
          titre: "Test",
          debutPrevu: new Date("2026-10-26T09:00:00Z"),
          statut: "planifie",
          estTestInterne: true,
        },
        {
          titre: "Audit",
          debutPrevu: new Date("2026-11-06T07:30:00Z"),
          statut: "planifie",
          estTestInterne: false,
        },
      ],
    });
    expect(l[0]!.texte).toContain("Audit");
  });

  it("questionnaire envoyé avec réponses à lire", () => {
    const l = construireBandeau({
      ...vide,
      questionnaires: [
        { envoyeLe: new Date("2026-10-22T12:00:00Z"), closLe: null, reponses: rep(2) },
      ],
    });
    expect(l[1]!.texte).toContain("2 réponses à lire");
  });

  it("brouillon non envoyé = pas encore envoyé", () => {
    const l = construireBandeau({
      ...vide,
      questionnaires: [{ envoyeLe: null, closLe: null, reponses: rep(0) }],
    });
    expect(l[1]!.texte).toBe("pas encore envoyé");
  });

  it("dernier e-mail PARTI : un e-mail en attente ne compte pas", () => {
    const l = construireBandeau({
      ...vide,
      fil: [
        {
          cle: "a",
          genre: "email_en_attente",
          date: new Date("2026-10-24T10:00:00Z"),
          titre: "Attend",
          etat: "",
          lien: null,
        },
        {
          cle: "b",
          genre: "email",
          date: new Date("2026-10-23T10:00:00Z"),
          titre: "Rappel 1",
          etat: "",
          statutEmail: "sent",
          lien: null,
        },
      ],
    });
    expect(l[2]!.texte).toContain("Rappel 1");
  });

  it("prestations en cours et devis", () => {
    const l = construireBandeau({
      ...vide,
      prestations: [{ statut: "ouvert" }, { statut: "perdu" }],
      nbDevis: 2,
    });
    expect(l[3]!.texte).toBe("1 prestation en cours · 2 devis");
  });
});

describe("bandeau : une lecture en panne n'est pas « rien »", () => {
  it("chaque ligne en panne dit « lecture impossible »", () => {
    const l = construireBandeau({
      ...vide,
      enPanne: ["rendez_vous", "questionnaire", "email", "prestations"],
    });
    expect(l.map((x) => x.texte)).toEqual([
      "lecture impossible",
      "lecture impossible",
      "lecture impossible",
      "lecture impossible · aucun devis",
    ]);
  });

  it("une source du fil illisible : « aucun e-mail envoyé » ne s'affiche pas", () => {
    const l = construireBandeau({ ...vide, sourcesDuFilEnPanne: 1 });
    expect(l[2]!.texte).toBe("lecture impossible");
  });

  it("une seule ligne en panne laisse les autres lisibles", () => {
    const l = construireBandeau({ ...vide, enPanne: ["questionnaire"] });
    expect(l[0]!.texte).toBe("aucun rendez-vous à venir");
    expect(l[1]!.texte).toBe("lecture impossible");
  });
});

describe("bandeau : « Dernier e-mail » ne compte que les e-mails PARTIS", () => {
  const mail = (cle: string, jourISO: string, statutEmail: "sent" | "failed" | "bounced") => ({
    cle,
    genre: "email" as const,
    date: new Date(jourISO),
    titre: `Objet ${cle}`,
    etat: statutEmail,
    statutEmail,
    lien: null,
  });

  it("saute l'échec et le rebond plus récents que le dernier envoi réussi", () => {
    const l = construireBandeau({
      ...vide,
      fil: [
        mail("c", "2026-10-24T10:00:00Z", "failed"),
        mail("b", "2026-10-23T10:00:00Z", "bounced"),
        mail("a", "2026-10-20T10:00:00Z", "sent"),
      ],
    });
    expect(l[2]!.texte).toContain("Objet a");
  });

  it("que des échecs : aucun e-mail envoyé", () => {
    const l = construireBandeau({ ...vide, fil: [mail("c", "2026-10-24T10:00:00Z", "failed")] });
    expect(l[2]!.texte).toBe("aucun e-mail envoyé");
  });
});

describe("bandeau : prestations hors « ouvert » ou « gagné »", () => {
  it("ne dit pas « 0 prestation en cours » quand la fiche en a", () => {
    const l = construireBandeau({ ...vide, prestations: [{ statut: "perdu" }] });
    expect(l[3]!.texte).toBe("1 prestation (aucune en cours) · aucun devis");
  });
});
