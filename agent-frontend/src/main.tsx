import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WsProvider } from "./contexts/WebSocketContext";
import { ToastProvider } from "./contexts/ToastContext";
import "./index.css";
import App from "./App";

const root = document.getElementById("root");
if (root)
	createRoot(root).render(
		<StrictMode>
			<WsProvider>
				<ToastProvider>
					<App />
				</ToastProvider>
			</WsProvider>
		</StrictMode>
	);
