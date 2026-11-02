import type { ReactNode } from "react";
import { ProjectContext, useProjectState } from "@/hooks/useProject";

export default function ProjectProvider({ children }: { children: ReactNode }) {
  const value = useProjectState();
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
