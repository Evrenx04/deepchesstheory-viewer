import { t } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Compass, Info, Settings as Gear, X } from "lucide-react";
import type { Notation } from "../lib/notation";
import type { BoardSize, Settings, TextSize, Theme } from "../lib/settings";

interface Props {
  settings: Settings;
  onChange: (change: Partial<Settings>) => void;
  notation: Notation;
  onNotation: (n: Notation) => void;
  /** Hızlı yol / tam ağaç, for chapters that have a quick path. */
  path?: { quick: boolean; onChoose: (quick: boolean) => void };
  showDeep: boolean;
  onToggleDeep: () => void;
  onBeforeReading?: () => void;
  /** Shows the tour again (it can be skipped then). */
  onTour?: () => void;
  /** "Rakibe karşı oyna" stays in the open chapter's lines. */
  chapterOnly?: { on: boolean; onToggle: () => void };
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} className={v === value ? "active" : ""} aria-pressed={v === value} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The ⚙ button and its panel: reading options that used to fill the top bar. */
export function SettingsMenu({ settings, onChange, notation, onNotation, path, showDeep, onToggleDeep, onBeforeReading, onTour, chapterOnly }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !panel.current?.parentElement?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="settings">
      <button className="icon-button settings-button" data-tour="settings" aria-label={t("Ayarlar")} aria-expanded={open} title={t("Ayarlar")} onClick={() => setOpen((o) => !o)}>
        <Gear size={19} />
      </button>
      {open && (
        <div ref={panel} className="settings-panel" role="dialog" aria-label={t("Ayarlar")}>
          <div className="settings-head">
            <strong>{t("Ayarlar")}</strong>
            <button className="icon-button" aria-label={t("Kapat")} onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <Choice<Settings["lang"]>
            label={t("Dil")}
            value={settings.lang}
            options={[
              ["tr", "Türkçe"],
              ["en", "English"],
            ]}
            onChange={(lang) => {
              if (lang === settings.lang) return;
              onChange({ lang });
              // The interface and the content are read once, in the chosen language: load the page again.
              window.setTimeout(() => window.location.reload(), 0);
            }}
          />
          {path && (
            <Choice
              label={t("Görünüm")}
              value={path.quick ? "quick" : "full"}
              options={[
                ["quick", t("Hızlı yol")],
                ["full", t("Tam ağaç")],
              ]}
              onChange={(v) => path.onChoose(v === "quick")}
            />
          )}
          <Choice
            label={t("Notasyon")}
            value={notation}
            options={[
              ["figurine", "♘f3"],
              ["tr", "Af3"],
              ["en", "Nf3"],
            ]}
            onChange={onNotation}
          />
          <Choice<TextSize>
            label={t("Yazı boyutu")}
            value={settings.text}
            options={[
              ["s", t("Küçük")],
              ["m", t("Orta")],
              ["l", t("Büyük")],
            ]}
            onChange={(text) => onChange({ text })}
          />
          <Choice<BoardSize>
            label={t("Tahta (telefonda)")}
            value={settings.board}
            options={[
              ["l", t("Tam")],
              ["m", t("Orta")],
              ["s", t("Küçük")],
            ]}
            onChange={(board) => onChange({ board })}
          />
          <Choice<Theme>
            label={t("Tema")}
            value={settings.theme}
            options={[
              ["dark", t("Koyu")],
              ["light", t("Açık")],
            ]}
            onChange={(theme) => onChange({ theme })}
          />
          <label className="setting-row setting-check">
            <input type="checkbox" checked={showDeep} onChange={onToggleDeep} />
            <span>{t("Derinlemesine notlar")}</span>
          </label>
          {chapterOnly && (
            <label className="setting-row setting-check" title={t("İşaretliyse rakip de sen de yalnız bu bölümün varyantlarında kalırsınız")}>
              <input type="checkbox" checked={chapterOnly.on} onChange={chapterOnly.onToggle} />
              <span>{t("Rakibe karşı oyna: yalnız bu bölüm")}</span>
            </label>
          )}
          <label className="setting-row setting-check">
            <input type="checkbox" checked={settings.sound} onChange={() => onChange({ sound: !settings.sound })} />
            <span>{t("Çalışırken ses (doğru / yanlış hamle)")}</span>
          </label>
          {onBeforeReading && (
            <button
              className="setting-link"
              onClick={() => {
                setOpen(false);
                onBeforeReading();
              }}
            >
              <Info size={16} /> {t("Tanıtımın tamamı")}

            </button>
          )}
          {onTour && (
            <button
              className="setting-link"
              onClick={() => {
                setOpen(false);
                onTour();
              }}
            >
              <Compass size={16} /> {t("Turu yeniden göster")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
