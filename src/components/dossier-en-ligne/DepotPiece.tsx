"use client";
// use-client: dépôt d'un fichier (choix, envoi immédiat par action serveur, état d'envoi).

// Composant COMMUN du dossier en ligne (FAC-10), extrait du dossier apporteur : l'action
// de dépôt et les textes sont donnés par le monde appelant.
//
// Une pièce du dossier : son état (à ajouter, ajoutée, vérifiée, à renvoyer avec son
// motif) et deux façons de l'envoyer — une photo prise sur le moment (`capture`, qui
// ouvre l'appareil photo du téléphone) ou un fichier PDF / image déjà enregistré.
// L'attestation de vigilance demande en plus sa date de délivrance (validité 6 mois). Le CV
// du formateur demande la date du CV, en mois et année (`moisAnnee`, absent ailleurs).
// Le fichier envoyé s'affiche aussitôt (vignette de la photo, ou lien vers le PDF) : l'aperçu
// est fait dans le navigateur, depuis le fichier choisi ; rien de plus ne repart au serveur.

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Les textes du dépôt, donnés par chaque monde (FAC-10). */
export interface TextesDepotPiece {
  readonly connexionPerdue: string;
  readonly facultatif: string;
  readonly conforme: string;
  readonly ajoutee: string;
  readonly aRetransmettre: (motif: string) => string;
  readonly apercuDe: (piece: string) => string;
  readonly voirLePdf: string;
  readonly dateDelivrance: string;
  readonly envoi: string;
  readonly remplacer: string;
}

/** L'action serveur de dépôt du monde appelant (vérifie le jeton, contrôle la pièce). */
export type ActionDepotPiece = (
  fd: FormData,
) => Promise<{ ok: true } | { ok: false; message: string }>;

export interface PieceAffichee {
  statut: "deposee" | "conforme" | "a_retransmettre";
  motif: string | null;
  nomFichier: string;
}

const bouton =
  "border-terracotta text-terracotta-deep hover:bg-terracotta-soft focus-within:outline-terracotta inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 text-[16px] font-bold focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-solid";

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** L'année en cours, puis les quarante précédentes. */
function anneesProposees(): number[] {
  const cette = new Date().getFullYear();
  return Array.from({ length: 41 }, (_, i) => cette - i);
}

