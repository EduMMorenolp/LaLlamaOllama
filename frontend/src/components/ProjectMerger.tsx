import { GitMerge, RefreshCw } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { brainApi } from "../services/api.service";

interface ProjectMergerProps {
	projectsList: string[];
	onToast: (message: string, type: "success" | "error" | "info", detail?: string) => void;
	onRefresh: () => void;
}

export const ProjectMerger: React.FC<ProjectMergerProps> = ({ projectsList, onToast, onRefresh }) => {
	const [source, setSource] = useState("");
	const [target, setTarget] = useState("");
	const [merging, setMerging] = useState(false);

	const availableSources = projectsList.filter((p) => p !== target);
	const availableTargets = projectsList.filter((p) => p !== source);

	const handleMerge = async () => {
		if (!source || !target) {
			onToast("Selecciona origen y destino", "error");
			return;
		}
		if (source === target) {
			onToast("Origen y destino deben ser distintos", "error");
			return;
		}

		const confirmed = window.confirm(
			`¿Fusionar el proyecto "${source}" DENTRO de "${target}"?\n\n` +
				`- Todas las memorias, directivas y sesiones de "${source}" se moverán a "${target}".\n` +
				`- El proyecto "${source}" será eliminado después de la fusión.\n\n` +
				`Esta operación no se puede deshacer fácilmente. ¿Continuar?`
		);
		if (!confirmed) return;

		setMerging(true);
		try {
			const res = await brainApi.post("/api/projects/merge", { source, target });
			const data = res.data;
			const detailParts: string[] = [];
			if (data.memoriesMoved !== undefined) detailParts.push(`${data.memoriesMoved} memorias`);
			if (data.directivesMoved !== undefined) detailParts.push(`${data.directivesMoved} directivas`);
			if (data.sessionsMoved !== undefined) detailParts.push(`${data.sessionsMoved} sesiones`);

			onToast(
				`Fusión completada: "${source}" → "${target}"`,
				"success",
				detailParts.length > 0 ? detailParts.join(", ") + " movidos." : undefined
			);

			setSource("");
			setTarget("");
			onRefresh();
		} catch (error: unknown) {
			const msg =
				error instanceof Error
					? error.message
					: (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
						"Error al fusionar proyectos";
			onToast("Error al fusionar", "error", msg);
		} finally {
			setMerging(false);
		}
	};

	return (
		<div className="card-glass" style={{ padding: "24px", minHeight: "calc(100vh - 200px)" }}>
			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
				<GitMerge size={20} style={{ color: "var(--accent)" }} />
				<div>
					<h3 style={{ fontSize: "16px", fontWeight: 600 }}>Fusionar Proyectos</h3>
					<p style={{ fontSize: "12px", color: "var(--text-dim)" }}>
						Transfiere todas las memorias, directivas y sesiones de un proyecto a otro.
					</p>
				</div>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr",
					gap: "16px",
					maxWidth: "480px",
				}}
			>
				{/* Source */}
				<div>
					<label
						style={{
							fontSize: "11px",
							fontWeight: 600,
							color: "var(--text-dim)",
							textTransform: "uppercase",
							letterSpacing: "1px",
							display: "block",
							marginBottom: "6px",
						}}
					>
						Proyecto Origen (source)
					</label>
					<select
						value={source}
						onChange={(e) => setSource(e.target.value)}
						style={{
							width: "100%",
							padding: "10px 14px",
							background: "var(--bg-input)",
							border: "1px solid var(--border)",
							borderRadius: "8px",
							color: "white",
							fontSize: "13px",
							fontFamily: "var(--font-mono)",
							cursor: "pointer",
						}}
					>
						<option value="">-- Seleccionar origen --</option>
						{availableSources.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>
				</div>

				{/* Target */}
				<div>
					<label
						style={{
							fontSize: "11px",
							fontWeight: 600,
							color: "var(--text-dim)",
							textTransform: "uppercase",
							letterSpacing: "1px",
							display: "block",
							marginBottom: "6px",
						}}
					>
						Proyecto Destino (target)
					</label>
					<select
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						style={{
							width: "100%",
							padding: "10px 14px",
							background: "var(--bg-input)",
							border: "1px solid var(--border)",
							borderRadius: "8px",
							color: "white",
							fontSize: "13px",
							fontFamily: "var(--font-mono)",
							cursor: "pointer",
						}}
					>
						<option value="">-- Seleccionar destino --</option>
						{availableTargets.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>
				</div>

				{/* Merge Button */}
				<button
					type="button"
					onClick={handleMerge}
					disabled={merging || !source || !target || source === target}
					className="btn-send"
					style={{
						width: "100%",
						padding: "12px 24px",
						fontSize: "14px",
						marginTop: "8px",
						background:
							merging || !source || !target
								? "rgba(79, 140, 255, 0.1)"
								: "rgba(79, 140, 255, 0.2)",
						color:
							merging || !source || !target
								? "rgba(79, 140, 255, 0.4)"
								: "var(--accent)",
						border: "1px solid rgba(79, 140, 255, 0.3)",
						cursor: merging || !source || !target ? "not-allowed" : "pointer",
						transition: "var(--transition)",
					}}
				>
					{merging ? (
						<>
							<RefreshCw size={18} className="animate-spin" />
							<span>Fusionando...</span>
						</>
					) : (
						<>
							<GitMerge size={18} />
							<span>Fusionar Proyectos</span>
						</>
					)}
				</button>
			</div>

			{projectsList.length < 2 && (
				<div
					style={{
						marginTop: "24px",
						fontSize: "12px",
						color: "var(--text-dim)",
						padding: "12px 16px",
						background: "rgba(0,0,0,0.2)",
						borderRadius: "8px",
					}}
				>
					Se necesitan al menos dos proyectos diferentes para realizar una fusión.
				</div>
			)}
		</div>
	);
};
