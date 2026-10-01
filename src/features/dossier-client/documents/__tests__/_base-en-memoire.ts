/**
 * Une base EN MÉMOIRE pour les documents du projet (ADR 0063) — juste ce que
 * `ajouter.ts`, `archiver.ts`, `telecharger.ts` et `page-publique.ts` appellent.
 *
 * Elle imite les garanties utiles aux tests :
 *   · la transaction ANNULE tout sur une exception ;
 *   · chaque lecture des OCTETS est comptée (`lecturesContenu`) ;
 *   · chaque appel est compté (`requetes`) : un refus « avant la base » se
 *     prouve par `requetes === 0`.
 * Elle n'imite PAS la clé composée ni les triggers de la vraie base : ceux-là
 * sont prouvés sur Postgres réel (Gate D,
 * `tests/integration/documents-projet/sql-brut-et-comportement.spec.ts`).
 */

export interface DocEnMemoire {
  id: string;
  clientId: string;
  projetId: string;
  cote: string;
  nature: string;
  titre: string;
  envoyeLe: Date | null;
  lienUrl: string | null;
  fichierNom: string | null;
  fichierFormat: string | null;
  fichierTailleOctets: number | null;
  fichierSha256: string | null;
  analyseAntivirus: string | null;
  analyseLe: Date | null;
  analyseSignature: string | null;
  archiveLe: Date | null;
  archiveParId: string | null;
  ajouteParId: string | null;
  createdAt: Date;
}

interface Etat {
  projets: Array<{ id: string; clientId: string }>;
  documents: DocEnMemoire[];
  contenus: Map<string, Uint8Array>;
  evenements: Array<Record<string, unknown>>;
  ouvertures: Array<Record<string, unknown>>;
}

type Where = Record<string, unknown>;

function correspond(doc: DocEnMemoire, where: Where): boolean {
  for (const [cle, attendu] of Object.entries(where)) {
    const valeur = (doc as unknown as Record<string, unknown>)[cle];
    if (attendu === null) {
      if (valeur !== null) return false;
    } else if (typeof attendu === "object" && attendu !== null && "not" in attendu) {
      const non = (attendu as { not: unknown }).not;
      if (non === null ? valeur === null : valeur === non) return false;
    } else if (valeur !== attendu) {
      return false;
    }
  }
  return true;
}

function choisir(doc: DocEnMemoire, select?: Record<string, unknown>): Record<string, unknown> {
  if (!select) return { ...doc };
  const sortie: Record<string, unknown> = {};
  for (const cle of Object.keys(select)) {
    if (cle === "contenu") throw new Error("une liste ne charge jamais le contenu");
    sortie[cle] = (doc as unknown as Record<string, unknown>)[cle];
  }
  return sortie;
}

let compteurId = 0;
function uuid(): string {
  compteurId += 1;
  const n = String(compteurId).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}

export function baseEnMemoire(projets: Etat["projets"]) {
  const etat: Etat = {
    projets,
    documents: [],
    contenus: new Map(),
    evenements: [],
    ouvertures: [],
  };
  const compteurs = { requetes: 0, lecturesContenu: 0, ecritures: 0 };

  const client = {
    projet: {
      async findFirst(args: { where: { id: string; clientId: string } }) {
        compteurs.requetes += 1;
        const p = etat.projets.find(
          (x) => x.id === args.where.id && x.clientId === args.where.clientId,
        );
        return p ? { id: p.id } : null;
      },
    },
    documentProjet: {
      async create(args: {
        data: Record<string, unknown> & { contenu?: { create: { octets: Uint8Array } } };
        select?: Record<string, unknown>;
      }) {
        compteurs.requetes += 1;
        compteurs.ecritures += 1;
        const { contenu, ...donnees } = args.data;
        const doc: DocEnMemoire = {
          id: uuid(),
          envoyeLe: null,
          lienUrl: null,
          fichierNom: null,
          fichierFormat: null,
          fichierTailleOctets: null,
          fichierSha256: null,
          analyseAntivirus: null,
          analyseLe: null,
          analyseSignature: null,
          archiveLe: null,
          archiveParId: null,
          ajouteParId: null,
          createdAt: new Date(),
          ...(donnees as Partial<DocEnMemoire>),
        } as DocEnMemoire;
        if (!etat.projets.some((p) => p.id === doc.projetId && p.clientId === doc.clientId)) {
          // La clé composée de la vraie base.
          throw Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" });
        }
        etat.documents.push(doc);
        if (contenu) etat.contenus.set(doc.id, new Uint8Array(contenu.create.octets));
        return choisir(doc, args.select);
      },
      async findFirst(args: { where: Where; select?: Record<string, unknown> }) {
        compteurs.requetes += 1;
        const doc = etat.documents.find((d) => correspond(d, args.where));
        return doc ? choisir(doc, args.select) : null;
      },
      async findUnique(args: { where: { id: string }; select?: Record<string, unknown> }) {
        compteurs.requetes += 1;
        const doc = etat.documents.find((d) => d.id === args.where.id);
        return doc ? choisir(doc, args.select) : null;
      },
      async updateMany(args: { where: Where; data: Partial<DocEnMemoire> }) {
        compteurs.requetes += 1;
        compteurs.ecritures += 1;
        let count = 0;
        for (const d of etat.documents) {
          if (correspond(d, args.where)) {
            Object.assign(d, args.data);
            count += 1;
          }
        }
        return { count };
      },
    },
    documentProjetContenu: {
      async findUnique(args: { where: { documentId: string } }) {
        compteurs.requetes += 1;
        compteurs.lecturesContenu += 1;
        const octets = etat.contenus.get(args.where.documentId);
        return octets ? { documentId: args.where.documentId, octets: Buffer.from(octets) } : null;
      },
    },
    documentProjetOuverture: {
      async create(args: { data: Record<string, unknown> }) {
        compteurs.requetes += 1;
        compteurs.ecritures += 1;
        etat.ouvertures.push(args.data);
        return args.data;
      },
    },
    projetEvenement: {
      async create(args: { data: Record<string, unknown> }) {
        compteurs.requetes += 1;
        compteurs.ecritures += 1;
        etat.evenements.push(args.data);
        return args.data;
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const instantane = {
        documents: etat.documents.map((d) => ({ ...d })),
        contenus: new Map(etat.contenus),
        evenements: [...etat.evenements],
      };
      try {
        return await fn(client);
      } catch (e) {
        etat.documents = instantane.documents;
        etat.contenus = instantane.contenus;
        etat.evenements = instantane.evenements;
        throw e;
      }
    },
  };

  /** Pose un document directement (pour préparer un cas), sans passer par le code. */
  function poser(
    doc: Partial<DocEnMemoire> & { clientId: string; projetId: string },
    octets?: Uint8Array,
  ) {
    const complet: DocEnMemoire = {
      id: uuid(),
      cote: "interne",
      nature: "autre",
      titre: "Document",
      envoyeLe: null,
      lienUrl: null,
      fichierNom: null,
      fichierFormat: null,
      fichierTailleOctets: null,
      fichierSha256: null,
      analyseAntivirus: null,
      analyseLe: null,
      analyseSignature: null,
      archiveLe: null,
      archiveParId: null,
      ajouteParId: null,
      createdAt: new Date(),
      ...doc,
    };
    etat.documents.push(complet);
    if (octets) etat.contenus.set(complet.id, octets);
    return complet;
  }

  return { db: client, etat, compteurs, poser };
}
