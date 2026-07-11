const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "../database/tradeflow-db.json");

const DEMO_FINANCIERS = [
  {
    id: "FIN-SACCO-001",
    name: "Demo SACCO Partner",
    type: "SACCO",
    maxAmount: 3000000,
    interestRate: "3% monthly",
    repaymentPeriod: "1-3 months",
    benefits: ["Fast approval", "Good for small traders", "Flexible repayment"],
    riskAppetite: "medium"
  },
  {
    id: "FIN-MICRO-001",
    name: "Microfinance Partner",
    type: "Microfinance",
    maxAmount: 10000000,
    interestRate: "4% monthly",
    repaymentPeriod: "3-6 months",
    benefits: ["Supports SMEs", "Higher limits", "Business-friendly terms"],
    riskAppetite: "medium"
  },
  {
    id: "FIN-BANK-001",
    name: "Bank Trade Finance Partner",
    type: "Bank",
    maxAmount: 50000000,
    interestRate: "Negotiated",
    repaymentPeriod: "3-12 months",
    benefits: ["Large transaction support", "Lower risk pricing", "Formal trade finance"],
    riskAppetite: "low"
  }
];

const DEFAULT_VERIFICATION_CHECKS = {
  buyerIdentityVerified: false,
  phoneVerified: false,
  supplierVerified: false,
  quotationVerified: false,
  priceChecked: false,
  fraudFlagsChecked: false,
  repaymentAbilityChecked: false
};

const FINANCE_REQUEST_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "pending_verification",
  "more_information_required",
  "verified_by_tradeflow",
  "approved_for_financier_review",
  "rejected_by_tradeflow",
  "approved_by_financier",
  "rejected_by_financier",
  "paid_to_supplier",
  "delivery_pending",
  "repayment_active",
  "completed"
];

function createInitialData() {
  return {
    quotations: [],
    financeRequests: [],
    suppliers: [],
    buyers: [],
    financiers: DEMO_FINANCIERS
  };
}

function ensureDatabase() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(createInitialData(), null, 2));
  }
}

function readDatabase() {
  ensureDatabase();
  const data = fs.readFileSync(dbPath, "utf-8");
  const database = JSON.parse(data);

  if (normalizeDatabase(database)) {
    writeDatabase(database);
  }

  return database;
}

function writeDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function normalizeDatabase(database) {
  let changed = false;

  ["quotations", "financeRequests", "suppliers", "buyers", "financiers"].forEach((key) => {
    if (!Array.isArray(database[key])) {
      database[key] = [];
      changed = true;
    }
  });

  DEMO_FINANCIERS.forEach((demoFinancier) => {
    const existingFinancier = database.financiers.find((financier) => financier.id === demoFinancier.id);

    if (!existingFinancier) {
      database.financiers.push(demoFinancier);
      changed = true;
      return;
    }

    Object.keys(demoFinancier).forEach((key) => {
      if (existingFinancier[key] === undefined) {
        existingFinancier[key] = demoFinancier[key];
        changed = true;
      }
    });
  });

  return changed;
}

