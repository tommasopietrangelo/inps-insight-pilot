import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer";
}

interface WorkspaceContextValue {
  current: Workspace | null;
  workspaces: Workspace[];
  setCurrent: (id: string) => void;
  setWorkspaces: (ws: Workspace[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
const STORAGE_KEY = "inpscopilot.currentWorkspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspacesState] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentId(localStorage.getItem(STORAGE_KEY));
    }
  }, []);

  const setCurrent = (id: string) => {
    setCurrentId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  const setWorkspaces = (ws: Workspace[]) => {
    setWorkspacesState(ws);
    if (ws.length && (!currentId || !ws.find((w) => w.id === currentId))) {
      setCurrent(ws[0].id);
    }
  };

  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  return (
    <WorkspaceContext.Provider value={{ current, workspaces, setCurrent, setWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
