import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notificationsRouter from "./notifications";
import stripeRouter from "./stripe";
import accountsRouter from "./accounts";
import appointmentsRouter from "./appointments";
import clinicalRecordsRouter from "./clinical-records";
import pharmacyRouter from "./pharmacy";
import adminOperationsRouter from "./admin-operations";
import messagesRouter from "./messages";
import doctorRouter from "./doctor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(notificationsRouter);
router.use(stripeRouter);
router.use(accountsRouter);
router.use(appointmentsRouter);
router.use(clinicalRecordsRouter);
router.use(pharmacyRouter);
router.use(adminOperationsRouter);
router.use(messagesRouter);
router.use(doctorRouter);

export default router;
