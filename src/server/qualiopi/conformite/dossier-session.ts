/**
 * Qualiopi — Dossier d'audit d'UNE session (oubli M2 du plan).
 *
 * ## Le problème que ça règle
 *
 * `genererDossierAuditZip` fait un `findMany` SANS `where` et range les PDF en
 * `preuves/<type>/<numero>.pdf` — groupés par TYPE, jamais par session. Devant
 * un auditeur qui demande « montrez-moi le dossier de la session de juin »,
 * reconstituer l'ensemble revenait à ouvrir les PDF un par un pour lire de quelle
 * session ils relèvent.
 *
 * Une preuve qu'on ne peut pas retrouver n'est pas une preuve.
 *
 * ## Ce que le dossier contient
 *
 * Les documents générés de la session, rangés par TYPE dans un dossier qui porte
 * son numéro · la feuille d'émargement telle qu'elle serait tirée aujourd'hui,
 * en JSON, avec les écarts de signature et l'ancrage de chaîne · le résultat de
 * la VÉRIFICATION D'INTÉGRITÉ de chaque chaîne de signatures · et un index
 * lisible qui dit ce qui manque, plutôt que de le taire.
 *
 * ⚠️ Un dossier incomplet est signalé comme tel. Livrer un ZIP silencieusement
 * amputé à un auditeur est pire que de ne rien livrer : il aurait l'air complet.
 *
 * ⚠️ Les pièces ANNULÉES n'y sont pas jointes — elles ne font plus foi — mais
 * elles y sont NOMMÉES, avec leur motif et leur date. Les taire laisserait un
 * trou inexpliqué dans la série des numéros ; les joindre sans marquage
 * reviendrait à présenter comme preuve un document qu'on a soi-même annulé.
 *
 * Stub-safe.
 */

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { lignesDeChaine } from "@/server/qualiopi/emargement/lignes-de-chaine";
import { isR2Configured, getObjectBufferR2, documentPdfKey } from "@/lib/r2-storage";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
// 🔴 2026-08-24, cahier D9 — cet export n'avait AUCUN appelant de production.
// Le dossier promet « la VÉRIFICATION D'INTÉGRITÉ de CHAQUE chaîne de
// signatures » et n'en vérifiait que deux familles sur trois : les signatures
// des PIÈCES CONTRACTUELLES (convention, devis, lettre de mission) n'étaient
// vérifiées nulle part. La fonction pour le faire existait, écrite et testée,
// simplement jamais appelée.
import { verifierChaineDocument } from "@/server/qualiopi/documents/signature/registre-verification";
import {
  maillonDepuisLigne,
  verrouColonnes,
  verrouColonnesContresignature,
} from "@/server/qualiopi/emargement/reconstruction";
import { maillonContresignatureDepuisLigne } from "@/server/qualiopi/emargement/contresignature-hash";
import { construireFeuillePdf } from "@/server/qualiopi/emargement/feuille-pdf";

export interface DossierSessionResult {
  base64: string;
  filename: string;
  incomplet: boolean;
  nbDocuments: number;
  nbDocumentsJoints: number;
  /**
   * Pièces ANNULÉES de la session, écartées du ZIP mais NOMMÉES dans l'index.
   *
   * Exposé pour que l'écran qui déclenche le dossier puisse le dire lui aussi :
   * un compteur de documents qui baisse sans explication ressemble à une perte.
   */
  nbDocumentsAnnulees: number;
  /** Chaînes de signatures stagiaires dont la vérification a relevé une anomalie. */
  nbChainesAnormales: number;
  /**
   * Chaînes de CONTRESIGNATURES formateur anormales (M6). Exposé séparément :
   * une contresignature falsifiée est une signature « modifiée après coup » au
   * même titre qu'une signature stagiaire, et l'UI doit pouvoir déclencher
   * l'alerte ROUGE sur l'un OU l'autre compteur — pas la noyer dans le jaune.
   */
  nbChainesContresignAnormales: number;
  avertissements: string[];
}

/**
 * Produit le ZIP d'audit d'une session.
 *
 * @param sessionId Session concernée.
 */
