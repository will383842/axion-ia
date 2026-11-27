/**
 * Corriger le NOM du contact principal ne crée pas de deuxième personne et ne
 * vide pas le téléphone (fix « Modifier la fiche »).
 *
 * Défaut constaté : « DUPONT Anne » corrigé en « Anne Dupont », adresse non
 * touchée. `ClientEditForm` n'envoie que les champs modifiés, donc pas
 * d'adresse : `parAdresse` est nul, `memeNom` gardait l'ordre des mots, et une
 * NOUVELLE personne était créée, sans téléphone (la copie de la fiche, écrite
 * depuis elle, était vidée).
 *
 * Mutation qui fait rougir : retirer le tri des mots dans `memeNom`, ou ignorer
 * `nomCorrige`. Angle mort : l'appelant qui oublie `nomCorrige` (couvert côté
 * action par `clients.spec.ts`).
 */

import { describe, expect, it } from "vitest";
import { definirContactFacturation, NOM_A_COMPLETER } from "../contact-facturation";
import { baseEnMemoire, commePrisma, ficheClient } from "./_base-en-memoire";

type Db = ReturnType<typeof baseEnMemoire>;

function invariant(db: Db, clientId: string): void {
  const fiche = db.etat.clients.find((c) => c.id === clientId);
  const facturation = db.etat.contacts.filter(
    (c) => c.clientId === clientId && c.estContactFacturation,
  );
  expect(facturation, "un seul contact de facturation").toHaveLength(1);
  const p = facturation[0];
  if (!fiche || !p) throw new Error("fixture");
  expect(fiche.contactNom).toBe(p.nom === NOM_A_COMPLETER ? null : p.nom);
  expect(fiche.contactTelephone).toBe(p.telephone);
  expect(fiche.contactFonction).toBe(p.fonction);
  const adresses = db.etat.adresses.filter((a) => a.contactId === p.id).map((a) => a.email);
  if (fiche.contactEmail !== null) expect(adresses).toContain(fiche.contactEmail);
}

async function definir(db: Db, e: Parameters<typeof definirContactFacturation>[1]) {
  return db.$transaction((tx) => definirContactFacturation(commePrisma(tx), e));
}

/** Départ : « DUPONT Anne », contact de facturation, avec adresse et téléphone. */
function depart() {
  const fiche = ficheClient({
    numero: "AXI-CLI-030",
    raisonSociale: "Fictive SA",
    contactNom: "DUPONT Anne",
    contactEmail: "anne@fictive.example",
    contactTelephone: "01 02 03 04 05",
    contactFonction: "Gérante",
  });
  const db = baseEnMemoire({
    clients: [fiche],
    contacts: [
      {
        id: "p-anne",
        clientId: fiche.id,
        nom: "DUPONT Anne",
        fonction: "Gérante",
        telephone: "01 02 03 04 05",
        origine: "saisie",
        estContactFacturation: true,
        creeParId: null,
      },
    ],
    adresses: [
      {
        id: "a-anne",
        contactId: "p-anne",
        email: "anne@fictive.example",
        emailHash: hash("anne@fictive.example"),
        nature: "inconnue",
      },
    ],
  });
  return { fiche, db };
}

import { hashEmailForLookup } from "@/lib/security/email-hash";
function hash(email: string): string {
  const h = hashEmailForLookup(email);
  if (h === null) throw new Error("fixture");
  return h;
}

