import {
	BookOpen,
	Bot,
	Cable,
	ClipboardList,
	Headphones,
	Menu,
	MessageSquare,
	Settings,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Agentes } from "./components/Agentes";
import { AgentChat } from "./components/AgentChat";
import { Conexion } from "./components/Conexion";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Jarvis } from "./components/Jarvis";
import { Knowledge } from "./components/Knowledge";
import { Memoria } from "./components/Memoria";
import { Tareas } from "./components/Tareas";

type Tab = "chat" | "jarvis" | "agentes" | "tareas" | "knowledge" | "conexion" | "memoria";

interface TabDef {
	id: Tab;
	label: string;
	sub: string;
	icon: typeof Bot;
}

const tabs: TabDef[] = [
	{ id: "chat", label: "Chat", sub: "Asistente de Codificaci\u00f3n Aut\u00f3nomo", icon: MessageSquare },
	{ id: "jarvis", label: "Jarvis", sub: "Asistente de Voz", icon: Headphones },
	{ id: "agentes", label: "Agentes", sub: "Configuraci\u00f3n del Agent Engine y Sub-Agents", icon: Settings },
	{ id: "tareas", label: "Tareas", sub: "Historial de ejecuciones", icon: ClipboardList },
	{ id: "knowledge", label: "Conocimiento", sub: "RAG - Base de conocimiento vectorial", icon: BookOpen },
	{ id: "conexion", label: "Conexi\u00f3n", sub: "Telegram, Modelos, Herramientas", icon: Cable },
	{ id: "memoria", label: "Memoria", sub: "MCP Brain - B\u00fasqueda sem\u00e1ntica", icon: Bot },
];

export default function App() {
	const [activeTab, setActiveTab] = useState<Tab>("chat");
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const currentTab = tabs.find((t) => t.id === activeTab)!;

	const handleTabClick = useCallback((tab: Tab) => {
		setActiveTab(tab);
		setSidebarOpen(false);
	}, []);

	// Close sidebar when window grows above breakpoint
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 768px)");
		const handler = (e: MediaQueryListEvent | MediaQueryList) => {
			if (e.matches) setSidebarOpen(false);
		};
		handler(mq);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	return (
		<div className="app-layout">
			{/* Mobile overlay */}
			{sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

			{/* Hamburger button */}
			<button
				type="button"
				className="hamburger-btn"
				onClick={() => setSidebarOpen(!sidebarOpen)}
				aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
			>
				{sidebarOpen ? <X size={20} /> : <Menu size={20} />}
			</button>

			<aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
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
										onClick={() => handleTabClick(tab.id)}
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
					<ErrorBoundary name="Chat">{activeTab === "chat" && <AgentChat />}</ErrorBoundary>
					<ErrorBoundary name="Jarvis">{activeTab === "jarvis" && <Jarvis />}</ErrorBoundary>
					<ErrorBoundary name="Agentes">{activeTab === "agentes" && <Agentes />}</ErrorBoundary>
					<ErrorBoundary name="Tareas">{activeTab === "tareas" && <Tareas />}</ErrorBoundary>
					<ErrorBoundary name="Knowledge">{activeTab === "knowledge" && <Knowledge />}</ErrorBoundary>
					<ErrorBoundary name="Conexion">{activeTab === "conexion" && <Conexion />}</ErrorBoundary>
					<ErrorBoundary name="Memoria">{activeTab === "memoria" && <Memoria />}</ErrorBoundary>
				</div>
			</div>
		</div>
	);
}
