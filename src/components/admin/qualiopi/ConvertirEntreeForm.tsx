"use client";
// use-client: formulaire repliable avec état local (useState) + appel Server Action convertirEntreeEnClientAction + router.refresh().

/**
 * ConvertirEntreeForm — Conversion 1 clic d'une entrée (appel Calendly /
 * message contact) en client CRM Qualiopi (Lot 3).
 *
 * Bouton « Convertir en client » → petit formulaire pré-rempli (raison
 * sociale, contact, email, téléphone, SIRET/NAF optionnels) → appelle
 * `convertirEntreeEnClientAction`. Après conversion (ou si le client
 * existait déjà au même email), affiche le numéro AXI-CLI-NNN + lien
 * « Créer un devis » vers /qualiopi/devis/new?clientId=…
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { convertirEntreeEnClientAction } from "@/server/actions/qualiopi/entrees";

export interface ConvertirEntreeFormProps {
  source: "calendly" | "submission";
  entreeId: string;
  /** Valeurs pré-remplies depuis l'entrée (modifiables avant création). */
  defaults: {
    raisonSociale: string;
    contactNom: string;
    contactEmail: string;
    contactTelephone: string;
  };
  /** Chemin admin de création de devis : /fr/<prefix>/qualiopi/devis/new */
  devisNewPath: string;
}

interface Converti {
  id: string;
  numero: string;
  dejaExistant: boolean;
}

export function ConvertirEntreeForm({
  source,
  entreeId,
  defaults,
  devisNewPath,
}: ConvertirEntreeFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [converti, setConverti] = useState<Converti | null>(null);

  const [raisonSociale, setRaisonSociale] = useState(defaults.raisonSociale);
  const [contactNom, setContactNom] = useState(defaults.contactNom);
  const [contactEmail, setContactEmail] = useState(defaults.contactEmail);
  const [contactTelephone, setContactTelephone] = useState(defaults.contactTelephone);
  const [siret, setSiret] = useState("");
  const [nafCode, setNafCode] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const rs = raisonSociale.trim();
    if (rs === "") {
      setError("La raison sociale est requise.");
      return;
    }

    startTransition(async () => {
      const result = await convertirEntreeEnClientAction({
        source,
        entreeId,
        raisonSociale: rs,
        ...(contactNom.trim() !== "" ? { contactNom: contactNom.trim() } : {}),
        ...(contactEmail.trim() !== "" ? { contactEmail: contactEmail.trim() } : {}),
        ...(contactTelephone.trim() !== "" ? { contactTelephone: contactTelephone.trim() } : {}),
        ...(siret.trim() !== "" ? { siret: siret.trim() } : {}),
        ...(nafCode.trim() !== "" ? { nafCode: nafCode.trim() } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setConverti(result.data);
        router.refresh();
      }
    });
  }

  // ── CSS helpers (alignés ClientBrancheForm) ──
  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  // Après conversion : badge + lien devis (le refresh serveur affichera ensuite
  // le badge « Client AXI-CLI-NNN » dérivé du match email).
  if (converti) {
    return (
      <div className="flex flex-col gap-[var(--space-admin-1)]">
        <span className="text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-success)]">
          {converti.dejaExistant
            ? `Client existant : ${converti.numero}`
            : `Client ${converti.numero} créé`}
        </span>
        <Link
          href={`${devisNewPath}?clientId=${encodeURIComponent(converti.id)}`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          Créer un devis →
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="admin-button">
        Convertir en client
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-64 flex-col gap-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
    >
      <div>
        <label htmlFor={`rs-${entreeId}`} className={labelCls}>
          Raison sociale <span className="text-[color:var(--color-admin-error)]">*</span>
        </label>
        <input
          id={`rs-${entreeId}`}
          type="text"
          value={raisonSociale}
          onChange={(e) => setRaisonSociale(e.target.value)}
          required
          maxLength={250}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor={`nom-${entreeId}`} className={labelCls}>
          Contact
        </label>
        <input
          id={`nom-${entreeId}`}
          type="text"
          value={contactNom}
          onChange={(e) => setContactNom(e.target.value)}
          maxLength={200}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor={`email-${entreeId}`} className={labelCls}>
          Email
        </label>
        <input
          id={`email-${entreeId}`}
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          maxLength={255}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor={`tel-${entreeId}`} className={labelCls}>
          Téléphone
        </label>
        <input
          id={`tel-${entreeId}`}
          type="tel"
          value={contactTelephone}
          onChange={(e) => setContactTelephone(e.target.value)}
          maxLength={40}
          className={inputCls}
        />
      </div>

      <div className="flex gap-[var(--space-admin-2)]">
        <div className="min-w-0 flex-1">
          <label htmlFor={`siret-${entreeId}`} className={labelCls}>
            SIRET
          </label>
          {/* maxLength 17 : tolère la forme espacée d'un Kbis, que le serveur
              normalise en 14 chiffres. À 14, le collage serait tronqué en
              silence puis rejeté pour longueur. Les id restent dérivés de
              `entreeId` — ce formulaire est rendu N fois dans la liste des
              entrées, des id fixes casseraient l'association label/aria. */}
          <input
            id={`siret-${entreeId}`}
            type="text"
            inputMode="numeric"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            maxLength={17}
            placeholder="Optionnel"
            className={inputCls}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`naf-${entreeId}`} className={labelCls}>
            NAF
          </label>
          <input
            id={`naf-${entreeId}`}
            type="text"
            value={nafCode}
            onChange={(e) => setNafCode(e.target.value)}
            maxLength={6}
            placeholder="Ex. 6201Z"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-[var(--space-admin-2)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Création…" : "Créer le client"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline hover:no-underline"
        >
          Annuler
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </form>
  );
}
