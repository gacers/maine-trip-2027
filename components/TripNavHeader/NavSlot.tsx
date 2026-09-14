"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

// A single DOM slot, published by TripNavHeader (inside its sub-nav
// row) and consumed by SectionPage via a portal — lets the filter/sort
// controls render physically inside the sticky nav bar despite living
// in a totally different part of the component tree (TripNavHeader is
// in the trip layout, SectionPage in the page). The layout persists
// across section navigations, so the slot node itself is stable; only
// its *content* (via the portal) changes per page.
interface NavSlotContextValue {
  slot: HTMLDivElement | null;
  setSlot: Dispatch<SetStateAction<HTMLDivElement | null>>;
}

const NavSlotContext = createContext<NavSlotContextValue | null>(null);

export function NavSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return <NavSlotContext.Provider value={{ slot, setSlot }}>{children}</NavSlotContext.Provider>;
}

export function useNavSlot() {
  return useContext(NavSlotContext);
}
