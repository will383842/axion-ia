#!/usr/bin/env python3
"""Veille IA quotidienne → Telegram (demande de Will du 28/11/2026).

Lit les sources officielles (Anthropic/Claude, OpenAI, Google), repère ce qui
est NOUVEAU depuis le passage précédent et l'envoie en UN message Telegram.
Surveille aussi la page du programme Claude for Startups : alerte dès qu'elle
n'affiche plus « candidatures fermées ».

Aucun modèle d'IA n'est appelé : zéro jeton, zéro crédit API.
Bibliothèque standard seulement. L'état (liens déjà vus) vit dans un fichier
JSON gardé par actions/cache entre deux passages.

Variables : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ETAT (chemin du JSON),
DRY_RUN=1 pour afficher au lieu d'envoyer.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (veille-ia; GitHub Actions)"
MAX_PAR_SOURCE = 12  # au-delà, on résume par « + N autres »
LIMITE_TELEGRAM = 3800

PAGE_STARTUPS = "https://claude.com/programs/startups"
MARQUE_FERME = "not accepting new applications"

SOURCES = [
    # (nom affiché, type, url)
    ("Anthropic (annonces)", "page-anthropic", "https://www.anthropic.com/news"),
    ("Claude (blog)", "rss", "https://claude.com/blog/rss.xml"),
    ("OpenAI", "rss", "https://openai.com/news/rss.xml"),
    ("Google (IA)", "rss", "https://blog.google/technology/ai/rss/"),
    ("Google DeepMind", "rss", "https://deepmind.google/blog/rss.xml"),
]

# Mots qui méritent un 🔥 : utile pour une PME française qui vend de l'IA.
MOTS_IMPORTANTS = re.compile(
    r"\b(startups?|credits?|crédits?|free|gratuit|pricing|prices?|prix|"
    r"claude code|opus|sonnet|haiku|gpt-\d|gemini \d|codex|o\d|"
    r"introducing|launch(es|ing)?|now available|france|french|europe|eu|"
    r"small business(es)?|smbs?|tpe|pme)\b",
    re.I,
)


def lire(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def articles_rss(texte: str) -> list[tuple[str, str]]:
    """Rend [(lien, titre)] pour un flux RSS 2.0 ou Atom."""
    racine = ET.fromstring(texte.encode("utf-8"))
    sortie: list[tuple[str, str]] = []
    for item in racine.iter():
        tag = item.tag.split("}")[-1]
        if tag not in ("item", "entry"):
            continue
        titre, lien = "", ""
        for enfant in item:
            t = enfant.tag.split("}")[-1]
            if t == "title":
                titre = (enfant.text or "").strip()
            elif t == "link":
                lien = (enfant.text or enfant.get("href") or "").strip()
            elif t == "guid" and not lien:
                lien = (enfant.text or "").strip()
        if lien:
            sortie.append((lien, titre or lien))
    return sortie


def articles_anthropic(texte: str) -> list[tuple[str, str]]:
    vus: dict[str, str] = {}
    for slug in re.findall(r'href="/news/([a-z0-9][a-z0-9-]*)"', texte):
        if slug in ("announcements", "features"):
            continue
        lien = f"https://www.anthropic.com/news/{slug}"
        vus.setdefault(lien, slug.replace("-", " ").capitalize())
    return list(vus.items())


def titre_page(url: str) -> str:
    """Vrai titre d'un article Anthropic (la page de liste ne donne que le slug)."""
    try:
        m = re.search(r"<title>(.*?)</title>", lire(url), re.S | re.I)
    except Exception:  # noqa: BLE001
        return ""
    if not m:
        return ""
    return html.unescape(m.group(1)).split(" \\ ")[0].strip()


def charger_etat(chemin: str) -> dict:
    try:
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def envoyer(texte: str) -> None:
    if os.environ.get("DRY_RUN") == "1":
        print("----- MESSAGE -----\n" + texte)
        return
    jeton = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    salon = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not jeton or not salon:
        print("::error::Secrets Telegram absents : message NON envoyé.")
        sys.exit(1)
    donnees = urllib.parse.urlencode(
        {
            "chat_id": salon,
            "text": texte,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }
    ).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{jeton}/sendMessage", data=donnees
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        reponse = json.loads(r.read().decode())
    if not reponse.get("ok"):
        print(f"::error::Telegram a refusé le message : {reponse.get('description')}")
        sys.exit(1)


def decouper(lignes: list[str]) -> list[str]:
    messages, courant = [], ""
    for ligne in lignes:
        if len(courant) + len(ligne) + 1 > LIMITE_TELEGRAM:
            messages.append(courant)
            courant = ""
        courant += ligne + "\n"
    if courant.strip():
        messages.append(courant)
    return messages


