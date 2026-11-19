"use client";
// use-client: petit formulaire contrôlé avec appel d action injecté et état « en cours ».

/**
 * « + Nouveau contact » (fiche E08). La fiche prospect est créée TOUT DE SUITE (D5), par
 * l'action injectée (`createClientAction` côté page : aucun import serveur ici). Un refus du
 * serveur (même SIREN, même e-mail…) s'affiche tel quel, rien n'est ajouté à la liste.
 */
import { Check } from "lucide-react";
import { useRef, useState } from "react";

import { AdminButton } from "@/components/admin/ui/AdminButton";

import type { ClientOption } from "./BlocClient";
import { AIDE, CHAMP, ETIQUETTE } from "./styles";

export interface EntreeNouveauContact {
  type: "entreprise";
  raisonSociale: string;
  contactNom?: string;
  contactEmail?: string;
  /** Salutation des e-mails : saisie à part, jamais découpée depuis `contactNom`. */
  contactCivilite?: "madame" | "monsieur";
  contactPrenom?: string;
  contactNomFamille?: string;
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
  const [civilite, setCivilite] = useState<"" | "madame" | "monsieur">("");
  const [prenom, setPrenom] = useState("");
  const [nomFamille, setNomFamille] = useState("");
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
        ...(civilite !== "" ? { contactCivilite: civilite } : {}),
        ...(prenom.trim() !== "" ? { contactPrenom: prenom.trim() } : {}),
        ...(nomFamille.trim() !== "" ? { contactNomFamille: nomFamille.trim() } : {}),
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
    <fieldset className="m-0 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper-alt)] p-4">
      <legend className="px-1 font-semibold">Nouveau contact</legend>
      <p className={`mt-0 mb-3 ${AIDE}`}>
        La fiche prospect est créée tout de suite, avant le devis.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ETIQUETTE}>
          Raison sociale
          <input
            className={`${CHAMP} font-normal`}
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
          />
        </label>
        <label className={ETIQUETTE}>
          Nom du contact
          <input
            className={`${CHAMP} font-normal`}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </label>
        <label className={ETIQUETTE}>
          E-mail du contact
          <input
            type="email"
            className={`${CHAMP} font-normal`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={ETIQUETTE}>
          Civilité
          <select
            className={`${CHAMP} font-normal`}
            value={civilite}
            onChange={(e) => setCivilite(e.target.value as "" | "madame" | "monsieur")}
          >
            <option value="">—</option>
            <option value="madame">Madame</option>
            <option value="monsieur">Monsieur</option>
          </select>
        </label>
        <label className={ETIQUETTE}>
          Prénom
          <input
            className={`${CHAMP} font-normal`}
            value={prenom}
            maxLength={80}
            onChange={(e) => setPrenom(e.target.value)}
          />
        </label>
        <label className={ETIQUETTE}>
          Nom de famille
          <input
            className={`${CHAMP} font-normal`}
            value={nomFamille}
            maxLength={80}
            onChange={(e) => setNomFamille(e.target.value)}
          />
        </label>
      </div>
      <p className={`mt-3 mb-0 ${AIDE}`}>
        Sert à écrire « Bonjour Madame Dupont, » en tête des e-mails. Laissez vide si vous
        n&apos;êtes pas sûr.
      </p>
      {erreur ? (
        <p
          role="alert"
          className="mt-3 mb-0 rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
        >
          {erreur}
        </p>
      ) : null}
      <div className="mt-3 flex gap-3">
        <AdminButton
          variant="primary"
          size="lg"
          icon={Check}
          onClick={() => void creer()}
          disabled={enCours}
        >
          {enCours ? "Création…" : "Créer le contact"}
        </AdminButton>
        <AdminButton variant="secondary" size="lg" onClick={onAnnuler} disabled={enCours}>
          Annuler
        </AdminButton>
      </div>
    </fieldset>
  );
}
