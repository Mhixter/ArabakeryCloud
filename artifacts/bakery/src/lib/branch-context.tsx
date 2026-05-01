import { createContext, useContext, useState, useEffect } from "react";
import { getStoredUser } from "./auth";

interface ActiveBranch {
  id: number;
  name: string;
}

interface BranchContextValue {
  activeBranch: ActiveBranch | null;
  setActiveBranch: (branch: ActiveBranch | null) => void;
  isBranchLocked: boolean;
}

const BranchContext = createContext<BranchContextValue>({
  activeBranch: null,
  setActiveBranch: () => {},
  isBranchLocked: false,
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [activeBranch, setActiveBranch] = useState<ActiveBranch | null>(() => {
    const user = getStoredUser();
    if (user?.branchId && user?.branchName) {
      return { id: user.branchId, name: user.branchName };
    }
    return null;
  });

  useEffect(() => {
    const user = getStoredUser();
    if (user?.branchId && user?.branchName) {
      setActiveBranch({ id: user.branchId, name: user.branchName });
    }
  }, []);

  const user = getStoredUser();
  const isBranchLocked = !!(user?.branchId && user?.role !== "managing_director");

  const handleSetBranch = (branch: ActiveBranch | null) => {
    if (isBranchLocked) return;
    setActiveBranch(branch);
  };

  return (
    <BranchContext.Provider value={{ activeBranch, setActiveBranch: handleSetBranch, isBranchLocked }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useActiveBranch() {
  return useContext(BranchContext);
}
