// Notification e-mail à la publication d'une nouvelle version de document.
// Résout les destinataires (listes admin DocumentRecipient) par rôle — dérivé
// de la visibilité du document — et par scope (famille / prestation), puis
// enqueue un e-mail par destinataire (idempotent, fail-soft). Aucun compte.

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import {
  FAMILLES,
  getInterventionBySlug,
  type InterventionFamille,
} from "@/content/intervention-documents-catalog";
import { targetRoles } from "./visibility-mapping";

export async function notifyNewVersion(versionId: string): Promise<{ enqueued: number }> {
  const version = await prisma.interventionDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });
  if (!version || version.statut !== "publie") return { enqueued: 0 };

  const doc = version.document;
  const roles = targetRoles(doc.visibilite);
  if (roles.length === 0) return { enqueued: 0 };

  const recipients = await prisma.documentRecipient.findMany({
    where: {
      actif: true,
      role: { in: roles },
      AND: [
        { OR: [{ famille: null }, { famille: doc.famille }] },
        { OR: [{ interventionSlug: null }, { interventionSlug: doc.interventionSlug }] },
      ],
    },
    select: { id: true, email: true },
  });
  if (recipients.length === 0) return { enqueued: 0 };

  const interventionLabel =
    getInterventionBySlug(doc.interventionSlug)?.labelFr ?? doc.interventionSlug;
  const familleLabel =
    FAMILLES.find((f) => f.key === (doc.famille as InterventionFamille))?.titre ?? doc.famille;

  // Liens de téléchargement signés (TTL 14 j), générés une seule fois pour tous
  // les destinataires. Fail-soft : si R2 indisponible, l'e-mail part sans lien.
  const TTL_SECONDS = 14 * 24 * 3600;
  const sign = async (key: string | null): Promise<string | undefined> => {
    if (!key || !isR2Configured()) return undefined;
    try {
      return await getSignedUrlR2(key, TTL_SECONDS);
    } catch {
      return undefined;
    }
  };
  const sourceUrl = await sign(version.sourceKey);
  const pdfUrl = await sign(version.pdfKey);
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com"}/fr/espace-ressources`;

  // 🔴 2026-09-05 — `enqueued++` était INCONDITIONNEL, sur un retour jeté.
  //
  // Même famille que le `envoyes++` corrigé le 2026-08-19 dans
  // `qualiopi/emargement/envoi-liens.ts` (constat `D5-3-01`) : le compteur
  // comptait les TOURS DE BOUCLE, pas les mises en file. Le `try/catch`
  // ci-dessous ne protégeait rien — `enqueueEmail` NE LÈVE PAS quand l'envoi
  // n'a pas lieu, elle RETOURNE `{ enqueued: false }` (file absente, adresse
  // retenue, e-mail garé en corbeille). Le `catch` ne voyait donc aucun de ces
  // chemins, et la fonction annonçait N destinataires notifiés sur zéro envoi.
  //
  // ⚠️ Le compteur est aujourd'hui jeté par son unique appelant
  // (`documents.actions.ts` : `.catch(() => undefined)`), donc rien ne ment à
  // l'écran — le défaut est LATENT. Il se ferme maintenant parce qu'un
  // compteur faux est un piège armé : le jour où quelqu'un l'affichera, il
  // dira « 12 destinataires prévenus » sans qu'une ligne ait changé ici.
  let enqueued = 0;
  const echecs: string[] = [];
  for (const r of recipients) {
    try {
      const envoi = await enqueueEmail(
        "documents-nouvelle-version",
        r.email,
        "fr",
        {
          interventionLabel,
          slotTitre: doc.titre,
          version: version.version,
          familleLabel,
          changeNote: version.changeNote ?? undefined,
          sourceUrl,
          pdfUrl,
          sourceFormat: version.sourceFormat ?? undefined,
          portalUrl,
        },
        { jobId: `doc-version-${versionId}-${r.id}` },
      );
      if (envoi.enqueued) {
        enqueued++;
      } else {
        echecs.push(r.email);
      }
    } catch {
      /* fail-soft par destinataire : un envoi raté n'invalide pas les autres */
      echecs.push(r.email);
    }
  }

  // Le fail-soft reste entier — la publication ne dépend pas de l'e-mail —,
  // mais il cesse d'être MUET. Sans cette ligne, une publication qui ne
  // prévient personne est indiscernable d'une publication sans destinataire.
  if (echecs.length > 0) {
    console.error(
      `[intervention-documents] version ${versionId} : ${echecs.length} destinataire(s) ` +
        `sur ${recipients.length} n'ont PAS été prévenus (file indisponible, adresse retenue, ` +
        "ou e-mail garé en corbeille de validation). Aucun rattrapage automatique n'existe : " +
        "les prévenir demande un geste manuel.",
    );
  }

  return { enqueued };
}
