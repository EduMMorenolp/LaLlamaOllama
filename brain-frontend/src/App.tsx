import { useCallback, useEffect, useState } from "react";
import { Archive, BarChart3, Brain, Search, ServerCrash } from "lucide-react";
import { fetchProjects } from "./api";
import Memories from "./components/Memories";
import MemoryModal from "./components/MemoryModal";
import Stats from "./components/Stats";
import SearchView from "./components/SearchView";

type Tab = "memories" | "stats" | "search";

export default function App() {
	const [tab, setTab] = useState<Tab>("memories");
	const [projects, setProjects] = useState<string[]>(["lallamaollama"]);
	const [activeProject, setActiveProject] = useState("lallamaollama");
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const loadProjects = useCallback(async () => {
		try {
			const list = await fetchProjects();
			if (list.length > 0) {
				setProjects(list);
				if (!list.includes(activeProject)) setActiveProject(list[0]);
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			setError(msg);
		}
	}, [activeProject]);

	useEffect(() => { loadProjects(); }, [loadProjects]);

	if (error) {
		return (
			<div className="app-error">
				<ServerCrash size={48} />
				<h2>Error de conexion</h2>
				<p>{error}</p>
				<button onClick={loadProjects}>Reintentar</button>
			</div>
		);
	}

	const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
		{ key: "memories", label: "Memorias", icon: <Archive size={16} /> },
		{ key: "stats", label: "Estadisticas", icon: <BarChart3 size={16} /> },
		{ key: "search", label: "Buscar", icon: <Search size={16} /> },
	];

	return (
		<div className="app">
			<header className="app-header">
				<div className="app-title">
					<Brain size={24} />
					<h1>Brain Dashboard</h1>
				</div>
				<div className="app-controls">
					<select value={activeProject} onChange={e => setActiveProject(e.target.value)}>
						{projects.map(p => <option key={p} value={p}>{p}</option>)}
					</select>
					<button className="btn-primary" onClick={() => setCreating(true)}>
						+ Nueva memoria
					</button>
				</div>
			</header>

			<nav className="app-tabs">
				{tabs.map(t => (
					<button
						key={t.key}
						className={`tab ${tab === t.key ? "active" : ""}`}
						onClick={() => setTab(t.key)}
					>
						{t.icon} {t.label}
					</button>
				))}
			</nav>

			<main className="app-content">
				{tab === "memories" && (
					<Memories
						project={activeProject}
						onSelect={id => setSelectedId(id)}
					/>
				)}
				{tab === "stats" && <Stats project={activeProject} />}
				{tab === "search" && <SearchView project={activeProject} />}
			</main>

			{selectedId && (
				<MemoryModal id={selectedId} onClose={() => setSelectedId(null)} />
			)}
			{creating && (
				<MemoryModal project={activeProject} onClose={() => setCreating(false)} />
			)}
		</div>
	);
}
