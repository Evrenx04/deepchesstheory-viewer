// The "Kaynaklar ve lisanslar" page (#/kaynaklar): every text on it is here, in one place, in both languages
// (SOURCES / SOURCES_TEXT in Turkish, SOURCES_EN / SOURCES_TEXT_EN in English; the page picks one with L()).
// This file is also read by vite.config.ts, so it does not import lib/i18n.
// The full license texts are in THIRD-PARTY-NOTICES at the repository root, copied into the build (vite.config.ts).
// A test (src/test/sources.test.ts) checks the code list against package.json, node_modules and THIRD-PARTY-NOTICES.

/** The page's address: #/kaynaklar. Not a study id. */
export const SOURCES_ROUTE = "kaynaklar";
/** The notices file's name in the build. */
export const NOTICES_FILE = "THIRD-PARTY-NOTICES.txt";

export interface SourceItem {
  name: string;
  url?: string;
  /** The license as its usual short name, with how it applies here when that matters. */
  license?: string;
  text: string;
  /** npm packages this entry covers (code only); the test checks their licenses. */
  packages?: string[];
}

export interface SourceSection {
  title: string;
  intro?: string[];
  items: SourceItem[];
}

export const SOURCES_TEXT = {
  link: "Kaynaklar ve lisanslar",
  title: "Kaynaklar ve lisanslar",
  lead: "Bu site başkalarının açık emeği üzerine kurulu: oyun veritabanları, analiz araçları ve açık kaynak kod. Burada hangilerini kullandığımızı, lisanslarını ve kime teşekkür borçlu olduğumuzu bulabilirsin.",
  back: "Geri",
  home: "Kurslar",
  noticesLead: "Bileşenlerin lisans metinlerinin tamamı:",
  noticesLink: "THIRD-PARTY-NOTICES",
};

