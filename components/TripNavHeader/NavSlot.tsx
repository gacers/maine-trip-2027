"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

// Two DOM slots published by TripNavHeader and consumed by SectionPage
// via portals — lets section actions render inside the sticky nav /
// mobile drawer despite living in a different part of the tree
// (TripNavHeader is in the trip layout, SectionPage in the page).
//   - slot: desktop header row (Add + Sheet/Sort/Filter) and, below
//     1024px, Add only — secondary actions hide via CSS there
//   - mobileActionsSlot: inside the burger drawer; UtilityControls
//     portals Sheet/Sort/Filter/Mark-all here so small screens keep
//     only +Add next to the hamburger
interface NavSlotContextValue {
  slot: HTMLDivElement | null;
  setSlot: Dispatch<SetStateAction<HTMLDivElement | null>>;
  mobileActionsSlot: HTMLDivElement | null;
  setMobileActionsSlot: Dispatch<SetStateAction<HTMLDivElement | null>>;
}

const NavSlotContext = createContext<NavSlotContextValue | null>(null);

export function NavSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [mobileActionsSlot, setMobileActionsSlot] = useState<HTMLDivElement | null>(null);
  return (
    <NavSlotContext.Provider value={{ slot, setSlot, mobileActionsSlot, setMobileActionsSlot }}>{children}</NavSlotContext.Provider>
  );
}

export function useNavSlot() {
  return useContext(NavSlotContext);
}
