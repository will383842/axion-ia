/**
 * QNC NC6 (lot présence 2/3) — l'action de la page publique de confirmation de présence.
 *
 * ⚠️ SURFACE NON AUTHENTIFIÉE : le jeton est la seule barrière, et tout se vérifie dans
 * `enregistrerReponsePresence`. Ici : la forme de l'entrée et la limite de débit, AVANT tout
 * accès à la base. La clé de limite porte sur l'EMPREINTE du jeton (jamais le jeton en clair :
 * Redis persiste), comme pour l'émargement.
 *
 * C'est le POST d'un `<form action>` simple, sans composant client : l'action ne renvoie rien
 * et redirige vers la page, qui relit l'état. Aucun champ libre : `choix` est `oui` ou `non`.
 */

"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { enregistrerReponsePresence } from "@/server/qualiopi/confirmation-presence/reponse";

/** Par jeton — donc par stagiaire : quelques clics et reprises, pas un balayage. */
const LIMITE_PAR_JETON = { limit: 12, windowSec: 60 } as const;

const entreeSchema = z.object({
  token: z.string().min(1).max(2048),
  choix: z.enum(["oui", "non"]),
});

export async function repondrePresenceAction(formData: FormData): Promise<void> {
  const parse = entreeSchema.safeParse({
    token: formData.get("token"),
    choix: formData.get("choix"),
  });
  // Entrée forgée : rien à écrire, et rien à dire qui renseigne sur la forme attendue.
  if (!parse.success) redirect("/fr");
  const { token, choix } = parse.data;
  const page = `/fr/portail/presence/${encodeURIComponent(token)}`;

  const empreinte = createHash("sha256").update(token).digest("hex");
  const limite = await checkRateLimit(`presence:rep:${empreinte}`, LIMITE_PAR_JETON);
  if (!limite.allowed) redirect(`${page}?e=trop_de_tentatives`);

  await enregistrerReponsePresence(token, choix);
  // Le refus éventuel est relu par la page (lien invalide, session commencée…) : un seul récit.
  redirect(page);
}
