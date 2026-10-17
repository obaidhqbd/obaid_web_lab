#!/usr/bin/env python3
"""Build a resilient searchable catalogue from content folders. Standard library only."""
from __future__ import annotations
import argparse, html, json, os, re, shutil, sys, zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"; CLASSES=ROOT/"content"/"classes"; BLOGS=ROOT/"content"/"blogs"; GENERATED=ROOT/"generated-content"; DOWNLOADS=ROOT/"downloads"
SCHEMA=1
META={"metadata.json","class.json","course.json","blog.json","_meta.json","manifest.json"}
OVERVIEWS=("README.md","readme.md","index.md","about.md","index.html","main.html","build.html")
TEXT_EXT={".md",".markdown",".html",".htm",".txt"}
IGNORED={".ds_store","thumbs.db",".gitkeep"}|META
MAX_FILES=1500; MAX_BYTES=100*1024*1024

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
def pretty(value):
    value=re.sub(r"[_-]+"," ",str(value)).strip(); value=re.sub(r"\s+"," ",value)
    return value[:1].upper()+value[1:] if value else "Untitled resource"
def slug(value):
    value=re.sub(r"\.[^.]+$","",str(value).casefold())
    return re.sub(r"[^a-z0-9]+","-",value).strip("-")[:90] or "resource"
def rel(path):
    return path.relative_to(ROOT).as_posix()
def read_text(path,limit=500_000):
    try:
        with path.open("r",encoding="utf-8-sig",errors="replace") as f: return f.read(limit)
    except OSError: return ""
def read_json(path):
    try:
        val=json.loads(read_text(path,1_000_000)); return val if isinstance(val,dict) else {}
    except (ValueError,TypeError): return {}
def front_matter(text):
    m=re.match(r"\A---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|$)",text,re.S)
    if not m: return {},text
    fields={}
    for line in m.group(1).splitlines():
        pair=re.match(r"^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$",line)
        if pair: fields[pair.group(1).lower().replace("-","_")]=pair.group(2).strip().strip('"').strip("'")
    return fields,text[m.end():]
