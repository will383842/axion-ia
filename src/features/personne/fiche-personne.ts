// LA FICHE D'UNE PERSONNE — lecture.
//
// ── Le problème ───────────────────────────────────────────────────────────
// Une même personne laisse plusieurs traces : un premier contact sur le
// tunnel, un dossier apporteur, une candidature à une offre, un message par le
// formulaire de contact, un appel réservé. Chacune vit dans son écran, et rien
// ne dit qu'elles appartiennent au même humain. On rapproche à l'œil, ou pas.
//
// ── Le parti pris — RAPPROCHER, JAMAIS FUSIONNER ──────────────────────────
// Cette fiche montre côte à côte « a candidaté en mars » et « est apporteur
// depuis juin ». Elle ne fait pas de ces deux choses une seule.
//
// 🔴 Ce n'est pas une précaution d'architecture, c'est une contrainte de droit.
// La boîte recrutement impose un vocabulaire de SÉLECTION — `shortlisted`,
// `rejected`, `hired`, et des motifs comme `competences_insuffisantes`. Écrire
// ces mots sur un apporteur d'affaires, c'est écrire dans la base la preuve
// d'un lien de subordination (`docs/partners/ANTI-REQUALIFICATION.md`). Elle
// porte en outre une alerte quotidienne sur les dossiers qui n'ont pas bougé —
// exactement la « relance de dormance » que l'audit a jugée fautive.
//
// ⛔ TROIS INTERDITS, et ils ne sont pas négociables :
//    · pas de statut commun aux deux mondes ;
//    · pas de file de traitement commune ;
//    · pas d'alerte de dormance commune.
// Cette fiche est une VUE. Elle n'écrit rien, ne décide rien, ne classe rien.
//
// ── Pourquoi aucune table « personne » ────────────────────────────────────
// La clé existe déjà : `hashEmailForLookup(email)`, posée sur
// `Submission.contactEmailHash` et `JobApplication.emailHash`, et c'est la même
// valeur que la `person_key` du CRM (`server/crm-sync/index.ts`). Une table
// créerait une troisième vérité à tenir synchronisée avec les deux autres.
//
// ── Ce module n'est PAS `"use server"` ────────────────────────────────────
// Chaque export d'un module `"use server"` devient un point d'entrée réseau.
// Une lecture nue qui y vivrait serait appelable de l'extérieur, et la garde de
// rôle de la page ne la protégerait pas. Même doctrine que
// `admin-job-applications/reads.ts`.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";

/** Les deux mondes, tenus séparés jusque dans le type. */
export type MondeTrace = "apporteur" | "emploi" | "autre";

export interface TracePersonne {
  id: string;
  monde: MondeTrace;
  /** Ce que la trace EST, dans le vocabulaire de SON monde. Jamais traduit. */
  intitule: string;
  /** Précision libre : étape, offre visée, sujet du message. */
  detail: string | null;
  quand: Date;
  /** Où l'ouvrir dans la console, relatif au préfixe admin. */
  chemin: string;
}

export interface FichePersonne {
  empreinte: string;
  /** Le nom le plus récemment donné. Les gens changent d'orthographe. */
  nom: string | null;
  traces: TracePersonne[];
  /** Combien de traces dans chaque monde — l'information de tête. */
  compte: Record<MondeTrace, number>;
  /** Vrai si la personne existe des DEUX côtés : le cas qui justifie la fiche. */
  desDeuxCotes: boolean;
}

function dechiffrer(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const clair = decryptPii(v);
    return typeof clair === "string" && clair.length > 0 ? clair : null;
  } catch {
    return null;
  }
}

/**
 * Rassemble ce que le site sait d'une personne, par son empreinte d'e-mail.
 *
 * 🔑 Par EMPREINTE, jamais par adresse : les colonnes d'identité sont chiffrées
 * avec un IV aléatoire, aucune égalité SQL n'y est possible. Une recherche en
 * clair ne rendrait JAMAIS rien — et la fiche paraîtrait simplement vide, sans
 * la moindre erreur.
 */
