export const getToken = () => localStorage.getItem("nmb_token");
export const setToken = (t: string) => localStorage.setItem("nmb_token", t);
export const clearToken = () => localStorage.removeItem("nmb_token");
export const isAuthenticated = () => !!getToken();

export const getStoredUser = () => {
  const raw = localStorage.getItem("nmb_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: number; username: string; fullName: string; role: string; branchId: number | null };
  } catch {
    return null;
  }
};

export const setStoredUser = (user: unknown) => {
  localStorage.setItem("nmb_user", JSON.stringify(user));
};

export const clearStoredUser = () => {
  localStorage.removeItem("nmb_user");
};
