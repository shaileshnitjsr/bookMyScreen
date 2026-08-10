import { Router } from "express";
import * as PaymentController from "./payment.controller";
import { isVerifiedUser } from "../../middlewares/auth.middleware";

const router = Router();


router.post("/create-order", isVerifiedUser ,PaymentController.createOrder);
router.post("/verify-payment", isVerifiedUser ,PaymentController.verifyPayment);


export default router;