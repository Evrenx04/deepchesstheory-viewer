import { describe, expect, it } from "vitest";
import { criticalMoments, lineEnd, mainlineAt, nearestIn, parseStudyPgn, pathTo, quickTree, withoutFigures } from "../lib/pgnTree";
import { parseProse, diagrams, wordCount } from "../lib/prose";
import { splitMoves, figurine, formatSan } from "../lib/notation";
import { fireEvent, render } from "@testing-library/react";
import { NextMoves, preview } from "../components/NextMoves";
import { LinePath } from "../components/LinePath";
import { planProgress, stepKey } from "../lib/plans";
import { sanOf } from "../lib/quiz";
import { RichText } from "../components/RichText";
import { LinkContext } from "../lib/linkContext";
import { boxOf, chapterBoxes, hasBoxes, inBox, nextInBox } from "../lib/boxes";
import { idAt } from "./nodes";

const PGN = `[Event "t"]
[Start "2"]

{ Giriş metni [%cal Ge2e4] }
1. e4 e5 2. Nf3 { Saldırı [%cal Gf3e5] [%csl Re5] } { [%deep] Derin not } 2... Nc6 (2... d6 3. d4 $1) 3. Bc4 *`;

describe("parseStudyPgn", () => {
  const tree = parseStudyPgn(PGN);

  it("builds main line and variations with FENs", () => {
    expect(tree.intro).toBe("Giriş metni");
    expect(tree.introShapes).toEqual([{ orig: "e2", dest: "e4", brush: "green" }]);
    const nf3 = tree.nodes.get(mainlineAt(tree, 3))!;
    expect(nf3.san).toBe("Nf3");
    expect(nf3.comment).toBe("Saldırı");
    expect(nf3.deep).toBe("Derin not");
    expect(nf3.shapes).toEqual([
      { orig: "f3", dest: "e5", brush: "green" },
      { orig: "e5", brush: "red" },
    ]);
    expect(nf3.children).toHaveLength(2);
    const side = tree.nodes.get(nf3.children[1])!;
    expect(side.san).toBe("d6");
    const d4 = tree.nodes.get(side.children[0])!;
    expect(d4.nags).toEqual([1]);
    expect(d4.fen).toBe("rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3");
    expect(pathTo(tree, d4.id)).toEqual(["e4", "e4 e5", "e4 e5 Nf3", "e4 e5 Nf3 d6", "e4 e5 Nf3 d6 d4"].map((m) => idAt(tree, m)));
    expect(tree.nodes.get(lineEnd(tree, ""))!.san).toBe("Bc4");
  });

  it("splits an inline [%deep] note", () => {
    const t = parseStudyPgn("1. e4 { Merkez. [%deep] Ayrıntı. } *");
    expect(t.nodes.get(idAt(t, "e4"))).toMatchObject({ comment: "Merkez.", deep: "Ayrıntı." });
  });

  it("keeps paragraph breaks next to arrows and anchors", () => {
    const t = parseStudyPgn("1. e4 { Bir. [%csl Rf5] [%id x]\n\nİki. [%cal Ge2e4] } *");
    expect(t.nodes.get(idAt(t, "e4"))!.comment).toBe("Bir.\n\nİki.");
    expect(t.nodes.get(idAt(t, "e4"))!.shapes).toHaveLength(2);
  });

  it("collects [%id] anchors without leaking them into the text", () => {
    const t = parseStudyPgn("1. e4 { Merkez. [%id merkez] } *");
    expect(t.nodes.get(idAt(t, "e4"))).toMatchObject({ comment: "Merkez.", anchors: ["merkez"] });
  });

  it("reports illegal moves with their move number", () => {
    expect(() => parseStudyPgn("1. e4 e5 2. Ke3 *", "x.pgn")).toThrow(/x\.pgn: 2\.Ke3 yasal değil/);
  });
});

