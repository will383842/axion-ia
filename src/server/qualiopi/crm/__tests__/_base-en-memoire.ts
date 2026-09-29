/**
 * Base EN MÉMOIRE pour les tests de la porte unique et du contact de
 * facturation (chantier visio, PR 3). Ce n'est pas un faux Prisma général :
 * elle interprète EXACTEMENT les formes de requête qu'écrivent
 * `porte-client.ts`, `contact-facturation.ts` et `reprendre-contacts.ts`, et
 * lève sur toute autre forme — un test ne passe jamais « par accident » sur
 * une requête que la base n'a pas su lire.
 *
 * `$transaction` est RÉELLE au sens qui compte ici : une exception annule
 * toutes les écritures de la transaction (instantané puis restauration).
 */

import { hashEmailForLookup } from "@/lib/security/email-hash";

export interface LigneClient {
  id: string;
  numero: string;
  type: "entreprise" | "particulier";
  raisonSociale: string;
  siren: string | null;
  siret: string | null;
  adresseVille: string | null;
  adresseCodePostal: string | null;
  contactNom: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  contactFonction: string | null;
  statut: string;
  [autre: string]: unknown;
}

export interface LigneContact {
  id: string;
  clientId: string;
  nom: string;
  fonction: string | null;
  telephone: string | null;
  origine: string;
  estContactFacturation: boolean;
  creeParId: string | null;
}

export interface LigneAdresse {
  id: string;
  contactId: string;
  email: string;
  emailHash: string;
  nature: string;
}

export interface Etat {
  clients: LigneClient[];
  contacts: LigneContact[];
  adresses: LigneAdresse[];
  journal: Array<Record<string, unknown>>;
  fusionsVivantes: Set<string>;
}

let compteur = 0;
function nouvelId(): string {
  compteur += 1;
  return `00000000-0000-4000-8000-${String(compteur).padStart(12, "0")}`;
}

export function ficheClient(
  partiel: Partial<LigneClient> & { numero: string; raisonSociale: string },
): LigneClient {
  return {
    id: nouvelId(),
    type: "entreprise",
    siren: null,
    siret: null,
    adresseVille: null,
    adresseCodePostal: null,
    contactNom: null,
    contactEmail: null,
    contactTelephone: null,
    contactFonction: null,
    statut: "prospect",
    ...partiel,
  };
}

type Condition = Record<string, unknown>;

function inconnue(quoi: string, valeur: unknown): never {
  throw new Error(
    `base en mémoire : forme de requête non prévue (${quoi}) : ${JSON.stringify(valeur)}`,
  );
}

