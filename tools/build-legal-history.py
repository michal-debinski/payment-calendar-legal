#!/usr/bin/env python3
"""Buduje stronę z historią wersji dokumentów prawnych.

    python3 tools/build-legal-history.py pl

Skanuje legal/<lang>/archiwum/ oraz żywe dokumenty i składa legal/<lang>/historia.html.
Dzięki temu lista wersji nigdy nie rozjedzie się z tym, co faktycznie leży w repo.
"""
import os, re, sys, glob

LANGS = {
    "pl": dict(lang="pl", locale="pl_PL", title="Historia wersji dokumentów",
        desc="Wszystkie wersje Polityki prywatności i Warunków korzystania Payment Calendar, z datami obowiązywania.",
        intro="Zachowujemy każdą poprzednią wersję dokumentów, żeby było jasne, co i kiedy się zmieniło. Wersja oznaczona jako aktualna obowiązuje dziś.",
        docs={"privacy": "Polityka prywatności", "terms": "Warunki korzystania"},
        current="Aktualna", back="Payment Calendar",
        links=("Polityka prywatności", "Warunki korzystania", "Strona główna")),
    "en": dict(lang="en", locale="en_US", title='Document version history',
        desc='Every version of the Payment Calendar Privacy Policy and Terms of Use, with the dates they applied.',
        intro='We keep every earlier version of these documents so it is clear what changed and when. The one marked current applies today.',
        docs={"privacy": 'Privacy Policy', "terms": 'Terms of Use'},
        current='Current', back='Payment Calendar',
        links=('Privacy Policy', 'Terms of Use', 'Home')),
    "es": dict(lang="es", locale="es_ES", title='Historial de versiones de los documentos',
        desc='Todas las versiones de la Política de privacidad y las Condiciones de uso de Payment Calendar, con sus fechas de vigencia.',
        intro='Conservamos cada versión anterior de estos documentos para que quede claro qué cambió y cuándo. La marcada como actual es la vigente hoy.',
        docs={"privacy": 'Política de privacidad', "terms": 'Condiciones de uso'},
        current='Actual', back='Payment Calendar',
        links=('Política de privacidad', 'Condiciones de uso', 'Inicio')),
    "de": dict(lang="de", locale="de_DE", title='Versionshistorie der Dokumente',
        desc='Alle Fassungen der Datenschutzerklärung und der Nutzungsbedingungen von Payment Calendar, mit ihren Gültigkeitsdaten.',
        intro='Wir bewahren jede frühere Fassung dieser Dokumente auf, damit klar ist, was sich wann geändert hat. Die als aktuell markierte gilt heute.',
        docs={"privacy": 'Datenschutzerklärung', "terms": 'Nutzungsbedingungen'},
        current='Aktuell', back='Payment Calendar',
        links=('Datenschutzerklärung', 'Nutzungsbedingungen', 'Startseite')),
    "fr": dict(lang="fr", locale="fr_FR", title='Historique des versions des documents',
        desc="Toutes les versions de la Politique de confidentialité et des Conditions d'utilisation de Payment Calendar, avec leurs dates d'application.",
        intro="Nous conservons chaque version précédente de ces documents afin qu'il soit clair ce qui a changé et quand. Celle marquée comme actuelle s'applique aujourd'hui.",
        docs={"privacy": 'Politique de confidentialité', "terms": "Conditions d'utilisation"},
        current='Actuelle', back='Payment Calendar',
        links=('Politique de confidentialité', "Conditions d'utilisation", 'Accueil')),
    "it": dict(lang="it", locale="it_IT", title='Cronologia delle versioni dei documenti',
        desc="Tutte le versioni dell'Informativa sulla privacy e delle Condizioni d'uso di Payment Calendar, con le date di validità.",
        intro='Conserviamo ogni versione precedente di questi documenti perché sia chiaro che cosa è cambiato e quando. Quella indicata come attuale vale oggi.',
        docs={"privacy": 'Informativa sulla privacy', "terms": "Condizioni d'uso"},
        current='Attuale', back='Payment Calendar',
        links=('Informativa sulla privacy', "Condizioni d'uso", 'Home')),
    "uk": dict(lang="uk", locale="uk_UA", title='Історія версій документів',
        desc='Усі версії Політики конфіденційності та Умов користування Payment Calendar із датами чинності.',
        intro='Ми зберігаємо кожну попередню версію цих документів, щоб було зрозуміло, що і коли змінилося. Версія, позначена як поточна, чинна сьогодні.',
        docs={"privacy": 'Політика конфіденційності', "terms": 'Умови користування'},
        current='Поточна', back='Payment Calendar',
        links=('Політика конфіденційності', 'Умови користування', 'Головна')),
    "sv": dict(lang="sv", locale="sv_SE", title='Dokumentens versionshistorik',
        desc='Alla versioner av Payment Calendars integritetspolicy och användarvillkor, med de datum de gällde.',
        intro='Vi sparar varje tidigare version av dokumenten så att det är tydligt vad som ändrades och när. Den som är märkt som aktuell gäller i dag.',
        docs={"privacy": 'Integritetspolicy', "terms": 'Användarvillkor'},
        current='Aktuell', back='Payment Calendar',
        links=('Integritetspolicy', 'Användarvillkor', 'Startsida')),
    "zh-Hans": dict(lang="zh-Hans", locale="zh_CN", title='文档版本历史',
        desc='Payment Calendar 隐私政策与使用条款的所有版本及其生效日期。',
        intro='我们保留这些文档的每一个历史版本，以便清楚地看到改动内容与时间。标注为当前的版本为今日生效版本。',
        docs={"privacy": '隐私政策', "terms": '使用条款'},
        current='当前', back='Payment Calendar',
        links=('隐私政策', '使用条款', '首页')),
    "ja": dict(lang="ja", locale="ja_JP", title='ドキュメントのバージョン履歴',
        desc='Payment Calendar のプライバシーポリシーと利用規約の全バージョンと、それぞれの適用日。',
        intro='いつ何が変わったかが分かるよう、これらのドキュメントの過去の版をすべて保存しています。「現行」と表示されている版が本日適用されるものです。',
        docs={"privacy": 'プライバシーポリシー', "terms": '利用規約'},
        current='現行', back='Payment Calendar',
        links=('プライバシーポリシー', '利用規約', 'ホーム')),
    "pt-BR": dict(lang="pt-BR", locale="pt_BR", title='Histórico de versões dos documentos',
        desc='Todas as versões da Política de privacidade e dos Termos de uso do Payment Calendar, com as datas de vigência.',
        intro='Guardamos cada versão anterior desses documentos para deixar claro o que mudou e quando. A marcada como atual é a que vale hoje.',
        docs={"privacy": 'Política de privacidade', "terms": 'Termos de uso'},
        current='Atual', back='Payment Calendar',
        links=('Política de privacidade', 'Termos de uso', 'Início')),
}
def doc_date(path):
    """Pierwsza data w dokumencie. Etykieta jest przetłumaczona w każdym
    języku ("Last updated", "Última actualización", "最終更新"...), więc
    szukamy samej daty, a nie napisu przed nią."""
    s = open(path, encoding="utf-8").read()
    body = s[s.index("<body>"):] if "<body>" in s else s
    m = re.search(r"(\d{4}-\d{2}-\d{2})", body)
    return m.group(1) if m else None

