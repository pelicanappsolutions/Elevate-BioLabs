-- AlterEnum
-- Adds NOWPayments as a payment rail option. PostgreSQL supports adding enum
-- values without rewriting existing rows; new values may only be appended to
-- the existing enum, so this is safe for production data.
ALTER TYPE "PaymentRail" ADD VALUE 'NOWPAYMENTS';
