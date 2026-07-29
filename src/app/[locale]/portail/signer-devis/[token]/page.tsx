/**
 * Portail client — Signature du devis (« bon pour accord », canal A).
 *
 * URL : /{locale}/portail/signer-devis/{token}
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
import { getSignedUrlR2 } from "@/lib/r2-storage";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { lireDevisASigner } from "@/server/qualiopi/documents/signature/devis-signature-queries";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { mentionCompleteDocument } from "@/server/qualiopi/documents/signature/mentions-document";
import { signerDevisParJetonAction } from "@/server/actions/qualiopi/devis-signature";
import { DevisSignatureForm } from "@/components/portail/DevisSignatureForm";
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

  const regimeConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeConfig) ? regimeConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;

  const devis = await lireDevisASigner(verif.documentGenereId, regimeTva, tauxStandard);
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

  // Cette partie a-t-elle DÉJÀ signé ? On le dit ici plutôt que de laisser le
  // client tracer une signature pour se voir refuser en `deja_signe` après coup.
  const dejaSignee = await prisma.documentSignature.count({
    where: { documentGenereId: verif.documentGenereId, partie: verif.partie, revokedAt: null },
  });
  if (dejaSignee > 0) {
    return (
      <Message
        titre="Vous avez déjà signé ce devis"
        detail={`Votre « bon pour accord » sur le devis ${devis.numero} est enregistré. ${identite.raisonSociale} vous adressera l'exemplaire contresigné.`}
      />
    );
  }

  // Empreinte de la pièce : le PDF EXACT que la signature scellera. Une URL
  // signée courte — 15 min suffisent pour lire avant de signer, et un lien
  // public ne doit pas laisser fuiter une pièce contractuelle durablement.
  const piece = await prisma.documentGenere.findUnique({
    where: { id: verif.documentGenereId },
    select: { pdfUrl: true },
  });
  let pdfUrl: string | null = null;
  if (piece?.pdfUrl != null && piece.pdfUrl !== "") {
    try {
      pdfUrl = await getSignedUrlR2(piece.pdfUrl, 15 * 60);
    } catch {
      // Un lien de lecture indisponible ne doit pas empêcher de signer : le
      // détail complet est affiché à l'écran, et c'est lui que le signataire lit.
      pdfUrl = null;
    }
  }

  const circuit = circuitPour("devis");
  const mentions = mentionCompleteDocument(
    verif.partie,
    {
      pieceLibelle: circuit?.libelle ?? "devis",
      pieceNumero: devis.numero,
      organisme: identite.raisonSociale,
    },
    circuit?.canal === "maison",
  );

  return (
    <DevisSignatureForm
      token={token}
      numero={devis.numero}
      dateValiditeLisible={devis.dateValiditeLisible}
      organismeNom={identite.raisonSociale}
      clientRaisonSociale={devis.clientRaisonSociale}
      signataireNom={verif.signataireNom}
      signataireQualite={verif.signataireQualite}
      lignes={devis.lignes}
      totalHtLisible={devis.totalHtLisible}
      totalTtcLisible={devis.totalTtcLisible}
      mentionTva={devis.mentionTva}
      pdfUrl={pdfUrl}
      mention={mentions.join(" ")}
      signerAction={signerDevisParJetonAction}
    />
  );
}