function generateId(prefix) {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `${prefix}-${timestamp}-${random}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "");
}

function getDefaultVerificationChecks() {
  return { ...DEFAULT_VERIFICATION_CHECKS };
}

function areVerificationChecksComplete(verificationChecks = {}) {
  return Object.keys(DEFAULT_VERIFICATION_CHECKS).every((key) => verificationChecks[key] === true);
}

function getMissingVerificationInfoFields(verificationInfo = {}) {
  const requiredFields = [
    "nationalIdOrNIN",
    "phoneNumber",
    "location",
    "incomeSource",
    "monthlyIncomeEstimate",
    "businessPurpose"
  ];

  return requiredFields.filter((field) => {
    const value = verificationInfo[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

function findFinancierByIdOrName(financiers, financierId, financierName) {
  return financiers.find((financier) => {
    return financier.id === financierId || financier.name === financierName;
  });
}

function getFinancierFitRank(financier, requestedFinanceAmount) {
  const type = String(financier.type || "").toLowerCase();

  if (requestedFinanceAmount <= 3000000) {
    return { sacco: 1, microfinance: 2, bank: 3 }[type] || 9;
  }

  if (requestedFinanceAmount <= 10000000) {
    return { microfinance: 1, sacco: 2, bank: 3 }[type] || 9;
  }

  return { bank: 1, microfinance: 2, sacco: 3 }[type] || 9;
}

function calculateRiskScore(financeRequest) {
  let riskScore = 100;
  const riskReasons = [];

  const totalAmount = Number(financeRequest.totalAmount) || 0;
  const buyerAvailableAmount = Number(financeRequest.buyerAvailableAmount) || 0;
  const requestedFinanceAmount = Number(financeRequest.requestedFinanceAmount) || 0;
  const repaymentPeriod = String(financeRequest.repaymentPeriod || "").toLowerCase();
  const buyerReason = String(financeRequest.buyerReason || "").trim();
  const verificationInfo = financeRequest.verificationInfo || {};
  const selectedFinancier = financeRequest.selectedFinancier || findFinancierByIdOrName(
    DEMO_FINANCIERS,
    financeRequest.selectedFinancierId,
    financeRequest.selectedFinancierName
  );
  const selectedFinancierMaxAmount = Number(
    financeRequest.selectedFinancierMaxAmount || selectedFinancier?.maxAmount || 0
  );

  const buyerContributionPercentage = totalAmount > 0
    ? (buyerAvailableAmount / totalAmount) * 100
    : 0;

  if (buyerContributionPercentage >= 50) {
    // Strong buyer contribution keeps the score unchanged.
  } else if (buyerContributionPercentage >= 30) {
    riskScore -= 15;
    riskReasons.push("Buyer contribution is between 30% and 49%.");
  } else {
    riskScore -= 30;
    riskReasons.push("Buyer contribution is below 30%.");
  }

  if (requestedFinanceAmount > 5000000) {
    riskScore -= 20;
    riskReasons.push("Requested finance amount is above 5,000,000 UGX.");
  } else if (requestedFinanceAmount >= 1000000) {
    riskScore -= 10;
    riskReasons.push("Requested finance amount is between 1,000,000 and 5,000,000 UGX.");
  }

  const repaymentMonths = (repaymentPeriod.match(/\d+/g) || []).map(Number);
  const maxRepaymentMonths = repaymentMonths.length > 0 ? Math.max(...repaymentMonths) : 0;

  if (maxRepaymentMonths >= 6) {
    riskScore -= 20;
    riskReasons.push("Repayment period is 6 months or more.");
  } else if (repaymentPeriod.includes("3 months") || repaymentPeriod.includes("3 month") || maxRepaymentMonths === 3) {
    riskScore -= 10;
    riskReasons.push("Repayment period is 3 months.");
  } else if (repaymentPeriod.includes("1 month") || maxRepaymentMonths === 1) {
    // Short repayment period keeps the score unchanged.
  }

  if (buyerReason.length < 20) {
    riskScore -= 10;
    riskReasons.push("Buyer reason is missing or below 20 characters.");
  }

  const consentGiven = verificationInfo.consent === true || verificationInfo.consentGiven === true;
  if (!consentGiven) {
    riskScore -= 20;
    riskReasons.push("Buyer consent has not been provided.");
  }

  const missingVerificationFields = getMissingVerificationInfoFields(verificationInfo);
  if (missingVerificationFields.length > 0) {
    riskScore -= 15;
    riskReasons.push(`Verification information is incomplete: ${missingVerificationFields.join(", ")}.`);
  }

  if (!financeRequest.selectedFinancierId && !financeRequest.selectedFinancierName) {
    riskScore -= 10;
    riskReasons.push("No financier has been selected.");
  } else if (!selectedFinancier) {
    riskScore -= 15;
    riskReasons.push("Selected financier could not be verified.");
  } else if (selectedFinancierMaxAmount < requestedFinanceAmount) {
    riskScore -= 25;
    riskReasons.push("Selected financier cannot cover the requested finance amount.");
  }

  riskScore = Math.max(0, Math.min(100, riskScore));

  let riskLevel = "high";
  if (riskScore >= 80) {
    riskLevel = "low";
  } else if (riskScore >= 60) {
    riskLevel = "medium";
  }

  const recommendedFinancierType = {
    low: "Bank / Trade Finance Partner",
    medium: "SACCO / Microfinance Partner",
    high: "Manual Review / Guarantor Required"
  }[riskLevel];

  return {
    riskScore,
    riskLevel,
    riskReasons,
    recommendedFinancierType
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "TradeFlow backend is running",
    status: "OK"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "TradeFlow MVP API"
  });
});

app.get("/api/financiers", (req, res) => {
  const db = readDatabase();

  res.json({
    financiers: db.financiers
  });
});

app.post("/api/quotations", (req, res) => {
  const {
    supplierName,
    supplierPhone,
    buyerName,
    buyerPhone,
    items,
    totalAmount
  } = req.body;

  if (!supplierName || !supplierPhone || !buyerName || !buyerPhone || !totalAmount) {
    return res.status(400).json({
      message: "Missing required quotation fields"
    });
  }

  const db = readDatabase();

  const quotation = {
    id: generateId("TFQ"),
    supplierName,
    supplierPhone,
    buyerName,
    buyerPhone,
    items: items || [],
    totalAmount: Number(totalAmount),
    status: "created",
    createdAt: new Date().toISOString()
  };

  db.quotations.push(quotation);
  writeDatabase(db);

  res.status(201).json({
    message: "Quotation created successfully",
    quotation,
    buyerLink: `http://localhost:${PORT}/api/quotations/${quotation.id}`
  });
});

