/**
 * Customer-facing order visibility. Same rule as dashboard order detail:
 * only the owning account may see PII (ship-to, line items, totals).
 */
export function canAccessCustomerOrder(
  viewerUserId: string | undefined | null,
  orderUserId: string | null | undefined
): boolean {
  return Boolean(viewerUserId && orderUserId && viewerUserId === orderUserId);
}
