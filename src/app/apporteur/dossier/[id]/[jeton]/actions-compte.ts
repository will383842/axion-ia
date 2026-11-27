/**
 * Lot 5 : les actions de « Mon compte bancaire » (espace apporteur).
 *
 * Le dossier est relu PAR SON LIEN (jeton HMAC) ; l'adresse e-mail n'est JAMAIS lue dans la requête
 * (le cœur du lot 4 la lit sur la fiche). Aucun IBAN n'est renvoyé au navigateur.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { getClientIp, getClientUserAgent } from "@/lib/client-ip";
import {
  annulerDemande,
  demanderChangementIban,
} from "@/features/apporteurs-reseau/changement-iban";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature";

import { TEXTES_COMPTE as T } from "./textes-compte";

export type ResultatCompte = { ok: true } | { ok: false; message: string };

const MAX_RIB = 10 * 1024 * 1024;
const lien = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.slice(0, 100) : "");

async function dossierSigne(id: string, jeton: string) {
  const d = await lireDossierParLien(id, jeton);
  return d && !d.restreint && etatDeLaPage(d.statut) === "signe" ? d : null;
}

async function ipSure(): Promise<string | null> {
  try {
    return (await getClientIp()) ?? null;
  } catch {
    return null;
  }
}

export async function demanderChangementCompteAction(fd: FormData): Promise<ResultatCompte> {
  const dossier = await dossierSigne(lien(fd.get("id")), lien(fd.get("jeton")));
  if (!dossier) return { ok: false, message: T.erreurNeutre };
  const iban = fd.get("iban");
  const rib = fd.get("rib");
  if (typeof iban !== "string" || iban.length > 60)
    return { ok: false, message: T.erreurIbanInvalide };
  if (!(rib instanceof File) || rib.size === 0) return { ok: false, message: T.erreurRibManque };
  if (rib.size > MAX_RIB) return { ok: false, message: T.erreurFichier };
  const octets = new Uint8Array(await rib.arrayBuffer());
  let ua: string | null = null;
  try {
    ua = (await getClientUserAgent()) ?? null;
  } catch {
    ua = null;
  }
  const r = await demanderChangementIban({
    apporteurId: dossier.id,
    iban,
    rib: { nom: rib.name, octets },
    ip: await ipSure(),
    userAgent: ua,
  });
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}

export async function annulerChangementCompteAction(fd: FormData): Promise<ResultatCompte> {
  const dossier = await dossierSigne(lien(fd.get("id")), lien(fd.get("jeton")));
  if (!dossier) return { ok: false, message: T.erreurNeutre };
  const r = await annulerDemande({
    apporteurId: dossier.id,
    demandeId: lien(fd.get("demandeId")),
    ip: await ipSure(),
  });
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}
