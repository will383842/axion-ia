"use client";
// use-client: état local (useReducer), focus et gestionnaires d événements de l assistant.

/**
 * Assistant de devis — coquille (fiche E06). Un seul état (`useReducer`), le stepper, le
 * contrôle d'étape au clic sur « Continuer », la sauvegarde attendue avant de changer d'étape.
 * Le contenu des étapes est injecté (`rendreEtape`) : les étapes 1b à 4 sont chargées à la
 * demande par la page (E17), jamais importées ici.
 *
 * Accessibilité : focus sur le titre à chaque changement d'étape, annonce `aria-live`,
 * erreurs en `role="alert"`. Entrée dans un champ n'avance jamais (aucun formulaire).
 */
import { useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";

import { controlerEtape, deserialiser, etatInitial, reducteur, serialiser } from "./etat";
import type { ActionAssistant } from "./etat";
import { annonceEtape, rangPastille, Stepper, PASTILLES } from "./Stepper";
import { ETAPES, type Etape, type EtatAssistant, type EtatSerialise } from "./types";

export type ResultatSauvegarde = { ok: true } | { ok: false; erreur: string };

export interface ContexteEtape {
  etape: Etape;
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

export interface PropsAssistantDevis {
  validiteParDefaut: string;
  formulesActives: boolean;
  defaultClientId?: string | undefined;
  projetId?: string | undefined;
  rencontreId?: string | undefined;
  brouillonInitial?: { id: string; majLe: string; donnees: EtatSerialise } | undefined;
  /** Sauvegarde du brouillon (E07) ; absente = rien à enregistrer. */
  sauvegarder?: ((s: EtatSerialise) => Promise<ResultatSauvegarde>) | undefined;
  rendreEtape?: ((ctx: ContexteEtape) => ReactNode) | undefined;
}

const SOUS_TITRE_1B = "Client et projet › Phases";

function titreEtape(etape: Etape): string {
  return etape === "1b" ? SOUS_TITRE_1B : PASTILLES[rangPastille(etape) - 1]!.libelle;
}

function depart(p: PropsAssistantDevis): {
  etat: EtatAssistant;
  etape: Etape;
  erreur: string | null;
} {
  const neuf = etatInitial({
    defaultClientId: p.defaultClientId,
    projetId: p.projetId,
    rencontreId: p.rencontreId,
    validiteParDefaut: p.validiteParDefaut,
    formulesActives: p.formulesActives,
  });
  if (!p.brouillonInitial) return { etat: neuf, etape: 1, erreur: null };
  const lu = deserialiser(p.brouillonInitial.donnees);
  return lu.ok
    ? { etat: lu.etat, etape: lu.etape, erreur: null }
    : {
        etat: neuf,
        etape: 1,
        erreur: `${lu.erreur} Il ne sera pas modifié : vos saisies iront dans un nouveau brouillon.`,
      };
}

/** Vrai si le brouillon repris ne peut pas être lu (à passer à `useBrouillonAuto`). */
export function brouillonEstIllisible(b: PropsAssistantDevis["brouillonInitial"]): boolean {
  return b !== undefined && !deserialiser(b.donnees).ok;
}

export function AssistantDevis(props: PropsAssistantDevis) {
  const [init] = useState(() => depart(props));
  const [etat, dispatch] = useReducer(reducteur, init.etat);
  const [etape, setEtape] = useState<Etape>(init.etape);
  const [erreurs, setErreurs] = useState<string[]>(init.erreur ? [init.erreur] : []);
  const [enCours, setEnCours] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);
  const premierRendu = useRef(true);

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    titre.current?.focus();
  }, [etape]);

  const index = ETAPES.indexOf(etape);

  async function continuer() {
    const errs = controlerEtape(etat, etape);
    if (errs.length > 0) {
      setErreurs(errs);
      return;
    }
    const suivante = ETAPES[index + 1];
    if (suivante === undefined) return;
    setErreurs([]);
    setEnCours(true);
    try {
      if (props.sauvegarder) {
        const r = await props.sauvegarder(serialiser(etat, suivante));
        if (!r.ok) {
          setErreurs([r.erreur]);
          return;
        }
      }
      setEtape(suivante);
    } finally {
      setEnCours(false);
    }
  }

  function aller(cible: Etape) {
    // Pendant une sauvegarde, `continuer` posera l'étape suivante : aucun saut ne doit la précéder.
    if (enCours) return;
    setErreurs([]);
    setEtape(cible);
  }

  return (
    <div>
      <Stepper etape={etape} onAller={aller} desactive={enCours} />
      <h2 ref={titre} tabIndex={-1} className="mb-[var(--space-admin-4,8px)] outline-none">
        {titreEtape(etape)}
      </h2>
      <p role="status" aria-live="polite" className="sr-only">
        {annonceEtape(etape)}
      </p>
      {erreurs.length > 0 ? (
        <div role="alert" className="mb-[var(--space-admin-4,8px)]">
          <ul className="list-disc pl-5">
            {erreurs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="min-h-[24rem]">{props.rendreEtape?.({ etape, etat, dispatch })}</div>
      <div className="mt-[var(--space-admin-6,16px)] flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-[44px] rounded border px-4"
          onClick={() => aller(ETAPES[index - 1]!)}
          disabled={index === 0 || enCours}
        >
          Retour
        </button>
        {index < ETAPES.length - 1 ? (
          <button
            type="button"
            className="min-h-[44px] rounded bg-[color:var(--color-admin-accent)] px-4 text-white"
            onClick={() => void continuer()}
            disabled={enCours}
          >
            {enCours ? "Enregistrement…" : "Continuer"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
