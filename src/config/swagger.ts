import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Wedding Organizer Platform API",
      version: "1.0.0",
      description:
        "REST API untuk platform pemesanan paket pernikahan. Mencakup autentikasi, manajemen paket & vendor, order multi-step, pembayaran, RSVP, dan admin dashboard.",
    },
    servers: [
      {
        url: `http://localhost:${env.port}${env.apiPrefix}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // Reusable schema definitions
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            data: { type: "object", nullable: true, example: null },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan semua file di modules untuk menemukan JSDoc @swagger annotations
  apis: ["./src/modules/**/*.routes.ts", "./src/modules/**/*.schema.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
