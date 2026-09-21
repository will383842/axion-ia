/**
 * Garde-fou de cohérence des sous-processeurs (lot L10 / constat X2).
 *
 * POURQUOI CE FICHIER EXISTE — Calendly est arrivé en production le 2026-05-26,
 * onze jours après le gel de `SUBPROCESSORS_LAST_UPDATED` au 2026-05-15, et est
 * resté absent des trois registres pendant deux mois pendant que
 * `/sous-processeurs` se déclarait « exhaustive » (RGPD art. 13.1.e). Un runbook
 * annuel n'aurait pas rattrapé ça : le mode de défaillance est une feature
 * mergée entre deux revues. Il faut un test qui casse au commit.
 *
 * POURQUOI LE SCAN PORTE SUR LA CSP, ET PAS SUR LE JSX — première version de ce
 * fichier : un grep de `src="https://…` / `href="https://…` sur `src/components`
 * et `src/app`. Rejeté, pour deux raisons mesurées :
 *   1. FAUX POSITIFS — 13 hôtes remontent, dont www.insee.fr, x.com,
 *      creativecommons.org, www.linkedin.com : de simples liens sortants, aucun
 *      transfert de données. Le test était rouge à l'arrivée.
 *   2. FAUX NÉGATIF SUR LE CAS VISÉ — l'embed Calendly incriminé s'écrivait
 *      `src={CALENDLY_WIDGET_JS}` et `data-url={finalUrl}`, des identifiants.
 *      Aucun littéral. Le test n'aurait PAS attrapé l'omission qu'il prétend
 *      empêcher.
 * La CSP est le vrai goulot : aucun tiers ne peut charger dans le navigateur
 * sans figurer dans `script-src` / `connect-src` / `frame-src`, quelle que soit
 * la façon dont l'URL est écrite en JSX. La liste est courte et curée, donc
 * stable — et un ajout y est toujours un acte conscient.
 *
 * NE PAS « simplifier » en remplaçant les tables ci-dessous par une heuristique.
 * Leur intérêt est précisément d'obliger à classer chaque nouvel hôte à la main.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTANCIEL_VISIO } from "../formations/materiel";
import { SUBPROCESSORS } from "../subprocessors";
import { LEGAL_PAGES } from "../legal";

const ROOT = process.cwd();

/**
 * Hôte autorisé par la CSP → fragment du `name` de l'entrée SUBPROCESSORS qui le
 * couvre. AJOUTER UNE LIGNE ICI EST UN ACTE CONSCIENT : cela signifie qu'on a
 * aussi créé l'entrée dans la SSOT, la ligne dans `_AUDIT/DPA-REGISTER.md`, et
 * vérifié que le tiers est gaté sur consentement.
 */
const CSP_HOST_OWNER: Record<string, string> = {
  "calendly.com": "Calendly",
  "*.calendly.com": "Calendly",
  "assets.calendly.com": "Calendly",
  "www.clarity.ms": "Microsoft",
  "*.clarity.ms": "Microsoft",
  "*.ingest.sentry.io": "Sentry",
  "*.ingest.de.sentry.io": "Sentry",
  "*.ingest.us.sentry.io": "Sentry",
  "api.stripe.com": "Stripe",
  "checkout.stripe.com": "Stripe",
  "api.telegram.org": "Telegram",
  "challenges.cloudflare.com": "Cloudflare",
  "*.r2.cloudflarestorage.com": "Cloudflare",
  "plausible.axion-ia.com": "Plausible",
  "snap.licdn.com": "LinkedIn",
  "px.ads.linkedin.com": "LinkedIn",
  "connect.facebook.net": "Meta",
  "www.facebook.com": "Meta",
};

/**
 * Hôtes autorisés par la CSP qui ne SONT PAS des sous-traitants — avec le motif.
 * Un motif vague ici est une faute : c'est la porte de sortie du garde-fou.
 */
