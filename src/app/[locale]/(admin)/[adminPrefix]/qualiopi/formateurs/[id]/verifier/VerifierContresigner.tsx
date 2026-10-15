"use client";
// use-client: cases à cocher des cinq blocs, bouton grisé en direct, envoi par transition.

import { useState, useTransition } from "react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import {
  contresignerEtOuvrirEspaceAction,
  demanderComplementFormateurAction,
  refuserDossierFormateurAction,
  type ResultatW4,
} from "@/server/actions/qualiopi/formateurs-verifier-contresigner";
import type { EcranW4 } from "@/server/qualiopi/formateurs-independants/verifier-contresigner-lecture";
import {
  MOTIFS_COMPLEMENT,
  MOTIFS_ORANGE,
  blocsW4,
  manquesPourContresigner,
  orangeAVerifier,
  raisonGrise,
  refusPossible,
  type MotifComplement,
  type Pastille,
  type SaisieW4,
} from "@/server/qualiopi/formateurs-independants/verifier-contresigner-regles";

const TON: Record<Pastille, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  vert: "success",
  orange: "warning",
  rouge: "destructive",
  a_faire: "info",
  neutre: "neutral",
};

const LIBELLE: Record<Pastille, string> = {
  vert: "Vert",
  orange: "À contrôler",
  rouge: "Rouge",
  a_faire: "À faire",
  neutre: "En direct",
};

interface Props {
  ecran: EcranW4;
  peutContresigner: boolean;
  peutVerifier: boolean;
}