describe("prose", () => {
  it("parses headings, lists, deep blocks and diagrams", () => {
    const blocks = parseProse(`# Başlık\n\nMetin satırı\ndevamı.\n\n- a\n- b\n\n:::deep\n@diagram fen="8/8/8/8/8/8/8/K6k w - - 0 1" arrows="Ga1a2 Rh1" caption="c"\n:::`);
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "deep"]);
    expect(blocks[1]).toEqual({ kind: "paragraph", text: "Metin satırı devamı." });
    const [d] = diagrams(blocks);
    expect(d.shapes).toEqual([
      { brush: "green", orig: "a1", dest: "a2" },
      { brush: "red", orig: "h1" },
    ]);
  });

  it("keeps the long text of a :::detay block behind the short summary", () => {
    const blocks = parseProse(`Kısa özet [[a1|bağlantı]].\n\n:::detay\n## Ayrıntı\n\nUzun metin.\n\n@diagram fen="8/8/8/8/8/8/8/K6k w - - 0 1" caption="c d"\n:::`);
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "more"]);
    expect(diagrams(blocks)).toHaveLength(1);
    expect(wordCount(blocks)).toBe(8);
  });

  it("rejects a bad FEN", () => {
    expect(() => parseProse(`@diagram fen="xx"`)).toThrow(/FEN/);
  });

  it("reads numbered lists, apart from dash lists", () => {
    const blocks = parseProse(`Giriş.\n1. **Bir.** 14.d4 sonrası\n2. İki\n- madde`);
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Giriş." },
      { kind: "list", items: ["**Bir.** 14.d4 sonrası", "İki"], ordered: true },
      { kind: "list", items: ["madde"] },
    ]);
  });
});

describe("notation", () => {
  it("turns SAN into figurines inside text", () => {
    expect(figurine("Nf3")).toBe("♘f3");
    expect(figurine("exd8=Q+")).toBe("exd8=♕+");
    expect(formatSan("Bg5", "tr")).toBe("Fg5");
    expect(formatSan("Kxe1", "tr")).toBe("Şxe1");
    expect(splitMoves("9...Ng4 ve O-O", "tr").filter((p) => p.move).map((p) => p.text)).toEqual(["9...Ag4", "O-O"]);
    const parts = splitMoves("Sonra 5.d3 ve 7...Bb4+ gelir, O-O da olur. Fil c4'te, d4 karesi boş; ...d5 ve exd4, Nf3'ten sonra.");
    expect(parts.filter((p) => p.move).map((p) => p.text)).toEqual(["5.d3", "7...♗b4+", "O-O", "...d5", "exd4", "♘f3"]);
    const route = splitMoves("Atın Nbd2-f1-g3 yolu ve ...Ne7-g6, a5-e1 çaprazı.", "tr");
    expect(route.filter((p) => p.move).map((p) => p.text)).toEqual(["Abd2-f1-g3", "...Ae7-g6"]);
  });
});

describe("RichText", () => {
  it("renders paragraphs, lists and moves", () => {
    const { container } = render(<RichText text={"Planlar:\n- a4 ile yer\n- Nf3 gelişir\nSon söz.\n\nİkinci paragraf."} />);
    expect([...container.children].map((c) => c.tagName)).toEqual(["P", "UL", "P", "P"]);
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("li .san")?.textContent).toBe("♘f3");
  });

  it("renders numbered lines as an ordered list", () => {
    const { container } = render(<RichText text={"Üç şey:\n1. Siyah ...c5 oynadı.\n2. Vezirler değişti.\n3. a4 sabitlendi."} />);
    expect([...container.children].map((c) => c.tagName)).toEqual(["P", "OL"]);
    expect(container.querySelectorAll("ol li")).toHaveLength(3);
    expect(container.querySelector("ol li")?.textContent).toBe("Siyah ...c5 oynadı.");
  });
});

describe("study links", () => {
  it("renders known links and drops unknown ones to plain text", () => {
    const { container } = render(
      <LinkContext.Provider value={(name) => (name === "bg5" ? "#/italian/a/0.1" : undefined)}>
        <RichText text={"Bkz. [[bg5|erken Bg5 varyantı]] ve [[yok|başka]]."} />
      </LinkContext.Provider>,
    );
    const link = container.querySelector("a.study-link")!;
    expect(link.getAttribute("href")).toBe("#/italian/a/0.1");
    expect(link.textContent).toBe("erken ♗g5 varyantı");
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.textContent).toContain("başka");
  });

  it("resolves links inside bold text", () => {
    const { container } = render(
      <LinkContext.Provider value={(name) => (name === "bg5" ? "#/italian/a/0.1" : undefined)}>
        <RichText text={"→ **[[bg5|Kramnik–Carlsen]]: d4 sonrası.**"} />
      </LinkContext.Provider>,
    );
    const link = container.querySelector("strong a.study-link")!;
    expect(link.getAttribute("href")).toBe("#/italian/a/0.1");
    expect(container.querySelector("strong")?.textContent).toBe("Kramnik–Carlsen: d4 sonrası.");
    expect(container.textContent).not.toContain("[[");
  });
});


