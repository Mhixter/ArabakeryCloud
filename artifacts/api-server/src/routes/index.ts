import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companyRouter from "./company";
import subscriptionsRouter from "./subscriptions";
import usersRouter from "./users";
import branchesRouter from "./branches";
import productionRouter from "./production";
import inventoryRouter from "./inventory";
import salesRouter from "./sales";
import reportsRouter from "./reports";
import auditLogsRouter from "./auditLogs";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companyRouter);
router.use(subscriptionsRouter);
router.use(usersRouter);
router.use(branchesRouter);
router.use(productionRouter);
router.use(inventoryRouter);
router.use(salesRouter);
router.use(reportsRouter);
router.use(auditLogsRouter);
router.use(adminRouter);

export default router;