export const SOURCES: SourceSection[] = [
  {
    title: "Oyunlar ve istatistikler",
    items: [
      {
        name: "The Week in Chess",
        url: "https://theweekinchess.com/",
        text: "Metindeki “ustalarda %” rakamları (2012'den bu yana, iki oyuncusu da 2400 üstü yüz yüze klasik oyunlar), plan kartlarındaki ve oyun sonlarındaki sayımlar, “son iki yılda %” rakamları ve usta oyunları kutusundaki oyunlar Mark Crowther'ın yıllardır her hafta yayımladığı oyun dosyalarından.",
      },
      {
        name: "Lichess",
        url: "https://database.lichess.org/",
        license: "Açık veritabanı CC0 · yayın arşivi CC BY-SA 4.0",
        text: "“Lichess 2000+” ya da “çevrimiçinde” diye geçen rakamlar ve simülasyonda rakibin hamle seçimi Lichess açık veritabanından; konum değerlendirmelerinin bir kısmı Lichess bulut analizinden. Turnuva oyunlarının bir kısmı Lichess yayın arşivinde de yayımlanıyor. Kartlarda anılan 2012 öncesi oyunların kaydı Lichess usta veritabanından (Kasparov–Anand 1995 TWIC'in 30. sayısında da var). Verisini herkese açtığı için Lichess'e teşekkür ederiz.",
      },
      {
        name: "Lumbra's GigaBase",
        url: "https://lumbrasgigabase.com/en/",
        text: "Sitenin kapalı beta sürümünde usta istatistikleri yazarının izniyle bu veritabanından hesaplanmıştı; desteği için Michael Jansen'e teşekkür ederiz. Şimdiki sürümde bu veritabanından hiçbir veri kullanılmıyor.",
      },
      {
        name: "PGN Mentor",
        url: "https://www.pgnmentor.com/",
        text: "Miles–Korchnoi, Johannesburg 1979 oyununun kaydı buradaki oyuncu arşivinden.",
      },
    ],
  },
  {
    title: "Motor ve araçlar",
    items: [
      {
        name: "Stockfish",
        url: "https://stockfishchess.org/",
        license: "GPL-3.0",
        text: "Metindeki değerlendirmeler (+0,4 gibi) Stockfish ve Lichess bulut analiziyle hesaplandı. Motor yalnız hazırlıkta, kendi bilgisayarımızda çalışıyor; siteyle birlikte gönderilmiyor.",
      },
      {
        name: "python-chess",
        url: "https://github.com/niklasf/python-chess",
        license: "GPL-3.0-or-later",
        text: "Hamlelerin ve konumların denetimi için; yalnız hazırlıkta kullanılıyor.",
      },
    ],
  },
  {
    title: "Sitenin kodu",
    intro: [
      "Tahta ve hamle görüntüleyicisi chessground ve chessops üzerine kurulu. İkisi de GNU GPL 3.0 (ya da sonraki bir sürüm) ile lisanslı; bu yüzden sitenin görüntüleyici kodu da aynı lisansla dağıtılıyor. Kaynak kodu aşağıdaki açık depoda; sitede yayımlanan her sürümün orada bir etiketi var.",
      "Kurs metni, açıklamalar ve analizler sitenin kendi yazımıdır; ayrı dosyalarda durur, bu kod lisanslarının kapsamında değildir.",
    ],
    items: [
      {
        name: "deepchesstheory-viewer",
        url: "https://github.com/Evrenx04/deepchesstheory-viewer",
        license: "GPL-3.0-or-later",
        text: "Bu sitenin görüntüleyici kodu: tahtanın, hamle ağacının, soruların ve simülasyonun bütün kaynağı.",
      },
      {
        name: "chessground",
        url: "https://github.com/lichess-org/chessground",
        license: "GPL-3.0-or-later",
        text: "Tahta, taşlar, oklar. Lichess ekibi.",
        packages: ["chessground"],
      },
      {
        name: "chessops",
        url: "https://github.com/niklasf/chessops",
        license: "GPL-3.0-or-later",
        text: "Kurallar, hamle notasyonu, FEN ve PGN. Niklas Fiekas.",
        packages: ["chessops"],
      },
      {
        name: "@badrap/result",
        url: "https://github.com/badrap/result",
        license: "MIT",
        text: "chessops'un kullandığı küçük bir yardımcı kütüphane.",
        packages: ["@badrap/result"],
      },
      {
        name: "React",
        url: "https://react.dev/",
        license: "MIT",
        text: "Arayüz (react, react-dom, scheduler).",
        packages: ["react", "react-dom", "scheduler"],
      },
      {
        name: "Tailwind CSS",
        url: "https://tailwindcss.com/",
        license: "MIT",
        text: "Temel stiller.",
        packages: ["tailwindcss", "@tailwindcss/vite"],
      },
      {
        name: "Lucide",
        url: "https://lucide.dev/",
        license: "ISC · Feather'dan gelen simgeler MIT",
        text: "Simgeler.",
        packages: ["lucide-react"],
      },
      {
        name: "Manrope",
        url: "https://github.com/sharanda/manrope",
        license: "SIL Open Font License 1.1",
        text: "Yazı tipi; Fontsource paketiyle.",
        packages: ["@fontsource-variable/manrope"],
      },
      {
        name: "Vite",
        url: "https://vite.dev/",
        license: "MIT",
        text: "Derleme aracı; sayfaya yalnız birkaç satırlık bir yükleme yardımcısı giriyor.",
        packages: ["vite"],
      },
    ],
  },
  {
    title: "Taşlar ve tahta",
    items: [
      {
        name: "cburnett taş seti",
        url: "https://commons.wikimedia.org/wiki/File:Chess_klt45.svg",
        license: "GFDL / CC BY-SA 3.0 / BSD / GPL arasından seçmeli; burada GPL",
        text: "Colin M.L. Burnett'in çizdiği taşlar; chessground'un içinde geliyor.",
      },
      {
        name: "Tahta",
        text: "Kareler sitenin kendi stil koduyla çiziliyor; ayrı bir görsel dosya yok.",
      },
    ],
  },
];

export const SOURCES_TEXT_EN: typeof SOURCES_TEXT = {
  link: "Sources and licences",
  title: "Sources and licences",
  lead: "This site is built on other people's open work: game databases, analysis tools and open-source code. Here you can find which ones we use, their licences, and whom we have to thank.",
  back: "Back",
  home: "Courses",
  noticesLead: "The full licence texts of the components:",
  noticesLink: "THIRD-PARTY-NOTICES",
};