describe("choices and line path", () => {
  const tree = parseStudyPgn(PGN);
  const nf3 = tree.nodes.get(mainlineAt(tree, 3))!;

  it("lists the main move and the alternatives at a branch point", () => {
    const picked: string[] = [];
    const { getByText, container } = render(<NextMoves tree={tree} node={nf3} onSelect={(id) => picked.push(id)} />);
    expect(getByText("Burada 2 seçenek var")).toBeTruthy();
    const buttons = container.querySelectorAll(".next-move");
    expect([...buttons].map((b) => b.querySelector(".san")!.textContent)).toEqual(["2…♘c6", "2…d6"]);
    fireEvent.click(buttons[1]);
    expect(picked).toEqual([nf3.children[1]]);
  });

  it("offers the siblings of a side-line move and a way back", () => {
    const d6 = nf3.children[1];
    const { container, getByText } = render(<NextMoves tree={tree} node={tree.nodes.get(d6)!} onSelect={() => {}} />);
    expect(container.querySelector(".instead-move")!.textContent).toBe("2…♘c6");
    const picked: string[] = [];
    render(<LinePath tree={tree} current={tree.nodes.get(d6)!.children[0]} onSelect={(id) => picked.push(id)} />);
    fireEvent.click(getByText("↩ İlk ayrıldığın yere dön"));
    expect(picked).toEqual([nf3.id]);
  });

  it("borrows a later note only for a side line, and names its move", () => {
    const t = parseStudyPgn("1. e4 e5 2. Nf3 { Ana hamle. } (2. Bc4 Nf6 3. d3 { Yan kolun fikri. }) 2... Nc6 3. Bb5 { Üç hamle. } *");
    const e5 = t.nodes.get(mainlineAt(t, 2))!;
    const { container } = render(<NextMoves tree={t} node={e5} onSelect={() => {}} />);
    const previews = [...container.querySelectorAll(".next-move")].map((b) => b.querySelector(".next-preview")?.textContent ?? "");
    expect(previews).toEqual(["Ana hamle.", "3.d3: Yan kolun fikri."]);
    const nf3 = t.nodes.get(mainlineAt(t, 3))!;
    const { container: next } = render(<NextMoves tree={t} node={nf3} onSelect={() => {}} />);
    expect(next.querySelector(".next-preview")).toBeNull();
  });

  it("previews only the first sentence, without markup", () => {
    expect(preview("**Kalın** ve [[x|bağlantı]] birlikte bir cümle. İkinci cümle.")).toBe("Kalın ve bağlantı birlikte bir cümle.");
    expect(preview("Erken. Siyah merkezi açar. Üçüncü.")).toBe("Erken. Siyah merkezi açar.");
  });
});


describe("plans and quiz helpers", () => {
  it("normalises plan steps and tracks them along the path", () => {
    expect(stepKey("Nbd2")).toBe("Nd2");
    expect(stepKey("exd5+")).toBe("d5");
    expect(stepKey("O-O")).toBe("O-O");
    const tree = parseStudyPgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a6 7. Nbd2 *");
    const end = lineEnd(tree, "");
    expect(planProgress(tree, end, { side: "white", title: "", steps: ["Nd2", "Nf1", "Ng3"] })).toEqual([true, false, false]);
    expect(planProgress(tree, end, { side: "black", title: "", steps: ["a6", "Ba7"] })).toEqual([true, false]);
  });

  it("reads a dragged move as SAN, including castling", () => {
    const fen = "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6";
    expect(sanOf(fen, "e1", "g1")).toBe("O-O");
    expect(sanOf(fen, "b1", "d2")).toBe("Nbd2");
    expect(sanOf(fen, "e1", "e3")).toBeUndefined();
  });

  it("parses [%quiz] with an optional question", () => {
    const t = parseStudyPgn("1. e4 { [%quiz Merkez için ne oynanır?] Doğru. } 1... e5 { [%quiz] } *");
    expect(t.nodes.get(idAt(t, "e4"))).toMatchObject({ quiz: "Merkez için ne oynanır?", comment: "Doğru." });
    expect(t.nodes.get(idAt(t, "e4 e5"))!.quiz).toBe("");
  });
});

