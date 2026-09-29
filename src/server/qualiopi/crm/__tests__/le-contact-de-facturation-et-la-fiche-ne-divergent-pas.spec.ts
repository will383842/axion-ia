/**
 * Le contact de facturation et la fiche ne divergent pas (plan PA-1) :
 * `Client.contact*` est la COPIE du contact de facturation, écrite par
 * `definirContactFacturation` seule, dans la même transaction.
 *
 * Invariant vérifié après CHAQUE étape d'un parcours réaliste :
 *   · exactement un contact de facturation sur la fiche ;
 *   · `contactNom`, `contactTelephone`, `contactFonction` = ceux de la personne ;
 *   · `contactEmail` est une adresse de cette personne (ou vide).
 * Et : un second appel identique ne crée rien (idempotence).
 *
 * Mutation qui fait rougir : ne plus recopier la personne dans la fiche, ou
 * poser la marque de facturation sur le nouveau AVANT de la retirer à l'ancien
 * (la base en mémoire refuse deux contacts de facturation, comme l'index
 * partiel réel).
 * Angle mort : une écriture directe hors de la fonction ne passe pas par ici —
 * c'est la garde `personne-n-ecrit-contact-email-hors-de-la-fonction-unique`.
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

describe("le contact de facturation et la fiche ne divergent pas", () => {
  it("création, mise à jour, changement de personne, effacement d'adresse", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-020", raisonSociale: "Fictive SA" });
    const db = baseEnMemoire({ clients: [fiche] });

    // 1. Première personne.
    const r1 = await definir(db, {
      clientId: fiche.id,
      nom: "Anne Fictive",
      email: "Anne@Fictive.example",
      fonction: "DAF",
    });
    expect(r1.cree).toBe(true);
    invariant(db, fiche.id);
    expect(fiche.contactEmail).toBe("anne@fictive.example");

    // 2. Même appel : idempotent.
    const r2 = await definir(db, {
      clientId: fiche.id,
      nom: "Anne Fictive",
      email: "anne@fictive.example",
    });
    expect(r2.cree).toBe(false);
    expect(db.etat.contacts).toHaveLength(1);
    expect(db.etat.adresses).toHaveLength(1);
    invariant(db, fiche.id);

    // 3. Téléphone seul : la personne et la fiche bougent ensemble.
    await definir(db, { clientId: fiche.id, telephone: "01 00 00 00 00" });
    invariant(db, fiche.id);
    expect(fiche.contactTelephone).toBe("01 00 00 00 00");

    // 4. Une autre personne devient contact de facturation : Anne reste une personne.
    await definir(db, { clientId: fiche.id, nom: "Bruno Fictif", email: "bruno@fictive.example" });
    invariant(db, fiche.id);
    expect(db.etat.contacts).toHaveLength(2);
    expect(fiche.contactNom).toBe("Bruno Fictif");
    expect(fiche.contactTelephone).toBeNull();

    // 5. Retour à Anne par son adresse : pas de troisième personne.
    await definir(db, { clientId: fiche.id, email: "anne@fictive.example" });
    invariant(db, fiche.id);
    expect(db.etat.contacts).toHaveLength(2);
    expect(fiche.contactNom).toBe("Anne Fictive");

    // 6. Adresse effacée : retirée de la personne et de la fiche.
    await definir(db, { clientId: fiche.id, email: null });
    invariant(db, fiche.id);
    expect(fiche.contactEmail).toBeNull();
    expect(db.etat.adresses.map((a) => a.email)).not.toContain("anne@fictive.example");
  });

  it("une adresse seule crée une personne « Nom à compléter », sans nom recopié", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-021", raisonSociale: "Autre Fictive" });
    const db = baseEnMemoire({ clients: [fiche] });
    await definir(db, { clientId: fiche.id, email: "contact@autre-fictive.example" });
    invariant(db, fiche.id);
    expect(db.etat.contacts[0]?.nom).toBe(NOM_A_COMPLETER);
    expect(fiche.contactNom).toBeNull();
  });

  it("rien à écrire (ni nom, ni adresse, ni personne) : rien n'est créé", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-022", raisonSociale: "Vide" });
    const db = baseEnMemoire({ clients: [fiche] });
    const r = await definir(db, { clientId: fiche.id, telephone: "01" });
    expect(r.contactId).toBeNull();
    expect(db.etat.contacts).toEqual([]);
  });
});
