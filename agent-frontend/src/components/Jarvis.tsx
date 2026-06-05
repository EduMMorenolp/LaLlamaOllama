import { Headphones, Mic, MicOff, Radio, Send, Volume2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useWs } from "../contexts/WebSocketContext";

// Detectar SpeechRecognition (prefijos vendor)
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const Jarvis: React.FC = () => {
    const { connected, send, subscribe } = useWs();

    // Mic state
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [recognitionError, setRecognitionError] = useState("");

    // Chat state
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoTTS, setAutoTTS] = useState(true);

    const recognitionRef = useRef<InstanceType<typeof SpeechRecognitionAPI> | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll al final
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Suscribirse a WS
    useEffect(() => {
        return subscribe((msg) => {
            if (msg.type === "assistant_done") {
                const text = msg.payload?.text as string;
                if (text) {
                    setMessages((prev) => [...prev, { role: "assistant", text }]);
                    setIsProcessing(false);
                    // TTS automático
                    if (autoTTS && "speechSynthesis" in window) {
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.lang = "es-ES";
                        utterance.rate = 1.1;
                        speechSynthesis.speak(utterance);
                    }
                }
            }
            if (msg.type === "error") {
                const errorText = msg.payload?.message as string;
                setMessages((prev) => [...prev, { role: "assistant", text: `❌ Error: ${errorText}` }]);
                setIsProcessing(false);
            }
        });
    }, [subscribe, autoTTS]);

    const startListening = useCallback(() => {
        if (!SpeechRecognitionAPI) {
            setRecognitionError("Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.");
            return;
        }
        if (!connected) {
            setRecognitionError("No hay conexión con el Agent Engine.");
            return;
        }

        setRecognitionError("");
        setTranscript("");

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-ES";
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
            let finalText = "";
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalText += event.results[i][0].transcript;
                } else {
                    interimText += event.results[i][0].transcript;
                }
            }
            if (finalText) setTranscript((prev) => prev + " " + finalText);
            setInterimTranscript(interimText);
        };

        recognition.onerror = (event: any) => {
            console.error("SpeechRecognition error:", event.error);
            if (event.error === "not-allowed") {
                setRecognitionError("Permiso de micrófono denegado.");
            } else if (event.error === "no-speech") {
                // Silencio, ignorar
            } else {
                setRecognitionError(`Error: ${event.error}`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [connected]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch {}
            recognitionRef.current = null;
        }
        setIsListening(false);
        // Si hay texto final, enviarlo
        const fullText = (transcript + " " + interimTranscript).trim();
        if (fullText) {
            setMessages((prev) => [...prev, { role: "user", text: fullText }]);
            setIsProcessing(true);
            send("user_message", { chatId: "jarvis", text: fullText });
            setTranscript("");
            setInterimTranscript("");
        }
    }, [transcript, interimTranscript, send]);

    // Enviar texto manual
    const handleSendText = () => {
        const text = transcript.trim();
        if (!text) return;
        setMessages((prev) => [...prev, { role: "user", text }]);
        setIsProcessing(true);
        send("user_message", { chatId: "jarvis", text });
        setTranscript("");
        setInterimTranscript("");
    };

    // Detener TTS
    const stopTTS = () => {
        if ("speechSynthesis" in window) {
            speechSynthesis.cancel();
        }
    };

    const sectionCard: React.CSSProperties = {
        padding: "24px", borderRadius: "12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-light)",
        maxWidth: "600px", margin: "0 auto",
    };

    return (
        <div style={{ maxWidth: "700px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Status + Controls */}
            <div style={sectionCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{
                        width: "60px", height: "60px", borderRadius: "50%",
                        background: isListening ? "rgba(34,197,94,0.15)" : "rgba(79,140,255,0.1)",
                        border: isListening ? "2px solid var(--success)" : "2px solid rgba(79,140,255,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.3s",
                        boxShadow: isListening ? "0 0 20px rgba(34,197,94,0.2)" : "none",
                    }}>
                        {isListening ? <Radio size={24} style={{ color: "var(--success)" }} /> : <Headphones size={24} style={{ color: "var(--accent)" }} />}
                    </div>
                    <div>
                        <h3 style={{ margin: "0", fontSize: "18px", fontWeight: 700, color: "var(--text-main)" }}>Jarvis</h3>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-dim)" }}>
                            {connected ? (isListening ? "Escuchando..." : "Conectado") : "Desconectado"}
                        </p>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                        {!isListening ? (
                            <button type="button" onClick={startListening} disabled={!connected} style={{
                                padding: "10px 20px",
                                background: "linear-gradient(135deg, var(--accent), #7c3aed)",
                                border: "none", borderRadius: "8px", color: "white",
                                cursor: connected ? "pointer" : "not-allowed",
                                fontSize: "13px", fontWeight: 600,
                                display: "flex", alignItems: "center", gap: "8px",
                                opacity: connected ? 1 : 0.5,
                            }}>
                                <Mic size={18} /> Iniciar
                            </button>
                        ) : (
                            <button type="button" onClick={stopListening} style={{
                                padding: "10px 20px",
                                background: "rgba(239,68,68,0.15)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: "8px", color: "var(--error)",
                                cursor: "pointer", fontSize: "13px", fontWeight: 600,
                                display: "flex", alignItems: "center", gap: "8px",
                            }}>
                                <MicOff size={18} /> Detener
                            </button>
                        )}
                        <button type="button" onClick={stopTTS} title="Silenciar TTS" style={{
                            padding: "10px", background: "rgba(255,255,255,0.05)",
                            border: "1px solid var(--border-light)", borderRadius: "8px",
                            color: autoTTS ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
                        }} onMouseDown={() => setAutoTTS(!autoTTS)}>
                            <Volume2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Transcripción en vivo */}
                <div style={{
                    padding: "12px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-light)",
                    minHeight: "60px", marginBottom: "12px",
                }}>
                    <div style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.5 }}>
                        {transcript}
                        {interimTranscript && (
                            <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}> {interimTranscript}</span>
                        )}
                        {!transcript && !interimTranscript && (
                            <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
                                {isListening ? "Habla al micrófono..." : "Presiona 'Iniciar' para comenzar"}
                            </span>
                        )}
                    </div>
                </div>

                {/* Input manual + Send */}
                <div style={{ display: "flex", gap: "8px" }}>
                    <input type="text" value={transcript} onChange={(e) => setTranscript(e.target.value)}
                        placeholder="O escribe aquí..."
                        onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }}
                        style={{
                            flex: 1, padding: "10px 14px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--border-light)", borderRadius: "8px",
                            color: "var(--text-main)", fontSize: "13px", fontFamily: "inherit", outline: "none",
                        }}
                    />
                    <button type="button" onClick={handleSendText} disabled={!transcript.trim() || isProcessing} style={{
                        padding: "10px 16px", background: "linear-gradient(135deg, var(--accent), #7c3aed)",
                        border: "none", borderRadius: "8px", color: "white",
                        cursor: "pointer", opacity: !transcript.trim() || isProcessing ? 0.5 : 1,
                        display: "flex", alignItems: "center",
                    }}>
                        <Send size={18} />
                    </button>
                </div>

                {/* Errores */}
                {recognitionError && (
                    <div style={{ marginTop: "12px", padding: "10px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", color: "var(--error)" }}>
                        {recognitionError}
                    </div>
                )}

                {/* No soporte */}
                {!SpeechRecognitionAPI && (
                    <div style={{ marginTop: "12px", padding: "10px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", color: "var(--error)" }}>
                        Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.
                    </div>
                )}
            </div>

            {/* Chat de voz */}
            <div style={{
                ...sectionCard, maxHeight: "400px", overflowY: "auto",
                display: "flex", flexDirection: "column", gap: "8px",
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
                        <Headphones size={32} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
                        Habla al micrófono o escribe para interactuar con el agente por voz.
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "80%",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        background: msg.role === "user"
                            ? "linear-gradient(135deg, var(--accent), #7c3aed)"
                            : "rgba(255,255,255,0.05)",
                        border: msg.role === "user" ? "none" : "1px solid var(--border-light)",
                        color: msg.role === "user" ? "white" : "var(--text-main)",
                        fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap",
                    }}>
                        {msg.text}
                    </div>
                ))}
                {isProcessing && (
                    <div style={{ alignSelf: "flex-start", padding: "10px 14px", color: "var(--text-muted)", fontSize: "13px" }}>
                        <div className="typing-indicator"><span /><span /><span /></div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
        </div>
    );
};
