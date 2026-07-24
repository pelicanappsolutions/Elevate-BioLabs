import type { OrderStatus } from "@prisma/client";

/** All order statuses in workflow order — used by admin status pickers/filters. */
export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "AWAITING_REVIEW",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

/** Badge variant per order status. Shared so admin list, order detail, and the
 *  customer views all render status colors identically. */
export const ORDER_STATUS_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  PENDING_PAYMENT: "outline",
  AWAITING_REVIEW: "secondary",
  PAID: "success",
  PROCESSING: "default",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};
