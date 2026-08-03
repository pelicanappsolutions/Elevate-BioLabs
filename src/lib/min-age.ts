/**
 * Site-wide minimum purchase / entry age.
 * Prefer NEXT_PUBLIC_MIN_AGE so client UI and server stay aligned at build time.
 */
export const MIN_AGE = Number(process.env.NEXT_PUBLIC_MIN_AGE ?? process.env.MIN_AGE ?? "21") || 21;

export const MIN_AGE_LABEL = `${MIN_AGE}+`;

/** localStorage key — includes age so raising MIN_AGE forces a fresh attestation. */
export const AGE_GATE_STORAGE_KEY = `ebl-age-ok-${MIN_AGE}`;
