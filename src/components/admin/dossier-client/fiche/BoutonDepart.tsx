// « Noter le départ » / « Annuler le départ » d'une personne (lot B5). Formulaire serveur, sans
// JavaScript. Composant asynchrone : il lit seulement l'état de CETTE personne, sur cette fiche.

import { UserRoundMinus, UserRoundCheck } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { prisma } from "@/lib/prisma";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import {
  annulerDepartFormAction,
  noterDepartFormAction,
} from "@/features/dossier-client/fiche/actions-depart";
import { aujourdhuiParis } from "@/features/dossier-client/fiche/depart-personne";

export async function BoutonDepart(props: {
  clientId: string;
  personneId: string;
  maintenant: Date;
}): Promise<React.ReactElement> {
  const { clientId, personneId, maintenant } = props;
  let contact: { statut: "actif" | "parti"; partiLe: Date | null } | null;
  try {
    contact = await prisma.clientContact.findFirst({
      where: { id: personneId, clientId },
      select: { statut: true, partiLe: true },
    });
  } catch {
    return (
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        {`Départ : ${TEXTE_LECTURE_IMPOSSIBLE}`}
      </p>
    );
  }
  if (contact === null) return <></>;
  const cachees = (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="contactId" value={personneId} />
    </>
  );
  if (contact.statut === "parti") {
    return (
      <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <span className="inline-flex items-center gap-[var(--space-admin-2)] text-[color:var(--color-admin-fg-muted)]">
          <UserRoundMinus aria-hidden className="h-4 w-4" />
          {contact.partiLe
            ? `A quitté l'entreprise le ${formatDateFrShort(contact.partiLe)} · Aucun envoi`
            : "A quitté l'entreprise · Aucun envoi"}
        </span>
        <form action={annulerDepartFormAction}>
          {cachees}
          <AdminButton type="submit" variant="secondary">
            Annuler le départ
          </AdminButton>
        </form>
      </div>
    );
  }
  const jour = aujourdhuiParis(maintenant);
  return (
    <form
      action={noterDepartFormAction}
      className="mt-[var(--space-admin-2)] flex flex-wrap items-end gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
    >
      {cachees}
      <label className="flex flex-col gap-1">
        Date du départ
        <input
          type="date"
          name="partiLe"
          required
          defaultValue={jour}
          max={jour}
          min="2000-01-01"
          className="min-h-[44px] rounded border border-[color:var(--color-admin-border)] px-2"
        />
      </label>
      <AdminButton type="submit" variant="secondary">
        <UserRoundCheck aria-hidden className="mr-1 h-4 w-4" />
        Noter le départ
      </AdminButton>
    </form>
  );
}
