# Iwantphoto Cost Model and Billing Sources

This record preserves the external inputs used for the September 2026 pricing decision and Stripe subscription architecture.

| Input | Source and finding | Pricing treatment |
|---|---|---|
| GPT Image 2 medium output | [OpenAI image-generation guide](https://developers.openai.com/api/docs/guides/image-generation) states GPT Image 2 medium image output is **US$0.053** for a 1024×1024 image, excluding image and text input tokens. The same guide notes that edits process image input at high fidelity, increasing input token cost. | Use **US$0.060** per completed image as a conservative baseline before retries: US$0.053 output plus a small input/prompt reserve. |
| Image token pricing | [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) lists GPT Image 2 image input at **US$4/million tokens** and output at **US$15/million tokens**. | Supports retaining a buffer for source-image/mask inputs rather than pricing to output-only cost. |
| USD/HKD | [HKMA linked exchange-rate system](https://www.hkma.gov.hk/eng/key-functions/money/linked-exchange-rate-system/) keeps the Hong Kong dollar in a HK$7.75–7.85 per US dollar band. | Use **HK$7.85/US$** for conservative conversion. |
| Stripe domestic cards | [Stripe Hong Kong pricing](https://stripe.com/zh-hk/pricing) search result reported **3.4% + HK$2.35** per successful domestic card transaction. | Model charges **3.4% + HK$2.35** per successful subscription payment. International cards, currency conversion, disputes, refunds and tax are not included in the base model. |
| Hosted subscription design | [Stripe hosted Checkout subscription guide](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted) recommends server-created Checkout Sessions, stored customer/subscription IDs, and webhook-based provisioning. | Website will only change an account plan after verified Stripe webhook events. |
| Portal lifecycle | [Stripe customer portal guide](https://docs.stripe.com/customer-management/integrate-customer-portal) recommends authenticated, short-lived portal sessions and webhook handling for upgrades, downgrades and cancellations. | Use hosted Customer Portal; do not build raw card handling. |
| Managed Payments product classification | [Stripe Managed Payments eligibility](https://docs.stripe.com/payments/managed-payments/eligibility) defines `txcd_10105002` as **Artificial Intelligence as a Service (AIaaS) — Cloud Based — Business Use**. | Applied to the live Pro and Business products. This matches Iwantphoto’s cloud-delivered AI image workflow for businesses and is required before Checkout can be created on this Stripe account. |

## Cost Formula

The deployed planning formula is:

```text
fully loaded per completed image
= (US$0.060 × HK$7.85 × 1.20 retry/variance reserve)
  + HK$0.02 storage/egress/requests
  + HK$0.22 platform/support allocation
= HK$0.8052
```

For paid plans, the quoted monthly price solves for a **60% contribution margin after domestic-card processing fees**, then is rounded *up* to the next HK$10:

```text
price = ceil_to_HK$10((variable image cost + fixed support allocation + HK$2.35)
                      / (1 − 3.4% − 60%))
```

| Plan | Included completed edits / month | Fixed support allocation | Calculated floor | Published monthly price | Modeled post-fee contribution margin |
|---|---:|---:|---:|---:|---:|
| Starter | 10 | HK$0 | — | HK$0 | Free acquisition allowance |
| Pro | 200 | HK$20 | HK$501.07 | **HK$510** | 60.6% |
| Business | 750 | HK$40 | HK$1,765.71 | **HK$1,770** | 60.1% |

The model is deliberately conservative. It should be reviewed after 90 days using actual image dimensions, retry frequency, payment-method mix, storage duration, support time, refunds, disputes and tax obligations.


## One-time prepaid processing credits

Iwantphoto also offers three **non-expiring, one-time** processing-credit packs for customers who prefer not to take a monthly subscription. The available pack range is intentionally limited to representative low-, mid-, and high-volume choices. Each pack is limited to **Hong Kong** at launch, and all amounts use the configured Stripe tax treatment.

| Pack | Completed processing credits | Price | Price per credit | Fully loaded delivery cost | Estimated Stripe fee | Estimated contribution margin |
|---|---:|---:|---:|---:|---:|---:|
| Flex 25 | 25 | HK$90 | HK$3.60 | HK$20.13 | HK$5.41 | 71.6% |
| Value 100 | 100 | HK$320 | HK$3.20 | HK$80.52 | HK$13.23 | 70.7% |
| Studio 250 | 250 | HK$740 | HK$2.96 | HK$201.30 | HK$27.51 | 69.1% |

The calculation applies the same conservative fully loaded per-image cost of **HK$0.805** used for monthly plans: GPT Image 2 medium processing, a 20% retry and variance reserve, storage and egress, and allocated compute/support. It also applies Stripe Hong Kong domestic-card pricing assumptions of **3.4% plus HK$2.35**. The one-time per-credit rate stays above monthly-plan unit pricing, so recurring users retain a clear incentive to use Pro or Business.

A credit purchase is fulfilled only after Stripe sends a signed `checkout.session.completed` or `checkout.session.async_payment_succeeded` event with `payment_status=paid`. The webhook retrieves the actual Stripe line item, accepts only an allow-listed price ID, and records the credit grant using the unique Stripe Checkout Session ID as an idempotency key. Credits are spent only after the relevant monthly allowance is used. A failed AI job triggers an automatic one-credit refund; previews, comparisons, downloads, and failed upload validation do not spend credits.

## Secure media storage capacity

Iwantphoto keeps account libraries in managed object storage, rather than in browser memory. For every signed-in account, the system records the exact byte size of both the stored original and the generated output. The displayed usage is the sum of those two files across the account's saved library; local previews, slider comparisons, downloads, failed uploads, masks, and anonymous sessions do **not** count towards the account's capacity.

| Account plan | Included capacity | Monthly price | Storage add-on choices |
|---|---:|---:|---|
| Starter | 1 GB | HK$0 | 50 GB / 200 GB / 1 TB |
| Pro | 10 GB | HK$510 | 50 GB / 200 GB / 1 TB |
| Business | 50 GB | HK$1,770 | 50 GB / 200 GB / 1 TB |

| Recurring add-on | Extra account capacity | Monthly price | Conservative storage cost / month | Modeled contribution after a 3.4% + HK$2.35 card fee |
|---|---:|---:|---:|---:|
| Media Archive 50 GB | 50 GB | **HK$50** | HK$10.83 | 62.2% |
| Media Archive 200 GB | 200 GB | **HK$150** | HK$43.33 | 61.5% |
| Media Archive 1 TB | 1 TB | **HK$640** | HK$216.66 | 60.0% |

The add-on model uses US$0.023/GB-month as the public S3 Standard benchmark, a 20% variance reserve, an HK$7.85/USD conservative exchange rate, a small service allocation, and the existing Stripe domestic-card assumption. The monthly price is rounded up to the nearest HK$10 while targeting a 60% post-fee contribution margin. Users receive the selected capacity only after a signed Stripe subscription event has been verified. Before creating another stored edit, the server reserves room for an original and generated file, then blocks safely when the account has insufficient capacity; it never creates unmetered storage overages.