export function baseEnMemoire(initial?: Partial<Etat>) {
  const etat: Etat = {
    clients: initial?.clients ?? [],
    contacts: initial?.contacts ?? [],
    adresses: initial?.adresses ?? [],
    journal: initial?.journal ?? [],
    fusionsVivantes: initial?.fusionsVivantes ?? new Set(),
  };
  const verrous: string[] = [];
  let ecrituresHorsTransaction = 0;
  let dansTransaction = false;

  const adressesDe = (contactId: string) => etat.adresses.filter((a) => a.contactId === contactId);
  const contactsDe = (clientId: string) => etat.contacts.filter((c) => c.clientId === clientId);

  function clientSatisfait(c: LigneClient, cond: Condition): boolean {
    for (const [cle, v] of Object.entries(cond)) {
      if (cle === "OR") {
        if (!(v as Condition[]).some((sous) => clientSatisfait(c, sous))) return false;
        continue;
      }
      if (cle === "siren") {
        if (c.siren !== v) return false;
        continue;
      }
      if (cle === "id") {
        if (c.id !== v) return false;
        continue;
      }
      if (cle === "adresseCodePostal") {
        if (c.adresseCodePostal !== v) return false;
        continue;
      }
      if (cle === "numero") {
        const s = (v as { startsWith: string }).startsWith;
        if (!c.numero.startsWith(s)) return false;
        continue;
      }
      if (cle === "adresseVille") {
        const eq = (v as { equals: string }).equals;
        if ((c.adresseVille ?? "").toLowerCase() !== eq.toLowerCase()) return false;
        continue;
      }
      if (cle === "contactEmail") {
        const o = v as { in?: string[]; endsWith?: string };
        const e = (c.contactEmail ?? "").toLowerCase();
        if (o.in !== undefined) {
          if (!o.in.map((x) => x.toLowerCase()).includes(e)) return false;
        } else if (o.endsWith !== undefined) {
          if (e === "" || !e.endsWith(o.endsWith.toLowerCase())) return false;
        } else inconnue("contactEmail", v);
        continue;
      }
      if (cle === "contacts") {
        const o = v as { some?: { adresses: { some: Condition } }; none?: Condition };
        if (o.none !== undefined) {
          if (contactsDe(c.id).length > 0) return false;
          continue;
        }
        const filtre = o.some?.adresses.some ?? inconnue("contacts", v);
        const ok = contactsDe(c.id).some((p) =>
          adressesDe(p.id).some((a) => adresseSatisfait(a, filtre)),
        );
        if (!ok) return false;
        continue;
      }
      inconnue(`client.${cle}`, v);
    }
    return true;
  }

  function adresseSatisfait(a: LigneAdresse, cond: Condition): boolean {
    for (const [cle, v] of Object.entries(cond)) {
      if (cle === "emailHash") {
        if (typeof v === "string") {
          if (a.emailHash !== v) return false;
        } else if (!(v as { in: string[] }).in.includes(a.emailHash)) return false;
        continue;
      }
      if (cle === "email") {
        const s = (v as { endsWith: string }).endsWith.toLowerCase();
        if (!a.email.toLowerCase().endsWith(s)) return false;
        continue;
      }
      if (cle === "contactId") {
        if (a.contactId !== v) return false;
        continue;
      }
      inconnue(`adresse.${cle}`, v);
    }
    return true;
  }

  function contactSatisfait(c: LigneContact, cond: Condition): boolean {
    for (const [cle, v] of Object.entries(cond)) {
      if (cle === "clientId") {
        if (c.clientId !== v) return false;
        continue;
      }
      if (cle === "estContactFacturation") {
        if (c.estContactFacturation !== v) return false;
        continue;
      }
      if (cle === "adresses") {
        const f = (v as { some: Condition }).some;
        if (!adressesDe(c.id).some((a) => adresseSatisfait(a, f))) return false;
        continue;
      }
      inconnue(`contact.${cle}`, v);
    }
    return true;
  }

  function vueClient(c: LigneClient) {
    return {
      ...c,
      contacts: contactsDe(c.id).map((p) => ({
        ...p,
        adresses: adressesDe(p.id).map((a) => ({ email: a.email, emailHash: a.emailHash })),
      })),
      fusionsAbsorbee: etat.fusionsVivantes.has(c.id) ? [{ id: "fusion" }] : [],
    };
  }

  function ecrire(): void {
    if (!dansTransaction) ecrituresHorsTransaction += 1;
  }

  const client = {
    async findUnique(args: { where: { id: string } }) {
      const c = etat.clients.find((x) => x.id === args.where.id);
      return c ? { ...c } : null;
    },
    async findMany(args: { where?: Condition; take?: number }) {
      const lignes = etat.clients
        .filter((c) => (args.where ? clientSatisfait(c, args.where) : true))
        .sort((a, b) => a.numero.localeCompare(b.numero))
        .map(vueClient);
      return args.take !== undefined ? lignes.slice(0, args.take) : lignes;
    },
    async create(args: { data: Partial<LigneClient> & { numero: string; raisonSociale: string } }) {
      ecrire();
      if (etat.clients.some((c) => c.numero === args.data.numero)) {
        throw Object.assign(new Error("numero déjà pris"), { code: "P2002" });
      }
      const ligne = ficheClient(args.data);
      etat.clients.push(ligne);
      return { id: ligne.id, numero: ligne.numero };
    },
    async update(args: { where: { id: string }; data: Partial<LigneClient> }) {
      ecrire();
      const c = etat.clients.find((x) => x.id === args.where.id);
      if (!c) throw new Error("client introuvable");
      Object.assign(c, args.data);
      return { ...c };
    },
  };

  const clientContact = {
    async findFirst(args: { where: Condition }) {
      const c = etat.contacts.find((x) => contactSatisfait(x, args.where));
      return c ? { ...c } : null;
    },
    async create(args: {
      data: Omit<
        LigneContact,
        "id" | "estContactFacturation" | "creeParId" | "fonction" | "telephone"
      > &
        Partial<LigneContact>;
    }) {
      ecrire();
      if (args.data.estContactFacturation) {
        if (
          etat.contacts.some((c) => c.clientId === args.data.clientId && c.estContactFacturation)
        ) {
          throw new Error("index partiel : deux contacts de facturation sur une fiche");
        }
      }
      const ligne: LigneContact = {
        id: nouvelId(),
        fonction: null,
        telephone: null,
        estContactFacturation: false,
        creeParId: null,
        ...args.data,
      };
      etat.contacts.push(ligne);
      return { ...ligne };
    },
    async update(args: { where: { id: string }; data: Partial<LigneContact> }) {
      ecrire();
      const c = etat.contacts.find((x) => x.id === args.where.id);
      if (!c) throw new Error("contact introuvable");
      if (
        args.data.estContactFacturation === true &&
        etat.contacts.some(
          (x) => x.id !== c.id && x.clientId === c.clientId && x.estContactFacturation,
        )
      ) {
        throw new Error("index partiel : deux contacts de facturation sur une fiche");
      }
      Object.assign(c, args.data);
      return { ...c };
    },
  };

  const clientContactAdresse = {
    async findFirst(args: { where: Condition }) {
      const a = etat.adresses.find((x) => adresseSatisfait(x, args.where));
      return a ? { ...a } : null;
    },
    async create(args: { data: Omit<LigneAdresse, "id"> }) {
      ecrire();
      if (
        etat.adresses.some(
          (a) => a.contactId === args.data.contactId && a.emailHash === args.data.emailHash,
        )
      ) {
        throw Object.assign(new Error("adresse en double"), { code: "P2002" });
      }
      const ligne = { id: nouvelId(), ...args.data };
      etat.adresses.push(ligne);
      return { ...ligne };
    },
    async deleteMany(args: { where: Condition }) {
      ecrire();
      const avant = etat.adresses.length;
      etat.adresses = etat.adresses.filter((a) => !adresseSatisfait(a, args.where));
      return { count: avant - etat.adresses.length };
    },
  };

  const activityLog = {
    async create(args: { data: Record<string, unknown> }) {
      ecrire();
      etat.journal.push(args.data);
      return args.data;
    },
  };

  const tx = {
    client,
    clientContact,
    clientContactAdresse,
    activityLog,
    async $executeRaw(gabarit: TemplateStringsArray, ...valeurs: unknown[]) {
      verrous.push(`${gabarit.join("?")}|${valeurs.join(",")}`);
      return 1;
    },
  };

  const db = {
    ...tx,
    etat,
    verrous,
    get ecrituresHorsTransaction() {
      return ecrituresHorsTransaction;
    },
    async $transaction<T>(fn: (t: typeof tx) => Promise<T>): Promise<T> {
      const instantane = JSON.stringify({
        clients: etat.clients,
        contacts: etat.contacts,
        adresses: etat.adresses,
        journal: etat.journal,
      });
      dansTransaction = true;
      try {
        return await fn(tx);
      } catch (e) {
        const r = JSON.parse(instantane) as Etat;
        etat.clients = r.clients;
        etat.contacts = r.contacts;
        etat.adresses = r.adresses;
        etat.journal = r.journal;
        throw e;
      } finally {
        dansTransaction = false;
      }
    },
  };
  return db;
}

/** Une adresse déjà connue d'une personne de la fiche. */
export function adresse(contactId: string, email: string): LigneAdresse {
  return {
    id: nouvelId(),
    contactId,
    email,
    emailHash: hashEmailForLookup(email) ?? "",
    nature: "pro",
  };
}

export function personne(clientId: string, nom: string, facturation = false): LigneContact {
  return {
    id: nouvelId(),
    clientId,
    nom,
    fonction: null,
    telephone: null,
    origine: "saisie",
    estContactFacturation: facturation,
    creeParId: null,
  };
}

/** Le typage de Prisma n'a rien à voir ici : la base en mémoire se passe « comme » un client. */
export function commePrisma<T>(db: unknown): T {
  return db as T;
}
