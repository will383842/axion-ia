"use client";
// use-client: le jeton créé par « Relier » n'existe que dans la réponse de l'action, posé pour le relais.

// « Relier ce navigateur à la console » (extension 1.4.0, 2026-10-02). La page
// Enregistreur ouverte par l'extension (`?relier=<nonce>`) montre ce
// formulaire. « Relier » crée le jeton ; il est posé dans un élément MASQUÉ
// (`data-relier-nonce`, `data-relier-jeton`) que le relais de l'extension
// transmet à son service worker, puis marque `data-relier-etat` (ok / refuse).
// Le jeton n'est jamais affiché, ni écrit dans une URL.

import { useActionState, useEffect, useRef, useState } from "react";

import type { EtatLiaison } from "@/features/admin-enregistreur/etat-jeton";

export interface RelierPosteFormProps {
  readonly action: (etat: EtatLiaison, form: FormData) => Promise<EtatLiaison>;
  readonly nonce: string;
}

const SANS_REPONSE_MS = 8000;

export function RelierPosteForm({ action, nonce }: RelierPosteFormProps): React.ReactElement {
  const [etat, envoyer, enCours] = useActionState(action, { etat: "initial" } as EtatLiaison);
  const porteur = useRef<HTMLSpanElement>(null);
  const [reponse, setReponse] = useState<"attente" | "ok" | "refuse" | "muette">("attente");

  useEffect(() => {
    const el = porteur.current;
    if (etat.etat !== "relie" || !el) return;
    const lire = () => {
      const v = el.getAttribute("data-relier-etat");
      if (v === "ok" || v === "refuse") setReponse(v);
    };
    const obs = new MutationObserver(lire);
    obs.observe(el, { attributes: true });
    const delai = setTimeout(
      () => setReponse((r) => (r === "attente" ? "muette" : r)),
      SANS_REPONSE_MS,
    );
    lire();
    return () => {
      obs.disconnect();
      clearTimeout(delai);
    };
  }, [etat]);

  if (etat.etat === "relie") {
    return (
      <div role="status">
        <span ref={porteur} hidden data-relier-nonce={etat.nonce} data-relier-jeton={etat.jeton} />
        <p className="font-medium">
          {reponse === "ok"
            ? "Relié ✓ — vous pouvez fermer cet onglet"
            : reponse === "refuse"
              ? "L'extension a refusé la liaison (lien expiré ou déjà utilisé) : relancez « Relier à ma console » depuis l'extension."
              : reponse === "muette"
                ? "L'extension ne répond pas : vérifiez qu'elle est installée (1.4.0) dans ce profil Chrome, puis relancez « Relier à ma console »."
                : "Liaison en cours…"}
        </p>
      </div>
    );
  }

  return (
    <form action={envoyer}>
      <input type="hidden" name="nonce" value={nonce} />
      <label>
        Nom du poste
        <input name="nom" defaultValue="Poste de Williams" maxLength={80} className="admin-input" />
      </label>
      <button disabled={enCours} className="admin-button">
        Relier
      </button>
      {etat.etat === "erreur" ? <p role="alert">{etat.message}</p> : null}
    </form>
  );
}
