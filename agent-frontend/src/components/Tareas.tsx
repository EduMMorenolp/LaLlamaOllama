import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  List,
  Loader2,
  Play,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config";
import { useToast } from "../contexts/ToastContext";
import { useWs } from "../contexts/WebSocketContext";

interface Run {
  id: number;
  chatId: string;
  userText: string;
  origin: string;
  status: string;
  model?: string | null;
  resultText?: string | null;
  errorText?: string | null;
  latencyMs?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface RunEvent {
  id: number;
  runId: number;
  type: string;
  payload: string;
  created_at?: string;
}

interface ScheduledTask {
  id: number;
  name: string;
  task_text: string;
  cron_expression: string;
  mode_id?: string;
  enabled: boolean;
  created_at?: string;
}

type StatusFilter = "all" | "queued" | "running" | "completed" | "failed" | "cancelled" | "scheduled";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Todas",
  queued: "En cola",
  running: "Ejecutando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Canceladas",
  scheduled: "Programadas",
};

const ORIGIN_ICONS: Record<string, string> = {
  web: String.fromCodePoint(0x1F310),
  telegram: String.fromCodePoint(0x1F4F1),
  scheduler: String.fromCodePoint(0x23F0),
  tool: String.fromCodePoint(0x1F527),
};

const HISTORY_FILTERS: StatusFilter[] = ["all", "queued", "running", "completed", "failed", "cancelled"];

type TabMode = "history" | "scheduled";

