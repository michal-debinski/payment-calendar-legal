// Skaluje zrzut i zapisuje AVIF + JPEG BEZ metadanych zrodla.
//
//   swift tools/encode-screenshot.swift <zrodlo.png> <docelowa-wysokosc> <wyjscie-bez-rozszerzenia>
//
// sips przenosi do wyniku pola EXIF/TIFF z oryginalu - w naszym wypadku
// identyfikatory dokumentu, uzytkownika i marki z Canvy, ktore trafialyby
// na publiczna strone. ImageIO pozwala zbudowac plik od zera, wiec
// do wyniku idzie wylacznie obraz i profil kolorow.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count == 4, let targetH = Double(a[2]) else {
    FileHandle.standardError.write("uzycie: encode-screenshot <zrodlo> <wysokosc> <wyjscie>\n".data(using: .utf8)!)
    exit(1)
}
let srcURL = URL(fileURLWithPath: a[1])
let outBase = a[3]

guard let src = CGImageSourceCreateWithURL(srcURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(src, 0, [kCGImageSourceShouldCache: false] as CFDictionary)
else { FileHandle.standardError.write("nie moge odczytac \(a[1])\n".data(using: .utf8)!); exit(1) }

let scale = targetH / Double(image.height)
let w = Int((Double(image.width) * scale).rounded())
let h = Int(targetH)

guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpace(name: CGColorSpace.sRGB)!,
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
else { FileHandle.standardError.write("nie moge utworzyc kontekstu\n".data(using: .utf8)!); exit(1) }
ctx.interpolationQuality = .high
ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
guard let scaled = ctx.makeImage() else { exit(1) }

func write(_ type: UTType, _ path: String, quality: Double) -> Bool {
    guard let dest = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: path) as CFURL, type.identifier as CFString, 1, nil) else { return false }
    // swiadomie NIE kopiujemy wlasciwosci zrodla - tylko jakosc kompresji
    let props: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: quality]
    CGImageDestinationAddImage(dest, scaled, props as CFDictionary)
    return CGImageDestinationFinalize(dest)
}

guard write(UTType.init(filenameExtension: "avif") ?? .image, outBase + ".avif", quality: 0.62),
      write(.jpeg, outBase + ".jpg", quality: 0.72)
else { FileHandle.standardError.write("blad zapisu\n".data(using: .utf8)!); exit(1) }

print("\(w)x\(h)")
