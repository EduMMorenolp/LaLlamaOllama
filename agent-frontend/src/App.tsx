import { BookOpen, Cable, ClipboardList, Menu, MessageSquare, Moon, Settings, Sun, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "./contexts/ThemeContext";
import { AgentChat } from "./components/AgentChat";
import { Agentes } from "./components/Agentes";
import { Conexion } from "./components/Conexion";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GoogleCallback } from "./components/GoogleCallback";
import { Knowledge } from "./components/Knowledge";
import { Perfil } from "./components/Perfil";
import { Tareas } from "./components/Tareas";

type Tab = "chat" | "agentes" | "tareas" | "knowledge" | "conexion" | "perfil";

interface TabDef {
	id: Tab;
	label: string;
	sub: string;
	icon: typeof MessageSquare;
}

const tabs: TabDef[] = [
	{ id: "chat", label: "Chat", sub: "Asistente de Codificación Autónomo", icon: MessageSquare },
	{ id: "agentes", label: "Agentes", sub: "Configuración del Agent Engine y Sub-Agents", icon: Settings },
	{ id: "tareas", label: "Tareas", sub: "Historial de ejecuciones", icon: ClipboardList },
	{ id: "knowledge", label: "Cerebro", sub: "Memorias, timeline y archivos RAG", icon: BookOpen },
	{ id: "conexion", label: "Conexión", sub: "Telegram, Modelos, Herramientas", icon: Cable },
	{ id: "perfil", label: "Perfil", sub: "Tu perfil y preferencias", icon: User },
];

export default function App() {
	const { theme, toggle: toggleTheme } = useTheme();
	const [activeTab, setActiveTab] = useState<Tab>("chat");
	const [sidebarOpen, setSidebarOpen] = useState(false);

	if (window.location.pathname === "/google/callback") {
		return <GoogleCallback />;
	}

	const currentTab = tabs.find((t) => t.id === activeTab)!;

	const handleTabClick = useCallback((tab: Tab) => {
		setActiveTab(tab);
		setSidebarOpen(false);
	}, []);

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
			{sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

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
					<button
						type="button"
						onClick={toggleTheme}
						style={{
							width: "100%",
							padding: "10px 12px",
							borderRadius: "8px",
							border: "1px solid var(--border)",
							background: "var(--bg-surface)",
							color: "var(--text-dim)",
							cursor: "pointer",
							fontSize: "12px",
							display: "flex",
							alignItems: "center",
							gap: "8px",
							justifyContent: "center",
							transition: "var(--transition)",
						}}
					>
						{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
						{theme === "dark" ? "Modo claro" : "Modo oscuro"}
					</button>
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
					style={
						activeTab === "chat" ? { padding: "10px", display: "flex", flexDirection: "column" } : undefined
					}
				>
					<ErrorBoundary name="Chat">
						<div style={{ display: activeTab === "chat" ? "contents" : "none" }}>
							<AgentChat />
						</div>
					</ErrorBoundary>
					<ErrorBoundary name="Agentes">{activeTab === "agentes" && <Agentes />}</ErrorBoundary>
					<ErrorBoundary name="Tareas">{activeTab === "tareas" && <Tareas />}</ErrorBoundary>
					<ErrorBoundary name="Knowledge">{activeTab === "knowledge" && <Knowledge />}</ErrorBoundary>
					<ErrorBoundary name="Conexion">{activeTab === "conexion" && <Conexion />}</ErrorBoundary>
				<ErrorBoundary name="Perfil">{activeTab === "perfil" && <Perfil />}</ErrorBoundary>
				</div>
			</div>
		</div>
	);
}
