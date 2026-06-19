import express, { Request, Response } from "express";
import { initDatabase } from "./database/database";
import { initServiceTypeConfigs } from "./services/serviceTypeService";
import { seedSampleData } from "./data/seed";

import workerRoutes from "./routes/workerRoutes";
import certificationRoutes from "./routes/certificationRoutes";
import serviceTypeRoutes from "./routes/serviceTypeRoutes";
import statsRoutes from "./routes/statsRoutes";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(express.json());

app.use("/api/workers", workerRoutes);
app.use("/api/certifications", certificationRoutes);
app.use("/api/service-types", serviceTypeRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export function startServer(port: number = PORT) {
  initDatabase();
  initServiceTypeConfigs();

  const server = app.listen(port, () => {
    console.log(`家政人员认证服务已启动: http://localhost:${port}`);
    console.log(`健康检查: http://localhost:${port}/api/health`);
  });

  return server;
}

if (require.main === module) {
  startServer();

  if (process.env.SEED_DATA === "true") {
    seedSampleData();
  }
}

export default app;