export function VerifierContresigner({ ecran, peutContresigner, peutVerifier }: Props) {
  const f = ecran.faits;
  const [code, setCode] = useState(f.attestation?.code ?? "");
  const [authentique, setAuthentique] = useState(false);
  const [pieces, setPieces] = useState(false);
  const [formations, setFormations] = useState<string[]>([]);
  const [orange, setOrange] = useState(false);
  const [motifOrange, setMotifOrange] = useState<string>("");
  const [motifComplement, setMotifComplement] = useState<MotifComplement | "">("");
  const [resultat, setResultat] = useState<ResultatW4 | null>(null);
  const [enCours, demarrer] = useTransition();

  const saisie: SaisieW4 = {
    codeAttestation: code,
    attestationAuthentique: authentique,
    piecesVerifiees: pieces,
    formationIds: formations,
    orangeVerifie: orange,
    motifOrange: motifOrange === "" ? null : motifOrange,
  };
  const blocs = blocsW4(f, saisie);
  const manques = manquesPourContresigner(f, saisie);
  const grise = manques.length > 0 || !peutContresigner || enCours || f.actif;

  const lancer = (action: () => Promise<ResultatW4>) =>
    demarrer(async () => {
      setResultat(await action());
    });

  const pastille = (cle: string) => {
    const b = blocs.find((x) => x.cle === cle)!;
    return <AdminBadge tone={TON[b.pastille]}>{LIBELLE[b.pastille]}</AdminBadge>;
  };
  const titre = (cle: string) => {
    const b = blocs.find((x) => x.cle === cle)!;
    return (
      <div className="flex items-start justify-between gap-[var(--space-admin-3)]">
        <div>
          <strong>{b.titre}</strong>
          <div className="admin-meta-small">{b.detail}</div>
        </div>
        {pastille(cle)}
      </div>
    );
  };

  const orangeVisible = orangeAVerifier(f);

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <AdminCard>
        {titre("entreprise")}
        {orangeVisible ? (
          <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input
                type="checkbox"
                checked={orange}
                onChange={(e) => setOrange(e.currentTarget.checked)}
                disabled={!peutVerifier || f.actif}
              />
              J&apos;ai vérifié
            </label>
            <select
              className="admin-input"
              aria-label="Motif de la vérification"
              value={motifOrange}
              onChange={(e) => setMotifOrange(e.currentTarget.value)}
              disabled={!orange}
            >
              <option value="">Motif…</option>
              {MOTIFS_ORANGE.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard>{titre("nda")}</AdminCard>

      <AdminCard>
        {titre("attestation")}
        {f.attestation !== null &&
        !f.attestation.prouvee &&
        f.attestation.statutValidation === "en_attente" ? (
          <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
            <input
              className="admin-input"
              aria-label="Code de vérification"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              disabled={!peutVerifier || f.actif}
            />
            <button
              type="button"
              className="admin-button-ghost"
              onClick={() => void navigator.clipboard?.writeText(code)}
            >
              Copier le code
            </button>
            <a
              className="admin-button-ghost"
              href="https://www.urssaf.fr/accueil/outils-documentation/outils/verification-attestation.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir la vérification URSSAF
            </a>
            {ecran.lienAttestation ? (
              <a href={ecran.lienAttestation} target="_blank" rel="noopener noreferrer">
                Voir l&apos;attestation
              </a>
            ) : null}
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input
                type="checkbox"
                checked={authentique}
                onChange={(e) => setAuthentique(e.currentTarget.checked)}
                disabled={!peutVerifier || f.actif}
              />
              Authentique : vérifiée sur urssaf.fr
            </label>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard>
        {titre("pieces")}
        <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
          {ecran.liens.map((l) => (
            <a key={l.libelle} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.libelle}
            </a>
          ))}
          {ecran.dateDuCv !== null ? <span>{ecran.dateDuCv}</span> : null}
          {blocs.find((b) => b.cle === "pieces")?.pastille !== "rouge" ? (
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input
                type="checkbox"
                checked={pieces}
                onChange={(e) => setPieces(e.currentTarget.checked)}
                disabled={!peutVerifier || f.actif}
              />
              Pièces vérifiées
            </label>
          ) : null}
        </div>
      </AdminCard>

      <AdminCard>
        {titre("formations")}
        <div className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-1)]">
          {ecran.formations.map((fo) => (
            <label key={fo.id} className="flex items-center gap-[var(--space-admin-2)]">
              <input
                type="checkbox"
                checked={fo.habilite || formations.includes(fo.id)}
                disabled={fo.habilite || !peutVerifier || f.actif}
                onChange={(e) => {
                  const coche = e.currentTarget.checked;
                  setFormations((l) => (coche ? [...l, fo.id] : l.filter((x) => x !== fo.id)));
                }}
              />
              {fo.titre}
            </label>
          ))}
        </div>
      </AdminCard>

      <AdminCard>
        <button
          type="button"
          className="admin-button admin-button-block"
          disabled={grise}
          onClick={() =>
            lancer(() =>
              contresignerEtOuvrirEspaceAction({
                trainerId: ecran.trainerId,
                ...saisie,
                formationIds: [...saisie.formationIds],
                motifOrange: saisie.motifOrange as (typeof MOTIFS_ORANGE)[number] | null,
              }),
            )
          }
        >
          {f.actif
            ? "Espace ouvert"
            : enCours
              ? "Contresignature…"
              : "Contresigner et ouvrir son espace"}
        </button>
        {manques.length > 0 && !f.actif ? (
          <p className="admin-meta-small mt-[var(--space-admin-2)]">{raisonGrise(manques)}</p>
        ) : null}
        {!peutContresigner && !f.actif ? (
          <p className="admin-meta-small">Contresigner est réservé à la direction.</p>
        ) : null}
        {resultat ? (
          <div
            role="status"
            className={
              resultat.ok ? "admin-alert admin-alert-success" : "admin-alert admin-alert-error"
            }
          >
            {resultat.ok ? resultat.message : resultat.error}
          </div>
        ) : null}

        {!f.actif ? (
          <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
            <select
              className="admin-input"
              aria-label="Élément à demander"
              value={motifComplement}
              onChange={(e) => setMotifComplement(e.currentTarget.value as MotifComplement | "")}
              disabled={!peutVerifier || enCours}
            >
              <option value="">Élément manquant…</option>
              {MOTIFS_COMPLEMENT.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="admin-button-ghost"
              disabled={!peutVerifier || enCours || motifComplement === ""}
              onClick={() =>
                motifComplement !== "" &&
                lancer(() =>
                  demanderComplementFormateurAction({
                    trainerId: ecran.trainerId,
                    motif: motifComplement,
                  }),
                )
              }
            >
              Demander un complément
            </button>
            {refusPossible(f) ? (
              <button
                type="button"
                className="admin-button-ghost-danger"
                disabled={!peutVerifier || enCours}
                onClick={() =>
                  lancer(() => refuserDossierFormateurAction({ trainerId: ecran.trainerId }))
                }
              >
                Refuser le dossier
              </button>
            ) : null}
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
