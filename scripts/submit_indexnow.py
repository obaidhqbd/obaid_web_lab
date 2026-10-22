#!/usr/bin/env python3
"""Notify IndexNow after a successful GitHub Pages deployment."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://obaidhqbd.github.io/obaid_web_lab/"
KEY_PATH = ROOT / "8694552d4956458c8f3406bf83871799.txt"
SITEMAP_URL = BASE_URL + "sitemap.xml"
ENDPOINT = "https://api.indexnow.org/indexnow"


def read_sitemap() -> list[str]:
    request = urllib.request.Request(
        SITEMAP_URL, headers={"User-Agent": "ObaidWebLab-IndexNow/1.0"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"Sitemap returned HTTP {response.status}")
        xml = response.read(2_000_000)
    root = ET.fromstring(xml)
    urls = []
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == "loc" and element.text:
            url = element.text.strip()
            if url.startswith(BASE_URL):
                urls.append(url)
    if not urls:
        raise RuntimeError("The deployed sitemap contains no URLs for this site")
    return list(dict.fromkeys(urls))[:10000]


def main() -> int:
    key = KEY_PATH.read_text(encoding="utf-8").strip()
    if not 8 <= len(key) <= 128:
        raise RuntimeError("IndexNow key length is invalid")
    host = urlsplit(BASE_URL).netloc
    payload = json.dumps({
        "host": host,
        "key": key,
        "keyLocation": BASE_URL + KEY_PATH.name,
        "urlList": read_sitemap(),
    }).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status not in (200, 202):
                raise RuntimeError(f"IndexNow returned HTTP {response.status}")
            print(f"IndexNow accepted {len(json.loads(payload)['urlList'])} URLs (HTTP {response.status}).")
            return 0
    except urllib.error.HTTPError as exc:
        message = exc.read(1000).decode("utf-8", errors="replace")
        raise RuntimeError(f"IndexNow returned HTTP {exc.code}: {message}") from exc


if __name__ == "__main__":
    # GitHub Pages can take a short time to expose the newly deployed sitemap.
    last_error = None
    for attempt in range(1, 5):
        try:
            raise SystemExit(main())
        except (OSError, ET.ParseError, RuntimeError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt < 4:
                print(f"IndexNow attempt {attempt} did not succeed: {exc}")
                time.sleep(10)
    raise SystemExit(f"IndexNow submission was not confirmed: {last_error}")
