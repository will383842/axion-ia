"use client";
// use-client: dépôt OPCO d'une session — téléchargement du ZIP (Blob), saisie « Dépôt fait le » et « Accord écrit le » (useTransition + Server Actions).

/**
 * DepotOpcoPanel — chantier OPCO A6.
 *
 * C'est l'ENTREPRISE qui dépose sa demande de prise en charge sur son espace
 * OPCO. Ce panneau dit comment (encart lu dans le référentiel OPCO), montre
 * l'état RÉEL des pièces, remet le « dossier prêt à déposer » (ZIP : kit OPCO
 * vérifié + pièces présentes) et permet de saisir la date du dépôt et le
 * numéro de dossier OPCO — ce qui referme l'alerte `depot_opco_a_faire`.
 *
 * Lot OPCO A7b : bouton « Ouvrir le dossier OPCO » (portail relevé dans
 * `OPCO_FICHES`, nouvel onglet) et date de l'accord écrit, saisie ici, à côté
 * du dépôt — elle gouverne le régime de paiement. L'état des fonds est porté
 * par le `BandeauEtatFonds` de la page, plus par une ligne de l'encart.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { genererDossierPretADeposerAction } from "@/server/actions/qualiopi/documents";
import {
  enregistrerAccordEcritAction,
  enregistrerDepotDossierAction,
} from "@/server/actions/qualiopi/facturation-hub";

export interface DepotOpcoPanelProps {
  sessionId: string;
  /** Dossier de financement OPCO ouvert, où s'écrit le dépôt. */
  dossierId: string | null;
  /** AAAA-MM-JJ, si le dépôt est déjà saisi. */
  depotFaitLe: string | null;
  numeroDossierExterne: string | null;
  /** AAAA-MM-JJ, si la date de l'accord écrit est déjà saisie. */
  accordEcritLe?: string | null;
  /** `false` : lecture seule (ni dépôt ni accord saisissables). Défaut `true`. */
  peutEcrire?: boolean;
  encart: {
    titre: string;
    qui: string;
    portail: string;
    portailUrl: string | null;
    delai: string;
    dateLimite: string;
    regime: string;
    etatFonds: string | null;
  };
  pieces: { libelle: string; presente: boolean; detail: string }[];
}

function telechargerZip(base64: string, filename: string): void {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([octets.buffer as ArrayBuffer], { type: "application/zip" }),
  );
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = filename;
  lien.style.display = "none";
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA ». */
function jourFr(jour: string): string {
  return jour.split("-").reverse().join("/");
}

const labelCls =
  "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

