/**
 * Téléchargement du kit formateur imprimé — espace formateur.
 *
 * Le kit est le classeur A4 que le formateur pose sur la table quand l'outil
 * tombe en panne devant la salle. Sans lui, les plans B de la fiche ne
 * renvoient à rien : il faut donc qu'un formateur puisse le sortir seul, avant
 * sa session, sans passer par la console ni par le dépôt.
 *
 * ## Deux gardes, dans cet ordre
 *
 * 1. `getFormateurSession()` — cookie valide ET `Trainer.actif`. La
 *    désactivation d'un formateur coupe l'accès immédiatement.
 * 2. Appartenance de la session : formateur principal OU ligne
 *    `SessionFormateur`. Sans elle, n'importe quel formateur authentifié
 *    téléchargerait le kit — corrigés compris — de n'importe quelle session.
 *
 * La clé d'entrée est donc l'identifiant de SESSION, jamais le slug de la
 * formation : c'est ce qui rend l'appartenance vérifiable.
 *
 * ## Pourquoi re-signer ici
 *
 * 🔴 `SupportFormation.pdfUrl` est une URL R2 signée 900 s. Une URL stockée est
 * un lien mort quinze minutes après sa création — c'est le défaut déjà corrigé
 * sur `/api/qualiopi/supports/[id]` et sur `/api/qualiopi/documents/[id]`. Le
 * script de publication ne pose donc QUE `pdfKey`, et cette route signe à la
 * demande.
 */

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { existsInR2, getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import { whereSessionsDuFormateur } from "@/server/formateur/collectif-queries";
import { getFormateurSession } from "@/server/formateur/guard";
import { dispositionDemandee } from "@/lib/content-disposition";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  // 🔴 La requête SERT désormais : elle porte `?dl=1`, qui distingue
  // « consulter » de « enregistrer ». Elle s'appelait `_req` parce que rien
  // ne la lisait — et c'est précisément ce qui rendait le comportement fixe.
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params;

  const formateur = await getFormateurSession();
  if (formateur === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Un identifiant non-UUID lèverait une P2023 Prisma — donc un 500 là où la
  // réponse juste est « ça n'existe pas ».
  if (!UUID.test(sessionId)) {
    return NextResponse.json({ error: "kit_introuvable" }, { status: 404 });
  }

  const session = await prisma.trainingSession.findFirst({
    // Une seule regle d'appartenance dans tout le code : celle-la.
    where: { id: sessionId, ...whereSessionsDuFormateur(formateur.trainerId) },
    select: { formationId: true, formation: { select: { slug: true } } },
  });
  // Session inconnue ET session d'un autre formateur donnent la même réponse :
  // un 404 qui ne dit pas si la session existe.
  if (session === null) {
    return NextResponse.json({ error: "kit_introuvable" }, { status: 404 });
  }

  const kit = await prisma.supportFormation.findFirst({
    where: { formationId: session.formationId, type: "kit_formateur_imprime" },
    orderBy: { version: "desc" },
    select: { pdfKey: true, version: true },
  });
  if (kit === null || kit.pdfKey === null) {
    return NextResponse.json({ error: "kit_non_publie" }, { status: 404 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "stockage_indisponible" }, { status: 503 });
  }

  const nomFichier = `kit-formateur-${session.formation.slug}-v${kit.version}.pdf`;

  try {
    if (!(await existsInR2(kit.pdfKey))) {
      return NextResponse.json({ error: "kit_non_publie" }, { status: 404 });
    }
    const signe = await getSignedUrlR2(kit.pdfKey, 900, {
      fichier: { nom: nomFichier, disposition: dispositionDemandee(req.url) },
    });
    return NextResponse.redirect(signe, 302);
  } catch (err) {
    console.error("[espace-formateur/kit] signature R2 échouée", err);
    return NextResponse.json({ error: "stockage_indisponible" }, { status: 503 });
  }
}
