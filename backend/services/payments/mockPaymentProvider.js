function nowIso() {
  return new Date().toISOString();
}

function normalizeMockStatus(status) {
  const normalized = String(status || "pending").toLowerCase();

  if (normalized === "successful" || normalized === "success" || normalized === "verified") {
    return "verified";
  }

  if (["pending", "failed", "cancelled"].includes(normalized)) {
    return normalized;
  }

  return "pending";
}

function buildProviderReference(selectedPaymentMode) {
  const mode = String(selectedPaymentMode || "provider")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return `MOCK-${mode || "PROVIDER"}-${Date.now()}`;
}

module.exports = {
  id: "mock",
  displayName: "Mock licensed payment provider",

  async initiatePaymentCommitment(input = {}) {
    const status = normalizeMockStatus(input.simulatedStatus || "pending");

    return {
      provider: "mock",
      providerDisplayName: "Mock licensed payment provider",
      providerTransactionReference: buildProviderReference(input.selectedPaymentMode),
      providerStatus: status === "verified" ? "successful" : status,
      status,
      raw: {
        mode: "mock",
        action: "initiatePaymentCommitment",
        commitmentId: input.commitmentId,
        selectedPaymentMode: input.selectedPaymentMode,
        amountCommitted: input.amountCommitted,
        currency: input.currency,
        simulatedAt: nowIso()
      }
    };
  },

  async verifyPaymentStatus(input = {}) {
    const status = normalizeMockStatus(input.simulatedStatus || process.env.MOCK_PAYMENT_VERIFY_STATUS || "successful");
    const commitment = input.commitment || {};

    return {
      provider: "mock",
      providerDisplayName: "Mock licensed payment provider",
      providerTransactionReference: commitment.providerTransactionReference || buildProviderReference(commitment.selectedPaymentMode),
      providerStatus: status === "verified" ? "successful" : status,
      status,
      verifiedAt: status === "verified" ? nowIso() : null,
      raw: {
        mode: "mock",
        action: "verifyPaymentStatus",
        commitmentId: commitment.id,
        simulatedAt: nowIso()
      }
    };
  },

  async getTransactionDetails(input = {}) {
    const commitment = input.commitment || {};

    return {
      provider: "mock",
      providerDisplayName: "Mock licensed payment provider",
      providerTransactionReference: commitment.providerTransactionReference || "",
      providerStatus: commitment.providerStatus || commitment.status || "pending",
      status: normalizeMockStatus(commitment.status),
      raw: {
        mode: "mock",
        action: "getTransactionDetails",
        commitmentId: commitment.id,
        simulatedAt: nowIso()
      }
    };
  },

  async cancelPaymentCommitment(input = {}) {
    const commitment = input.commitment || {};

    return {
      provider: "mock",
      providerDisplayName: "Mock licensed payment provider",
      providerTransactionReference: commitment.providerTransactionReference || "",
      providerStatus: "cancelled",
      status: "cancelled",
      raw: {
        mode: "mock",
        action: "cancelPaymentCommitment",
        commitmentId: commitment.id,
        simulatedAt: nowIso()
      }
    };
  }
};
