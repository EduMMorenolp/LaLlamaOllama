const fs = require('fs');
const path = 'D:/Proyectos/LaLlamaOllama/agent-frontend/src/components/AgentChat.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add useToast import after useWs import
content = content.replace(
  'import { useWs } from "../contexts/WebSocketContext";',
  'import { useWs } from "../contexts/WebSocketContext";\nimport { useToast } from "../contexts/ToastContext";'
);

// 2. Add toast hook after useWs hook
content = content.replace(
  'const { connected, send: sendWs, subscribe } = useWs();',
  'const { connected, send: sendWs, subscribe } = useWs();\n  const { show: showToast } = useToast();'
);

// 3. Add state for new task modal (after selectedCmdIndex state)
content = content.replace(
  'const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);',
  'const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);\n  const [showNewTaskModal, setShowNewTaskModal] = useState(false);\n  const [newTaskText, setNewTaskText] = useState("");'
);

// 4. Change /nuevaTarea command from sendWs to show modal
content = content.replace(
  '} else if (cmd.cmd === "/nuevaTarea") {\n\t\t\t\tsendWs("new_task", {});',
  '} else if (cmd.cmd === "/nuevaTarea") {\n\t\t\t\tsetShowNewTaskModal(true);'
);

// 5. Add task_completed and task_failed cases, add showToast to task_created
content = content.replace(
  'case "task_created": {\n\t\t\t\tconst taskRunId = msg.payload?.runId as number;\n\t\t\t\tconst taskText = msg.payload?.text as string;\n\t\t\t\tsetMessages((prev) => [\n\t\t\t\t\t...prev,\n\t\t\t\t\t{\n\t\t\t\t\t\trole: "system",\n\t\t\t\t\t\tcontent: "\\u2705 Tarea creada (#" + taskRunId + "): **" + taskText + "**",\n\t\t\t\t\t\ttimestamp: new Date(),\n\t\t\t\t\t},\n\t\t\t\t]);\n\t\t\t\tbreak;\n\t\t\t}\n\t\t\tcase "telegram_message"',
  'case "task_created": {\n\t\t\t\tconst taskRunId = msg.payload?.runId as number;\n\t\t\t\tconst taskText = msg.payload?.text as string;\n\t\t\t\tsetMessages((prev) => [\n\t\t\t\t\t...prev,\n\t\t\t\t\t{\n\t\t\t\t\t\trole: "system",\n\t\t\t\t\t\tcontent: "\\u2705 Tarea creada (#" + taskRunId + "): **" + taskText + "**",\n\t\t\t\t\t\ttimestamp: new Date(),\n\t\t\t\t\t},\n\t\t\t\t]);\n\t\t\t\tshowToast("Nueva tarea creada", "success");\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tcase "task_completed": {\n\t\t\t\tconst compRunId = msg.payload?.runId as number;\n\t\t\t\tshowToast("Tarea #" + compRunId + " completada", "success");\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tcase "task_failed": {\n\t\t\t\tconst failRunId = msg.payload?.runId as number;\n\t\t\t\tshowToast("Tarea #" + failRunId + " fallida", "error");\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tcase "telegram_message"'
);

