"use client";
// use-client: formulaire contrôlé (modèle, objet, message) et gestionnaires d envoi.

/**
 * E-mail au client (fiche E16). Le modèle pré-remplit objet et corps ; en changer après
 * modification demande confirmation (boîte `alertdialog` en ligne). La signature est la prop
 * `signataire`, jamais écrite ici. L'envoi passe par la corbeille de relecture : « Envoyer au
 * client » appelle l'action UNE fois (verrou immédiat contre le double clic) ; « M'envoyer un
 * exemplaire » ne va qu'à l'administrateur. Aucun envoi à l'affichage, aucune relance.
 */
import { useId, useRef, useState } from "react";

export interface ModeleEmail {
  cle: string;
  libelle: string;
  objet: string;
  corps: string;
}

export interface EmailAEnvoyer {
  a: string;
  objet: string;
  corps: string;
  modele: string;
}

type Resultat<T> = { data: T } | { error: string };

export interface PropsEmailEnvoi {
  modeles: readonly ModeleEmail[];
  signataire: string;
  destinataire: string;
  envoyer: (email: EmailAEnvoyer) => Promise<Resultat<{ enCorbeille: true; note?: string }>>;
  envoyerExemplaire: () => Promise<Resultat<{ ok: true }>>;
}

const corpsDe = (m: ModeleEmail | undefined, signataire: string): string =>
  [m?.corps ?? "", signataire].filter((x) => x.trim() !== "").join("\n\n");

export function EmailEnvoi({
  modeles,
  signataire,
  destinataire,
  envoyer,
  envoyerExemplaire,
}: PropsEmailEnvoi) {
  const uid = useId();
  const [cle, setCle] = useState(modeles[0]?.cle ?? "");
  const modele = modeles.find((m) => m.cle === cle);
  const [a, setA] = useState(destinataire);
  const [objet, setObjet] = useState(modele?.objet ?? "");
  const [corps, setCorps] = useState(corpsDe(modele, signataire));
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const verrou = useRef(false);
  const [enCours, setEnCours] = useState(false);

  const modifie = objet !== (modele?.objet ?? "") || corps !== corpsDe(modele, signataire);

  function appliquer(m: ModeleEmail | undefined) {
    setCle(m?.cle ?? cle);
    setObjet(m?.objet ?? "");
    setCorps(corpsDe(m, signataire));
    setAConfirmer(null);
  }

  function changerModele(nouvelle: string) {
    const m = modeles.find((x) => x.cle === nouvelle);
    if (modifie) setAConfirmer(nouvelle);
    else appliquer(m);
  }

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
      const r = await envoyer({ a: a.trim(), objet, corps, modele: cle });
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

  async function lancerExemplaire() {
    setErreur(null);
    const r = await envoyerExemplaire();
    if ("error" in r) setErreur(r.error);
    else setStatut("Exemplaire envoyé à votre adresse.");
  }

  const champ = "min-h-[44px] rounded border px-2";
  return (
    <section aria-labelledby={`${uid}-t`} className="mt-4">
      <h3 id={`${uid}-t`}>L&apos;e-mail envoyé au client</h3>
      <div className="grid gap-3">
        <label className="flex flex-col">
          À
          <input
            type="email"
            className={champ}
            value={a}
            onChange={(e) => setA(e.target.value)}
            disabled={envoye}
          />
        </label>
        <label className="flex flex-col">
          Modèle d&apos;e-mail
          <select
            className={champ}
            value={cle}
            onChange={(e) => changerModele(e.target.value)}
            disabled={envoye}
          >
            {modeles.map((m) => (
              <option key={m.cle} value={m.cle}>
                {m.libelle}
              </option>
            ))}
          </select>
        </label>
        {aConfirmer !== null ? (
          <div role="alertdialog" aria-labelledby={`${uid}-conf`} className="rounded border p-3">
            <p id={`${uid}-conf`}>
              Vous avez modifié l&apos;objet ou le message. Le remplacer par ce modèle ?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="min-h-[44px] rounded border px-4"
                onClick={() => appliquer(modeles.find((m) => m.cle === aConfirmer))}
              >
                Remplacer
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded border px-4"
                onClick={() => setAConfirmer(null)}
              >
                Garder mon texte
              </button>
            </div>
          </div>
        ) : null}
        <label className="flex flex-col">
          Objet
          <input
            className={champ}
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            disabled={envoye}
          />
        </label>
        <label className="flex flex-col">
          Message
          <textarea
            rows={8}
            className="rounded border px-2"
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            disabled={envoye}
          />
        </label>
      </div>
      <p className="text-[length:var(--text-admin-sm)]">
        Pièce jointe : le devis en PDF, avec le bouton pour choisir et signer. L&apos;e-mail sera
        relu dans la corbeille avant envoi. Le client reçoit uniquement ce message, jamais de
        relance automatique.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-[44px] rounded border px-4"
          onClick={() => appliquer(modele)}
          disabled={envoye}
        >
          Revenir au texte d&apos;origine
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded bg-[color:var(--color-admin-accent)] px-4 text-white"
          onClick={() => void lancerEnvoi()}
          disabled={envoye || enCours}
        >
          {enCours ? "Envoi…" : "Envoyer au client"}
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded border px-4"
          onClick={() => void lancerExemplaire()}
          disabled={envoye}
        >
          M&apos;envoyer un exemplaire pour relire
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
