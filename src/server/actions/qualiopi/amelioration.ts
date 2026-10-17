/**
 * Qualiopi — Server Actions du registre des actions d'amélioration AXI-AMC
 * (chantier QNC, lot L10 ; indicateur 32).
 *
 * ouvrirActionAmeliorationAction   : ouvre une action (numéro, origine, constat, action) ;
 * ajouterEtapeAmeliorationAction   : mise en œuvre (responsable, échéance), réalisée,
 *                                    efficacité vérifiée, abandonnée (motif), note.
 *
 * Refusées tant que `qualiopi.amelioration.actif` ne vaut pas `actif` : le
 * registre ne s'écrit qu'une fois allumé (rien ne s'allume dans ce lot).
 * L'auteur est la personne connectée ; la date est celle du serveur.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  RefusAmelioration,
  ajouterEtapeAmelioration,
  ouvrirActionAmelioration,
  registreAmeliorationActif,
} from "@/server/qualiopi/amelioration/registre-amc";
import { ETAPES_AMC, ORIGINES_AMC } from "@/server/qualiopi/amelioration/etapes-amc";
import { contexteRequeteQualiopi } from "@/server/qualiopi/journal/contexte-requete";
import { nomAdministrateur } from "@/server/qualiopi/journal/nom-administrateur";

type ActionResult<T> = { data: T } | { error: string };

const REFUS_ETEINT =
  "Le registre des actions d'amélioration n'est pas encore allumé (qualiopi.amelioration.actif).";

async function ecrire<T>(op: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { data: await op() };
  } catch (err) {
    if (err instanceof RefusAmelioration) return { error: err.message };
    return { error: "Erreur lors de l'écriture au registre AXI-AMC : rien n'a été écrit." };
  }
}

const ouvrirSchema = z.object({
  origine: z.enum(ORIGINES_AMC),
  origineRefId: z.string().uuid().nullable().optional(),
  constat: z.string().min(1).max(4000),
  action: z.string().min(1).max(4000),
});

export async function ouvrirActionAmeliorationAction(input: {
  origine: (typeof ORIGINES_AMC)[number];
  origineRefId?: string | null;
  constat: string;
  action: string;
}): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  if (!(await registreAmeliorationActif())) return { error: REFUS_ETEINT };
  const parsed = ouvrirSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;
  const auteurNom = await nomAdministrateur(session.userId, session.role ?? "administrateur");
  return ecrire(() =>
    ouvrirActionAmelioration(
      prisma,
      {
        origine: v.origine,
        origineRefId: v.origineRefId ?? null,
        constat: v.constat,
        action: v.action,
        auteurId: session.userId,
        auteurNom,
      },
      { contexte: contexteRequeteQualiopi },
    ),
  );
}

const etapeSchema = z.object({
  actionId: z.string().uuid(),
  etape: z.enum(ETAPES_AMC),
  commentaire: z.string().max(4000).default(""),
  responsable: z.string().max(150).optional(),
  echeance: z.string().max(10).optional(),
});

export async function ajouterEtapeAmeliorationAction(input: {
  actionId: string;
  etape: (typeof ETAPES_AMC)[number];
  commentaire?: string;
  responsable?: string;
  echeance?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  if (!(await registreAmeliorationActif())) return { error: REFUS_ETEINT };
  const parsed = etapeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;
  const auteurNom = await nomAdministrateur(session.userId, session.role ?? "administrateur");
  return ecrire(() =>
    ajouterEtapeAmelioration(
      prisma,
      {
        actionId: v.actionId,
        etape: v.etape,
        commentaire: v.commentaire,
        ...(v.responsable !== undefined ? { responsable: v.responsable } : {}),
        ...(v.echeance !== undefined ? { echeance: v.echeance } : {}),
        auteurId: session.userId,
        auteurNom,
      },
      { contexte: contexteRequeteQualiopi },
    ),
  );
}
