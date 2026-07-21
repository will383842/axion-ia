"use client";
// use-client: sélection d'un stagiaire + pavé de signature + Server Action.
/**
 * EmargementGroupe — le formateur fait signer son groupe, sur son propre poste.
 *
 * C'est le mode dominant pour l'intra en entreprise : sur site client, le Wi-Fi
 * invité est souvent restreint, les filtres de messagerie bloquent les liens
 * externes, et certains clients interdisent les téléphones personnels. Douze
 * liens individuels, c'est douze façons d'échouer.
 *
 * Le geste réel en salle est : « on est le 10 juin, fin de matinée, je fais
 * signer les douze présents ». L'écran suit donc ce grain — une demi-journée à
 * la fois, la liste du groupe dessous — et non « un stagiaire, toutes ses
 * dates ».
 *
 * ⚠️ Le QR reste le chemin préférable quand les téléphones sont disponibles :
 * douze personnes signent alors EN PARALLÈLE sur leur propre appareil, et
 * l'identification ne repose pas sur le formateur. Cet écran est le repli — mais
 * un repli qui doit marcher, sinon la salle sort sans feuille.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/portail/SignaturePad";

export interface LigneGroupeAffichee {
  creneauId: string;
  stagiaireNom: string;
  statut: string;
  etat: "signable" | "deja_signe" | "pas_encore_commence";
}

export interface DemiJourneeAffichee {
  cle: string;
  jourLisible: string;
  demiJourneeLisible: string;
  horaires: string;
  formateurNom: string;
  commencee: boolean;
  lignes: LigneGroupeAffichee[];
}

export interface EmargementGroupeProps {
  sessionId: string;
  demiJournees: DemiJourneeAffichee[];
  signerAction: (input: {
    sessionId: string;
    creneauId: string;
    methode: "canvas" | "confirmation_accessible";
    imageDataUrl?: string;
    nomConfirme?: string;
  }) => Promise<{ ok: true; signatureId: string } | { ok: false; raison: string; message: string }>;
}

export function EmargementGroupe({
  sessionId,
  demiJournees,
  signerAction,
}: EmargementGroupeProps): React.ReactElement {
  const router = useRouter();
  // La première demi-journée commencée et incomplète : c'est celle sur laquelle
  // le formateur travaille, inutile de la lui faire chercher.
  const [ouverte, setOuverte] = useState<string | null>(
    () =>
      demiJournees.find((d) => d.commencee && d.lignes.some((l) => l.etat === "signable"))?.cle ??
      null,
  );
  const [signataire, setSignataire] = useState<LigneGroupeAffichee | null>(null);
  const [accessible, setAccessible] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fermer() {
    setSignataire(null);
    setAccessible(false);
    setImage(null);
    setNom("");
    setErreur(null);
  }

  const pret = accessible ? nom.trim() !== "" : image !== null;

  function envoyer() {
    if (signataire === null) return;
    setErreur(null);
    startTransition(async () => {
      const r = await signerAction({
        sessionId,
        creneauId: signataire.creneauId,
        methode: accessible ? "confirmation_accessible" : "canvas",
        ...(accessible ? { nomConfirme: nom } : { imageDataUrl: image ?? "" }),
      });
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      fermer();
      router.refresh();
    });
  }

  if (demiJournees.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Aucune demi-journée à émarger. Les journées de cette session doivent d&apos;abord être
        déclarées, avec leurs horaires réels.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {demiJournees.map((d) => {
        const restants = d.lignes.filter((l) => l.etat === "signable").length;
        const signes = d.lignes.filter((l) => l.etat === "deja_signe").length;
        const estOuverte = ouverte === d.cle;

        return (
          <section key={d.cle} className="rounded-lg border border-neutral-300 bg-white">
            <button
              type="button"
              onClick={() => {
                setOuverte(estOuverte ? null : d.cle);
                fermer();
              }}
              aria-expanded={estOuverte}
              className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left"
            >
              <span>
                <span className="font-medium text-neutral-900">
                  {d.jourLisible} — {d.demiJourneeLisible}
                </span>
                <span className="ml-2 text-sm text-neutral-600">
                  {d.horaires}
                  {d.formateurNom !== "" && ` · ${d.formateurNom}`}
                </span>
              </span>
              <span className="text-sm text-neutral-700">
                {signes}/{d.lignes.length} signé{signes > 1 ? "s" : ""}
                {!d.commencee && " · pas encore commencé"}
              </span>
            </button>

            {estOuverte && (
              <ul className="border-t border-neutral-200">
                {d.lignes.map((l) => (
                  <li
                    key={l.creneauId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-neutral-900">
                      {l.stagiaireNom}
                      {l.statut === "abandon" && (
                        <span className="ml-2 text-sm text-neutral-500">(abandon)</span>
                      )}
                    </span>

                    {l.etat === "deja_signe" && (
                      <span className="text-sm font-medium text-green-700">Signé</span>
                    )}
                    {l.etat === "pas_encore_commence" && (
                      <span className="text-sm text-neutral-500">Pas encore commencé</span>
                    )}
                    {l.etat === "signable" &&
                      (signataire?.creneauId === l.creneauId ? (
                        <span className="text-sm text-neutral-500">Signature en cours…</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            fermer();
                            setSignataire(l);
                          }}
                          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
                        >
                          Faire signer
                        </button>
                      ))}
                  </li>
                ))}

                {restants === 0 && (
                  <li className="px-4 py-3 text-sm text-neutral-600">
                    Tout le groupe a signé cette demi-journée.
                  </li>
                )}
              </ul>
            )}
          </section>
        );
      })}

      {signataire !== null && (
        <div
          role="dialog"
          aria-label={`Signature de ${signataire.stagiaireNom}`}
          className="rounded-lg border border-neutral-900 bg-white p-4"
        >
          <p className="mb-3 font-medium text-neutral-900">
            Passez l&apos;appareil à {signataire.stagiaireNom}
          </p>

          {accessible ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>{signataire.stagiaireNom} saisit ses prénom et nom</span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoComplete="off"
                className="rounded-md border border-neutral-400 px-3 py-2"
              />
            </label>
          ) : (
            <SignaturePad
              onChange={setImage}
              onBasculerAccessible={() => {
                setAccessible(true);
                setImage(null);
              }}
              disabled={isPending}
              label={`Signature de ${signataire.stagiaireNom}`}
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
              onClick={envoyer}
              disabled={!pret || isPending}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Enregistrement…" : "Valider la signature"}
            </button>
            <button
              type="button"
              onClick={fermer}
              disabled={isPending}
              className="text-sm underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
