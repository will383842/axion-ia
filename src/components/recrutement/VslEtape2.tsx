"use client";
// use-client: formulaire de l'étape 2 (état contrôlé, focus) chargé à la demande par `VslFormulaire`.

// Étape 2 de la page VSL apporteurs : téléphone + « combien de dirigeants
// connaissez-vous à peu près ? » (quatre réponses, un tap). Composant de
// PRÉSENTATION : l'état et l'envoi restent dans `VslFormulaire`.

import * as React from "react";
import {
  Chip,
  ChipGroup,
  PrimaryButton,
  TextField,
} from "@/components/forms/commercial-application/ui";
import { VSL_FORMULAIRE, VSL_REPONSES } from "@/content/recrutement/vsl-apporteur-client";
import type { ReponseNombreDirigeants } from "@/features/commercial-application/lead-vsl-contrat";
import type { EtatVsl } from "@/lib/recrutement/vsl-etat";
import type { ErreursEtape2 } from "@/lib/recrutement/vsl-validation";

// Une seule ligne à 360 px (« Envoyer et choisir mon créneau → » passait sur deux) :
// `whitespace-nowrap`, 15 px et marge réduite sous `sm`, 16 px au-delà.
const BOUTON_TERRACOTTA =
  "bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta-deep shadow-none whitespace-nowrap px-3 text-[15px] sm:px-6 sm:text-base";

interface VslEtape2Props {
  formRef: React.RefObject<HTMLFormElement | null>;
  titreRef: React.RefObject<HTMLHeadingElement | null>;
  etat: EtatVsl;
  erreurs: ErreursEtape2;
  erreurServeur: string | null;
  envoi: boolean;
  onSubmit: (ev: React.FormEvent<HTMLFormElement>) => void;
  onTelephone: (valeur: string) => void;
  onTelephoneBlur: () => void;
  onReponse: (valeur: ReponseNombreDirigeants) => void;
  onRetour: () => void;
}

export function VslEtape2({
  formRef,
  titreRef,
  etat,
  erreurs,
  erreurServeur,
  envoi,
  onSubmit,
  onTelephone,
  onTelephoneBlur,
  onReponse,
  onRetour,
}: VslEtape2Props) {
  const f2 = VSL_FORMULAIRE.etape2;
  // Le titre prend le focus à l'arrivée (focus déjà demandé par l'étape 1).
  React.useEffect(() => {
    titreRef.current?.focus();
  }, [titreRef]);
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="vsl-titre-etape">
      <p className="text-terracotta-deep text-[14px] font-semibold tracking-[0.16em] uppercase">
        {f2.eyebrow}
      </p>
      <h3
        id="vsl-titre-etape"
        ref={titreRef}
        tabIndex={-1}
        className="text-fg mt-2 font-serif text-2xl leading-tight font-semibold outline-none"
      >
        {f2.titre}
      </h3>

      <div className="mt-5 grid gap-5">
        <div>
          <TextField
            label={f2.telephone}
            fieldId="vsl-telephone"
            name="telephone"
            type="tel"
            inputMode="tel"
            requiredField
            value={etat.telephone}
            onChange={(e) => onTelephone(e.target.value)}
            onBlur={onTelephoneBlur}
            autoComplete="tel"
            maxLength={40}
            error={erreurs.telephone}
          />
          <p className="text-fg-soft mt-1 text-[14px]">{f2.telephoneAide}</p>
        </div>

        <ChipGroup legend={f2.question} requiredField error={erreurs.reponse}>
          {VSL_REPONSES.map((r) => (
            <Chip
              key={r.id}
              name="reponse"
              value={r.id}
              label={r.libelle}
              checked={etat.reponse === r.id}
              onToggle={(v) => onReponse(v as ReponseNombreDirigeants)}
            />
          ))}
        </ChipGroup>
      </div>

      {erreurServeur ? (
        <p role="alert" className="text-terracotta-deep mt-4 text-sm font-medium">
          {erreurServeur}
        </p>
      ) : null}

      <PrimaryButton
        type="submit"
        disabled={envoi}
        className={`mt-6 ${BOUTON_TERRACOTTA}`}
        data-cta="vsl-etape2-envoyer"
      >
        {envoi ? "Envoi…" : `${f2.bouton} →`}
      </PrimaryButton>
      <p className="text-fg-soft mt-3 text-center text-[14px]">{f2.micro}</p>
      <p className="mt-1 text-center">
        <button
          type="button"
          onClick={onRetour}
          className="text-terracotta-deep inline-flex min-h-11 items-center px-2 text-[14px] underline underline-offset-2"
        >
          {f2.retour}
        </button>
      </p>
    </form>
  );
}
