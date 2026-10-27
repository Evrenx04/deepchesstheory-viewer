import { afterEach, describe, expect, it } from "vitest";
import { browserLang } from "../lib/settings";

const setLanguages = (languages: string[]) => Object.defineProperty(window.navigator, "languages", { value: languages, configurable: true });

describe("the language of a first visit", () => {
  afterEach(() => setLanguages(["tr-TR", "tr"]));

  it("is Turkish for a browser that lists Turkish anywhere", () => {
    setLanguages(["tr-TR"]);
    expect(browserLang()).toBe("tr");
    setLanguages(["de-DE", "tr"]);
    expect(browserLang()).toBe("tr");
  });

  it("is English for every other browser, German included", () => {
    setLanguages(["de-DE", "de"]);
    expect(browserLang()).toBe("en");
    setLanguages(["en-US"]);
    expect(browserLang()).toBe("en");
  });
});
