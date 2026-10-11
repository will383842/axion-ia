/**
 * LieuFormateurPanel — lieu d'exercice d'un formateur (lot L15a, ADR 0066).
 *
 * Server Component, formulaire HTML simple vers une Server Action : aucun
 * JavaScript envoyé au navigateur. Affiche la commune, jamais l'adresse.
 */

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { enregistrerLieuFormateurFormAction } from "@/server/actions/qualiopi/formateur-lieu";
import { messageRetourLieu } from "@/server/qualiopi/formateurs-proches/retour-lieu";

export function LieuFormateurPanel({
  trainerId,
  codePostalPro,
  commune,
  retour,
}: {
  trainerId: string;
  codePostalPro: string | null;
  /** « Annecy (74) », ou `null` si la commune n'est pas encore connue. */
  commune: string | null;
  retour: unknown;
}) {
  const message = messageRetourLieu(retour);
  return (
    <section
      id="lieu-exercice"
      aria-labelledby="lieu-exercice-titre"
      className="admin-card mb-[var(--space-admin-5)]"
    >
      <h2 id="lieu-exercice-titre" className="admin-meta">
        Lieu d&apos;exercice (formateurs proches)
      </h2>
      <p className="text-[length:var(--text-admin-sm)]">
        {commune
          ? `Commune : ${commune}.`
          : codePostalPro
            ? `Code postal ${codePostalPro} : commune à retrouver.`
            : "Lieu à compléter."}
      </p>
      {message ? (
        <p
          role="status"
          className={`admin-alert ${message.ton === "ok" ? "admin-alert-success" : "admin-alert-warning"} mt-[var(--space-admin-2)]`}
        >
          {message.texte}
        </p>
      ) : null}
      <form
        action={enregistrerLieuFormateurFormAction}
        className="mt-[var(--space-admin-3)] flex flex-wrap items-end gap-[var(--space-admin-3)]"
      >
        <input type="hidden" name="trainerId" value={trainerId} />
        <label className="flex flex-col text-[length:var(--text-admin-sm)]">
          Code postal d&apos;exercice
          <input
            name="codePostal"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            required
            defaultValue={codePostalPro ?? ""}
            className="admin-input"
          />
        </label>
        <label className="flex flex-col text-[length:var(--text-admin-sm)]">
          Ville (facultatif)
          <input name="ville" maxLength={120} className="admin-input" />
        </label>
        <AdminButton type="submit">Enregistrer le lieu</AdminButton>
      </form>
    </section>
  );
}
