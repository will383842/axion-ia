"use client";
// use-client: champ du destinataire et verrou anti double clic de l'envoi.

/**
 * E-mail au client (fiche E16, décision D9 : PAS d'e-mail personnalisé en v1). Aucun modèle,
 * aucun objet ni message modifiable, aucun exemplaire pour l'administrateur : le contenu est
 * celui de la corbeille de relecture, côté serveur. Ne reste que le destinataire (affiché en
 * LECTURE SEULE : le serveur écrit à la fiche client) et « Envoyer
 * au client », qui appelle l'action UNE fois (verrou immédiat contre le double clic). Aucun
 * envoi à l'affichage, aucune relance.
 */
import { Send } from "lucide-react";
import { useId, useRef, useState } from "react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminCard } from "@/components/admin/ui/AdminCard";

export interface EmailAEnvoyer {
  a: string;
}

type Resultat<T> = { data: T } | { error: string };

export interface PropsEmailEnvoi {
  destinataire: string;
  /** Salutation lue sur la fiche du client (affichée en lecture seule) ; absente = suit la fiche. */
  salutation?: string | undefined;
  envoyer: (email: EmailAEnvoyer) => Promise<Resultat<{ enCorbeille: boolean; note?: string }>>;
}

export function EmailEnvoi({ destinataire, salutation, envoyer }: PropsEmailEnvoi) {
  const uid = useId();
  // Lecture seule : le serveur écrit à la fiche client, aucune adresse n'est saisie ici.
  const a = destinataire;
  const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const verrou = useRef(false);
  const [enCours, setEnCours] = useState(false);

  async function lancerEnvoi() {
    if (verrou.current || envoye) return;
    if (a.trim() === "") {
      setErreur(
        "La fiche du client n'a pas d'adresse e-mail : complétez la fiche avant d'envoyer.",
      );
      return;
    }
    verrou.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await envoyer({ a: a.trim() });
      if ("error" in r) {
        setErreur(r.error);
      } else {
        setEnvoye(true);
        setStatut(
          r.data.enCorbeille
            ? `En attente dans « Emails, À valider ».${r.data.note ? ` ${r.data.note}` : ""}`
            : (r.data.note ??
                "Le devis est envoyé, mais l'e-mail n'a pas été préparé : ouvrez la fiche du devis."),
        );
      }
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return (
    <AdminCard as="div">
      <section aria-labelledby={`${uid}-t`}>
        <h3
          id={`${uid}-t`}
          className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-lg)] font-semibold"
        >
          L&apos;e-mail envoyé au client
        </h3>
        <div className="grid gap-[var(--space-admin-4)]">
          <label className="grid items-center gap-1 sm:grid-cols-[4rem_minmax(0,1fr)]">
            À
            <input
              type="email"
              className="min-h-[44px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-control-border)] bg-[color:var(--color-admin-surface-sunken)] px-[var(--space-admin-4)]"
              value={a}
              readOnly
              aria-describedby={`${uid}-adresse`}
            />
          </label>
        </div>
        <p
          id={`${uid}-adresse`}
          className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        >
          Adresse lue sur la fiche du client ; elle ne se modifie pas ici.
        </p>
        <div className="mt-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-1)]">
          <details className="relative inline-block">
            <summary
              aria-label="En savoir plus sur la pièce jointe"
              className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] [&::-webkit-details-marker]:hidden"
            >
              <span
                aria-hidden="true"
                className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[color:var(--color-admin-control-border)] text-[length:var(--text-admin-xs)] font-bold"
              >
                ?
              </span>
            </summary>
            <div className="absolute top-11 left-0 z-10 w-80 rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] shadow-[var(--shadow-admin-2)]">
              Pièce jointe : le devis en PDF, avec le bouton pour choisir et signer. Selon le
              réglage en vigueur, l&apos;e-mail part tout de suite ou attend votre validation dans «
              Emails, À valider » ; dans ce second cas, le devis reste en brouillon tant que
              l&apos;e-mail n&apos;est pas validé. Le client reçoit uniquement ce message, jamais de
              relance automatique.
            </div>
          </details>
        </div>
        <p
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          data-testid="salutation-email"
        >
          {salutation !== undefined && salutation.trim() !== ""
            ? `L'e-mail commencera par : ${salutation}`
            : "La salutation suit la fiche du client."}
        </p>
        <div className="mt-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-3)]">
          <AdminButton
            size="lg"
            icon={Send}
            onClick={() => void lancerEnvoi()}
            disabled={envoye || enCours}
            loading={enCours}
          >
            {enCours ? "Envoi…" : "Envoyer au client"}
          </AdminButton>
        </div>
        {erreur ? (
          <p
            role="alert"
            className="mt-[var(--space-admin-3)] text-[color:var(--color-admin-destructive-fg)]"
          >
            {erreur}
          </p>
        ) : null}
        <p role="status" className="mt-[var(--space-admin-3)]">
          {statut ?? ""}
        </p>
      </section>
    </AdminCard>
  );
}
