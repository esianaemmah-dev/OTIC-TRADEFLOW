const REQUIRED_PAYMENT_PROVIDER_METHODS = [
  "initiatePaymentCommitment",
  "verifyPaymentStatus",
  "getTransactionDetails",
  "cancelPaymentCommitment"
];

function assertPaymentProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Payment provider adapter is missing.");
  }

  REQUIRED_PAYMENT_PROVIDER_METHODS.forEach((methodName) => {
    if (typeof provider[methodName] !== "function") {
      throw new Error(`Payment provider adapter must implement ${methodName}().`);
    }
  });

  return provider;
}

module.exports = {
  REQUIRED_PAYMENT_PROVIDER_METHODS,
  assertPaymentProvider
};
