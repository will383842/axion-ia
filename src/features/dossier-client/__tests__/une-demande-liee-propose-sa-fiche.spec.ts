// @vitest-environment node
/**
 * ⛔ Une demande du site reliée au rendez-vous PROPOSE sa fiche (motif
 * `demande_liee`, plan V-06, correction EX-M5) — et ne la range jamais (A4).
 *
 * Will relie un rendez-vous à une demande envoyée depuis le site
 * (`CalendlyEvent.linkedSubmissionId`). Quand la demande ressemble à une
 * fiche — même SIREN tiré du numéro saisi, même adresse qu'une personne de la
 * fiche, ou même raison sociale —, la fiche est proposée avec ce motif.
 *
 * Mutation qui fait rougir : retirer le bloc `demande_liee` de
 * `calculerProposition`, ou ne plus lire `linkedSubmissionId` dans
 * `CHAMPS_CALENDLY` → le premier test rougit.
 * Contre-témoin : le même rendez-vous SANS demande reliée reste à classer.
 */

import { describe, expect, it } from "vitest";

import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { calculerProposition, sirenDuNumeroSaisi } from "../rattacher";
import { dossierEnMemoire, fiche, rendezVousCalendly } from "./_dossier-en-memoire";

const BORNE = new Date("2026-10-01T00:00:00Z");
/** SIREN inventé, à la clé de Luhn juste (aucune entreprise réelle). */
const SIREN = "123456782";
const SIRET = `${SIREN}00017`;
const DEMANDE = "00000000-0000-4000-8000-00000000d001";

function scene(relie: boolean) {
  const f = fiche({ raisonSociale: "Atelier Sans Rapport", siren: SIREN });
  // Invité à une messagerie grand public : aucun autre motif ne s'applique.
  const ev = rendezVousCalendly({
    inviteeEmail: "quelquun.fictif@gmail.com",
    linkedSubmissionId: relie ? DEMANDE : null,
  });
  const base = dossierEnMemoire({
    client: [f],
    calendlyEvent: [ev],
    submission: [
      {
        id: DEMANDE,
        companyName: "Nom Différent De La Fiche",
        registrationNumber: `${SIRET.slice(0, 3)} ${SIRET.slice(3, 6)} ${SIRET.slice(6)}`,
        contactEmailHash: null,
      },
    ],
  });
  return { base, ev, f };
}

describe("⛔ une demande liée propose sa fiche", () => {
  it("le SIREN de la demande propose la fiche — sans la ranger", async () => {
    const { base, ev, f } = scene(true);
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, { borne: BORNE });
    const r = base.tables["rencontre"]?.[0];
    expect(r?.["motifProposition"]).toBe("demande_liee");
    expect(r?.["clientProposeId"]).toBe(f["id"]);
    expect(r?.["clientId"]).toBeNull();
  });

  it("contre-témoin : sans demande reliée, rien ne ressemble — reste à classer", async () => {
    const { base, ev } = scene(false);
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, { borne: BORNE });
    const r = base.tables["rencontre"]?.[0];
    expect(r?.["rattachementStatut"]).toBe("a_classer");
    expect(r?.["motifProposition"]).toBeNull();
  });

  it("l'adresse et la raison sociale de la demande proposent aussi (règle pure)", () => {
    const fiches = [
      {
        id: "f1",
        raisonSociale: "Menuiserie Fictive SARL",
        siren: null,
        contactEmail: null,
        empreintes: ["empreinte-1"],
        domainesPro: [],
      },
    ];
    const indices = {
      emailTitulaire: null,
      emailsInvites: [],
      entrepriseDeclaree: null,
      clientDuReport: null,
    };
    expect(
      calculerProposition(
        { ...indices, demandeLiee: { siren: null, emailHash: "empreinte-1", raisonSociale: null } },
        fiches,
      ),
    ).toEqual({ clientId: "f1", motif: "demande_liee" });
    expect(
      calculerProposition(
        {
          ...indices,
          demandeLiee: { siren: null, emailHash: null, raisonSociale: "Menuiserie Fictive" },
        },
        fiches,
      ),
    ).toEqual({ clientId: "f1", motif: "demande_liee" });
  });

  it("une faute de frappe dans le numéro ne propose rien", () => {
    expect(sirenDuNumeroSaisi(SIRET)).toBe(SIREN);
    expect(sirenDuNumeroSaisi(SIREN)).toBe(SIREN);
    expect(sirenDuNumeroSaisi("123456783")).toBeNull();
    expect(sirenDuNumeroSaisi("")).toBeNull();
    expect(sirenDuNumeroSaisi(null)).toBeNull();
  });
});