def build(lang):
    cfg = LANGS[lang]
    rows = {}
    for doc, label in cfg["docs"].items():
        live = "legal/%s/%s.html" % (lang, doc)
        versions = []
        if os.path.exists(live):
            d = doc_date(live)
            if d:
                versions.append((d, "/legal/%s/%s.html" % (lang, doc), True))
        for f in glob.glob("legal/%s/archiwum/%s-*.html" % (lang, doc)):
            m = re.search(r"-(\d{4}-\d{2}-\d{2})\.html$", f)
            if m:
                versions.append((m.group(1), "/" + f, False))
        # najnowsze na gorze, bez duplikatow dat
        seen, uniq = set(), []
        for d, href, cur in sorted(versions, key=lambda v: v[0], reverse=True):
            if d in seen:
                continue
            seen.add(d); uniq.append((d, href, cur))
        rows[doc] = uniq

    sections = []
    for doc, label in cfg["docs"].items():
        items = "\n".join(
            '          <li><a href="%s">%s</a>%s</li>' % (
                href, d, ' <span class="badge-current">%s</span>' % cfg["current"] if cur else "")
            for d, href, cur in rows[doc])
        sections.append(
            '      <section>\n        <h2>%s</h2>\n        <ol class="version-list">\n%s\n        </ol>\n      </section>'
            % (label, items))

    html = '''<!doctype html>
<html lang="%(lang)s">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>%(title)s - Payment Calendar</title>
    <meta name="description" content="%(desc)s" />
    <link rel="canonical" href="https://payment-calendar.app/legal/%(l)s/historia.html" />
    <meta name="robots" content="index,follow,max-snippet:-1" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Payment Calendar" />
    <meta property="og:title" content="%(title)s" />
    <meta property="og:description" content="%(desc)s" />
    <meta property="og:url" content="https://payment-calendar.app/legal/%(l)s/historia.html" />
    <meta property="og:locale" content="%(locale)s" />
    <meta name="theme-color" content="#0f1417" />
    <link rel="icon" href="/assets/favicon/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Sora:wght@600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/assets/css/site.css?v=20260920" />
  </head>
  <body>
    <main class="legal-doc">
      <p class="legal-back"><a href="/%(l)s/">&larr; %(back)s</a></p>
      <h1>%(title)s</h1>
      <p>%(intro)s</p>
%(sections)s
      <p class="legal-back">
        <a href="/legal/%(l)s/privacy.html">%(l1)s</a> &middot;
        <a href="/legal/%(l)s/terms.html">%(l2)s</a> &middot;
        <a href="/%(l)s/">%(l3)s</a>
      </p>
    </main>
  </body>
</html>
''' % dict(lang=cfg["lang"], l=lang, locale=cfg["locale"], title=cfg["title"],
           desc=cfg["desc"], intro=cfg["intro"], back=cfg["back"],
           sections="\n".join(sections),
           l1=cfg["links"][0], l2=cfg["links"][1], l3=cfg["links"][2])

    out = "legal/%s/historia.html" % lang
    open(out, "w", encoding="utf-8").write(html)
    total = sum(len(v) for v in rows.values())
    print("zbudowano %s (%d wersji)" % (out, total))
    for doc, label in cfg["docs"].items():
        print("  %s: %s" % (label, ", ".join(d for d, _, _ in rows[doc])))

if __name__ == "__main__":
    lang = sys.argv[1] if len(sys.argv) > 1 else "pl"
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    build(lang)
