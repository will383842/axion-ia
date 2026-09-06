"use client";
// use-client: état local du montant + useTransition pour setSessionMontantAction. router.refresh() après succès.

/**
 * SessionMontantForm — Correction du montant HT d&apos;une session.
 *
 * 🔴 Raison d&apos;être : `createSessionAction` était la SEULE écriture de
 * `montantHtCents`. Il existait `setSessionLieuAction` et `setSessionDatesAction` ;
 * rien pour le prix. La page Financement l&apos;affichait en lecture seule. Un
 * montant saisi de travers était donc gelé pour toujours — et il part sur la
 * CONVENTION et sur la FACTURE. Sur AXI-SESS-2026-001, il a fallu une écriture
 * SQL directe EN PRODUCTION pour corriger 1 900 € en 100 €.
 *
 * ⚠️ Ce que cet écran doit dire, et qui est tout l&apos;enjeu : les pièces DÉJÀ
 * émises sont figées. Une convention qui annonce 1 900 € y reste tant
 * qu&apos;on ne la refait pas. Corriger le montant sans réémettre laisse la
 * pièce contredire le registre — c&apos;est-à-dire exactement la situation que
 * cette correction existe pour rendre réparable, pas pour masquer. D&apos;où le
 * compte de pièces concernées AVANT l&apos;enregistrement (permanent, il vient
 * du serveur au rendu) ET après (rendu par l&apos;action).
 *
 * ⚠️ Saisie en EUROS, colonne en CENTIMES. La conversion se fait ici, une seule
 * fois, sur une chaîne validée — jamais par un `parseFloat` direct qui
 * accepterait « 12e3 » ou « .5 ».
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setSessionMontantAction } from "@/server/actions/qualiopi/sessions";
import { centimesVersEuros, eurosVersCentimes } from "@/components/admin/qualiopi/montant-euros";

export interface SessionMontantFormProps {
  sessionId: string;
  /** Valeur actuelle, en CENTIMES, telle qu&apos;elle est en base. */
  initialMontantHtCents: number;
  /**
   * Pièces financières VIVANTES (convention, tripartite, facture, devis non
   * annulées) comptées côté serveur au rendu.
   *
   * Affiché en permanence, pas seulement après un refus : c&apos;est ce qui
   * permet de savoir AVANT de corriger qu&apos;il faudra réémettre. Un
   * avertissement qui n&apos;apparaît qu&apos;après l&apos;enregistrement
   * n&apos;est vu que par celui qui a déjà cliqué.
   */
  piecesFinancieres: number;
  /** Lien vers le bloc Documents de la fiche, où les pièces se réémettent. */
  hrefDocuments: string;
}

export function SessionMontantForm({
  sessionId,
  initialMontantHtCents,
  piecesFinancieres,
  hrefDocuments,
}: SessionMontantFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [montant, setMontant] = useState(centimesVersEuros(initialMontantHtCents));
  const [motif, setMotif] = useState("");
  // Comme `SessionDatesForm` : on ne réclame pas le motif d'emblée. Sur une
  // session sans aucune pièce, en faire une cérémonie découragerait la
  // correction d'une coquille — et c'est la coquille qui coûte cher.
  const [motifRequis, setMotifRequis] = useState(piecesFinancieres > 0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cents = eurosVersCentimes(montant);
  const modifie = cents !== null && cents !== initialMontantHtCents;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (cents === null) {
      setError(
        "Montant invalide. Attendu : un nombre en euros, deux décimales au plus (ex. 1200 ou 1200,50).",
      );
      return;
    }
    startTransition(async () => {
      const result = await setSessionMontantAction({
        id: sessionId,
        montantHtCents: cents,
        ...(motif.trim() !== "" ? { motif: motif.trim() } : {}),
      });
      if ("error" in result) {
        setError(result.error);
        // La garde serveur NOMME les pièces en jeu. C'est cette phrase qui
        // justifie l'apparition du champ : sans elle, réclamer un motif
        // ressemblerait à une formalité arbitraire.
        if (result.error.includes("pièce(s) financière(s)")) setMotifRequis(true);
        return;
      }
      setMotif("");
      setSuccessMsg(
        result.data.piecesFinancieres > 0
          ? `Montant enregistré. ⚠️ ${result.data.piecesFinancieres} pièce${result.data.piecesFinancieres > 1 ? "s" : ""} déjà émise${result.data.piecesFinancieres > 1 ? "s" : ""} annonce${result.data.piecesFinancieres > 1 ? "nt" : ""} encore l'ancien montant : elles ne se corrigent pas toutes seules. Réémettez-les depuis le bloc Documents de la fiche, sinon la pièce et le registre se contredisent.`
          : "Montant enregistré. Aucune pièce financière n'avait encore été émise : rien à réémettre.",
      );
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Prix HT de la prestation. C&apos;est lui qui part sur la <strong>convention</strong> et sur
        la <strong>facture</strong>.
      </p>

      <div className="mb-[var(--space-admin-4)]">
        <label className={labelCls} htmlFor="session-montant-ht">
          Montant HT (€)
        </label>
        <input
          id="session-montant-ht"
          type="text"
          inputMode="decimal"
          required
          disabled={isPending}
          className="admin-input"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          aria-describedby="session-montant-aide"
        />
        <p
          id="session-montant-aide"
          className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          En euros, deux décimales au plus. Actuellement en base :{" "}
          {(initialMontantHtCents / 100).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
          })}
          .
        </p>
        {montant.trim() !== "" && cents === null && (
          <p
            role="alert"
            className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            Ce n&apos;est pas un montant lisible. Exemples acceptés : 1200 · 1200,50 · 1 200,50
          </p>
        )}
      </div>

      {motifRequis && (
        <div className="mb-[var(--space-admin-4)]">
          <label className={labelCls} htmlFor="session-montant-motif">
            Motif de la correction (versé au registre)
          </label>
          <textarea
            id="session-montant-motif"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            disabled={isPending}
            className="admin-input"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : tarif saisi à la création sur la grille inter alors que la prestation est intra ; accord client du 4 septembre."
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Un prix qui bouge après qu&apos;une convention l&apos;a annoncé doit pouvoir
            s&apos;expliquer devant un contrôle. C&apos;est cette phrase que l&apos;auditeur lira.
          </p>
        </div>
      )}

      {/* 🔴 Ce qui NE SUIT PAS la correction. Permanent, et dit AVANT
          d'enregistrer : c'est ce qui permet de décider s'il faut aussi
          réémettre — et de le faire, plutôt que de le découvrir en contrôle. */}
      {piecesFinancieres > 0 && (
        <p
          role="status"
          className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          <strong>
            {piecesFinancieres} pièce{piecesFinancieres > 1 ? "s" : ""} financière
            {piecesFinancieres > 1 ? "s" : ""} vivante{piecesFinancieres > 1 ? "s" : ""} annonce
            {piecesFinancieres > 1 ? "nt" : ""} le montant actuel.
          </strong>{" "}
          Convention, convention tripartite, facture ou devis non annulés. Les corriger n&apos;est
          pas automatique : après cette modification, réémettez-les depuis{" "}
          <a
            href={hrefDocuments}
            className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            le bloc Documents de la fiche
          </a>
          , ou annulez-les au registre si elles n&apos;ont plus lieu d&apos;être.
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg !== null && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending || !modifie} className="admin-button">
        {isPending ? "Enregistrement…" : "Modifier le montant HT"}
      </button>
    </form>
  );
}
