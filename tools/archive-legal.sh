#!/bin/bash
# Zapisuje migawkę dokumentu prawnego przed jego zmianą.
#
#   ./tools/archive-legal.sh pl privacy
#   ./tools/archive-legal.sh pl terms
#
# Repo nie trzyma historii commitów (jeden "Initial Commit"), więc poprzednie
# wersje dokumentów muszą istnieć jako osobne pliki. Migawka bierze datę
# z pola "Ostatnia aktualizacja" w żywym dokumencie i ląduje w
# legal/<lang>/archiwum/<doc>-<data>.html z noindex i banerem.

set -euo pipefail
cd "$(dirname "$0")/.."

lang="${1:-}"; doc="${2:-}"
[ -n "$lang" ] && [ -n "$doc" ] || { echo "użycie: $0 <lang> <privacy|terms>" >&2; exit 1; }

live="legal/$lang/$doc.html"
[ -f "$live" ] || { echo "brak pliku: $live" >&2; exit 1; }

# data z żywego dokumentu
date_str=$(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' "$live" | head -1)
[ -n "$date_str" ] || { echo "nie znalazłem daty aktualizacji w $live" >&2; exit 1; }

mkdir -p "legal/$lang/archiwum"
out="legal/$lang/archiwum/$doc-$date_str.html"

if [ -f "$out" ]; then
  echo "migawka już istnieje: $out"
  exit 0
fi

python3 - "$live" "$out" "$date_str" "$lang" "$doc" <<'PY'
import sys, re
live, out, date_str, lang, doc = sys.argv[1:6]
s = open(live, encoding="utf-8").read()

# archiwum nie ma konkurować z aktualną wersją w wyszukiwarce
s = re.sub(r'<meta name="robots"[^>]*>',
           '<meta name="robots" content="noindex,follow" />', s)
# Canonical wskazuje na SAM plik archiwalny, nie na wersję aktualną.
# noindex + canonical na inną stronę to kombinacja, przed którą ostrzega Google:
# sygnał "noindex" potrafi przejść po canonicalu i wypisać z indeksu cel.
s = re.sub(r'(<link rel="canonical" href=")[^"]+(")',
           r'\g<1>https://payment-calendar.app/legal/%s/archiwum/%s-%s.html\g<2>'
           % (lang, doc, date_str), s)
# hreflang w archiwum nie ma sensu
s = re.sub(r'\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" />', '', s)

banner = ('<p class="legal-archived">Archiwalna wersja z %s. '
          '<a href="/legal/%s/%s.html">Zobacz wersję aktualną</a> · '
          '<a href="/legal/%s/historia.html">Wszystkie wersje</a></p>') % (date_str, lang, doc, lang)
anchor = '<h1>'
assert anchor in s, "brak <h1> w dokumencie"
s = s.replace(anchor, banner + "\n    " + anchor, 1)

open(out, "w", encoding="utf-8").write(s)
print("zapisano migawkę: " + out)
PY
