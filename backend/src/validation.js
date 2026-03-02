import { z } from "zod";

export const TransactionType = z.enum(["revenue", "expense"]);

export const TransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  type: TransactionType,
  category: z.string().trim().min(1).max(64),
  description: z.string().trim().max(200).optional().default(""),
  amount_cents: z.number().int().positive().max(1_000_000_000),
});

export const TransactionPatchSchema = TransactionSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  "At least one field must be provided"
);

