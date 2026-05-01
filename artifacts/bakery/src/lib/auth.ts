export const getToken = () => localStorage.getItem("nmb_token");
export const setToken = (t: string) => localStorage.setItem("nmb_token", t);
export const clearToken = () => localStorage.removeItem("nmb_token");
export const isAuthenticated = () => !!getToken();

export const getStoredUser = () => {
  const raw = localStorage.getItem("nmb_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: number; username: string; fullName: string; role: string; branchId: number | null; branchName?: string; companyId: number };
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

export interface StoredCompany {
  id: number;
  name: string;
  phone: string | null;
  logoUrl: string | null;
  themeColor: string;
  address: string | null;
}

export const getStoredCompany = (): StoredCompany | null => {
  const raw = localStorage.getItem("nmb_company");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCompany;
  } catch {
    return null;
  }
};

export const setStoredCompany = (company: unknown) => {
  localStorage.setItem("nmb_company", JSON.stringify(company));
};

export const clearStoredCompany = () => {
  localStorage.removeItem("nmb_company");
};
