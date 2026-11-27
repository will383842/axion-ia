"use client";
// use-client: formulaire de demande de changement de compte (fichier RIB, état d'envoi).
// Les textes sont ceux du plan §12.1. Aucun IBAN entier n'est rendu : seulement la fin.
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { annulerChangementCompteAction, demanderChangementCompteAction } from "./actions-compte";
import { TEXTES_COMPTE as T } from "./textes-compte";

const champ =
  "border-border-strong bg-paper focus:border-terracotta mt-1 block min-h-[52px] w-full rounded-xl border px-3.5 text-[17px]";
const bouton =
  "bg-terracotta hover:bg-terracotta-deep inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl px-6 text-[18px] font-bold text-white disabled:opacity-60";

export type VueCompte =
  | {
      etat: "ferme" | "normal" | "a-confirmer" | "sans-telephone";
      fin4: string | null;
      demandeId: string | null;
    }
  | {
      etat: "confirmee";
      fin4: string | null;
      demandeId: string | null;
      demandee: string;
      reponse: string;
    }
  | { etat: "refusee"; fin4: string | null; demandeId: string | null; motif: string };

export function MonCompteBancaire({
  id,
  jeton,
  vue,
}: {
  id: string;
  jeton: string;
  vue: VueCompte;
}) {
  const uid = useId();
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, demarrer] = useTransition();
  const actuel = vue.fin4 ? <p className="mt-2 text-[17px]">{T.compteActuel(vue.fin4)}</p> : null;

  const annuler = (demandeId: string | null) => (
    <form
      className="mt-4"
      action={(fd) =>
        demarrer(async () => {
          const r = await annulerChangementCompteAction(fd);
          if (r.ok) routeur.refresh();
          else setErreur(r.message);
        })
      }
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="jeton" value={jeton} />
      <input type="hidden" name="demandeId" value={demandeId ?? ""} />
      <button type="submit" className={bouton} disabled={occupe}>
        {T.annuler}
      </button>
    </form>
  );

  return (
    <section aria-labelledby={`${uid}-t`} className="mt-8">
      <h2 id={`${uid}-t`} className="font-display text-[24px]">
        {vue.etat === "a-confirmer"
          ? T.regardezTitre
          : vue.etat === "confirmee"
            ? T.enCoursTitre
            : vue.etat === "refusee"
              ? T.refuseTitre
              : vue.etat === "sans-telephone"
                ? T.sansTelTitre
                : T.titre}
      </h2>
      {vue.etat === "ferme" ? (
        <>
          {actuel}
          <p className="mt-2 text-[17px]">{T.ferme}</p>
        </>
      ) : null}
      {vue.etat === "sans-telephone" ? <p className="mt-2 text-[17px]">{T.sansTelLigne}</p> : null}
      {vue.etat === "a-confirmer" ? (
        <>
          <p className="mt-2 text-[17px]">{T.regardezLigne}</p>
          {annuler(vue.demandeId)}
        </>
      ) : null}
      {vue.etat === "confirmee" ? (
        <>
          <p className="mt-2 text-[17px]">
            {T.enCoursLigne(vue.demandee, vue.reponse, vue.fin4 ?? "")}
          </p>
          {annuler(vue.demandeId)}
        </>
      ) : null}
      {vue.etat === "refusee" || vue.etat === "normal" ? (
        <>
          {vue.etat === "refusee" ? (
            <p className="mt-2 text-[17px]">
              {T.refuseRaison} {vue.motif} {T.refuseLigne}
            </p>
          ) : null}
          {actuel}
          {!ouvert ? (
            <button type="button" className={`${bouton} mt-4`} onClick={() => setOuvert(true)}>
              {T.changer}
            </button>
          ) : (
            <form
              className="mt-4 space-y-4"
              action={(fd) =>
                demarrer(async () => {
                  setErreur(null);
                  const r = await demanderChangementCompteAction(fd);
                  if (r.ok) routeur.refresh();
                  else setErreur(r.message);
                })
              }
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="jeton" value={jeton} />
              <h3 className="text-[19px] font-semibold">{T.formTitre}</h3>
              <label className="block text-[15px] font-semibold" htmlFor={`${uid}-iban`}>
                {T.formIban}
                <input
                  id={`${uid}-iban`}
                  name="iban"
                  className={champ}
                  autoComplete="off"
                  inputMode="text"
                  maxLength={60}
                  required
                />
              </label>
              <label className="block text-[15px] font-semibold" htmlFor={`${uid}-rib`}>
                {T.formRib}
                <input
                  id={`${uid}-rib`}
                  name="rib"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className={champ}
                  required
                />
                <span className="text-fg-soft block text-[15px] font-normal">{T.formRibAide}</span>
              </label>
              <div>
                <p className="text-[16px] font-semibold">{T.ceQuiVaSePasser}</p>
                <ul className="list-disc pl-6 text-[16px]">
                  <li>{T.etape1}</li>
                  <li>{T.etape2}</li>
                  <li>{T.etape3}</li>
                </ul>
              </div>
              <button type="submit" className={bouton} disabled={occupe}>
                {T.envoyer}
              </button>
            </form>
          )}
        </>
      ) : null}
      {erreur ? (
        <p role="alert" className="text-danger mt-3 text-[16px] font-semibold">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}
