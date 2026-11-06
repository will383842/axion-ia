"use client";
// use-client: édition interactive d'un brouillon à formules (état local de la saisie, useTransition pour modifierDevisBrouillonAction).

/**
 * Édition d'un brouillon à formules. `attenduMajLe` est la version lue au chargement :
 * si un autre onglet a enregistré entre-temps, l'action refuse et on demande de recharger.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierDevisBrouillonAction } from "@/server/actions/qualiopi/devis-formules";
import {
  construireOffre,
  type SaisieFormules,
  type TexteCopie,
} from "@/features/devis-formules/saisie";
import { DevisFormulesPanel } from "./DevisFormulesPanel";

interface Props {
  devisId: string;
  attenduMajLe: string;
  saisieInitiale: SaisieFormules;
  /** Textes déjà copiés dans l'offre : conservés tels quels à l'enregistrement. */
  textes: TexteCopie[];
  retourHref: string;
}

export function DevisFormulesEdition({
  devisId,
  attenduMajLe,
  saisieInitiale,
  textes,
  retourHref,
}: Props): React.ReactElement {
  const router = useRouter();
  const [saisie, setSaisie] = useState(saisieInitiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const offre = construireOffre(saisie, textes);
    if (!offre.ok) {
      setErreur(offre.erreurs.join(" · "));
      return;
    }
    startTransition(async () => {
      const r = await modifierDevisBrouillonAction({
        id: devisId,
        attenduMajLe,
        offre: offre.offre,
      });
      if ("error" in r) setErreur(r.error);
      else router.push(retourHref);
    });
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-[var(--space-admin-6)]">
      <DevisFormulesPanel saisie={saisie} onChange={setSaisie} disabled={pending} />
      {erreur !== null ? (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-paper)]"
        >
          {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
        </button>
      </div>
    </form>
  );
}
