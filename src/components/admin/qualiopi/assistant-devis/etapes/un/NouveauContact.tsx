"use client";
// use-client: petit formulaire contrôlé avec appel d action injecté et état « en cours ».

/**
 * « + Nouveau contact » (fiche E08). La fiche prospect est créée TOUT DE SUITE (D5), par
 * l'action injectée (`createClientAction` côté page : aucun import serveur ici). Un refus du
 * serveur (même SIREN, même e-mail…) s'affiche tel quel, rien n'est ajouté à la liste.
 */
import { useRef, useState } from "react";

import type { ClientOption } from "./BlocClient";

export interface EntreeNouveauContact {
  type: "entreprise";
  raisonSociale: string;
  contactNom?: string;
  contactEmail?: string;
}
export type ResultatNouveauContact = { data: { id: string; numero: string } } | { error: string };

export interface PropsNouveauContact {
  creerClient: (input: EntreeNouveauContact) => Promise<ResultatNouveauContact>;
  onCree: (c: ClientOption) => void;
  onAnnuler: () => void;
}

export function NouveauContact({ creerClient, onCree, onAnnuler }: PropsNouveauContact) {
  const [raison, setRaison] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  // Un ref et non l'état : deux clics dans la même image ne doivent faire qu'un appel.
  const verrou = useRef(false);

  async function creer() {
    if (verrou.current) return;
    const rs = raison.trim();
    if (rs === "") {
      setErreur("La raison sociale est requise.");
      return;
    }
    verrou.current = true;
    setErreur(null);
    setEnCours(true);
    try {
      const entree: EntreeNouveauContact = {
        type: "entreprise",
        raisonSociale: rs,
        ...(nom.trim() !== "" ? { contactNom: nom.trim() } : {}),
        ...(email.trim() !== "" ? { contactEmail: email.trim() } : {}),
      };
      const r = await creerClient(entree);
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      onCree({
        id: r.data.id,
        numero: r.data.numero,
        raisonSociale: rs,
        type: "entreprise",
        adresse: null,
        contactNom: entree.contactNom ?? null,
        email: entree.contactEmail ?? null,
      });
    } catch {
      setErreur("Le contact n'a pas pu être créé. Réessayez.");
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return (
    <fieldset className="mt-3 rounded border p-3">
      <legend className="px-1">Nouveau contact</legend>
      <p className="mb-2 text-[length:var(--text-admin-sm)]">
        La fiche prospect est créée tout de suite, avant le devis.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col">
          Raison sociale
          <input
            className="min-h-[44px] rounded border px-2"
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          Nom du contact
          <input
            className="min-h-[44px] rounded border px-2"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          E-mail du contact
          <input
            type="email"
            className="min-h-[44px] rounded border px-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>
      {erreur ? (
        <p role="alert" className="mt-2">
          {erreur}
        </p>
      ) : null}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className="min-h-[44px] rounded bg-[color:var(--color-admin-accent)] px-4 text-white"
          onClick={() => void creer()}
          disabled={enCours}
        >
          {enCours ? "Création…" : "Créer le contact"}
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded border px-4"
          onClick={onAnnuler}
          disabled={enCours}
        >
          Annuler
        </button>
      </div>
    </fieldset>
  );
}
