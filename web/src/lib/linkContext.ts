import { createContext, useContext } from "react";

/** Resolves a [[name|text]] link to a hash URL, or undefined if the name is unknown. */
export const LinkContext = createContext<(name: string) => string | undefined>(() => undefined);
export const useLinkResolver = () => useContext(LinkContext);
