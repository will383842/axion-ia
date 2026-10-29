/**
 * Emplacement du lot B5 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : actions d'une personne (retrait), déplacées telles quelles de la page.
 */

import { RetraitPersonne } from "@/components/admin/dossier-client/RetraitPersonne";
import { adminPath } from "@/lib/admin-path";
import type { ContexteFiche } from "./contexte";

export function ActionsDeLaPersonne(props: {
  ctx: ContexteFiche;
  personneId: string;
}): React.ReactElement {
  const { ctx, personneId } = props;
  const retire = ctx.sp["retirer"] === personneId;
  return (
    // Ordre de Will (26/10/2026) : retirer UNE personne, super-administrateur seul.
    <RetraitPersonne
      contactId={personneId}
      clientId={ctx.clientId}
      peutRetirer={ctx.role === "super_admin"}
      page={adminPath("fr", `/qualiopi/clients/${ctx.clientId}`)}
      ouvert={retire}
      erreur={retire ? ctx.erreur : null}
      jeton={retire ? (ctx.sp["jeton"] ?? null) : null}
    />
  );
}
