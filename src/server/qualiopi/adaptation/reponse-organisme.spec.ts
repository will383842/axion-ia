/**
 * Indicateur 10 — le besoin déclaré et la réponse de l'organisme, écrits une fois.
 *
 * Le cas réel qui fonde ces tests : « oui » au positionnement, fiche stagiaire
 * ensuite décochée (aucune adaptation nécessaire après échange), inscription
 * vide. Le moteur ne voyait plus le besoin ; rien ne gardait la réponse.
 */
import { describe, expect, it } from "vitest";

import {
  HORODATAGE_CIRCUIT_VIDE,
  REPONSE_AUCUNE_ADAPTATION,
  besoinAdaptationDeclare,
  debutConsignationCourante,
  decrireDateConsignation,
  derniereConsignation,
  derniereDeclarationPourInscription,
  estReponseAucuneAdaptation,
  etatReponseAdaptation,
  lireHorodatageSerialise,
  reponseAnterieureALaDerniereDeclaration,
  serialiserHorodatage,
  whereBesoinAdaptationDeclare,
  type HorodatageCircuitAdaptation,
} from "./reponse-organisme";
import { sectionIndicateur10 } from "./dossier-adaptation";

describe("besoin d'adaptation déclaré", () => {
  it("🔴 un « oui » au positionnement reste un besoin déclaré quand la fiche est décochée", () => {
    expect(
      besoinAdaptationDeclare({
        situationHandicap: false,
        reponsesPositionnements: [{ besoinAdaptation: true }],
      }),
    ).toBe(true);
  });

  it("la fiche stagiaire (portail « mon compte » ou console) suffit", () => {
    expect(besoinAdaptationDeclare({ situationHandicap: true, reponsesPositionnements: [] })).toBe(
      true,
    );
  });

  it("un « non », une question non posée ou une saisie par l'organisme ne déclarent rien", () => {
    for (const reponses of [
      { besoinAdaptation: false },
      {},
      null,
      { saisie_admin: true, besoinAdaptation: true },
    ]) {
      expect(
        besoinAdaptationDeclare({ situationHandicap: false, reponsesPositionnements: [reponses] }),
      ).toBe(false);
    }
  });

  it("le filtre base est POSITIF sur les deux sources — jamais une exclusion JSON", () => {
    const plat = JSON.stringify(whereBesoinAdaptationDeclare());
    expect(plat).toContain('"situationHandicap":true');
    expect(plat).toContain('"path":["besoinAdaptation"],"equals":true');
    expect(plat).not.toContain("NOT");
  });
});

describe("réponse de l'organisme", () => {
  it("🔴 « aucune adaptation nécessaire » est une réponse consignée, pas une absence", () => {
    expect(etatReponseAdaptation(true, REPONSE_AUCUNE_ADAPTATION, HORODATAGE_CIRCUIT_VIDE)).toBe(
      "consignee",
    );
    expect(estReponseAucuneAdaptation(REPONSE_AUCUNE_ADAPTATION)).toBe(true);
  });

  it("besoin déclaré sans réponse = à consigner ; une chaîne blanche n'est pas une réponse", () => {
    expect(etatReponseAdaptation(true, null, HORODATAGE_CIRCUIT_VIDE)).toBe("a_consigner");
    expect(etatReponseAdaptation(true, "   ", HORODATAGE_CIRCUIT_VIDE)).toBe("a_consigner");
    expect(etatReponseAdaptation(false, null, HORODATAGE_CIRCUIT_VIDE)).toBe("sans_besoin");
  });

  it("la date de consignation est le début de la période qui dure encore", () => {
    const j = (jour: number): Date => new Date(Date.UTC(2026, 8, jour, 10));
    // Consignée le 1er, retouchée le 3 : consignée depuis le 1er.
    expect(
      debutConsignationCourante([
        { createdAt: j(3), renseignee: true },
        { createdAt: j(1), renseignee: true },
      ]),
    ).toEqual(j(1));
    // Effacée le 4, réécrite le 6 : consignée depuis le 6.
    expect(
      debutConsignationCourante([
        { createdAt: j(1), renseignee: true },
        { createdAt: j(4), renseignee: false },
        { createdAt: j(6), renseignee: true },
      ]),
    ).toEqual(j(6));
    expect(debutConsignationCourante([{ createdAt: j(4), renseignee: false }])).toBeNull();
  });
});

