"use client";
// use-client: un bouton qui envoie un POST et affiche le résultat sans quitter la page.
import { useState, useTransition } from "react";

import { TEXTES_COMPTE as T } from "../../../[id]/[jeton]/textes-compte";

import type { ResultatLien } from "./actions";

const bouton =
  "bg-terracotta hover:bg-terracotta-deep inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl px-6 text-[18px] font-bold text-white disabled:opacity-60";

export function FormulaireLien({
  action,
  demande,
  signature,
  libelle,
  fait,
}: {
  action: (fd: FormData) => Promise<ResultatLien>;
  demande: string;
  signature: string;
  libelle: string;
  /** Le texte affiché après le clic réussi. */
  fait: string;
}) {
  const [etat, setEtat] = useState<"attente" | "ok" | "mort">("attente");
  const [occupe, demarrer] = useTransition();
  if (etat === "ok") return <p className="text-[17px]">{fait}</p>;
  if (etat === "mort") return <p className="text-[17px]">{T.lienMort}</p>;
  return (
    <form
      action={(fd) =>
        demarrer(async () => {
          const r = await action(fd);
          setEtat(r.ok ? "ok" : "mort");
        })
      }
    >
      <input type="hidden" name="demande" value={demande} />
      <input type="hidden" name="signature" value={signature} />
      <button type="submit" className={bouton} disabled={occupe}>
        {libelle}
      </button>
    </form>
  );
}
