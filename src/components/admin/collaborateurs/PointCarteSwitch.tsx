"use client";
// use-client: interrupteur de ligne qui appelle une action serveur et affiche son refus.

import { useState, useTransition } from "react";

import { basculerPointCarte } from "@/server/actions/equipe/collaborateurs";

export function PointCarteSwitch({
  id,
  actif,
  possible,
}: {
  id: string;
  actif: boolean;
  possible: boolean;
}) {
  const [valeur, setValeur] = useState(actif);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <span>
      <input
        type="checkbox"
        aria-label="Point sur la carte"
        checked={valeur}
        disabled={enCours || (!possible && !valeur)}
        onChange={(e) => {
          const suivant = e.target.checked;
          demarrer(async () => {
            setErreur(null);
            const r = await basculerPointCarte(id, suivant);
            if (r.ok) setValeur(suivant);
            else setErreur(r.erreur);
          });
        }}
      />
      {erreur ? <small role="alert"> {erreur}</small> : null}
    </span>
  );
}
