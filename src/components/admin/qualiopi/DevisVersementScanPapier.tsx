"use client";
// use-client: choix du fichier + état du formulaire + Server Action.

/**
 * Versement du scan d'un devis signé à la main par le client (action `verserScanDevisSigneAction`).
 * Aucune identité n'est saisie ici : le signataire vient de la fiche client, côté serveur.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import type { ResultatVersementScan } from "@/server/actions/qualiopi/devis-scan-papier";

export const TAILLE_MAX_SCAN_ECRAN = 10 * 1024 * 1024;

export interface DevisVersementScanPapierProps {
  devisId: string;
  signataireNom: string;
  organismeNom: string;
  validiteDepassee: string | null;
  verserAction: (formData: FormData) => Promise<ResultatVersementScan>;
}

const fileCls =
  "mt-1 block w-full min-h-[var(--target-admin-min-mobile)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] file:mr-4 file:rounded file:border-0 file:bg-[color:var(--color-admin-surface)] file:px-[var(--space-admin-3)] file:py-[var(--space-admin-2)] file:text-[length:var(--text-admin-sm)] file:font-medium file:text-[color:var(--color-admin-fg)]";
const erreurCls = "mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]";

/** Aujourd'hui, jour civil de Paris, au format `AAAA-MM-JJ` (valeur `max` du champ date). */
function aujourdhuiParisIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Erreurs = { fichier?: string; attestation?: string };

