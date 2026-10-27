import { t } from "../lib/i18n";
import { useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { search, type SearchData } from "../lib/search";
import { formatSan } from "../lib/notation";
import { useNotation } from "../lib/notationContext";

interface Props {
  /** Undefined until the course's chapters are fetched. */
  data?: SearchData;
  onOpen: (chapter: string, node?: string) => void;
  /** Called with true while the box is in use (the drawer keeps it open). */
  autoFocus?: boolean;
}

const KIND = { chapter: "Bölüm", card: "Kart", endgame: "Oyun sonu", game: "Usta oyunu" } as const;

/** "Hamle, konum ya da oyun ara": a move sequence finds every place of its position, a name finds chapters and games. */
export function SearchBox({ data, onOpen, autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const notation = useNotation();
  const result = useMemo(() => (data && query.trim().length >= 2 ? search(query, data) : undefined), [data, query]);
  const san = (text: string) => text.replace(/(\d+\.(?:\.\.)?)?([KQRBN][a-h1-8x]*[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)/g, (_, n = "", m) => n + formatSan(m, notation));
  return (
    <div className="search-box">
      <label className="search-input">
        <SearchIcon size={15} />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          placeholder={t("Hamle, konum ya da oyun ara: d4 exd4 e5")}
          aria-label={t("Hamle, konum ya da oyun ara")}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="icon-button" aria-label={t("Aramayı temizle")} onClick={() => setQuery("")}>
            <X size={14} />
          </button>
        )}
      </label>
      {query.trim().length >= 2 && (
        <div className="search-results" role="list">
          {!data && <p className="search-empty">{t("Bölümler yükleniyor…")}</p>}
          {result?.kind === "none" && <p className="search-empty">{t('Bir şey bulunamadı. Hamleleri aralarında boşlukla yaz ("Bg5 h6" ya da "Fg5 h6") ya da bir ad ara ("Kramnik", "Kart 3").')}</p>}
          {result?.kind === "names" &&
            result.results.map((r) => (
              <button key={r.chapter} role="listitem" className="search-hit" onClick={() => (setQuery(""), onOpen(r.chapter))}>
                <span className="search-kind">{t(KIND[r.kind])}</span>
                <span>{r.title}</span>
              </button>
            ))}
          {result?.kind === "moves" &&
            result.groups.slice(0, 4).map((g, i) => (
              <div key={g.key} className="search-group">
                {result.groups.length > 1 && <div className="search-group-title">{i === 0 ? t("Bu konum") : t("Aynı hamleler, başka konum")}</div>}
                {g.places.slice(0, 8).map((p) => (
                  <button key={`${p.chapter}|${p.node.id}`} role="listitem" className="search-hit" onClick={() => (setQuery(""), onOpen(p.chapter, p.node.id))}>
                    <span className="search-kind">{p.transposed ? t("Aktarma") : p.onQuick ? t("Hızlı yol") : t("Tam ağaç")}</span>

                    <span className="san">{san(p.label)}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