describe("corriger le nom du contact ne crée pas de personne", () => {
  it("T1 · nomCorrige : une seule personne, renommée, téléphone et adresse gardés", async () => {
    const { fiche, db } = depart();
    const r = await definir(db, {
      clientId: fiche.id,
      nom: "Anne Dupont",
      fonction: "Gérante",
      nomCorrige: true,
    });
    expect(r.cree).toBe(false);
    expect(db.etat.contacts).toHaveLength(1);
    expect(db.etat.contacts[0]?.id).toBe("p-anne");
    expect(db.etat.contacts[0]?.nom).toBe("Anne Dupont");
    expect(db.etat.contacts[0]?.telephone).toBe("01 02 03 04 05");
    expect(db.etat.adresses.map((a) => a.contactId)).toEqual(["p-anne"]);
    expect(fiche.contactNom).toBe("Anne Dupont");
    expect(fiche.contactTelephone).toBe("01 02 03 04 05");
    expect(fiche.contactEmail).toBe("anne@fictive.example");
    invariant(db, fiche.id);
  });

  it("T1 bis · une faute de frappe corrigée : une seule personne, téléphone gardé, rien créé", async () => {
    const { fiche, db } = depart();
    // La fiche porte la faute de frappe « Anne Dupond ».
    const p = db.etat.contacts[0];
    if (!p) throw new Error("fixture");
    p.nom = "Anne Dupond";
    fiche.contactNom = "Anne Dupond";
    const r = await definir(db, { clientId: fiche.id, nom: "Anne Dupont", nomCorrige: true });
    expect(r.cree).toBe(false);
    expect(db.etat.contacts).toHaveLength(1);
    expect(db.etat.contacts[0]?.nom).toBe("Anne Dupont");
    expect(db.etat.contacts[0]?.telephone).toBe("01 02 03 04 05");
    expect(fiche.contactTelephone).toBe("01 02 03 04 05");
    invariant(db, fiche.id);
  });

  it("T2 · avec le drapeau, « Anne Dupont » et « DUPONT Anne » sont la même personne ; sans, l'ancien comportement", async () => {
    // Avec le drapeau et une adresse nouvelle : mêmes mots, la personne actuelle convient.
    {
      const { fiche, db } = depart();
      const r = await definir(db, {
        clientId: fiche.id,
        nom: "Anne Dupont",
        email: "anne.dupont@fictive.example",
        nomCorrige: true,
      });
      expect(r.cree).toBe(false);
      expect(db.etat.contacts).toHaveLength(1);
      expect(db.etat.contacts[0]?.telephone).toBe("01 02 03 04 05");
      invariant(db, fiche.id);
    }
    // Sans le drapeau : l'ordre des mots compte, c'est une autre personne.
    {
      const { fiche, db } = depart();
      const r = await definir(db, {
        clientId: fiche.id,
        nom: "Anne Dupont",
        email: "anne.dupont@fictive.example",
      });
      expect(r.cree).toBe(true);
      expect(db.etat.contacts).toHaveLength(2);
    }
  });

  it("T3 · un nouveau nom avec une NOUVELLE adresse crée une nouvelle personne (nomCorrige ou non)", async () => {
    for (const nomCorrige of [false, true]) {
      const { fiche, db } = depart();
      const r = await definir(db, {
        clientId: fiche.id,
        nom: "Bruno Fictif",
        email: "bruno@fictive.example",
        nomCorrige,
      });
      expect(r.cree, `nomCorrige=${nomCorrige}`).toBe(true);
      expect(db.etat.contacts).toHaveLength(2);
      expect(db.etat.contacts.find((c) => c.id === "p-anne")?.estContactFacturation).toBe(false);
      expect(fiche.contactNom).toBe("Bruno Fictif");
      invariant(db, fiche.id);
    }
  });

  it("T4 · saisir l'adresse d'une AUTRE personne de la fiche ne change ni son téléphone ni sa fonction", async () => {
    const { fiche, db } = depart();
    db.etat.contacts.push({
      id: "p-bruno",
      clientId: fiche.id,
      nom: "Bruno Fictif",
      fonction: "DAF",
      telephone: "06 00 00 00 00",
      origine: "saisie",
      estContactFacturation: false,
      creeParId: null,
    });
    db.etat.adresses.push({
      id: "a-bruno",
      contactId: "p-bruno",
      email: "bruno@fictive.example",
      emailHash: hash("bruno@fictive.example"),
      nature: "inconnue",
    });
    // Ce que le formulaire envoie désormais : nom et adresse, sans téléphone ni fonction.
    const r = await definir(db, {
      clientId: fiche.id,
      nom: "Bruno Fictif",
      email: "bruno@fictive.example",
      nomCorrige: true,
    });
    expect(r.contactId).toBe("p-bruno");
    expect(r.cree).toBe(false);
    const bruno = db.etat.contacts.find((c) => c.id === "p-bruno");
    expect(bruno?.telephone).toBe("06 00 00 00 00");
    expect(bruno?.fonction).toBe("DAF");
    // L'ancienne personne n'est pas touchée non plus.
    const anne = db.etat.contacts.find((c) => c.id === "p-anne");
    expect(anne?.telephone).toBe("01 02 03 04 05");
    expect(anne?.fonction).toBe("Gérante");
    invariant(db, fiche.id);
  });
});
