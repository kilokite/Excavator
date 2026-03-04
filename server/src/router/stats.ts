import { router, publicPro } from "../trpc/trpc.js";
import { getStatsSnapshot } from "../app/utils/stats.js";
import os from "node:os";

export default router({
	getSummary: publicPro.query(() => {
		const base = getStatsSnapshot() as any;
		const mem = process.memoryUsage();
		const toMB = (v: number) => Math.round((v / 1024 / 1024) * 10) / 10;
		const uptimeSec = Math.round(process.uptime());
		const cpu = process.cpuUsage();
		const cpuUserMs = Math.round(cpu.user / 1000);
		const cpuSystemMs = Math.round(cpu.system / 1000);
		const cpuTotalMs = cpuUserMs + cpuSystemMs;
		const cpuPerSec = uptimeSec > 0 ? Math.round((cpuTotalMs / uptimeSec) * 10) / 10 : 0;
		const load = os.loadavg?.() ?? [0, 0, 0];

		const runtime = {
			rssMB: toMB(mem.rss),
			heapUsedMB: toMB(mem.heapUsed),
			heapTotalMB: toMB(mem.heapTotal),
			externalMB: toMB(mem.external || 0),
			uptimeSec,
			nodeVersion: process.version,
			cpuUserMs,
			cpuSystemMs,
			cpuTotalMs,
			cpuPerSec,
			load1: Math.round((load[0] || 0) * 100) / 100,
			load5: Math.round((load[1] || 0) * 100) / 100,
			load15: Math.round((load[2] || 0) * 100) / 100,
			pid: process.pid,
			platform: process.platform,
		};
		return {
			...base,
			runtime,
		};
	}),
});

