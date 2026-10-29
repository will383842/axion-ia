/**
 * Emplacement du lot B5 : carte « Qui décide » en haut de l'onglet Personnes.
 * Lecture seule : rôles par prestation, départs, OPCO de la fiche (jamais compté comme personne).
 */

import { prisma } from "@/lib/prisma";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { lirePersonnesDuClient } from "@/features/dossier-client/queries";
import { lireDatesDeDepart } from "@/features/dossier-client/fiche/depart-personne";
import {
  nomOpcoDuClient,
  referenceOpcoDuClient,
} from "@/server/qualiopi/financements/opco-referentiel";
import { CarteDecision, type PersonneDeLaCarte } from "./CarteDecision";
import type { ContexteFiche } from "./contexte";

export async function personnesDecision(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  try {
    const [personnes, departs, client] = await Promise.all([
      lirePersonnesDuClient(ctx.clientId),
      lireDatesDeDepart(prisma, ctx.clientId),
      prisma.client.findUnique({
        where: { id: ctx.clientId },
        select: { opco: true, opcoIdentifie: true },
      }),
    ]);
    const gens: PersonneDeLaCarte[] = personnes.map((p) => ({
      id: p.id,
      nom: p.nom,
      fonction: p.fonction,
      statut: p.statut,
      partiLe: departs.get(p.id) ?? null,
      roles: [...new Set(p.roles.map((r) => r.role))],
    }));
    const opco =
      client !== null && referenceOpcoDuClient(client) !== null ? nomOpcoDuClient(client) : null;
    return <CarteDecision personnes={gens} opco={opco} />;
  } catch {
    return (
      <p role="status" className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
        {`Qui décide : ${TEXTE_LECTURE_IMPOSSIBLE}`}
      </p>
    );
  }
}
