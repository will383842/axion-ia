/**
 * Portail — Signature d'une PIÈCE contractuelle par lien public (canal A).
 *
 * URL : /{locale}/portail/signer/{token}
 *
 * Vaut pour les huit circuits du SSOT. Le détail chiffré n'est chargé que pour
 * un devis : c'est la seule pièce dont la substance est un tableau de lignes.
 *
 * ⚠️ Logée sous `portail/` et NON sous `devis/` : `portail/` est whitelisté par
 * `qualiopi:isolation-check`, `devis/` ne l'est pas. Même contrainte que
 * `portail/emarger/[token]`.
 *
 * Accès : public, par jeton. `force-dynamic` + `noindex` — une pièce
 * contractuelle nominative ne doit jamais être mise en cache ni indexée. La
 * route n'est délibérément PAS déclarée dans `pathnames` : `sitemap.ts` l'y
 * pousserait.
 *
 * Server Component. FR en dur, comme le reste du portail.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signedDocumentPdfUrl } from "@/lib/r2-storage";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { lireDevisASigner } from "@/server/qualiopi/documents/signature/devis-signature-queries";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { mentionCompleteDocument } from "@/server/qualiopi/documents/signature/mentions-document";
import { signerPieceParJetonAction } from "@/server/actions/qualiopi/piece-signature";
import { PieceSignatureForm } from "@/components/portail/PieceSignatureForm";
import { prisma } from "@/lib/prisma";
import {
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  isRegimeTva,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Signature du devis",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

function Message({ titre, detail }: { titre: string; detail: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-lg font-semibold text-gray-900">{titre}</h1>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

export default async function SignerDevisPage({ params }: PageProps) {
  const { token } = await params;

  // Le stub du build SSG ne couvre pas les chemins DB de cette page : early-exit
  // obligatoire (contrat ADR 0026).
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) notFound();

  const verif = await verifierTokenDocument(token);
  if (!verif.ok) {
    // Motifs différenciés : « votre lien a expiré » est actionnable pour le
    // client et n'apprend rien à un attaquant — ces motifs ne sont atteignables
    // qu'après validation du HMAC.
    const messages: Record<string, { titre: string; detail: string }> = {
      expire: {
        titre: "Ce lien a expiré",
        detail:
          "Le devis n'est peut-être plus valable. Contactez votre interlocuteur pour en recevoir un nouveau.",
      },
      revoque: {
        titre: "Ce lien a été désactivé",
        detail:
          "Une version révisée du devis vous a probablement été adressée. Utilisez le lien le plus récent, ou contactez votre interlocuteur.",
      },
    };
    const m = messages[verif.raison] ?? {
      titre: "Lien invalide",
      detail: "Ce lien ne permet pas d'accéder à un devis à signer.",
    };
    return <Message titre={m.titre} detail={m.detail} />;
  }

  const identite = await getOrganismeIdentite();

  // 🔴 La pièce d'abord, et son CIRCUIT depuis le SSOT. Cette page ne connaît
  // aucune matrice : elle lit ce que `parties-requises.ts` déclare. Une liste
  // écrite ici divergerait un jour de celle du service, en silence.
  const piece = await prisma.documentGenere.findUnique({
    where: { id: verif.documentGenereId },
    // `createdAt` : indispensable à la clé R2 (`documents/<année>/…`). Sans lui
    // on ne peut pas re-signer, et c'est faute de l'avoir sélectionné qu'on
    // passait `pdfUrl` — une URL — là où une clé était attendue.
    //
    // 🔴 2026-08-15 — les quatre rattachements sont sélectionnés pour résoudre
    // le DESTINATAIRE de la pièce. Ils manquaient, et la page retombait sur
    // `identite.raisonSociale` : une convention adressée à INVEST SUN
    // s'affichait « Établie par AXION IA SAS à l'attention de AXION IA SAS ».
    // Constaté par Will sur la pièce réelle AXI-DOC-2026-032.
    select: {
      numero: true,
      type: true,
      pdfUrl: true,
      createdAt: true,
      client: { select: { raisonSociale: true } },
      trainee: { select: { prenom: true, nom: true } },
      sousTraitant: { select: { nom: true } },
      session: { select: { client: { select: { raisonSociale: true } } } },
    },
  });
  if (piece === null) notFound();

  const circuit = circuitPour(piece.type);
  if (circuit === null) notFound();

  // Cette partie a-t-elle DÉJÀ signé ? On le dit ici plutôt que de laisser le
  // signataire tracer une signature pour se voir refuser en `deja_signe` après
  // coup.
  const dejaSignee = await prisma.documentSignature.count({
    where: { documentGenereId: verif.documentGenereId, partie: verif.partie, revokedAt: null },
  });
  if (dejaSignee > 0) {
    return (
      <Message
        titre="Vous avez déjà signé cette pièce"
        detail={`Votre signature sur ${circuit.libelle} ${piece.numero} est enregistrée. ${identite.raisonSociale} vous adressera l'exemplaire contresigné.`}
      />
    );
  }

  // ── Détail chiffré : UNIQUEMENT pour un devis ──
  //
  // 🔴 C'est la raison d'être de la bascule pour le devis — le signataire doit
  // avoir les lignes, les quantités et les totaux SOUS LES YEUX. Une convention
  // ou un contrat n'a pas de lignes : leur substance est dans le PDF, dont le
  // lien est affiché juste en dessous.
  let devis: Awaited<ReturnType<typeof lireDevisASigner>> = null;
  if (piece.type === "devis") {
    const regimeConfig = await getQualiopiConfig("regime_tva");
    const regimeTva: RegimeTva = isRegimeTva(regimeConfig) ? regimeConfig : REGIME_TVA_DEFAUT;
    const tauxStandard =
      (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
    devis = await lireDevisASigner(verif.documentGenereId, regimeTva, tauxStandard);
    if (devis === null) notFound();

    if (devis.statutBloquant !== null) {
      const messages: Record<string, { titre: string; detail: string }> = {
        deja_accepte: {
          titre: "Ce devis est déjà accepté",
          detail: `Le devis ${devis.numero} a déjà fait l'objet d'un accord. Aucune nouvelle signature n'est nécessaire.`,
        },
        expire: {
          titre: "Ce devis n'est plus en cours",
          detail: `Le devis ${devis.numero} a expiré ou a été refusé. Contactez votre interlocuteur pour en recevoir un nouveau.`,
        },
        brouillon: {
          titre: "Ce devis n'a pas encore été émis",
          detail: "Contactez votre interlocuteur : ce lien a été ouvert avant l'envoi du devis.",
        },
      };
      const m = messages[devis.statutBloquant]!;
      return <Message titre={m.titre} detail={m.detail} />;
    }
  }

  // Le PDF EXACT que la signature scellera. URL signée COURTE — 15 min suffisent
  // pour lire avant de signer, et un lien public ne doit pas laisser fuiter une
  // pièce contractuelle durablement.
  //
  // 🔴 2026-08-01 — l'intention ci-dessus était juste, l'argument était faux :
  // on passait `piece.pdfUrl` à `getSignedUrlR2(key, …)`, donc une URL en guise
  // de CLÉ R2. La pré-signature étant un calcul hors-ligne, rien ne levait — le
  // `try/catch` ne se déclenchait jamais — et le lien affiché renvoyait
  // `NoSuchKey`. Le signataire ne pouvait PAS lire la pièce, alors que la
  // mention qu'il accepte affirme qu'il a « pu en prendre connaissance dans son
  // intégralité avant de signer ». `signedDocumentPdfUrl` prend le document,
  // plus une chaîne : la confusion n'est plus exprimable.
  let pdfUrl: string | null = null;
  if (piece.pdfUrl != null && piece.pdfUrl !== "") {
    try {
      pdfUrl = await signedDocumentPdfUrl(piece, 15 * 60);
    } catch {
      // Un lien de lecture indisponible ne doit pas empêcher de signer.
      pdfUrl = null;
    }
  }

  // ── À l'attention de QUI ──
  //
  // 🔴 Se lisait `devis?.clientRaisonSociale ?? identite.raisonSociale`. Sur
  // toute pièce AUTRE qu'un devis — donc sur les cinq pièces contractuelles —
  // `devis` vaut `null`, et le repli désignait l'organisme lui-même : la page
  // affirmait qu'AXION IA établissait une convention à l'attention d'AXION IA.
  // Le signataire lisait le nom de sa propre contrepartie à la place du sien.
  //
  // On résout depuis les rattachements RÉELS de la pièce, du plus spécifique au
  // plus général. `null` quand rien ne se résout : la phrase se tait alors
  // plutôt que de nommer quelqu'un au hasard — un destinataire faux est pire
  // qu'un destinataire absent sur une pièce qu'on s'apprête à signer.
  const destinataire: string | null =
    devis?.clientRaisonSociale ??
    piece.client?.raisonSociale ??
    piece.session?.client?.raisonSociale ??
    piece.sousTraitant?.nom ??
    (piece.trainee !== null ? `${piece.trainee.prenom} ${piece.trainee.nom}`.trim() : null) ??
    null;

  const mentions = mentionCompleteDocument(
    verif.partie,
    {
      pieceLibelle: circuit.libelle,
      pieceNumero: piece.numero,
      organisme: identite.raisonSociale,
    },
    circuit.canal === "maison",
  );

  return (
    <PieceSignatureForm
      token={token}
      numero={piece.numero}
      pieceLibelle={circuit.libelle}
      dateValiditeLisible={devis?.dateValiditeLisible ?? null}
      organismeNom={identite.raisonSociale}
      clientRaisonSociale={destinataire}
      signataireNom={verif.signataireNom}
      signataireQualite={verif.signataireQualite}
      {...(devis !== null
        ? {
            lignes: devis.lignes,
            totalHtLisible: devis.totalHtLisible,
            totalTtcLisible: devis.totalTtcLisible,
            mentionTva: devis.mentionTva,
          }
        : {})}
      pdfUrl={pdfUrl}
      // 🔴 Lot 3quater — c'était `mentions.join(" ")`. La structure existait
      // dans la donnée (`mentionCompleteDocument` rend un TABLEAU) et se
      // perdait ici, en un pavé compact au-dessus du bouton de signature.
      // Le formulaire reçoit désormais le tableau et le rend structuré ; aucun
      // texte ne change, donc aucune version de mention à incrémenter.
      mentions={mentions}
      signerAction={signerPieceParJetonAction}
    />
  );
}