export async function genererDossierSessionZip(
  sessionId: string,
): Promise<DossierSessionResult | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      documents: {
        // 🔴 Doctrine d'`audit-dossier.ts` : « une pièce annulée ne se compte
        // NULLE PART ». Sans ce filtre, le ZIP téléchargeait le PDF d'une pièce
        // que l'organisme a lui-même déclarée sans valeur, l'annonçait `[OK]`
        // dans l'index et la comptait dans `nbDocuments` — le dossier affirmait
        // donc qu'elle était valable.
        //
        // ⚠️ Le filtre est posé sur la REQUÊTE, pas dans la boucle : rien
        // d'écrit plus bas ne peut alors atteindre une pièce annulée, même par
        // inadvertance.
        where: { annuleeAt: null },
        select: { id: true, type: true, numero: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      enrollments: {
        // 🔴 H3 — NE PAS filtrer les inscriptions sous droit à l'effacement.
        // `supprimerStagiaire` ANONYMISE le nom (« [supprime] ») mais CONSERVE
        // délibérément les colonnes de signature (art. 17 §3 b) pour justifier
        // les heures. Les écarter ici rendait ces preuves — intactes et retenues
        // exprès — invisibles et injustifiables : la faille que rgpd-service
        // ferme au niveau colonnes, rouverte au niveau dossier. Le nom étant déjà
        // anonymisé, les inclure ne divulgue aucune PII.
        orderBy: { trainee: { nom: "asc" } },
        select: {
          id: true,
          tauxPresencePct: true,
          trainee: { select: { nom: true, prenom: true, deletedAt: true } },
          // ⚠️ Filtre ET ordre viennent de `lignesDeChaine()` : ce sont les deux
          // conditions pour que `verifierChaine` rende un verdict juste, et
          // elles étaient recopiées à chaque lecture. Le détail du raisonnement
          // (pourquoi jamais `signeAt`) vit dans ce module.
          emargementSignatures: lignesDeChaine(),
        },
      },
      // Contresignatures du formateur — leur chaîne (portée session × formateur)
      // se vérifie comme celle des stagiaires, donc avec le MÊME filtre et le
      // même ordre. C'était la seconde recopie.
      emargementContresignatures: lignesDeChaine(),
    },
  });

  if (session === null) return null;

  const zip = new JSZip();
  const avertissements: string[] = [];
  const index: string[] = [`Dossier d'audit — session ${session.numero}`, session.titreSession, ""];

  // R2 requis dès la vérification d'intégrité (M2 confronte les octets d'image).
  const r2Ok = isR2Configured();

  // ── 1. Vérification d'intégrité des chaînes ──
  const rapports: Array<Record<string, unknown>> = [];
  let nbChainesAnormales = 0;
  let nbEffaces = 0;
  let nbImagesAlterees = 0;

  for (const inscription of session.enrollments) {
    // ⚠️ `verrouColonnes` plutôt qu'un `as unknown as` : la conversion est
    // vérifiée à la compilation, donc retirer une colonne du snapshot casse le
    // build au lieu de produire ici, silencieusement, un rapport d'intégrité faux.
    const res = verifierChaine(
      inscription.emargementSignatures.map((s) => maillonDepuisLigne(verrouColonnes(s))),
    );
    if (!res.valide) nbChainesAnormales += 1;

    const efface = inscription.trainee.deletedAt !== null;
    if (efface) nbEffaces += 1;

    // 🔴 M2 — le chaînage scelle le CONDENSAT de l'image, mais rien ne confrontait
    // ce condensat aux octets réels sur R2 : un objet PNG remplacé sans toucher la
    // colonne `signature_sha256` passait « OK ». On re-télécharge et on re-hache.
    const imagesAlterees: string[] = [];
    if (r2Ok) {
      for (const s of inscription.emargementSignatures) {
        if (s.signatureKey === null || s.signatureSha256 === null) continue;
        const buf = await getObjectBufferR2(s.signatureKey);
        if (buf === null) {
          imagesAlterees.push(`image absente sur R2 : ${s.signatureKey}`);
          nbImagesAlterees += 1;
          continue;
        }
        const shaReel = createHash("sha256").update(buf).digest("hex");
        if (shaReel !== s.signatureSha256) {
          imagesAlterees.push(`condensat divergent : ${s.signatureKey}`);
          nbImagesAlterees += 1;
        }
      }
    }

    rapports.push({
      // Nom déjà anonymisé (« [supprime] ») pour un effacé ; on l'étiquette
      // explicitement pour que l'auditeur sache pourquoi il est là.
      stagiaire: efface
        ? "[inscription sous droit à l'effacement — signatures conservées, art. 17 §3 b]"
        : `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
      effaceRgpd: efface,
      tauxPresencePct: inscription.tauxPresencePct,
      nbSignatures: inscription.emargementSignatures.length,
      empreinteTete:
        inscription.emargementSignatures[inscription.emargementSignatures.length - 1]?.selfHash ??
        null,
      integrite: res.valide ? "OK" : "ANOMALIE",
      anomalies: res.anomalies,
      ...(imagesAlterees.length > 0 ? { imagesAlterees } : {}),
    });
  }

  // Chaînes de CONTRESIGNATURES, une par formateur (portée session × formateur).
  // Sans cette vérification, la machinerie anti-fork des contresignatures serait
  // écrite mais jamais contrôlée à l'audit — un registre dont personne ne lit le
  // sceau.
  const parFormateur = new Map<string, typeof session.emargementContresignatures>();
  for (const c of session.emargementContresignatures) {
    const lot = parFormateur.get(c.trainerId) ?? [];
    lot.push(c);
    parFormateur.set(c.trainerId, lot);
  }
  const rapportsContresignatures: Array<Record<string, unknown>> = [];
  let nbChainesContresignAnormales = 0;
  for (const [trainerId, lignes] of parFormateur) {
    const res = verifierChaine(
      lignes.map((c) => maillonContresignatureDepuisLigne(verrouColonnesContresignature(c))),
    );
    if (!res.valide) nbChainesContresignAnormales += 1;
    rapportsContresignatures.push({
      formateur: lignes[0]?.formateurNom ?? trainerId,
      nbContresignatures: lignes.length,
      empreinteTete: lignes[lignes.length - 1]?.selfHash ?? null,
      integrite: res.valide ? "OK" : "ANOMALIE",
      anomalies: res.anomalies,
    });
  }

  // Chaînes de signatures des PIÈCES CONTRACTUELLES — la troisième famille.
  //
  // 🔴 2026-08-24, cahier D9 — elle manquait, alors que l'en-tête de ce fichier
  // promet « chaque chaîne de signatures ». Une convention signée dont la chaîne
  // aurait été rompue sortait du ZIP avec la mention `[OK]` de son PDF et aucun
  // verdict d'intégrité : le dossier avait l'air complet.
  //
  // ⚠️ Une pièce sans aucune signature rend `null` : ce n'est pas une anomalie,
  // c'est une pièce non signée — et l'index ne doit pas la compter au
  // dénominateur, sous peine de refaire le défaut « 0/0 conformes » corrigé
  // juste en dessous.
  const rapportsPieces: Array<Record<string, unknown>> = [];
  let nbChainesPieceAnormales = 0;
  for (const doc of session.documents) {
    const res = await verifierChaineDocument(doc.id);
    if (res === null) continue;
    if (!res.valide) nbChainesPieceAnormales += 1;
    rapportsPieces.push({
      piece: doc.numero,
      type: doc.type,
      nbSignatures: res.nbVerifies,
      integrite: res.valide ? "OK" : "ANOMALIE",
      anomalies: res.anomalies,
    });
  }

  zip.file(
    "verification-integrite.json",
    JSON.stringify(
      {
        signatures: rapports,
        contresignatures: rapportsContresignatures,
        piecesContractuelles: rapportsPieces,
      },
      null,
      2,
    ),
  );
  // 🔴 `D3-3-01` (2026-08-20) — « 0/0 conformes » SE LIT « TOUT VA BIEN ».
  //
  // Ces deux lignes rendaient `0/0 conformes` quand il n'y avait aucune
  // signature ou aucune contresignature. Dans un dossier remis au
  // certificateur, un ratio complet est le signe qu'on cherche : personne ne
  // s'arrête sur un dénominateur nul, et l'absence totale de preuve prenait
  // l'apparence d'une conformité parfaite.
  //
  // 🔑 C'est la famille de défaut la plus coûteuse de cet audit — un témoin qui
  // ne vaut que si on a vérifié qu'il DEVRAIT être positif. Ici le témoin était
  // même MEILLEUR quand la situation était pire : zéro anomalie sur zéro chaîne.
  //
  // Le vide est donc désormais NOMMÉ, et il lève un avertissement — pas une
  // erreur : produire le dossier reste possible, c'est l'auditeur qui tranche.
  // Un dossier qu'on ne peut plus générer ferait perdre la pièce ET l'alerte.
  index.push(
    session.enrollments.length === 0
      ? "Intégrité des chaînes de signatures : AUCUNE signature d'émargement au dossier."
      : `Intégrité des chaînes de signatures : ${session.enrollments.length - nbChainesAnormales}/${session.enrollments.length} conformes.`,
  );
  index.push(
    parFormateur.size === 0
      ? "Intégrité des chaînes de contresignatures : AUCUNE contresignature de formateur au dossier."
      : `Intégrité des chaînes de contresignatures : ${parFormateur.size - nbChainesContresignAnormales}/${parFormateur.size} conformes.`,
  );
  index.push(
    rapportsPieces.length === 0
      ? "Intégrité des chaînes de signatures de pièces : AUCUNE pièce contractuelle signée au dossier."
      : `Intégrité des chaînes de signatures de pièces : ${rapportsPieces.length - nbChainesPieceAnormales}/${rapportsPieces.length} conformes.`,
  );
  if (session.enrollments.length === 0) {
    avertissements.push(
      "⚠️ Aucune signature d'émargement dans ce dossier. La feuille d'émargement est la pièce que le certificateur demande en premier pour établir la réalité de l'action.",
    );
  }
  if (parFormateur.size === 0) {
    // La contresignature du formateur n'est exigée par aucune garde du dépôt —
    // c'est l'autre moitié de `D3-3-01`. La rendre bloquante changerait un geste
    // quotidien et rendrait des dossiers ingénérables ; on la rend VISIBLE là où
    // elle sera lue, c'est-à-dire dans le dossier lui-même.
    avertissements.push(
      "⚠️ Aucune contresignature de formateur dans ce dossier. L'émargement contresigné par l'intervenant est la pièce qui atteste que la séance a bien été animée — son absence n'est signalée par aucune garde en amont.",
    );
  }
  if (nbChainesAnormales > 0) {
    avertissements.push(
      `⚠️ ${nbChainesAnormales} chaîne${nbChainesAnormales > 1 ? "s" : ""} de signatures présentent une anomalie d'intégrité. Voir verification-integrite.json AVANT de produire ce dossier.`,
    );
  }
  if (nbChainesContresignAnormales > 0) {
    avertissements.push(
      `⚠️ ${nbChainesContresignAnormales} chaîne${nbChainesContresignAnormales > 1 ? "s" : ""} de contresignatures présentent une anomalie d'intégrité. Voir verification-integrite.json AVANT de produire ce dossier.`,
    );
  }
  if (nbChainesPieceAnormales > 0) {
    // 🔴 2026-08-24 — la troisième famille, qui n'était vérifiée par rien. Une
    // convention ou une lettre de mission dont la chaîne de signatures est
    // rompue est plus grave qu'un émargement douteux : c'est l'engagement
    // contractuel lui-même qui n'est plus opposable.
    avertissements.push(
      `⚠️ ${nbChainesPieceAnormales} chaîne${nbChainesPieceAnormales > 1 ? "s" : ""} de signatures de pièces contractuelles présentent une anomalie d'intégrité. Voir verification-integrite.json AVANT de produire ce dossier.`,
    );
  }
  if (nbImagesAlterees > 0) {
    avertissements.push(
      `⚠️ ${nbImagesAlterees} image${nbImagesAlterees > 1 ? "s" : ""} de signature ne correspondent plus à leur condensat scellé (substitution ou absence sur R2). Voir « imagesAlterees » dans verification-integrite.json.`,
    );
  }
  if (nbEffaces > 0) {
    // Informationnel, PAS un avertissement : le dossier est COMPLET justement
    // parce qu'il inclut ces preuves conservées. On le dit à l'auditeur.
    index.push(
      `Dont ${nbEffaces} inscription${nbEffaces > 1 ? "s" : ""} sous droit à l'effacement RGPD — signatures conservées et vérifiées (art. 17 §3 b).`,
    );
  }

  // ── 2. Feuille d'émargement telle qu'elle serait tirée ──
  // `inclureEffaces=true` : le dossier d'audit conserve les inscriptions effacées
  // (nom anonymisé, signatures retenues art. 17 §3 b), cohérent avec la vérif ci-dessus.
  const feuille = await construireFeuillePdf(sessionId, true);
  if (feuille === null || feuille.journees.length === 0) {
    avertissements.push(
      "⚠️ Les journées de cette session ne sont pas déclarées : aucune feuille d'émargement conforme ne peut être produite (horaires réels manquants).",
    );
    index.push("Feuille d'émargement : IMPOSSIBLE — journées non déclarées.");
  } else {
    zip.file("feuille-emargement.json", JSON.stringify(feuille, null, 2));
    index.push(
      `Feuille d'émargement : ${feuille.journees.length} journée${feuille.journees.length > 1 ? "s" : ""}, ${feuille.totalSignatures} signature${feuille.totalSignatures > 1 ? "s" : ""}.`,
    );
  }

  // ── 3. Documents générés de la session ── (`r2Ok` déjà calculé plus haut)
  if (!r2Ok) {
    avertissements.push(
      "⚠️ Stockage R2 non configuré : aucun PDF n'est restituable. Le dossier ne contient que les registres.",
    );
  }

  let joints = 0;
  index.push("", `Documents (${session.documents.length}) :`);
  for (const doc of session.documents) {
    // Clé alignée sur l'écriture (`documents-service.ts` utilise l'année locale
    // au moment de la génération).
    const cle = documentPdfKey(doc);
    const buffer = r2Ok ? await getObjectBufferR2(cle) : null;
    if (buffer === null) {
      index.push(`  [ABSENT] ${doc.type}/${doc.numero}.pdf`);
      continue;
    }
    zip.file(`documents/${doc.type}/${doc.numero}.pdf`, buffer);
    index.push(`  [OK]     ${doc.type}/${doc.numero}.pdf (${buffer.byteLength} octets)`);
    joints += 1;
  }

  // ⚠️ La condition porte sur les pièces EN VIGUEUR, et c'est le point : une
  // session dont toutes les pièces sont annulées n'a plus rien à joindre. Faire
  // porter le chapeau au stockage enverrait chercher une panne qui n'existe pas.
  if (session.documents.length > 0 && joints === 0) {
    avertissements.push(
      `⚠️ ${session.documents.length} document${session.documents.length > 1 ? "s" : ""} en base mais AUCUN PDF joint — vérifiez le stockage R2.`,
    );
  }

  // ── 3 bis. Pièces ANNULÉES — retirées, mais JAMAIS tues ──
  //
  // 🔴 Le retrait doit rester VISIBLE. Écarter la pièce sans le dire remplacerait
  // un mensonge (« [OK] ») par un silence : l'auditeur qui suit la série des
  // numéros trouverait un trou et n'aurait aucun moyen de savoir s'il s'agit
  // d'une annulation motivée ou d'une pièce escamotée. La trace la disculpe.
  //
  // ⚠️ Le PDF lui-même ne peut PAS porter le signal : il n'existe aucun filigrane
  // « ANNULÉ » dans le dépôt (`base-layout.tsx` ne connaît que COPIE et
  // SPÉCIMEN). Cette section de l'index — et le suffixe du nom de fichier au
  // téléchargement — sont les seuls marquages disponibles.
  const annulees = await prisma.documentGenere.findMany({
    where: { sessionId, annuleeAt: { not: null } },
    select: { numero: true, type: true, annuleeAt: true, annuleeMotif: true },
    orderBy: { annuleeAt: "asc" },
  });
  if (annulees.length > 0) {
    index.push("", `Pièces annulées, non jointes (${annulees.length}) :`);
    for (const a of annulees) {
      const quand = a.annuleeAt === null ? "date inconnue" : a.annuleeAt.toISOString().slice(0, 10);
      index.push(
        `  ${a.numero} (${a.type}) — ${a.annuleeMotif ?? "motif non renseigné"} — ${quand}`,
      );
    }
  }

  const incomplet = avertissements.length > 0;
  if (incomplet) {
    index.push("", "AVERTISSEMENTS :", ...avertissements.map((a) => `  ${a}`));
  }
  zip.file("index.txt", index.join("\n"));

  const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
  return {
    base64,
    // Le numéro de session dans le nom du fichier : c'est tout l'objet de ce
    // dossier, qu'on puisse le retrouver sans l'ouvrir.
    filename: `dossier-session-${session.numero}`,
    incomplet,
    nbDocuments: session.documents.length,
    nbDocumentsJoints: joints,
    nbDocumentsAnnulees: annulees.length,
    nbChainesAnormales,
    nbChainesContresignAnormales,
    avertissements,
  };
}
