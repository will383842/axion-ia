/**
 * Action serveur du lot B9 : « Préparer une relance » d'un devis envoyé.
 *
 * ⛔ Elle ne fait QUE garer un brouillon « à valider » (`garerPourValidation`). Elle n'envoie
 * jamais rien : si le garage échoue (`null`), elle affiche une erreur — le commentaire de
 * `garerPourValidation` propose d'envoyer normalement, on ne le suit PAS ici.
 * Le rôle est revérifié ici (une action s'appelle directement) ; le devis doit être DU client
 * et au statut `envoye` ; un brouillon déjà à valider pour ce devis n'est pas doublé.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { garerPourValidation } from "@/server/email/outbox-service";
import { exigerAccesEchanges } from "../acces";
import { messageAffichable } from "../message-affichable";
import { avecMessageDeRetour } from "../message-de-retour";
import {
  construireRelanceDevis,
  ENTITE_DEVIS,
  ERREUR_DEVIS_INTROUVABLE,
  ERREUR_GARAGE,
  MESSAGE_RELANCE_GAREE,
  MESSAGE_RELANCE_PRETE,
  TEMPLATE_RELANCE_DEVIS,
} from "./relance-devis";

const uuid = z.string().uuid();

function retour(
  clientId: string,
  cle: "message" | "erreur",
  texte: string,
  onglet = "facturation",
): never {
  const base = adminPath("fr", `qualiopi/clients/${clientId}`);
  redirect(avecMessageDeRetour(`${base}?onglet=${onglet}`, cle, texte));
}

function estRedirection(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function preparerRelanceDevisAction(fd: FormData): Promise<void> {
  const brutClient = fd.get("clientId");
  const clientId = uuid.safeParse(typeof brutClient === "string" ? brutClient : "");
  if (!clientId.success) redirect(adminPath("fr", "qualiopi/clients"));
  const cid = clientId.data;

  try {
    const session = await requireAdminWrite();
    await exigerAccesEchanges();

    const brutDevis = fd.get("devisId");
    const devisId = uuid.safeParse(typeof brutDevis === "string" ? brutDevis : "");
    if (!devisId.success) return retour(cid, "erreur", ERREUR_DEVIS_INTROUVABLE);

    // Le devis doit être DU client de la fiche et envoyé.
    const devis = await prisma.devis.findFirst({
      where: { id: devisId.data, clientId: cid, statut: "envoye" },
      select: {
        id: true,
        numero: true,
        sentAt: true,
        client: { select: { raisonSociale: true, contactEmail: true } },
      },
    });
    if (!devis) return retour(cid, "erreur", ERREUR_DEVIS_INTROUVABLE);

    // Anti-doublon : un brouillon déjà à valider pour ce devis.
    const existant = await prisma.emailOutbox.findFirst({
      where: {
        template: TEMPLATE_RELANCE_DEVIS,
        entityType: ENTITE_DEVIS,
        entityId: devis.id,
        statut: "a_valider",
      },
      select: { id: true },
    });
    if (existant) return retour(cid, "message", MESSAGE_RELANCE_PRETE);

    const relance = construireRelanceDevis({
      numero: devis.numero,
      envoyeLe: devis.sentAt,
      raisonSociale: devis.client.raisonSociale,
      contactEmail: devis.client.contactEmail,
    });
    if (!relance.ok) return retour(cid, "erreur", relance.erreur);

    const outboxId = await garerPourValidation({
      template: TEMPLATE_RELANCE_DEVIS,
      recipient: relance.destinataire,
      locale: "fr",
      payload: relance.payload,
      sujet: relance.sujet,
      clientId: cid,
      entityType: ENTITE_DEVIS,
      entityId: devis.id,
    });
    // Jamais d'envoi de repli : une relance non garée n'existe pas.
    if (outboxId === null) return retour(cid, "erreur", ERREUR_GARAGE);

    await logQualiopiActivity({
      action: "dossier-client.relance-devis.preparee",
      targetType: "Devis",
      targetId: devis.id,
      changes: { outboxId, numero: devis.numero },
      session,
    });
    revalidatePath(adminPath("fr", `qualiopi/clients/${cid}`));
    return retour(cid, "message", MESSAGE_RELANCE_GAREE);
  } catch (e) {
    if (estRedirection(e)) throw e;
    return retour(cid, "erreur", messageAffichable(e));
  }
}
