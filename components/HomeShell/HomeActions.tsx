"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

interface HomeActionsContextValue {
  categoryActions: ReactNode;
  setCategoryActions: Dispatch<SetStateAction<ReactNode>>;
}

const HomeActionsContext = createContext<HomeActionsContextValue | null>(null);

export function HomeActionsProvider({ children }: { children: ReactNode }) {
  const [categoryActions, setCategoryActions] = useState<ReactNode>(null);
  return (
    <HomeActionsContext.Provider value={{ categoryActions, setCategoryActions }}>{children}</HomeActionsContext.Provider>
  );
}

export function useHomeActions() {
  return useContext(HomeActionsContext);
}