/** The same page in English: the same sections and items in the same order (a test checks names, links and packages). */
export const SOURCES_EN: SourceSection[] = [
  {
    title: "Games and statistics",
    items: [
      {
        name: "The Week in Chess",
        url: "https://theweekinchess.com/",
        text: "The “masters %” figures in the text (over-the-board classical games since 2012 between players both rated over 2400), the counts on the plan cards and in the endgames, the “% in the last two years” figures and the games in the master games box come from the game files Mark Crowther has published every week for many years.",
      },
      {
        name: "Lichess",
        url: "https://database.lichess.org/",
        license: "Open database CC0 · broadcast archive CC BY-SA 4.0",
        text: "The figures marked “Lichess 2000+” or “online”, and the opponent's move choices in simulations, come from the Lichess open database; some of the position evaluations come from the Lichess cloud analysis. Some of the tournament games are also published in the Lichess broadcast archive. The records of the pre-2012 games quoted on the cards come from the Lichess masters database (Kasparov–Anand 1995 is also in TWIC issue 30). We thank Lichess for making its data open to everyone.",
      },
      {
        name: "Lumbra's GigaBase",
        url: "https://lumbrasgigabase.com/en/",
        text: "In the site's closed beta the master statistics were computed from this database with the author's permission; we thank Michael Jansen for this support. The current version uses no data from this database.",
      },
      {
        name: "PGN Mentor",
        url: "https://www.pgnmentor.com/",
        text: "The record of the game Miles–Korchnoi, Johannesburg 1979 comes from the player archive there.",
      },
    ],
  },
  {
    title: "Engine and tools",
    items: [
      {
        name: "Stockfish",
        url: "https://stockfishchess.org/",
        license: "GPL-3.0",
        text: "The evaluations in the text (such as +0.4) were calculated with Stockfish and the Lichess cloud analysis. The engine runs only during preparation, on our own computer; it is not shipped with the site.",
      },
      {
        name: "python-chess",
        url: "https://github.com/niklasf/python-chess",
        license: "GPL-3.0-or-later",
        text: "For checking the moves and positions; used only during preparation.",
      },
    ],
  },
  {
    title: "The site's code",
    intro: [
      "The board and move viewer is built on chessground and chessops. Both are licensed under the GNU GPL 3.0 (or any later version), so the site's viewer code is distributed under the same licence. The source code is in the open repository below; every version published on the site has a tag there.",
      "The course text, annotations and analysis are the site's own work; they are kept in separate files and are not covered by these code licences.",
    ],
    items: [
      {
        name: "deepchesstheory-viewer",
        url: "https://github.com/Evrenx04/deepchesstheory-viewer",
        license: "GPL-3.0-or-later",
        text: "This site's viewer code: the complete source of the board, the move tree, the questions and the simulation.",
      },
      {
        name: "chessground",
        url: "https://github.com/lichess-org/chessground",
        license: "GPL-3.0-or-later",
        text: "Board, pieces, arrows. The Lichess team.",
        packages: ["chessground"],
      },
      {
        name: "chessops",
        url: "https://github.com/niklasf/chessops",
        license: "GPL-3.0-or-later",
        text: "Rules, move notation, FEN and PGN. Niklas Fiekas.",
        packages: ["chessops"],
      },
      {
        name: "@badrap/result",
        url: "https://github.com/badrap/result",
        license: "MIT",
        text: "A small helper library used by chessops.",
        packages: ["@badrap/result"],
      },
      {
        name: "React",
        url: "https://react.dev/",
        license: "MIT",
        text: "The interface (react, react-dom, scheduler).",
        packages: ["react", "react-dom", "scheduler"],
      },
      {
        name: "Tailwind CSS",
        url: "https://tailwindcss.com/",
        license: "MIT",
        text: "Base styles.",
        packages: ["tailwindcss", "@tailwindcss/vite"],
      },
      {
        name: "Lucide",
        url: "https://lucide.dev/",
        license: "ISC · icons from Feather MIT",
        text: "Icons.",
        packages: ["lucide-react"],
      },
      {
        name: "Manrope",
        url: "https://github.com/sharanda/manrope",
        license: "SIL Open Font License 1.1",
        text: "Typeface; via the Fontsource package.",
        packages: ["@fontsource-variable/manrope"],
      },
      {
        name: "Vite",
        url: "https://vite.dev/",
        license: "MIT",
        text: "Build tool; only a few lines of loading code end up in the page.",
        packages: ["vite"],
      },
    ],
  },
  {
    title: "Pieces and board",
    items: [
      {
        name: "cburnett piece set",
        url: "https://commons.wikimedia.org/wiki/File:Chess_klt45.svg",
        license: "Choice of GFDL / CC BY-SA 3.0 / BSD / GPL; GPL here",
        text: "The pieces drawn by Colin M.L. Burnett; they come with chessground.",
      },
      {
        name: "Board",
        text: "The squares are drawn by the site's own style code; there is no separate image file.",
      },
    ],
  },
];
