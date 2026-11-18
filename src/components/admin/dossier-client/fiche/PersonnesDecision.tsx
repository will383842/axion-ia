/**
 * Emplacement du lot B5 : carte « Qui décide » en haut de l'onglet Personnes.
 * Lecture seule : rôles par prestation, départs, OPCO de la fiche (jamais compté comme personne).
 */

import { prisma } from "@/lib/prisma";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { lirePersonnesDuClient } from "@/features/dossier-client/queries";
import {
  nomOpcoDuClient,
  referenceOpcoDuClient,
} from "@/server/qualiopi/financements/opco-referentiel";
import { CarteDecision, type PersonneDeLaCarte } from "./CarteDecision";
import type { ContexteFiche } from "./contexte";
import { lireDepartsCache, panneDejaDite } from "./etats-depart";

export async function personnesDecision(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  try {
    const [personnes, lecture, client] = await Promise.all([
      lirePersonnesDuClient(ctx.clientId),
      lireDepartsCache(ctx.clientId),
      prisma.client.findUnique({
        where: { id: ctx.clientId },
        select: { opco: true, opcoIdentifie: true },
      }),
    ]);
    if (!lecture.ok) {
      // La carte le dit : les boutons « Noter le départ » ne le répètent pas.
      panneDejaDite().dite = true;
      throw new Error("lecture des départs impossible");
    }
    const gens: PersonneDeLaCarte[] = personnes.map((p) => ({
      id: p.id,
      nom: p.nom,
      fonction: p.fonction,
      statut: p.statut,
      partiLe: lecture.etats.get(p.id)?.partiLe ?? null,
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
