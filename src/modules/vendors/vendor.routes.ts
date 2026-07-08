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

const router = Router();

// ── 1. ROUTE STATIS & SUB-RESOURCE INDEPENDEN (WAJIB DI ATAS) ───────────────

router.get(
  "/admin/master-list",
  authenticate,
  authorize("ADMIN"),
  validate(getVendorsQuerySchema, "query"), // Validasi enum query param
  vendorController.getAllVendorsForAdmin,
);

router.delete(
  "/portfolios/:portfolioId",
  authenticate,
  authorize("ADMIN"),
  validate(portfolioIdParamSchema, "params"),
  vendorController.deleteVendorPortfolio,
);

// ── 2. PUBLIC LIST RESOURCE ─────────────────────────────────────────────────

router.get(
  "/",
  validate(getVendorsQuerySchema, "query"),
  vendorController.getPublicVendors,
);

// ── 3. WILDCARD DYNAMIC PARAMETERS ENDPOINTS (DI BAWAH) ─────────────────────

router.get(
  "/:id",
  validate(vendorIdParamSchema, "params"),
  vendorController.getVendorById,
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createVendorSchema),
  vendorController.createVendor,
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  validate(updateVendorSchema),
  vendorController.updateVendor,
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  vendorController.deleteVendor,
);

router.post(
  "/:id/portfolios",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  validate(addPortfolioSchema),
  vendorController.addVendorPortfolio,
);

router.post(
  "/:id/availabilities",
  authenticate,
  authorize("ADMIN"),
  validate(vendorIdParamSchema, "params"),
  validate(setAvailabilitySchema),
  vendorController.setVendorAvailability,
);

export default router;
