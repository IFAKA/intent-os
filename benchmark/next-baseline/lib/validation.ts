import { z } from 'zod';

export const cartSchema = z.object({ productId: z.string().regex(/^[a-z0-9-]+$/), quantity: z.number().int().min(1).max(10) }).strict();
export const loginSchema = z.object({ email: z.string().email().max(254) }).strict();