def heading(text):
    for line in text.splitlines():
        m=re.match(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$",line)
        if m and m.group(1).strip(): return m.group(1).strip()[:180]
    return ""
def excerpt(text):
    _,text=front_matter(text)
    text=re.sub(r"\x60{3}[\s\S]*?\x60{3}"," ",text)
    text=re.sub(r"!\[[^\]]*]\([^)]*\)"," ",text)
    text=re.sub(r"\[([^\]]+)]\([^)]*\)",r"\1",text)
    text=re.sub(r"<[^>]+>"," ",text)
    text=re.sub(r"[#>*_\x60~-]+"," ",text)
    for para in re.split(r"\n\s*\n",text):
        para=re.sub(r"\s+"," ",para).strip()
        if para and not para.startswith("---"): return para[:260]+("…" if len(para)>260 else "")
    return ""
def overview(folder):
    for name in OVERVIEWS:
        path=folder/name
        if path.is_file(): return path
    try: candidates=sorted((p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in TEXT_EXT and p.name.casefold() not in IGNORED),key=lambda p:p.name.casefold())
    except OSError: candidates=[]
    return candidates[0] if candidates else None
def metadata(folder,primary):
    meta={}
    for name in ("metadata.json","class.json","course.json","blog.json","_meta.json"):
        p=folder/name
        if p.is_file():
            meta=read_json(p)
            if meta: break
    source=read_text(primary) if primary else ""
    front,body=front_matter(source) if source else ({}, "")
    result=dict(front); result.update(meta)
    return result,body or source
def tags(value):
    parts=re.split(r"[,;|]",value) if isinstance(value,str) else value if isinstance(value,list) else []
    result=[]
    for part in parts:
        value=str(part).strip()
        if value and value.casefold() not in {x.casefold() for x in result}: result.append(value[:60])
    return result[:12]
def title_desc(meta,fallback,primary,body):
    title=str(meta.get("title") or "").strip()
    if not title and primary and primary.suffix.lower() in {".md",".markdown",".txt"}: title=heading(read_text(primary))
    if not title and primary and primary.suffix.lower() in {".html",".htm"}:
        m=re.search(r"<title[^>]*>(.*?)</title>",read_text(primary,100_000),re.I|re.S)
        if m: title=html.unescape(re.sub(r"\s+"," ",m.group(1))).strip()
    desc=str(meta.get("description") or meta.get("summary") or "").strip() or excerpt(body)
    if not desc and primary and primary.suffix.lower() in {".html",".htm"}:
        m=re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',read_text(primary,100_000),re.I)
        if m: desc=html.unescape(m.group(1)).strip()
    return (title or pretty(fallback))[:180],(desc or "Explore the learning materials in this collection.")[:320]
def file_kind(path):
    ext=path.suffix.lower()
    if ext in {".md",".markdown"}: return "markdown"
    if ext in {".html",".htm"}: return "html"
    if ext in {".png",".jpg",".jpeg",".gif",".webp",".svg"}: return "image"
    if ext==".pdf": return "pdf"
    if ext in {".css",".js",".json",".py",".xml",".yml",".yaml",".ts",".tsx",".jsx",".java",".c",".cpp",".sql",".sh"}: return "code"
    if ext in {".txt",".csv"}: return "text"
    return "file"
def file_records(folder,recursive=True):
    try:
        paths=(p for p in (folder.rglob("*") if recursive else folder.iterdir()) if p.is_file() and not p.is_symlink())
        paths=sorted(paths,key=lambda p:p.as_posix().casefold())
    except OSError: paths=[]
    out=[]
    for p in paths:
        try: parts=p.relative_to(folder).parts; size=p.stat().st_size
        except OSError: continue
        if any(x.startswith(".") for x in parts) or p.name.casefold() in IGNORED or p.suffix.lower()==".zip": continue
        out.append({"title":pretty(p.stem),"path":rel(p),"ext":p.suffix.lower().lstrip("."),"kind":file_kind(p),"size":size,
                    "sizeLabel":f"{size} B" if size<1024 else f"{size/1024:.0f} KB" if size<1024*1024 else f"{size/(1024*1024):.1f} MB","primary":False})
    chosen=overview(folder)
    for item in out:
        if chosen and item["path"]==rel(chosen): item["primary"]=True
    if out and not any(x["primary"] for x in out): out[0]["primary"]=True
    return out
def extract_zip(archive,kind):
    target=GENERATED/kind/slug(archive.stem); resolved=target.resolve(); total=0; count=0
    with zipfile.ZipFile(archive) as zf:
        infos=zf.infolist()
        if len(infos)>MAX_FILES: raise ValueError("Too many archive entries")
        target.mkdir(parents=True,exist_ok=True)
        for info in infos:
            name=info.filename.replace("\\","/"); member=PurePosixPath(name)
            if member.is_absolute() or ".." in member.parts or any(x.startswith(".") for x in member.parts) or info.is_dir(): continue
            if info.file_size>25*1024*1024: continue
            total+=info.file_size; count+=1
            if total>MAX_BYTES or count>MAX_FILES: raise ValueError("Archive exceeds extraction limits")
            dest=(target/Path(*member.parts)).resolve()
            if dest!=resolved and resolved not in dest.parents: continue
            dest.parent.mkdir(parents=True,exist_ok=True)
            with zf.open(info) as src,dest.open("wb") as dst: shutil.copyfileobj(src,dst)
    return target
def unique_id(value,used):
    base=slug(value); candidate=base; n=2
    while candidate in used: candidate=f"{base}-{n}"; n+=1
    used.add(candidate); return candidate
def make_item(folder,source_path,default,kind,used,errors,files_override=None,subtopics=True):
    try:
        primary=overview(folder); meta,body=metadata(folder,primary); title,desc=title_desc(meta,folder.name,primary,body)
        files=files_override if files_override is not None else file_records(folder)
        if not files: errors.append(f"{source_path}: no readable files were found")
        primary_path=rel(primary) if primary else (files[0]["path"] if files else "")
        entry={"id":unique_id(source_path,used),"title":title,"description":desc,"category":str(meta.get("category") or meta.get("subject") or default)[:80],
               "tags":tags(meta.get("tags") or meta.get("keywords")),"date":str(meta.get("date") or meta.get("updated") or "")[:30],
               "files":files,"fileCount":len(files),"sourcePath":source_path}
        if kind=="blog":
            if not primary_path: return None
            entry["bodyPath"]=primary_path; entry["readingMinutes"]=max(1,round(len(body.split())/200))
        else:
            sub=[]
            if subtopics:
                try: children=sorted((p for p in folder.iterdir() if p.is_dir() and not p.name.startswith(".") and not p.is_symlink()),key=lambda p:p.name.casefold())
                except OSError: children=[]
                for child in children:
                    cf=file_records(child)
                    if not cf: continue
                    co=overview(child)
                    sub.append({"title":pretty(child.name),"path":rel(child),"overviewPath":rel(co) if co else "","firstFile":cf[0]["path"],"fileCount":len(cf)})
            entry["subtopics"]=sub
        return entry
    except Exception as exc:
        errors.append(f"{source_path}: skipped after a content error ({type(exc).__name__})")
        print(f"WARNING: {source_path}: {exc}",file=sys.stderr); return None
def scan_classes(errors,used):
    CLASSES.mkdir(parents=True,exist_ok=True); out=[]
    for folder in sorted((p for p in CLASSES.iterdir() if p.is_dir() and not p.name.startswith(".") and not p.is_symlink()),key=lambda p:p.name.casefold()):
        item=make_item(folder,rel(folder),"Web Development","class",used,errors)
        if item: out.append(item)
    loose=[p for p in CLASSES.iterdir() if p.is_file() and not p.name.startswith(".") and p.name.casefold() not in IGNORED and p.suffix.lower()!=".zip"]
    if loose:
        files=file_records(CLASSES,recursive=False)
        item=make_item(CLASSES,rel(CLASSES/"class-materials"),"Class materials","class",used,errors,files_override=files,subtopics=False)
        if item: item["sourcePath"]=rel(CLASSES); out.append(item)
    for z in sorted(CLASSES.rglob("*.zip"),key=lambda p:p.as_posix().casefold()):
        try:
            folder=extract_zip(z,"classes"); item=make_item(folder,rel(z),"Web Development","class",used,errors)
            if item:
                if item["title"]==pretty(folder.name): item["title"]=pretty(z.stem)
                item["sourcePath"]=rel(z); out.append(item)
        except Exception as exc: errors.append(f"{rel(z)}: archive skipped ({type(exc).__name__})")
    return out
def scan_blogs(errors,used):
    BLOGS.mkdir(parents=True,exist_ok=True); out=[]
    for folder in sorted((p for p in BLOGS.iterdir() if p.is_dir() and not p.name.startswith(".") and not p.is_symlink()),key=lambda p:p.name.casefold()):
        item=make_item(folder,rel(folder),"Study Notes","blog",used,errors)
        if item: out.append(item)
    for p in sorted(BLOGS.iterdir(),key=lambda p:p.name.casefold()):
        if not p.is_file() or p.name.startswith(".") or p.name.casefold() in IGNORED or p.suffix.lower() not in TEXT_EXT: continue
        try:
            source=read_text(p); meta,body=front_matter(source); title,desc=title_desc(meta,p.stem,p,body); size=p.stat().st_size; path=rel(p)
            out.append({"id":unique_id(path,used),"title":title,"description":desc,"category":str(meta.get("category") or "Study Notes")[:80],
              "tags":tags(meta.get("tags") or meta.get("keywords")),"date":str(meta.get("date") or "")[:30],
              "files":[{"title":pretty(p.stem),"path":path,"ext":p.suffix.lower().lstrip("."),"kind":file_kind(p),"size":size,"sizeLabel":f"{size} B","primary":True}],
              "fileCount":1,"sourcePath":path,"bodyPath":path,"readingMinutes":max(1,round(len(body.split())/200))})
        except Exception as exc: errors.append(f"{rel(p)}: note skipped ({type(exc).__name__})")
    for z in sorted(BLOGS.rglob("*.zip"),key=lambda p:p.as_posix().casefold()):
        try:
            folder=extract_zip(z,"blogs"); item=make_item(folder,rel(z),"Study Notes","blog",used,errors)
            if item:
                if item["title"]==pretty(folder.name): item["title"]=pretty(z.stem)
                item["sourcePath"]=rel(z); out.append(item)
        except Exception as exc: errors.append(f"{rel(z)}: archive skipped ({type(exc).__name__})")
    return out
def create_class_archives(classes,errors):
    archive_dir=DOWNLOADS/"classes"
    archive_dir.mkdir(parents=True,exist_ok=True)
    for old in archive_dir.glob("*.zip"):
        try: old.unlink()
        except OSError: pass
    root_resolved=ROOT.resolve()
    for item in classes:
        paths=[]
        for record in item.get("files",[]):
            value=record.get("path","")
            if not value or Path(value).is_absolute() or ".." in Path(value).parts: continue
            try:
                path=(ROOT/value).resolve()
                if path.is_file() and not path.is_symlink() and (path==root_resolved or root_resolved in path.parents):
                    paths.append(path)
            except OSError: continue
        # Keep each class download independent so extracting it never mixes files with another class.
        unique={p.as_posix():p for p in paths}
        paths=sorted(unique.values(),key=lambda p:p.as_posix().casefold())
        if not paths:
            errors.append(f"{item.get('sourcePath',item.get('id','class'))}: no ZIP download could be built")
            continue
        try:
            common=Path(os.path.commonpath([str(path.parent) for path in paths]))
            archive_name=slug(item.get("id") or item.get("title") or "class")+".zip"
            destination=archive_dir/archive_name
            prefix=slug(item.get("title") or item.get("id") or "class")
            with zipfile.ZipFile(destination,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
                for path in paths:
                    try: relative=path.relative_to(common)
                    except ValueError: relative=Path(path.name)
                    member=PurePosixPath(prefix,*relative.parts).as_posix()
                    archive.write(path,arcname=member)
            item["downloadUrl"]="downloads/classes/"+archive_name
            item["downloadSize"]=destination.stat().st_size
        except Exception as exc:
            errors.append(f"{item.get('sourcePath',item.get('id','class'))}: ZIP download failed ({type(exc).__name__})")
            print(f"WARNING: ZIP creation failed for {item.get('title','class')}: {exc}",file=sys.stderr)
            try:
                if 'destination' in locals() and destination.exists(): destination.unlink()
            except OSError: pass

def valid_catalog(path):
    try:
        value=json.loads(path.read_text(encoding="utf-8"))
        return value if value.get("schemaVersion")==SCHEMA and isinstance(value.get("classes"),list) and isinstance(value.get("blogs"),list) else None
    except (OSError,ValueError,AttributeError): return None
def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); tmp.replace(path)
def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--check",action="store_true"); args=parser.parse_args()
    DATA.mkdir(parents=True,exist_ok=True); CLASSES.mkdir(parents=True,exist_ok=True); BLOGS.mkdir(parents=True,exist_ok=True)
    try:
        if GENERATED.exists(): shutil.rmtree(GENERATED)
        GENERATED.mkdir(parents=True,exist_ok=True)
    except OSError as exc: print(f"WARNING: generated archive cleanup failed: {exc}",file=sys.stderr)
    current=valid_catalog(DATA/"catalog.json")
    existing_backup=valid_catalog(DATA/"catalog.backup.json")
    previous=current or existing_backup or valid_catalog(DATA/"catalog.seed.json")
    errors=[]; used=set()
    try: classes=scan_classes(errors,used)
    except Exception as exc: classes=[]; errors.append(f"class scan recovered ({type(exc).__name__})")
    try: blogs=scan_blogs(errors,used)
    except Exception as exc: blogs=[]; errors.append(f"blog scan recovered ({type(exc).__name__})")
    create_class_archives(classes,errors)
    generated_at=now()
    # Retain timestamps when content has not changed; this keeps automation commits quiet.
    if current and current.get("classes")==classes and current.get("blogs")==blogs:
        generated_at=current.get("generatedAt") or generated_at
    data={"schemaVersion":SCHEMA,"generatedAt":generated_at,"classes":sorted(classes,key=lambda x:x["title"].casefold()),
          "blogs":sorted(blogs,key=lambda x:x["title"].casefold()),
          "meta":{"totalFiles":sum(len(x.get("files",[])) for x in classes+blogs),"errors":errors[:100]}}
    if current and (current.get("classes")!=data["classes"] or current.get("blogs")!=data["blogs"]):
        write_json(DATA/"catalog.backup.json",current)
    elif existing_backup:
        # Keep the last-known-good published snapshot until there is a new content revision.
        write_json(DATA/"catalog.backup.json",existing_backup)
    elif previous:
        write_json(DATA/"catalog.backup.json",previous)
    else:
        write_json(DATA/"catalog.backup.json",data)
    write_json(DATA/"catalog.json",data)
    if not valid_catalog(DATA/"catalog.json"): print("ERROR: catalogue validation failed",file=sys.stderr); return 1
    missing=[item.get("title","class") for item in classes if not item.get("downloadUrl") or not (ROOT/item["downloadUrl"]).is_file()]
    if missing:
        print("ERROR: ZIP downloads are missing: "+", ".join(missing),file=sys.stderr); return 1
    print(f"Catalogue built: {len(classes)} classes, {len(blogs)} notes, {data['meta']['totalFiles']} files, {len(errors)} warnings.")
    return 0
if __name__=="__main__": raise SystemExit(main())
