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
import { checkSiretFormat } from "@/lib/siret";
import type { CompanySize } from "@/server/qualiopi/crm/types";

type ClientType = "entreprise" | "particulier";

/** Valeurs de pré-remplissage (conversion d'une demande de contact en client). */
export interface ClientFormInitialValues {
  type?: ClientType;
  raisonSociale?: string;
  contactNom?: string;
  contactEmail?: string;
  contactTelephone?: string;
  contactFonction?: string;
  secteur?: string;
  adresse?: string;
  taille?: string;
  /** Contexte métier (message du lead) transmis au Formation Engine. */
  contexteIa?: string;
  /** Traçabilité (persistée dans `Client.source`). */
  source?: string;
}

export interface ClientFormProps {
  /** Base href admin clients pour la redirection après création. */
  baseHref: string;
  /** Valeurs pré-remplies (ex. conversion d'une Submission). Optionnel. */
  initialValues?: ClientFormInitialValues;
  /** Bannière « pré-rempli depuis … » affichée en tête. Optionnel. */
  prefillNotice?: string;
}

export function ClientForm({
  baseHref,
  initialValues,
  prefillNotice,
}: ClientFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const iv = initialValues ?? {};
  const [type, setType] = useState<ClientType>(iv.type ?? "entreprise");
  const [raisonSociale, setRaisonSociale] = useState(iv.raisonSociale ?? "");
  const [siret, setSiret] = useState("");
  const [nafCode, setNafCode] = useState("");
  const [taille, setTaille] = useState<string>(iv.taille ?? "");
  const [idcc, setIdcc] = useState("");
  const [adresse, setAdresse] = useState(iv.adresse ?? "");
  const [contactNom, setContactNom] = useState(iv.contactNom ?? "");
  const [contactEmail, setContactEmail] = useState(iv.contactEmail ?? "");
  const [contactTelephone, setContactTelephone] = useState(iv.contactTelephone ?? "");
  const [contactFonction, setContactFonction] = useState(iv.contactFonction ?? "");
  // Champs non éditables dans ce formulaire mais transmis à l'action.
  const secteur = iv.secteur ?? "";
  const contexteIa = iv.contexteIa ?? "";
  const source = iv.source ?? "";

  const isParticulier = type === "particulier";

  // Contrôle LOCAL du SIRET, purement indicatif : le serveur reste l'autorité
  // (même module). On n'en fait délibérément PAS un gate du bouton — un
  // formulaire indébloquable sur une divergence client/serveur coûterait plus
  // cher que la saisie fautive qu'il éviterait.
  const siretSaisi = siret.trim();
  const siretCheck = siretSaisi === "" ? null : checkSiretFormat(siretSaisi);
  const siretErreur = siretCheck !== null && !siretCheck.ok ? siretCheck.message : null;

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
        // Champs pré-remplis non éditables ici, propagés tels quels.
        ...(secteur ? { secteur } : {}),
        ...(contexteIa ? { contexteIa } : {}),
        ...(source ? { source } : {}),
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
      {prefillNotice ? (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {prefillNotice} Vérifiez les champs et complétez le SIRET / code NAF (absents du
          formulaire de contact) avant de créer le client.
        </p>
      ) : null}
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
              {/* maxLength 17 et non 14 : un Kbis imprime « 732 829 320 00074 ».
                  À 14, le navigateur TRONQUE le copier-coller, le serveur rejette
                  pour longueur, et l'admin lit un message incompréhensible alors
                  qu'il a bien collé 14 chiffres. Structurel, pas cosmétique.
                  ⚠️ Ce commentaire est en position ENFANT, AVANT la balise : un
                  commentaire JSX entre deux attributs est une erreur de syntaxe
                  (la grammaire n'y admet qu'un attribut ou un spread). */}
              <input
                id="c-siret"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                disabled={isPending}
                inputMode="numeric"
                autoComplete="off"
                maxLength={17}
                placeholder="14 chiffres"
                aria-describedby="c-siret-hint"
                aria-invalid={siretErreur !== null}
                className={inputCls}
              />
              <p
                id="c-siret-hint"
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
              >
                Facultatif. Laissez vide si inconnu, ou si le client est hors France — le SIRET est
                un identifiant français.
              </p>
              {siretErreur !== null ? (
                <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]">
                  {siretErreur}
                </p>
              ) : null}
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