export const Tareas: React.FC = () => {
  const { send: sendWs, subscribe } = useWs();
  const { show: showToast } = useToast();

  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<RunEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tabMode, setTabMode] = useState<TabMode>("history");

  // Nueva Tarea modal
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");

  // Scheduled tasks
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [showScheduledForm, setShowScheduledForm] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedCron, setSchedCron] = useState("");
  const [schedTaskText, setSchedTaskText] = useState("");
  const [schedModeId, setSchedModeId] = useState("");

  const apiHeaders = { "X-API-Key": config.apiKey };

  // Fetch runs (history)
  const fetchRuns = useCallback(
    async (append = false) => {
      try {
        const currentOffset = append ? offsetRef.current : 0;
        const params = new URLSearchParams();
        if (statusFilter !== "all" && statusFilter !== "scheduled") {
          params.set("status", statusFilter);
        }
        params.set("limit", "50");
        params.set("offset", String(currentOffset));
        const res = await fetch(config.engineUrl + "/api/runs?" + params, { headers: apiHeaders });
        const data = await res.json();
        const newRuns = data.runs || [];
        if (append) {
          setRuns((prev) => [...prev, ...newRuns]);
        } else {
          setRuns(newRuns);
        }
        offsetRef.current = currentOffset + newRuns.length;
        setHasMore(newRuns.length === 50);
      } catch (err) {
        console.error("Failed to fetch runs", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    if (tabMode === "history") {
      setLoading(true);
      offsetRef.current = 0;
      setHasMore(true);
      fetchRuns(false);
    }
  }, [statusFilter, tabMode, fetchRuns]);

  // Fetch scheduled tasks
  const fetchScheduledTasks = useCallback(async () => {
    setScheduledLoading(true);
    try {
      const res = await fetch(config.engineUrl + "/api/scheduled-tasks", { headers: apiHeaders });
      const data = await res.json();
      setScheduledTasks(data.scheduledTasks || data.tasks || []);
    } catch (err) {
      console.error("Failed to fetch scheduled tasks", err);
    } finally {
      setScheduledLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabMode === "scheduled") {
      fetchScheduledTasks();
    }
  }, [tabMode, fetchScheduledTasks]);

  // WS subscriptions
  useEffect(() => {
    const unsub = subscribe((msg: { type: string; payload?: Record<string, unknown> }) => {
      switch (msg.type) {
        case "task_created": {
          const task = msg.payload as unknown as Run;
          setRuns((prev) => [task, ...prev]);
          showToast("Nueva tarea creada", "success");
          break;
        }
        case "task_status": {
          const p = (msg.payload || {}) as Record<string, unknown>;
          const runId = p.runId as number | undefined;
          const status = p.status as string | undefined;
          if (runId != null && status) {
            setRuns((prev) =>
              prev.map((r) => (r.id === Number(runId) ? { ...r, status } : r))
            );
          }
          break;
        }
        case "task_cancelled": {
          const p = (msg.payload || {}) as Record<string, unknown>;
          const runId = p.runId as number | undefined;
          if (runId != null) {
            setRuns((prev) =>
              prev.map((r) => (r.id === Number(runId) ? { ...r, status: "cancelled" } : r))
            );
            showToast("Tarea cancelada", "info");
          }
          break;
        }
        case "task_completed": {
          const p = (msg.payload || {}) as Record<string, unknown>;
          const runId = p.runId as number | undefined;
          if (runId != null) {
            setRuns((prev) =>
              prev.map((r) => (r.id === Number(runId) ? { ...r, status: "completed" } : r))
            );
          }
          break;
        }
        case "task_failed": {
          const p = (msg.payload || {}) as Record<string, unknown>;
          const runId = p.runId as number | undefined;
          if (runId != null) {
            setRuns((prev) =>
              prev.map((r) => (r.id === Number(runId) ? { ...r, status: "failed" } : r))
            );
          }
          break;
        }
      }
    });
    return () => {
      unsub();
    };
  }, [subscribe, showToast]);

  const openDetail = async (run: Run) => {
    setSelectedRun(run);
    setDetailLoading(true);
    try {
      const res = await fetch(config.engineUrl + "/api/runs/" + run.id, { headers: apiHeaders });
      const data = await res.json();
      setSelectedEvents(data.events || []);
    } catch {
      setSelectedEvents([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancelTask = (runId: number) => {
    sendWs("cancel_task", { runId });
    showToast("Cancelando tarea...", "info");
  };

  const handleNewTask = () => {
    if (!newTaskText.trim()) return;
    sendWs("new_task", { text: newTaskText.trim() });
    setNewTaskText("");
    setShowNewTaskModal(false);
    showToast("Tarea enviada", "success");
  };

  // Scheduled task CRUD
  const handleToggleScheduled = async (id: number) => {
    try {
      await fetch(config.engineUrl + "/api/scheduled-tasks/" + id + "/toggle", {
        method: "POST",
        headers: apiHeaders,
      });
      fetchScheduledTasks();
    } catch (err) {
      console.error("Failed to toggle scheduled task", err);
    }
  };

  const handleDeleteScheduled = async (id: number) => {
    try {
      await fetch(config.engineUrl + "/api/scheduled-tasks/" + id, {
        method: "DELETE",
        headers: apiHeaders,
      });
      setScheduledTasks((prev) => prev.filter((t) => t.id !== id));
      showToast("Tarea programada eliminada", "info");
    } catch (err) {
      console.error("Failed to delete scheduled task", err);
    }
  };

  const handleExecuteScheduled = (task: ScheduledTask) => {
    sendWs("new_task", { text: task.task_text });
    showToast("Tarea ejecutada", "success");
  };

  const handleCreateScheduled = async () => {
    if (!schedName.trim() || !schedCron.trim() || !schedTaskText.trim()) return;
    try {
      const res = await fetch(config.engineUrl + "/api/scheduled-tasks", {
        method: "POST",
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: schedName.trim(),
          cron_expression: schedCron.trim(),
          task_text: schedTaskText.trim(),
          mode_id: schedModeId.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowScheduledForm(false);
        setSchedName("");
        setSchedCron("");
        setSchedTaskText("");
        setSchedModeId("");
        fetchScheduledTasks();
        showToast("Tarea programada creada", "success");
      }
    } catch (err) {
      console.error("Failed to create scheduled task", err);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={14} style={{ color: "var(--success)" }} />;
      case "running":
        return <Loader2 size={14} style={{ color: "var(--accent)" }} className="animate-spin" />;
      case "queued":
        return <Clock size={14} style={{ color: "var(--warning)" }} />;
      case "failed":
        return <XCircle size={14} style={{ color: "var(--error)" }} />;
      case "cancelled":
        return <XCircle size={14} style={{ color: "var(--text-muted)" }} />;
      default:
        return <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "rgba(16,185,129,0.15)";
      case "running":
        return "rgba(79,140,255,0.15)";
      case "queued":
        return "rgba(245,158,11,0.15)";
      case "failed":
        return "rgba(239,68,68,0.15)";
      case "cancelled":
        return "rgba(255,255,255,0.05)";
      default:
        return "rgba(255,255,255,0.03)";
    }
  };

  return (
    <div style={{ height: "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
      {/* Tab bar + Nueva Tarea */}
      <div style={{ display: "flex", gap: "8px", padding: "0 0 12px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setTabMode("history")}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "1px solid var(--border-light)",
            background: tabMode === "history" ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
            color: tabMode === "history" ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <List size={14} />
          Historial
        </button>
        <button
          type="button"
          onClick={() => setTabMode("scheduled")}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "1px solid var(--border-light)",
            background: tabMode === "scheduled" ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
            color: tabMode === "scheduled" ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Calendar size={14} />
          Programadas
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowNewTaskModal(true)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "1px solid var(--accent)",
            background: "rgba(79,140,255,0.15)",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Plus size={14} />
          Nueva Tarea
        </button>
      </div>

      {/* History tab */}
      {tabMode === "history" && (
        <>
          {/* Status filters */}
          <div style={{ display: "flex", gap: "8px", padding: "0 0 16px", flexWrap: "wrap" }}>
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  background: statusFilter === f ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
                  color: statusFilter === f ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Task List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
                Cargando tareas...
              </div>
            ) : runs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
                No hay tareas {statusFilter !== "all" ? `con estado "${FILTER_LABELS[statusFilter]}"` : ""}.
              </div>
            ) : (
              <>
                {runs.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => openDetail(run)}
                    style={{
                      padding: "12px 16px",
                      marginBottom: "6px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-light)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-glow)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-light)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {statusIcon(run.status)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--text-main)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {run.userText || "(sin texto)"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            marginTop: "4px",
                            fontSize: "10px",
                            color: "var(--text-dim)",
                            alignItems: "center",
                          }}
                        >
                          {run.created_at && <span>{new Date(run.created_at).toLocaleString()}</span>}
                          {run.model && (
                            <span style={{ color: "var(--accent)", fontFamily: "monospace" }}>{run.model}</span>
                          )}
                          {run.latencyMs != null && <span>{(run.latencyMs / 1000).toFixed(1)}s</span>}
                          {/* Origin indicator */}
                          <span title={run.origin}>{ORIGIN_ICONS[run.origin] || "(" + run.origin + ")"}</span>
                        </div>
                      </div>

                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          background: statusColor(run.status),
                          color:
                            run.status === "completed"
                              ? "var(--success)"
                              : run.status === "failed"
                                ? "var(--error)"
                                : run.status === "running"
                                  ? "var(--accent)"
                                  : run.status === "cancelled"
                                    ? "var(--text-muted)"
                                    : "var(--warning)",
                        }}
                      >
                        {FILTER_LABELS[run.status as StatusFilter] || run.status}
                      </span>
                      {/* Cancel button */}
                      {(run.status === "queued" || run.status === "running") && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelTask(run.id);
                          }}
                          title="Cancelar tarea"
                          style={{
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "4px",
                            color: "var(--error)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div style={{ textAlign: "center", padding: "16px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setLoadingMore(true);
                        fetchRuns(true);
                      }}
                      disabled={loadingMore}
                      style={{
                        padding: "8px 20px",
                        background: "rgba(79,140,255,0.1)",
                        border: "1px solid rgba(79,140,255,0.2)",
                        borderRadius: "8px",
                        color: "var(--accent)",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                        opacity: loadingMore ? 0.6 : 1,
                      }}
                    >
                      {loadingMore ? "Cargando..." : "Cargar m\u00E1s"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Scheduled tab */}
      {tabMode === "scheduled" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {scheduledLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
              Cargando tareas programadas...
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowScheduledForm(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--accent)",
                    background: "rgba(79,140,255,0.15)",
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Plus size={14} />
                  Nueva Programada
                </button>
              </div>
              {scheduledTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
                  No hay tareas programadas. Crea una nueva.
                </div>
              ) : (
                scheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      padding: "12px 16px",
                      marginBottom: "6px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
                          {task.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                          {task.task_text}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            marginTop: "4px",
                            fontSize: "10px",
                            color: "var(--text-dim)",
                            fontFamily: "monospace",
                          }}
                        >
                          <span>Cron: {task.cron_expression}</span>
                          {task.mode_id && <span>Modo: {task.mode_id}</span>}
                          {task.created_at && <span>{new Date(task.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleExecuteScheduled(task)}
                          title="Ejecutar ahora"
                          style={{
                            background: "rgba(79,140,255,0.1)",
                            border: "1px solid rgba(79,140,255,0.2)",
                            borderRadius: "4px",
                            color: "var(--accent)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                          }}
                        >
                          <Play size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleScheduled(task.id)}
                          title={task.enabled ? "Deshabilitar" : "Habilitar"}
                          style={{
                            background: task.enabled ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                            border: "1px solid " + (task.enabled ? "rgba(16,185,129,0.2)" : "var(--border-light)"),
                            borderRadius: "4px",
                            color: task.enabled ? "var(--success)" : "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                          }}
                        >
                          {task.enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduled(task.id)}
                          title="Eliminar"
                          style={{
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "4px",
                            color: "var(--error)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Create Scheduled Task Modal */}
              {showScheduledForm && (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                  }}
                  onClick={() => setShowScheduledForm(false)}
                >
                  <div
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "16px",
                      width: "500px",
                      maxWidth: "90vw",
                      padding: "24px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
                      Nueva Tarea Programada
                    </h3>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={schedName}
                        onChange={(e) => setSchedName(e.target.value)}
                        placeholder="Mi tarea"
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "var(--text-main)",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Expresi\u00F3n Cron
                      </label>
                      <input
                        type="text"
                        value={schedCron}
                        onChange={(e) => setSchedCron(e.target.value)}
                        placeholder="*/5 * * * *"
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "var(--text-main)",
                          fontSize: "13px",
                          fontFamily: "monospace",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
                        Ejemplos: <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>*/5 * * * *</code> (cada 5min),{" "}
                        <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>0 9 * * 1</code> (lun 9am)
                      </div>
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Texto de la tarea
                      </label>
                      <textarea
                        value={schedTaskText}
                        onChange={(e) => setSchedTaskText(e.target.value)}
                        placeholder="Describe la tarea a ejecutar..."
                        rows={3}
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "var(--text-main)",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          resize: "vertical",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Mode ID (opcional)
                      </label>
                      <input
                        type="text"
                        value={schedModeId}
                        onChange={(e) => setSchedModeId(e.target.value)}
                        placeholder="default"
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "var(--text-main)",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setShowScheduledForm(false)}
                        style={{
                          padding: "8px 20px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          color: "var(--text-main)",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateScheduled}
                        disabled={!schedName.trim() || !schedCron.trim() || !schedTaskText.trim()}
                        style={{
                          padding: "8px 20px",
                          background: "linear-gradient(135deg, var(--accent), #7c3aed)",
                          border: "none",
                          borderRadius: "8px",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                          opacity: !schedName.trim() || !schedCron.trim() || !schedTaskText.trim() ? 0.5 : 1,
                        }}
                      >
                        Crear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRun && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedRun(null)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "700px",
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflow: "auto",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
              Detalle de Tarea #{selectedRun.id}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Estado
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {statusIcon(selectedRun.status)}
                  {selectedRun.status}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Modelo
                </div>
                <div style={{ fontSize: "13px", color: "var(--accent)", marginTop: "2px", fontFamily: "monospace" }}>
                  {selectedRun.model || "-"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Latencia
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px" }}>
                  {selectedRun.latencyMs ? (selectedRun.latencyMs / 1000).toFixed(1) + "s" : "-"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Creado
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px" }}>
                  {selectedRun.created_at ? new Date(selectedRun.created_at).toLocaleString() : "-"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Origen
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px" }}>
                  {ORIGIN_ICONS[selectedRun.origin] || selectedRun.origin}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                Mensaje del usuario
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-light)",
                  fontSize: "13px",
                  color: "var(--text-main)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedRun.userText || "(sin texto)"}
              </div>
            </div>

            {selectedRun.resultText && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Respuesta
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(79,140,255,0.03)",
                    borderRadius: "8px",
                    border: "1px solid rgba(79,140,255,0.1)",
                    fontSize: "12px",
                    color: "var(--text-main)",
                    whiteSpace: "pre-wrap",
                    maxHeight: "200px",
                    overflow: "auto",
                  }}
                >
                  {selectedRun.resultText}
                </div>
              </div>
            )}

            {selectedRun.errorText && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Error
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(239,68,68,0.05)",
                    borderRadius: "8px",
                    border: "1px solid rgba(239,68,68,0.15)",
                    fontSize: "12px",
                    color: "var(--error)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedRun.errorText}
                </div>
              </div>
            )}

            {/* Events Timeline */}
            <div>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                Eventos ({selectedEvents.length})
              </div>
              {detailLoading ? (
                <div style={{ textAlign: "center", padding: "12px" }}>
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
              ) : selectedEvents.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "8px 0" }}>
                  Sin eventos registrados.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {selectedEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border-light)",
                        fontSize: "11px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span
                          style={{
                            padding: "1px 6px",
                            borderRadius: "3px",
                            fontSize: "9px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background:
                              evt.type === "tool_call"
                                ? "rgba(79,140,255,0.15)"
                                : evt.type === "error"
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(255,255,255,0.05)",
                            color:
                              evt.type === "tool_call"
                                ? "var(--accent)"
                                : evt.type === "error"
                                  ? "var(--error)"
                                  : "var(--text-muted)",
                          }}
                        >
                          {evt.type}
                        </span>
                        <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>
                          {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          color: "var(--text-dim)",
                          marginTop: "4px",
                          fontSize: "10px",
                          maxHeight: "60px",
                          overflow: "hidden",
                        }}
                      >
                        {JSON.stringify(evt.payload).substring(0, 200)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                style={{
                  padding: "8px 20px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nueva Tarea Modal */}
      {showNewTaskModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowNewTaskModal(false)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "500px",
              maxWidth: "90vw",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
              Nueva Tarea
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                Descripci\u00F3n de la tarea
              </label>
              <textarea
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Describe la tarea a ejecutar..."
                rows={4}
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "var(--text-main)",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowNewTaskModal(false);
                  setNewTaskText("");
                }}
                style={{
                  padding: "8px 20px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleNewTask}
                disabled={!newTaskText.trim()}
                style={{
                  padding: "8px 20px",
                  background: "linear-gradient(135deg, var(--accent), #7c3aed)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  opacity: !newTaskText.trim() ? 0.5 : 1,
                }}
              >
                Crear Tarea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
