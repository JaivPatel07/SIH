import { createContext, useContext, useMemo, useState } from "react";

export type Role = "user" | "authority";

type RoleContextValue = {
  role: Role;
  setRole: (role: Role) => void;
  isAuthority: boolean;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const stored = sessionStorage.getItem("pravaah-role");
    return stored === "authority" ? "authority" : "user";
  });

  const setRole = (nextRole: Role) => {
    sessionStorage.setItem("pravaah-role", nextRole);
    setRoleState(nextRole);
  };

  const value = useMemo(() => ({ role, setRole, isAuthority: role === "authority" }), [role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useRole must be used inside RoleProvider");
  return value;
}