describe("boxes", () => {
  const tree = parseStudyPgn(`[Event "t"]

1. e4 e5 (1... c5 { [%kutu] Sicilyalı. } 2. Nf3 d6) 2. Nf3 Nc6 (2... d6 3. d4) 3. Bc4 *`);
  const c5 = idAt(tree, "e4 c5");

  it("reads [%kutu] without leaking it into the comment", () => {
    expect(tree.nodes.get(c5)!.box).toBe("");
    expect(tree.nodes.get(c5)!.comment).toBe("Sicilyalı.");
    expect(hasBoxes(tree)).toBe(true);
  });

  it("splits the chapter into the main line and the marked side line", () => {
    expect(chapterBoxes(tree)).toEqual([
      { id: "", members: [], size: 7 },
      { id: c5, members: [c5], parent: "", name: undefined, size: 3 },
    ]);
    const d6 = tree.nodes.get(tree.nodes.get(c5)!.children[0])!.children[0];
    expect(boxOf(tree, d6)).toBe(c5);
    // The way to the box (1.e4) belongs to it too, and moving on from there follows the way.
    const e4 = idAt(tree, "e4");
    expect(inBox(tree, c5, e4)).toBe(true);
    expect(nextInBox(tree, c5, e4)).toBe(c5);
    expect(nextInBox(tree, "", e4)).toBe(idAt(tree, "e4 e5"));
  });
});

describe("quickTree", () => {
  const pgn = `1. e4 e5 { [%kritik Merkez] } ( 1... c5 { [%hizli] Sicilya. } 2. Nf3 ( 2. c3 { Alapin. } ) 2... d6 ) ( 1... e6 { Fransız. } ) 2. Nf3 { Ana hat. [%deep] Derin not. } *`;
  const full = parseStudyPgn(pgn);
  const quick = quickTree(full)!;

  it("keeps the main line and marked side lines, each along its own main line", () => {
    const sans = [...quick.nodes.values()].map((n) => n.san).filter(Boolean);
    expect(sans).toEqual(["e4", "e5", "Nf3", "c5", "Nf3", "d6"]);
    expect(quick.nodes.get(idAt(full, "e4"))!.hidden).toBe(1);
    expect(quick.nodes.get(idAt(full, "e4 c5"))!.hidden).toBe(1);
  });

  it("keeps full-tree ids and drops deep notes", () => {
    expect(quick.nodes.get(idAt(full, "e4 e5 Nf3"))!.comment).toBe("Ana hat.");
    expect(quick.nodes.get(idAt(full, "e4 e5 Nf3"))!.deep).toBe("");
    expect(nearestIn(quick, full, idAt(full, "e4 e6"))).toBe(idAt(full, "e4"));
  });

  it("keeps only the first move of a line marked [%hizli tek]", () => {
    const f = parseStudyPgn(`1. e4 e5 ( 1... c5 { [%hizli tek] Sicilya, başka bölümde. } 2. Nf3 d6 ) 2. Nf3 *`);
    const q = quickTree(f)!;
    const c5 = q.nodes.get(idAt(f, "e4 c5"))!;
    expect(c5.san).toBe("c5");
    expect(c5.comment).toBe("Sicilya, başka bölümde.");
    expect(c5.children).toEqual([]);
    expect(c5.cut).toBe(true);
    expect(c5.hidden).toBeUndefined();
  });

  it("lists key moments and ignores chapters without a quick path", () => {
    expect(criticalMoments(quick).map((n) => n.critical)).toEqual(["Merkez"]);
    expect(quickTree(parseStudyPgn("1. e4 e5 *"))).toBeUndefined();
  });
});

