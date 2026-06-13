import {
	BookOpen,
	Download,
	ExternalLink,
	Info,
	Layers,
	Loader,
	RefreshCw,
	ScanSearch,
	Search,
	Settings,
	Sparkles,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { api } from "../services/api.service";
import { ModelConfigModal } from "./ModelConfigModal";
import type { OllamaModel, PullProgressData } from "../types/api";

interface ModelListProps {
	models: OllamaModel[];
	pullProgress: Record<string, PullProgressData>;
	onPull: (name: string) => void;
	onDelete: (name: string) => void;
}

const FALLBACK_MODELS = [
	{
		name: "llama3.2",
		title: "Llama 3.2",
		desc: "El más balanceado para tareas diarias de Meta.",
		tags: ["3B", "11B"],
		pulls: "20M+",
	},
	{
		name: "mistral",
		title: "Mistral 7B",
		desc: "Excelente para lógica, código y razonamiento.",
		tags: ["7B"],
		pulls: "15M+",
	},
	{ name: "phi4", title: "Phi-4", desc: "Modelo compacto y potente de Microsoft.", tags: ["14B"], pulls: "8M+" },
	{
		name: "deepseek-r1",
		title: "DeepSeek R1",
		desc: "Razonamiento avanzado. Alternativa a o1.",
		tags: ["7B", "32B"],
		pulls: "5M+",
	},
	{
		name: "codellama",
		title: "Code Llama",
		desc: "Especializado en generación de código.",
		tags: ["7B", "13B", "34B"],
		pulls: "10M+",
	},
	{
		name: "gemma3",
		title: "Gemma 3",
		desc: "Modelo de Google para tareas generales.",
		tags: ["1B", "4B", "12B"],
		pulls: "6M+",
	},
	{
		name: "qwen2.5",
		title: "Qwen 2.5",
		desc: "Multilingüe avanzado de Alibaba.",
		tags: ["7B", "14B", "32B"],
		pulls: "12M+",
	},
	{ name: "llava", title: "LLaVA", desc: "Visión + lenguaje. Analiza imágenes.", tags: ["7B", "13B"], pulls: "4M+" },
];

export const ModelList: React.FC<ModelListProps> = ({ models, pullProgress, onPull, onDelete }) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [directPullTerm, setDirectPullTerm] = useState("");
	const [searchResults, setSearchResults] = useState<Record<string, any>[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [hasSearched, setHasSearched] = useState(false);
	const [verificationModel, setVerificationModel] = useState<Record<string, any> | null>(null);
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [configModel, setConfigModel] = useState<string | null>(null);

	const installedNames = models?.filter((m) => !!m?.name).map((m) => m.name as string) || [];

	const handleSearch = useCallback(async (term: string, sort?: string) => {
		if (!term.trim() && !sort) {
			setSearchResults([]);
			setHasSearched(false);
			return;
		}
		setIsSearching(true);
		setSearchError("");
		setHasSearched(true);
		try {
			const params = new URLSearchParams();
			if (term.trim()) params.append("q", term);
			if (sort) params.append("sort", sort);
			const res = await api.get(`/api/search-models?${params.toString()}`);
			setSearchResults(res.data.models || []);
		} catch {
			setSearchError("No se pudo conectar con ollama.com. Usa los modelos sugeridos abajo.");
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	}, []);

	const handleManualPull = () => {
		if (searchTerm.trim()) {
			handleSearch(searchTerm);
		}
	};

	const handleDirectPull = () => {
		if (directPullTerm.trim()) {
			setVerificationModel({
				name: directPullTerm.trim(),
				title: directPullTerm.trim(),
				desc: "Modelo ingresado manualmente. Verifica el nombre antes de continuar.",
			});
		}
	};

	const confirmPull = () => {
		if (verificationModel) {
			let modelToPull = verificationModel.name;
			// Si hay un tag seleccionado y el nombre no incluye ya un tag (indicado por ':'), lo agregamos
			if (selectedTag && !modelToPull.includes(":")) {
				modelToPull = `${modelToPull}:${selectedTag.toLowerCase()}`;
			}
			onPull(modelToPull);
			setVerificationModel(null);
			setSelectedTag(null);
			setSearchTerm("");
			setDirectPullTerm("");
		}
	};

	const displayModels = hasSearched ? searchResults : FALLBACK_MODELS;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
			{/* ── Modelos Instalados ── PRIMERO ───────────────────── */}
			<div className="card-glass p-8 animate-fade">
				<h2 style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "20px" }}>
					<Layers size={22} style={{ color: "var(--accent)" }} />
					Modelos Instalados
					<span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 400, color: "var(--text-muted)" }}>
						{models?.filter((m) => m?.name).length || 0} total
					</span>
				</h2>

				{Object.values(pullProgress).length > 0 && (
					<div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
						{Object.values(pullProgress).map((progress) => (
							<div
								key={progress.model}
								className="card-glass"
								style={{
									padding: "20px",
									background: "rgba(79,140,255,0.05)",
									border: "1px solid var(--accent)",
									boxShadow: "0 0 20px rgba(79, 140, 255, 0.05)",
									position: "relative",
									overflow: "hidden",
								}}
							>
								<div className="flex-between" style={{ marginBottom: "12px" }}>
									<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
										<RefreshCw size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
										<div>
											<span
												style={{
													fontSize: "12px",
													fontWeight: 800,
													display: "block",
													color: "var(--accent)",
													letterSpacing: "0.5px",
												}}
											>
												DESCARGANDO MOTOR DIGITAL
											</span>
											<span
												style={{
													fontSize: "11px",
													color: "var(--text-main)",
													fontWeight: 700,
												}}
											>
												{progress.model}
											</span>
										</div>
									</div>
									<div style={{ textAlign: "right" }}>
										<span
											style={{
												fontSize: "20px",
												fontWeight: 900,
												color:
													progress.status === "completed" ? "var(--success)" : "var(--text-main)",
												letterSpacing: "-0.5px",
											}}
										>
											{progress.percent}%
										</span>
									</div>
								</div>

								<div
									style={{
										width: "100%",
										height: "6px",
										background: "rgba(0,0,0,0.4)",
										borderRadius: "10px",
										overflow: "hidden",
										border: "1px solid rgba(255,255,255,0.05)",
										position: "relative",
									}}
								>
									<div
										className="progress-active"
										style={{
											width: `${progress.percent}%`,
											height: "100%",
											background:
												progress.status === "completed"
													? "var(--success)"
													: "linear-gradient(90deg, #4f8cff, #a5b4fc, #4f8cff)",
											backgroundSize: "200% 100%",
											transition: "width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)",
										}}
									/>
								</div>

								<div className="flex-between" style={{ marginTop: "10px" }}>
									<span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>
										{progress.status === "completed" ? "FINALIZADO" : "SINCRONIZANDO PESOS..."}
									</span>
									{progress.status === "completed" && (
										<span style={{ fontSize: "10px", color: "var(--success)", fontWeight: 800 }}>
											✓ LISTO PARA OPERAR
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
						gap: "16px",
					}}
				>
					{(models?.filter((m) => !!m?.name) || []).length === 0 ? (
						<div style={{ gridColumn: "1/-1", textAlign: "center", opacity: 0.2, padding: "3rem" }}>
							<Info size={40} style={{ margin: "0 auto 12px", display: "block" }} />
							<p style={{ fontSize: "13px" }}>
								Sin modelos instalados. Descarga uno desde "Descubrir Modelos" abajo.
							</p>
						</div>
					) : (
						models
							.filter((m) => !!m?.name)
							.map((model: OllamaModel) => {
								const sizeGb = model?.size > 0 ? (model.size / 1024 ** 3).toFixed(2) : null;
								return (
									<div
										key={model.name}
										className="card-glass"
										style={{
											padding: "16px",
											background: "rgba(255,255,255,0.02)",
											display: "flex",
											alignItems: "center",
											gap: "12px",
											justifyContent: "space-between",
										}}
									>
										<div style={{ flex: 1, minWidth: 0 }}>
											<p
												style={{
													fontSize: "13px",
													fontWeight: 700,
													color: "var(--text-main)",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{model.name}
											</p>
											<div
												style={{
													display: "flex",
													gap: "8px",
													marginTop: "6px",
													flexWrap: "wrap",
												}}
											>
												{model.details?.parameter_size && (
													<span
														style={{
															fontSize: "10px",
															color: "var(--text-muted)",
															background: "rgba(255,255,255,0.04)",
															padding: "2px 6px",
															borderRadius: "4px",
														}}
													>
														{model.details.parameter_size}
													</span>
												)}
												{sizeGb && (
													<span
														style={{
															fontSize: "10px",
															color: "var(--accent)",
															fontWeight: 700,
														}}
													>
														{sizeGb} GB
													</span>
												)}
											</div>
										</div>
										<div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
											<button
												type="button"
												className="btn-icon"
												onClick={() => setConfigModel(model.name)}
												title="Configurar"
												style={{ color: "var(--text-muted)" }}
											>
												<Settings size={16} />
											</button>
											<button
												type="button"
												className="btn-icon"
												onClick={() => onPull(model.name)}
												title="Actualizar"
											>
												<RefreshCw size={16} />
											</button>
											<button
												type="button"
												className="btn-icon"
												onClick={() => {
													if (confirm(`¿Eliminar ${model.name}?`)) onDelete(model.name);
												}}
												style={{ color: "var(--error)" }}
												title="Eliminar"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</div>
								);
							})
					)}
				</div>
			</div>

			{/* ── Guía de Uso ─────────────────────────────────────── */}
			<div className="card-glass" style={{ padding: "20px", borderLeft: "3px solid var(--accent)" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
					<BookOpen size={16} style={{ color: "var(--accent)" }} />
					<h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "1px" }}>¿CÓMO AGREGAR MODELOS?</h3>
				</div>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
					<div
						style={{
							padding: "14px",
							background: "rgba(255,255,255,0.02)",
							borderRadius: "8px",
							border: "1px solid var(--border-light)",
						}}
					>
						<p
							style={{
								fontSize: "10px",
								fontWeight: 800,
								color: "var(--accent)",
								marginBottom: "6px",
								letterSpacing: "1px",
							}}
						>
							NOMBRE DIRECTO
						</p>
						<p style={{ fontSize: "11px", color: "var(--text-dim)", lineHeight: "1.5" }}>
							Usa el campo de <strong>Descarga Directa</strong> abajo para modelos con tags específicos
							(ej:{" "}
							<code style={{ fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>
								llama3.2:3b
							</code>
							).
						</p>
					</div>
				</div>
				<a
					href="https://ollama.com/library"
					target="_blank"
					rel="noopener noreferrer"
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "6px",
						marginTop: "12px",
						fontSize: "11px",
						color: "var(--text-muted)",
						textDecoration: "none",
					}}
				>
					<ExternalLink size={11} /> Explorar Ollama Library completa →
				</a>
			</div>

			{/* ── Buscador ────────────────────────────────────────── */}
			<div className="card-glass p-8 animate-fade">
				<div className="flex-between" style={{ marginBottom: "20px" }}>
					<h2 style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
						<Sparkles size={22} style={{ color: "var(--accent)" }} />
						Descubrir Modelos
					</h2>
				</div>

				{/* DESCARGA DIRECTA */}
				<div
					className="model-search-bar"
					style={{ marginBottom: "16px", background: "rgba(255,255,255,0.02)" }}
				>
					<div style={{ position: "relative", flex: 1 }}>
						<Download
							size={18}
							style={{
								position: "absolute",
								left: "16px",
								top: "50%",
								transform: "translateY(-50%)",
								opacity: 0.3,
								color: "var(--accent)",
							}}
						/>
						<input
							type="text"
							placeholder="Descarga directa: pegar nombre exacto con tag (ej: deepseek-r1:7b)..."
							className="pin-input"
							style={{
								padding: "14px 14px 14px 48px",
								textAlign: "left",
								fontSize: "13px",
								letterSpacing: "0",
							}}
							value={directPullTerm}
							onChange={(e) => setDirectPullTerm(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleDirectPull();
							}}
						/>
					</div>
					<button
						type="button"
						className="auth-btn"
						style={{ width: "auto", padding: "0 24px", display: "flex", alignItems: "center", gap: "8px" }}
						onClick={handleDirectPull}
					>
						<Download size={16} /> Descargar
					</button>
				</div>

				{/* BUSCADOR */}
				<div className="model-search-bar">
					<div style={{ position: "relative", flex: 1 }}>
						<Search
							size={18}
							style={{
								position: "absolute",
								left: "16px",
								top: "50%",
								transform: "translateY(-50%)",
								opacity: 0.3,
							}}
						/>
						<input
							type="text"
							placeholder="Buscar en la librería de Ollama (ej: mistral)..."
							className="pin-input"
							style={{
								padding: "14px 14px 14px 48px",
								textAlign: "left",
								fontSize: "13px",
								letterSpacing: "0",
							}}
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleManualPull();
							}}
						/>
					</div>
					<button
						type="button"
						className="auth-btn"
						style={{
							width: "auto",
							padding: "0 24px",
							display: "flex",
							alignItems: "center",
							gap: "8px",
							background: "rgba(255,255,255,0.05)",
							border: "1px solid var(--border-light)",
							color: "var(--text-main)",
						}}
						onClick={handleManualPull}
						disabled={isSearching}
					>
						{isSearching ? <Loader size={18} className="animate-spin" /> : <ScanSearch size={18} />}
					</button>

					{/* Filtros Rápidos */}
					<button
						type="button"
						className="btn-icon"
						style={{
							background: "rgba(255,255,255,0.05)",
							border: "1px solid var(--border-light)",
							padding: "0 16px",
							borderRadius: "8px",
							fontSize: "12px",
							fontWeight: 600,
							color: "var(--text-main)",
							whiteSpace: "nowrap",
						}}
						onClick={() => handleSearch(searchTerm, "popular")}
						disabled={isSearching}
						title="Ver los más descargados"
					>
						Populares
					</button>
					<button
						type="button"
						className="btn-icon"
						style={{
							background: "rgba(255,255,255,0.05)",
							border: "1px solid var(--border-light)",
							padding: "0 16px",
							borderRadius: "8px",
							fontSize: "12px",
							fontWeight: 600,
							color: "var(--text-main)",
							whiteSpace: "nowrap",
						}}
						onClick={() => handleSearch(searchTerm, "newest")}
						disabled={isSearching}
						title="Ver los más recientes"
					>
						Nuevos
					</button>

					{/* Botón de Limpiar */}
					{(hasSearched || searchTerm) && (
						<button
							type="button"
							className="btn-icon"
							style={{
								background: "rgba(245,158,11,0.1)",
								border: "1px solid rgba(245,158,11,0.2)",
								padding: "0 12px",
								borderRadius: "8px",
								color: "var(--warning)",
							}}
							onClick={() => {
								setSearchTerm("");
								setSearchResults([]);
								setHasSearched(false);
							}}
							title="Limpiar y volver a Sugeridos"
						>
							<Trash2 size={16} />
						</button>
					)}
				</div>

				{searchError && (
					<p
						style={{
							fontSize: "12px",
							color: "var(--warning)",
							marginBottom: "8px",
							padding: "8px 12px",
							background: "rgba(245,158,11,0.08)",
							borderRadius: "6px",
							border: "1px solid rgba(245,158,11,0.2)",
						}}
					>
						⚠ {searchError}
					</p>
				)}

				<p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px" }}>
					{hasSearched
						? `${searchResults.length} resultado(s) para "${searchTerm}" — haz clic en una tarjeta para descargar`
						: "Modelos populares sugeridos — haz clic para descargar o usa el buscador arriba"}
				</p>

				<div className="suggested-grid">
					{isSearching ? (
						<div style={{ gridColumn: "1/-1", textAlign: "center", padding: "32px", opacity: 0.4 }}>
							<Loader size={32} className="animate-spin" style={{ margin: "0 auto" }} />
							<p style={{ marginTop: "12px", fontSize: "12px" }}>Consultando ollama.com...</p>
						</div>
					) : (
						displayModels.map((s: Record<string, any>) => {
							const isInstalled = installedNames.some((n) => n.startsWith(s.name.split(":")[0]));
							return (
								<button
									type="button"
									key={s.name as string}
									className="suggested-card"
									onClick={() => {
										setVerificationModel(s);
										// Buscar el primer tag que NO esté instalado para ponerlo por defecto
										const defaultTag = s.tags?.find(
											(t: string) => !installedNames.some((n: string) => n.startsWith(s.name) && n.endsWith(`:${t.toLowerCase()}`))
										) || s.tags?.[0] || null;
										setSelectedTag(defaultTag);
									}}
								>
									<div className="flex-between">
										<span className={`model-tag ${isInstalled ? "" : "prime"}`}>
											{s.tags?.[0] || "LLM"}
										</span>
										<span style={{ fontSize: "10px", opacity: 0.4 }}>{s.pulls || ""}</span>
									</div>
									<h3 style={{ fontSize: "14px", fontWeight: 700 }}>{s.title || s.name}</h3>
									<p
										style={{
											fontSize: "11px",
											color: "var(--text-dim)",
											lineHeight: "1.4",
											flex: 1,
										}}
									>
										{s.desc || "Modelo de la librería oficial de Ollama."}
									</p>
									{s.tags?.length > 1 && (
										<div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
											{s.tags.slice(1).map((t: string) => (
												<span
													key={t}
													style={{
														fontSize: "9px",
														padding: "1px 6px",
														background: "rgba(255,255,255,0.05)",
														borderRadius: "3px",
														color: "var(--text-muted)",
													}}
												>
													{t}
												</span>
											))}
										</div>
									)}
									{isInstalled ? (
										<span
											style={{
												fontSize: "10px",
												color: "var(--success)",
												fontWeight: 800,
												marginTop: "4px",
											}}
										>
											✓ INSTALADO
										</span>
									) : (
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "4px",
												color: "var(--accent)",
												fontSize: "11px",
												fontWeight: 800,
												marginTop: "4px",
											}}
										>
											<Download size={12} /> DESCARGAR
										</div>
									)}
								</button>
							);
						})
					)}
				</div>
			</div>

			{/* Modal de Verificación */}
			{verificationModel && (
				<button type="button" className="modal-overlay" onClick={() => setVerificationModel(null)}>
					<div
						className="verification-modal"
						role="dialog"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") e.stopPropagation();
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
							<div
								style={{ background: "rgba(79, 140, 255, 0.1)", padding: "10px", borderRadius: "12px" }}
							>
								<Download size={24} style={{ color: "var(--accent)" }} />
							</div>
							<div>
								<h3 style={{ fontSize: "18px", fontWeight: 700 }}>Confirmar Descarga</h3>
								<p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
									LaLlamaOllama Repository
								</p>
							</div>
						</div>

						<div
							className="card-glass"
							style={{ padding: "16px", background: "rgba(255,255,255,0.02)", marginBottom: "20px" }}
						>
							<p
								style={{
									fontSize: "14px",
									fontWeight: 700,
									color: "var(--accent)",
									marginBottom: "4px",
								}}
							>
								{verificationModel.title || verificationModel.name}
							</p>
							<p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.5" }}>
								{verificationModel.desc}
							</p>
							{verificationModel.tags && (
								<div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
									{verificationModel.tags.map((t: string) => {
										const isTagInstalled = installedNames.some(n => 
											n.startsWith(verificationModel.name) && n.endsWith(`:${t.toLowerCase()}`)
										);
										const isSelected = selectedTag === t;
										
										return (
											<button
												type="button"
												key={t}
												onClick={() => !isTagInstalled && setSelectedTag(t)}
												style={{
													fontSize: "11px",
													fontWeight: 700,
													background: isTagInstalled 
														? "rgba(16,185,129,0.15)"
														: isSelected ? "var(--accent)" : "rgba(255,255,255,0.05)",
													color: isTagInstalled
														? "var(--success)"
														: isSelected ? "var(--bg-main)" : "var(--text-muted)",
													padding: "4px 10px",
													borderRadius: "4px",
													border: "1px solid",
													borderColor: isTagInstalled
														? "var(--success)"
														: isSelected ? "var(--accent)" : "transparent",
													cursor: isTagInstalled ? "default" : "pointer",
													transition: "all 0.2s ease",
													opacity: isTagInstalled ? 0.8 : 1,
												}}
												title={isTagInstalled ? "Ya instalado" : `Seleccionar versión ${t}`}
											>
												{t} {isTagInstalled && "✓"}
											</button>
										);
									})}
								</div>
							)}
						</div>

						<div
							style={{
								background: "rgba(245,158,11,0.05)",
								border: "1px solid rgba(245,158,11,0.2)",
								padding: "12px",
								borderRadius: "8px",
								marginBottom: "8px",
							}}
						>
							<p
								style={{
									fontSize: "11px",
									color: "var(--warning)",
									display: "flex",
									gap: "8px",
									alignItems: "center",
								}}
							>
								<Info size={14} />
								La descarga consumirá ancho de banda y espacio en disco significativo.
							</p>
						</div>

						<div className="modal-actions">
							<button
								type="button"
								className="btn-icon"
								style={{
									flex: 1,
									padding: "12px",
									borderRadius: "8px",
									fontSize: "13px",
									fontWeight: 600,
								}}
								onClick={() => setVerificationModel(null)}
							>
								Cancelar
							</button>
							<button
								type="button"
								className="auth-btn"
								style={{
									flex: 2,
									padding: "12px",
									fontSize: "13px",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: "8px",
								}}
								onClick={confirmPull}
							>
								<Download size={16} /> Confirmar Descarga
							</button>
						</div>
					</div>
				</button>
			)}

			{/* Modal de Configuración */}
			{configModel && <ModelConfigModal modelName={configModel} onClose={() => setConfigModel(null)} />}
		</div>
	);
};
