import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { CommentPanel, notePieces } from "../components/CommentPanel";
import { mainlineAt, parseStudyPgn } from "../lib/pgnTree";
import { setLang } from "../lib/i18n";

afterEach(() => setLang("tr"));

describe("CommentPanel", () => {
  const tree = parseStudyPgn('[Event "Deneme"]\n\n1. e4 e5 2. Nf3 *');
  const node = tree.nodes.get(mainlineAt(tree, 2))!;
  const panel = (question?: boolean) =>
    render(<CommentPanel node={node} showDeep={false} onToggleDeep={() => {}} question={question} />).container.textContent;

  it("says a move has no comment, except where a question is open (both languages)", () => {
    expect(panel()).toContain("Bu hamlede");
    expect(panel(true)).not.toContain("Bu hamlede");
    setLang("en");
    expect(panel()).toContain("No comment");
    expect(panel(true)).not.toContain("No comment");
  });
});

describe("long notes in pieces", () => {
  const long =
    "At e3'te çok iyi. Konum dengeli, iki tarafın planı da belli:\n- Beyaz merkezde exd5 ya da d4 kırılmasıyla oynar.\n- Siyah ...Ne7-g6 ile şah kanadına taş getirir.\n\nBu konumun örnek oyunu Navara–Wojtaszek.";

  it("splits paragraphs and keeps a list as one piece", () => {
    expect(notePieces(long)).toHaveLength(3);
    expect(notePieces(long)[1].split("\n")).toHaveLength(2);
  });

  it("leaves a short note whole", () => {
    expect(notePieces("Tek paragraf, kısa bir not.")).toHaveLength(1);
    expect(notePieces("Birinci kısa paragraf.\n\nİkinci kısa paragraf.")).toHaveLength(1);
  });

  it("opens with Devam, ends with Aklında kalsın, and Hepsini göster opens it all", () => {
    const tree = parseStudyPgn(`[Event "Deneme"]\n\n1. e4 {${long}} e5 *`);
    const node = tree.nodes.get(mainlineAt(tree, 1))!;
    const view = render(<CommentPanel node={node} showDeep={false} onToggleDeep={() => {}} takeaways={["Kalsın bu."]} />);
    expect(view.container.textContent).not.toContain("Navara");
    fireEvent.click(view.getByText("Devam · 3 parça daha"));
    expect(view.container.textContent).toContain("şah kanadına");
    expect(view.container.textContent).not.toContain("Kalsın bu.");
    fireEvent.click(view.getByText("Hepsini göster"));
    expect(view.container.textContent).toContain("Navara");
    expect(view.container.textContent).toContain("Kalsın bu.");
    expect(view.queryByText("Hepsini göster")).toBeNull();
  });
});
