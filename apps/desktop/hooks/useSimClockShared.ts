import { createContext, useContext } from "react";
import type { SharedSimClock } from "@/types/simulate";

export const SimClockContext = createContext<SharedSimClock | null>(null);

export const useSharedSimClock = (): SharedSimClock => {
  const value = useContext(SimClockContext);
  if (!value) throw new Error("useSharedSimClock must be used inside SimClockProvider");
  return value;
};
