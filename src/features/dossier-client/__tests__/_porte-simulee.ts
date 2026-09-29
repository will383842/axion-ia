/**
 * Une PORTE UNIQUE simulée pour les tests de « Créer la fiche prospect » : la
 * vraie porte (`creerOuRetrouverClient`, PR 3, testée à part) lit par des
 * filtres de relation que la base en mémoire ne sait pas lire. Celle-ci écrit
 * la fiche et sa personne de facturation dans la même base, et ENREGISTRE ce
 * qu'on lui a demandé — c'est ce que les tests vérifient.
 */

import { hashEmailForLookup } from "@/lib/security/email-hash";

export interface AppelPorte {
  readonly donnees: Record<string, unknown>;
  readonly personne: { nom?: string; email?: string } | null;
  readonly options: Record<string, unknown>;
}

export const appelsPorte: AppelPorte[] = [];

let n = 0;

export async function porteSimulee(
  db: { $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> },
  donnees: Record<string, unknown>,
  personne: { nom?: string; email?: string } | null,
  options: Record<string, unknown>,
): Promise<{ statut: "cree"; id: string; numero: string; proches: []; creationForcee: false }> {
  appelsPorte.push({ donnees, personne, options });
  return db.$transaction(async (tx) => {
    const t = tx as Record<string, { create: (a: unknown) => Promise<{ id: string }> }>;
    n += 1;
    const numero = `AXI-CLI-9${String(n).padStart(2, "0")}`;
    const c = await t["client"]!.create({ data: { ...donnees, numero, statut: "prospect" } });
    if (personne?.email) {
      const contact = await t["clientContact"]!.create({
        data: {
          clientId: c.id,
          nom: personne.nom ?? "Nom à compléter",
          origine: options["origineContact"] ?? "saisie",
          estContactFacturation: true,
        },
      });
      await t["clientContactAdresse"]!.create({
        data: {
          contactId: contact.id,
          email: personne.email,
          emailHash: hashEmailForLookup(personne.email),
          nature: "perso",
        },
      });
    }
    return {
      statut: "cree" as const,
      id: c.id,
      numero,
      proches: [],
      creationForcee: false as const,
    };
  });
}
