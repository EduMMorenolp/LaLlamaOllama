import { Headphones, Mic, MicOff, Radio } from "lucide-react";
import { useState, useRef } from "react";

export const Jarvis: React.FC = () => {
    const [permissionStatus, setPermissionStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unavailable">("idle");
    const [isListening, setIsListening] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const requestMicrophone = async () => {
        setPermissionStatus("requesting");
        setErrorMessage("");

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setPermissionStatus("unavailable");
                setErrorMessage("Tu navegador no soporta el acceso al microfono. Usa Chrome, Edge o Safari.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            setPermissionStatus("granted");
            setIsListening(true);
        } catch (err: unknown) {
            if (err instanceof DOMException) {
                if (err.name === "NotAllowedError") {
                    setPermissionStatus("denied");
                    setErrorMessage("Permiso de microfono denegado. Ve a la configuracion de tu navegador y permite el acceso al microfono.");
                } else if (err.name === "NotFoundError") {
                    setPermissionStatus("unavailable");
                    setErrorMessage("No se encontro ningun microfono. Conecta un microfono e intenta de nuevo.");
                } else {
                    setPermissionStatus("denied");
                    setErrorMessage("Error al acceder al microfono: " + err.message);
                }
            } else {
                setPermissionStatus("denied");
                setErrorMessage("Error inesperado al solicitar permiso del microfono.");
            }
        }
    };

    const stopListening = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
        setIsListening(false);
        setPermissionStatus("idle");
    };

    const sectionCard: React.CSSProperties = {
        padding: "24px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-light)",
        textAlign: "center" as const,
        maxWidth: "500px",
        margin: "40px auto 0",
    };

    const statusColor = permissionStatus === "granted" ? "var(--success)"
        : permissionStatus === "denied" ? "var(--error)"
        : permissionStatus === "requesting" ? "var(--warning)"
        : "var(--text-dim)";

    const statusText = permissionStatus === "idle" ? "Esperando..."
        : permissionStatus === "requesting" ? "Solicitando permiso..."
        : permissionStatus === "granted" ? "Permiso concedido"
        : permissionStatus === "denied" ? "Permiso denegado"
        : "No disponible";

    return (
        <div className="card-glass" style={{ padding: "20px", minHeight: "100%" }}>
            <div style={sectionCard}>
                {/* Icon */}
                <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: isListening ? "rgba(34,197,94,0.15)" : "rgba(79,140,255,0.1)",
                    border: isListening ? "2px solid var(--success)" : "2px solid rgba(79,140,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                    transition: "all 0.3s ease",
                    boxShadow: isListening ? "0 0 30px rgba(34,197,94,0.3)" : "none",
                }}>
                    {isListening ? <Radio size={36} style={{ color: "var(--success)" }} /> : <Headphones size={36} style={{ color: "var(--accent)" }} />}
                </div>

                {/* Title */}
                <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", margin: "0 0 4px" }}>
                    Jarvis
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-dim)", margin: "0 0 24px" }}>
                    Asistente de Voz
                </p>

                {/* Permission status */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    marginBottom: "20px", fontSize: "12px", color: statusColor,
                }}>
                    <span style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: statusColor, display: "inline-block",
                        animation: permissionStatus === "requesting" ? "pulse 1s infinite" : "none",
                    }} />
                    {statusText}
                </div>

                {/* Error message */}
                {errorMessage && (
                    <div style={{
                        padding: "10px 14px", marginBottom: "16px", fontSize: "12px",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: "8px", color: "var(--error)", textAlign: "left" as const,
                    }}>
                        {errorMessage}
                    </div>
                )}

                {/* Main button */}
                {!isListening ? (
                    <button
                        type="button"
                        onClick={requestMicrophone}
                        disabled={permissionStatus === "requesting"}
                        style={{
                            padding: "14px 32px",
                            background: permissionStatus === "requesting"
                                ? "rgba(79,140,255,0.05)"
                                : "linear-gradient(135deg, var(--accent), #7c3aed)",
                            border: "none",
                            borderRadius: "12px",
                            color: "white",
                            cursor: permissionStatus === "requesting" ? "wait" : "pointer",
                            fontSize: "15px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "10px",
                            opacity: permissionStatus === "requesting" ? 0.6 : 1,
                            transition: "all 0.2s",
                        }}
                    >
                        <Mic size={20} />
                        {permissionStatus === "requesting" ? "Solicitando permiso..." : "Iniciar Jarvis"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={stopListening}
                        style={{
                            padding: "14px 32px",
                            background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: "12px",
                            color: "var(--error)",
                            cursor: "pointer",
                            fontSize: "15px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "10px",
                            transition: "all 0.2s",
                        }}
                    >
                        <MicOff size={20} />
                        Detener Jarvis
                    </button>
                )}

                {/* Listening indicator */}
                {isListening && (
                    <div style={{
                        marginTop: "20px", padding: "12px",
                        background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)",
                        borderRadius: "8px", fontSize: "13px", color: "var(--success)",
                    }}>
                        🟢 Escuchando... Habla al microfono
                    </div>
                )}
            </div>
        </div>
    );
};