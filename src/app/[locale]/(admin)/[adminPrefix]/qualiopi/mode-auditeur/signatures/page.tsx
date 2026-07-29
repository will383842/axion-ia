/**
 * Admin — Qualiopi · Registre des signatures (phase 8).
 *
 * Répond, pièce par pièce, à la question qu'un contrôle pose réellement :
 * « cette pièce est-elle signée, par qui, et sa preuve tient-elle ? ».
 *
 * ## Server Component PUR — aucun JS client
 *
 * Le registre est de la lecture. Le rendre interactif tirerait un bundle sur une
 * page consultée trois fois par an, pour un gain nul : les filtres utiles
 * (session, statut, anomalies seules) sont des paramètres d'URL, que le serveur
 * sait lire sans une ligne de JavaScript.
 *
 * ## Ce que cet écran refuse de faire
 *
 * 🔴 Il ne RÉPARE rien. Ni un cache divergent, ni une chaîne rompue. Une anomalie
 * est un RÉSULTAT à présenter, pas une panne à masquer — c'est déjà la doctrine
 * de `verifierChaine`, qui ne lève jamais, et le registre s'y tient.
 *
 * 🔴 Il montre le statut RECALCULÉ et le statut CACHE **côte à côte**. Le cache
 * est ce que la base croit ; les lignes de signature sont ce qui est. N'afficher
 * que le cache reviendrait à présenter comme un audit ce qui n'est qu'une
 * relecture de la valeur qu'on cherche justement à contrôler.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  listerRegistreSignatures,
  type RapportPieceSignature,
} from "@/server/qualiopi/documents/signature/registre-verification";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Registre des signatures | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ anomalies?: string; session?: string }>;
}

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  non_requise: "Non requise",
  en_attente: "En attente",
  partielle: "Partielle",
  signee: "Signée",
  refusee: "Refusée",
  expiree: "Expirée",
};

/**
 * Libellés des anomalies, en clair.
 *
 * ⚠️ Un code machine dans un dossier d'audit ne dit rien à qui le lit. Chaque
 * libellé énonce le FAIT constaté, pas le nom de la règle qui l'a détecté.
 */
const LIBELLE_ANOMALIE: Readonly<Record<string, string>> = {
  pdf_regenere_apres_signature:
    "Le PDF a été régénéré après signature : la signature ne porte plus sur la pièce servie aujourd'hui.",
  parties_sur_versions_differentes:
    "Les parties n'ont pas signé la même version du PDF : aucune version n'a été acceptée par toutes.",
  statut_cache_divergent:
    "Le statut enregistré sur la pièce ne correspond pas à ses lignes de signature.",
  signature_sur_piece_non_signable:
    "Une signature porte sur un type de pièce qu'aucun circuit ne déclare signable.",
  partie_hors_circuit: "Une partie a signé alors que le circuit de cette pièce ne l'attend pas.",
};

const LIBELLE_CHAINE: Readonly<Record<string, string>> = {
  premier_maillon_chaine: "Chaînage : premier maillon incohérent.",
  rupture_chainage: "Chaînage rompu : une ligne semble avoir été retirée après coup.",
  empreinte_invalide: "Empreinte invalide : le contenu scellé ne correspond plus.",
  version_inconnue: "Version de tuple inconnue : l'empreinte n'est plus recalculable.",
  tuple_irrecalculable: "Tuple irrecalculable : il manque des données pour vérifier.",
  maillon_illisible: "Maillon illisible.",
};

/**
 * Horodatage en heure de PARIS, jamais UTC.
 *
 * Un auditeur recoupe ce registre avec des pièces papier et des agendas
 * français : lui présenter une heure UTC lui ferait constater un décalage de
 * deux heures en été, sur des signatures parfaitement régulières.
 */
const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function Compteur({
  valeur,
  libelle,
  alerte,
}: {
  valeur: number;
  libelle: string;
  alerte?: boolean;
}): React.ReactElement {
  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <p
        className={
          alerte === true && valeur > 0
            ? "text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-danger)]"
            : "text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-fg)]"
        }
      >
        {valeur}
      </p>
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {libelle}
      </p>
    </div>
  );
}

