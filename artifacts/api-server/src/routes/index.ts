import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notificationsRouter from "./notifications";
import stripeRouter from "./stripe";
import accountsRouter from "./accounts";
import appointmentsRouter from "./appointments";
import clinicalRecordsRouter from "./clinical-records";

const router: IRouter = Router();

router.use(healthRouter);
router.use(notificationsRouter);
router.use(stripeRouter);
router.use(accountsRouter);
router.use(appointmentsRouter);
router.use(clinicalRecordsRouter);

export default router;
