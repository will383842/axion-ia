"use client";
// use-client: état du dépôt (useActionState) + jeton Turnstile ; la soumission reste un formulaire natif.

/**
 * Formulaire PUBLIC de réclamation (chantier QNC, L09 — indicateur 31).
 *
 * Bâti sur les briques de /contact : leurre `HoneypotField` (natif, il part avec
 * le formulaire), Turnstile souple (`useTurnstileToken`), composants `ui/`. La
 * soumission est un `<form action>` natif : le FormData est celui du DOM, le
 * leurre y est donc toujours — pas de construction à la main à oublier.
 *
 * Ouvert à toute partie prenante. Depuis l'espace stagiaire, la personne peut
 * choisir sa formation : seule une inscription qui lui appartient sera
 * rattachée (vérifié côté serveur).
 */

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import type {
  EtatDepotReclamation,
  deposerReclamationPubliqueAction,
} from "@/server/actions/qualiopi/reclamation-publique";
import { LIBELLE_QUALITE_DEPOT, QUALITES_DEPOT } from "@/server/qualiopi/reclamations/depot-public";

export interface FormulaireReclamationProps {
  action: typeof deposerReclamationPubliqueAction;
  /** Les formations du stagiaire connecté à son espace (vide sinon). */
  formations: ReadonlyArray<{ enrollmentId: string; libelle: string }>;
  /** Adresse écrite de repli, citée en cas d'échec. */
  adresseContact: string;
}

const ETAT_INITIAL: EtatDepotReclamation = { etat: "initial" };

export function FormulaireReclamation({
  action,
  formations,
  adresseContact,
}: FormulaireReclamationProps) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);
  const { token, widget } = useTurnstileToken("reclamation");

  if (etat.etat === "recue") {
    return (
      <div role="status" className="border-border bg-paper rounded-lg border p-6">
        <p className="text-mocha font-serif text-lg font-semibold">
          Votre réclamation est enregistrée.
        </p>
        <p className="text-fg-soft mt-2 text-sm leading-relaxed">
          {etat.numero !== null ? `Son numéro : ${etat.numero}. ` : ""}
          Un accusé de réception vient de vous être envoyé par e-mail. Une personne de
          l&apos;organisme l&apos;examine et vous répondra par écrit, au plus tard sous 15 jours
          ouvrés.
        </p>
      </div>
    );
  }

  return (
    <form action={soumettre} className="flex flex-col gap-5" noValidate={false}>
      <HoneypotField />
      <input type="hidden" name="cf-turnstile-response" value={token} />

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
        <Label htmlFor="reclamation-nom">Nom et prénom (ou raison sociale)</Label>
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
        <Label htmlFor="reclamation-email">Adresse e-mail</Label>
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
          <Label htmlFor="reclamation-formation">Formation concernée</Label>
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
          <Label htmlFor="reclamation-formation-libre">
            Formation ou session concernée (facultatif)
          </Label>
          <Input id="reclamation-formation-libre" name="formationConcernee" maxLength={300} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="reclamation-objet">Objet</Label>
        <Input id="reclamation-objet" name="objet" required minLength={3} maxLength={300} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reclamation-description">Votre réclamation</Label>
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

      {etat.etat === "erreur" && (
        <p role="alert" className="text-terracotta text-sm">
          {etat.message} ({adresseContact})
        </p>
      )}

      {widget}

      <Button type="submit" disabled={enCours}>
        {enCours ? "Envoi…" : "Déposer ma réclamation"}
      </Button>
    </form>
  );
}
