"use server";

/**
 * Sources « Pour qui ? » de l'assistant de devis (fiche S13) — LECTURE SEULE.
 *
 * Préremplit le choix du client à partir de la Boîte de réception (`/contacts`) : appels réservés
 * et messages. Aucune écriture, aucune création de fiche (« Nouveau contact » passe par
 * `createClientAction`, côté écran). La visibilité des coordonnées reste celle de la boîte
 * (`listInbox`) ; ni e-mail ni téléphone ne sont renvoyés.
 *
 * STRICTEMENT lecture seule : `roleAdmin: null`. Un rôle fait déchiffrer les candidatures et écrire
 * `careers.candidature.liste.consultee` dans `activityLog` — or les candidatures ne sont pas des
 * clients potentiels et ne sont jamais lues ici.
 *
 * Décision v1 : une seule source, les DEMANDES (appels réservés + messages de la boîte de
 * réception). La source « rencontres » est ABANDONNÉE en v1 (pas de besoin avéré, et elle
 * élargirait la lecture aux comptes rendus de visio).
 */

import { listInbox, PER_CHANNEL_FETCH } from "@/features/admin-inbox/queries";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { clientsParEmail } from "@/server/qualiopi/crm/entrees";
import { sourcesPourQui, type SourcePourQui } from "@/server/qualiopi/devis/assistant/sources";

type ActionResult<T> = { data: T; note?: string } | { error: string };

const RECHERCHE_MAX = 200;
/**
 * `listInbox` fusionne 4 canaux de `PER_CHANNEL_FETCH` (100) lignes, triés par date, puis tronque à
 * `pageSize`. Avec 4 × 100 on voit TOUT ce que la boîte a lu : 200 candidatures récentes ne
 * peuvent plus chasser un message plus ancien hors de la fenêtre.
 */
const FENETRE = 400;

const NOM_CANAL: Record<string, string> = {
  appel: "appels réservés",
  message: "messages",
};
const NOM_CANAL_COUNT = Object.keys(NOM_CANAL).length;

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
      roleAdmin: null,
      page: 1,
      pageSize: FENETRE,
    });
    // Un canal utile illisible = liste partielle : jamais présentée comme complète.
    const utilesEnPanne = inbox.failedChannels.filter((c) => c in NOM_CANAL);
    if (utilesEnPanne.length === NOM_CANAL_COUNT) {
      return {
        error: "La boîte de réception n'a pas pu être lue (appels et messages illisibles).",
      };
    }
    const clients = await clientsParEmail(inbox.rows.map((r) => r.contactEmail));
    const data = sourcesPourQui(inbox.rows, clients, recherche);
    const notes: string[] = [];
    if (utilesEnPanne.length > 0) {
      notes.push(
        `Liste incomplète : ${utilesEnPanne.map((c) => NOM_CANAL[c]).join(" et ")} ` +
          "n'ont pas pu être lus.",
      );
    }
    // `inbox.truncated` vaut vrai dès qu'UN canal atteint la fenêtre, candidatures comprises (164 en
    // prod) : or seuls les appels et les messages sont utilisés ici. On ne signale donc la troncature
    // que si l'un de CES deux canaux atteint `PER_CHANNEL_FETCH` (FENETRE couvre les 4 canaux, aucune
    // ligne utile n'est écartée par la coupe à `pageSize`).
    const tronqueUtile = Object.keys(NOM_CANAL).some(
      (c) => inbox.rows.filter((r) => r.channel === c).length >= PER_CHANNEL_FETCH,
    );
    if (tronqueUtile) {
      notes.push("Liste incomplète : seules les demandes les plus récentes sont affichées.");
    }
    return notes.length > 0 ? { data, note: notes.join(" ") } : { data };
  } catch {
    return { error: "La boîte de réception n'a pas pu être lue." };
  }
}
