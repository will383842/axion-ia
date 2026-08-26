"use client";
// use-client: formulaire interactif (FormData, useTransition, calcul de la date
// de péremption proposée au changement de type ou de date d'émission).

// Formulaire d'une pièce du dossier société. Le MÊME composant sert à importer
// et à modifier : les deux écrans demandent exactement les mêmes champs, et un
// second formulaire aurait dérivé du premier au premier ajout de champ.
//
// `piece` absent → import (le fichier est requis).
// `piece` fourni → modification des métadonnées (le fichier ne bouge pas ; il
// se remplace par son propre bouton, cf. SocieteDocReplaceButton).

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  importerSocieteDocAction,
  modifierSocieteDocAction,
} from "@/server/actions/societe-documents/documents.actions";
import { proposerDateExpiration } from "@/server/societe-documents/rubriques";
import type { SocieteDocTypeDef } from "@/server/societe-documents/rubriques";
import type { SocieteDocumentType } from "../../../../prisma/generated/client";

export interface PieceEditable {
  id: string;
  type: SocieteDocumentType;
  titre: string;
  description: string | null;
  numeroPiece: string | null;
  dateEmission: string | null;
  dateExpiration: string | null;
  sensitive: boolean;
}

interface Props {
  /** Types proposés — ceux de la rubrique courante. */
  types: ReadonlyArray<SocieteDocTypeDef>;
  /** Pièce à modifier. Absent = import d'une nouvelle pièce. */
  piece?: PieceEditable;
  /** Rendu déplié d'emblée (écran de modification). */
  ouvertParDefaut?: boolean;
  /** Appelé après un enregistrement réussi (fermeture d'un panneau parent). */
  onTermine?: () => void;
}

const CHAMP =
  "border-border focus:border-terracotta w-full rounded-md border bg-[color:var(--color-admin-paper)] px-3 py-2 text-sm outline-none";
const LABEL = "text-mocha mb-1 block text-sm font-medium";

export function SocieteDocForm({
  types,
  piece,
  ouvertParDefaut = false,
  onTermine,
}: Props): React.ReactElement {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(ouvertParDefaut);

  const [type, setType] = useState<string>(piece?.type ?? types[0]?.key ?? "");
  const [dateEmission, setDateEmission] = useState<string>(piece?.dateEmission ?? "");
  const [dateExpiration, setDateExpiration] = useState<string>(piece?.dateExpiration ?? "");

  const typeDef = useMemo(() => types.find((t) => (t.key as string) === type), [types, type]);

  /**
   * Propose la date de péremption dès qu'on connaît le type et la date
   * d'émission. C'est une PROPOSITION : le champ reste éditable, parce que
   * c'est l'attestation qui fait foi, pas notre arithmétique.
   */
  function recalculerExpiration(nouveauType: string, emission: string): void {
    if (!emission) return;
    const propose = proposerDateExpiration(
      nouveauType as SocieteDocumentType,
      new Date(`${emission}T00:00:00.000Z`),
    );
    setDateExpiration(propose ? propose.toISOString().slice(0, 10) : "");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (piece) fd.set("id", piece.id);
    startTransition(async () => {
      const res = piece ? await modifierSocieteDocAction(fd) : await importerSocieteDocAction(fd);
      if (res.ok) {
        if (!piece) formRef.current?.reset();
        if (!ouvertParDefaut) setOpen(false);
        onTermine?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-terracotta text-terracotta hover:bg-terracotta inline-flex items-center gap-2 rounded-md border bg-[color:var(--color-admin-paper)] px-3 py-2 text-sm font-medium transition hover:text-white"
      >
        + Importer une pièce
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="border-border space-y-3 rounded-lg border bg-[color:var(--color-admin-paper)] p-4"
    >
      <div>
        <label className={LABEL} htmlFor="sd-type">
          Nature de la pièce <span className="text-terracotta">*</span>
        </label>
        <select
          id="sd-type"
          name="type"
          required
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            recalculerExpiration(e.target.value, dateEmission);
          }}
          className={CHAMP}
        >
          {types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {typeDef?.motif ? <p className="text-fg-muted mt-1 text-xs">{typeDef.motif}</p> : null}
      </div>

      <div>
        <label className={LABEL} htmlFor="sd-titre">
          Titre <span className="text-terracotta">*</span>
        </label>
        <input
          id="sd-titre"
          name="titre"
          required
          maxLength={200}
          defaultValue={piece?.titre ?? ""}
          className={CHAMP}
          placeholder="Ex. Extrait Kbis au 30 juillet 2026"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="sd-emission">
            Date d&apos;émission
          </label>
          <input
            id="sd-emission"
            name="dateEmission"
            type="date"
            value={dateEmission}
            onChange={(e) => {
              setDateEmission(e.target.value);
              recalculerExpiration(type, e.target.value);
            }}
            className={CHAMP}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="sd-expiration">
            Périme le
          </label>
          <input
            id="sd-expiration"
            name="dateExpiration"
            type="date"
            value={dateExpiration}
            onChange={(e) => setDateExpiration(e.target.value)}
            className={CHAMP}
          />
          <p className="text-fg-muted mt-1 text-xs">
            {typeDef?.validiteMois
              ? `Proposé à ${typeDef.validiteMois} mois après l'émission — corrigez si l'attestation dit autre chose.`
              : "Laisser vide si la pièce ne périme pas."}
          </p>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="sd-numero">
          Numéro de la pièce
        </label>
        <input
          id="sd-numero"
          name="numeroPiece"
          maxLength={60}
          defaultValue={piece?.numeroPiece ?? ""}
          className={CHAMP}
          placeholder="N° de police, code de vérification, n° de certificat…"
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="sd-description">
          Note interne
        </label>
        <input
          id="sd-description"
          name="description"
          maxLength={2000}
          defaultValue={piece?.description ?? ""}
          className={CHAMP}
          placeholder="Ex. transmise à Délifrance le 3 septembre"
        />
      </div>

      {piece ? null : (
        <div>
          <label className={LABEL} htmlFor="sd-file">
            Fichier <span className="text-terracotta">*</span>
          </label>
          <input
            id="sd-file"
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
            className="text-fg-muted block w-full text-sm"
          />
          <p className="text-fg-muted mt-1 text-xs">PDF, Office ou image · 10 Mo max.</p>
        </div>
      )}

      <label className="text-mocha flex items-center gap-2 text-sm">
        <input
          name="sensitive"
          type="checkbox"
          defaultChecked={piece?.sensitive ?? typeDef?.sensibleParDefaut ?? false}
          className="h-4 w-4"
        />
        Pièce confidentielle (donnée personnelle — accès réservé aux administrateurs, sans aperçu
        navigateur)
      </label>

      {error ? (
        <p className="text-sm text-[color:var(--color-admin-destructive-fg)]">{error}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-terracotta inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {ouvertParDefaut ? null : (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={pending}
            className="text-fg-muted hover:text-mocha px-3 py-2 text-sm"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
