import { z } from 'zod';

export const AddressCreateSchema = z.object({
    address_type: z.enum(['shipping', 'billing', 'both']),
    is_default: z.boolean().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    address_line1: z.string(),
    address_line2: z.string().optional(),
    landmark: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
});

export type AddressCreateInput = z.infer<typeof AddressCreateSchema>;

export const AddressUpdateSchema = z.object({
    address_type: z.enum(['shipping', 'billing', 'both']).optional(),
    is_default: z.boolean().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    landmark: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
});

export type AddressUpdateInput = z.infer<typeof AddressUpdateSchema>;