const CSP_HOST_JUSTIFIED: Record<string, string> = {
  // Les fontes sont servies depuis le dépôt (`next/font/local`, fichiers
  // `src/fonts/*.woff2` — cf. src/app/[locale]/layout.tsx : Manrope,
  // Inconsolata, Fraunces). Aucune requête du navigateur vers Google —
  // vérifié le 2026-07-26 :
  //   curl -s https://axion-ia.com/fr/appel | grep -o 'fonts\.\(googleapis\|gstatic\)\.com' → vide
  // Depuis le 2026-08-16 le BUILD non plus ne joint Google : ces deux
  // directives CSP n'ont plus aucun consommateur, ni au build ni au runtime.
  // Elles sont vestigiales et pourraient être retirées de `src/lib/csp.ts`
  // (non fait ici : hors sujet de la bascule, et une CSP se resserre dans une
  // PR qui ne fait que ça). Si elles redevenaient effectives, Google
  // redeviendrait un sous-traitant à déclarer.
  "fonts.googleapis.com":
    "fontes auto-hébergées depuis le dépôt (next/font/local) — aucune requête runtime NI build",
  "fonts.gstatic.com": "idem fonts.googleapis.com",
};

/** Hôtes tiers autorisés par la CSP, extraits du fichier source. */
function cspHosts(): string[] {
  const csp = readFileSync(join(ROOT, "src", "lib", "csp.ts"), "utf8");
  const hosts = new Set<string>();
  for (const m of csp.matchAll(/https:\/\/([a-zA-Z0-9.*-]+)/g)) {
    if (m[1]) hosts.add(m[1]);
  }
  return [...hosts].sort();
}

