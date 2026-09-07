import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import { authRouter } from "@/routes/auth.routes";

export const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
