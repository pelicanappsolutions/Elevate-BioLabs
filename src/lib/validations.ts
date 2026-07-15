import { z } from "zod";

// ---- Auth ----
export const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(80),
    email: z.string().email("Valid email required"),
    password: z
      .string()
      .min(8, "Min 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/[0-9]/, "Needs a number"),
    confirmPassword: z.string(),
    ageConfirm: z.literal(true, {
      errorMap: () => ({ message: "You must confirm you are 18+" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ---- Address / checkout ----
export const addressSchema = z.object({
  label: z.string().optional(),
  fullName: z.string().min(2),
  street1: z.string().min(3),
  street2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Valid US ZIP required"),
  country: z.string().default("US"),
  phone: z.string().optional(),
});

export const cartLineSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(999),
});

export const paymentRailSchema = z.enum([
  "NEXAPAY",
  "SEAMLESSCHEX",
  "PAYRAM",
  "STRIPE",
  "COINBASE",
  "P2P_ZELLE",
  "P2P_VENMO",
  "P2P_WIRE",
]);

export const checkoutSchema = z.object({
  email: z.string().email(),
  address: addressSchema,
  items: z.array(cartLineSchema).min(1, "Cart is empty"),
  rail: paymentRailSchema,
  shipService: z.string().default("USPS_PRIORITY"),
});

// ---- Admin: product CRUD ----
export const productSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(10),
  cas: z.string().optional(),
  purity: z.string().optional(),
  molarMass: z.coerce.number().optional(),
  sequence: z.string().optional(),
  form: z.enum(["LYOPHILIZED", "SOLUTION", "CAPSULE", "BLEND", "NASAL_SPRAY"]),
  storageInfo: z.string().optional(),
  priceCents: z.coerce.number().int().min(0),
  compareAtCents: z.coerce.number().int().optional(),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  categoryId: z.string().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const restockSchema = z.object({
  productId: z.string().cuid(),
  delta: z.coerce.number().int(),
  note: z.string().optional(),
});

export const proofOfPaymentSchema = z.object({
  orderId: z.string().cuid(),
  rail: z.enum(["P2P_ZELLE", "P2P_VENMO", "P2P_WIRE"]),
  fileUrl: z.string().url(),
  reference: z.string().optional(),
  amountCents: z.coerce.number().int().optional(),
});

export const newsletterSchema = z.object({
  email: z.string().email(),
  source: z.string().default("footer"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ProductInput = z.infer<typeof productSchema>;
