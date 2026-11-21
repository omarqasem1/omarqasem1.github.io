#!/usr/bin/env python3
"""Weekly publication update for www.omarqasem.com.

Runs on GitHub Actions (see .github/workflows/update-publications.yml).
1. Looks up all works linked to the ORCID iD in data/publications.json, via OpenAlex.
2. Adds any work whose DOI (or title) is not already listed, marked source "auto".
3. Fills in missing abstracts (from OpenAlex).
4. Builds BibTeX for new papers from the record the publisher deposited with Crossref
   (volume, issue, pages, month, DOI). Existing BibTeX is never touched.
Only the Python standard library is used. Nothing else on the site is touched.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

DATA = "data/publications.json"
MAILTO = "o.qasem@aiu.edu.kw"  # identifies the site politely to the APIs
UA = "omarqasem.com publication updater (mailto:%s)" % MAILTO

TOPIC_RULES = [
    ("Hybrid iteration", r"hybrid iteration"),
    ("ADP & RL", r"adaptive dynamic programming|reinforcement learning|policy iteration|value iteration|\badp\b|optimal control"),
    ("Multi-agent", r"multi-?agent|cooperative"),
    ("Power systems", r"microgrid|inverter|power|grid|droop|dc-bus|ibr|phase-locked"),
    ("Robotics & aerospace", r"robot|pendulum|satellite|spacecraft|uav|drone|vehicle"),
    ("Observers & LPV", r"observer|parameter-varying|\blpv\b"),
    ("Communications & AI", r"v2v|communication|antenna|machine learning|papr|internet of drones"),
]


def get(url, accept="application/json", tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception as e:  # network hiccup or rate limit: wait and retry
            if i == tries - 1:
                print("  ! failed:", url, e, file=sys.stderr)
                return None
            time.sleep(3 * (i + 1))


def norm_doi(d):
    if not d:
        return ""
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", d.strip(), flags=re.I).lower()


def norm_title(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())


def abstract_from_index(inv):
    if not inv:
        return ""
    words = []
    for w, pos in inv.items():
        for p in pos:
            words.append((p, w))
    return " ".join(w for _, w in sorted(words)).strip()


def short_name(a):
    """'Omar Qasem' -> 'O. Qasem'."""
    parts = a.replace(".", ". ").split()
    if len(parts) < 2:
        return a
    return " ".join(p[0] + "." for p in parts[:-1]) + " " + parts[-1]


def topics_for(title):
    t = (title or "").lower()
    return [name for name, rx in TOPIC_RULES if re.search(rx, t)] or ["ADP & RL"]


def openalex_works(orcid):
    works, cursor = [], "*"
    while cursor:
        url = ("https://api.openalex.org/works?filter=author.orcid:%s&per-page=100&cursor=%s&mailto=%s"
               % (orcid, urllib.parse.quote(cursor), MAILTO))
        body = get(url)
        if not body:
            break
        data = json.loads(body)
        works += data.get("results", [])
        cursor = data.get("meta", {}).get("next_cursor")
        if not data.get("results"):
            break
    return works


MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def bibtex_from_crossref(doi, title_fallback):
    body = get("https://api.crossref.org/works/" + urllib.parse.quote(doi, safe="/"))
    if not body:
        return None
    m = json.loads(body).get("message", {})
    kind = {"journal-article": "ARTICLE", "proceedings-article": "INPROCEEDINGS"}.get(m.get("type"))
    if not kind:
        return None
    names = []
    for a in m.get("author", []):
        fam, giv = a.get("family", ""), a.get("given", "")
        names.append((fam + ", " + giv).strip(", "))
    title = (m.get("title") or [title_fallback])[0]
    venue = (m.get("container-title") or [""])[0].replace("&", "\\&")
    parts = ((m.get("published-print") or m.get("published") or m.get("issued") or {}).get("date-parts") or [[None]])[0]
    year, month = parts[0], (MONTHS[parts[1] - 1] if len(parts) > 1 and parts[1] else None)
    first = re.sub(r"[^a-z]", "", (m.get("author") or [{}])[0].get("family", "x").lower())
    word = next((w.lower() for w in re.findall(r"[A-Za-z]+", title) if w.lower() not in ("a", "an", "the", "on", "of", "for", "via", "and", "to", "in")), "paper")
    f = [("author", " and ".join(names)), ("journal" if kind == "ARTICLE" else "booktitle", venue), ("title", title), ("year", str(year))]
    for fld, val in (("volume", m.get("volume")), ("number", m.get("issue")), ("pages", (m.get("page") or "").replace("\u2013", "-"))):
        if val:
            f.append((fld, val))
    if month:
        f.append(("month", month))
    f.append(("doi", m.get("DOI", doi)))
    lines = ["@%s{%s%s%s," % (kind, first, year, word)]
    for i, (k, v) in enumerate(f):
        lines.append("  %s=%s%s" % (k, v if k == "month" else "{" + v + "}", "," if i < len(f) - 1 else "}"))
    return "\n".join(lines)


def main():
    with open(DATA, encoding="utf-8") as f:
        db = json.load(f)
    pubs = db["publications"]
    exclude = {norm_doi(d) for d in db.get("exclude_dois", [])}
    known_dois = {norm_doi(p.get("doi")) for p in pubs if p.get("doi")}
    known_titles = {norm_title(p["title"]) for p in pubs}
    changed = False

    works = openalex_works(db["orcid"])
    print("OpenAlex works found:", len(works))
    by_doi = {}
    for w in works:
        doi = norm_doi(w.get("doi"))
        if doi:
            by_doi[doi] = w

    # 1) add new works
    for w in works:
        doi = norm_doi(w.get("doi"))
        title = (w.get("title") or "").strip()
        wtype = w.get("type") or ""
        if not title or wtype in ("paratext", "dataset", "peer-review", "erratum", "editorial", "letter", "other"):
            continue
        if doi and (doi in known_dois or doi in exclude):
            continue
        if norm_title(title) in known_titles:
            continue
        src = ((w.get("primary_location") or {}).get("source") or {})
        stype = src.get("type") or ""
        kind = "journal" if stype == "journal" else "conference" if stype == "conference" else "preprint" if (stype == "repository" or wtype == "preprint") else ("journal" if wtype == "article" else "conference")
        authors = ", ".join(short_name(a["author"]["display_name"]) for a in w.get("authorships", []) if a.get("author"))
        entry = {
            "type": kind,
            "status": "published",
            "year": w.get("publication_year"),
            "title": title,
            "authors": authors,
            "venue": src.get("display_name") or "",
            "details": "",
            "topics": topics_for(title),
            "source": "auto",
        }
        if doi:
            entry["doi"] = doi
            if doi.startswith("10.48550/arxiv."):
                entry["arxiv"] = doi.split("arxiv.", 1)[1]
        pubs.append(entry)
        known_titles.add(norm_title(title))
        if doi:
            known_dois.add(doi)
        changed = True
        print("  + added:", entry["year"], title)

    # 2) fill abstracts
    for p in pubs:
        doi = norm_doi(p.get("doi"))
        if not doi:
            continue
        if not p.get("abstract"):
            w = by_doi.get(doi)
            if w is None:
                body = get("https://api.openalex.org/works/doi:%s?mailto=%s" % (urllib.parse.quote(doi), MAILTO))
                w = json.loads(body) if body else {}
            abs_text = abstract_from_index((w or {}).get("abstract_inverted_index"))
            if abs_text:
                p["abstract"] = abs_text
                changed = True
                print("  ~ abstract:", p["title"][:70])
        if not p.get("bibtex"):
            bib = bibtex_from_crossref(doi, p["title"])
            if bib:
                p["bibtex"] = bib
                p["bibtex_source"] = "built from the publisher record (Crossref)"
                changed = True
                print("  ~ bibtex:", p["title"][:70])
            time.sleep(0.5)

    if changed:
        with open(DATA, "w", encoding="utf-8") as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("Updated", DATA)
    else:
        print("No changes.")


if __name__ == "__main__":
    main()
