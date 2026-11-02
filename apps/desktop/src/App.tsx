import ProjectProvider from "@/modules/ProjectProvider";
import Shell from "@/modules/Shell";

export default function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
