/**
 * `creerOuDedup` rejoué sur la base en mémoire : même règle de dé-duplication
 * (une alerte ouverte par code et cible), écrite dans la table `alerteSysteme`
 * de la base de test. Le vrai `creerOuDedup` tire le client Prisma global.
 */

import type { BaseEnMemoire } from "@/features/dossier-client/__tests__/_prisma-en-memoire";
import type { AlerteInput } from "@/server/qualiopi/alertes/alertes-service";

export function creerEnMemoire(base: BaseEnMemoire) {
  return async (input: AlerteInput): Promise<unknown> => {
    const ouverte = (base.tables["alerteSysteme"] ?? []).find(
      (a) => a["code"] === input.code && !a["resolue"] && (a["cibleId"] ?? null) === null,
    );
    if (ouverte) return null;
    const client = base.client as unknown as {
      alerteSysteme: { create(a: { data: Record<string, unknown> }): Promise<unknown> };
    };
    return client.alerteSysteme.create({
      data: {
        code: input.code,
        niveau: input.niveau,
        titre: input.titre,
        message: input.message,
        metadata: input.metadata ?? {},
      },
    });
  };
}
