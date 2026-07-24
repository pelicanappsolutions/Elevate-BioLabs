import { z } from "zod";

// Shared password strength rule — reused by registration and in-app password
// change so the two never drift.
export const passwordRule = z
  .string()
  .min(8, "Min 8 characters")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[0-9]/, "Needs a number");

// ---- Auth ----
export const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(80),
    email: z.string().email("Valid email required"),
    password: passwordRule,
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
  // Required — carriers need a contact number, and it ties every order to a
  // reachable customer. Validated on digit count so formatting is irrelevant.
  phone: z
    .string()
    .min(1, "Phone number required")
    .refine((v) => v.replace(/\D/g, "").length === 10, "Enter a 10-digit US phone number"),
});

export const cartLineSchema = z.object({
  variantId: z.string().cuid(),
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

// ---- Admin: compound (parent Product) CRUD ----
export const compoundSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(10),
  cas: z.string().optional(),
  purity: z.string().optional(),
  molarMass: z.coerce.number().optional(),
  sequence: z.string().optional(),
  form: z.enum(["LYOPHILIZED", "SOLUTION", "CAPSULE", "BLEND", "NASAL_SPRAY"]),
  storageInfo: z.string().optional(),
  categoryId: z.string().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

// ---- Admin: variant (mg strength / SKU) CRUD ----
export const variantSchema = z.object({
  productId: z.string().cuid(),
  sku: z.string().min(2),
  strengthMg: z.coerce.number().positive(),
  priceCents: z.coerce.number().int().min(0),
  compareAtCents: z.coerce.number().int().optional(),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  // Standard bac-water volume for this vial — admin record, not shown to
  // customers as a purchase choice. Defaults to the industry-standard 3mL.
  reconstitutionVolumeMl: z.coerce.number().positive().default(3),
});

export const restockSchema = z.object({
  variantId: z.string().cuid(),
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

// ---- Self-service account settings (customers AND admins editing own account) ----
export const updateNameSchema = z.object({
  name: z.string().min(2, "Name is required").max(80),
});

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newEmail: z.string().email("Valid email required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ---- Dosage log create/edit ----
export const doseUpdateSchema = z.object({
  variantId: z.string().optional(),
  doseMcg: z.coerce.number().positive(),
  volumeMl: z.coerce.number().positive().optional(),
  note: z.string().max(500).optional(),
});

// ---- Admin: role change + order notes ----
export const setUserRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["CUSTOMER", "ADMIN"]),
});

export const orderNotesSchema = z.object({
  orderId: z.string().cuid(),
  notes: z.string().max(5000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CompoundInput = z.infer<typeof compoundSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
