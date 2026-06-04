import {
	BookOpen,
	Bot,
	Cable,
	ClipboardList,
	MessageSquare,
	Settings,
} from "lucide-react";
import { useState } from "react";
import { Agentes } from "./components/Agentes";
import { AgentChat } from "./components/AgentChat";
import { Conexion } from "./components/Conexion";
import { Knowledge } from "./components/Knowledge";
import { Memoria } from "./components/Memoria";
import { Tareas } from "./components/Tareas";

type Tab = "chat" | "tareas" | "knowledge" | "conexion" | "memoria" | "agentes";

interface TabDef {
	id: Tab;
	label: string;
	sub: string;
	icon: typeof Bot;
}

const tabs: TabDef[] = [
	{ id: "chat", label: "Chat", sub: "Asistente de Codificación Autónomo", icon: MessageSquare },
	{ id: "agentes", label: "Agentes", sub: "Configuración del Agent Engine y Sub-Agents", icon: Settings },
	{ id: "tareas", label: "Tareas", sub: "Historial de ejecuciones", icon: ClipboardList },
	{ id: "knowledge", label: "Conocimiento", sub: "RAG - Base de conocimiento vectorial", icon: BookOpen },
	{ id: "conexion", label: "Conexión", sub: "Telegram, Modelos, Herramientas", icon: Cable },
	{ id: "memoria", label: "Memoria", sub: "MCP Brain - Búsqueda semántica", icon: Bot },
];

export default function App() {
	const [activeTab, setActiveTab] = useState<Tab>("chat");

	const currentTab = tabs.find((t) => t.id === activeTab)!;

	return (
		<div className="app-layout">
			<aside className="sidebar">
				<div className="sidebar-header">
					<div className="logo-wrap">
						<div className="logo-icon">
							<img src="/logo.png" alt="Logo" />
						</div>
						<span className="logo-text">LaLlamaOllama</span>
					</div>
				</div>

				<nav className="sidebar-nav scrollbar-hide">
					<div className="nav-section">
						<div className="section-header">
							<span className="section-title">Agent Engine</span>
						</div>
						<div className="experts-list">
							{tabs.map((tab) => {
								const Icon = tab.icon;
								return (
									<button
										key={tab.id}
										type="button"
										className={`expert-item-wrap ${activeTab === tab.id ? "active" : ""}`}
										onClick={() => setActiveTab(tab.id)}
									>
										<div className="expert-avatar" style={{ color: "var(--accent)" }}>
											<Icon size={16} />
										</div>
										<div className="expert-info">
											<span className="expert-name">{tab.label}</span>
											<span className="expert-model">{tab.sub}</span>
										</div>
									</button>
								);
							})}
						</div>
					</div>
				</nav>

				<div className="sidebar-footer">
					<div
						style={{
							padding: "12px",
							borderRadius: "8px",
							border: "1px solid var(--border)",
							background: "rgba(79, 140, 255, 0.05)",
						}}
					>
						<div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>
							Agent Engine UI v2.0
						</div>
					</div>
				</div>
			</aside>

			<div className="view-area">
				{activeTab !== "chat" && (
					<header className="view-header">
						<div className="header-info">
							<h2>{currentTab.label.toUpperCase()}</h2>
							<p>{currentTab.sub}</p>
						</div>
					</header>
				)}

				<div
					className="view-body"
					style={activeTab === "chat" ? { padding: "10px", display: "flex", flexDirection: "column" } : undefined}
				>
					{activeTab === "chat" && <AgentChat />}
					{activeTab === "agentes" && <Agentes />}
					{activeTab === "tareas" && <Tareas />}
					{activeTab === "knowledge" && <Knowledge />}
					{activeTab === "conexion" && <Conexion />}
					{activeTab === "memoria" && <Memoria />}
				</div>
			</div>
		</div>
	);
}
