import { createContext, useContext, useState } from "react";
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

const STORAGE_KEY = "nmb_active_branch";

function readPersistedBranch(): ActiveBranch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveBranch) : null;
  } catch {
    return null;
  }
}

function initBranch(): ActiveBranch | null {
  const user = getStoredUser();
  // Branch-locked users always use their own branch
  if (user?.branchId && user?.branchName) {
    return { id: user.branchId, name: user.branchName };
  }
  // MD/managers without a fixed branch: restore their last-selected branch
  return readPersistedBranch();
}

const BranchContext = createContext<BranchContextValue>({
  activeBranch: null,
  setActiveBranch: () => {},
  isBranchLocked: false,
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [activeBranch, setActiveBranchState] = useState<ActiveBranch | null>(initBranch);

  const user = getStoredUser();
  const isBranchLocked = !!(user?.branchId && user?.role !== "managing_director");

  const setActiveBranch = (branch: ActiveBranch | null) => {
    if (isBranchLocked) return;
    setActiveBranchState(branch);
    // Persist the MD's choice so it survives page refresh
    if (branch) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(branch));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <BranchContext.Provider value={{ activeBranch, setActiveBranch, isBranchLocked }}>
      {children}
    </BranchContext.Provider>
  );
}

/** Call on logout to clear the persisted branch selection */
export function clearPersistedBranch() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useActiveBranch() {
  return useContext(BranchContext);
}
