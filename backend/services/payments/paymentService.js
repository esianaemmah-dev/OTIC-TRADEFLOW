const { assertPaymentProvider } = require("./paymentProvider.interface");
const mockPaymentProvider = require("./mockPaymentProvider");
const mtnMomoProvider = require("./mtnMomoProvider");
const airtelMoneyProvider = require("./airtelMoneyProvider");
const bankTransferProvider = require("./bankTransferProvider");

const PAYMENT_MODES = [
  {
    id: "mtn_mobile_money",
    label: "MTN Mobile Money",
    provider: "mtn_momo"
  },
  {
    id: "airtel_money",
    label: "Airtel Money",
    provider: "airtel_money"
  },
  {
    id: "bank_transfer",
    label: "Bank Transfer",
    provider: "bank_transfer"
  },
  {
    id: "card",
    label: "Card / future provider",
    provider: "mock"
  }
];

const PROVIDERS = {
  mock: mockPaymentProvider,
  mtn_momo: mtnMomoProvider,
  airtel_money: airtelMoneyProvider,
  bank_transfer: bankTransferProvider
};

function getPaymentModes() {
  return PAYMENT_MODES.map((mode) => ({ ...mode }));
}

function findPaymentMode(selectedPaymentMode) {
  return PAYMENT_MODES.find((mode) => mode.id === selectedPaymentMode);
}

function getProviderForMode(selectedPaymentMode) {
  const mode = findPaymentMode(selectedPaymentMode);

  if (!mode) {
    throw new Error("Unsupported payment mode.");
  }

  if (String(process.env.PAYMENT_PROVIDER_MODE || "mock").toLowerCase() === "mock") {
    return assertPaymentProvider(mockPaymentProvider);
  }

  return assertPaymentProvider(PROVIDERS[mode.provider] || mockPaymentProvider);
}

async function initiatePaymentCommitment(input) {
  return getProviderForMode(input.selectedPaymentMode).initiatePaymentCommitment(input);
}

async function verifyPaymentStatus(input) {
  return getProviderForMode(input.commitment.selectedPaymentMode).verifyPaymentStatus(input);
}

async function getTransactionDetails(input) {
  return getProviderForMode(input.commitment.selectedPaymentMode).getTransactionDetails(input);
}

async function cancelPaymentCommitment(input) {
  return getProviderForMode(input.commitment.selectedPaymentMode).cancelPaymentCommitment(input);
}

module.exports = {
  getPaymentModes,
  findPaymentMode,
  initiatePaymentCommitment,
  verifyPaymentStatus,
  getTransactionDetails,
  cancelPaymentCommitment
};
