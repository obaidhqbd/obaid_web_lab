#!/usr/bin/env python3
"""Generate crawlable resource pages and an XML sitemap."""
from __future__ import annotations

import html
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://obaidhqbd.github.io/obaid_web_lab/"
CATALOG_PATH = ROOT / "data" / "catalog.json"
OUTPUT_ROOT = ROOT / "generated-seo" / "pages" / "resources"
PUBLISHER = "Mohammed Obaidul Hoque"
SITE_NAME = "Obaid Web Lab"


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def text_value(value: object, limit: int = 300) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def safe_id(value: object) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", str(value or "").lower()).strip("-")[:110]


def absolute(relative: object) -> str:
    return BASE_URL + str(relative or "").replace("\\", "/").lstrip("/")


def jsonld(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def inline_markdown(value: str) -> str:
    value = html.escape(value, quote=False)

    def render_link(match: re.Match) -> str:
        label, escaped_url = match.group(1), match.group(2)
        url = html.unescape(escaped_url).strip()
        if urlsplit(url).scheme.lower() not in {"https", "http"}:
            return label
        return '<a href="' + html.escape(url, quote=True) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>"

    value = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", render_link, value)
    value = re.sub(r"\x60([^\x60]+)\x60", r"<code>\1</code>", value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", value)
    return value


def markdown_to_html(source: str) -> str:
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    if lines and lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                lines = lines[index + 1:]
                break
    out: list[str] = []
    paragraph: list[str] = []
    list_kind = ""
    code_lines: list[str] = []
    in_code = False

    def flush_paragraph() -> None:
        if paragraph:
            out.append("<p>" + inline_markdown(" ".join(x.strip() for x in paragraph)) + "</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal list_kind
        if list_kind:
            out.append("</" + list_kind + ">")
            list_kind = ""

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("\x60\x60\x60"):
            flush_paragraph()
            close_list()
            if in_code:
                out.append("<pre><code>" + html.escape("\n".join(code_lines)) + "</code></pre>")
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            continue
        if in_code:
            code_lines.append(line)
            continue
        if not stripped:
            flush_paragraph()
            close_list()
            continue
        match = re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if match:
            flush_paragraph()
            close_list()
            level = len(match.group(1))
            out.append(f"<h{level}>" + inline_markdown(match.group(2)) + f"</h{level}>")
            continue
        unordered = re.match(r"^\s*[-*+]\s+(.+)$", line)
        ordered = re.match(r"^\s*\d+[.)]\s+(.+)$", line)
        if unordered or ordered:
            flush_paragraph()
            kind = "ul" if unordered else "ol"
            if list_kind != kind:
                close_list()
                out.append("<" + kind + ">")
                list_kind = kind
            out.append("<li>" + inline_markdown((unordered or ordered).group(1)) + "</li>")
            continue
        if stripped.startswith(">"):
            flush_paragraph()
            close_list()
            out.append("<blockquote><p>" + inline_markdown(stripped.lstrip("> ")) + "</p></blockquote>")
            continue
        close_list()
        paragraph.append(stripped)
    if in_code:
        out.append("<pre><code>" + html.escape("\n".join(code_lines)) + "</code></pre>")
    flush_paragraph()
    close_list()
    return "\n".join(out)


def article_body(item: dict) -> str:
    body_path = str(item.get("bodyPath") or "")
    if not body_path or Path(body_path).is_absolute() or ".." in Path(body_path).parts:
        return ""
    path = (ROOT / body_path).resolve()
    if ROOT.resolve() not in path.parents or not path.is_file():
        return ""
    try:
        source = path.read_text(encoding="utf-8-sig", errors="replace")[:500_000]
    except OSError:
        return ""
    if path.suffix.lower() in {".md", ".markdown", ".txt"}:
        return markdown_to_html(source)
    source = re.sub(r"<(script|style)\b[^>]*>.*?</\1\s*>", " ", source, flags=re.I | re.S)
    source = re.sub(r"<[^>]+>", " ", source)
    source = html.unescape(re.sub(r"\s+", " ", source)).strip()
    return "<p>" + esc(source) + "</p>" if source else ""


def make_page(item: dict, kind: str, rid: str, today: str) -> tuple[str, str]:
    title = text_value(item.get("title"), 180) or "Learning resource"
    description = text_value(item.get("description"), 240) or "Explore practical web development learning materials."
    category = text_value(item.get("category"), 80)
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    keywords = list(dict.fromkeys([category] + [text_value(tag, 60) for tag in tags if text_value(tag, 60)]))
    date = str(item.get("date") or "")
    date = date if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) else today
    resource_type = "class" if kind == "class" else "notes"
    page_path = f"resources/{resource_type}/{rid}/"
    canonical = absolute(page_path)
    heading = title + (" | Class | " if kind == "class" else " | Study Note | ") + SITE_NAME
    schema = {
        "@context": "https://schema.org",
        "@type": "LearningResource" if kind == "class" else "Article",
        "name": title,
        "headline": title,
        "description": description,
        "url": canonical,
        "inLanguage": "en",
        "keywords": keywords,
        "author": {"@type": "Person", "name": PUBLISHER},
        "dateModified": date,
    }
    if kind == "class":
        schema["learningResourceType"] = "Class collection"
        schema["provider"] = {"@type": "Person", "name": PUBLISHER}
    else:
        schema["datePublished"] = date
        schema["publisher"] = {"@type": "Person", "name": PUBLISHER}

    tag_html = "".join('<span class="tag">' + esc(tag) + "</span>" for tag in keywords if tag)
    file_items = []
    for file in item.get("files", []) if isinstance(item.get("files"), list) else []:
        if not isinstance(file, dict):
            continue
        path = str(file.get("path") or "")
        if not path or Path(path).is_absolute() or ".." in Path(path).parts:
            continue
        label = text_value(file.get("title") or Path(path).name, 160)
        extension = text_value(file.get("ext"), 12).upper()
        file_items.append('<li><a href="' + esc(absolute(path)) + '">' + esc(label) + "</a>" +
                          (' <span class="file-type">' + esc(extension) + "</span>" if extension else "") + "</li>")
    files_html = '<section><h2>Project files</h2><ul>' + "\n".join(file_items) + "</ul></section>" if file_items else ""

    download_html = ""
    download = str(item.get("downloadUrl") or "")
    if kind == "class" and download and not Path(download).is_absolute() and ".." not in Path(download).parts:
        download_html = '<p><a class="button" href="' + esc(absolute(download)) + '" download>Download class ZIP</a></p>'
    body_html = article_body(item) if kind == "blog" else ""
    article_html = '<section><h2>Study content</h2>' + body_html + "</section>" if body_html else ""
    category_html = '<p><strong>Topic:</strong> ' + esc(category) + "</p>" if category else ""

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="bingbot" content="index,follow">
<title>{esc(heading)}</title>
<meta name="description" content="{esc(description)}">
<meta name="author" content="{esc(PUBLISHER)}">
<meta name="keywords" content="{esc(', '.join(keywords))}">
<link rel="canonical" href="{esc(canonical)}">
<meta name="theme-color" content="#f6f6fa">
<meta property="og:type" content="{'article' if kind == 'blog' else 'website'}">
<meta property="og:site_name" content="{esc(SITE_NAME)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">{jsonld(schema)}</script>
<style>
:root{{color-scheme:light;--ink:#20212a;--muted:#626574;--line:#e4e5ec;--accent:#4f46e5;--paper:#fff;--wash:#f6f6fa}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--wash);color:var(--ink);font:16px/1.75 system-ui,-apple-system,"Segoe UI",sans-serif}}
header,main,footer{{width:min(820px,calc(100% - 36px));margin-inline:auto}}header{{padding:28px 0 12px}}.brand{{color:var(--ink);font-weight:750;text-decoration:none}}.crumbs{{font-size:.9rem;color:var(--muted);margin-top:12px}}.crumbs a,a{{color:var(--accent)}}main{{background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:clamp(22px,5vw,48px);margin:20px auto 48px;box-shadow:0 12px 36px #20212a0a}}
.eyebrow{{font-size:.78rem;font-weight:750;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}}h1{{font-size:clamp(2rem,6vw,3.1rem);line-height:1.14;letter-spacing:-.04em;margin:.3em 0}}h2{{font-size:1.3rem;line-height:1.3;margin-top:2rem}}.description{{font-size:1.12rem;color:var(--muted)}}.tags{{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}}.tag,.file-type{{background:#f0efff;color:#4338ca;border-radius:999px;padding:3px 10px;font-size:.8rem}}ul{{padding-left:1.3rem}}li{{margin:.35rem 0}}.button{{display:inline-block;border-radius:999px;background:var(--ink);color:#fff;padding:10px 18px;text-decoration:none;font-weight:700}}pre{{max-width:100%;overflow:auto;background:#f4f4f8;padding:16px;border-radius:12px}}code{{background:#f0f0f5;border-radius:4px;padding:2px 5px}}pre code{{background:transparent;padding:0}}blockquote{{margin:1em 0;border-left:3px solid var(--accent);padding-left:16px;color:var(--muted)}}footer{{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:.9rem;padding:0 0 28px}}
</style>
</head>
<body>
<header><a class="brand" href="{esc(BASE_URL)}">{esc(SITE_NAME)}</a><nav class="crumbs" aria-label="Breadcrumb"><a href="{esc(BASE_URL)}">Home</a> › <a href="{esc(BASE_URL)}">{'Classes' if kind == 'class' else 'Study notes'}</a></nav></header>
<main>
<p class="eyebrow">{'WEB DEVELOPMENT CLASS' if kind == 'class' else 'STUDY NOTE'}</p>
<h1>{esc(title)}</h1>
<p class="description">{esc(description)}</p>
{category_html}
<div class="tags">{tag_html}</div>
{download_html}
{article_html}
{files_html}
<p><a class="button" href="{esc(BASE_URL)}">Open Obaid Web Lab learning library</a></p>
</main>
<footer><span>Obaid Web Lab · Built for learning through doing.</span><span>By {esc(PUBLISHER)}</span></footer>
</body>
</html>
"""
    return page_path, page


def main() -> int:
    if not CATALOG_PATH.is_file():
        print("ERROR: data/catalog.json is missing. Build the catalogue first.")
        return 1
    try:
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"ERROR: could not read catalogue: {exc}")
        return 1
    if not isinstance(catalog, dict) or not isinstance(catalog.get("classes"), list) or not isinstance(catalog.get("blogs"), list):
        print("ERROR: catalogue has an invalid structure.")
        return 1

    generated_root = ROOT / "generated-seo"
    if generated_root.exists():
        shutil.rmtree(generated_root)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).date().isoformat()
    sitemap_entries = [(BASE_URL, today)]
    total = 0
    for key, kind in (("classes", "class"), ("blogs", "blog")):
        for item in catalog.get(key, []):
            if not isinstance(item, dict):
                continue
            rid = safe_id(item.get("id"))
            if not rid:
                continue
            page_path, page_html = make_page(item, kind, rid, today)
            folder = OUTPUT_ROOT / ("classes" if kind == "class" else "notes") / rid
            folder.mkdir(parents=True, exist_ok=True)
            (folder / "index.html").write_text(page_html, encoding="utf-8")
            page_date = str(item.get("date") or today)[:10]
            sitemap_entries.append((absolute(page_path), page_date))
            total += 1

    elements = []
    for url, raw_date in sitemap_entries:
        lastmod = raw_date if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date) else today
        elements.append("  <url><loc>" + html.escape(url) + "</loc><lastmod>" + lastmod + "</lastmod></url>")
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' + \
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + \
              "\n".join(elements) + "\n</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    print(f"SEO build complete: {total} crawlable resource pages and {len(sitemap_entries)} sitemap URLs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
