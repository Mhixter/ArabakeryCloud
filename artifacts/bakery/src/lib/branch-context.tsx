import { createContext, useContext, useState } from "react";

interface ActiveBranch {
  id: number;
  name: string;
}

interface BranchContextValue {
  activeBranch: ActiveBranch | null;
  setActiveBranch: (branch: ActiveBranch | null) => void;
}

const BranchContext = createContext<BranchContextValue>({
  activeBranch: null,
  setActiveBranch: () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [activeBranch, setActiveBranch] = useState<ActiveBranch | null>(null);
  return (
    <BranchContext.Provider value={{ activeBranch, setActiveBranch }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useActiveBranch() {
  return useContext(BranchContext);
}