def main() -> None:
    chemin = os.environ.get("ETAT", "etat-veille.json")
    etat = charger_etat(chemin)
    premier_passage = not etat
    vus: dict[str, list[str]] = etat.get("vus", {})
    # Sources déjà connues AVANT ce passage : une source vue pour la première
    # fois (ou en panne au premier passage) est enregistrée sans notifier,
    # sinon tout son flux (~1 400 articles chez OpenAI) passerait pour nouveau.
    connues = set(vus)
    lignes: list[str] = []
    erreurs: list[str] = []

    # 1. Programme Claude for Startups
    try:
        ferme = MARQUE_FERME in lire(PAGE_STARTUPS).lower()
        statut = "ferme" if ferme else "ouvert"
        ancien = etat.get("startups")
        if statut == "ouvert" and ancien != "ouvert":
            lignes.append(
                "🚨 <b>Claude for Startups : les candidatures semblent ROUVERTES !</b>\n"
                f"Vérifie vite : {PAGE_STARTUPS}\n"
                "(Je prépare le dossier dès que tu me le demandes.)\n"
            )
        elif statut == "ferme" and ancien == "ouvert":
            lignes.append("ℹ️ Claude for Startups : candidatures de nouveau fermées.\n")
        etat["startups"] = statut
    except Exception as e:  # noqa: BLE001 — une source en panne ne bloque pas les autres
        erreurs.append(f"Claude for Startups ({type(e).__name__})")

    # 2. Nouveautés des sources
    for nom, genre, url in SOURCES:
        try:
            texte = lire(url)
            items = articles_rss(texte) if genre == "rss" else articles_anthropic(texte)
        except Exception as e:  # noqa: BLE001
            erreurs.append(f"{nom} ({type(e).__name__})")
            continue
        deja = set(vus.get(nom, []))
        nouveaux = [(l, t) for l, t in items if l not in deja]
        # Garde tout le flux courant + 400 anciens liens (OpenAI publie ~1 400
        # articles dans son flux : couper en dessous ferait revenir les anciens).
        courants = [l for l, _ in items]
        vus[nom] = courants + [l for l in deja if l not in set(courants)][:400]
        if premier_passage or nom not in connues or not nouveaux:
            continue
        lignes.append(f"<b>{html.escape(nom)}</b>")
        for lien, titre in nouveaux[:MAX_PAR_SOURCE]:
            if genre == "page-anthropic":
                titre = titre_page(lien) or titre
            feu = "🔥 " if MOTS_IMPORTANTS.search(titre) else "• "
            lignes.append(f'{feu}<a href="{html.escape(lien, quote=True)}">{html.escape(titre)}</a>')
        if len(nouveaux) > MAX_PAR_SOURCE:
            lignes.append(f"… + {len(nouveaux) - MAX_PAR_SOURCE} autres")
        lignes.append("")

    etat["vus"] = vus

    if premier_passage:
        statut = etat.get("startups", "inconnu")
        lignes = [
            "✅ <b>Veille IA activée.</b>",
            "Chaque matin, je t'envoie ici les nouveautés d'Anthropic/Claude, OpenAI et Google.",
            "🔥 = à regarder en priorité (prix, crédits, nouveaux modèles, Claude Code, startups…).",
            f"Programme Claude for Startups : {'fermé' if statut == 'ferme' else statut} pour l'instant, je te préviens dès qu'il rouvre.",
        ]
    # Une panne d'un jour arrive (flux momentanément vide ou en HTML) : on ne
    # signale une source qu'à partir du 2e passage consécutif en échec.
    pannes_avant: dict[str, int] = etat.get("pannes", {})
    pannes = {e.split(" (")[0]: pannes_avant.get(e.split(" (")[0], 0) + 1 for e in erreurs}
    etat["pannes"] = pannes
    durables = [e for e in erreurs if pannes[e.split(" (")[0]] >= 2]
    if durables:
        lignes.append("⚠️ Sources illisibles depuis 2 jours ou plus : " + ", ".join(durables))
    if lignes:
        entete = "🤖 <b>Veille IA du jour</b>\n" if not premier_passage else ""
        for i, morceau in enumerate(decouper(lignes)):
            envoyer((entete if i == 0 else "") + morceau)
    else:
        print("Rien de nouveau : aucun message envoyé.")
    # L'état n'est écrit qu'APRÈS un envoi réussi (envoyer() quitte en erreur
    # sinon) : un message perdu, surtout l'alerte « rouvert », repart demain.
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(etat, f, ensure_ascii=False)
    if len(erreurs) == len(SOURCES) + 1:
        sys.exit(1)  # tout est illisible : on veut voir le passage en rouge


if __name__ == "__main__":
    main()
