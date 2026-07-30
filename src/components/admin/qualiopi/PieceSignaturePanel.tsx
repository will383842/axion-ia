"use client";
// use-client: état local (lien émis, erreurs) + appels Server Actions.

/**
 * Panneau de signature d'une PIÈCE contractuelle, dans la console.
 *
 * 🔴 Sans cet écran, `emettreLienSignatureAction` et `contresignerPieceAction`
 * n'étaient appelables par personne — les cinq circuits contractuels seraient
 * restés exactement là où ils étaient : du code de signature écrit, testé, et
 * inatteignable. C'est le défaut que ce chantier a déjà trouvé trois fois.
 *
 * ## Ce qu'il montre, et ce qu'il refuse de montrer
 *
 * · Les signatures RÉELLEMENT apposées, avec identité figée, horodatage et
 *   empreinte ENTIÈRE — jamais un simple « signé ».
 * · Un bouton d'émission par partie qui n'a pas encore signé, SAUF `axionia`
 *   qui signe authentifiée depuis ici même.
 * · Le lien émis n'est affiché QU'UNE FOIS, sans être stocké : seul son hash
 *   l'est. Un lien vaut signature.
 *
 * ⚠️ Le lien n'est pas rendu cliquable. C'est le jeton PERSONNEL du signataire :
 * un admin qui l'ouvre pourrait signer à sa place, et le faisceau de preuve
 * enregistrerait l'adresse IP de l'organisme sous la signature d'un tiers. On
 * copie, on ne clique pas.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/portail/SignaturePad";
// ⚠️ Import de TYPE uniquement : effacé au build, aucun code serveur ne part
// dans le bundle client. `components/admin/qualiopi/` est une zone autorisée du
// cloisonnement, donc ce n'est pas une fuite.
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";

export interface SignatureApposeeVue {
  id: string;
  partie: PartieSignataire;
  signataireNom: string;
  signataireQualite: string | null;
  signeAtLisible: string;
  empreinte: string;
  methode: string;
}

export interface PieceSignaturePanelProps {
  documentGenereId: string;
  numero: string;
  pieceLibelle: string;
  /** Parties requises, DANS L'ORDRE du SSOT. */
  parties: readonly PartieSignataire[];
  signatures: readonly SignatureApposeeVue[];
  emettreAction: (input: {
    documentGenereId: string;
    partie: PartieSignataire;
  }) => Promise<
    { data: { url: string; expiresAt: Date; reemission: boolean } } | { error: string }
  >;
  contresignerAction: (input: {
    documentGenereId: string;
    methode: "trace" | "confirmation_accessible";
    imageDataUrl?: string;
  }) => Promise<
    { ok: true; signatureId: string; statutSignature: string } | { ok: false; message: string }
  >;
}