export function DevisVersementScanPapier({
  devisId,
  signataireNom,
  organismeNom,
  validiteDepassee,
  verserAction,
}: DevisVersementScanPapierProps): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [alerte, setAlerte] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [verse, setVerse] = useState(false);
  const [enCours, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const caseRef = useRef<HTMLInputElement>(null);
  const alerteRef = useRef<HTMLParagraphElement>(null);

  function fermer() {
    setOuvert(false);
    setErreurs({});
    setAlerte(null);
    setStatut(null);
    setVerse(false);
  }

  function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enCours) return;
    setAlerte(null);
    setStatut(null);

    const fichier = fichierRef.current?.files?.[0];
    let erreurFichier: string | null = null;
    if (fichier === undefined) erreurFichier = "Choisissez le fichier PDF du devis signé.";
    else if (!fichier.name.toLowerCase().endsWith(".pdf") || fichier.type !== "application/pdf")
      erreurFichier = "Le fichier doit être un PDF.";
    else if (fichier.size === 0) erreurFichier = "Le fichier est vide.";
    else if (fichier.size > TAILLE_MAX_SCAN_ECRAN) erreurFichier = "Le fichier dépasse 10 Mo.";
    if (erreurFichier !== null) {
      setErreurs({ fichier: erreurFichier });
      fichierRef.current?.focus();
      return;
    }
    if (!caseRef.current?.checked) {
      setErreurs({ attestation: "Cochez l'attestation avant de verser le scan." });
      caseRef.current?.focus();
      return;
    }
    setErreurs({});

    if (formRef.current === null) return;
    const fd = new FormData(formRef.current);
    startTransition(async () => {
      let res: ResultatVersementScan;
      try {
        res = await verserAction(fd);
      } catch {
        setAlerte(
          "Le versement n'a pas abouti (erreur inattendue). Actualisez la fiche pour vérifier si le devis est signé avant de réessayer.",
        );
        alerteRef.current?.focus();
        return;
      }
      if (!res.ok) {
        setAlerte(res.message);
        // le focus part après le rendu de l'alerte
        setTimeout(() => alerteRef.current?.focus(), 0);
        return;
      }
      setVerse(true);
      setStatut(
        res.statutSignature === "signee"
          ? "Scan versé : le devis est signé des deux parties."
          : validiteDepassee !== null
            ? "Scan versé : le devis est enregistré comme signé par le client, sur papier, après sa date de validité. Contresignez-le pour le conclure."
            : "Scan versé : le devis est enregistré comme signé par le client, sur papier. Contresignez-le pour le conclure.",
      );
      if (res.activationRefusee !== undefined) {
        setAlerte(res.activationRefusee);
        setTimeout(() => alerteRef.current?.focus(), 0);
        return;
      }
      router.refresh();
    });
  }

  if (!ouvert) {
    return (
      <div>
        <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Devis signé sur papier
        </h3>
        <p className="my-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Le client a signé le devis imprimé ? Versez-en le scan : il sera enregistré comme
          l&apos;accord du client. Vous contresignerez ensuite pour conclure.
        </p>
        <AdminButton
          variant="secondary"
          className="admin-button-tactile"
          onClick={() => setOuvert(true)}
        >
          Verser le devis signé (scan PDF)
        </AdminButton>
      </div>
    );
  }

  return (
    <form
      id="scan-papier-formulaire"
      ref={formRef}
      noValidate
      onSubmit={soumettre}
      className="space-y-[var(--space-admin-4)]"
    >
      <input type="hidden" name="devisId" value={devisId} />
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        {`Signataire : ${signataireNom}, d'après la fiche client. Pour un autre nom, corrigez d'abord la fiche client.`}
      </p>
      {validiteDepassee !== null && (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
          {`La date de validité de ce devis (${validiteDepassee}) est dépassée. Le scan sera tout de même accepté : en le versant, vous acceptez l'accord tardif du client aux conditions du PDF d'origine.`}
        </p>
      )}

      <div>
        <label
          htmlFor="scan-papier-date-ecrite"
          className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
        >
          Date écrite par le client sur le devis (facultatif)
        </label>
        <input
          id="scan-papier-date-ecrite"
          name="dateEcriteParClient"
          type="date"
          max={aujourdhuiParisIso()}
          aria-describedby="scan-papier-date-ecrite-aide"
          disabled={enCours}
          className="mt-1 block min-h-[var(--target-admin-min-mobile)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        />
        <p
          id="scan-papier-date-ecrite-aide"
          className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          Recopiez la date qui figure près de sa signature, s&apos;il en a écrit une. Elle est
          gardée pour information : la signature est enregistrée à la date du versement, et le scan
          fait foi.
        </p>
      </div>

      <div>
        <label
          htmlFor="scan-papier-fichier"
          className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
        >
          Scan du devis signé (PDF)
        </label>
        <input
          ref={fichierRef}
          id="scan-papier-fichier"
          name="fichier"
          type="file"
          accept="application/pdf,.pdf"
          required
          aria-invalid={erreurs.fichier !== undefined ? "true" : undefined}
          aria-describedby="scan-papier-fichier-aide scan-papier-fichier-erreur"
          disabled={enCours}
          className={fileCls}
        />
        <p
          id="scan-papier-fichier-aide"
          className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          Un seul fichier PDF, 10 Mo au plus : toutes les pages du devis, signature visible.
        </p>
        <p id="scan-papier-fichier-erreur" className={erreurCls}>
          {erreurs.fichier}
        </p>
      </div>

      <div>
        <label className="flex min-h-[var(--target-admin-min-mobile)] items-start gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <input
            ref={caseRef}
            id="scan-papier-attestation"
            type="checkbox"
            name="attestation"
            value="true"
            aria-invalid={erreurs.attestation !== undefined ? "true" : undefined}
            aria-describedby="scan-papier-attestation-erreur"
            disabled={enCours}
            className="mt-1 h-5 w-5 accent-[color:var(--color-admin-accent)]"
          />
          <span>
            {`J'atteste que ce fichier est la copie fidèle du devis signé à la main par le client, et que l'original papier est conservé par ${organismeNom}.`}
          </span>
        </label>
        <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Une fois versé, le scan est scellé et ne peut pas être retiré depuis cet écran.
        </p>
        <p id="scan-papier-attestation-erreur" className={erreurCls}>
          {erreurs.attestation}
        </p>
      </div>

      <div className="min-h-[6em]">
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          {enCours ? "Versement en cours…" : statut}
        </p>
        <p
          role="alert"
          tabIndex={-1}
          ref={alerteRef}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {alerte}
        </p>
        {verse && (
          <AdminButton
            variant="secondary"
            className="admin-button-tactile mt-[var(--space-admin-2)]"
            onClick={() => router.refresh()}
          >
            Actualiser la fiche
          </AdminButton>
        )}
      </div>

      <div className="flex flex-col gap-[var(--space-admin-3)] sm:flex-row">
        {!verse && (
          <AdminButton type="submit" loading={enCours} className="admin-button-tactile">
            Verser le scan signé
          </AdminButton>
        )}
        <AdminButton
          variant="ghost"
          type="button"
          disabled={enCours}
          className="admin-button-tactile"
          onClick={fermer}
        >
          Annuler
        </AdminButton>
      </div>
    </form>
  );
}
