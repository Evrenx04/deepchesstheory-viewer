import { createContext, useContext } from "react";
import type { Notation } from "./notation";

export const NotationContext = createContext<Notation>("figurine");
export const useNotation = () => useContext(NotationContext);