app.get("/api/quotations/:id/recommended-financiers", (req, res) => {
  const db = readDatabase();
  const quotation = db.quotations.find((q) => q.id === req.params.id);

  if (!quotation) {
    return res.status(404).json({
      message: "Quotation not found"
    });
  }

  const buyerAvailableAmount = Number(req.query.buyerAvailableAmount || 0);
  const requestedFinanceAmount = Math.max(0, Number(quotation.totalAmount) - buyerAvailableAmount);
  const financiers = db.financiers
    .filter((financier) => Number(financier.maxAmount) >= requestedFinanceAmount)
    .sort((a, b) => {
      return getFinancierFitRank(a, requestedFinanceAmount) - getFinancierFitRank(b, requestedFinanceAmount);
    });

  res.json({
    quotation,
    buyerAvailableAmount,
    requestedFinanceAmount,
    financiers
  });
});

app.get("/api/quotations/:id", (req, res) => {
  const db = readDatabase();
  const quotation = db.quotations.find((q) => q.id === req.params.id);

  if (!quotation) {
    return res.status(404).json({
      message: "Quotation not found"
    });
  }

  res.json(quotation);
});

app.get("/api/suppliers/:phone/quotations", (req, res) => {
  const db = readDatabase();
  const supplierPhone = normalizePhone(decodeURIComponent(req.params.phone));
  const quotations = db.quotations
    .filter((quotation) => normalizePhone(quotation.supplierPhone) === supplierPhone)
    .map((quotation) => {
      const relatedFinanceRequests = db.financeRequests.filter((request) => request.quotationId === quotation.id);
      const latestFinanceRequest = relatedFinanceRequests[relatedFinanceRequests.length - 1] || null;

      return {
        ...quotation,
        financeRequest: latestFinanceRequest,
        financeRequests: relatedFinanceRequests
      };
    });

  res.json({
    supplierPhone: req.params.phone,
    quotations
  });
});

app.post("/api/finance-requests", (req, res) => {
  const {
    quotationId,
    buyerAvailableAmount,
    selectedFinancierId,
    selectedFinancierName,
    requestedFinanceAmount,
    repaymentPeriod,
    buyerReason,
    verificationInfo
  } = req.body;

  if (!quotationId || buyerAvailableAmount === undefined || !repaymentPeriod) {
    return res.status(400).json({
      message: "Missing required finance request fields"
    });
  }

  const db = readDatabase();
  const quotation = db.quotations.find((q) => q.id === quotationId);

  if (!quotation) {
    return res.status(404).json({
      message: "Quotation not found"
    });
  }

  const availableAmount = Number(buyerAvailableAmount);
  const calculatedRequestedFinanceAmount = quotation.totalAmount - availableAmount;

  if (calculatedRequestedFinanceAmount <= 0) {
    return res.status(400).json({
      message: "Buyer does not need financing for this quotation"
    });
  }

  const selectedFinancier = findFinancierByIdOrName(db.financiers, selectedFinancierId, selectedFinancierName);
  const finalRequestedFinanceAmount = Number(requestedFinanceAmount) > 0
    ? Number(requestedFinanceAmount)
    : calculatedRequestedFinanceAmount;
  const finalVerificationInfo = verificationInfo && typeof verificationInfo === "object"
    ? verificationInfo
    : {};
  const finalRepaymentPeriod = repaymentPeriod || selectedFinancier?.repaymentPeriod || "";
  const finalBuyerReason = buyerReason || finalVerificationInfo.businessPurpose || "";

  const baseFinanceRequest = {
    id: generateId("TFR"),
    quotationId,
    supplierName: quotation.supplierName,
    supplierPhone: quotation.supplierPhone,
    buyerName: quotation.buyerName,
    buyerPhone: quotation.buyerPhone,
    totalAmount: quotation.totalAmount,
    buyerAvailableAmount: availableAmount,
    requestedFinanceAmount: finalRequestedFinanceAmount,
    selectedFinancierId: selectedFinancier?.id || selectedFinancierId || null,
    selectedFinancierName: selectedFinancier?.name || selectedFinancierName || null,
    selectedFinancierType: selectedFinancier?.type || null,
    selectedFinancierMaxAmount: selectedFinancier?.maxAmount || null,
    repaymentPeriod: finalRepaymentPeriod,
    buyerReason: finalBuyerReason,
    verificationInfo: finalVerificationInfo,
    verificationChecks: getDefaultVerificationChecks(),
    verificationStatus: "pending",
    paymentStatus: "not_paid",
    paymentReference: "",
    status: "pending_verification",
    assignedFinancier: selectedFinancier?.name || selectedFinancierName || null,
    adminNotes: "",
    financierNotes: "",
    createdAt: new Date().toISOString()
  };

  const riskAssessment = calculateRiskScore(baseFinanceRequest);
  const financeRequest = {
    ...baseFinanceRequest,
    ...riskAssessment
  };

  db.financeRequests.push(financeRequest);
  writeDatabase(db);

  res.status(201).json({
    message: "Finance request submitted successfully",
    financeRequest
  });
});

