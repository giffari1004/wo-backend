import { Router } from "express";
import * as vendorController from "./vendor.controller";
import { validate } from "@/middlewares/validate.middleware";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import {
  createVendorSchema,
  updateVendorSchema,
  vendorIdParamSchema,
  addPortfolioSchema,
  portfolioIdParamSchema,
  setAvailabilitySchema,
  getVendorsQuerySchema,
} from "./vendor.schema";

const vendorRoutes = Router();

// ── 1. ROUTE STATIS & SUB-RESOURCE INDEPENDEN (WAJIB DI ATAS) ───────────────

vendorRoutes.get(
  "/admin/master-list",
  authenticate,
  authorize("ADMIN"),
  validate(getVendorsQuerySchema, "query"), // Validasi enum query param
  vendorController.getAllVendorsForAdmin,
);

vendorRoutes.delete(
  "/portfolios/:portfolioId",
  authenticate,
  authorize("ADMIN"),
  validate(portfolioIdParamSchema, "params"),
  vendorController.deleteVendorPortfolio,
);

// ── 2. PUBLIC LIST RESOURCE ─────────────────────────────────────────────────

vendorRoutes.get(
  "/",
  validate(getVendorsQuerySchema, "query"),
  vendorController.getPublicVendors,
);

// ── 3. WILDCARD DYNAMIC PARAMETERS ENDPOINTS (DI BAWAH) ─────────────────────

vendorRoutes.get(
  "/:id",
  validate(vendorIdParamSchema, "params"),
  vendorController.getVendorById,
);

vendorRoutes.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createVendorSchema),
  vendorController.createVendor,
);

vendorRoutes.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  validate(updateVendorSchema),
  vendorController.updateVendor,
);

vendorRoutes.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  vendorController.deleteVendor,
);

vendorRoutes.post(
  "/:id/portfolios",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  validate(addPortfolioSchema),
  vendorController.addVendorPortfolio,
);

vendorRoutes.post(
  "/:id/availabilities",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  validate(setAvailabilitySchema),
  vendorController.setVendorAvailability,
);

export default vendorRoutes;
