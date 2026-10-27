import { t } from "../lib/i18n";
import type { MasterGame } from "../lib/study";

interface Props {
  games: [string, MasterGame][];
  onOpen: (id: string) => void;
}

const surname = (name: string) => name.split(",")[0];

/** Master games that reached this exact position. */
export function GamesBox({ games, onOpen }: Props) {
  if (!games.length) return null;
  return (
    <section className="games-box" aria-label={t("Usta oyunları")}>
      <div className="next-title">{t("Bu konum usta oyunlarında")}</div>
      <ul>
        {games.map(([id, g]) => (
          <li key={id}>
            <button className="game-row" onClick={() => onOpen(id)}>
              <span className="game-players">
                {surname(g.white)} – {surname(g.black)}
              </span>
              <span className="game-result">{g.result.replace("1/2-1/2", "½-½")}</span>
              <span className="game-event">
                {g.event}
                {g.fast ? ` · ${t("hızlı")}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="games-note">{t("Oyun bu konumdan açılır; ←/→ ile baştan sona izleyebilirsin.")}</p>

    </section>
  );
}
