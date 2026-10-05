#!/usr/bin/env python3
"""Monta review/dailyflow-review.html (arquivo único) a partir de review/src/.

Uso: python3 review/build.py [--fragment SAIDA]
  --fragment  também gera a versão sem <!doctype>/<html>/<body> usada para publicar como artifact.
"""
import base64, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
ICON = ROOT.parent / "design" / "assets" / "dailyflow-icon.webp"


def icon_data_uri() -> str:
    import re, shutil
    if not shutil.which("sips"):
        # Off macOS: reuse the icon already embedded in the last build.
        built = ROOT / "dailyflow-review.html"
        m = re.search(r"data:image/png;base64,[A-Za-z0-9+/=]+", built.read_text()) if built.exists() else None
        if m:
            return m.group(0)
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "icon.png"
        subprocess.run(["sips", "-s", "format", "png", "-z", "96", "96", str(ICON), "--out", str(out)],
                       check=True, capture_output=True)
        return "data:image/png;base64," + base64.b64encode(out.read_bytes()).decode()


def fragment() -> str:
    html = (SRC / "template.html").read_text()
    html = html.replace("/*__CSS__*/", (SRC / "styles.css").read_text())
    html = html.replace("/*__WFCSS__*/", (SRC / "wireframes.css").read_text())
    html = html.replace("/*__CONTENT__*/", (SRC / "content.js").read_text())
    html = html.replace("/*__WF__*/", (SRC / "wireframes.js").read_text())
    html = html.replace("/*__STAGES__*/", (SRC / "stages.js").read_text())
    html = html.replace("/*__APP__*/", (SRC / "app.js").read_text())
    return html.replace("__ICON__", icon_data_uri())


def main() -> None:
    frag = fragment()
    head, _, body = frag.partition('<div class="app">')
    full = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'{head}</head>\n<body>\n<div class="app">{body}</body>\n</html>\n')
    out = ROOT / "dailyflow-review.html"
    out.write_text(full)
    print(f"{out} ({len(full) // 1024} KB)")
    if "--fragment" in sys.argv:
        dest = pathlib.Path(sys.argv[sys.argv.index("--fragment") + 1])
        dest.write_text(frag)
        print(f"{dest} ({len(frag) // 1024} KB)")


if __name__ == "__main__":
    main()