describe("withoutFigures", () => {
  it("drops parentheses with percentages or engine figures and keeps the rest", () => {
    expect(withoutFigures("(%25) Önce rok.")).toBe("Önce rok.");
    expect(withoutFigures("Ustaların çoğu (%65). Beyaz önde (+0,4; 9.Nf3 ile −0,2).")).toBe("Ustaların çoğu. Beyaz önde.");
    expect(withoutFigures("Çevrimiçinde (Lichess 2000+) sık.")).toBe("Çevrimiçinde (Lichess 2000+) sık.");
    expect(withoutFigures("Bkz. ([[a1-d6|%40 varyantı]]).")).toBe("Bkz. ([[a1-d6|%40 varyantı]]).");
    expect(withoutFigures("Siyah ...d5 ya da ...Nxe4 ile (%40) saldırır.")).toBe("Siyah ...d5 ya da ...Nxe4 ile saldırır.");
  });

  it("drops the unsigned zero like the signed figures", () => {
    expect(withoutFigures("Motor eşit görüyor (0,0): Beyazın merkezi.")).toBe("Motor eşit görüyor: Beyazın merkezi.");
    expect(withoutFigures("Eşit (0.0).")).toBe("Eşit.");
    expect(withoutFigures("(0,0) Plan özeti: Siyah önde.")).toBe("Plan özeti: Siyah önde.");
    expect(withoutFigures("Motorun ilk tercihi 9...Ne7 (aşağıda, 0,0); fark küçük.")).toBe("Motorun ilk tercihi 9...Ne7; fark küçük.");
    expect(withoutFigures("Beyaz önde (10,0 değil; 0,05 sınırı).")).toBe("Beyaz önde (10,0 değil; 0,05 sınırı).");
  });

  it("drops parentheses that hold only game counts", () => {
    expect(withoutFigures("Ustaların çoğu (8 oyunun 6'sı).")).toBe("Ustaların çoğu.");
    expect(withoutFigures("En sık (22 oyunun 13'ü), sonra (5 oyunun 4'ü) ve (14 oyunun 10'u).")).toBe("En sık, sonra ve.");
    expect(withoutFigures("(ustaların 3 oyununun 2'si) Kale ikinci yataya geçer.")).toBe("Kale ikinci yataya geçer.");
    expect(withoutFigures("Bugün en sık 7.Bd3 (son iki yılda 18 oyunun 16'sı).")).toBe("Bugün en sık 7.Bd3.");
    expect(withoutFigures("(ustaların 16 oyununun 8'i, son iki yılda 8 oyunun 6'sı) Siyah bırakır.")).toBe("Siyah bırakır.");
    expect(withoutFigures("Ustaların tamamı (13 oyun). At h3'te.")).toBe("Ustaların tamamı. At h3'te.");
    expect(withoutFigures("Yirmiden fazla oyun varıyor (21). En sık ...Na5.")).toBe("Yirmiden fazla oyun varıyor. En sık ...Na5.");
    expect(withoutFigures("Yarı yarıya (9'a 9), hızlıda ...f5 (27 oyunun 17'si).")).toBe("Yarı yarıya, hızlıda ...f5.");
    expect(withoutFigures("Kaleyle (600), piyonla (557) aldı.")).toBe("Kaleyle, piyonla aldı.");
  });

  it("drops counts that come with moves, as a figure with moves goes", () => {
    expect(withoutFigures("Yarı yarıya (16 oyunun 8'i ...Bxe3).")).toBe("Yarı yarıya.");
    expect(withoutFigures("Biraz daha sık (39 oyunun 21'i, ...f5 18).")).toBe("Biraz daha sık.");
    expect(withoutFigures("Takas (Bxc6 bxc6, 92 oyun) olur.")).toBe("Takas olur.");
  });

  it("keeps parentheses whose words or numbers carry meaning", () => {
    for (const kept of [
      "Giri–Ding (2019) oyunu.",
      "Fil (3 kare) gider.",
      "Ana hat (7.Bb3) sık.",
      "Çevrimiçinde (Lichess 2000+) sık.",
      "Sorular: (1) Merkez kapalı mı? (2) Kim önde?",
      "Sık (27 oyunun 18'inde a6'da piyon vardı).",
      "Sık (ustaların 7 oyununun 5'i, motorun da ilk tercihi).",
      "Sık (9 ve 7 oyun).",
      "Sık (klasik oyunlarda 125 oyunun 101'inde d3, 24'ünde d4).",
      "Sık (29 oyunun hepsi 8.dxe5).",
      "Puan (+6) ve (± 8).",
      "Tata Steel (Menorca 2026) oyunu.",
      "Bkz. ([[a1-d6|8 oyunun 6'sı]]).",
    ]) expect(withoutFigures(kept)).toBe(kept);
  });
});
