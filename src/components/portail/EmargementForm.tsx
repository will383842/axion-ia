"use client";
// use-client: pavé de signature + bascule de modalité + Server Action.
/**
 * EmargementForm — signature d'une demi-journée par le stagiaire.
 *
 * Deux modalités, et la seconde n'est pas un lot de consolation :
 *
 * · **Tracé** — au doigt, à la souris ou au pavé tactile.
 * · **Confirmation accessible** — case à cocher + saisie du nom. C'est le SEUL
 *   chemin utilisable au clavier et au lecteur d'écran : un canvas n'en offre
 *   aucun. Elle sert aussi à qui n'a qu'un ordinateur sans écran tactile, et
 *   elle vaut preuve d'adaptation au titre de l'indicateur 26.
 *
 * Ni l'une ni l'autre n'est proposée pour une demi-journée qui n'a pas commencé :
 * le serveur refuserait, et l'écran doit dire pourquoi plutôt que de laisser
 * essayer.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "./SignaturePad";

export interface CreneauAffiche {
  id: string;
  jourLisible: string;
  demiJourneeLisible: string;
  horaires: string;
  formateurNom: string;
  etat: "signable" | "deja_signe" | "pas_encore_commence";
  /** Mentions propres À CE créneau — jamais celles d'un autre. */
  mentions: string[];
}

export interface EmargementFormProps {
  token: string;
  stagiaireNom: string;
  formationIntitule: string;
  organisme: string;
  creneaux: CreneauAffiche[];
  signerAction: (input: {
    token: string;
    creneauId: string;
    methode: "canvas" | "confirmation_accessible";
    imageDataUrl?: string;
    nomConfirme?: string;
  }) => Promise<{ ok: true; signatureId: string } | { ok: false; raison: string; message: string }>;
}

export function EmargementForm({
  token,
  stagiaireNom,
  formationIntitule,
  organisme,
  creneaux,
  signerAction,
}: EmargementFormProps): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [accessible, setAccessible] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [atteste, setAtteste] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reinitialiser() {
    setImage(null);
    setNom("");
    setAtteste(false);
    setErreur(null);
  }

  function ouvrir(id: string) {
    reinitialiser();
    setAccessible(false);
    setOuvert(id);
  }

  const pretASigner = accessible ? atteste && nom.trim() !== "" : image !== null;

  function envoyer(creneauId: string) {
    setErreur(null);
    startTransition(async () => {
      const r = await signerAction({
        token,
        creneauId,
        methode: accessible ? "confirmation_accessible" : "canvas",
        ...(accessible ? { nomConfirme: nom } : { imageDataUrl: image ?? "" }),
      });
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      setOuvert(null);
      reinitialiser();
      router.refresh();
    });
  }

  const restants = creneaux.filter((c) => c.etat === "signable").length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Feuille d&apos;émargement</h1>
        <p className="mt-1 text-sm text-gray-600">
          {stagiaireNom} · {formationIntitule}
        </p>
        <p className="mt-1 text-sm text-gray-600">{organisme}</p>
      </header>

      <p className="mb-6 text-sm text-gray-700" role="status">
        {restants === 0
          ? "Aucune demi-journée à signer pour le moment."
          : `${restants} demi-journée(s) à signer.`}
      </p>

      <ul className="flex flex-col gap-4">
        {creneaux.map((c) => (
          <li key={c.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">
                  {c.jourLisible} — {c.demiJourneeLisible}
                </p>
                {/*
                  « Journée » n'est pas un ornement : ces horaires sont ceux de
                  la journée entière, pas de la demi-journée nommée juste
                  au-dessus. Affichés nus, les deux demi-journées d'un même jour
                  portaient la même plage sans que rien ne l'explique.
                */}
                <p className="text-sm text-gray-600">
                  Journée : {c.horaires}
                  {c.formateurNom !== "" && ` · ${c.formateurNom}`}
                </p>
              </div>

              {c.etat === "deja_signe" && (
                <span className="text-sm font-medium text-green-700">Signé</span>
              )}
              {c.etat === "pas_encore_commence" && (
                <span className="text-sm text-gray-500">Pas encore commencé</span>
              )}
              {c.etat === "signable" && ouvert !== c.id && (
                <button
                  type="button"
                  onClick={() => ouvrir(c.id)}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Signer
                </button>
              )}
            </div>

            {ouvert === c.id && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <div className="mb-4 flex flex-col gap-2 text-xs text-gray-700">
                  {c.mentions.map((m) => (
                    <p key={m.slice(0, 40)}>{m}</p>
                  ))}
                </div>

                {accessible ? (
                  <div className="flex flex-col gap-3">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={atteste}
                        onChange={(e) => setAtteste(e.target.checked)}
                        className="mt-1"
                      />
                      <span>J&apos;atteste avoir suivi cette demi-journée de formation.</span>
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                      <span>Saisissez vos prénom et nom</span>
                      <input
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        autoComplete="name"
                        className="rounded-md border border-gray-400 px-3 py-2"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setAccessible(false);
                        reinitialiser();
                      }}
                      className="self-start text-sm underline underline-offset-4"
                    >
                      Revenir au tracé
                    </button>
                  </div>
                ) : (
                  <SignaturePad
                    onChange={setImage}
                    onBasculerAccessible={() => {
                      setAccessible(true);
                      reinitialiser();
                    }}
                    disabled={isPending}
                    label={`Signature pour ${c.jourLisible}, ${c.demiJourneeLisible}`}
                  />
                )}

                {erreur !== null && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {erreur}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => envoyer(c.id)}
                    disabled={!pretASigner || isPending}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isPending ? "Enregistrement…" : "Valider ma signature"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOuvert(null);
                      reinitialiser();
                    }}
                    disabled={isPending}
                    className="text-sm underline underline-offset-4"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
