"use client";
// use-client: formulaire de déclaration d'entreprise (saisie, validation côté serveur,
// confirmation à l'écran sans quitter la page).

// Le formulaire de l'article 3.2 du contrat : l'entreprise (nom, SIRET de l'établissement), la personne
// rencontrée (nom, fonction, e‑mail, téléphone) et la date du contact. Toute la validation
// fait foi côté serveur ; ici on aide seulement (types de champs, date plafonnée à
// aujourd'hui, nom prérempli depuis le registre). Rien n'est envoyé à l'entreprise.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  declarerEntrepriseAction,
  rechercherEntrepriseDeclarationAction,
} from "./actions-declaration";
import { TEXTES } from "./textes";
import { TEXTES_DECLARATION as T } from "./textes-declaration";

const champ =
  "border-border-strong bg-paper focus:border-terracotta focus:outline-terracotta mt-1 block min-h-[52px] w-full rounded-xl border px-3.5 text-[17px] focus:outline-2 focus:outline-offset-1";
const etiquette = "text-fg-soft block text-[15px] font-semibold";
const bouton =
  "bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-6 text-[18px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid disabled:bg-sand-deep disabled:text-fg-soft disabled:cursor-not-allowed";

function Champ({
  uid,
  nom,
  libelle,
  longueur,
  type = "text",
  mode,
  ...reste
}: {
  uid: string;
  nom: string;
  libelle: string;
  longueur: number;
  type?: string;
  mode?: "numeric" | "email" | "tel";
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "maxLength">) {
  return (
    <div>
      <label htmlFor={`${uid}-${nom}`} className={etiquette}>
        {libelle}
      </label>
      <input
        id={`${uid}-${nom}`}
        name={nom}
        type={type}
        {...(mode ? { inputMode: mode } : {})}
        autoComplete="off"
        required
        maxLength={longueur}
        className={champ}
        {...reste}
      />
    </div>
  );
}

export function DeclarationEntreprise({
  id,
  jeton,
  protectionMois,
}: {
  id: string;
  jeton: string;
  /** Durée de la réservation (`PROTECTION_MOIS`), passée par la page : jamais écrite ici. */
  protectionMois: number;
}) {
  const router = useRouter();
  const uid = useId();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [recue, setRecue] = useState(false);
  const [denomination, setDenomination] = useState("");
  // « Aujourd'hui » en heure de Paris, comme le serveur (et non en UTC : entre 00 h et 02 h
  // la date UTC est celle d'hier et refuserait le jour même).
  const aujourdhui = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );

  async function completerNom(siret: string) {
    const s = siret.replace(/\s+/g, "");
    if (!/^\d{14}$/.test(s) || denomination) return;
    const r = await rechercherEntrepriseDeclarationAction(id, jeton, s);
    if (r.ok && r.denomination) setDenomination((d) => d || r.denomination || "");
  }

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulaire = e.currentTarget;
    const fd = new FormData(formulaire);
    fd.set("id", id);
    fd.set("jeton", jeton);
    setErreur(null);
    demarrer(async () => {
      try {
        const r = await declarerEntrepriseAction(fd);
        if (r.ok) {
          formulaire.reset();
          setDenomination("");
          setRecue(true);
          router.refresh();
        } else {
          setErreur(r.message);
        }
      } catch {
        // Connexion perdue : la saisie reste à l'écran (le formulaire n'est pas réinitialisé).
        setErreur(TEXTES.connexionPerdue);
      }
    });
  }

  if (recue) {
    return (
      <section className="bg-paper shadow-card mt-5 rounded-2xl p-4 sm:p-5" aria-live="polite">
        <p className="font-serif text-[22px] font-medium">{T.confirmationTitre}</p>
        <p className="text-fg-soft mt-1 text-[17px]">{T.confirmationLigne}</p>
        <button type="button" className={`${bouton} mt-4`} onClick={() => setRecue(false)}>
          {T.autre}
        </button>
      </section>
    );
  }

  return (
    <section className="bg-paper shadow-card mt-5 rounded-2xl p-4 sm:p-5" aria-busy={enCours}>
      <h2 className="font-serif text-[24px] leading-tight font-medium">{T.titre}</h2>
      <div className="bg-sand mt-3 rounded-xl p-3 text-[15px] leading-relaxed">
        <p className="font-bold">{T.commentTitre}</p>
        <ul className="mt-1 grid gap-1">
          {T.comment(protectionMois).map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      </div>
      <p className="text-fg-soft mt-3 text-[16px]">{T.ligne}</p>
      <form onSubmit={envoyer} className="mt-4 grid gap-4">
        <fieldset className="grid gap-3">
          <legend className="text-[17px] font-bold">{T.entreprise}</legend>
          <Champ
            uid={uid}
            nom="siret"
            libelle={T.siret}
            longueur={20}
            mode="numeric"
            onBlur={(e) => void completerNom(e.target.value)}
          />
          <Champ
            uid={uid}
            nom="denomination"
            libelle={T.denomination}
            longueur={250}
            value={denomination}
            onChange={(e) => setDenomination(e.target.value)}
          />
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-[17px] font-bold">{T.personne}</legend>
          <Champ uid={uid} nom="personneNom" libelle={T.nom} longueur={150} />
          <Champ uid={uid} nom="personneFonction" libelle={T.fonction} longueur={150} />
          <Champ
            uid={uid}
            nom="personneEmail"
            libelle={T.email}
            longueur={254}
            type="email"
            mode="email"
          />
          <Champ
            uid={uid}
            nom="personneTelephone"
            libelle={T.telephone}
            longueur={30}
            type="tel"
            mode="tel"
          />
          <Champ
            uid={uid}
            nom="dateContact"
            libelle={T.dateContact}
            longueur={10}
            type="date"
            max={aujourdhui}
          />
          <Champ
            uid={uid}
            nom="personneRencontre"
            libelle={T.rencontre}
            longueur={150}
            required={false}
          />
        </fieldset>
        {erreur ? (
          <p
            role="alert"
            className="bg-terracotta-soft text-error rounded-xl p-3 text-[16px] font-semibold"
          >
            {erreur}
          </p>
        ) : null}
        <button type="submit" className={bouton} disabled={enCours}>
          {enCours ? T.envoi : T.envoyer}
        </button>
      </form>
    </section>
  );
}
