/**
 * B4 — la civilité, le prénom et le nom de famille du contact de facturation
 * s'écrivent par `definirContactFacturation` (personne ET copie sur la fiche),
 * jamais en découpant `contactNom`.
 */
import { describe, expect, it } from "vitest";
import { definirContactFacturation } from "../contact-facturation";
import { baseEnMemoire, commePrisma, ficheClient } from "./_base-en-memoire";

type Db = ReturnType<typeof baseEnMemoire>;
async function definir(db: Db, e: Parameters<typeof definirContactFacturation>[1]) {
  return db.$transaction((tx) => definirContactFacturation(commePrisma(tx), e));
}

describe("contact de facturation : identité de salutation", () => {
  it("écrit les trois champs sur la personne et sur la copie, sans toucher contactNom", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-030", raisonSociale: "Fictive SA" });
    const db = baseEnMemoire({ clients: [fiche] });
    await definir(db, { clientId: fiche.id, nom: "Léa Dupont", email: "lea@fictive.example" });
    await definir(db, {
      clientId: fiche.id,
      civilite: "madame",
      prenom: " Léa ",
      nomFamille: "Dupont",
    });
    expect(fiche.contactNom).toBe("Léa Dupont");
    expect(fiche["contactCivilite"]).toBe("madame");
    expect(fiche["contactPrenom"]).toBe("Léa");
    expect(fiche["contactNomFamille"]).toBe("Dupont");
    expect(db.etat.contacts[0]).toMatchObject({
      civilite: "madame",
      prenom: "Léa",
      nomFamille: "Dupont",
    });
  });

  it("null efface ; undefined ne change rien", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-031", raisonSociale: "Fictive SA" });
    const db = baseEnMemoire({ clients: [fiche] });
    await definir(db, {
      clientId: fiche.id,
      nom: "Marc Dupont",
      civilite: "monsieur",
      nomFamille: "Dupont",
    });
    await definir(db, { clientId: fiche.id, telephone: "01" });
    expect(fiche["contactCivilite"]).toBe("monsieur");
    await definir(db, { clientId: fiche.id, civilite: null, nomFamille: "" });
    expect(fiche["contactCivilite"]).toBeNull();
    expect(fiche["contactNomFamille"]).toBeNull();
  });

  it("une AUTRE personne devient contact : elle n'hérite pas de l'identité de l'ancienne", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-032", raisonSociale: "Fictive SA" });
    const db = baseEnMemoire({ clients: [fiche] });
    await definir(db, {
      clientId: fiche.id,
      nom: "Léa Dupont",
      civilite: "madame",
      nomFamille: "Dupont",
    });
    await definir(db, { clientId: fiche.id, nom: "Bruno Martin", email: "b@fictive.example" });
    expect(fiche.contactNom).toBe("Bruno Martin");
    expect(fiche["contactCivilite"] ?? null).toBeNull();
    expect(fiche["contactNomFamille"] ?? null).toBeNull();
  });

  it("sur une fiche sans personne (rien à créer), la copie reçoit quand même les champs", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-033", raisonSociale: "Vide" });
    const db = baseEnMemoire({ clients: [fiche] });
    const r = await definir(db, { clientId: fiche.id, civilite: "madame" });
    expect(r.contactId).toBeNull();
    expect(fiche["contactCivilite"]).toBe("madame");
  });

  it("🔴 identité saisie seule, puis e-mail seul : l'identité n'est pas perdue (M1)", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-034", raisonSociale: "Fictive SA" });
    const db = baseEnMemoire({ clients: [fiche] });
    // Étape 1 : fiche sans personne, identité seule (écrite sur la fiche seulement).
    await definir(db, { clientId: fiche.id, civilite: "madame", nomFamille: "Dupont" });
    expect(db.etat.contacts).toHaveLength(0);
    // Étape 2 : seul l'e-mail est transmis (le formulaire n'envoie que le modifié).
    await definir(db, { clientId: fiche.id, email: "lea@fictive.example" });
    expect(db.etat.contacts[0]).toMatchObject({ civilite: "madame", nomFamille: "Dupont" });
    expect(fiche["contactCivilite"]).toBe("madame");
    expect(fiche["contactNomFamille"]).toBe("Dupont");
  });

  it("🔴 une civilité hors « madame » / « monsieur » est écrite null (m3)", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-035", raisonSociale: "Fictive SA" });
    const db = baseEnMemoire({ clients: [fiche] });
    await definir(db, {
      clientId: fiche.id,
      nom: "Léa Dupont",
      email: "lea@fictive.example",
      civilite: "docteur",
    });
    expect(
      (db.etat.contacts[0] as Record<string, unknown> | undefined)?.["civilite"] ?? null,
    ).toBeNull();
    expect(fiche["contactCivilite"] ?? null).toBeNull();
    await definir(db, { clientId: fiche.id, civilite: "madame" });
    expect(fiche["contactCivilite"]).toBe("madame");
  });
});
