import { Router } from "express";
import { UserRole } from "@prisma/client";

import { authenticate, authorize } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

import { globalSearchController } from "./search.controller";
import { globalSearchQuerySchema } from "./search.schema";

const searchRoutes = Router();

searchRoutes.use(authenticate, authorize(UserRole.ADMIN));

searchRoutes.get(
  "/",
  validate(globalSearchQuerySchema, "query"),
  globalSearchController,
);

export default searchRoutes;
