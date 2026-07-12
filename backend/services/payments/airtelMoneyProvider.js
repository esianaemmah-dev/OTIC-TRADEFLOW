function missingCredentialsError() {
  return new Error("Airtel Money API credentials are not configured. Set PAYMENT_PROVIDER_MODE=mock until official credentials are available.");
}

module.exports = {
  id: "airtel_money",
  displayName: "Airtel Money",

  async initiatePaymentCommitment() {
    // TODO: Add official Airtel Money base URL, client ID, client secret, callback URL, status mapping, and error handling.
    throw missingCredentialsError();
  },

  async verifyPaymentStatus() {
    // TODO: Call the official Airtel transaction status endpoint after credentials are available.
    throw missingCredentialsError();
  },

  async getTransactionDetails() {
    // TODO: Map official Airtel transaction details to TradeFlow commitment records.
    throw missingCredentialsError();
  },

  async cancelPaymentCommitment() {
    // TODO: Implement cancellation or reversal support when the provider contract allows it.
    throw missingCredentialsError();
  }
};
