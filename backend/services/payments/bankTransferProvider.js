function missingCredentialsError() {
  return new Error("Bank transfer API credentials are not configured. Set PAYMENT_PROVIDER_MODE=mock until official bank credentials are available.");
}

module.exports = {
  id: "bank_transfer",
  displayName: "Bank transfer provider",

  async initiatePaymentCommitment() {
    // TODO: Add bank API base URL, API key, API secret, webhook URL, transaction reference mapping, and signature validation.
    throw missingCredentialsError();
  },

  async verifyPaymentStatus() {
    // TODO: Call the official bank status endpoint after credentials are available.
    throw missingCredentialsError();
  },

  async getTransactionDetails() {
    // TODO: Map bank transaction details to TradeFlow commitment records.
    throw missingCredentialsError();
  },

  async cancelPaymentCommitment() {
    // TODO: Implement cancellation support according to the bank partner's API contract.
    throw missingCredentialsError();
  }
};