function consignee(le: Date): HorodatageCircuitAdaptation {
  return { consigneeDepuis: le, derniereConsignationLe: le, derniereDeclarationLe: null };
}

describe("dossier d'audit de la session — section indicateur 10", () => {
  const debut = new Date("2026-09-05T07:00:00.000Z");

  it("dit, par stagiaire, la réponse et sa date par rapport au début", () => {
    const { lignes, nbAConsigner } = sectionIndicateur10(
      [
        {
          stagiaire: "Alice Test",
          besoinDeclare: true,
          adaptationsRealisees: REPONSE_AUCUNE_ADAPTATION,
          horodatage: consignee(new Date("2026-09-04T09:00:00.000Z")),
        },
        {
          stagiaire: "Bruno Test",
          besoinDeclare: true,
          adaptationsRealisees: "Supports agrandis",
          horodatage: consignee(new Date("2026-09-06T09:00:00.000Z")),
        },
        {
          stagiaire: "Chloé Test",
          besoinDeclare: true,
          adaptationsRealisees: null,
          horodatage: HORODATAGE_CIRCUIT_VIDE,
        },
        {
          stagiaire: "Denis Test",
          besoinDeclare: false,
          adaptationsRealisees: null,
          horodatage: HORODATAGE_CIRCUIT_VIDE,
        },
      ],
      debut,
    );
    const texte = lignes.join("\n");
    expect(texte).toMatch(
      /Alice Test — besoin déclaré — réponse consignée le .*avant le début.*aucune adaptation nécessaire/,
    );
    expect(texte).toMatch(/Bruno Test — besoin déclaré — réponse consignée le .*APRÈS le début/);
    expect(texte).toContain("Chloé Test — besoin déclaré — AUCUNE RÉPONSE CONSIGNÉE");
    expect(texte).not.toContain("Denis Test");
    expect(texte).toContain("1 autre stagiaire sans besoin déclaré");
    expect(nbAConsigner).toBe(1);
  });

  it("🔴 ne peut pas porter le détail déclaré — la section ne le reçoit même pas", () => {
    const { lignes } = sectionIndicateur10(
      [
        {
          stagiaire: "Alice Test",
          besoinDeclare: true,
          adaptationsRealisees: null,
          horodatage: HORODATAGE_CIRCUIT_VIDE,
        },
      ],
      debut,
    );
    expect(lignes.join("\n")).toContain("jamais reproduit dans ce dossier");
    expect(lignes.join("\n")).not.toMatch(/fiche stagiaire|chiffr/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Relecture #1095 — une NOUVELLE déclaration rouvre le circuit
// ─────────────────────────────────────────────────────────────────────────────

describe("une réponse ne couvre que les déclarations qui la précèdent", () => {
  const j = (jour: number): Date => new Date(Date.UTC(2026, 8, jour, 10));

  it("🔴 déclaration postérieure à la dernière consignation → à consigner, texte conservé", () => {
    const h = { consigneeDepuis: j(2), derniereConsignationLe: j(2), derniereDeclarationLe: j(5) };
    expect(reponseAnterieureALaDerniereDeclaration(REPONSE_AUCUNE_ADAPTATION, h)).toBe(true);
    expect(etatReponseAdaptation(true, REPONSE_AUCUNE_ADAPTATION, h)).toBe("a_consigner");
  });

  it("déclaration antérieure, ou réponse réécrite après elle → consignée", () => {
    expect(
      etatReponseAdaptation(true, "Supports agrandis", {
        consigneeDepuis: j(2),
        derniereConsignationLe: j(2),
        derniereDeclarationLe: j(1),
      }),
    ).toBe("consignee");
    // Première réponse le 2, déclaration le 5, réponse RÉÉCRITE le 6 : couverte.
    expect(
      etatReponseAdaptation(true, "Supports agrandis", {
        consigneeDepuis: j(2),
        derniereConsignationLe: j(6),
        derniereDeclarationLe: j(5),
      }),
    ).toBe("consignee");
  });

  it("⚠️ une réponse NON DATÉE ne couvre pas une déclaration datée (échec fermé)", () => {
    const h = { consigneeDepuis: null, derniereConsignationLe: null, derniereDeclarationLe: j(5) };
    expect(etatReponseAdaptation(true, "Supports agrandis", h)).toBe("a_consigner");
    // Aucune déclaration datée : rien ne dit que la réponse est dépassée.
    expect(etatReponseAdaptation(true, "Supports agrandis", HORODATAGE_CIRCUIT_VIDE)).toBe(
      "consignee",
    );
  });

  it("sans besoin déclaré (fiche décochée, « non »), une réponse reste une réponse", () => {
    const h = { consigneeDepuis: j(2), derniereConsignationLe: j(2), derniereDeclarationLe: j(5) };
    expect(etatReponseAdaptation(false, "Supports agrandis", h)).toBe("consignee");
  });

  it("dernière déclaration : positionnement « oui » daté, journal de la personne, borné à la fin de session", () => {
    expect(
      derniereDeclarationPourInscription({
        positionnements: [{ reponses: { besoinAdaptation: true }, reponduAt: j(3) }],
        declarationsStagiaire: [j(4), j(20)],
        finSession: j(10),
      }),
    ).toEqual(j(4));
    // « non », saisie par l'organisme : ne datent aucune déclaration.
    expect(
      derniereDeclarationPourInscription({
        positionnements: [
          { reponses: { besoinAdaptation: false }, reponduAt: j(3) },
          { reponses: { saisie_admin: true, besoinAdaptation: true }, reponduAt: j(4) },
        ],
        declarationsStagiaire: [],
        finSession: j(10),
      }),
    ).toBeNull();
  });

  it("la dernière consignation est celle du texte affiché ; un effacement final n'en laisse aucune", () => {
    expect(
      derniereConsignation([
        { createdAt: j(3), renseignee: true },
        { createdAt: j(1), renseignee: true },
      ]),
    ).toEqual(j(3));
    expect(
      derniereConsignation([
        { createdAt: j(1), renseignee: true },
        { createdAt: j(3), renseignee: false },
      ]),
    ).toBeNull();
  });

  it("les dates traversent la sérialisation vers le composant client sans se perdre", () => {
    const h = { consigneeDepuis: j(2), derniereConsignationLe: j(3), derniereDeclarationLe: j(5) };
    expect(lireHorodatageSerialise(serialiserHorodatage(h))).toEqual(h);
    expect(lireHorodatageSerialise(undefined)).toEqual(HORODATAGE_CIRCUIT_VIDE);
  });
});

describe("🔴 D2 — la date située est celle du TEXTE AFFICHÉ", () => {
  const debut = new Date("2026-09-05T07:00:00.000Z");

  it("texte d'attente avant le début, réécrit après : « APRÈS » pour le texte, « avant » pour la première réponse", () => {
    const texte = decrireDateConsignation(
      {
        consigneeDepuis: new Date("2026-09-01T09:00:00.000Z"),
        derniereConsignationLe: new Date("2026-09-06T09:00:00.000Z"),
        derniereDeclarationLe: null,
      },
      debut,
    );
    expect(texte).toMatch(/^consignée le 6 septembre 2026.*, APRÈS le début de la session/);
    expect(texte).toMatch(
      /première réponse le 1(er)? septembre 2026.*, avant le début de la session\)$/,
    );
  });

  it("une seule écriture : une seule date", () => {
    const le = new Date("2026-09-04T09:00:00.000Z");
    const texte = decrireDateConsignation(
      { consigneeDepuis: le, derniereConsignationLe: le, derniereDeclarationLe: null },
      debut,
    );
    expect(texte).toMatch(/avant le début de la session$/);
    expect(texte).not.toContain("première réponse");
  });

  it("dans le dossier : la réponse antérieure à une nouvelle déclaration est dite, datée, à côté du manque", () => {
    const { lignes, nbAConsigner } = sectionIndicateur10(
      [
        {
          stagiaire: "Alice Test",
          besoinDeclare: true,
          adaptationsRealisees: REPONSE_AUCUNE_ADAPTATION,
          horodatage: {
            consigneeDepuis: new Date("2026-09-02T09:00:00.000Z"),
            derniereConsignationLe: new Date("2026-09-02T09:00:00.000Z"),
            derniereDeclarationLe: new Date("2026-09-03T09:00:00.000Z"),
          },
        },
      ],
      debut,
    );
    const texte = lignes.join("\n");
    expect(nbAConsigner).toBe(1);
    expect(texte).toMatch(
      /Alice Test — besoin déclaré \(nouvelle déclaration le 3 septembre 2026.*\) — AUCUNE RÉPONSE CONSIGNÉE à cette déclaration — réponse antérieure conservée, consignée le 2 septembre 2026.* — aucune adaptation nécessaire/,
    );
  });
});
