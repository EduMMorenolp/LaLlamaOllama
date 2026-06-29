import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchStats, type MemoryStatsRes } from "../api";

interface Props {
	project: string;
}

export default function Stats({ project }: Props) {
	const [stats, setStats] = useState<MemoryStatsRes | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await fetchStats(project);
			setStats(data);
		} catch {
			setStats(null);
		} finally {
			setLoading(false);
		}
	}, [project]);

	useEffect(() => { load(); }, [load]);

	if (loading) return <div className="loading"><Loader2 size={20} className="spin" /> Cargando...</div>;
	if (!stats) return <div className="empty-state"><p>No se pudieron cargar las estadisticas</p></div>;

	return (
		<div>
			<div className="stats-grid">
				<div className="stat-card">
					<div className="value">{stats.totalMemories}</div>
					<div className="label">Total de memorias</div>
				</div>
				{stats.byType && Object.entries(stats.byType).map(([type, count]) => (
					<div className="stat-card" key={type}>
						<div className="value">{count}</div>
						<div className="label">{type}</div>
					</div>
				))}
			</div>
			{stats.latestActivity > 0 && (
				<p className="card" style={{ marginTop: 16, fontSize: 13, color: "var(--text-dim)" }}>
					Ultima actividad: {new Date(stats.latestActivity).toLocaleString()}
				</p>
			)}
			<style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}
