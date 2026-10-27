import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// The tests are written for the Turkish interface: a Turkish browser, so a first visit opens in Turkish (lib/settings.ts).
Object.defineProperty(window.navigator, "languages", { value: ["tr-TR", "tr"], configurable: true });

afterEach(cleanup);
