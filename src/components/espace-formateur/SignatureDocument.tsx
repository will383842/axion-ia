"use client";
// use-client: pavé de signature + Server Action. Aucun état global.
/**
 * SignatureDocument — l'écran de signature du canal MAISON, pour toute pièce.
 *
 * Anciennement `SignatureReleve`, renommé quand la lettre de mission est venue
 * s'y brancher : le nom promettait une seule pièce alors que le composant en
 * sert désormais deux, et un nom qui ment sur ce qu'il fait finit par produire
 * un jumeau « pour l'autre pièce ». C'est exactement ce qu'il fallait éviter :
 * deux écrans de signature divergeraient sur ce qu'ils affichent comme signé, et
 * l'un finirait par contredire l'autre sur le même dossier.
 *
 * Il sert QUATRE surfaces aujourd'hui :
 *  · relevé de connexion — espace formateur (signature) et console (visa) ;
 *  · lettre de mission   — espace formateur (signature) et console (contreseing).
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
 *
 * ⚠️ Il ne réécrit AUCUNE mention. Les textes arrivent en `mentions`, produits
 * par `mentionCompleteDocument` et versionnés par `MENTION_VERSION_DOCUMENT` :
 * c'est cette version-là qui est scellée dans l'empreinte. Une phrase retouchée
 * ici ferait pointer des empreintes déjà posées vers un texte jamais affiché, et
 * « prouver ce qu'elle a signé » deviendrait impossible.
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

export interface SignatureDocumentProps {
  documentGenereId: string;
  /** Type lisible de la pièce, ex. « Lettre de mission ». Affiché en titre. */
  titrePiece: string;
  numero: string;
  parties: PartieAffichee[];
  peutAgir: boolean;
  /**
   * Pourquoi le lecteur ne peut PAS signer, quand c'est le cas.
   *
   * 🔴 Optionnel, et son absence n'est pas un oubli : la lecture du relevé ne le
   * produit pas encore. Quand il est fourni, il est AFFICHÉ — proposer un bouton
   * qui refusera à coup sûr (spécimen, déjà signé, non-mandataire) fait lire un
   * refus légitime comme une panne, et l'intéressé réessaie au lieu de faire
   * corriger la cause.
   */
  motifBlocage?: string | null | undefined;
  mentions: string[];
  plafondProbant: string;
  /**
   * Où LIRE la pièce avant de la signer.
   *
   * 🔴 `D4-1-A` (2026-08-20). Ce composant n'a jamais reçu d'URL de pièce : le
   * signataire voyait un titre, un numéro, une liste de parties — et signait.
   * Or la mention qu'il scelle affirme « J'ai pu prendre connaissance de la
   * pièce dans son intégralité avant de signer, et j'en recevrai un
   * exemplaire ». Les deux moitiés étaient fausses.
   *
   * ⚠️ Optionnel : les autres circuits de signature qui utilisent ce composant
   * n'ont pas tous une route de lecture. Mais quand l'URL manque, le composant
   * ne se contente pas de masquer le lien — il DIT que la pièce n'est pas
   * consultable. Un blanc laisserait croire qu'il n'y avait rien à lire.
   */
  urlPiece?: string | null | undefined;
  /** Libellé du bouton, ex. « Signer la lettre de mission ». */
  libelleBouton: string;
  /** Titre du pavé de signature, ex. « Signature du formateur ». */
  labelSignature: string;
  signerAction: (input: {
    documentGenereId: string;
    methode: "trace" | "papier_scanne" | "confirmation_accessible";
    imageDataUrl?: string;
  }) => Promise<{ ok: true } | { ok: false; raison: string; message: string }>;
}

type Mode = "trace" | "accessible" | "papier";

export function SignatureDocument({
  documentGenereId,
  titrePiece,
  numero,
  parties,
  peutAgir,
  motifBlocage,
  urlPiece,
  mentions,
  plafondProbant,
  libelleBouton,
  labelSignature,
  signerAction,
}: SignatureDocumentProps): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("trace");
  const [trace, setTrace] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // ⚠️ Le signataire doit AVOIR LU avant de signer. Une case pré-cochée ne
  // prouverait rien : ce qu'on scelle, c'est qu'un texte VERSIONNÉ lui a été
  // présenté et qu'il l'a accepté.
  const [lu, setLu] = useState(false);

  const imageAEnvoyer = mode === "trace" ? trace : mode === "papier" ? photo : null;
  const pretASigner = lu && !enCours && (mode === "accessible" ? true : imageAEnvoyer !== null);

  // 🔴 Le groupe de boutons radio est nommé par l'identifiant de la PIÈCE.
  //
  // La console affiche désormais deux pièces signables sur la même page (relevé
  // de connexion et lettre de mission), et l'accueil formateur peut en afficher
  // plusieurs. Un `name` constant les ferait entrer dans le MÊME groupe radio :
  // choisir « papier » sur l'une décocherait l'autre, qui enverrait alors une
  // modalité que personne n'a choisie — et la modalité entre dans le tuple haché.
  const groupeModalite = `modalite-signature-${documentGenereId}`;

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
        {titrePiece} <span className="text-fg-muted font-normal">n° {numero}</span>
      </h3>

      {/* 🔴 `D4-1-A` — LIRE avant de signer. Placé au-dessus de tout le reste
          parce que c'est le premier geste attendu, et parce qu'un lien posé
          sous le pavé de signature serait vu après coup. */}
      {urlPiece != null && urlPiece !== "" ? (
        <p className="mt-2">
          <a
            href={urlPiece}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mocha text-xs font-medium underline underline-offset-2"
          >
            Lire la pièce avant de signer (PDF)
          </a>
        </p>
      ) : (
        // ⚠️ On l'ÉCRIT plutôt que de laisser un blanc. Une pièce qu'on ne peut
        // pas ouvrir est un problème que le signataire doit connaître avant
        // d'attester l'avoir lue — pas une absence de lien qu'il ne remarquera
        // pas.
        <p className="text-fg-muted mt-2 text-xs">
          Cette pièce n&apos;est pas consultable en ligne. Demandez-en une copie avant de signer.
        </p>
      )}

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

      {/* Le motif est dit AVANT le clic, et il est dit aussi quand la pièce est
          déjà signée : un écran qui n'offre rien sans expliquer pourquoi se lit
          comme une panne, et on réessaie au lieu de faire corriger la cause. */}
      {!peutAgir && typeof motifBlocage === "string" && motifBlocage !== "" ? (
        <p role="status" className="text-fg-muted mt-3 text-xs">
          {motifBlocage}
        </p>
      ) : null}

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
                  name={groupeModalite}
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
              label={labelSignature}
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
            {enCours ? "Enregistrement…" : libelleBouton}
          </button>
        </div>
      ) : null}
    </section>
  );
}
