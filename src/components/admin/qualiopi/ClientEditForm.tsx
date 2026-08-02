"use client";
// use-client: formulaire d'édition avec état local + Server Action updateClientAction + router.refresh().

/**
 * Édition de la fiche client — identité et CONTACT.
 *
 * ## Le manque que cet écran comble
 *
 * `updateClientAction` accepte depuis toujours `raisonSociale`, `siret`,
 * `nafCode`, `adresse`, `contactNom`, `contactEmail`, `contactTelephone` et
 * `contactFonction` — et **aucune interface ne les lui envoyait jamais**. Seul
 * `ClientBrancheForm` l'appelait, avec trois champs (IDCC, taille, OPCO).
 *
 * Conséquence concrète : une fois un client créé, son contact était figé. Or un
 * devis ne part pas sans adresse de contact (`devis.ts` : `signatureAttendue`
 * exige `contactEmail`), et c'est à cette adresse que part le lien de signature.
 * Une faute de frappe à la création bloquait donc tout le circuit commercial,
 * sans aucun moyen de la corriger depuis l'interface.
 *
 * C'est le cas d'école du code que rien n'appelle : l'action était écrite,
 * testée, et inatteignable. Aucun des 20 000 tests ne pouvait le voir, parce
 * qu'aucun test ne teste ce qui n'est jamais appelé.
 *
 * ## 🔴 Envoi DIFFÉRENTIEL — on n'envoie que ce qui a changé
 *
 * Ce n'est pas une optimisation, c'est une garde. `updateClientAction` déclenche
 * la **ré-inférence OPCO** dès que `nafCode` ou `idcc` est transmis, et sa
 * protection (« seulement si l'OPCO est vide en base ») serait la seule chose
 * qui empêcherait, sur un envoi systématique, d'annuler en silence une
 * correction manuelle d'OPCO à chaque enregistrement d'un champ sans rapport.
 *
 * C'est exactement le raisonnement déjà tenu dans `ClientBrancheForm` : « en
 * omettant la clé quand rien n'a bougé, la ré-inférence serveur reste armée ».
 * On ne le contourne pas par une autre porte.
 *
 * ⚠️ Cet écran ne touche NI l'OPCO, NI l'IDCC, NI la taille : ils restent sur
 * `ClientBrancheForm`, qui porte leur logique. Deux écrans écrivant la même
 * donnée avec deux règles différentes, c'est l'endroit où les deux copies
 * divergent en silence.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientAction } from "@/server/actions/qualiopi/clients";
import { checkSiretFormat } from "@/lib/siret";

export interface ClientEditValues {
  raisonSociale: string;
  siret: string;
  nafCode: string;
  adresse: string;
  contactNom: string;
  contactEmail: string;
  contactTelephone: string;
  contactFonction: string;
}

export interface ClientEditFormProps {
  clientId: string;
  /** `true` pour un particulier : les champs entreprise sont masqués. */
  estParticulier: boolean;
  initial: ClientEditValues;
  /** Où revenir après enregistrement. */
  retourHref: string;
}

