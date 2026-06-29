import { Loader2, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { searchMemories, type Memory } from "../api";
import MemoryModal from "./MemoryModal";

interface Props {
	project: string;
}

export default function SearchView({ project }: Props) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Memory[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		setLoading(true);
		try {
			const data = await searchMemories(query, project);
			setResults(data);
		} catch {
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, [query, project]);

	return (
		<div>
			<div className="search-bar">
				<input
					value={query}
					onChange={e => setQuery(e.target.value)}
					onKeyDown={e => e.key === "Enter" && handleSearch()}
					placeholder="Buscar en memorias..."
				/>
				<button className="btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
					<Search size={16} /> Buscar
				</button>
			</div>

			{loading ? (
				<div className="loading"><Loader2 size={20} className="spin" /> Buscando...</div>
			) : results.length > 0 ? (
				<div className="memories-list">
					{results.map(m => (
						<div key={m.id} className="memory-row" onClick={() => setSelectedId(m.id)}>
							<span className="type-badge">{m.type}</span>
							<span className="title">{m.title}</span>
							<span className="meta">{m.similarity !== undefined ? `${(m.similarity * 100).toFixed(0)}%` : ""}</span>
						</div>
					))}
				</div>
			) : query ? (
				<div className="empty-state"><p>Sin resultados</p></div>
			) : null}

			{selectedId && (
				<MemoryModal id={selectedId} onClose={() => { setSelectedId(null); setResults([]); }} />
			)}
			<style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}