app.get("/api/admin/finance-requests", (req, res) => {
  const db = readDatabase();

  res.json({
    total: db.financeRequests.length,
    financeRequests: db.financeRequests
  });
});

app.get("/api/financiers/:financierId/finance-requests", (req, res) => {
  const db = readDatabase();
  const financier = db.financiers.find((item) => item.id === req.params.financierId);

  if (!financier) {
    return res.status(404).json({
      message: "Financier not found"
    });
  }

  const financeRequests = db.financeRequests.filter((request) => {
    return request.selectedFinancierId === financier.id ||
      request.selectedFinancierName === financier.name ||
      request.assignedFinancier === financier.name;
  });

  res.json({
    financier,
    financeRequests
  });
});

app.patch("/api/admin/finance-requests/:id/verification", (req, res) => {
  const { verificationChecks, adminNotes, action } = req.body;
  const db = readDatabase();
  const request = db.financeRequests.find((r) => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({
      message: "Finance request not found"
    });
  }

  request.verificationChecks = {
    ...getDefaultVerificationChecks(),
    ...(request.verificationChecks || {}),
    ...(verificationChecks || {})
  };

  if (adminNotes !== undefined) {
    request.adminNotes = adminNotes;
  }

  if (action === "request_more_information") {
    request.status = "more_information_required";
    request.verificationStatus = "needs_more_information";
  } else if (action === "reject") {
    request.status = "rejected_by_tradeflow";
    request.verificationStatus = "rejected";
  } else if (areVerificationChecksComplete(request.verificationChecks)) {
    request.status = "approved_for_financier_review";
    request.verificationStatus = "verified";
  } else if (request.status !== "more_information_required") {
    request.status = "pending_verification";
    request.verificationStatus = "pending";
  }

  request.updatedAt = new Date().toISOString();
  writeDatabase(db);

  res.json({
    message: "Verification updated successfully",
    financeRequest: request
  });
});

app.patch("/api/financier/finance-requests/:id/decision", (req, res) => {
  const { status, financierNotes } = req.body;
  const allowedStatuses = ["approved_by_financier", "rejected_by_financier"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid financier decision status"
    });
  }

  const db = readDatabase();
  const request = db.financeRequests.find((r) => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({
      message: "Finance request not found"
    });
  }

  if (status === "approved_by_financier" && request.verificationStatus !== "verified") {
    return res.status(400).json({
      message: "TradeFlow verification must be completed before financier decision"
    });
  }

  request.status = status;
  request.financierNotes = financierNotes || request.financierNotes || "";
  request.financierDecisionAt = new Date().toISOString();
  request.updatedAt = new Date().toISOString();

  writeDatabase(db);

  res.json({
    message: "Financier decision updated successfully",
    financeRequest: request
  });
});

app.patch("/api/financier/finance-requests/:id/payment", (req, res) => {
  const { paymentStatus, paymentReference } = req.body;

  if (paymentStatus !== "paid_to_supplier") {
    return res.status(400).json({
      message: "Invalid payment status"
    });
  }

  const db = readDatabase();
  const request = db.financeRequests.find((r) => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({
      message: "Finance request not found"
    });
  }

  request.paymentStatus = "paid_to_supplier";
  request.paymentReference = paymentReference || request.paymentReference || "";
  request.status = "paid_to_supplier";
  request.paidToSupplierAt = new Date().toISOString();
  request.updatedAt = new Date().toISOString();

  writeDatabase(db);

  res.json({
    message: "Supplier payment marked successfully",
    financeRequest: request
  });
});

app.patch("/api/admin/finance-requests/:id/status", (req, res) => {
  const { status, assignedFinancier, adminNotes } = req.body;

  if (!FINANCE_REQUEST_STATUSES.includes(status)) {
    return res.status(400).json({
      message: "Invalid status"
    });
  }

  const db = readDatabase();
  const request = db.financeRequests.find((r) => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({
      message: "Finance request not found"
    });
  }

  request.status = status;
  request.assignedFinancier = assignedFinancier || request.assignedFinancier;
  request.adminNotes = adminNotes || request.adminNotes;
  request.updatedAt = new Date().toISOString();

  writeDatabase(db);

  res.json({
    message: "Finance request updated successfully",
    financeRequest: request
  });
});

app.listen(PORT, () => {
  readDatabase();
  console.log(`TradeFlow backend running on http://localhost:${PORT}`);
});
