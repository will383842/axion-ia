/**
 * L'aperçu « Passer en entreprise » se construit avec les MÊMES fonctions pures que l'envoi
 * (`entreprisePourCrm`, `dossierPourCrm`) : il ne peut pas annoncer autre chose que ce qui part.
 * Données FICTIVES.
 */
import { describe, expect, it } from "vitest";

import { apercuPourCrm } from "@/server/crm-sync/apercu-dossier";
import {
  dossierPourCrm,
  type ContactPourCrm,
  type EntreeInstantaneCrm,
} from "@/server/crm-sync/instantane-dossier";

const contact = (id: string, o: Partial<ContactPourCrm> = {}): ContactPourCrm => ({
  id,
  nom: "Claire Martin",
  fonction: "Directrice",
  telephone: "0472000000",
  email: "claire@societe-exemple.fr",
  emailType: "pro",
  origine: "manuel",
  emailHash: "a".repeat(64),
  oppose: false,
  parti: false,
  ...o,
});

const entree = (o: Partial<EntreeInstantaneCrm> = {}): EntreeInstantaneCrm => ({
  clientId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  numero: "AXI-CLI-1",
  type: "entreprise",
  raisonSociale: "Société Exemple",
  siren: null,
  adresseRue: "12 rue des Lilas",
  adresseCodePostal: "69003",
  adresseVille: "Lyon",
  telephone: null,
  effectif: null,
  factureEmise: false,
  factureHorsConsole: false,
  questionnaire: null,
  contacts: [contact("c1")],
  ...o,
});

describe("apercuPourCrm", () => {
  it("annonce la rue, le code postal et la ville", () => {
    const a = apercuPourCrm(entree());
    expect(a.rue).toBe("12 rue des Lilas");
    expect(a.codePostal).toBe("69003");
    expect(a.ville).toBe("Lyon");
  });

  it("annonce l'e-mail pro d'un contact, avec son nom, sa fonction et son téléphone", () => {
    expect(apercuPourCrm(entree()).contacts).toEqual([
      {
        nom: "Claire Martin",
        fonction: "Directrice",
        telephone: "0472000000",
        email: "claire@societe-exemple.fr",
      },
    ]);
  });

  it("n'annonce ni un contact opposé, ni parti, ni de type mention", () => {
    const a = apercuPourCrm(
      entree({
        contacts: [
          contact("c1"),
          contact("c2", { nom: "Paul Opposé", oppose: true }),
          contact("c3", { nom: "Julie Partie", parti: true }),
          contact("c4", { nom: "Marc Cité", origine: "mention" }),
        ],
      }),
    );
    expect(a.contacts.map((c) => c.nom)).toEqual(["Claire Martin"]);
  });

  it("n'annonce pas un e-mail grand public (il ne part pas), mais annonce le contact", () => {
    const a = apercuPourCrm(
      entree({ contacts: [contact("c1", { email: "claire@gmail.com", emailType: "perso" })] }),
    );
    expect(a.contacts).toHaveLength(1);
    expect(a.contacts[0]!.email).toBeNull();
  });

  it("l'aperçu est exactement ce que dossierPourCrm envoie (mêmes contacts, mêmes valeurs)", () => {
    const e = entree({
      contacts: [
        contact("c1"),
        contact("c2", { nom: "Op", oppose: true }),
        contact("c3", { email: null, emailType: null }),
      ],
    });
    const envoye = dossierPourCrm(e).contacts ?? [];
    const a = apercuPourCrm(e);
    expect(a.contacts).toHaveLength(envoye.length);
    expect(a.contacts.map((c) => c.email)).toEqual(envoye.map((c) => c.email ?? null));
  });

  it("annonce l'état du dossier : étape, questionnaire, échanges, prochaine action", () => {
    const a = apercuPourCrm(
      entree({
        questionnaire: {
          envoyeLe: new Date("2026-11-02T10:00:00Z"),
          recuLe: null,
          nbReponsesEquipe: 3,
        },
        fiche: {
          etape: "devis_envoye",
          nbEmailsConsole: 4,
          nbNotesConsole: 2,
          prochaineTache: { origine: "relance", echeanceLe: new Date("2026-11-30T00:00:00Z") },
          nbTachesOuvertes: 1,
        },
      }),
    );
    expect(a.etat.etape).toBe("devis_envoye");
    expect(a.etat.questionnaire).toEqual({
      envoyeLe: "2026-11-02",
      recuLe: null,
      nbReponsesEquipe: 3,
    });
    expect(a.etat.nbEchanges).toBe(6);
    expect(a.etat.prochaineAction).toEqual({ type: "relance", date: "2026-11-30" });
  });

  it("sans rien : valeurs vides, jamais inventées", () => {
    const a = apercuPourCrm(
      entree({ adresseRue: " ", adresseCodePostal: null, adresseVille: null, contacts: [] }),
    );
    expect(a.rue).toBeNull();
    expect(a.codePostal).toBeNull();
    expect(a.ville).toBeNull();
    expect(a.contacts).toEqual([]);
    expect(a.etat.etape).toBeNull();
    expect(a.etat.questionnaire).toBeNull();
    expect(a.etat.nbEchanges).toBeNull();
    expect(a.etat.prochaineAction).toBeNull();
  });
});
