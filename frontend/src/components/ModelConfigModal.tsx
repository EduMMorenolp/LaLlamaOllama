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
  Plus,
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

const KNOWN_PARAMS = [
  "num_ctx", "temperature", "top_p", "top_k", "stop",
  "num_predict", "repeat_penalty", "presence_penalty",
  "frequency_penalty", "mirostat", "mirostat_tau",
  "mirostat_eta", "seed", "min_p", "tfs_z", "typical_p",
];

const INPUT_TYPES: Record<string, string> = {
  num_ctx: "number",
  num_predict: "number",
  top_k: "number",
  seed: "number",
  mirostat: "number",
  temperature: "number",
  top_p: "number",
  repeat_penalty: "number",
  presence_penalty: "number",
  frequency_penalty: "number",
  mirostat_tau: "number",
  mirostat_eta: "number",
  min_p: "number",
  tfs_z: "number",
  typical_p: "number",
};

const PARAM_TOOLTIPS: Record<string, string> = {
  num_ctx: "Tamaño del contexto en tokens. Controla cuánto texto previo recuerda el modelo. Más = mejor comprensión pero más VRAM. Recomendado: 4096–131072",
  temperature: "Creatividad de la respuesta. 0 = determinista, 2 = muy creativo. Valores típicos: 0.7 para tareas creativas, 0.2 para precisión",
  top_p: "Nucleus sampling: acumula tokens con probabilidad hasta cubrir P. Menor valor = más enfocado. Default: 0.9",
  top_k: "Solo considera los K tokens más probables en cada paso. Menor = menos diversidad. Default: 40",
  num_predict: "Máximo de tokens a generar. -1 = ilimitado. Útil para limitar respuestas largas",
  repeat_penalty: "Penaliza tokens repetidos. >1 reduce repetición. Default: 1.1. Aumentar si el modelo se repite mucho",
  presence_penalty: "Penaliza tokens ya vistos en la conversación (sin importar frecuencia). Fomenta que el modelo explore nuevos temas",
  frequency_penalty: "Penaliza tokens según su frecuencia de uso. Reduce repetición de frases enteras. Default: 0",
  mirostat: "Algoritmo de sampling adaptativo. 0 = desactivado, 1 = Mirostat básico, 2 = Mirostat 2.0 (recomendado)",
  mirostat_tau: "Perplejidad objetivo para Mirostat. Menor valor = texto más coherente y menos sorpresivo. Default: 5.0",
  mirostat_eta: "Tasa de aprendizaje de Mirostat. Controla qué tan rápido se adapta. Default: 0.1",
  seed: "Semilla fija para generar respuestas reproducibles. Misma semilla + mismo input = misma salida",
  min_p: "Probabilidad mínima relativa al token más probable. Filtra tokens con probabilidad muy baja. Default: 0.05",
  tfs_z: "Tail free sampling: corta la cola de tokens de baja probabilidad. 1.0 = desactivado. Recomendado: 0.9–1.0",
  typical_p: "Typical sampling: selecciona tokens con perplejidad cercana al promedio. 1.0 = desactivado",
};

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: "4px", cursor: "help" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
    >
      <Info size={10} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", transform: "translateX(-50%)",
          background: "#1a1a2e", color: "#e2e8f0", padding: "8px 10px", borderRadius: "6px",
          fontSize: "10px", lineHeight: 1.4, whiteSpace: "normal", width: "240px", textTransform: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
          zIndex: 100, fontWeight: 400, textAlign: "left", pointerEvents: "none",
        }}>
          {text}
        </span>
      )}
    </span>
  );
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
  const [newParamKey, setNewParamKey] = useState("");
  const [newParamValue, setNewParamValue] = useState("");

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
    const defaultKeys = [...KNOWN_PARAMS];
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

  const handleAddParam = useCallback(() => {
    const key = newParamKey.trim();
    const val = newParamValue.trim();
    if (!key || !val) return;
    setEditParams(prev => ({ ...prev, [key]: val }));
    setNewParamKey("");
    setNewParamValue("");
  }, [newParamKey, newParamValue]);

  const handleRemoveParam = useCallback((key: string) => {
    setEditParams(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

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
    <ModalLayout onClose={onClose} title={`Configuración: ${modelName}`} width="720px">
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
              {(() => {
                const name = getModelInfoValue(modelInfo, "general.name") as string | undefined;
                return name ? (
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>NOMBRE</span>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{name}</span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const sizeLabel = getModelInfoValue(modelInfo, "general.size_label") as string | undefined;
                return sizeLabel ? (
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>TAMAÑO</span>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{sizeLabel}</span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const license = getModelInfoValue(modelInfo, "general.license") as string | undefined;
                return license ? (
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>LICENCIA</span>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{license}</span>
                  </div>
                ) : null;
              })()}
            </div>
            {(() => {
              const desc = getModelInfoValue(modelInfo, "general.description") as string | undefined;
              return desc ? (
                <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", fontSize: "11px", color: "var(--text-dim)", lineHeight: 1.5 }}>
                  {desc}
                </div>
              ) : null;
            })()}
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
              {(() => {
                const expertCount = getModelInfoValue(modelInfo, "llama.expert_count") as number | undefined;
                return expertCount ? (
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>MOE EXPERTOS</span>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{expertCount}</span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const expertUsed = getModelInfoValue(modelInfo, "llama.expert_used_count") as number | undefined;
                return expertUsed ? (
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>EXPERTOS ACTIVOS</span>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{expertUsed}</span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const ropeDim = getModelInfoValue(modelInfo, "llama.rope.dimension_count") as number | undefined;
                return ropeDim ? (
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "2px" }}>ROPE DIM</span>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{ropeDim}</span>
                  </div>
                ) : null;
              })()}
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
                  margin: 0,
                }}
              >
                <Layers size={14} /> Parámetros de Inferencia
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
              </div>
            </div>
            {isEditing ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {Object.entries(editParams).map(([key, value]) => {
                    if (key === "stop") return null;
                    const isCore = KNOWN_PARAMS.includes(key);
                    return (
                      <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center" }}>
                            {key.replace(/_/g, " ")}
                            {PARAM_TOOLTIPS[key] && <Tooltip text={PARAM_TOOLTIPS[key]} />}
                          </span>
                          {!isCore && (
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => handleRemoveParam(key)}
                              style={{ padding: "2px", background: "none", border: "none", cursor: "pointer", color: "var(--warning)", opacity: 0.6 }}
                              title="Quitar parámetro"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                        <input
                          type={INPUT_TYPES[key] || "text"}
                          step={INPUT_TYPES[key] === "number" ? "any" : undefined}
                          value={value}
                          onChange={e => setEditParams(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={key}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "4px",
                            color: "var(--text)",
                            fontSize: "12px",
                            fontFamily: "var(--font-mono)",
                            outline: "none",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>STOP SEQUENCES</span>
                  <input
                    type="text"
                    value={editParams["stop"] || ""}
                    onChange={e => setEditParams(prev => ({ ...prev, stop: e.target.value }))}
                    placeholder="coma, separada, lista"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "4px",
                      color: "var(--text)",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", border: "1px dashed var(--border-light)" }}>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Agregar Parámetro</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      value={newParamKey}
                      onChange={e => setNewParamKey(e.target.value)}
                      placeholder="nombre"
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "4px",
                        color: "var(--text)",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                        outline: "none",
                      }}
                    />
                    <input
                      type="text"
                      value={newParamValue}
                      onChange={e => setNewParamValue(e.target.value)}
                      placeholder="valor"
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "4px",
                        color: "var(--text)",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={handleAddParam}
                      disabled={!newParamKey.trim() || !newParamValue.trim()}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "11px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        opacity: !newParamKey.trim() || !newParamValue.trim() ? 0.5 : 1,
                      }}
                    >
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                </div>
              </>
            ) : Object.keys(parsedParams).length > 0 ? (
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
