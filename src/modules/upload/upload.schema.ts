import { z } from "zod";

export const uploadQuerySchema = z.object({
  folder: z.enum(["avatars", "portfolios"], {
    message: "Folder tujuan tidak valid. Harus 'avatars' atau 'portfolios'",
  }),
});

export type UploadQueryInput = z.infer<typeof uploadQuerySchema>;
// Tipe pembantu untuk mengunci Request Query Express agar bebas dari TS Type Error (Temuan 2)
export type UploadQueryType = {
  folder: "avatars" | "portfolios";
};
