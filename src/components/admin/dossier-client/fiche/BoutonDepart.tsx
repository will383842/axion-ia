// « Noter le départ » / « Annuler le départ » d'une personne (lot B5). Formulaire serveur, sans
// JavaScript. Composant asynchrone : il prend sa personne dans la lecture partagée de la fiche (une requête).

import { UserRoundMinus, UserRoundCheck } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import {
  annulerDepartFormAction,
  noterDepartFormAction,
} from "@/features/dossier-client/fiche/actions-depart";
import { aujourdhuiParis } from "@/features/dossier-client/fiche/depart-personne";
import { lireDepartsCache, panneDejaDite } from "./etats-depart";

export async function BoutonDepart(props: {
  clientId: string;
  personneId: string;
  maintenant: Date;
}): Promise<React.ReactElement> {
  const { clientId, personneId, maintenant } = props;
  const lecture = await lireDepartsCache(clientId);
  if (!lecture.ok) {
    const panne = panneDejaDite();
    if (panne.dite) return <></>;
    panne.dite = true;
    return (
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        {`Départ : ${TEXTE_LECTURE_IMPOSSIBLE}`}
      </p>
    );
  }
  const contact = lecture.etats.get(personneId);
  if (contact === undefined) return <></>;
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
            ? `A quitté l'entreprise le ${formatDateFrShort(contact.partiLe)} · Parti`
            : "A quitté l'entreprise · Parti"}
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
      <AdminButton type="submit" variant="secondary" icon={UserRoundCheck}>
        Noter le départ
      </AdminButton>
    </form>
  );
}
