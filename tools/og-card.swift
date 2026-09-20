// Generator karty Open Graph 1200x630.
//   swift tools/og-card.swift <ikona> <zrzut> <tytul> <podtytul> <wyjscie.jpg>
//
// Uklad wspolrzednych AppKit ma y skierowane w gore, a tekst rysuje sie
// od GORNEJ krawedzi podanego prostokata w dol - stad helper `text`,
// ktory przyjmuje odleglosc od gornej krawedzi plotna.
import AppKit

let a = CommandLine.arguments
guard a.count == 6 else { fputs("uzycie: og-card <ikona> <zrzut> <tytul> <podtytul> <wyjscie>\n", stderr); exit(1) }
let (iconPath, shotPath, title, subtitle, outPath) = (a[1], a[2], a[3], a[4], a[5])

let W = 1200.0, H = 630.0
let pad = 78.0, colW = 620.0

let img = NSImage(size: NSSize(width: W, height: H))
img.lockFocus()
guard let ctx = NSGraphicsContext.current?.cgContext else { exit(1) }

ctx.setFillColor(NSColor(srgbRed: 0.059, green: 0.078, blue: 0.090, alpha: 1).cgColor)
ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))

func glow(_ cx: Double, _ cy: Double, _ r: Double, _ c: NSColor) {
    let sp = CGColorSpaceCreateDeviceRGB()
    let g = CGGradient(colorsSpace: sp,
        colors: [c.cgColor, c.withAlphaComponent(0).cgColor] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(g, startCenter: CGPoint(x: cx, y: cy), startRadius: 0,
        endCenter: CGPoint(x: cx, y: cy), endRadius: r, options: [])
}
glow(120, H + 60, 640, NSColor(srgbRed: 0.596, green: 0.788, blue: 0.282, alpha: 0.26))
glow(W - 180, -40, 560, NSColor(srgbRed: 0.953, green: 0.788, blue: 0.412, alpha: 0.14))

// --- zrzut po prawej, przyciety u dolu ---
if let shot = NSImage(contentsOfFile: shotPath) {
    let sw = 322.0, sh = sw * (shot.size.height / shot.size.width)
    // kadr od gory zrzutu; dol (z podpisem App Store) schodzi poza plotno
    let rect = CGRect(x: W - pad - sw, y: H - 34 - sh, width: sw, height: sh)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: -14, height: -20), blur: 46,
                  color: NSColor.black.withAlphaComponent(0.6).cgColor)
    ctx.beginPath()
    ctx.addPath(CGPath(roundedRect: rect, cornerWidth: 30, cornerHeight: 30, transform: nil))
    ctx.setFillColor(NSColor.black.cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.beginPath()
    ctx.addPath(CGPath(roundedRect: rect, cornerWidth: 30, cornerHeight: 30, transform: nil))
    ctx.clip()
    shot.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1.0)
    ctx.restoreGState()

    ctx.setStrokeColor(NSColor.white.withAlphaComponent(0.10).cgColor)
    ctx.setLineWidth(1.5)
    ctx.beginPath()
    ctx.addPath(CGPath(roundedRect: rect, cornerWidth: 30, cornerHeight: 30, transform: nil))
    ctx.strokePath()
}

// --- ikona ---
if let icon = NSImage(contentsOfFile: iconPath) {
    let s = 84.0, rect = CGRect(x: pad, y: H - pad - s, width: s, height: s)
    ctx.saveGState()
    ctx.beginPath()
    ctx.addPath(CGPath(roundedRect: rect, cornerWidth: 19, cornerHeight: 19, transform: nil))
    ctx.clip()
    icon.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1.0)
    ctx.restoreGState()
}

// rysuje blok tekstu tak, by jego GORA byla `fromTop` pikseli od gory plotna;
// zwraca odleglosc od gory do dolnej krawedzi bloku
@discardableResult
func text(_ s: String, fromTop: Double, size: Double, weight: NSFont.Weight,
          color: NSColor, width: Double, tracking: Double = 0) -> Double {
    let p = NSMutableParagraphStyle()
    p.lineBreakMode = .byWordWrapping
    p.lineHeightMultiple = 1.08
    var at: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color, .paragraphStyle: p]
    if tracking != 0 { at[.kern] = tracking }
    let str = NSAttributedString(string: s, attributes: at)
    let h = ceil(str.boundingRect(with: NSSize(width: width, height: 600),
                                  options: [.usesLineFragmentOrigin]).height)
    str.draw(with: CGRect(x: pad, y: H - fromTop - h, width: width, height: h),
             options: [.usesLineFragmentOrigin], context: nil)
    return fromTop + h
}

var y = text("PAYMENT CALENDAR", fromTop: pad + 100, size: 20, weight: .semibold,
             color: NSColor(srgbRed: 0.72, green: 0.89, blue: 0.36, alpha: 1),
             width: colW, tracking: 2.4)
y = text(title, fromTop: y + 22, size: 56, weight: .bold, color: .white, width: colW)
_ = text(subtitle, fromTop: y + 22, size: 25, weight: .regular,
         color: NSColor(srgbRed: 0.72, green: 0.75, blue: 0.78, alpha: 1), width: colW - 40)

img.unlockFocus()

guard let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
      let jpg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.9])
else { fputs("blad kodowania\n", stderr); exit(1) }
try! jpg.write(to: URL(fileURLWithPath: outPath))
