#!/usr/bin/env python3
"""Fast checks for the published static site and generated catalogue."""
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
errors=[]
for name in ("index.html","privacy.html","styles.css","analytics.js","app.js","class-editor.js","data/catalog.seed.json"):
    if not (ROOT/name).is_file(): errors.append("Required file missing: "+name)
try: page=(ROOT/"index.html").read_text(encoding="utf-8")
except OSError: page=""
for needle in ('href="styles.css"','src="analytics.js"','src="app.js"','src="class-editor.js"','href="privacy.html"','id="analytics-consent"','id="resource-grid"','id="search-input"','id="detail-main'):
    if needle not in page: errors.append("index.html is missing "+needle)
try:
    catalog=json.loads((ROOT/"data/catalog.json").read_text(encoding="utf-8"))
    if catalog.get("schemaVersion")!=1: errors.append("Unexpected catalogue schema")
    if not isinstance(catalog.get("classes"),list) or not isinstance(catalog.get("blogs"),list): errors.append("Catalogue resource lists are invalid")
    identifiers=set()
    for group in ("classes","blogs"):
        for resource in catalog.get(group,[]):
            identity=resource.get("id","")
            if not identity: errors.append("Resource ID is missing")
            elif identity in identifiers: errors.append("Duplicate resource ID: "+identity)
            identifiers.add(identity)
            if not resource.get("title"): errors.append("Resource title is missing: "+str(identity))
            for entry in resource.get("files",[]):
                path=entry.get("path","")
                if not path or path.startswith("/") or ".." in Path(path).parts:
                    errors.append("Unsafe resource path: "+str(path)); continue
                if not (ROOT/path).is_file(): errors.append("Indexed file does not exist: "+path)
            body=resource.get("bodyPath")
            if body and not (ROOT/body).is_file(): errors.append("Article file does not exist: "+str(body))
            download=resource.get("downloadUrl")
            if download:
                if download.startswith("/") or ".." in Path(download).parts: errors.append("Unsafe download path: "+str(download))
                elif not (ROOT/download).is_file(): errors.append("Download artifact is missing: "+str(download))
            elif group=="classes": errors.append("Class ZIP download URL is missing: "+str(identity))
except (OSError,ValueError,AttributeError) as exc:
    errors.append("Could not validate generated catalogue: "+str(exc))
if errors:
    print("Site check failed:")
    for err in errors: print(" - "+err)
    sys.exit(1)
print("Site check passed: required assets, catalogue schema and indexed file paths are valid.")
