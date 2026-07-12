import { Router } from "express";
import * as adminCalendarController from "./admin-calendar.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  calendarQuerySchema,
  dayParamSchema,
  conflictsQuerySchema,
} from "./admin-calendar.schema";
import { UserRole } from "@prisma/client";

const adminCalendarRoutes = Router();

adminCalendarRoutes.use(authenticate, authorize(UserRole.ADMIN));

// ============================================================================
// ADMIN CALENDAR ROUTES (Base Path: /api/v1/admin/calendar)
// ============================================================================

adminCalendarRoutes.get(
  "/",
  validate(calendarQuerySchema, "query"),
  adminCalendarController.getCalendarMonth,
);

adminCalendarRoutes.get(
  "/conflicts",
  validate(conflictsQuerySchema, "query"),
  adminCalendarController.getConflicts,
);

adminCalendarRoutes.get(
  "/day/:date",
  validate(dayParamSchema, "params"),
  adminCalendarController.getDayAgenda,
);

export default adminCalendarRoutes;
