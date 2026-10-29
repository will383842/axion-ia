import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Chronologie } from "../Chronologie";
import { FiltresActivite } from "../FiltresActivite";
import { TuilesEmails, compterEmails } from "../TuilesEmails";
import { FilDesEchanges } from "../../FilDesEchanges";
import {
  grouperParJour,
  type EvenementActivite,
  type TypeActivite,
} from "@/features/dossier-client/fiche/chronologie";
import type { EchangeDuFil } from "@/features/dossier-client/fil-des-echanges";

const ref = new Date("2026-10-29T12:00:00Z");
const ev = (type: TypeActivite, plus: Partial<EvenementActivite> = {}): EvenementActivite => ({
  cle: `${type}:1`,
  type,
  date: new Date("2026-10-29T09:00:00Z"),
  titre: `Titre ${type}`,
  etat: "état",
  nuance: "neutre",
  lien: null,
  ...plus,
});
const rendre = (evs: EvenementActivite[], pannes = 0): string =>
  renderToStaticMarkup(<Chronologie jours={grouperParJour(evs, ref)} sourcesEnPanne={pannes} />);

describe("Chronologie", () => {
  it("chaque type porte une icône aria-hidden ET son mot", () => {
    const types: TypeActivite[] = ["rendez_vous", "email", "note", "tache", "argent"];
    const mots = ["Rendez-vous", "E-mail", "Note", "Tâche", "Argent"];
    const html = rendre(types.map((t) => ev(t, { cle: t })));
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(5);
    for (const m of mots) expect(html).toContain(`<span>${m}</span>`);
    expect(html).toContain("29 oct.");
    expect(html).toContain("<ol");
  });
  it("un paiement reçu s'écrit en TTC, un devis en HT avec le TTC en petit", () => {
    const html = rendre([
      ev("argent", { cle: "p", titre: "Paiement reçu", montant: { cents: 72000, base: "ttc" } }),
      ev("argent", {
        cle: "d",
        titre: "Devis envoyé n° 1",
        montant: { cents: 450000, base: "ht" },
      }),
    ]);
    expect(html).toContain("720 € TTC");
    expect(html).toContain("4 500 € HT");
    expect(html).toContain("5 400 € TTC");
    expect(html).not.toContain("720 € HT");
  });
  it("dit une source en panne, et ne la prend pas pour « rien »", () => {
    const html = rendre([], 1);
    expect(html).toContain("n&#x27;a pas pu être lue");
    expect(html).not.toContain("Aucune activité");
    expect(rendre([])).toContain("Aucune activité");
  });
  it("un e-mail montre le nom et « Voir la copie », jamais d'adresse", () => {
    const html = rendre([
      ev("email", {
        destinataire: "Camille Roux",
        lien: "/fr/adm/emails-envoyes/1",
        libelleLien: "Voir la copie",
      }),
    ]);
    expect(html).toContain("à Camille Roux");
    expect(html).toContain("Voir la copie");
    expect(html).not.toMatch(/@/);
  });
});

describe("FiltresActivite", () => {
  it("six liens, le courant marqué", () => {
    const n = { tout: 0, "rendez-vous": 0, emails: 0, notes: 0, taches: 0, argent: 0 };
    const html = renderToStaticMarkup(
      <FiltresActivite ficheHref="/fr/adm/qualiopi/clients/1" actif="notes" compteurs={n} />,
    );
    expect(html.match(/<a /g)).toHaveLength(6);
    expect(html).toContain("?onglet=activite&amp;filtre=notes");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});

describe("Onglet E-mails", () => {
  const e = (cle: string, plus: Partial<EchangeDuFil>): EchangeDuFil => ({
    cle,
    genre: "email",
    date: new Date("2026-10-25T10:05:00Z"),
    titre: `Objet ${cle}`,
    etat: "Envoyé",
    lien: `/fr/adm/emails-envoyes/${cle}`,
    ...plus,
  });
  const fil: EchangeDuFil[] = [
    e("1", { statutEmail: "sent" }),
    e("2", { statutEmail: "sent" }),
    e("3", { statutEmail: "failed", etat: "Échec" }),
    e("4", { genre: "email_en_attente", etat: "En attente de votre validation" }),
    e("5", { genre: "email_en_attente", etat: "Écarté" }),
  ];
  it("compte les tuiles justement", () => {
    expect(compterEmails(fil)).toEqual({ envoyes: 2, aValider: 1 });
    const html = renderToStaticMarkup(<TuilesEmails envoyes={2} aValider={1} />);
    expect(html).toContain("Envoyés");
    expect(html).toContain("À valider");
  });
  it("ne montre ni adresse ni corps, mais le nom, la date et « Voir la copie »", () => {
    const html = renderToStaticMarkup(
      <FilDesEchanges
        fil={fil}
        clientId="cl"
        adminPrefix="adm"
        destinataires={{ "1": "Camille Roux" }}
      />,
    );
    expect(html).not.toMatch(/@/);
    expect(html).toContain("à Camille Roux");
    expect(html).toContain("Voir la copie");
    expect(html).toContain("Objet 1");
  });
});
