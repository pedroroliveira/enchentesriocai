import type { Request, Response } from "express";
import { testConnection } from "../../db/client.js";

export default async function handler(_req: Request, res: Response) {
	const database = await testConnection();
	res.status(database ? 200 : 503);
	res.json({
		status: database ? "ok" : "degraded",
		database: database ? "ok" : "unavailable",
		timestamp: new Date().toISOString(),
		service: "enchentes-vale-do-cai",
	});
}
