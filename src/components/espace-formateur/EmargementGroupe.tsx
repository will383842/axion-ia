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
  /** Texte présenté au signataire pour CETTE demi-journée. */
  mentions: string[];
  lignes: LigneGroupeAffichee[];
}

export interface EmargementGroupeProps {
  sessionId: string;
  demiJournees: DemiJourneeAffichee[];
  signerAction: (input: {
    sessionId: string;
    creneauId: string;
    // `papier_scanne` : repli de continuité (D11), disponible côté formateur
    // uniquement — le stagiaire, lui, n'a pas de feuille papier à photographier.
    methode: "canvas" | "confirmation_accessible" | "papier_scanne";
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
  // La demi-journée dont relève le signataire courant : c'est elle qui porte les
  // mentions à afficher, jamais celles d'une autre.
  const [mentions, setMentions] = useState<string[]>([]);
  const [atteste, setAtteste] = useState(false);
  const [mode, setMode] = useState<"trace" | "accessible" | "papier">("trace");
  const [image, setImage] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fermer() {
    setSignataire(null);
    setMentions([]);
    setAtteste(false);
    setMode("trace");
    setImage(null);
    setNom("");
    setErreur(null);
  }

  // L'attestation est exigée dans TOUTES les modalités : c'est elle qui donne
  // son sens à la signature, pas le tracé.
  const pret = atteste && (mode === "accessible" ? nom.trim() !== "" : image !== null);

  /**
   * Convertit la photo en data-URL.
   *
   * Le plafond côté serveur est de 2 Mio DÉCODÉS ; on refuse ici au-delà pour
   * éviter d'envoyer inutilement plusieurs mégaoctets depuis un réseau de
   * chantier, et pour dire pourquoi plutôt que de laisser échouer l'envoi.
   */
  async function chargerPhoto(fichier: File | null) {
    setErreur(null);
    setImage(null);
    if (fichier === null) return;
    if (fichier.size > 2 * 1024 * 1024) {
      setErreur("Photo trop lourde (2 Mo maximum). Réduisez la définition de l'appareil photo.");
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => setImage(typeof lecteur.result === "string" ? lecteur.result : null);
    lecteur.onerror = () => setErreur("Photo illisible. Réessayez.");
    lecteur.readAsDataURL(fichier);
  }

  function envoyer() {
    if (signataire === null) return;
    setErreur(null);
    startTransition(async () => {
      const r = await signerAction({
        sessionId,
        creneauId: signataire.creneauId,
        methode:
          mode === "accessible"
            ? "confirmation_accessible"
            : mode === "papier"
              ? "papier_scanne"
              : "canvas",
        ...(mode === "accessible" ? { nomConfirme: nom } : { imageDataUrl: image ?? "" }),
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
                            setMentions(d.mentions);
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

          {/* 🔴 Les mentions étaient absentes de cet écran, alors que la base
              enregistre `mentionVersion` : elle affirmait un texte que personne
              n'avait jamais vu. L'information RGPD (art. 13) est due au moment
              où l'on collecte le tracé et les empreintes d'IP et de navigateur. */}
          <div className="mb-4 flex flex-col gap-2 text-xs text-neutral-700">
            {mentions.map((m) => (
              <p key={m.slice(0, 40)}>{m}</p>
            ))}
          </div>

          <label className="mb-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={atteste}
              onChange={(e) => setAtteste(e.target.checked)}
              className="mt-1"
            />
            <span>
              {signataire.stagiaireNom} atteste avoir suivi cette demi-journée de formation.
            </span>
          </label>

          {mode === "accessible" && (
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
          )}

          {mode === "papier" && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span>Photo de la feuille signée</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  capture="environment"
                  onChange={(e) => void chargerPhoto(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
              <p className="text-xs text-neutral-600">
                Cadrez la signature de {signataire.stagiaireNom}. Seule l&apos;image est conservée ;
                elle est ré-encodée à l&apos;enregistrement, sans aucune métadonnée.
              </p>
              {image !== null && (
                <p role="status" className="text-sm text-green-700">
                  Photo prête à être enregistrée.
                </p>
              )}
            </div>
          )}

          {mode === "trace" && (
            <SignaturePad
              onChange={setImage}
              onBasculerAccessible={() => {
                setMode("accessible");
                setImage(null);
              }}
              disabled={isPending}
              label={`Signature de ${signataire.stagiaireNom}`}
            />
          )}

          {/* Repli de continuité (décision D11). ⚠️ Aucun texte n'impose ce
              repli : il se justifie comme continuité de service et de preuve,
              jamais comme une obligation juridique. Mais sur un site client sans
              réseau, c'est le seul mode qui marche — et une salle qui sort sans
              feuille est un problème bien réel. */}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {mode !== "trace" && (
              <button
                type="button"
                onClick={() => {
                  setMode("trace");
                  setImage(null);
                }}
                className="underline underline-offset-4"
              >
                Revenir au tracé
              </button>
            )}
            {mode !== "papier" && (
              <button
                type="button"
                onClick={() => {
                  setMode("papier");
                  setImage(null);
                  setNom("");
                }}
                className="underline underline-offset-4"
              >
                Photographier une feuille papier
              </button>
            )}
          </div>

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
