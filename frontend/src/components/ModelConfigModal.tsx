import {
  Cpu,
  Database,
  FileCode,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Edit2,
  Save,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.service";
import { ModalLayout } from "./ModalLayout";

interface ModelConfigModalProps {
  modelName: string;
  onClose: () => void;
}

interface ModelDetails {
  modelfile?: string;
  parameters?: string;
  template?: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  model_info?: Record<string, unknown>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return String(n);
}

function estimateVram(params: number, quantization: string): string {
  const q = (quantization || "").toLowerCase();
  let bytesPerParam = 2;
  if (q.includes("q2")) bytesPerParam = 0.25;
  else if (q.includes("q3")) bytesPerParam = 0.375;
  else if (q.includes("q4")) bytesPerParam = 0.5;
  else if (q.includes("q5")) bytesPerParam = 0.625;
  else if (q.includes("q6")) bytesPerParam = 0.75;
  else if (q.includes("q8")) bytesPerParam = 1;
  else if (q.includes("f16")) bytesPerParam = 2;
  else if (q.includes("f32")) bytesPerParam = 4;

  const estBytes = params * bytesPerParam;
  return `${(estBytes / 1024 ** 3).toFixed(2)} GB`;
}

function parseParams(parameters?: string): Record<string, string | string[]> {
  if (!parameters) return {};
  const result: Record<string, string | string[]> = {};
  for (const line of parameters.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const key = parts[0];
      const value = parts.slice(1).join(" ");
      if (result[key]) {
        const existing = result[key];
        if (typeof existing === "string") {
          result[key] = [existing, value];
        } else {
          (existing as string[]).push(value);
        }
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

function getModelInfoValue(info: Record<string, unknown> | undefined, key: string): unknown {
  if (!info) return undefined;
  return info[key];
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({ modelName, onClose }) => {
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModelfile, setShowModelfile] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editParams, setEditParams] = useState<Record<string, string>>({});
  const [editTemplate, setEditTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/api/models/${encodeURIComponent(modelName)}/show`)
      .then((res) => {
        if (!cancelled) setDetails(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron obtener los detalles del modelo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [modelName]);

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(modelName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [modelName]);

  
  const handleEditStart = useCallback(() => {
    const parsed = parseParams(details?.parameters);
    const initialParams: Record<string, string> = {};
    const defaultKeys = ["num_ctx", "temperature", "top_p", "top_k", "stop"];
    for (const k of defaultKeys) initialParams[k] = "";
    
    for (const [k, v] of Object.entries(parsed)) {
      if (k === "stop") {
        initialParams[k] = Array.isArray(v) ? v.join(", ") : String(v);
      } else {
        initialParams[k] = Array.isArray(v) ? v[0] : String(v);
      }
    }
    setEditParams(initialParams);
    setEditTemplate(details?.template || "");
    setIsEditing(true);
  }, [details]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      let modelfile = `FROM ${modelName}\n`;
      for (const [k, v] of Object.entries(editParams)) {
        const val = v.trim();
        if (!val) continue;
        if (k === "stop") {
          const stops = val.split(",").map(s => s.trim()).filter(Boolean);
          for (const s of stops) modelfile += `PARAMETER stop "${s}"\n`;
        } else {
          modelfile += `PARAMETER ${k} ${val}\n`;
        }
      }
      if (editTemplate.trim()) {
        modelfile += `TEMPLATE """${editTemplate}"""\n`;
      }

      await api.post(`/api/models/${encodeURIComponent(modelName)}/config`, { modelfile });
      
      setIsEditing(false);
      setLoading(true);
      const res = await api.get(`/api/models/${encodeURIComponent(modelName)}/show`);
      setDetails(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e.response?.data?.error?.message || "Error al guardar la configuración.");
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [modelName, editParams, editTemplate]);

  const parsedParams = parseParams(details?.parameters);
  const modelInfo = details?.model_info || {};
  const parameterCount = getModelInfoValue(modelInfo, "general.parameter_count") as number | undefined;
  const contextLength = getModelInfoValue(modelInfo, "llama.context_length") as number | undefined;
  const archModel = String(getModelInfoValue(modelInfo, "general.architecture") ?? "");
  const nLayer = getModelInfoValue(modelInfo, "llama.attention.layer_count") as number | undefined;
  const nHead = getModelInfoValue(modelInfo, "llama.attention.head_count") as number | undefined;
  const nKvHead = getModelInfoValue(modelInfo, "llama.attention.head_count_kv") as number | undefined;
  const nEmbed = getModelInfoValue(modelInfo, "llama.embedding_length") as number | undefined;
  const nFf = getModelInfoValue(modelInfo, "llama.feed_forward_length") as number | undefined;
  const nVocab = getModelInfoValue(modelInfo, "llama.vocab_size") as number | undefined;
  const tokenizerModel = String(getModelInfoValue(modelInfo, "tokenizer.ggml.model") ?? "");
  const fileType = getModelInfoValue(modelInfo, "general.file_type") as number | undefined;

  const numCtxVal = parsedParams["num_ctx"];
  const stopEntries = parsedParams["stop"];
  const stopList = Array.isArray(stopEntries) ? stopEntries : stopEntries ? [stopEntries] : [];

  return (
    <ModalLayout onClose={onClose} title={`Configuración: ${modelName}`} width="680px">
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
          <Cpu size={32} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: "13px" }}>Obteniendo información del modelo...</p>
        </div>
      ) : error ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px",
            color: "var(--warning)",
            background: "rgba(245,158,11,0.05)",
            borderRadius: "8px",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <Info size={24} style={{ margin: "0 auto 8px", display: "block" }} />
          <p style={{ fontSize: "13px", fontWeight: 600 }}>{error}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* ── Información Básica ── */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              borderRadius: "10px",
              padding: "16px",
              border: "1px solid var(--border-light)",
            }}
          >
            <div className="flex-between" style={{ marginBottom: "12px" }}>
              <h4
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Info size={14} /> Información Básica
              </h4>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!isEditing ? (
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={handleEditStart}
                    style={{
                      fontSize: "11px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "rgba(79,140,255,0.1)",
                      color: "var(--accent)",
                      gap: "4px",
                    }}
                    title="Editar Configuración"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "rgba(255,255,255,0.05)",
                        gap: "4px",
                      }}
                    >
                      <X size={12} /> Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "var(--accent)",
                        color: "#fff",
                        gap: "4px",
                      }}
                    >
                      {saving ? <Cpu size={12} className="animate-spin" /> : <Save size={12} />}
                      Guardar
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn-icon"
                  onClick={handleCopyName}
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.04)",
                    gap: "4px",
                  }}
                  title="Copiar nombre del modelo"
                >
                  {copied ? <Check size={12} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
                  {copied ? "Copiado" : "Copiar nombre"}
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>MODELO</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)" }}>{modelName}</span>
              </div>
              {details?.details?.family && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>FAMILIA</span>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{details.details.family}</span>
                </div>
              )}
              {details?.details?.parameter_size && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>PARÁMETROS</span>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{details.details.parameter_size}</span>
                </div>
              )}
              {details?.details?.quantization_level && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>CUANTIZACIÓN</span>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{details.details.quantization_level}</span>
                </div>
              )}
              {details?.details?.format && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>FORMATO</span>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{details.details.format}</span>
                </div>
              )}
              {parameterCount !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>PARÁMETROS TOTALES</span>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{formatNumber(parameterCount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Arquitectura ── */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              borderRadius: "10px",
              padding: "16px",
              border: "1px solid var(--border-light)",
            }}
          >
            <h4
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <Cpu size={14} /> Arquitectura
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {archModel && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>ARQUITECTURA</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{archModel}</span>
                </div>
              )}
              {contextLength !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>CONTEXTO MÁXIMO</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{formatNumber(contextLength)} tokens</span>
                </div>
              )}
              {nLayer !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>CAPAS</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{nLayer}</span>
                </div>
              )}
              {nHead !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>HEADS</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{nHead}</span>
                </div>
              )}
              {nKvHead !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>KV HEADS</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{nKvHead}</span>
                </div>
              )}
              {nEmbed !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>EMBEDDING</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{nEmbed}</span>
                </div>
              )}
              {nFf !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>FF LENGTH</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{nFf}</span>
                </div>
              )}
              {nVocab !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>VOCABULARIO</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{formatNumber(nVocab)}</span>
                </div>
              )}
              {tokenizerModel && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>TOKENIZER</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{tokenizerModel}</span>
                </div>
              )}
              {fileType !== undefined && (
                <div>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>FILE TYPE</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{fileType}</span>
                </div>
              )}
            </div>
            {parameterCount !== undefined && details?.details?.quantization_level && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 12px",
                  background: "rgba(79,140,255,0.06)",
                  borderRadius: "6px",
                  border: "1px solid rgba(79,140,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Database size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: "11px", fontWeight: 600 }}>
                  VRAM estimada:{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {estimateVram(parameterCount, details.details.quantization_level)}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* ── Parámetros de Inferencia ── */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              borderRadius: "10px",
              padding: "16px",
              border: "1px solid var(--border-light)",
            }}
          >
            <h4
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <Layers size={14} /> Parámetros de Inferencia
            </h4>
            {Object.keys(parsedParams).length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {Object.entries(parsedParams).map(([key, value]) => {
                  if (key === "stop") return null;
                  return (
                    <div
                      key={key}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(0,0,0,0.15)",
                        borderRadius: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "2px",
                          textTransform: "uppercase",
                        }}
                      >
                        {key.replace(/_/g, " ")}
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", opacity: 0.6 }}>
                Sin parámetros adicionales configurados.
              </p>
            )}
            {!isEditing && numCtxVal !== undefined && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 12px",
                  background: "rgba(16,185,129,0.06)",
                  borderRadius: "6px",
                  border: "1px solid rgba(16,185,129,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Maximize2 size={14} style={{ color: "var(--success)" }} />
                <span style={{ fontSize: "11px", fontWeight: 600 }}>
                  num_ctx activo: <span style={{ color: "var(--success)", fontFamily: "var(--font-mono)" }}>{String(numCtxVal)}</span>
                </span>
              </div>
            )}
            {!isEditing && stopList.length > 0 && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "10px 12px",
                  background: "rgba(245,158,11,0.06)",
                  borderRadius: "6px",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  STOP SEQUENCES ({stopList.length})
                </span>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {stopList.map((s, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        padding: "2px 6px",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "3px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Template (collapsible) ── */}
          {details?.template && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: "10px",
                padding: "16px",
                border: "1px solid var(--border-light)",
              }}
            >
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowTemplate(!showTemplate)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <h4
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    margin: 0,
                  }}
                >
                  <FileCode size={14} /> Template
                </h4>
                {showTemplate ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              {showTemplate && (
                isEditing ? (
                  <textarea 
                    value={editTemplate} 
                    onChange={e => setEditTemplate(e.target.value)} 
                    placeholder="Plantilla (Template)"
                    style={{ 
                      marginTop: "12px", width: "100%", height: "200px", 
                      background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-light)", 
                      borderRadius: "6px", color: "var(--text-dim)", padding: "12px", 
                      fontSize: "11px", fontFamily: "var(--font-mono)", resize: "vertical" 
                    }}
                  />
                ) : (
                  <pre
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      overflow: "auto",
                      maxHeight: "200px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {details.template}
                  </pre>
                )
              )}
            </div>
          )}

          {/* ── Modelfile (collapsible) ── */}
          {details?.modelfile && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: "10px",
                padding: "16px",
                border: "1px solid var(--border-light)",
              }}
            >
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowModelfile(!showModelfile)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <h4
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    margin: 0,
                  }}
                >
                  <FileCode size={14} /> Modelfile
                </h4>
                {showModelfile ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              {showModelfile && (
                <pre
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-dim)",
                    overflow: "auto",
                    maxHeight: "300px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {details.modelfile}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </ModalLayout>
  );
};