export function DepotOpcoPanel(props: DepotOpcoPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [depot, setDepot] = useState(props.depotFaitLe ?? "");
  const [numero, setNumero] = useState(props.numeroDossierExterne ?? "");
  const [accord, setAccord] = useState(props.accordEcritLe ?? "");
  const peutEcrire = props.peutEcrire !== false;
  const { encart } = props;
  const manquantes = props.pieces.filter((p) => !p.presente);

  function telecharger(): void {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await genererDossierPretADeposerAction({ sessionId: props.sessionId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      telechargerZip(res.data.base64, res.data.filename);
      setSuccess(
        res.data.manquantes.length > 0
          ? `Dossier téléchargé — pièces manquantes : ${res.data.manquantes.join(", ")}.`
          : "Dossier téléchargé — toutes les pièces de la demande sont jointes.",
      );
      router.refresh();
    });
  }

  function enregistrer(): void {
    setError(null);
    setSuccess(null);
    if (props.dossierId === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depot)) {
      setError("Saisissez la date du dépôt.");
      return;
    }
    const dossierId = props.dossierId;
    startTransition(async () => {
      const res = await enregistrerDepotDossierAction({
        dossierId,
        depotFaitLe: depot,
        ...(numero.trim() !== "" ? { numeroDossierExterne: numero.trim() } : {}),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess("Dépôt enregistré.");
      router.refresh();
    });
  }

  function enregistrerAccord(): void {
    setError(null);
    setSuccess(null);
    if (props.dossierId === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(accord)) {
      setError("Saisissez la date écrite sur l'accord.");
      return;
    }
    const dossierId = props.dossierId;
    startTransition(async () => {
      const res = await enregistrerAccordEcritAction({ dossierId, accordEcritLe: accord });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess("Accord enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <div>
        <div className="mb-[var(--space-admin-2)] flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            {encart.titre}
          </p>
          {encart.portailUrl ? (
            <a
              href={encart.portailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button"
            >
              Ouvrir le dossier OPCO ↗
            </a>
          ) : null}
        </div>
        <dl className="grid grid-cols-1 gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] sm:grid-cols-[max-content_1fr]">
          <dt className="text-[color:var(--color-admin-fg-muted)]">Qui dépose</dt>
          <dd>{encart.qui}</dd>
          <dt className="text-[color:var(--color-admin-fg-muted)]">Portail entreprise</dt>
          <dd className="break-all">{encart.portail}</dd>
          <dt className="text-[color:var(--color-admin-fg-muted)]">
            Délai de dépôt de l&apos;OPCO
          </dt>
          <dd>{encart.delai}</dd>
          <dt className="text-[color:var(--color-admin-fg-muted)]">Date limite de dépôt</dt>
          <dd>{encart.dateLimite}</dd>
          <dt className="text-[color:var(--color-admin-fg-muted)]">Régime de paiement</dt>
          <dd>{encart.regime}</dd>
        </dl>
      </div>

      <div>
        <p className={labelCls}>Pièces de la demande</p>
        <ul className="space-y-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
          {props.pieces.map((p) => (
            <li key={p.libelle}>
              <span
                className={
                  p.presente
                    ? "text-[color:var(--color-admin-success)]"
                    : "text-[color:var(--color-admin-error)]"
                }
              >
                {p.presente ? "Présente" : "Manquante"}
              </span>
              {` — ${p.libelle} (${p.detail})`}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={telecharger}
          disabled={isPending}
          className="admin-button-secondary mt-[var(--space-admin-3)]"
        >
          {isPending ? "Génération…" : "Dossier prêt à déposer (ZIP)"}
        </button>
        {manquantes.length > 0 ? (
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Le ZIP ne contiendra que les pièces présentes ; les manquantes y sont nommées.
          </p>
        ) : null}
      </div>

      <div>
        <p className={labelCls}>Dépôt par l&apos;entreprise</p>
        {!peutEcrire ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {props.depotFaitLe ? `Dépôt fait le ${jourFr(props.depotFaitLe)}` : "Dépôt non saisi"}
            {props.accordEcritLe ? ` · accord écrit le ${jourFr(props.accordEcritLe)}` : ""}
          </p>
        ) : props.dossierId === null ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucun dossier de financement OPCO ouvert pour cette session : le dépôt se saisit sur le
            dossier, depuis le Hub facturation.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
            <div>
              <label htmlFor="depot-fait-le" className={labelCls}>
                Dépôt fait le
              </label>
              <input
                id="depot-fait-le"
                type="date"
                value={depot}
                onChange={(e) => setDepot(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="depot-numero" className={labelCls}>
                N° de dossier OPCO (facultatif)
              </label>
              <input
                id="depot-numero"
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                disabled={isPending}
                maxLength={80}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={enregistrer}
              disabled={isPending}
              className="admin-button"
            >
              Enregistrer le dépôt
            </button>
            <div>
              <label htmlFor="accord-ecrit-le" className={labelCls}>
                Accord écrit le
              </label>
              <input
                id="accord-ecrit-le"
                type="date"
                value={accord}
                onChange={(e) => setAccord(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={enregistrerAccord}
              disabled={isPending}
              className="admin-button-secondary"
            >
              Enregistrer l&apos;accord
            </button>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </div>
  );
}
