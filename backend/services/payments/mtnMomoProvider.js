function missingCredentialsError() {
  return new Error("MTN Mobile Money API credentials are not configured. Set PAYMENT_PROVIDER_MODE=mock until official credentials are available.");
}

module.exports = {
  id: "mtn_momo",
  displayName: "MTN Mobile Money",

  async initiatePaymentCommitment() {
    // TODO: Add official MTN MoMo base URL, API keys, callback URL, signature validation, status mapping, and error handling.
    throw missingCredentialsError();
  },

  async verifyPaymentStatus() {
    // TODO: Call the official MTN MoMo transaction status endpoint after credentials are available.
    throw missingCredentialsError();
  },

  async getTransactionDetails() {
    // TODO: Map official MTN transaction details to TradeFlow commitment records.
    throw missingCredentialsError();
  },

  async cancelPaymentCommitment() {
    // TODO: Implement cancellation or reversal support when the provider contract allows it.
    throw missingCredentialsError();
  }
};