export function ClientEditForm({
  clientId,
  estParticulier,
  initial,
  retourHref,
}: ClientEditFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [v, setV] = useState<ClientEditValues>(initial);

  function set<K extends keyof ClientEditValues>(cle: K, valeur: string) {
    setV((p) => ({ ...p, [cle]: valeur }));
    setOk(false);
  }

  // Contrôle LOCAL du SIRET, purement indicatif : le serveur reste l'autorité
  // (même module). On n'en fait délibérément PAS un gate du bouton — un
  // formulaire indébloquable sur une divergence client/serveur coûterait plus
  // cher que la saisie fautive qu'il éviterait.
  const siretSaisi = v.siret.trim();
  const siretCheck = siretSaisi === "" ? null : checkSiretFormat(siretSaisi);
  const siretErreur = siretCheck !== null && !siretCheck.ok ? siretCheck.message : null;

  const modifie = (Object.keys(initial) as Array<keyof ClientEditValues>).some(
    (k) => v[k].trim() !== initial[k].trim(),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    /** Vrai si ce champ a bougé — seul cas où on le transmet. */
    const change = (k: keyof ClientEditValues) => v[k].trim() !== initial[k].trim();

    startTransition(async () => {
      const result = await updateClientAction({
        id: clientId,
        ...(change("raisonSociale") ? { raisonSociale: v.raisonSociale.trim() } : {}),
        ...(change("adresse") ? { adresse: v.adresse.trim() } : {}),
        ...(change("contactNom") ? { contactNom: v.contactNom.trim() } : {}),
        // 🔴 Vidé volontairement → `null`, pas `""`. Le schéma refuse `""`
        // (`.email()`), et une chaîne vide écrite en base ne serait pas
        // « pas d'adresse » : `devis.ts` teste `contactEmail !== null`, et un
        // `""` passerait ce test pour échouer plus loin, à l'envoi.
        ...(change("contactEmail")
          ? { contactEmail: v.contactEmail.trim() === "" ? null : v.contactEmail.trim() }
          : {}),
        ...(change("contactTelephone") ? { contactTelephone: v.contactTelephone.trim() } : {}),
        ...(change("contactFonction") ? { contactFonction: v.contactFonction.trim() } : {}),
        // Champs entreprise uniquement — jamais transmis pour un particulier,
        // où ils n'ont pas de sens et où les masquer sans les exclure de l'envoi
        // les écraserait à vide.
        ...(!estParticulier && change("siret")
          ? { siret: siretSaisi === "" ? null : siretSaisi }
          : {}),
        ...(!estParticulier && change("nafCode") ? { nafCode: v.nafCode.trim() } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOk(true);
        router.refresh();
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
      <div className="grid gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={`${fieldCls} sm:col-span-2`}>
          <label className={labelCls} htmlFor="edit-raisonSociale">
            {estParticulier ? "Prénom et nom" : "Raison sociale"}{" "}
            <span className="text-[color:var(--color-admin-error)]">*</span>
          </label>
          <input
            id="edit-raisonSociale"
            value={v.raisonSociale}
            onChange={(e) => set("raisonSociale", e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>

        {!estParticulier && (
          <>
            <div className={fieldCls}>
              <label className={labelCls} htmlFor="edit-siret">
                SIRET
              </label>
              <input
                id="edit-siret"
                value={v.siret}
                onChange={(e) => set("siret", e.target.value)}
                disabled={isPending}
                className={inputCls}
                inputMode="numeric"
              />
              {siretErreur !== null && (
                <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                  {siretErreur}
                </p>
              )}
            </div>

            <div className={fieldCls}>
              <label className={labelCls} htmlFor="edit-naf">
                Code NAF
              </label>
              <input
                id="edit-naf"
                value={v.nafCode}
                onChange={(e) => set("nafCode", e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Modifier le NAF relance le calcul de l&apos;OPCO — uniquement si aucun OPCO n&apos;a
                été saisi manuellement.
              </p>
            </div>
          </>
        )}

        <div className={`${fieldCls} sm:col-span-2`}>
          <label className={labelCls} htmlFor="edit-adresse">
            Adresse
          </label>
          <input
            id="edit-adresse"
            value={v.adresse}
            onChange={(e) => set("adresse", e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="edit-contactNom">
            Nom du contact
          </label>
          <input
            id="edit-contactNom"
            value={v.contactNom}
            onChange={(e) => set("contactNom", e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="edit-contactFonction">
            Fonction du contact
          </label>
          <input
            id="edit-contactFonction"
            value={v.contactFonction}
            onChange={(e) => set("contactFonction", e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Figée comme qualité du signataire au moment de la signature du devis — c&apos;est elle
            qui atteste le pouvoir d&apos;engager la structure.
          </p>
        </div>

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="edit-contactEmail">
            E-mail du contact
          </label>
          <input
            id="edit-contactEmail"
            type="email"
            value={v.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
          {/* Dit AVANT l'erreur, pas après : sans adresse, l'envoi du devis
              marche mais part sans lien de signature, et l'admin ne l'apprend
              que dans une note de retour. */}
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Sans adresse, le devis part sans lien de signature — le client ne peut pas signer en
            ligne.
          </p>
        </div>

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="edit-contactTelephone">
            Téléphone du contact
          </label>
          <input
            id="edit-contactTelephone"
            value={v.contactTelephone}
            onChange={(e) => set("contactTelephone", e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {ok && (
        <p
          role="status"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          Fiche enregistrée.
        </p>
      )}

      <div className="mt-[var(--space-admin-5)] flex items-center gap-[var(--space-admin-4)]">
        <button
          type="submit"
          disabled={isPending || !modifie}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-paper)] disabled:opacity-40"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <a
          href={retourHref}
          className="text-[length:var(--text-admin-sm)] underline underline-offset-4"
        >
          Retour
        </a>
        {!modifie && !ok && (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Aucune modification.
          </span>
        )}
      </div>
    </form>
  );
}
