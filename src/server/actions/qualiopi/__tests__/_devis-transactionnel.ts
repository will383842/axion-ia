/**
 * Une fausse base TRANSACTIONNELLE pour les actions de devis (PR 7) : chaque
 * `$transaction` travaille sur une copie, validée seulement si le rappel
 * aboutit — comme PostgreSQL. C'est ce qui permet de voir une trace orpheline
 * (un lien `projet_devis` écrit hors de la transaction du devis survivrait à
 * l'annulation).
 */

export interface Etat {
  devis: Array<Record<string, unknown>>;
  projetDevis: Array<Record<string, unknown>>;
  preRemplissages: Array<Record<string, unknown>>;
  devisMisAJour: number;
}

export function fausseBaseDevis(options: { collisionsAuCreate: number }) {
  const etat: Etat = { devis: [], projetDevis: [], preRemplissages: [], devisMisAJour: 0 };
  let collisions = options.collisionsAuCreate;
  let n = 0;

  const surEtat = (e: Etat) => ({
    devis: {
      findMany: async () => e.devis.map((d) => ({ numero: d["numero"] })),
      findUnique: async ({ where }: { where: { id: string } }) =>
        e.devis.find((d) => d["id"] === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (collisions > 0) {
          collisions -= 1;
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        n += 1;
        const ligne = { id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, ...data };
        e.devis.push(ligne);
        return { id: ligne.id, numero: data["numero"] };
      },
      update: async () => {
        e.devisMisAJour += 1;
        return {};
      },
    },
    projetDevis: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        e.projetDevis.push(data);
        return data;
      },
      findUnique: async ({ where }: { where: { devisId: string } }) =>
        e.projetDevis.find((l) => l["devisId"] === where.devisId) ?? null,
    },
    preRemplissage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        e.preRemplissages.push(data);
        return data;
      },
    },
    projet: {
      findUnique: async () => ({ clientId: CLIENT, fusionneDansId: null }),
    },
    client: { findUnique: async () => ({ opcoIdentifie: null }) },
  });

  const racine = {
    ...surEtat(etat),
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const copie: Etat = {
        devis: [...etat.devis],
        projetDevis: [...etat.projetDevis],
        preRemplissages: [...etat.preRemplissages],
        devisMisAJour: etat.devisMisAJour,
      };
      const r = await fn(surEtat(copie));
      Object.assign(etat, copie);
      return r;
    },
  };
  return { db: racine, etat };
}

export const CLIENT = "33333333-3333-4333-8333-333333333333";
export const PROJET = "44444444-4444-4444-8444-444444444444";
