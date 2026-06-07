import { User, Users } from "lucide-react";
import { useState } from "react";
import { AgentePrincipal } from "./AgentePrincipal";
import { SubAgentesList } from "./SubAgentesList";

type AgentesSubTab = "main" | "subs";

export const Agentes: React.FC = () => {
	const [subTab, setSubTab] = useState<AgentesSubTab>("main");

	return (
		<div style={{ maxWidth: "900px", margin: "0 auto" }}>
			<div className="sub-tabs">
				<button
					type="button"
					className={`sub-tab-btn ${subTab === "main" ? "active" : ""}`}
					onClick={() => setSubTab("main")}
				>
					<User size={14} />
					Agente Principal
				</button>
				<button
					type="button"
					className={`sub-tab-btn ${subTab === "subs" ? "active" : ""}`}
					onClick={() => setSubTab("subs")}
				>
					<Users size={14} />
					Sub Agentes
				</button>
			</div>

			{subTab === "main" ? <AgentePrincipal /> : <SubAgentesList />}
		</div>
	);
};
