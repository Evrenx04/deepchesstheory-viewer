import { t } from "./i18n";

/**
 * The tour after the welcome screen (components/Tour.tsx): a dark screen, one control lit, an arrow and a bubble.
 * Each step points at an element marked in the page (data-tour="…" or a class). A step with `action` waits for the
 * reader to press that element; with `until` it waits until another element shows (› may have to be pressed twice
 * before "Simüle et" appears). A step whose element never shows (a course or a screen without it) is passed over.
 */
export interface TourStep {
  id: string;
  /** CSS selectors, tried in turn: the first one visible on this screen is lit. */
  target: string[];
  title: string;
  text: string;
  /** What the reader does to go on; without it the bubble has "Anladım". */
  action?: string;
  /** For an action step: the step is done once this selector matches a visible element (else: at the first press). */
  until?: string;
}

export function tourSteps(): TourStep[] {
  return [
    {
      id: "modules",
      target: ['[data-tour="modules"]'],
      title: t("Bölümler"),
      text: t(
        "Her harf bir açılış ailesi: aynı hamlelerle başlayan varyantlar. Her kod bir bölüm; ailenin ilk bölümü ana hat, sonrakiler öbür seçenekler. Sırayla gitmek zorunda değilsin.",
      ),
    },
    {
      id: "chapter",
      target: ['[data-tour="first-chapter"]'],
      title: t("İstediğin bölümden başla"),
      text: t("Her bölüm kendi başına çalışılır. Şimdi ilk bölümü açalım."),
      action: t("İşaretli bölüme bas."),
    },
    {
      id: "start",
      target: ['[data-tour="intro"]', ".key-points.goals"],
      title: t("Bölümün başı"),
      text: t(
        "Giriş parça parça açılır: önce bu bölümde öğreneceklerin, Devam ile sıradaki paragraf, Hepsini göster ile tamamı. Başla seni ilk hamleye götürür.",
      ),
    },
    {
      id: "next",
      target: ['[data-tour="next"]'],
      title: t("Ana hattı oku"),
      text: t("› ile hamle hamle ilerle; her hamlenin notu tahtanın yanında (telefonda altında). Bazı konumlarda site durur ve hamleyi önce sen bulursun."),
      action: t("› düğmesine bas; Simüle et çıkana kadar."),
      until: '[data-tour="sim"]',
    },
    {
      id: "sim",
      target: ['[data-tour="sim"]'],
      title: t("Simüle et"),
      text: t(
        "Bölümün başından bu konuma kadar gelen yolu ezberden oynarsın. Rakibin hamlelerini site yapar; yanılırsan doğru hamleyi ve nedenini gösterir.",
      ),
    },
    {
      id: "opponent",
      target: ['[data-tour="opponent"]'],
      title: t("Rakibe karşı oyna"),
      text: t("Bu konumdan sonrasını oynarsın. Rakip, kursun incelediği hamlelerden birini gerçek oyunlardaki sıklığa göre seçer."),
    },
    {
      id: "points",
      target: ['[data-tour="points"]'],
      title: t("Simülasyon noktaları"),
      text: t(
        "Üst çubuktaki sayaç: bölümde simüle etmeni önerdiğimiz yerler. Hatasız geçtiğin her nokta yeşil tik alır; hepsi bitince bölüm tamamlanır. Dokununca liste açılır.",
      ),
    },
    {
      id: "fold",
      target: ['[data-tour="fold"]'],
      title: t("Bu konumda"),
      text: t("Hamle listesi (ve varsa usta oyunları) bu satırda katlı durur. Önce ana hattı bitir, merak edince aç."),
    },
    {
      id: "path",
      target: [".topbar .path-switch", '[data-tour="settings"]'],
      title: t("Hızlı yol ve tam ağaç"),
      text: t(
        "Hızlı yol ana hatları ve en önemli yan varyantları gösterir; önce bunu bitir. Tam ağaç bütün yan varyantları ve “neden bu hamle değil?” cevaplarını açar. Seçim üst çubukta, telefonda ⚙ Ayarlar'da.",
      ),
    },
    {
      id: "end",
      target: ['[data-tour="settings"]'],
      title: t("Tur bitti"),
      text: t("Turu ve tanıtımın tamamını ⚙ Ayarlar'da bulursun. İyi çalışmalar!"),
    },
  ];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Room left around the lit element, and the gap the arrow crosses. */
const MARGIN = 12;
const GAP = 26;

/**
 * Where the bubble goes: below the lit element when it fits, else above, else wherever it stays on the screen.
 * Horizontally centred on the element, kept inside the screen.
 */
export function placeTip(target: Box, tip: { w: number; h: number }, view: { w: number; h: number }) {
  const left = Math.min(Math.max(MARGIN, target.x + target.w / 2 - tip.w / 2), Math.max(MARGIN, view.w - tip.w - MARGIN));
  const belowTop = target.y + target.h + GAP;
  const aboveTop = target.y - GAP - tip.h;
  if (belowTop + tip.h <= view.h - MARGIN) return { left, top: belowTop, below: true };
  if (aboveTop >= MARGIN) return { left, top: aboveTop, below: false };
  // Neither fits (a tall element on a small screen): over the element, inside the screen.
  const top = Math.min(Math.max(MARGIN, view.h - tip.h - MARGIN), Math.max(MARGIN, belowTop));
  return { left, top, below: top > target.y + target.h / 2 };
}

/** The scroll that brings an element into the free band between the bars (sticky top, fixed bottom); 0 if it is in. */
export function scrollToShow(target: Box, band: { top: number; bottom: number }) {
  const room = band.bottom - band.top;
  if (target.y >= band.top + 8 && target.y + target.h <= band.bottom - 8) return 0;
  // Taller than the band: its top under the top bar. Else in the band's upper third, leaving room for the bubble.
  const want = target.h >= room - 16 ? band.top + 8 : band.top + Math.max(8, Math.min((room - target.h) / 3, room - target.h - 8));
  return target.y - want;
}