export function PieceSignaturePanel({
  documentGenereId,
  numero,
  pieceLibelle,
  parties,
  signatures,
  emettreAction,
  contresignerAction,
}: PieceSignaturePanelProps): React.ReactElement {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [lien, setLien] = useState<{ partie: string; url: string; reemission: boolean } | null>(
    null,
  );
  const [contresigneOuvert, setContresigneOuvert] = useState(false);
  const [trace, setTrace] = useState<string | null>(null);
  const [modeAccessible, setModeAccessible] = useState(false);

  const signees = new Set(signatures.map((s) => s.partie));

  function emettre(partie: PartieSignataire) {
    setErreur(null);
    setLien(null);
    startTransition(async () => {
      const res = await emettreAction({ documentGenereId, partie });
      if ("error" in res) setErreur(res.error);
      else setLien({ partie, url: res.data.url, reemission: res.data.reemission });
    });
  }

  function contresigner() {
    setErreur(null);
    startTransition(async () => {
      const res = await contresignerAction({
        documentGenereId,
        methode: modeAccessible ? "confirmation_accessible" : "trace",
        ...(modeAccessible || trace === null ? {} : { imageDataUrl: trace }),
      });
      if (res.ok) {
        setContresigneOuvert(false);
        router.refresh();
      } else setErreur(res.message);
    });
  }

  const labelCls =
    "text-[length:var(--text-admin-xs)] uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <p className="text-[length:var(--text-admin-sm)] font-semibold">
        {`${pieceLibelle} ${numero}`}
      </p>

      {/* Signatures réellement apposées */}
      {signatures.length > 0 && (
        <ul className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-2)]">
          {signatures.map((s) => (
            <li key={s.id} className="text-[length:var(--text-admin-sm)]">
              <span className={labelCls}>{s.partie}</span>
              <span className="block">
                {s.signataireNom}
                {s.signataireQualite !== null ? ` — ${s.signataireQualite}` : ""}
              </span>
              <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {`Signé le ${s.signeAtLisible}`}
                {s.methode === "confirmation_accessible"
                  ? " — confirmation nominative, sans tracé"
                  : ""}
              </span>
              {/* 🔴 Empreinte ENTIÈRE : une empreinte tronquée ne se vérifie pas. */}
              <code className="block text-[length:var(--text-admin-xs)] break-all text-[color:var(--color-admin-fg-muted)]">
                {s.empreinte}
              </code>
            </li>
          ))}
        </ul>
      )}

      {/* Parties restant à signer */}
      <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        {parties
          .filter((p) => !signees.has(p))
          .map((p) =>
            p === "axionia" ? (
              <button
                key={p}
                type="button"
                onClick={() => setContresigneOuvert(true)}
                disabled={enCours}
                className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-paper)] disabled:opacity-40"
              >
                Signer pour l&apos;organisme
              </button>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => emettre(p)}
                disabled={enCours}
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] disabled:opacity-40"
              >
                {`Lien de signature — ${p}`}
              </button>
            ),
          )}
        {parties.every((p) => signees.has(p)) && (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
            Pièce intégralement signée.
          </span>
        )}
      </div>

      {/* 🔴 L'exemplaire signé — sans lui, la preuve n'existait QU'en base : le
          document remis au signataire et vu par l'auditeur continuait d'afficher
          des cadres vides, alors que la signature était enregistrée et chaînée.

          ⚠️ Rendu à la volée. Ce n'est PAS la pièce du registre, dont
          l'empreinte est scellée et ne doit jamais être réécrite. */}
      {signatures.length > 0 && (
        <p className="mt-[var(--space-admin-3)]">
          <a
            href={`/api/qualiopi/pieces/${documentGenereId}/exemplaire-signe`}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline underline-offset-4"
          >
            Télécharger l&apos;exemplaire signé (PDF)
          </a>
          <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            La pièce d&apos;origine, scellée, reste inchangée.
          </span>
        </p>
      )}

      {/* Lien émis — affiché UNE fois, non cliquable */}
      {lien !== null && (
        <div className="mt-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]">
          <p className={labelCls}>{`Lien pour ${lien.partie} — à transmettre`}</p>
          <input
            readOnly
            value={lien.url}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-[var(--space-admin-1)] w-full bg-transparent text-[length:var(--text-admin-xs)]"
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {lien.reemission
              ? "⚠️ Ce lien REMPLACE le précédent, qui ne fonctionne plus. Il n'est affiché qu'une fois."
              : "Il n'est affiché qu'une fois : seule son empreinte est conservée."}
          </p>
        </div>
      )}

      {/* Contresignature de l'organisme */}
      {contresigneOuvert && (
        <div className="mt-[var(--space-admin-3)]">
          {!modeAccessible ? (
            <SignaturePad
              onChange={setTrace}
              disabled={enCours}
              label="Signature de l'organisme"
              onBasculerAccessible={() => {
                setModeAccessible(true);
                setTrace(null);
              }}
            />
          ) : (
            <p className="text-[length:var(--text-admin-sm)]">
              Signature sans tracé manuscrit. Elle sera mentionnée comme telle sur le document.
            </p>
          )}
          <div className="mt-[var(--space-admin-2)] flex gap-[var(--space-admin-3)]">
            <button
              type="button"
              onClick={contresigner}
              disabled={enCours || (!modeAccessible && trace === null)}
              className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-paper)] disabled:opacity-40"
            >
              {enCours ? "Enregistrement…" : "Signer"}
            </button>
            <button
              type="button"
              onClick={() => setContresigneOuvert(false)}
              disabled={enCours}
              className="text-[length:var(--text-admin-sm)] underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {erreur !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}
