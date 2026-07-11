import { Router } from "express";
import * as rsvpController from "./rsvp.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  orderIdParamSchema,
  slugParamSchema,
  createRsvpLinkSchema,
  updateRsvpLinkSchema,
  submitRsvpSchema,
} from "./rsvp.schema";

const rsvpRoutes = Router();

// ============================================================================
// RSVP ROUTES (Base Path: /api/v1/rsvp)
// ============================================================================
//
// 🔴 PENTING: modul ini TIDAK memakai `router.use(authenticate)` global
// seperti modul lain — karena separuh endpoint-nya memang untuk PUBLIK
// (halaman RSVP yang dibuka tamu lewat link share, tanpa login). Prefix
// "/public/..." dipakai supaya di sekilas baca langsung jelas endpoint mana
// yang tidak butuh token, tanpa perlu buka file ini setiap kali.
//
// Rate limiting untuk endpoint publik (terutama /public/:slug/submit) sudah
// tercakup oleh `rateLimiter` global yang didaftarkan di app.ts sebelum
// seluruh routes. Kalau volume spam submission ternyata jadi masalah nyata,
// pertimbangkan rate limit KHUSUS yang lebih ketat untuk endpoint ini saja.

// ── A. PUBLIC ROUTES (tanpa auth) ───────────────────────────────────────────

rsvpRoutes.get(
  "/public/:slug",
  validate(slugParamSchema, "params"),
  rsvpController.getPublicEventDetail,
);

rsvpRoutes.post(
  "/public/:slug/submit",
  validate(slugParamSchema, "params"),
  validate(submitRsvpSchema, "body"),
  rsvpController.submitRsvp,
);

rsvpRoutes.get(
  "/public/:slug/wishes",
  validate(slugParamSchema, "params"),
  rsvpController.getPublicWishes,
);

// ── B. PRIVATE ROUTES (client pemilik order & admin) ────────────────────────

rsvpRoutes.post(
  "/order/:orderId",
  authenticate,
  validate(orderIdParamSchema, "params"),
  validate(createRsvpLinkSchema, "body"),
  rsvpController.createRsvpLink,
);

rsvpRoutes.get(
  "/order/:orderId",
  authenticate,
  validate(orderIdParamSchema, "params"),
  rsvpController.getRsvpLinkByOrder,
);

rsvpRoutes.patch(
  "/order/:orderId",
  authenticate,
  validate(orderIdParamSchema, "params"),
  validate(updateRsvpLinkSchema, "body"),
  rsvpController.updateRsvpLink,
);

rsvpRoutes.get(
  "/order/:orderId/submissions",
  authenticate,
  validate(orderIdParamSchema, "params"),
  rsvpController.getSubmissionsByOrder,
);

export default rsvpRoutes;