function LignePiece({ piece }: { piece: RapportPieceSignature }): React.ReactElement {
  const anomaliesChaine = piece.chaine.anomalies;
  return (
    <tr className="border-b border-[color:var(--color-admin-border)] align-top last:border-b-0">
      <td className="p-[var(--space-admin-3)]">
        <span className="font-mono text-[length:var(--text-admin-xs)]">{piece.numero}</span>
        <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {piece.type}
        </span>
      </td>
      <td className="p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]">
        {/* Recalculé d'abord : c'est lui qui dit la vérité. */}
        <span className="font-semibold">
          {LIBELLE_STATUT[piece.statutRecalcule] ?? piece.statutRecalcule}
        </span>
        {piece.statutRecalcule !== piece.statutCache ? (
          <span className="block text-[color:var(--color-admin-danger)]">
            {`enregistré : ${LIBELLE_STATUT[piece.statutCache] ?? piece.statutCache}`}
          </span>
        ) : null}
      </td>
      <td className="p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]">
        {piece.signataires.length === 0 ? (
          <span className="text-[color:var(--color-admin-fg-muted)]">Aucune signature</span>
        ) : (
          <ul className="space-y-2">
            {piece.signataires.map((s) => {
              // 🔴 L'écart `signeAt` ↔ `createdAt` est la SEULE trace d'une
              // signature insérée tardivement. Le registre expose les deux
              // horodatages précisément pour cela ; n'en afficher qu'un rendrait
              // l'exposition inutile. Seuil d'une minute : en deçà c'est le temps
              // d'écriture de l'image sur R2, au-delà c'est une information.
              const ecartMs = s.createdAt.getTime() - s.signeAt.getTime();
              const insertionTardive = Math.abs(ecartMs) > 60_000;
              return (
                <li key={s.signatureId}>
                  {/* Jamais « signé » tout court : qui, à quel titre, quand, comment. */}
                  <span className="font-medium">{s.signataireNom}</span>
                  {s.signataireQualite !== null ? ` (${s.signataireQualite})` : ""}
                  <span className="block text-[color:var(--color-admin-fg-muted)]">
                    {`${s.partie} · ${horodatageParis.format(s.signeAt)} · ${s.methode} · ${s.provider}`}
                  </span>
                  {insertionTardive ? (
                    <span className="block text-[color:var(--color-admin-danger)]">
                      {`Enregistrée le ${horodatageParis.format(s.createdAt)} — écart avec la date de signature déclarée.`}
                    </span>
                  ) : null}
                  {!s.porteSurLePdfCourant ? (
                    <span className="block text-[color:var(--color-admin-danger)]">
                      Ne porte plus sur le PDF servi aujourd&apos;hui.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {piece.partiesManquantes.length > 0 ? (
          <span className="block text-[color:var(--color-admin-fg-muted)]">
            {`Manque : ${piece.partiesManquantes.join(", ")}`}
          </span>
        ) : null}
      </td>
      <td className="p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]">
        {piece.preuveIntacte ? (
          <span className="text-[color:var(--color-admin-success)]">Preuve intacte</span>
        ) : (
          <ul className="text-[color:var(--color-admin-danger)]">
            {anomaliesChaine.map((a, i) => (
              <li key={`c${i}`}>{LIBELLE_CHAINE[a.type] ?? a.type}</li>
            ))}
            {piece.anomaliesPiece.map((a, i) => (
              <li key={`p${i}`}>{LIBELLE_ANOMALIE[a.type] ?? a.type}</li>
            ))}
          </ul>
        )}
        {piece.empreinteTete !== null ? (
          <span className="mt-1 block font-mono text-[length:var(--text-admin-xs)] break-all text-[color:var(--color-admin-fg-muted)]">
            {`Ancrage : ${piece.empreinteTete}`}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export default async function RegistreSignaturesPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const filtres = await searchParams;
  const seulementAnomalies = filtres.anomalies === "1";
  const registre = await listerRegistreSignatures({
    seulementAnomalies,
    ...(filtres.session !== undefined ? { sessionId: filtres.session } : {}),
  });

  const base = `/${locale}/${adminPrefix}/qualiopi/mode-auditeur`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Registre des signatures"
        description="Pièce par pièce : qui a signé, quand, et si la preuve tient. Lecture seule — aucune anomalie n'est corrigée depuis cet écran."
      />

      {/* 🔴 Un registre tronqué en silence est PIRE qu'un registre absent : il a
          l'air exhaustif. On le dit avant tout le reste. */}
      {registre.tronque ? (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-danger)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          Ce registre est PARTIEL : la limite de lignes a été atteinte. Ne le présentez pas comme un
          inventaire complet — restreignez-le à une session pour obtenir une vue exhaustive.
        </p>
      ) : null}

      {/* Dérive entre le SSOT des circuits et l'enum du schéma. Silencieuse par
          nature : un circuit désignerait un type de pièce qui n'existe pas, et
          ses pièces n'apparaîtraient jamais dans ce registre. */}
      {registre.typesSignablesInconnusDuSchema.length > 0 ? (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-danger)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          {`Incohérence de configuration : ${registre.typesSignablesInconnusDuSchema.join(", ")} — un circuit de signature désigne un type de pièce absent du schéma. Les pièces concernées n'apparaissent pas ici.`}
        </p>
      ) : null}

      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] sm:grid-cols-5">
        <Compteur valeur={registre.nbPieces} libelle="Pièces suivies" />
        <Compteur valeur={registre.nbPreuvesIntactes} libelle="Preuves intactes" />
        <Compteur valeur={registre.nbChainesAnormales} libelle="Chaînes anormales" alerte />
        <Compteur valeur={registre.nbPdfRegeneres} libelle="PDF régénérés après signature" alerte />
        <Compteur
          valeur={registre.nbStatutsCacheDivergents}
          libelle="Statuts enregistrés divergents"
          alerte
        />
      </div>

      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
        <Link
          href={seulementAnomalies ? `${base}/signatures` : `${base}/signatures?anomalies=1`}
          className="underline"
        >
          {seulementAnomalies
            ? "Afficher toutes les pièces"
            : "N'afficher que les pièces dont la preuve n'est pas intacte"}
        </Link>
      </p>

      {registre.pieces.length === 0 ? (
        <p className="rounded-[var(--radius-admin-md)] border border-dashed border-[color:var(--color-admin-border)] p-[var(--space-admin-6)] text-center text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {seulementAnomalies
            ? "Aucune anomalie relevée."
            : "Aucune pièce signable n'a encore été émise."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[color:var(--color-admin-border)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] uppercase">
                <th className="p-[var(--space-admin-3)] font-medium">Pièce</th>
                <th className="p-[var(--space-admin-3)] font-medium">Statut</th>
                <th className="p-[var(--space-admin-3)] font-medium">Signataires</th>
                <th className="p-[var(--space-admin-3)] font-medium">Vérification</th>
              </tr>
            </thead>
            <tbody>
              {registre.pieces.map((p) => (
                <LignePiece key={p.documentGenereId} piece={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
