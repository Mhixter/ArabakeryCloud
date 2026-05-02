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

/** Per-user storage key so each user's branch preference is independent */
function getBranchKey(): string {
  const user = getStoredUser();
  return user ? `nmb_active_branch_${user.id}` : "nmb_active_branch";
}

function readPersistedBranch(): ActiveBranch | null {
  try {
    const raw = localStorage.getItem(getBranchKey());
    return raw ? (JSON.parse(raw) as ActiveBranch) : null;
  } catch {
    return null;
  }
}

function savePersistedBranch(branch: ActiveBranch | null) {
  const key = getBranchKey();
  if (branch) {
    localStorage.setItem(key, JSON.stringify(branch));
  } else {
    localStorage.removeItem(key);
  }
}

function initBranch(): ActiveBranch | null {
  const user = getStoredUser();
  // MDs can freely switch branches — always restore their last persisted selection.
  // Non-MD staff who are assigned to a specific branch are locked to that branch.
  const isBranchLocked = !!(user?.branchId && user?.role !== "managing_director");
  if (isBranchLocked && user?.branchId && user?.branchName) {
    return { id: user.branchId, name: user.branchName };
  }
  // MD / managers without a fixed branch: restore from localStorage
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
    // Persist per user — survives page refresh AND logout/re-login as the same user
    savePersistedBranch(branch);
  };

  return (
    <BranchContext.Provider value={{ activeBranch, setActiveBranch, isBranchLocked }}>
      {children}
    </BranchContext.Provider>
  );
}

/**
 * No longer clears branch on logout — the branch preference is now keyed by
 * user ID so it persists across logout/re-login as the same account.
 * Kept for backward-compat call sites.
 */
export function clearPersistedBranch() {
  // intentionally a no-op — branch survives logout so the user returns to
  // the same branch next time they sign back in
}

export function useActiveBranch() {
  return useContext(BranchContext);
}