// 6. Add task creation modal before the image lightbox overlay
content = content.replace(
  '{/* Feature: image lightbox overlay */}',
  '{/* Nueva Tarea Modal */}\n\n\t\t\t{showNewTaskModal && (\n\t\t\t\t<div\n\t\t\t\t\tstyle={{\n\t\t\t\t\t\tposition: "fixed",\n\t\t\t\t\t\ttop: 0,\n\t\t\t\t\t\tleft: 0,\n\t\t\t\t\t\tright: 0,\n\t\t\t\t\t\tbottom: 0,\n\t\t\t\t\t\tbackground: "rgba(0,0,0,0.7)",\n\t\t\t\t\t\tbackdropFilter: "blur(4px)",\n\t\t\t\t\t\tdisplay: "flex",\n\t\t\t\t\t\talignItems: "center",\n\t\t\t\t\t\tjustifyContent: "center",\n\t\t\t\t\t\tzIndex: 1000,\n\t\t\t\t\t}}\n\t\t\t\t\tonClick={() => setShowNewTaskModal(false)}\n\t\t\t\t>\n\t\t\t\t\t<div\n\t\t\t\t\t\tstyle={{\n\t\t\t\t\t\t\tbackground: "var(--bg-surface)",\n\t\t\t\t\t\t\tborder: "1px solid var(--border)",\n\t\t\t\t\t\t\tborderRadius: "16px",\n\t\t\t\t\t\t\twidth: "500px",\n\t\t\t\t\t\t\tmaxWidth: "90vw",\n\t\t\t\t\t\t\tpadding: "24px",\n\t\t\t\t\t\t}}\n\t\t\t\t\t\tonClick={(e) => e.stopPropagation()}\n\t\t\t\t\t>\n\t\t\t\t\t\t<h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>\n\t\t\t\t\t\t\tNueva Tarea\n\t\t\t\t\t\t</h3>\n\t\t\t\t\t\t<div style={{ marginBottom: "16px" }}>\n\t\t\t\t\t\t\t<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>\n\t\t\t\t\t\t\t\tDescripci\\u00F3n de la tarea\n\t\t\t\t\t\t\t</label>\n\t\t\t\t\t\t\t<textarea\n\t\t\t\t\t\t\t\tvalue={newTaskText}\n\t\t\t\t\t\t\t\tonChange={(e) => setNewTaskText(e.target.value)}\n\t\t\t\t\t\t\t\tplaceholder="Describe la tarea a ejecutar..."\n\t\t\t\t\t\t\t\trows={4}\n\t\t\t\t\t\t\t\tautoFocus\n\t\t\t\t\t\t\t\tstyle={{\n\t\t\t\t\t\t\t\t\twidth: "100%",\n\t\t\t\t\t\t\t\t\tbackground: "rgba(255,255,255,0.03)",\n\t\t\t\t\t\t\t\t\tborder: "1px solid var(--border-light)",\n\t\t\t\t\t\t\t\t\tborderRadius: "6px",\n\t\t\t\t\t\t\t\t\tpadding: "8px 12px",\n\t\t\t\t\t\t\t\t\tcolor: "var(--text-main)",\n\t\t\t\t\t\t\t\t\tfontSize: "13px",\n\t\t\t\t\t\t\t\t\tfontFamily: "inherit",\n\t\t\t\t\t\t\t\t\tresize: "vertical",\n\t\t\t\t\t\t\t\t\toutline: "none",\n\t\t\t\t\t\t\t\t\tboxSizing: "border-box",\n\t\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\t/>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => {\n\t\t\t\t\t\t\t\t\tsetShowNewTaskModal(false);\n\t\t\t\t\t\t\t\t\tsetNewTaskText("");\n\t\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\t\tstyle={{\n\t\t\t\t\t\t\t\t\tpadding: "8px 20px",\n\t\t\t\t\t\t\t\t\tbackground: "rgba(255,255,255,0.05)",\n\t\t\t\t\t\t\t\t\tborder: "1px solid var(--border-light)",\n\t\t\t\t\t\t\t\t\tborderRadius: "8px",\n\t\t\t\t\t\t\t\t\tcolor: "var(--text-main)",\n\t\t\t\t\t\t\t\t\tcursor: "pointer",\n\t\t\t\t\t\t\t\t\tfontSize: "12px",\n\t\t\t\t\t\t\t\t\tfontWeight: 600,\n\t\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\tCancelar\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => {\n\t\t\t\t\t\t\t\t\tif (!newTaskText.trim()) return;\n\t\t\t\t\t\t\t\t\tsendWs("new_task", { text: newTaskText.trim() });\n\t\t\t\t\t\t\t\t\tsetNewTaskText("");\n\t\t\t\t\t\t\t\t\tsetShowNewTaskModal(false);\n\t\t\t\t\t\t\t\t\tshowToast("Tarea enviada", "success");\n\t\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\t\tdisabled={!newTaskText.trim()}\n\t\t\t\t\t\t\t\tstyle={{\n\t\t\t\t\t\t\t\t\tpadding: "8px 20px",\n\t\t\t\t\t\t\t\t\tbackground: "linear-gradient(135deg, var(--accent), #7c3aed)",\n\t\t\t\t\t\t\t\t\tborder: "none",\n\t\t\t\t\t\t\t\t\tborderRadius: "8px",\n\t\t\t\t\t\t\t\t\tcolor: "white",\n\t\t\t\t\t\t\t\t\tcursor: "pointer",\n\t\t\t\t\t\t\t\t\tfontSize: "12px",\n\t\t\t\t\t\t\t\t\tfontWeight: 600,\n\t\t\t\t\t\t\t\t\topacity: !newTaskText.trim() ? 0.5 : 1,\n\t\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\tCrear Tarea\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t)}\n\n\t\t\t{/* Feature: image lightbox overlay */}'
);

fs.writeFileSync(path, content, 'utf8');
console.log('AgentChat.tsx modified successfully');

// Additional fix: ensure nuevaTarea command opens modal
let content2 = fs.readFileSync(path, 'utf8');

// Check if the command still uses sendWs
if (content2.includes('sendWs(\"new_task\", {});')) {
  // Replace using a more specific pattern
  content2 = content2.replace(
    'else if (cmd.cmd === \"/nuevaTarea\") {\n\t\t\t\tsendWs(\"new_task\", {});',
    'else if (cmd.cmd === \"/nuevaTarea\") {\n\t\t\t\tsetShowNewTaskModal(true);'
  );
  fs.writeFileSync(path, content2, 'utf8');
  console.log('Fixed nuevaTarea command');
} else {
  console.log('nuevaTarea already fixed');
}

// More direct fix for nuevaTarea
let c3 = fs.readFileSync(path, 'utf8');
const searchStr = String.fromCharCode(115, 101, 110, 100, 87, 115, 40, 34, 110, 101, 119, 95, 116, 97, 115, 107, 34, 44, 32, 123, 125, 41, 59);
const replaceStr = String.fromCharCode(115, 101, 116, 83, 104, 111, 119, 78, 101, 119, 84, 97, 115, 107, 77, 111, 100, 97, 108, 40, 116, 114, 117, 101, 41, 59);
if (c3.includes(searchStr)) {
  c3 = c3.replace(searchStr, replaceStr);
  fs.writeFileSync(path, c3, 'utf8');
  console.log('Direct replacement done');
} else {
  console.log('Pattern not found');
}
