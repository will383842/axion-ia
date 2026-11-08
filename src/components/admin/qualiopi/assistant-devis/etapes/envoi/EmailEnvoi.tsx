"use client";
// use-client: champ du destinataire et verrou anti double clic de l'envoi.

/**
 * E-mail au client (fiche E16, décision D9 : PAS d'e-mail personnalisé en v1). Aucun modèle,
 * aucun objet ni message modifiable, aucun exemplaire pour l'administrateur : le contenu est
 * celui de la corbeille de relecture, côté serveur. Ne reste que le destinataire et « Envoyer
 * au client », qui appelle l'action UNE fois (verrou immédiat contre le double clic). Aucun
 * envoi à l'affichage, aucune relance.
 */
import { useId, useRef, useState } from "react";

export interface EmailAEnvoyer {
  a: string;
}

type Resultat<T> = { data: T } | { error: string };

export interface PropsEmailEnvoi {
  destinataire: string;
  envoyer: (email: EmailAEnvoyer) => Promise<Resultat<{ enCorbeille: true; note?: string }>>;
}

export function EmailEnvoi({ destinataire, envoyer }: PropsEmailEnvoi) {
  const uid = useId();
  const [a, setA] = useState(destinataire);
  const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const verrou = useRef(false);
  const [enCours, setEnCours] = useState(false);

  async function lancerEnvoi() {
    if (verrou.current || envoye) return;
    if (a.trim() === "") {
      setErreur("Indiquez l'adresse e-mail du client avant d'envoyer.");
      return;
    }
    verrou.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await envoyer({ a: a.trim() });
      if ("error" in r) {
        setErreur(r.error);
      } else {
        setEnvoye(true);
        setStatut(`En corbeille, à valider.${r.data.note ? ` ${r.data.note}` : ""}`);
      }
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-t`} className="mt-4">
      <h3 id={`${uid}-t`}>L&apos;e-mail envoyé au client</h3>
      <label className="flex flex-col">
        À
        <input
          type="email"
          className="min-h-[44px] rounded border px-2"
          value={a}
          onChange={(e) => setA(e.target.value)}
          disabled={envoye}
        />
      </label>
      <p className="text-[length:var(--text-admin-sm)]">
        Pièce jointe : le devis en PDF, avec le bouton pour choisir et signer. L&apos;e-mail sera
        relu dans la corbeille avant envoi. Le client reçoit uniquement ce message, jamais de
        relance automatique.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-[44px] rounded bg-[color:var(--color-admin-accent)] px-4 text-white"
          onClick={() => void lancerEnvoi()}
          disabled={envoye || enCours}
        >
          {enCours ? "Envoi…" : "Envoyer au client"}
        </button>
      </div>
      {erreur ? (
        <p role="alert" className="mt-2">
          {erreur}
        </p>
      ) : null}
      <p role="status" className="mt-2">
        {statut ?? ""}
      </p>
    </section>
  );
}
