import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Rocket } from "lucide-react";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button, Card, RoleNote } from "./components/ui";
import { IS_CONFIGURED, NETWORK } from "./lib/chain";
import { Overview } from "./pages/Overview";
import { Projects } from "./pages/Projects";
import { Credits } from "./pages/Credits";
import { Marketplace } from "./pages/Marketplace";
import { Certificates } from "./pages/Certificates";
import { ActivityPage } from "./pages/Activity";
import { Admin } from "./pages/Admin";

const PAGES = ["overview", "projects", "credits", "marketplace", "certificates", "activity", "admin"];

function readHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return PAGES.includes(hash) ? hash : "overview";
}

function SetupNotice() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>One step left</h1>
          <p>
            The frontend is built, but no contract addresses have been exported yet. Deploy the
            contracts, then run the export script.
          </p>
        </div>
      </div>

      <Card className="card-pad stack">
        <RoleNote warn icon={<AlertTriangle size={15} />}>
          The app is currently pointing at zero addresses, so on-chain reads are disabled.
        </RoleNote>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>
            Deploy to {NETWORK.name}:{" "}
            <code className="mono">npm run deploy:sepolia</code>
          </li>
          <li>
            Export ABIs and addresses: <code className="mono">npm run export</code>
          </li>
          <li>
            Restart the dev server: <code className="mono">npm run frontend</code>
          </li>
        </ol>
        <div className="row">
          <Button
            variant="primary"
            icon={<Rocket size={15} />}
            onClick={() => window.open("https://remix.ethereum.org", "_blank", "noreferrer")}
          >
            Open Remix
          </Button>
          <span className="small muted">
            Or follow the Remix deployment steps in the README.
          </span>
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState(readHash);
  const [creditsProject, setCreditsProject] = useState(null);

  useEffect(() => {
    const onHashChange = () => setPage(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next) => {
    if (!PAGES.includes(next)) return;
    window.location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const issueForProject = useCallback(
    (projectId) => {
      setCreditsProject(projectId);
      navigate("credits");
    },
    [navigate]
  );

  return (
    <Layout page={page} onNavigate={navigate}>
      <ErrorBoundary key={page}>
      {!IS_CONFIGURED ? (
        <SetupNotice />
      ) : page === "overview" ? (
        <Overview onNavigate={navigate} />
      ) : page === "projects" ? (
        <Projects onIssueCredits={issueForProject} />
      ) : page === "credits" ? (
        <Credits
          prefillProjectId={creditsProject}
          clearPrefill={() => setCreditsProject(null)}
        />
      ) : page === "marketplace" ? (
        <Marketplace />
      ) : page === "certificates" ? (
        <Certificates />
      ) : page === "activity" ? (
        <ActivityPage />
      ) : (
        <Admin />
      )}
      </ErrorBoundary>
    </Layout>
  );
}
