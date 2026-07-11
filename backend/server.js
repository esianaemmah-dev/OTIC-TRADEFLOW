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

function ensureDatabase() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      quotations: [],
      financeRequests: [],
      suppliers: [],
      buyers: []
    };

    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

function readDatabase() {
  ensureDatabase();
  const data = fs.readFileSync(dbPath, "utf-8");
  return JSON.parse(data);
}

function writeDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateId(prefix) {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `${prefix}-${timestamp}-${random}`;
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

app.post("/api/finance-requests", (req, res) => {
  const {
    quotationId,
    buyerAvailableAmount,
    repaymentPeriod,
    buyerReason
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
  const requestedFinanceAmount = quotation.totalAmount - availableAmount;

  if (requestedFinanceAmount <= 0) {
    return res.status(400).json({
      message: "Buyer does not need financing for this quotation"
    });
  }

  const financeRequest = {
    id: generateId("TFR"),
    quotationId,
    supplierName: quotation.supplierName,
    supplierPhone: quotation.supplierPhone,
    buyerName: quotation.buyerName,
    buyerPhone: quotation.buyerPhone,
    totalAmount: quotation.totalAmount,
    buyerAvailableAmount: availableAmount,
    requestedFinanceAmount,
    repaymentPeriod,
    buyerReason: buyerReason || "",
    status: "pending_review",
    riskLevel: "manual_review_required",
    assignedFinancier: null,
    adminNotes: "",
    createdAt: new Date().toISOString()
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

app.patch("/api/admin/finance-requests/:id/status", (req, res) => {
  const { status, assignedFinancier, adminNotes } = req.body;

  const allowedStatuses = [
    "pending_review",
    "approved",
    "rejected",
    "more_information_required"
  ];

  if (!allowedStatuses.includes(status)) {
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
  ensureDatabase();
  console.log(`TradeFlow backend running on http://localhost:${PORT}`);
});