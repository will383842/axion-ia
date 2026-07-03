/**
 * Prospection — Enrichissement d'une entreprise en 2 passes (T5).
 *
 * Passe A (coordonnées) et Passe B (responsables/team pages) à critères d'arrêt
 * DISTINCTS (sinon l'early-exit A empêche d'atteindre les pages équipe → aucun
 * responsable). Le domaine n'est retenu QUE s'il est confirmé (SIREN/dénomination
 * sur la page — matrice #9). Tout via `fetchPage` injecté (worker = ssrfSafeFetch
 * + robots.txt) → testable avec des fixtures HTML, 0 réseau réel.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import type { EnrichmentStatus, DomainMatchMethod } from "@/lib/prospection/enums";
import { normalizeFonction } from "@/lib/prospection/qualite-to-fonction";
import { deriveContactabilite, computeLeadScore } from "@/lib/prospection/scoring";
import { confirmDomainOwnership } from "./domain-confirm";
import { extractContacts } from "./contact-extract";
import { extractPersons } from "./person-extract";
import { personKey, splitFullName } from "./person-key";
import {
  normalizeEmail,
  isRoleEmail,
  verifyEmail,
  isMxOk,
  matchEmailToPerson,
  type MxResolver,
} from "./email";
import { normalizePhoneFR, phoneVerifStatus } from "./phone";
import { fetchRobotsRules, isPathAllowed, type RobotsFetch } from "./robots";

export interface EnrichPage {
  url: string;
  ok: boolean;
  status: number;
  text: string;
}

export interface EnrichDb {
  prospectionContact: {
    upsert(args: Prisma.ProspectionContactUpsertArgs): Promise<unknown>;
  };
  prospectionPerson: {
    upsert(args: Prisma.ProspectionPersonUpsertArgs): Promise<{ id: string }>;
  };
  prospectionPersonRole: {
    create(args: Prisma.ProspectionPersonRoleCreateArgs): Promise<unknown>;
  };
  prospectionCompany: {
    update(args: Prisma.ProspectionCompanyUpdateArgs): Promise<unknown>;
  };
}

export interface EnrichConfig {
  contactPaths: readonly string[];
  teamPaths: readonly string[];
  maxPagesContact: number;
  maxPagesPersonnes: number;
  maxPagesEntreprise: number;
  enrichirPersonnes: boolean;
}

export interface EnrichDeps {
  fetchPage: (url: string) => Promise<EnrichPage | null>;
  fetchRobots?: RobotsFetch;
  mxResolver: MxResolver;
  db: EnrichDb;
  now?: () => Date;
}

export interface EnrichCompanyInput {
  id: string;
  siren: string;
  denomination?: string | null;
  siteWeb?: string | null;
}

export interface EnrichResult {
  status: EnrichmentStatus;
  domainConfirmed: boolean;
  emails: number;
  phones: number;
  persons: number;
  contactabilite: string;
  leadScore: number;
}

function toOrigin(siteWeb: string): string | null {
  try {
    const u = new URL(siteWeb.startsWith("http") ? siteWeb : `https://${siteWeb}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export async function enrichCompany(
  company: EnrichCompanyInput,
  config: EnrichConfig,
  deps: EnrichDeps,
): Promise<EnrichResult> {
  const now = deps.now ?? (() => new Date());
  const origin = company.siteWeb ? toOrigin(company.siteWeb) : null;

  const noData = async (
    status: EnrichmentStatus,
    contactabilite = "non_contactable",
  ): Promise<EnrichResult> => {
    await deps.db.prospectionCompany.update({
      where: { id: company.id },
      data: {
        enrichmentStatus: status,
        contactabilite: "non_contactable",
        lastEnrichedAt: now(),
        lastCheckedAt: now(),
      },
    });
    return {
      status,
      domainConfirmed: false,
      emails: 0,
      phones: 0,
      persons: 0,
      contactabilite,
      leadScore: 0,
    };
  };

  if (!origin) return noData("no_data");

  // Politesse : robots.txt.
  const robots = deps.fetchRobots ? await fetchRobotsRules(origin, deps.fetchRobots) : null;
  const allowed = (path: string): boolean => (robots ? isPathAllowed(robots, path) : true);

  let pagesFetched = 0;
  const fetchedPages: EnrichPage[] = [];
  const fetchPath = async (path: string): Promise<EnrichPage | null> => {
    if (pagesFetched >= config.maxPagesEntreprise) return null;
    if (!allowed(path)) return null;
    const page = await deps.fetchPage(`${origin}${path}`);
    pagesFetched++;
    if (page && page.ok) fetchedPages.push(page);
    return page;
  };

  // --- Passe A / Confirmation du domaine ---
  // On récupère les pages coordonnées (mentions légales, contact, accueil) qui
  // servent À LA FOIS à confirmer l'appartenance (SIREN/dénomination) ET à
  // extraire les coordonnées. Loyauté : on n'EXTRAIT que si le domaine est
  // confirmé (sinon les pages récupérées sont ignorées).
  let domainConfirmed = false;
  let domainMethod: DomainMatchMethod = "none";
  const confirmPaths = ["/", ...config.contactPaths].slice(0, config.maxPagesContact + 1);
  for (const path of confirmPaths) {
    const page = await fetchPath(path);
    if (!page || !page.ok) continue;
    if (!domainConfirmed) {
      const conf = confirmDomainOwnership(page.text, company);
      if (conf.confirmed) {
        domainConfirmed = true;
        domainMethod = conf.method;
      }
    }
  }

  if (!domainConfirmed) return noData("no_data");

  // --- Passe A : coordonnées (sur les pages déjà récupérées) ---
  const emailSet = new Map<string, { role: boolean }>();
  const phoneSet = new Set<string>();
  for (const page of fetchedPages) {
    const c = extractContacts(page.text);
    for (const e of c.emails) emailSet.set(normalizeEmail(e), { role: isRoleEmail(e) });
    for (const p of c.phones) phoneSet.add(p);
  }

  // --- Passe B : responsables (pages équipe) — indépendante de A ---
  const persons: Array<{ id: string; nom: string; prenoms: string }> = [];
  if (config.enrichirPersonnes) {
    let teamPages = 0;
    for (const path of config.teamPaths) {
      if (teamPages >= config.maxPagesPersonnes) break;
      const page = await fetchPath(path);
      if (!page || !page.ok) continue;
      teamPages++;
      for (const person of extractPersons(page.text)) {
        const { prenoms, nom } = splitFullName(person.name);
        if (!nom) continue;
        const key = personKey(nom, prenoms);
        const created = await deps.db.prospectionPerson.upsert({
          where: { companyId_personKey: { companyId: company.id, personKey: key } },
          create: {
            company: { connect: { id: company.id } },
            nom,
            prenoms,
            titreVerbatim: person.titre,
            personKey: key,
            source: "site_scrape",
            sourceUrl: page.url,
            collectedAt: now(),
          },
          update: { titreVerbatim: person.titre },
        });
        const fonction = normalizeFonction(person.titre);
        await deps.db.prospectionPersonRole.create({
          data: {
            person: { connect: { id: created.id } },
            qualiteRaw: person.titre,
            fonctionNormalisee: fonction.fonctionNormalisee,
            seniorite: fonction.seniorite,
            departementFonctionnel: fonction.departementFonctionnel,
            estDirigeantLegal: false, // vient du scrape, pas du RCS
            source: "site_scrape",
            sourceUrl: page.url,
            collectedAt: now(),
          },
        });
        persons.push({ id: created.id, nom, prenoms });
      }
    }
  }

  // --- Validation + écriture des contacts ---
  let hasEmailVerified = false;
  let hasEmail = false;
  let hasNominativeVerifiedEmail = false;
  for (const [email, meta] of emailSet) {
    hasEmail = true;
    const verif = await verifyEmail(email, deps.mxResolver);
    const mxOk = isMxOk(verif);
    if (mxOk) hasEmailVerified = true;
    // Matching nominatif.
    let personId: string | null = null;
    let confidence = 0;
    for (const p of persons) {
      const c = matchEmailToPerson(email, { nom: p.nom, prenoms: p.prenoms });
      if (c > confidence) {
        confidence = c;
        personId = p.id;
      }
    }
    const isNominatif = personId !== null && confidence >= 0.8;
    if (isNominatif && mxOk) hasNominativeVerifiedEmail = true;
    await deps.db.prospectionContact.upsert({
      where: {
        companyId_type_valueNormalized: {
          companyId: company.id,
          type: "email",
          valueNormalized: email,
        },
      },
      create: {
        company: { connect: { id: company.id } },
        ...(isNominatif && personId ? { person: { connect: { id: personId } } } : {}),
        type: "email",
        value: email,
        valueNormalized: email,
        isNominatif,
        isGenerique: meta.role,
        personMatchConfidence: confidence,
        verifStatus: verif,
        collectedAt: now(),
      },
      update: { verifStatus: verif, isNominatif, personMatchConfidence: confidence },
    });
  }

  let hasPhoneValid = false;
  for (const phone of phoneSet) {
    const status = phoneVerifStatus(phone);
    if (status === "e164_ok") hasPhoneValid = true;
    await deps.db.prospectionContact.upsert({
      where: {
        companyId_type_valueNormalized: {
          companyId: company.id,
          type: "telephone",
          valueNormalized: phone,
        },
      },
      create: {
        company: { connect: { id: company.id } },
        type: "telephone",
        value: phone,
        valueNormalized: normalizePhoneFR(phone) ?? phone,
        verifStatus: status,
        collectedAt: now(),
      },
      update: { verifStatus: status },
    });
  }

  const { contactabilite, nuance } = deriveContactabilite({
    hasEmailVerified,
    hasEmail,
    hasPhoneValid,
    hasNominativeVerifiedEmail,
  });
  const leadScore = computeLeadScore({
    hasEmailVerified,
    hasEmail,
    hasPhoneValid,
    hasNominativeContact: hasNominativeVerifiedEmail,
    hasDirigeant: persons.length > 0,
    isFresh: true,
    isOfficialSource: false,
    matchesTarget: true,
    etablissementActif: true,
  });

  await deps.db.prospectionCompany.update({
    where: { id: company.id },
    data: {
      enrichmentStatus: "enriched",
      siteWebStatus: "verifie",
      domainMatchMethod: domainMethod,
      contactabilite,
      contactabiliteNuance: nuance,
      hasEmail,
      hasTelephone: hasPhoneValid,
      leadScore,
      lastEnrichedAt: now(),
      lastCheckedAt: now(),
    },
  });

  return {
    status: "enriched",
    domainConfirmed: true,
    emails: emailSet.size,
    phones: phoneSet.size,
    persons: persons.length,
    contactabilite,
    leadScore,
  };
}
