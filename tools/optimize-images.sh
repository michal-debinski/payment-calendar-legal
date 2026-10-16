#!/bin/bash
# Konwersja zrzutów ekranu PNG -> AVIF + JPEG (zapas).
# Oryginalne PNG zostają nietknięte.
#
#   ./tools/optimize-images.sh PL          # jedna lokalizacja
#   ./tools/optimize-images.sh PL ENG DE   # kilka
#   ./tools/optimize-images.sh --all       # wszystkie
#
# Kodowanie idzie przez tools/encode-screenshot.swift, a nie przez sips,
# bo sips przenosi do wyniku metadane EXIF/TIFF z oryginału - w tym
# identyfikatory dokumentu i konta z Canvy, które nie mają czego szukać
# na publicznej stronie.
#
# Docelowa wysokość jest dobrana z zapasem ponad to, czego potrzebuje
# ekran 3x: kafelek ma max 520 px wysokości, iPhone 3x potrzebuje 720x1560.

set -euo pipefail
cd "$(dirname "$0")/.."

IMG=assets/images
IOS_HEIGHT=1792    # 1242x2688 -> 828x1792
IPAD_HEIGHT=1244   # 2048x2732 -> 932x1244

if [ "${1:-}" = "--all" ]; then
  set -- $(ls "$IMG/iOS")
fi
[ $# -gt 0 ] || { echo "użycie: $0 <LOKALIZACJA...> | --all" >&2; exit 1; }

before=0; after=0

for loc in "$@"; do
  for platform in iOS iPadOS; do
    dir="$IMG/$platform/$loc"
    [ -d "$dir" ] || { echo "pomijam $dir (brak)"; continue; }
    [ "$platform" = "iOS" ] && height=$IOS_HEIGHT || height=$IPAD_HEIGHT

    for png in "$dir"/*.png; do
      [ -e "$png" ] || continue
      base="${png%.png}"
      size=$(swift tools/encode-screenshot.swift "$png" "$height" "$base")
      before=$((before + $(stat -f%z "$png")))
      after=$((after + $(stat -f%z "$base.avif")))
      printf "  %-42s %5s KB -> %4s KB  (%s)\n" "${png#$IMG/}" \
        "$(($(stat -f%z "$png")/1024))" "$(($(stat -f%z "$base.avif")/1024))" "$size"
    done
  done
done

echo
printf "PNG:  %6s KB\nAVIF: %6s KB  (%d%% mniej)\n" \
  "$((before/1024))" "$((after/1024))" "$(( 100 - after*100/before ))"

echo
echo "kontrola metadanych w wyniku:"
leak=0
for f in $(find "$IMG" -name "*.avif" -o -name "*.jpg" | head -200); do
  if sips -g software -g artist "$f" 2>/dev/null | grep -qE "software: [^<]|artist: [^<]"; then
    echo "  WYCIEK: $f"; leak=1
  fi
done
[ "$leak" = 0 ] && echo "  czysto - żaden plik nie niesie metadanych źródła"
