import { registerCreateTool } from "./create-tool.js";
import { registerDeleteTool } from "./delete-tool.js";
import { registerEditTool } from "./edit-tool.js";
import { registerExportTool } from "./export-tool.js";
import { registerImportTool } from "./import-tool.js";
import { registerListCustomTools } from "./list-custom-tools.js";
import { registerTestTool } from "./test-tool.js";

/**
 * Registra todas las herramientas del Modo Evolutivo (meta-tools para crear/modificar/eliminar tools custom).
 */
export function registerEvolutivoTools(): void {
	registerCreateTool();
	registerEditTool();
	registerDeleteTool();
	registerTestTool();
	registerListCustomTools();
	registerExportTool();
	registerImportTool();
}