export function DepotPiece({
  action,
  textes: TEXTES,
  id,
  jeton,
  type,
  libelle,
  aide,
  facultatif = false,
  piece,
  motifLibelle,
  avecDate = false,
  moisAnnee,
}: {
  action: ActionDepotPiece;
  textes: TextesDepotPiece;
  id: string;
  jeton: string;
  type: string;
  libelle: string;
  aide: string;
  facultatif?: boolean;
  piece: PieceAffichee | null;
  motifLibelle: string | null;
  avecDate?: boolean;
  /** Mois et année demandés avant l'envoi (libellé, nom du champ envoyé « AAAA-MM »). */
  moisAnnee?: { readonly libelle: string; readonly champ: string };
}) {
  const router = useRouter();
  const uid = useId();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [mois, setMois] = useState("");
  const [annee, setAnnee] = useState("");
  const [apercu, setApercu] = useState<{ url: string; image: boolean } | null>(null);
  // L'adresse locale de l'aperçu est libérée quand on la remplace ou qu'on quitte l'étape.
  useEffect(() => () => (apercu ? URL.revokeObjectURL(apercu.url) : undefined), [apercu]);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const aRenvoyer = piece?.statut === "a_retransmettre";
  const presente = !!piece && !aRenvoyer;
  const bloque = enCours || (avecDate && !date) || (!!moisAnnee && (!mois || !annee));

  function envoyer(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setErreur(null);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("jeton", jeton);
    fd.set("type", type);
    fd.set("fichier", fichier);
    if (avecDate) fd.set("dateDelivrance", date);
    if (moisAnnee) fd.set(moisAnnee.champ, `${annee}-${mois}`);
    demarrer(async () => {
      try {
        const r = await action(fd);
        if (!r.ok) return setErreur(r.message);
        setApercu({ url: URL.createObjectURL(fichier), image: fichier.type.startsWith("image/") });
        router.refresh();
      } catch {
        // Coupure réseau : le message reste sur l'écran, le choix de la date aussi.
        setErreur(TEXTES.connexionPerdue);
      }
    });
  }

  return (
    <li
      className={`bg-paper rounded-2xl border p-4 ${aRenvoyer ? "border-error" : "border-border"}`}
      aria-busy={enCours}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-bold">
            {libelle}
            {facultatif ? (
              <span className="text-fg-soft font-normal"> ({TEXTES.facultatif})</span>
            ) : null}
          </p>
          <p className="text-fg-soft mt-0.5 text-[15px] leading-snug">{aide}</p>
        </div>
        {presente ? (
          <span className="bg-sage-soft text-sage shrink-0 rounded-full px-3 py-1 text-[14px] font-bold">
            ✓ {piece.statut === "conforme" ? TEXTES.conforme : TEXTES.ajoutee}
          </span>
        ) : null}
      </div>
      {aRenvoyer ? (
        <p className="text-error mt-2 text-[15px] font-semibold">
          {TEXTES.aRetransmettre(motifLibelle ?? "")}
        </p>
      ) : null}
      {presente ? (
        <p className="text-fg-soft mt-1 truncate text-[14px]">{piece.nomFichier}</p>
      ) : null}
      {presente && apercu ? (
        apercu.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), pas d'optimisation possible
          <img
            src={apercu.url}
            alt={TEXTES.apercuDe(libelle)}
            className="border-border mt-2 max-h-48 w-auto rounded-xl border object-contain"
          />
        ) : (
          <a
            href={apercu.url}
            target="_blank"
            rel="noopener"
            className="text-terracotta-deep mt-2 inline-flex min-h-[44px] items-center text-[16px] font-bold underline underline-offset-4"
          >
            {TEXTES.voirLePdf}
          </a>
        )
      ) : null}

      {avecDate ? (
        <div className="mt-3">
          <label htmlFor={`${uid}-date`} className="text-fg-soft block text-[15px] font-semibold">
            {TEXTES.dateDelivrance}
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            max={aujourdhui}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-border-strong bg-paper mt-1 min-h-[48px] w-full rounded-xl border px-3 text-[17px]"
          />
        </div>
      ) : null}

      {moisAnnee ? (
        <fieldset className="mt-3">
          <legend className="text-fg-soft block text-[15px] font-semibold">
            {moisAnnee.libelle}
          </legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select
              aria-label={`${moisAnnee.libelle} : mois`}
              required
              value={mois}
              onChange={(e) => setMois(e.target.value)}
              className="border-border-strong bg-paper min-h-[48px] w-full rounded-xl border px-3 text-[17px]"
            >
              <option value="">Mois</option>
              {MOIS.map((nom, i) => (
                <option key={nom} value={String(i + 1).padStart(2, "0")}>
                  {nom}
                </option>
              ))}
            </select>
            <select
              aria-label={`${moisAnnee.libelle} : année`}
              required
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              className="border-border-strong bg-paper min-h-[48px] w-full rounded-xl border px-3 text-[17px]"
            >
              <option value="">Année</option>
              {anneesProposees().map((a) => (
                <option key={a} value={String(a)}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      ) : null}

      <div
        className={`mt-3 grid grid-cols-2 gap-2 ${bloque ? "pointer-events-none opacity-60" : ""}`}
      >
        <label className={bouton}>
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            capture="environment"
            className="sr-only"
            disabled={bloque}
            onChange={envoyer}
            aria-label={`${libelle} : prendre une photo`}
          />
          {enCours ? TEXTES.envoi : "Photo"}
        </label>
        <label className={bouton}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            disabled={bloque}
            onChange={envoyer}
            aria-label={`${libelle} : choisir un fichier`}
          />
          {enCours ? TEXTES.envoi : presente || aRenvoyer ? TEXTES.remplacer : "Fichier"}
        </label>
      </div>
      {erreur ? (
        <p role="alert" className="text-error mt-2 text-[15px] font-semibold">
          {erreur}
        </p>
      ) : null}
    </li>
  );
}
