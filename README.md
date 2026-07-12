# OTIC TradeFlow

OTIC TradeFlow is a role-based trade financing MVP designed to help buyers complete supplier transactions when they cannot pay the full amount upfront.

The platform allows suppliers to create verified quotations and share buyer financing links through WhatsApp. Buyers can open the link, view the quotation, compare recommended financiers, select a preferred financier, and submit verification information. TradeFlow then supports buyer, supplier, quotation, risk checks, and provider-verified buyer payment commitments before the selected financier reviews the request.

TradeFlow does not hold escrow funds in this MVP. Buyer contributions are represented as payment commitments verified through licensed payment providers or banks. Until official credentials are available, the backend uses mock provider adapters.

## Project Status

This is the first local MVP version of TradeFlow.

The project currently runs locally on a Windows machine and does not yet use Azure. Azure deployment is planned after cloud access is available.

## Core Idea

TradeFlow does not simply give money to buyers.

Instead, it verifies a real trade transaction first:

1. Supplier creates a quotation.
2. Buyer receives the quotation link through WhatsApp.
3. Buyer opens the TradeFlow financing link.
4. Buyer enters how much they can pay.
5. TradeFlow calculates the financing gap.
6. Buyer views recommended financiers.
7. Buyer selects a preferred financier.
8. Buyer submits verification details.
9. TradeFlow admin/risk team verifies the transaction.
10. Buyer contribution is recorded as a provider-verified commitment.
11. Financier approves or rejects funding.
12. Buyer repays the financier under the financier's terms.

## Role-Based Portals

TradeFlow has separate interfaces for different users.

### Supplier Portal

The supplier can:

- Create quotations
- Generate buyer financing links
- Share quotation links through WhatsApp
- Track buyer financing status
- See buyer payment commitment progress

### Buyer Portal

The buyer can:

- Open a quotation link
- View quotation details
- Enter available contribution
- View financing gap
- Compare recommended financiers
- Select a preferred financier
- Choose a payment mode for the buyer contribution commitment
- Submit verification information
- Track financing request status

### Financier Portal

The financier can:

- View assigned financing requests
- Review buyer and quotation details
- See risk score and verification status
- Approve or reject funding
- See buyer provider commitment status

### Admin / Risk Portal

The TradeFlow admin or risk team can:

- View all financing requests
- Verify buyer identity
- Verify phone number
- Verify supplier authenticity
- Verify quotation authenticity
- Check pricing and fraud signals
- Assess repayment ability
- Approve requests for financier review
- Reject risky transactions
- Request more information

## Current Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express.js
- Database: Local JSON file
- Payments: mock provider adapters until licensed provider credentials are configured
- Current environment: Local development
- Future deployment target: Azure

## Project Structure

```text
OTIC-TRADEFLOW/
  backend/
    server.js
    package.json
    .env
    .gitignore

  frontend/
    index.html
    supplier.html
    buyer.html
    financier.html
    admin.html
    style.css
    app.js

  database/
    tradeflow-db.json

  docs/
    MVP_PROGRESS.md

  README.md
