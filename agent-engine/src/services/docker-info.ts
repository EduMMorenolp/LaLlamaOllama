import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cpus, hostname, platform, totalmem } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface DockerInfo {
	/** Whether the process is running inside a Docker container */
	inDocker: boolean;
	/** Container hostname (container ID or name) */
	containerName: string;
	/** Number of logical CPU cores available */
	cpuCores: number;
	/** Total system memory in bytes (from OS) */
	memoryTotalBytes: number;
	/** Container memory limit in bytes (from cgroup), or 0 if unlimited/unknown */
	memoryLimitBytes: number;
	/** Whether an NVIDIA GPU is available */
	gpuAvailable: boolean;
	/** Human-readable GPU info string */
	gpuInfo: string;
	/** Total disk space in bytes on the workspace mount */
	diskTotalBytes: number;
	/** Available/free disk space in bytes on the workspace mount */
	diskFreeBytes: number;
	/** Platform the agent is running on */
	platform: string;
}

/**
 * Detect if the process is running inside a Docker container.
 */
function detectDocker(): boolean {
	try {
		// Method 1: /.dockerenv marker file
		if (existsSync("/.dockerenv")) return true;

		// Method 2: cgroup v1/v2 contains "docker" in the entries
		if (existsSync("/proc/1/cgroup")) {
			const content = readFileSync("/proc/1/cgroup", { encoding: "utf8" });
			if (/docker|lxc|kubepods/i.test(content)) return true;
		}

		// Method 3: Check for Docker-specific env hints
		if (process.env.DOCKER_CONTAINER) return true;
	} catch {
		// Ignore errors
	}
	return false;
}

/**
 * Read container memory limit from cgroup.
 * Returns 0 if unlimited or could not be read.
 */
function readMemoryLimit(): number {
	try {
		// cgroup v2
		if (existsSync("/sys/fs/cgroup/memory.max")) {
			const raw = readFileSync("/sys/fs/cgroup/memory.max", { encoding: "utf8" }).trim();
			if (raw !== "" && raw !== "max") {
				const val = Number.parseInt(raw, 10);
				if (!Number.isNaN(val) && val > 0) return val;
			}
		}
		// cgroup v1
		if (existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
			const raw = readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", { encoding: "utf8" }).trim();
			const val = Number.parseInt(raw, 10);
			// 9223372036854771712 is the "no limit" sentinel in cgroup v1
			if (!Number.isNaN(val) && val > 0 && val < 9223372036854771712) return val;
		}
	} catch {
		// Ignore errors
	}
	return 0;
}

/**
 * Try to detect NVIDIA GPU via nvidia-smi or env var.
 */
async function detectGpu(): Promise<{ available: boolean; info: string }> {
	// Quick check via env var
	if (process.env.NVIDIA_VISIBLE_DEVICES === "none" || process.env.NVIDIA_VISIBLE_DEVICES === "") {
		return { available: false, info: "Deshabilitada por NVIDIA_VISIBLE_DEVICES" };
	}

	try {
		const { stdout } = await execAsync(
			"nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits",
			{ timeout: 5000, windowsHide: true }
		);
		const lines = stdout.trim().split("\n").filter(Boolean);
		if (lines.length > 0) {
			const parts = lines[0].split(", ");
			const name = parts[0]?.trim() || "Unknown";
			const mem = parts[1]?.trim() ? `${parts[1]} MiB` : "?";
			const driver = parts[2]?.trim() ? `driver ${parts[2]}` : "";
			return {
				available: true,
				info: `${name} (${mem}${driver ? `, ${driver}` : ""})`,
			};
		}
		return { available: false, info: "nvidia-smi no reportó GPUs" };
	} catch {
		// Check if env var suggests GPU is available even without nvidia-smi
		const hasGpuEnv = process.env.NVIDIA_VISIBLE_DEVICES && process.env.NVIDIA_VISIBLE_DEVICES !== "none";
		if (hasGpuEnv) {
			return { available: true, info: `NVIDIA_VISIBLE_DEVICES=${process.env.NVIDIA_VISIBLE_DEVICES}` };
		}
		return { available: false, info: "No detectada" };
	}
}

/**
 * Get disk space info using `df` on Linux or fallback.
 */
async function detectDisk(path: string): Promise<{ total: number; free: number }> {
	try {
		if (platform() === "linux") {
			const { stdout } = await execAsync(`df -B1 "${path}" --output=size,avail`, {
				timeout: 3000,
				windowsHide: true,
			});
			const lines = stdout.trim().split("\n");
			if (lines.length >= 2) {
				const parts = lines[1].trim().split(/\s+/);
				const total = Number.parseInt(parts[0], 10);
				const free = Number.parseInt(parts[1], 10);
				if (!Number.isNaN(total) && !Number.isNaN(free)) {
					return { total, free };
				}
			}
		}
	} catch {
		// Fallback
	}
	return { total: 0, free: 0 };
}

/**
 * Detect full Docker environment information.
 * This function is safe to call on non-Docker environments (returns appropriate flags).
 */
export async function detectDockerInfo(workspaceDir?: string): Promise<DockerInfo> {
	const host = hostname();
	const cpuCount = cpus().length;
	const memTotal = totalmem();
	const memLimit = readMemoryLimit();
	const inDocker = detectDocker();
	const gpu = await detectGpu();
	const disk = await detectDisk(workspaceDir || "/workspace");

	return {
		inDocker,
		containerName: host,
		cpuCores: cpuCount,
		memoryTotalBytes: memTotal,
		memoryLimitBytes: memLimit,
		gpuAvailable: gpu.available,
		gpuInfo: gpu.info,
		diskTotalBytes: disk.total,
		diskFreeBytes: disk.free,
		platform: platform(),
	};
}

/**
 * Format DockerInfo into a human-readable string suitable for the system prompt.
 */
export function formatDockerInfo(info: DockerInfo): string {
	const lines: string[] = ["## Entorno del agente"];

	if (info.inDocker) {
		lines.push(`- Ejecutando dentro de un contenedor Docker`);
		lines.push(`- Nombre del contenedor: ${info.containerName}`);
	} else {
		lines.push(`- Ejecutando en el host (fuera de Docker)`);
		lines.push(`- Hostname: ${info.containerName}`);
	}

	lines.push(`- Plataforma: ${info.platform}`);
	lines.push(`- CPUs: ${info.cpuCores} núcleos lógicos`);

	// Memory
	const memTotalGb = (info.memoryTotalBytes / 1024 / 1024 / 1024).toFixed(1);
	if (info.memoryLimitBytes > 0) {
		const memLimitGb = (info.memoryLimitBytes / 1024 / 1024 / 1024).toFixed(1);
		lines.push(`- RAM total del host: ${memTotalGb} GB | Límite del contenedor: ${memLimitGb} GB`);
	} else {
		lines.push(`- RAM total: ${memTotalGb} GB`);
	}

	// GPU
	if (info.gpuAvailable) {
		lines.push(`- GPU disponible: ${info.gpuInfo}`);
	} else {
		lines.push(`- GPU: No disponible`);
	}

	// Disk
	if (info.diskTotalBytes > 0) {
		const totalGb = (info.diskTotalBytes / 1024 / 1024 / 1024).toFixed(1);
		const freeGb = (info.diskFreeBytes / 1024 / 1024 / 1024).toFixed(1);
		lines.push(`- Disco: ${freeGb} GB libres / ${totalGb} GB totales`);
	}

	return lines.join("\n");
}
