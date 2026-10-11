/**
 * DossierEnLignePanel — le dossier en ligne d'un formateur indépendant (lot L6).
 *
 * Server Component, formulaires HTML simples vers des Server Actions : aucun JavaScript
 * envoyé au navigateur. Affiché seulement quand l'interrupteur `dossier_en_ligne` est
 * allumé et que la fiche a un dossier. N'affiche aucune donnée du dossier lui-même.
 */

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  demanderComplementFormAction,
  renvoyerLienDossierFormAction,
} from "@/server/actions/qualiopi/formateur-dossier-envois";
import { MOTIFS_COMPLEMENT } from "@/server/qualiopi/formateurs-independants/envois-dossier";
import { messageRetourDossier } from "@/server/qualiopi/formateurs-independants/retour-dossier";

const LIBELLE_STATUT: Record<string, string> = {
  en_cours: "En cours de saisie",
  a_completer: "À compléter par le formateur",
  a_verifier: "Reçu, à vérifier",
  verifie: "Vérifié",
};

export function DossierEnLignePanel({
  trainerId,
  dossierStatut,
  retour,
}: {
  trainerId: string;
  dossierStatut: string;
  retour: unknown;
}) {
  const message = messageRetourDossier(retour);
  return (
    <section
      id="dossier-en-ligne"
      aria-labelledby="dossier-en-ligne-titre"
      className="admin-card mb-[var(--space-admin-5)]"
    >
      <h2 id="dossier-en-ligne-titre" className="admin-meta">
        Dossier en ligne
      </h2>
      <p className="text-[length:var(--text-admin-sm)]">
        {LIBELLE_STATUT[dossierStatut] ?? dossierStatut}
      </p>
      {message ? (
        <p
          role="status"
          className={`admin-alert ${message.ton === "ok" ? "admin-alert-success" : "admin-alert-warning"} mt-[var(--space-admin-2)]`}
        >
          {message.texte}
        </p>
      ) : null}
      {dossierStatut === "en_cours" || dossierStatut === "a_completer" ? (
        <form action={renvoyerLienDossierFormAction} className="mt-[var(--space-admin-3)]">
          <input type="hidden" name="trainerId" value={trainerId} />
          <AdminButton type="submit">Renvoyer le lien</AdminButton>
        </form>
      ) : null}
      {dossierStatut === "a_verifier" ? (
        <form
          action={demanderComplementFormAction}
          className="mt-[var(--space-admin-3)] flex flex-wrap items-end gap-[var(--space-admin-3)]"
        >
          <input type="hidden" name="trainerId" value={trainerId} />
          <label className="flex flex-col text-[length:var(--text-admin-sm)]">
            Il manque
            <select name="motif" required className="admin-input" defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(MOTIFS_COMPLEMENT).map(([cle, texte]) => (
                <option key={cle} value={cle}>
                  {texte}
                </option>
              ))}
            </select>
          </label>
          <AdminButton type="submit">Demander un complément</AdminButton>
        </form>
      ) : null}
    </section>
  );
}
