import { z } from "zod";

// ============================================================================
// ADMIN CLIENT VALIDATION SCHEMA
// ============================================================================

export const clientIdParamSchema = z.object({
  clientId: z.string().cuid({ message: "Format ID Client tidak valid" }),
});

export const listClientsQuerySchema = z.object({
  // Cari berdasarkan nama, email, atau nomor HP
  search: z.string().trim().min(1).max(100).optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
export type ClientIdParam = z.infer<typeof clientIdParamSchema>;
