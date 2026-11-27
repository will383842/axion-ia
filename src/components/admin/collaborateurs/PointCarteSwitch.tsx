"use client";
// use-client: interrupteur de ligne qui appelle une action serveur et affiche son refus.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { basculerPointCarte } from "@/server/actions/equipe/collaborateurs";

export function PointCarteSwitch({
  id,
  actif,
  possible,
  version,
}: {
  id: string;
  actif: boolean;
  possible: boolean;
  version: string;
}) {
  const router = useRouter();
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
            const r = await basculerPointCarte(id, suivant, version);
            if (r.ok) {
              setValeur(suivant);
              router.refresh();
            } else setErreur(r.erreur);
          });
        }}
      />
      {erreur ? <small role="alert"> {erreur}</small> : null}
    </span>
  );
}
