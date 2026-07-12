import { Router } from "express";
import * as adminClientController from "./admin-client.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  clientIdParamSchema,
  listClientsQuerySchema,
} from "./admin-client.schema";
import { UserRole } from "@prisma/client";

const adminClientRoutes = Router();

adminClientRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN CLIENT ROUTES (Base Path: /api/v1/admin/clients)
// ============================================================================

adminClientRoutes.get(
  "/",
  validate(listClientsQuerySchema, "query"),
  adminClientController.listClients,
);

adminClientRoutes.get(
  "/:clientId",
  validate(clientIdParamSchema, "params"),
  adminClientController.getClientDetail,
);

export default adminClientRoutes;
