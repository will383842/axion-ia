"use client";
// use-client: pavé de signature + Server Action. Aucun état global.
/**
 * SignatureReleve — le formateur signe le relevé de connexion de sa session.
 *
 * Première surface d'appel réelle du socle `DocumentSignature`. Jusqu'ici le
 * service existait sans écran : personne ne pouvait signer pour de vrai — le
 * reproche exact que ce chantier adresse à l'ancien AFEST.
 *
 * ## Trois modes, ÉGAUX en valeur probante
 *
 * Le tracé n'est pas « la vraie » signature et les deux autres des replis :
 *
 * · `trace` — au doigt ou à la souris ;
 * · `confirmation_accessible` — chemin clavier et lecteur d'écran, sans tracé ;
 * · `papier_scanne` — feuille signée à la main, photographiée.
 *
 * 🔴 Le comptage et la valeur ne dépendent PAS de la modalité. Un dispositif de
 * preuve qui échoue en salle ne produit aucune preuve ; une feuille papier
 * signée en produit une. Retirer les modes dégradés serait une régression.
 *
 * ## Ce que cet écran refuse de faire
 *
 * ⚠️ Il n'affiche jamais « signé » sans dire de quoi c'est fait. Chaque partie
 * signée montre son signataire, son horodatage et son empreinte vérifiable.
 * Une case « signé » que rien n'étaye est précisément le défaut retiré côté
 * AFEST.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/portail/SignaturePad";

export interface PartieAffichee {
  partie: string;
  libelle: string;
  signee: boolean;
  signataireNom: string | null;
  signataireQualite: string | null;
  signeAtLisible: string | null;
  empreinte: string | null;
}

export interface SignatureReleveProps {
  documentGenereId: string;
  numero: string;
  parties: PartieAffichee[];
  peutAgir: boolean;
  mentions: string[];
  plafondProbant: string;
  signerAction: (input: {
    documentGenereId: string;
    methode: "trace" | "papier_scanne" | "confirmation_accessible";
    imageDataUrl?: string;
  }) => Promise<{ ok: true } | { ok: false; raison: string; message: string }>;
}

type Mode = "trace" | "accessible" | "papier";

export function SignatureReleve({
  documentGenereId,
  numero,
  parties,
  peutAgir,
  mentions,
  plafondProbant,
  signerAction,
}: SignatureReleveProps): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("trace");
  const [trace, setTrace] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // ⚠️ Le formateur doit AVOIR LU avant de signer. Une case pré-cochée ne
  // prouverait rien : ce qu'on scelle, c'est qu'un texte VERSIONNÉ lui a été
  // présenté et qu'il l'a accepté.
  const [lu, setLu] = useState(false);

  const imageAEnvoyer = mode === "trace" ? trace : mode === "papier" ? photo : null;
  const pretASigner = lu && !enCours && (mode === "accessible" ? true : imageAEnvoyer !== null);

  function soumettre(): void {
    setErreur(null);
    demarrer(async () => {
      const res = await signerAction({
        documentGenereId,
        methode:
          mode === "trace"
            ? "trace"
            : mode === "papier"
              ? "papier_scanne"
              : "confirmation_accessible",
        ...(imageAEnvoyer === null ? {} : { imageDataUrl: imageAEnvoyer }),
      });
      if (!res.ok) {
        setErreur(res.message);
        return;
      }
      setTrace(null);
      setPhoto(null);
      setLu(false);
      router.refresh();
    });
  }

  /** Photo de la feuille papier, convertie en data-URL côté client. */
  function chargerPhoto(fichier: File | undefined): void {
    if (fichier === undefined) return;
    setErreur(null);
    const lecteur = new FileReader();
    lecteur.onload = () => setPhoto(typeof lecteur.result === "string" ? lecteur.result : null);
    // Un fichier illisible ne doit pas laisser l'écran dans un état où le bouton
    // paraît actif : on efface, et le message dit quoi faire.
    lecteur.onerror = () => {
      setPhoto(null);
      setErreur("Cette image n'a pas pu être lue. Reprenez la photo.");
    };
    lecteur.readAsDataURL(fichier);
  }

  return (
    <section className="border-border rounded-lg border p-4">
      <h3 className="text-mocha text-sm font-semibold">
        Relevé de connexion <span className="text-fg-muted font-normal">n° {numero}</span>
      </h3>

      <ul className="mt-3 space-y-2">
        {parties.map((p) => (
          <li key={p.partie} className="border-border rounded border px-3 py-2 text-xs">
            <span className="font-medium">{p.libelle}</span>
            {p.signee ? (
              <span className="text-fg-muted block">
                {/* On NOMME le signataire, on l'horodate, et on donne l'empreinte.
                    « Signé » tout court n'est pas une preuve, c'est une affirmation. */}
                Signé par {p.signataireNom}
                {p.signataireQualite ? ` (${p.signataireQualite})` : ""} le {p.signeAtLisible}
                <span className="mt-0.5 block font-mono text-[10px] break-all">
                  Empreinte : {p.empreinte}
                </span>
              </span>
            ) : (
              <span className="text-fg-muted block">En attente de signature.</span>
            )}
          </li>
        ))}
      </ul>

      {peutAgir ? (
        <div className="mt-4 space-y-3">
          <div className="text-fg-muted space-y-1 text-xs">
            {mentions.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
            <p className="italic">{plafondProbant}</p>
          </div>

          <fieldset className="flex flex-wrap gap-3 text-xs">
            <legend className="sr-only">Modalité de signature</legend>
            {(
              [
                ["trace", "Signer à l'écran"],
                ["accessible", "Confirmer sans tracé (accessibilité)"],
                ["papier", "Photographier une feuille signée"],
              ] as Array<[Mode, string]>
            ).map(([valeur, libelle]) => (
              <label key={valeur} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="modalite-signature-releve"
                  checked={mode === valeur}
                  onChange={() => {
                    setMode(valeur);
                    setErreur(null);
                  }}
                />
                {libelle}
              </label>
            ))}
          </fieldset>

          {mode === "trace" ? (
            <SignaturePad
              onChange={setTrace}
              onBasculerAccessible={() => setMode("accessible")}
              disabled={enCours}
              label="Signature du formateur"
            />
          ) : null}

          {mode === "papier" ? (
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="text-xs"
              disabled={enCours}
              onChange={(e) => chargerPhoto(e.target.files?.[0])}
            />
          ) : null}

          {mode === "accessible" ? (
            <p className="text-fg-muted text-xs">
              Aucun tracé ne sera enregistré. Votre confirmation nominative a la même valeur
              qu&apos;une signature manuscrite.
            </p>
          ) : null}

          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} />
            <span>J&apos;ai lu les mentions ci-dessus et je les accepte.</span>
          </label>

          {erreur !== null ? (
            <p role="alert" className="text-terracotta text-xs">
              {erreur}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!pretASigner}
            onClick={soumettre}
            className="bg-mocha rounded px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {enCours ? "Enregistrement…" : "Signer le relevé"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
