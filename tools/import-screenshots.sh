#!/bin/bash
# Import zrzutów 2.5.0 (iPhone / Duo / iPad, 5 ekranów na język) z folderów
# na pulpicie prosto do AVIF + JPEG. PNG nie trafiają do repozytorium.
#
#   ./tools/import-screenshots.sh PL            # jedna lokalizacja
#   ./tools/import-screenshots.sh PL ENG DE     # kilka
#   ./tools/import-screenshots.sh --all         # wszystkie
#
# Źródło: pliki <KOD><1-5>.png w trzech folderach (zmień zmienne niżej, jeśli
# folder nazywa się inaczej). Kody źródłowe różnią się od nazw katalogów na
# stronie (ES->ESP, UK->UA, PT->PT-BR, ZH->ZH-HANS) - mapowanie w map_loc.
#
# Kodowanie idzie przez tools/encode-screenshot.swift (bez metadanych źródła).
# Wysokości dobrane jak w optimize-images.sh: kafelek ma max 520 px wysokości,
# a ekran 2x/3x potrzebuje 2-3x tyle. Szerokość wyniku MUSI być parzysta:
# AVIF o nieparzystej szerokości (np. 1387) zapisany przez ImageIO nie
# dekoduje się w Chrome, a JPEG obok działa - błąd widać dopiero w przeglądarce.

set -euo pipefail
cd "$(dirname "$0")/.."

DESK="$HOME/Desktop"
SRC_IOS="$DESK/iPhone – wszystkie języki (1206x2622)"
SRC_DUO="$DESK/DUO – wszystkie języki"
SRC_IPAD="$DESK/iPad – wszystkie języki (2752x2064)"

IMG=assets/images
IOS_HEIGHT=1792    # 1206x2622 -> 824x1792
DUO_HEIGHT=1000    # 2853x2007 -> 1421x1000
IPAD_HEIGHT=1038   # 2752x2064 -> 1384x1038 (poziomo)

map_loc() {  # kod źródłowy -> katalog na stronie
  case "$1" in
    ES) echo ESP ;; UK) echo UA ;; PT) echo PT-BR ;; ZH) echo ZH-HANS ;; *) echo "$1" ;;
  esac
}

if [ "${1:-}" = "--all" ]; then
  set -- PL ENG DE ES FR IT JA SV PT UK ZH
fi
[ $# -gt 0 ] || { echo "użycie: $0 <KOD...> | --all" >&2; exit 1; }

for code in "$@"; do
  loc=$(map_loc "$code")
  for spec in "iOS|$SRC_IOS|$IOS_HEIGHT" "Duo|$SRC_DUO|$DUO_HEIGHT" "iPadOS|$SRC_IPAD|$IPAD_HEIGHT"; do
    IFS='|' read -r platform src height <<< "$spec"
    out="$IMG/$platform/$loc"
    mkdir -p "$out"
    rm -f "$out"/*.avif "$out"/*.jpg     # stary zestaw (6 ekranów) znika
    for i in 1 2 3 4 5; do
      png="$src/$code$i.png"
      [ -e "$png" ] || { echo "BRAK: $png" >&2; exit 1; }
      size=$(swift tools/encode-screenshot.swift "$png" "$height" "$out/$i")
      printf "  %-22s %s\n" "$platform/$loc/$i" "$size"
      [ $(( ${size%x*} % 2 )) -eq 0 ] || { echo "nieparzysta szerokość: $size ($png)" >&2; exit 1; }
    done
  done
done

echo
echo "kontrola metadanych w wyniku:"
leak=0
for f in $(find "$IMG" \( -name "*.avif" -o -name "*.jpg" \) -not -path "*/og/*"); do
  if sips -g software -g artist "$f" 2>/dev/null | grep -qE "software: [^<]|artist: [^<]"; then
    echo "  WYCIEK: $f"; leak=1
  fi
done
[ $leak -eq 0 ] && echo "  czysto"