/** Premier mot significatif d'un nom commercial ("Calendly LLC" → "Calendly"). */
function firstToken(name: string): string {
  return (name.split(/[\s(,]/)[0] ?? name).replace(/[^A-Za-z]/g, "");
}

describe("cohérence des sous-processeurs", () => {
  it("Calendly figure dans la SSOT, avec la bonne base légale et le bon cadre de transfert", () => {
    const calendly = SUBPROCESSORS.find((s) => /calendly/i.test(s.name));
    expect(calendly, "aucune entrée Calendly dans SUBPROCESSORS").toBeDefined();
    // 6.1.b et non 6.1.a : le consentement en jeu est celui de l'art. 82
    // (accès au terminal), pas une base légale de traitement.
    expect(calendly?.legalBasis).toBe("6.1.b_contract");
    expect(calendly?.transferFramework).toBe("scc");
    expect(calendly?.activationStatus).toBe("active");
  });

  it("tout hôte tiers autorisé par la CSP est couvert par la SSOT, ou justifié explicitement", () => {
    const names = SUBPROCESSORS.map((s) => s.name).join(" | ");
    for (const host of cspHosts()) {
      if (host in CSP_HOST_JUSTIFIED) {
        expect(
          CSP_HOST_JUSTIFIED[host]?.length ?? 0,
          `Le motif de justification de "${host}" est vide.`,
        ).toBeGreaterThan(20);
        continue;
      }
      const owner = CSP_HOST_OWNER[host];
      expect(
        owner,
        `L'hôte "${host}" est autorisé à charger dans le navigateur du visiteur par ` +
          `src/lib/csp.ts, mais n'est classé nulle part. Déclarer le sous-processeur ` +
          `dans src/content/subprocessors.ts ET dans _AUDIT/DPA-REGISTER.md puis ` +
          `l'ajouter à CSP_HOST_OWNER ; ou, s'il ne traite aucune donnée, ` +
          `l'ajouter à CSP_HOST_JUSTIFIED avec un motif vérifié.`,
      ).toBeDefined();
      expect(names, `"${host}" est rattaché à "${owner}", absent de SUBPROCESSORS.`).toContain(
        owner as string,
      );
    }
  });

  it("la section transferts de la politique de confidentialité n'énumère AUCUN sous-processeur", () => {
    // La divergence historique venait d'une prose recopiée à la main : elle
    // affirmait que « les seuls transferts hors UE » concernaient 3 modèles d'IA,
    // alors que la SSOT en déclarait 7 autres hors UE. Une prose qui n'énumère
    // pas ne peut pas diverger — c'est CET invariant qu'on verrouille, et la
    // liste interdite est DÉRIVÉE de la SSOT pour couvrir aussi les futurs.
    const privacy = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
    expect(privacy).toBeDefined();
    const transferBodies = [privacy?.fr, privacy?.en]
      .flatMap((v) => v?.sections ?? [])
      .filter((s) => /transfert|transfer/i.test(s.title))
      .map((s) => s.body)
      .join("\n");
    expect(transferBodies.length, "aucune section transferts trouvée").toBeGreaterThan(0);

    for (const s of SUBPROCESSORS) {
      const token = firstToken(s.name);
      expect(
        transferBodies,
        `"${token}" (${s.name}) est nommé dans la section transferts de legal.ts. ` +
          `Toute énumération finit par diverger de src/content/subprocessors.ts — ` +
          `renvoyer à /sous-processeurs sans nommer personne.`,
      ).not.toContain(token);
    }
  });

  it("🔴 l'outil de visioconférence annoncé aux stagiaires est un sous-traitant DÉCLARÉ", () => {
    // 🔑 CE QUE CETTE GARDE RÉPARE, le 2026-09-20. La décision de Will du
    // 2026-09-19 a remplacé Google Meet par Zoom pour les formations à
    // distance. Le nom a changé dans neuf textes publics et sur la convocation
    // remise au stagiaire — et dans AUCUN registre. Aucune garde ne l'a vu :
    // `la-notice-ne-retarde-pas-sur-la-visio.spec.ts` est épinglée sur la
    // chaîne « Google Meet » (donc aveugle à une SUBSTITUTION d'outil), et le
    // scan de ce fichier est adossé à la CSP, que Zoom ne traverse pas — le
    // lien est saisi à la main, le stagiaire le suit depuis son navigateur.
    //
    // Une substitution d'outil est le mode de défaillance le plus discret :
    // rien n'est ajouté, tout est déjà écrit, et la page publique continue de
    // se dire « exhaustive » en nommant le prédécesseur.
    const outil = DISTANCIEL_VISIO.split(/[\s,]+/)[0] ?? "";
    // Contre-témoin : sans nom d'outil, le test ne mesurerait plus rien.
    expect(
      outil,
      "`DISTANCIEL_VISIO` ne commence plus par un nom d'outil — cette garde est devenue muette",
    ).toMatch(/^[A-Z][\w.-]{2,}$/);
    expect(
      SUBPROCESSORS.some((s) => s.name.toLowerCase().includes(outil.toLowerCase())),
      `"${outil}" est annoncé aux stagiaires (src/content/formations/materiel.ts, ` +
        `repris sur la convocation) mais n'est déclaré nulle part dans ` +
        `src/content/subprocessors.ts, pendant que /sous-processeurs se dit ` +
        `« liste exhaustive » (RGPD art. 13.1.e). Leur image, leur voix, leur IP ` +
        `et leurs horaires de connexion partent chez un tiers non déclaré.`,
    ).toBe(true);
  });

  /**
   * Les deux seuls sous-traitants actifs portant `dpaStatus: "pending"`, au
   * 2026-09-20.
   *
   * ⚠️ Ce n'est PAS la liste des sous-traitants actifs sans DPA accepté :
   * plusieurs entrées portent `auto_signable_dashboard`, c'est-à-dire
   * « acceptable en un clic », et le registre note que certaines restent à
   * accepter. (Cloudflare figurait dans cette liste jusqu'au 2026-09-20 : son
   * DPA est accepté depuis le 2026-05-09, la phrase était devenue fausse.) Cette garde ne couvre que le cas le plus net — aucun accord
   * possible — et ne prétend pas à davantage. Relevé par la lentille sécurité
   * le 2026-09-20 : le titre était plus large que le code.
   *
   * Même cause pour les deux : le compte est un
   * compte Gmail grand public, dont les conditions consommateur ne comportent
   * pas de DPA. Écart ASSUMÉ et daté — la sortie est la bascule vers Google
   * Workspace, décidée par Will pour janvier 2027 (`_AUDIT/DPA-REGISTER.md`).
   *
   * 🔑 Cette liste doit RÉTRÉCIR, jamais grandir. Y ajouter un nom, c'est
   * décider d'envoyer des données personnelles à un tiers sans contrat — une
   * décision qui se prend, se date et s'inscrit au registre, elle ne se
   * configure pas au détour d'un champ.
   */
  const ACTIFS_SANS_DPA_ASSUMES: readonly string[] = [
    "Google Ireland Limited (Google Agenda)",
    "Google Ireland Limited (Google Meet)",
  ];

  it("🔴 aucun sous-traitant n'est ACTIF sans accord de sous-traitance", () => {
    // 🔑 CE QUE CETTE GARDE TIENT, posée le 2026-09-20 avec l'entrée Zoom.
    // Zoom est déclaré `pending_activation` parce qu'aucun compte n'existe
    // encore. Le jour de la souscription, quelqu'un passera ce champ à
    // `active` — et rien, jusqu'ici, n'exigeait que le DPA soit accepté au
    // même moment. C'est un champ d'une ligne, dans un fichier de contenu :
    // exactement le genre de bascule qui se fait sans que personne ne relise
    // le registre.
    //
    // La règle vaut pour TOUS les futurs sous-traitants, pas seulement Zoom :
    // activer, c'est ouvrir un flux de données personnelles vers un tiers.
    const fautifs = SUBPROCESSORS.filter(
      (s) =>
        s.activationStatus === "active" &&
        s.dpaStatus === "pending" &&
        !ACTIFS_SANS_DPA_ASSUMES.includes(s.name),
    ).map((s) => s.name);

    expect(
      fautifs,
      `sous-traitant(s) déclaré(s) ACTIF avec \`dpaStatus: "pending"\` : des ` +
        `données personnelles partent chez un tiers sans contrat de ` +
        `sous-traitance (RGPD art. 28). Accepter le DPA d'abord et passer ` +
        `\`dpaStatus\`, ou laisser \`pending_activation\` — et inscrire la ` +
        `décision dans _AUDIT/DPA-REGISTER.md.`,
    ).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : les écarts assumés existent encore, et ne sont que deux", () => {
    // Sans ce test, retirer les deux lignes Google rendrait la garde ci-dessus
    // verte pour une mauvaise raison — et sa liste d'exemptions, invisible.
    for (const nom of ACTIFS_SANS_DPA_ASSUMES) {
      const entree = SUBPROCESSORS.find((s) => s.name === nom);
      expect(entree, `"${nom}" a disparu de la SSOT : l'exemption ne vise plus rien`).toBeDefined();
    }
    const reels = SUBPROCESSORS.filter(
      (s) => s.activationStatus === "active" && s.dpaStatus === "pending",
    ).map((s) => s.name);
    expect(
      reels.length,
      "le nombre de sous-traitants actifs sans DPA a AUGMENTÉ. Cette liste " +
        "doit rétrécir (sortie : bascule Google Workspace, janvier 2027).",
    ).toBeLessThanOrEqual(ACTIFS_SANS_DPA_ASSUMES.length);
  });

  it("chaque entrée de la SSOT figure dans le registre interne art. 30", () => {
    const register = readFileSync(join(ROOT, "_AUDIT", "DPA-REGISTER.md"), "utf8");
    for (const s of SUBPROCESSORS) {
      expect(
        register,
        `"${s.name}" est déclaré publiquement mais absent de _AUDIT/DPA-REGISTER.md — ` +
          `le registre art. 30 est la pièce demandée en premier en audit.`,
      ).toContain(firstToken(s.name));
    }
  });
});
