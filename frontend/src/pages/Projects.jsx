import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  FileText,
  Leaf,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Layers,
} from "lucide-react";
import { keccak256, toUtf8Bytes } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import { useRoles } from "../hooks/useRoles";
import { useTx } from "../hooks/useTx";
import { formatNumber, initials, percent, shortAddress } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Progress,
  QueryError,
  RoleNote,
  Skeleton,
  Tabs,
} from "../components/ui";

const EMPTY_FORM = {
  name: "",
  location: "",
  methodology: "",
  capacity: "",
  documentRef: "",
  fileHash: "",
  fileName: "",
};

export function Projects({ onIssueCredits }) {
  const { contracts, account } = useWallet();
  const roles = useRoles();
  const { send } = useTx();

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState(null);

  const query = useQuery(async () => {
    const [list, total] = await contracts.registry.getProjects(0, 500);
    return { list: [...list].reverse(), total };
  }, [contracts]);

  const projects = query.data?.list || [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (tab === "verified" && !project.verified) return false;
      if (tab === "pending" && project.verified) return false;
      if (!term) return true;
      return (
        project.name.toLowerCase().includes(term) ||
        project.location.toLowerCase().includes(term) ||
        project.methodology.toLowerCase().includes(term)
      );
    });
  }, [projects, tab, search]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = async (file) => {
    if (!file) {
      update("fileHash", "");
      update("fileName", "");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const hash = keccak256(new Uint8Array(buffer));
      setForm((prev) => ({ ...prev, fileHash: hash, fileName: file.name }));
    } catch {
      setFormError("Could not hash that file.");
    }
  };

  const documentHash = form.fileHash || (form.documentRef ? keccak256(toUtf8Bytes(form.documentRef)) : "");

  const canSubmit =
    form.name.trim().length >= 3 &&
    form.location.trim().length >= 2 &&
    form.methodology.trim().length >= 3 &&
    Number(form.capacity) > 0 &&
    Boolean(documentHash) &&
    !submitting;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const register = async () => {
    setFormError("");
    if (!account) {
      setFormError("Connect your wallet first.");
      return;
    }
    if (!canSubmit) {
      setFormError("Please complete every field with a valid document hash.");
      return;
    }
    setSubmitting(true);
    try {
      await send(
        () =>
          contracts.registry.registerProject(
            form.name.trim(),
            form.location.trim(),
            form.methodology.trim(),
            documentHash,
            BigInt(Math.floor(Number(form.capacity)))
          ),
        {
          pending: "Registering project on-chain…",
          success: "Project registered - awaiting verification",
        }
      );
      setFormOpen(false);
      resetForm();
    } catch {
      /* toast already shown */
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async (project) => {
    try {
      await send(() => contracts.registry.verifyProject(project.id), {
        pending: "Verifying project…",
        success: `Project #${project.id} verified`,
      });
    } catch {
      /* ignore */
    }
  };

  const revoke = async (project) => {
    try {
      await send(() => contracts.registry.revokeVerification(project.id), {
        pending: "Revoking verification…",
        success: `Verification revoked for project #${project.id}`,
      });
      setConfirm(null);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Project registry</h1>
          <p>
            Every carbon-offset project is registered with a hashed methodology document and must
            be verified by an authorised verifier before it can issue credits.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setFormOpen(true)}>
            Register project
          </Button>
        </div>
      </div>

      {!roles.verifier && account ? (
        <RoleNote>
          You can register a project, but only accounts with <strong>VERIFIER_ROLE</strong> can
          verify it. Connect as the deployer or ask an admin to grant the role.
        </RoleNote>
      ) : null}

      <Card>
        <div className="card-head">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: "All", count: projects.length },
              {
                value: "verified",
                label: "Verified",
                count: projects.filter((p) => p.verified).length,
              },
              {
                value: "pending",
                label: "Pending",
                count: projects.filter((p) => !p.verified).length,
              },
            ]}
          />
          <div className="card-head-actions">
            <div className="input-group" style={{ maxWidth: 260 }}>
              <input
                className="input"
                placeholder="Search projects…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search projects"
                style={{ minHeight: 36, height: 36 }}
              />
              <span className="icon-btn" aria-hidden="true">
                <Search size={15} />
              </span>
            </div>
          </div>
        </div>

        {query.error ? (
          <div className="card-pad">
            <QueryError error={query.error} />
          </div>
        ) : query.loading && !query.data ? (
          <div className="card-pad grid grid-2">
            {[0, 1, 2, 3].map((key) => (
              <Card key={key} className="card-pad stack" style={{ gap: 12 }}>
                <Skeleton height={38} width={38} style={{ borderRadius: 11 }} />
                <Skeleton height={14} width="70%" />
                <Skeleton height={10} width="45%" />
                <Skeleton height={8} />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Leaf size={20} />}
            title={projects.length === 0 ? "No projects registered yet" : "No matching projects"}
            description={
              projects.length === 0
                ? "Register the first carbon-offset project to start issuing verifiable credits."
                : "Try a different search term or switch the filter."
            }
            action={
              projects.length === 0 ? (
                <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                  Register project
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="card-pad grid grid-2">
            {filtered.map((project) => {
              const usage = percent(project.issuedTonnes, project.annualCapacityTonnes);
              return (
                <Card key={project.id.toString()} className="project-card">
                  <div className="project-card-top">
                    <span className="project-avatar">{initials(project.name)}</span>
                    <div className="grow">
                      <div className="project-name">{project.name}</div>
                      <div className="loc">
                        <MapPin size={11} /> {project.location}
                      </div>
                    </div>
                    {project.verified ? (
                      <Badge tone="green" dot>
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="amber">Pending</Badge>
                    )}
                  </div>

                  <div className="method">
                    <FileText size={11} style={{ verticalAlign: -1, marginRight: 5 }} />
                    {project.methodology}
                  </div>

                  <div>
                    <div className="project-metrics" style={{ marginBottom: 5 }}>
                      <span>
                        Issued <strong>{formatNumber(project.issuedTonnes, 0)}</strong> /{" "}
                        {formatNumber(project.annualCapacityTonnes, 0)} t
                      </span>
                      <span>{usage.toFixed(0)}%</span>
                    </div>
                    <Progress value={usage} lime />
                  </div>

                  <div className="row between small muted">
                    <span className="mono" title={project.developer}>
                      by {shortAddress(project.developer)}
                    </span>
                    <span>ID #{project.id.toString()}</span>
                  </div>

                  <div className="project-actions">
                    {roles.verifier && !project.verified ? (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<ShieldCheck size={13} />}
                        onClick={() => verify(project)}
                      >
                        Verify
                      </Button>
                    ) : null}
                    {roles.verifier && project.verified ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<ShieldOff size={13} />}
                        onClick={() => setConfirm(project)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                    {roles.minter && project.verified ? (
                      <Button
                        size="sm"
                        variant="lime"
                        icon={<Layers size={13} />}
                        onClick={() => onIssueCredits(project.id.toString())}
                      >
                        Issue credits
                      </Button>
                    ) : null}
                    {!roles.verifier && !roles.minter ? (
                      <Badge tone="gray">
                        <BadgeCheck size={11} /> Read-only
                      </Badge>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          resetForm();
        }}
        title="Register a project"
        subtitle="The methodology document is hashed locally - only the hash goes on-chain."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} disabled={!canSubmit} onClick={register}>
              Register on-chain
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="full">
            <Field label="Project name">
              <input
                className="input"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Western Ghats Reforestation"
                maxLength={80}
              />
            </Field>
          </div>
          <Field label="Location">
            <input
              className="input"
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
              placeholder="Karnataka, India"
              maxLength={80}
            />
          </Field>
          <Field label="Annual capacity (tCO2e)">
            <input
              className="input"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(event) => update("capacity", event.target.value)}
              placeholder="12000"
            />
          </Field>
          <div className="full">
            <Field label="Methodology">
              <input
                className="input"
                value={form.methodology}
                onChange={(event) => update("methodology", event.target.value)}
                placeholder="Verra VM0047 v1.0 - Afforestation"
                maxLength={120}
              />
            </Field>
          </div>
          <div className="full">
            <Field
              label="Methodology document"
              hint="Upload the PDF, or paste a document reference. We compute keccak256 in the browser."
            >
              <input
                className="input"
                type="file"
                accept=".pdf,.txt,.md,.json,.doc,.docx"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </Field>
          </div>
          <div className="full">
            <Field label="…or document reference">
              <input
                className="input"
                value={form.documentRef}
                onChange={(event) => update("documentRef", event.target.value)}
                placeholder="western-ghats-methodology-2025.pdf"
                disabled={Boolean(form.fileHash)}
              />
            </Field>
          </div>
          {documentHash ? (
            <div className="full">
              <div className="small muted" style={{ marginBottom: 4 }}>
                Document hash ({form.fileName || "reference"})
              </div>
              <div className="mono small" style={{ wordBreak: "break-all" }}>
                {documentHash}
              </div>
            </div>
          ) : null}
          {formError ? (
            <div className="full">
              <RoleNote warn icon={<AlertTriangle size={15} />}>
                {formError}
              </RoleNote>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Revoke project #${confirm?.id ?? ""}?`}
        subtitle="Revoking stops the project from issuing new credits. Existing credits stay valid."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep verified
            </Button>
            <Button variant="danger" onClick={() => confirm && revoke(confirm)}>
              Revoke verification
            </Button>
          </>
        }
      >
        <p className="small muted">
          This action is recorded on-chain and is visible in the public activity feed. The project
          developer can be re-verified later by an authorised verifier.
        </p>
      </Modal>
    </div>
  );
}
