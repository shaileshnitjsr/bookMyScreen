

import { Router } from "express";
import * as ShowController from "./show.controller";

const router = Router();

router.post("/", ShowController.createShow);
router.get("/", ShowController.getShowsByMovieDateLocation);
router.get("/:id", ShowController.getShowById);

export default router;