export async function lireFichePersonne(empreinte: string): Promise<FichePersonne> {
  const vide: FichePersonne = {
    empreinte,
    nom: null,
    traces: [],
    compte: { apporteur: 0, emploi: 0, autre: 0 },
    desDeuxCotes: false,
  };
  if (!empreinte || !/^[0-9a-f]{64}$/i.test(empreinte)) return vide;

  const [submissions, candidatures] = await Promise.all([
    prisma.submission.findMany({
      where: { contactEmailHash: empreinte },
      select: { id: true, type: true, details: true, submittedAt: true, contactName: true },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.jobApplication.findMany({
      where: { emailHash: empreinte },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        firstName: true,
        lastName: true,
        offerTitleSnap: true,
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
  ]);

  const traces: TracePersonne[] = [];
  let nom: string | null = null;

  for (const s of submissions) {
    const d = s.details as {
      unifiedType?: string;
      subType?: string;
      etape?: string;
      origine?: string;
    } | null;
    // ⛔ `unifiedType === "recrutement"` NE SUFFIT PAS, et le croire fait de
    // cette vue l'écran de fusion qu'elle interdit. Cette valeur est aussi
    // l'une des rubriques du formulaire de contact public : `unified-contact`
    // écrit `unifiedType: data.type`, et « recrutement » y est un choix offert
    // au visiteur. Un « je cherche un poste » posté depuis /contact produirait
    // donc un « Dossier apporteur » et un lien vers la file commerciale.
    //
    // Le discriminant réel est `details.subType`, écrit par les quatre
    // producteurs du monde apporteur (`commercial-application/*-actions.ts`) et
    // jamais posé par le formulaire public. C'est déjà le filtre de la file
    // commerciale de la console (`admin-job-applications/actions.ts`) : cette
    // vue lit donc la MÊME population, sans redéfinir la sienne. Les quatre
    // producteurs écrivent les DEUX clés : on exige les deux.
    const estApporteur =
      d?.unifiedType === "recrutement" && d?.subType === CANDIDATURE_COMMERCIALE_SUBTYPE;
    nom ??= dechiffrer(s.contactName);
    traces.push({
      id: s.id,
      monde: estApporteur ? "apporteur" : "autre",
      // Vocabulaire du monde apporteur : « premier contact », « dossier ».
      // Jamais « candidature », jamais un statut de sélection.
      intitule: estApporteur
        ? d?.etape === "premier-contact"
          ? "Premier contact apporteur"
          : "Dossier apporteur"
        : "Message reçu",
      detail: d?.origine ?? null,
      quand: s.submittedAt,
      chemin: estApporteur ? `contacts/commercial/${s.id}` : `contacts/messages/${s.id}`,
    });
  }

  for (const c of candidatures) {
    nom ??=
      [dechiffrer(c.firstName), dechiffrer(c.lastName)].filter(Boolean).join(" ").trim() || null;
    traces.push({
      id: c.id,
      monde: "emploi",
      // Vocabulaire du monde emploi, et il RESTE de ce côté : ce statut ne doit
      // jamais s'appliquer, ni même s'afficher, sur une trace apporteur.
      intitule: "Candidature à une offre",
      detail: c.offerTitleSnap ?? null,
      quand: c.submittedAt,
      chemin: `contacts/candidatures/${c.id}`,
    });
  }

  traces.sort((a, b) => b.quand.getTime() - a.quand.getTime());

  const compte: Record<MondeTrace, number> = { apporteur: 0, emploi: 0, autre: 0 };
  for (const t of traces) compte[t.monde] += 1;

  return {
    empreinte,
    nom,
    traces,
    compte,
    desDeuxCotes: compte.apporteur > 0 && compte.emploi > 0,
  };
}
