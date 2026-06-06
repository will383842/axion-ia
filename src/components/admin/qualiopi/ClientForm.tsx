"use client";
// use-client: formulaire interactif création client (type B2B/B2C + champs conditionnels) avec useTransition.

/**
 * ClientForm — création d'un client entreprise (B2B) ou particulier (B2C, R-B2C).
 *
 * Pour un particulier : raisonSociale = "Prénom Nom" ; les champs entreprise
 * (SIRET / NAF / taille / IDCC) sont masqués (non pertinents). L'édition de la
 * branche (IDCC / taille) reste sur la liste via ClientBrancheForm.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientAction } from "@/server/actions/qualiopi/clients";
import type { CompanySize } from "@/server/qualiopi/crm/types";

type ClientType = "entreprise" | "particulier";

export interface ClientFormProps {
  /** Base href admin clients pour la redirection après création. */
  baseHref: string;
}

export function ClientForm({ baseHref }: ClientFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<ClientType>("entreprise");
  const [raisonSociale, setRaisonSociale] = useState("");
  const [siret, setSiret] = useState("");
  const [nafCode, setNafCode] = useState("");
  const [taille, setTaille] = useState<string>("");
  const [idcc, setIdcc] = useState("");
  const [adresse, setAdresse] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTelephone, setContactTelephone] = useState("");
  const [contactFonction, setContactFonction] = useState("");

  const isParticulier = type === "particulier";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createClientAction({
        type,
        raisonSociale,
        ...(contactNom ? { contactNom } : {}),
        ...(contactEmail ? { contactEmail } : {}),
        ...(contactTelephone ? { contactTelephone } : {}),
        ...(contactFonction ? { contactFonction } : {}),
        ...(adresse ? { adresse } : {}),
        // Champs entreprise uniquement
        ...(!isParticulier && siret ? { siret } : {}),
        ...(!isParticulier && nafCode ? { nafCode } : {}),
        ...(!isParticulier && taille ? { taille: taille as CompanySize } : {}),
        ...(!isParticulier && idcc ? { idcc } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(baseHref);
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="c-type">
            Type de client
          </label>
          <select
            id="c-type"
            value={type}
            onChange={(e) => setType(e.target.value as ClientType)}
            disabled={isPending}
            className={inputCls}
          >
            <option value="entreprise">Entreprise (B2B)</option>
            <option value="particulier">Particulier (B2C — CPF perso)</option>
          </select>
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="c-raison">
            {isParticulier ? "Nom complet (Prénom Nom)" : "Raison sociale"}
          </label>
          <input
            id="c-raison"
            value={raisonSociale}
            onChange={(e) => setRaisonSociale(e.target.value)}
            disabled={isPending}
            required
            maxLength={250}
            className={inputCls}
          />
        </div>

        {!isParticulier && (
          <>
            <div className={fieldCls}>
              <label className={labelCls} htmlFor="c-siret">
                SIRET
              </label>
              <input
                id="c-siret"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                disabled={isPending}
                maxLength={14}
                className={inputCls}
              />
            </div>
            <div className={fieldCls}>
              <label className={labelCls} htmlFor="c-naf">
                Code NAF
              </label>
              <input
                id="c-naf"
                value={nafCode}
                onChange={(e) => setNafCode(e.target.value)}
                disabled={isPending}
                maxLength={6}
                className={inputCls}
              />
            </div>
            <div className={fieldCls}>
              <label className={labelCls} htmlFor="c-taille">
                Taille
              </label>
              <select
                id="c-taille"
                value={taille}
                onChange={(e) => setTaille(e.target.value)}
                disabled={isPending}
                className={inputCls}
              >
                <option value="">—</option>
                <option value="TPE">TPE</option>
                <option value="PME">PME</option>
                <option value="ETI">ETI</option>
                <option value="GRANDE_ENTREPRISE">Grande entreprise</option>
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls} htmlFor="c-idcc">
                IDCC (branche)
              </label>
              <input
                id="c-idcc"
                value={idcc}
                onChange={(e) => setIdcc(e.target.value)}
                disabled={isPending}
                maxLength={10}
                className={inputCls}
              />
            </div>
          </>
        )}

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="c-contact-nom">
            {isParticulier ? "Contact (si différent)" : "Contact — nom"}
          </label>
          <input
            id="c-contact-nom"
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="c-contact-email">
            Email
          </label>
          <input
            id="c-contact-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="c-contact-tel">
            Téléphone
          </label>
          <input
            id="c-contact-tel"
            value={contactTelephone}
            onChange={(e) => setContactTelephone(e.target.value)}
            disabled={isPending}
            maxLength={40}
            className={inputCls}
          />
        </div>
        {!isParticulier && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="c-contact-fonction">
              Fonction du contact
            </label>
            <input
              id="c-contact-fonction"
              value={contactFonction}
              onChange={(e) => setContactFonction(e.target.value)}
              disabled={isPending}
              maxLength={150}
              className={inputCls}
            />
          </div>
        )}
        <div className={`${fieldCls} sm:col-span-2`}>
          <label className={labelCls} htmlFor="c-adresse">
            Adresse
          </label>
          <input
            id="c-adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      <div className="mt-[var(--space-admin-5)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Création…" : "Créer le client"}
        </button>
      </div>
    </form>
  );
}
