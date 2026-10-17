/**
 * Les champs du formulaire PUBLIC de réclamation (chantier QNC, L09 —
 * indicateur 31). Server Component : ils sont rendus en HTML et n'envoient
 * aucun JavaScript. Ils sont passés en `children` à `FormulaireReclamation`,
 * l'îlot client qui ne porte que l'état du dépôt, Turnstile et le bouton.
 *
 * Mesuré : rendus dans l'îlot client, ces champs (libellés, cases, `Input`,
 * `Textarea`, leurre) pesaient plus de la moitié du JavaScript de la page.
 * Champs natifs : le FormData envoyé est celui du DOM, leurre compris.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { LIBELLE_QUALITE_DEPOT, QUALITES_DEPOT } from "@/server/qualiopi/reclamations/depot-public";

/** Mêmes classes que `ui/label.tsx` : le `Label` Radix est un module client, ici inutile. */
const CLASSE_LIBELLE = "text-fg text-sm font-medium leading-none";

export interface ChampsReclamationProps {
  /** Les formations du stagiaire connecté à son espace (vide sinon). */
  formations: ReadonlyArray<{ enrollmentId: string; libelle: string }>;
}

export function ChampsReclamation({ formations }: ChampsReclamationProps) {
  return (
    <>
      <HoneypotField />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-fg mb-1 text-sm font-medium">Vous êtes</legend>
        {QUALITES_DEPOT.map((q, i) => (
          <label key={q} className="text-fg flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="qualite"
              value={q}
              required
              defaultChecked={formations.length > 0 ? q === "stagiaire" : i === 0}
            />
            {LIBELLE_QUALITE_DEPOT[q]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className={CLASSE_LIBELLE} htmlFor="reclamation-nom">
          Nom et prénom (ou raison sociale)
        </label>
        <Input
          id="reclamation-nom"
          name="nom"
          required
          minLength={2}
          maxLength={200}
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={CLASSE_LIBELLE} htmlFor="reclamation-email">
          Adresse e-mail
        </label>
        <Input
          id="reclamation-email"
          name="email"
          type="email"
          required
          maxLength={255}
          autoComplete="email"
          aria-describedby="reclamation-email-aide"
        />
        <p id="reclamation-email-aide" className="text-fg-muted text-xs">
          L&apos;accusé de réception et la réponse écrite vous y seront adressés.
        </p>
      </div>

      {formations.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label className={CLASSE_LIBELLE} htmlFor="reclamation-formation">
            Formation concernée
          </label>
          <select
            id="reclamation-formation"
            name="enrollmentId"
            className="border-border-strong bg-paper text-fg h-12 rounded-lg border px-4 text-base"
            defaultValue=""
          >
            <option value="">— aucune en particulier —</option>
            {formations.map((f) => (
              <option key={f.enrollmentId} value={f.enrollmentId}>
                {f.libelle}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className={CLASSE_LIBELLE} htmlFor="reclamation-formation-libre">
            Formation ou session concernée (facultatif)
          </label>
          <Input id="reclamation-formation-libre" name="formationConcernee" maxLength={300} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className={CLASSE_LIBELLE} htmlFor="reclamation-objet">
          Objet
        </label>
        <Input id="reclamation-objet" name="objet" required minLength={3} maxLength={300} />
      </div>

      <div className="flex flex-col gap-2">
        <label className={CLASSE_LIBELLE} htmlFor="reclamation-description">
          Votre réclamation
        </label>
        <Textarea
          id="reclamation-description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
        />
      </div>

      <label className="text-fg-soft flex items-start gap-2 text-sm leading-relaxed">
        <input type="checkbox" name="consentement" required className="mt-1" />
        <span>
          J&apos;accepte que les informations de ce formulaire soient enregistrées au registre des
          réclamations de l&apos;organisme, pour le traitement de ma demande et pendant la durée de
          conservation légale.
        </span>
      </label>
    </>
  );
}
