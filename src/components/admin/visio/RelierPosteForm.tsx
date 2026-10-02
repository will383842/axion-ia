"use client";
// use-client: le jeton créé par « Relier » n'existe que dans la réponse de l'action, posé pour le relais.

// « Relier ce navigateur à la console » (extension 1.4.0, 2026-10-02). La page
// Enregistreur ouverte par l'extension (`?relier=<nonce>`) montre ce
// formulaire. « Relier » crée le jeton ; il est posé dans un élément MASQUÉ
// (`data-relier-nonce`, `data-relier-jeton`) que le relais de l'extension
// transmet à son service worker, puis marque `data-relier-etat` (ok / refuse).
// Le jeton n'est jamais affiché, ni écrit dans une URL.
//
// Relecture sécurité (02/10) : le jeton ne vit que le temps de la liaison.
// Il est gardé dans un état LOCAL (l'état de l'action n'en garde pas copie) et
// retiré dès la réponse ou le délai écoulé. Refus ou silence : l'appareil créé
// est révoqué (`annuler`), pour ne laisser aucun jeton actif que personne n'a.

import { useActionState, useEffect, useRef, useState } from "react";

import type { EtatLiaison } from "@/features/admin-enregistreur/etat-jeton";

export interface RelierPosteFormProps {
  readonly action: (etat: EtatLiaison, form: FormData) => Promise<EtatLiaison>;
  /** Révoque l'appareil d'une liaison non aboutie. */
  readonly annuler: (appareilId: string) => Promise<boolean>;
  readonly nonce: string;
  /** Délai d'attente de l'extension (réglable pour les tests). */
  readonly sansReponseMs?: number;
}

type Porte = { readonly nonce: string; readonly jeton: string; readonly appareilId: string };

export function RelierPosteForm({
  action,
  annuler,
  nonce,
  sansReponseMs = 8000,
}: RelierPosteFormProps): React.ReactElement {
  const [porte, setPorte] = useState<Porte | null>(null);
  const [reponse, setReponse] = useState<"attente" | "ok" | "echec">("attente");
  const [etat, envoyer, enCours] = useActionState(
    async (prec: EtatLiaison, form: FormData): Promise<EtatLiaison> => {
      const r = await action(prec, form);
      if (r.etat !== "relie") return r;
      setPorte({ nonce: r.nonce, jeton: r.jeton, appareilId: r.appareilId });
      // L'état de l'action ne garde pas le jeton.
      return { ...r, jeton: "" };
    },
    { etat: "initial" } as EtatLiaison,
  );
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = element.current;
    if (!porte || !el) return;
    let fini = false;
    const conclure = (ok: boolean) => {
      if (fini) return;
      fini = true;
      const appareilId = porte.appareilId;
      setPorte(null);
      setReponse(ok ? "ok" : "echec");
      if (!ok) void annuler(appareilId).catch(() => false);
    };
    const lire = () => {
      const v = el.getAttribute("data-relier-etat");
      if (v === "ok") conclure(true);
      else if (v === "refuse") conclure(false);
    };
    const obs = new MutationObserver(lire);
    obs.observe(el, { attributes: true });
    const delai = setTimeout(() => conclure(false), sansReponseMs);
    lire();
    return () => {
      obs.disconnect();
      clearTimeout(delai);
    };
    // `etat` : la porte peut arriver un rendu AVANT l'élément (mise à jour hors
    // transition) ; l'effet se relance quand l'élément apparaît.
  }, [porte, etat, annuler, sansReponseMs]);

  if (etat.etat === "relie") {
    return (
      <div role="status">
        {porte ? (
          <span
            ref={element}
            hidden
            data-relier-nonce={porte.nonce}
            data-relier-jeton={porte.jeton}
          />
        ) : null}
        <p className="font-medium">
          {reponse === "ok"
            ? "Relié ✓ — vous pouvez fermer cet onglet"
            : reponse === "echec"
              ? "Liaison non aboutie, rien n'a été gardé. Relancez depuis l'extension."
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
