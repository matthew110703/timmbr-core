# Payments (Razorpay)

All routes are under `/api/v1` and need a signed-in user, except the two webhooks. Amounts are in rupees; the client converts to paise for Razorpay.

## Flow

1. `POST /checkout/quote` `{ items[], shippingAddressId }`: server-priced totals (GST-inclusive; `discount` and `shippingFee` are 0 for now).
2. `POST /orders` `{ items[], shippingAddressId }`: reserves stock, creates a PENDING order (expires after `ORDER_EXPIRATION_TTL_MINUTES`, default 15) and a Razorpay order. Returns `{ order, payment: { razorpayOrderId, razorpayKeyId, amount, currency, ... } }`.
   - **Idempotent.** If the user already has an unexpired PENDING order for the same lines and address (double click, back button, retry), that order is returned and nothing more is reserved. If its last Razorpay attempt failed, a new Razorpay order is opened on it.
3. The client opens Razorpay Checkout with the returned key id, order id and amount.
4. On success the client calls `POST /payments/razorpay/verify` `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }`. The webhook may confirm the order first; whichever arrives first wins and the other is a no-op.
5. `POST /orders/:orderId/payment-session` (owner only, order must be PENDING and unexpired): returns the open Razorpay attempt, or starts a new one. Use it to resume after the modal was dismissed or a payment failed, and to re-read the key id.
6. `GET /orders/:orderId` is the source of truth for the final status (poll it if verify fails or the tab was closed).

## Rules worth knowing

- **Verify checks ownership.** A valid signature proves the payment happened, not whose order it is, so the order must belong to the caller (`ORDER_ACCESS_FORBIDDEN`).
- **Orders are confirmed only from PENDING** (`updateMany` guarded on status), in both verify and the webhook. Stock is taken out exactly once.
- **Paid after expiry.** If a payment is captured for an order the cleanup cron already cancelled, the payment is recorded as PAID, stock is not touched, verify answers `409 ORDER_NOT_PAYABLE`, and an error is logged. There is no automatic refund yet; refund it manually in the Razorpay dashboard.
- **Amount limit.** Razorpay rejects orders above ₹5,00,000. The quote carries `paymentLimit`, and `POST /orders` refuses a larger total up front with `422 PAYMENT_AMOUNT_TOO_HIGH` (before any stock is held).
- **Cart.** The order's cart becomes CONVERTED when the order is confirmed, by verify or by the webhook.
- **Webhook** (`POST /webhooks/razorpay`, signature over the raw body): `payment.captured` / `order.paid` confirm, `payment.failed` marks the payment FAILED (the order stays PENDING so the user can retry). Events are idempotent through `WebhookEvent`.
- **Expiry.** `POST /webhooks/orders/cleanup` (header `x-cron-secret`) must be called by an external scheduler; it cancels expired PENDING orders and releases their stock.
- **Production needs all three secrets** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`). Without them core runs in mock mode (fake order ids, signatures not checked) and logs an error at startup when `NODE_ENV=prod`.

## Error codes

`INSUFFICIENT_STOCK`, `VARIANT_UNAVAILABLE`, `ADDRESS_NOT_FOUND`, `ORDER_NOT_FOUND`, `ORDER_ACCESS_FORBIDDEN`, `ORDER_NOT_PAYABLE`, `PAYMENT_AMOUNT_TOO_HIGH`, `INVALID_PAYMENT_SIGNATURE`, `PAYMENT_NOT_FOUND`, `RAZORPAY_ORDER_CREATION_FAILED`.

## Not built yet

Refunds, user-side cancellation, shipping fees, coupons, COD, billing address.
