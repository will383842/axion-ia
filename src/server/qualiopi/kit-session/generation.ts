/**
 * Production des sorties de démonstration d'une session.
 *
 * Le formateur devait, avant chaque session, coller quatre demandes dans
 * l'outil, imprimer les réponses et les dater — une heure de copier-coller que
 * personne ne pense à faire tant qu'une panne ne l'a pas puni. Ce module le
 * fait à sa place.
 *
 * ## Ce qu'il ne remplace pas
 *
 * La RELECTURE. Les fiches promettent que « les sorties du kit ont été
 * vérifiées » ; une démonstration peut rater — le modèle n'invente pas toujours
 * le chiffre qu'on voulait lui faire inventer, l'écart de ton attendu ne
 * ressort pas. Produire sans relire déplace le problème au pire endroit : la
 * salle. D'où `valideLe`, posé par un humain, dans `preparation.ts`.
 *
 * ## Une sortie n'est pas une capture d'écran
 *
 * Ce module appelle l'API, pas l'interface que le formateur utilisera en salle.
 * Le TEXTE de la réponse est ce qui porte la démonstration ; l'habillage de
 * l'interface, non. La pièce imprimée le dit, pour que personne ne croie tenir
 * une copie d'écran.
 */

import type { Prisma } from "../../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";
import { ENRICHISSEMENTS } from "@/content/formations/modules";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { generate } from "@/server/content-gen/providers/provider-router";

import type { SortieCapturee } from "./preparation";

/**
 * Le cadre donné au modèle.
 *
 * Il ne doit RIEN améliorer : on veut la réponse que l'outil donnerait au
 * formateur, y compris ses défauts — ce sont eux que la démonstration montre.
 * Un modèle qui « corrige » spontanément une demande volontairement bancale
 * détruit l'exercice.
 */
const CADRE =
  "Tu réponds exactement comme un assistant d'IA grand public répondrait à cet " +
  "utilisateur. Ne commente pas la demande, ne signale pas ses défauts, ne " +
  "l'améliore pas : produis la réponse attendue, telle quelle. Si la demande " +
  "est imprécise, réponds quand même, comme le ferait l'outil.";

export interface ResultatGeneration {
  readonly sorties: SortieCapturee[];
  readonly echecs: ReadonlyArray<{ moduleId: string; raison: string }>;
}

/** Les démonstrations d'une formation, dans l'ordre des modules. */
function demonstrationsDe(
  slug: string,
): ReadonlyArray<{ moduleId: string; moduleTitre: string; prompt: string }> {
  const modules = ENRICHISSEMENTS[slug];
  const formation = FORMATIONS_V2.find((f) => f.id === slug);
  if (!modules || !formation) return [];

  const titre = (moduleId: string): string => {
    const m = /^mod-(\d+)$/.exec(moduleId);
    const i = m?.[1] ? Number.parseInt(m[1], 10) - 1 : -1;
    return formation.programme[i]?.titreFr ?? moduleId;
  };

  return modules
    .filter((m) => typeof m.demonstration?.prompt === "string" && m.demonstration.prompt.trim())
    .map((m) => ({
      moduleId: m.moduleId,
      moduleTitre: titre(m.moduleId),
      prompt: m.demonstration.prompt as string,
    }));
}

/**
 * Produit les sorties d'une session et les enregistre.
 *
 * Toute génération REMET À ZÉRO la validation : des sorties neuves n'ont, par
 * définition, été relues par personne. Sans cela, régénérer après une
 * validation laisserait un « validé » qui ne porte plus sur rien.
 *
 * Une démonstration qui échoue n'annule pas les autres : mieux vaut trois
 * sorties sur quatre, et la quatrième signalée, que rien du tout.
 */
export async function genererSortiesSession(sessionId: string): Promise<ResultatGeneration> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { formation: { select: { slug: true } } },
  });
  if (session === null) throw new Error("session_introuvable");

  const demos = demonstrationsDe(session.formation.slug);
  if (demos.length === 0) throw new Error("aucune_demonstration");

  const sorties: SortieCapturee[] = [];
  const echecs: Array<{ moduleId: string; raison: string }> = [];

  for (const demo of demos) {
    try {
      const rep = await generate({
        jobId: `kit-session-${sessionId}`,
        contentType: "kit_formateur_sortie",
        role: "text",
        systemPrompt: CADRE,
        userPrompt: demo.prompt,
        maxTokens: 1600,
        temperature: 0.7,
      });
      sorties.push({
        moduleId: demo.moduleId,
        moduleTitre: demo.moduleTitre,
        prompt: demo.prompt,
        sortie: rep.output,
        provider: rep.provider,
        model: rep.model,
      });
    } catch (err) {
      echecs.push({
        moduleId: demo.moduleId,
        raison: err instanceof Error ? err.message : "erreur inconnue",
      });
    }
  }

  // Prisma type `Json` en `InputJsonValue` : un tableau d'interfaces n'y entre
  // pas sans passer par une valeur JSON pure.
  const payload = JSON.parse(JSON.stringify(sorties)) as Prisma.InputJsonValue;

  await prisma.sessionKitSorties.upsert({
    where: { sessionId },
    create: { sessionId, sorties: payload, genereLe: new Date() },
    update: {
      sorties: payload,
      genereLe: new Date(),
      // 🔴 Des sorties neuves n'ont été relues par personne.
      valideLe: null,
      valideParId: null,
    },
  });

  return { sorties, echecs };
}

/**
 * Enregistre la relecture humaine.
 *
 * Refuse de valider ce qui n'existe pas : sans cette garde, un clic malheureux
 * poserait « vérifié » sur un classeur vide, et la promesse faite au formateur
 * deviendrait un mensonge daté et signé.
 */
export async function validerSortiesSession(sessionId: string, adminUserId: string): Promise<void> {
  const row = await prisma.sessionKitSorties.findUnique({
    where: { sessionId },
    select: { sorties: true },
  });
  const nb = Array.isArray(row?.sorties) ? row.sorties.length : 0;
  if (nb === 0) throw new Error("rien_a_valider");

  await prisma.sessionKitSorties.update({
    where: { sessionId },
    data: { valideLe: new Date(), valideParId: adminUserId },
  });
}
