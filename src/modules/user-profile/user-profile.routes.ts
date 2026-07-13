import { Router } from "express";
import * as userProfileController from "./user-profile.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { updateProfileSchema } from "./user-profile.schema";

const userProfileRoutes = Router();

userProfileRoutes.use(authenticate);

// ============================================================================
// USER PROFILE ROUTES (Base Path: /api/v1/user/profile)
// ============================================================================
//
// Self-service murni — CLIENT & ADMIN sama-sama cuma bisa akses/ubah profil
// MEREKA SENDIRI (diambil dari req.user!.id hasil JWT), tidak ada parameter
// userId di URL, jadi tidak ada risiko mengubah profil orang lain.

userProfileRoutes.get("/", userProfileController.getMyProfile);

userProfileRoutes.patch(
  "/",
  validate(updateProfileSchema, "body"),
  userProfileController.updateMyProfile,
);

export default userProfileRoutes;
