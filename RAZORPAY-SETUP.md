# Razorpay setup

BiteCode Control now supports Razorpay Standard Checkout for event registration fees.

## 1. Razorpay Dashboard

Create or use a Razorpay account and generate API keys. Use **Test Mode** keys first. Razorpay's Orders API requires the server to create an order before Checkout is opened, and successful Checkout responses must be signature-verified on the server.

## 2. Render environment variables

Add these variables to the backend service on Render:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=choose-a-long-random-webhook-secret
```

Never put `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in frontend `.env` or GitHub.

The frontend only receives `RAZORPAY_KEY_ID` from the authenticated backend endpoint.

## 3. Configure the webhook

In Razorpay Dashboard, add a webhook pointing to:

```text
https://YOUR-BACKEND-DOMAIN/api/payments/razorpay/webhook
```

Use the exact same value as `RAZORPAY_WEBHOOK_SECRET` in Render.

Enable at least:

- `payment.captured`
- `payment.failed`

The application validates the webhook signature before processing it.

## 4. Event registration fee

In the BiteCode admin Event settings, set the event's `registrationFee` to the amount in INR.

For example:

```text
Registration fee: 500
```

The backend converts this to paise when creating the Razorpay order. The participant cannot change the amount from the browser.

## 5. Payment flow

1. Participant opens Registration.
2. Backend creates a Razorpay Order using the server-side secret.
3. Razorpay Checkout opens in the browser.
4. Participant pays using the methods enabled for the Razorpay account.
5. Backend verifies `razorpay_order_id + razorpay_payment_id + razorpay_signature`.
6. Backend checks the payment belongs to the created order.
7. The account is marked `paid` only after a captured payment is confirmed.
8. Webhooks provide asynchronous payment updates.

Manual UPI/payment-proof is removed. Registration payments use Razorpay only.

## 6. Test before going live

Use Razorpay Test Mode first. Confirm that a successful test payment changes the participant's payment status to `paid` and appears in Admin → Payments.

After testing, replace the test API keys with the Live Mode keys in Render.

Razorpay documentation: https://razorpay.com/docs/payments/server-integration/python/test-app/
