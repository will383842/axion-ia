"use server";

/**
 * Sources « Pour qui ? » de l'assistant de devis (fiche S13) — LECTURE SEULE.
 *
 * Préremplit le choix du client à partir de la Boîte de réception (`/contacts`) : appels réservés
 * et messages. Aucune écriture, aucune création de fiche (« Nouveau contact » passe par
 * `createClientAction`, côté écran). La visibilité des coordonnées reste celle de la boîte
 * (`listInbox` + rôle) ; ni e-mail ni téléphone ne sont renvoyés.
 */

import { listInbox } from "@/features/admin-inbox/queries";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { clientsParEmail } from "@/server/qualiopi/crm/entrees";
import { sourcesPourQui, type SourcePourQui } from "@/server/qualiopi/devis/assistant/sources";

type ActionResult<T> = { data: T } | { error: string };

const RECHERCHE_MAX = 200;
/** Les demandes les plus récentes seulement : la recherche filtre dans cette fenêtre. */
const FENETRE = 200;

export async function listerSourcesPourQuiAction(i: {
  recherche: string;
}): Promise<ActionResult<SourcePourQui[]>> {
  const session = await requireAdminWrite();
  const recherche = typeof i?.recherche === "string" ? i.recherche : "";
  if (recherche.length > RECHERCHE_MAX) return { error: "Recherche trop longue." };
  try {
    const inbox = await listInbox({
      adminUserId: session.userId,
      peutVoirAppels: peutVoirLesAppels(session.role),
      roleAdmin: session.role,
      page: 1,
      pageSize: FENETRE,
    });
    const clients = await clientsParEmail(inbox.rows.map((r) => r.contactEmail));
    return { data: sourcesPourQui(inbox.rows, clients, recherche) };
  } catch {
    return { error: "La boîte de réception n'a pas pu être lue." };
  }
}
