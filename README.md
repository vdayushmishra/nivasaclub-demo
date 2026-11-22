# NivasaClub demo

Responsive, frontend-only prototype for **NivasaClub — Verified Ghar. Smart Hisaab. Trusted Living.**

## Run locally

No npm install, build step, API key, or backend is needed.

1. Open PowerShell in this folder:

   ```powershell
   cd C:\Users\zx\OneDrive\Desktop\NivasaClub
   ```

2. Start a static web server:

   ```powershell
   py -m http.server 8000
   ```

   If the Python launcher is unavailable, use `python -m http.server 8000` or open `index.html` directly in a modern browser.
3. Visit <http://localhost:8000>.
4. Stop the server with `Ctrl+C`.

The page uses Tailwind, Font Awesome, Google Fonts, and sample photos from public CDNs; those visual assets need an internet connection.

## Try the demo

- Switch between Tenant, Landlord, and Partner/Admin; load the Rohan & Priya or Mr. Verma sample; use **Reset Demo Data** to clear the local demo state.
- Visit **Payments** to simulate UPI, credit-card, and NetBanking/e-NACH checkouts for rent, deposit milestones, and helper payouts. Success/failure transactions, score changes, rewards, alerts, and receipt previews are shown in the ledger.
- Visit **Home Loan** to see score tiers, estimated EMI vs. rent, partner offer examples, callback lead capture, and the local Partner/Admin DSA preview.
- Existing DigiLocker KYC, AutoPay score controls, deposit stages, Condition Vault, helper attendance, and add-on choices remain available.
- Demo progress is stored in this browser's `localStorage` for this origin. Use **Reset Demo Data** to clear the fintech ledger, rewards, callback leads, and saved flow settings. Browser storage is local to the current browser/profile.

## Demo and regulatory limitations

This prototype does not connect to DigiLocker, identity systems, payment gateways, banks, credit bureaus, landlords, NBFCs, insurers, or DSAs. It does not collect or transmit payment credentials, move funds, issue a real receipt, approve credit, or send callback leads to partners. Sample profiles, scores, rates, fee and reward estimates, transaction references, PAN display, commission previews, and receipts are illustrative only.

Interest rates, LTV, fees, credit and insurance eligibility, approvals, tax treatment, and bureau impact depend on partner underwriting, verified KYC, explicit consent, applicable RBI / digital-lending requirements, and other laws. The score is not a bureau score or credit decision. Receipt previews are not tax invoices or proof of payment; consult a qualified tax professional about HRA and GST treatment.
