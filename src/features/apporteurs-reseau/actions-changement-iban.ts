"use server";

/**
 * Lot 6 : les décisions de la console sur un changement de compte (valider / refuser).
 *
 * Le rôle est contrôlé ICI (super_admin seul, acte `valider_changement_iban`) ET dans le cœur
 * (lot 4). L'IBAN recopié n'est que transmis au cœur, qui le compare par empreinte : il n'est
 * jamais renvoyé, ni journalisé. Aucun appel à un modèle d'IA sur ce chemin.
 */

import { revalidatePath } from "next/cache";

import { getClientIp, getClientUserAgent } from "@/lib/client-ip";

import { auth } from "@/auth";
import { peutEngager } from "@/server/auth/habilitations";

import { demanderChangementIban, refuserDemande, validerDemande } from "./changement-iban";

export type ResultatDecision = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texte = (fd: FormData, cle: string, max: number) => {
  const v = fd.get(cle);
  return typeof v === "string" ? v.slice(0, max) : "";
};

async function acteur() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role ?? null;
  if (!peutEngager(role, "valider_changement_iban")) return null;
  return { id: session.user.id, role };
}

const REFUS_ROLE: ResultatDecision = {
  ok: false,
  message: "Seul le super administrateur peut décider.",
};

export async function validerChangementCompteAction(fd: FormData): Promise<ResultatDecision> {
  const a = await acteur();
  if (!a) return REFUS_ROLE;
  const demandeId = texte(fd, "demandeId", 40);
  if (!UUID.test(demandeId)) return { ok: false, message: "Demande introuvable." };
  const r = await validerDemande({
    demandeId,
    acteur: a,
    cases: {
      titulaire: fd.get("titulaire") === "on",
      iban: fd.get("iban") === "on",
      rappel: fd.get("rappel") === "on",
    },
    ibanRecopie: texte(fd, "ibanRecopie", 60),
  });
  revalidatePath("/[locale]/[adminPrefix]/apporteurs/changements-de-compte", "layout");
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}

export async function refuserChangementCompteAction(fd: FormData): Promise<ResultatDecision> {
  const a = await acteur();
  if (!a) return REFUS_ROLE;
  const demandeId = texte(fd, "demandeId", 40);
  if (!UUID.test(demandeId)) return { ok: false, message: "Demande introuvable." };
  const r = await refuserDemande({ demandeId, acteur: a, motif: texte(fd, "motif", 500) });
  revalidatePath("/[locale]/[adminPrefix]/apporteurs/changements-de-compte", "layout");
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}

/**
 * Lot 9 : ouvrir une demande AU NOM d'un apporteur retiré ou résilié avec de l'argent dû. L'IBAN est saisi
 * par une PERSONNE (jamais par Claude, plan §2.6), chiffré aussitôt, jamais renvoyé. Mêmes barrières
 * ensuite : e-mail de confirmation à l'adresse de la fiche, 72 h, rappel, validation `super_admin`.
 */
export async function ouvrirDemandeConsoleAction(fd: FormData): Promise<ResultatDecision> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? null;
  const apporteurId = texte(fd, "apporteurId", 40);
  if (!UUID.test(apporteurId)) return { ok: false, message: "Apporteur introuvable." };
  const rib = fd.get("rib");
  if (!(rib instanceof File) || rib.size === 0 || rib.size > 10 * 1024 * 1024) {
    return { ok: false, message: "Ajoutez le RIB du nouveau compte (10 Mo au plus)." };
  }
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    ip = (await getClientIp()) ?? null;
    userAgent = (await getClientUserAgent()) ?? null;
  } catch {
    /* sans IP : la limite de débit répond « inconnue » */
  }
  const r = await demanderChangementIban({
    apporteurId: apporteurId.toLowerCase(),
    iban: texte(fd, "iban", 60),
    rib: { nom: rib.name, octets: new Uint8Array(await rib.arrayBuffer()) },
    ip,
    userAgent,
    origine: "console",
    acteur: { id: session.user.id, role },
  });
  revalidatePath("/[locale]/[adminPrefix]/apporteurs/changements-de-compte", "layout");
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}
