import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	name?: string;
}
interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(`[ErrorBoundary${this.props.name ? ":" + this.props.name : ""}]`, error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
						<div style={{ fontSize: "32px", marginBottom: "16px", opacity: 0.5 }}>&#9888;&#65039;</div>
						<h3 style={{ color: "var(--text-main)", margin: "0 0 8px" }}>Algo sali&oacute; mal</h3>
						<p style={{ fontSize: "12px", color: "var(--error)", marginBottom: "16px" }}>
							{this.state.error?.message || "Error desconocido"}
						</p>
						<button
							type="button"
							onClick={() => this.setState({ hasError: false })}
							style={{
								padding: "8px 20px",
								background: "rgba(79,140,255,0.1)",
								border: "1px solid rgba(79,140,255,0.2)",
								borderRadius: "8px",
								color: "var(--accent)",
								cursor: "pointer",
								fontSize: "12px",
								fontWeight: 600,
							}}
						>
							Reintentar
						</button>
					</div>
				)
			);
		}
		return this.props.children;
	}
}
