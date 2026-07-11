const API_URL = "http://localhost:5000";

const page = document.body.dataset.page;
const apiStatus = document.getElementById("apiStatus");

setupSmoothScrolling();
showFileProtocolWarning();
checkBackendHealth();

if (page === "supplier") {
  initSupplierPortal();
}

if (page === "buyer") {
  initBuyerPortal();
}

if (page === "financier") {
  initFinancierPortal();
}

if (page === "admin") {
  initAdminPortal();
}

// Keeps anchor navigation smooth across all role pages.
function setupSmoothScrolling() {
  document.querySelectorAll("[data-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (!targetId || !targetId.startsWith("#")) {
        return;
      }

      const target = document.querySelector(targetId);

      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", targetId);
    });
  });
}

async function checkBackendHealth() {
  if (!apiStatus) {
    return;
  }

  try {
    const data = await requestJson("/health");
    apiStatus.textContent = data.status === "healthy" ? "Backend online" : "Backend reachable";
  } catch (error) {
    apiStatus.textContent = "Backend offline";
  }
}

function showFileProtocolWarning() {
  if (window.location.protocol !== "file:") {
    return;
  }

  const pageShell = document.querySelector(".page-shell");

  if (!pageShell) {
    return;
  }

  const warning = document.createElement("div");
  warning.className = "file-warning";
  warning.textContent = "You are opening TradeFlow directly from a file. For WhatsApp links to work properly, run the frontend using a local server such as: python -m http.server 5500";
  pageShell.prepend(warning);
}

function initSupplierPortal() {
  const quotationForm = byId("quotationForm");
  const quotationMessage = byId("quotationMessage");
  const quotationResult = byId("quotationResult");
  const supplierStatusMessage = byId("supplierStatusMessage");
  const supplierLookupPhone = byId("supplierLookupPhone");
  const loadSupplierQuotationsBtn = byId("loadSupplierQuotationsBtn");
  const supplierQuotationsList = byId("supplierQuotationsList");

  quotationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = quotationForm.querySelector("button[type='submit']");
    const itemPrice = Number(value("itemPrice"));
    const payload = {
      supplierName: value("supplierName"),
      supplierPhone: value("supplierPhone"),
      buyerName: value("buyerName"),
      buyerPhone: value("buyerPhone"),
      items: [
        {
          name: value("itemName"),
          quantity: 1,
          price: itemPrice
        }
      ],
      totalAmount: itemPrice
    };

    try {
      if (itemPrice <= 0) {
        throw new Error("Item price must be greater than zero.");
      }

      hideElement(quotationResult);
      setBusy(submitButton, true, "Creating...");
      setMessage(quotationMessage, "info", "Creating quotation...");

      const data = await requestJson("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      supplierLookupPhone.value = payload.supplierPhone;
      renderSupplierQuotationSuccess(data.quotation, quotationResult);
      setMessage(quotationMessage, "success", "Quotation created successfully.");
      await loadSupplierQuotations(payload.supplierPhone);
    } catch (error) {
      hideElement(quotationResult);
      setMessage(quotationMessage, "error", error.message);
    } finally {
      setBusy(submitButton, false);
    }
  });

  loadSupplierQuotationsBtn.addEventListener("click", () => {
    loadSupplierQuotations(supplierLookupPhone.value);
  });

  async function loadSupplierQuotations(phone) {
    const supplierPhone = String(phone || "").trim();

    if (!supplierPhone) {
      setMessage(supplierStatusMessage, "error", "Enter a supplier phone number to load quotation status.");
      return;
    }

    try {
      setBusy(loadSupplierQuotationsBtn, true, "Loading...");
      setMessage(supplierStatusMessage, "info", "Loading supplier quotations...");
      supplierQuotationsList.innerHTML = "";

      const data = await requestJson(`/api/suppliers/${encodeURIComponent(supplierPhone)}/quotations`);
      const quotations = Array.isArray(data.quotations) ? data.quotations : [];

      if (quotations.length === 0) {
        renderEmptyState(supplierQuotationsList, "No quotations found for this supplier phone.");
        setMessage(supplierStatusMessage, "success", "No quotations found yet.");
        return;
      }

      quotations.forEach((quotation) => {
        supplierQuotationsList.appendChild(createSupplierStatusCard(quotation));
      });
      setMessage(supplierStatusMessage, "success", `${quotations.length} quotation${quotations.length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      setMessage(supplierStatusMessage, "error", error.message);
    } finally {
      setBusy(loadSupplierQuotationsBtn, false);
    }
  }
}

function initBuyerPortal() {
  const buyerQuotationMessage = byId("buyerQuotationMessage");
  const buyerQuotationDetails = byId("buyerQuotationDetails");
  const buyerAvailableAmount = byId("buyerAvailableAmount");
  const requestedFinanceAmountDisplay = byId("requestedFinanceAmountDisplay");
  const showFinanciersBtn = byId("showFinanciersBtn");
  const financierRecommendationMessage = byId("financierRecommendationMessage");
  const recommendedFinanciers = byId("recommendedFinanciers");
  const verificationCard = byId("verificationCard");
  const selectedFinancierSummary = byId("selectedFinancierSummary");
  const buyerFinanceForm = byId("buyerFinanceForm");
  const financeMessage = byId("financeMessage");
  const financeResult = byId("financeResult");

  const state = {
    quotation: null,
    selectedFinancier: null,
    requestedFinanceAmount: 0
  };

  const quotationId = new URLSearchParams(window.location.search).get("quotationId");

  if (!quotationId) {
    setMessage(buyerQuotationMessage, "error", "Missing quotationId. Open this page from a supplier buyer link.");
    buyerQuotationDetails.innerHTML = "";
  } else {
    loadBuyerQuotation(quotationId);
  }

  buyerAvailableAmount.addEventListener("input", updateFinancingGap);
  showFinanciersBtn.addEventListener("click", loadRecommendedFinanciers);
  recommendedFinanciers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-financier-id]");

    if (!button) {
      return;
    }

    const financier = state.financiers.find((item) => item.id === button.dataset.financierId);

    if (!financier) {
      return;
    }

    state.selectedFinancier = financier;
    selectedFinancierSummary.textContent = `${financier.name} selected for ${formatCurrency(state.requestedFinanceAmount)}. Complete verification to submit.`;
    verificationCard.hidden = false;
    verificationCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  buyerFinanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = buyerFinanceForm.querySelector("button[type='submit']");
    const consent = byId("consent").checked;

    try {
      if (!state.quotation) {
        throw new Error("Quotation has not loaded yet.");
      }

      if (!state.selectedFinancier) {
        throw new Error("Choose a financier before submitting.");
      }

      if (!consent) {
        throw new Error("Buyer consent is required.");
      }

      const verificationInfo = {
        nationalIdOrNIN: value("nationalIdOrNIN"),
        phoneNumber: value("phoneNumber"),
        location: value("location"),
        incomeSource: value("incomeSource"),
        monthlyIncomeEstimate: value("monthlyIncomeEstimate"),
        businessPurpose: value("businessPurpose"),
        consent
      };

      const payload = {
        quotationId: state.quotation.id,
        buyerAvailableAmount: Number(buyerAvailableAmount.value),
        requestedFinanceAmount: state.requestedFinanceAmount,
        selectedFinancierId: state.selectedFinancier.id,
        selectedFinancierName: state.selectedFinancier.name,
        repaymentPeriod: state.selectedFinancier.repaymentPeriod,
        buyerReason: verificationInfo.businessPurpose,
        verificationInfo
      };

      setBusy(submitButton, true, "Submitting...");
      setMessage(financeMessage, "info", "Submitting finance request...");
      hideElement(financeResult);

      const data = await requestJson("/api/finance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      renderFinanceSummary(data.financeRequest, financeResult);
      setMessage(financeMessage, "success", "Finance request submitted successfully. Status: pending_verification.");
    } catch (error) {
      hideElement(financeResult);
      setMessage(financeMessage, "error", error.message);
    } finally {
      setBusy(submitButton, false);
    }
  });

  async function loadBuyerQuotation(id) {
    try {
      setMessage(buyerQuotationMessage, "info", "Loading quotation...");
      const quotation = await requestJson(`/api/quotations/${encodeURIComponent(id)}`);
      state.quotation = quotation;
      renderBuyerQuotation(quotation, buyerQuotationDetails);
      setMessage(buyerQuotationMessage, "success", "Quotation loaded.");
      updateFinancingGap();
    } catch (error) {
      buyerQuotationDetails.innerHTML = "";
      setMessage(buyerQuotationMessage, "error", error.message);
    }
  }

  function updateFinancingGap() {
    const totalAmount = Number(state.quotation?.totalAmount || 0);
    const availableAmount = Number(buyerAvailableAmount.value || 0);
    state.requestedFinanceAmount = Math.max(0, totalAmount - availableAmount);
    requestedFinanceAmountDisplay.textContent = formatCurrency(state.requestedFinanceAmount);
  }

  async function loadRecommendedFinanciers() {
    try {
      if (!state.quotation) {
        throw new Error("Load a quotation before requesting financier recommendations.");
      }

      updateFinancingGap();

      if (state.requestedFinanceAmount <= 0) {
        throw new Error("Buyer contribution covers the quotation. Financing is not required.");
      }

      setBusy(showFinanciersBtn, true, "Loading...");
      setMessage(financierRecommendationMessage, "info", "Finding recommended financiers...");
      recommendedFinanciers.innerHTML = "";
      verificationCard.hidden = true;

      const data = await requestJson(
        `/api/quotations/${encodeURIComponent(state.quotation.id)}/recommended-financiers?buyerAvailableAmount=${encodeURIComponent(buyerAvailableAmount.value || 0)}`
      );

      state.financiers = data.financiers || [];
      state.requestedFinanceAmount = data.requestedFinanceAmount;
      requestedFinanceAmountDisplay.textContent = formatCurrency(state.requestedFinanceAmount);

      if (state.financiers.length === 0) {
        renderEmptyState(recommendedFinanciers, "No financiers can cover this requested amount.");
        setMessage(financierRecommendationMessage, "error", "No recommended financiers found.");
        return;
      }

      state.financiers.forEach((financier) => {
        recommendedFinanciers.appendChild(createFinancierCard(financier, state.requestedFinanceAmount));
      });
      setMessage(financierRecommendationMessage, "success", `${state.financiers.length} financier${state.financiers.length === 1 ? "" : "s"} recommended.`);
    } catch (error) {
      setMessage(financierRecommendationMessage, "error", error.message);
    } finally {
      setBusy(showFinanciersBtn, false);
    }
  }
}

function initFinancierPortal() {
  const financierSelector = byId("financierSelector");
  const financierMessage = byId("financierMessage");
  const financierRequests = byId("financierRequests");

  loadFinanciers();

  financierSelector.addEventListener("change", () => {
    loadFinancierRequests(financierSelector.value);
  });

  financierRequests.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-financier-action]");

    if (!button) {
      return;
    }

    const requestId = button.closest(".request-card").dataset.requestId;
    const action = button.dataset.financierAction;

    try {
      setBusy(button, true, "Updating...");

      if (action === "paid_to_supplier") {
        await requestJson(`/api/financier/finance-requests/${requestId}/payment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus: "paid_to_supplier",
            paymentReference: `TF-PAY-${Date.now()}`
          })
        });
      } else {
        await requestJson(`/api/financier/finance-requests/${requestId}/decision`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: action,
            financierNotes: action === "approved_by_financier"
              ? "Funding approved by demo financier."
              : "Funding rejected by demo financier."
          })
        });
      }

      setMessage(financierMessage, "success", "Financier action saved.");
      await loadFinancierRequests(financierSelector.value);
    } catch (error) {
      setMessage(financierMessage, "error", error.message);
    } finally {
      setBusy(button, false);
    }
  });

  async function loadFinanciers() {
    try {
      const data = await requestJson("/api/financiers");
      const financiers = data.financiers || [];
      financierSelector.innerHTML = '<option value="">Select financier</option>';
      financiers.forEach((financier) => {
        const option = document.createElement("option");
        option.value = financier.id;
        option.textContent = financier.name;
        financierSelector.appendChild(option);
      });
      setMessage(financierMessage, "success", "Select a financier to load assigned requests.");
    } catch (error) {
      setMessage(financierMessage, "error", error.message);
    }
  }

  async function loadFinancierRequests(financierId) {
    financierRequests.innerHTML = "";

    if (!financierId) {
      setMessage(financierMessage, "info", "Select a financier to load assigned requests.");
      return;
    }

    try {
      setMessage(financierMessage, "info", "Loading assigned requests...");
      const data = await requestJson(`/api/financiers/${encodeURIComponent(financierId)}/finance-requests`);
      const requests = data.financeRequests || [];

      if (requests.length === 0) {
        renderEmptyState(financierRequests, "No requests assigned to this financier.");
        setMessage(financierMessage, "success", "No assigned requests yet.");
        return;
      }

      requests.forEach((request) => {
        financierRequests.appendChild(createFinancierRequestCard(request));
      });
      setMessage(financierMessage, "success", `${requests.length} request${requests.length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      setMessage(financierMessage, "error", error.message);
    }
  }
}

function initAdminPortal() {
  const loadAdminRequestsBtn = byId("loadAdminRequestsBtn");
  const adminMessage = byId("adminMessage");
  const adminRequests = byId("adminRequests");

  loadAdminRequestsBtn.addEventListener("click", loadAdminRequests);
  adminRequests.addEventListener("click", handleAdminAction);
  loadAdminRequests();

  async function loadAdminRequests() {
    try {
      setBusy(loadAdminRequestsBtn, true, "Loading...");
      setMessage(adminMessage, "info", "Loading finance requests...");
      adminRequests.innerHTML = "";

      const data = await requestJson("/api/admin/finance-requests");
      const requests = data.financeRequests || [];

      if (requests.length === 0) {
        renderEmptyState(adminRequests, "No finance requests found.");
        setMessage(adminMessage, "success", "No finance requests found.");
        return;
      }

      requests
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .forEach((request) => {
          adminRequests.appendChild(createAdminRequestCard(request));
        });

      setMessage(adminMessage, "success", `${requests.length} finance request${requests.length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      setMessage(adminMessage, "error", error.message);
    } finally {
      setBusy(loadAdminRequestsBtn, false);
    }
  }

  async function handleAdminAction(event) {
    const button = event.target.closest("[data-admin-action]");

    if (!button) {
      return;
    }

    const card = button.closest(".request-card");
    const requestId = card.dataset.requestId;
    const action = button.dataset.adminAction;
    const verificationChecks = getVerificationChecksFromCard(card);
    const adminNotes = card.querySelector("[data-admin-notes]").value.trim();

    if (action === "approve" && !areLocalVerificationChecksComplete(verificationChecks)) {
      setMessage(adminMessage, "error", "All verification checks must be complete before financier review.");
      return;
    }

    try {
      setBusy(button, true, "Saving...");
      await requestJson(`/api/admin/finance-requests/${requestId}/verification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationChecks,
          adminNotes,
          action: action === "save" || action === "approve" ? undefined : action
        })
      });

      setMessage(adminMessage, "success", "Verification update saved.");
      await loadAdminRequests();
    } catch (error) {
      setMessage(adminMessage, "error", error.message);
    } finally {
      setBusy(button, false);
    }
  }
}

function renderSupplierQuotationSuccess(quotation, container) {
  const buyerLink = buildBuyerLink(quotation.id);
  container.innerHTML = "";
  container.appendChild(createDetailsGrid([
    ["Quotation ID", quotation.id],
    ["Total amount", formatCurrency(quotation.totalAmount)],
    ["Buyer link", createLink(buyerLink, buyerLink)]
  ]));

  const actions = document.createElement("div");
  actions.className = "summary-actions";

  const copyButton = createButton("Copy Buyer Link", "ghost-action");
  copyButton.type = "button";
  copyButton.addEventListener("click", async () => {
    await copyText(buyerLink);
    setMessage(byId("quotationMessage"), "success", "Buyer link copied.");
  });

  const whatsappButton = createButton("Share Buyer Link on WhatsApp", "primary-action");
  whatsappButton.type = "button";
  whatsappButton.addEventListener("click", () => {
    const message = [
      "Hello, your supplier has sent you a TradeFlow quotation.",
      "",
      `Quotation ID: ${quotation.id}`,
      "",
      "Open this secure TradeFlow financing link:",
      buyerLink
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  });

  actions.append(copyButton, whatsappButton);
  container.appendChild(actions);
  container.hidden = false;
}

function buildBuyerLink(quotationId) {
  const baseUrl = window.location.origin;
  const currentPath = window.location.pathname;
  const folderPath = currentPath.substring(0, currentPath.lastIndexOf("/") + 1);
  return `${baseUrl}${folderPath}buyer.html?quotationId=${encodeURIComponent(quotationId)}`;
}

function renderBuyerQuotation(quotation, container) {
  const item = quotation.items?.[0] || {};
  container.innerHTML = "";
  container.appendChild(createDetailsGrid([
    ["Supplier name", quotation.supplierName],
    ["Supplier phone", quotation.supplierPhone],
    ["Buyer name", quotation.buyerName],
    ["Buyer phone", quotation.buyerPhone],
    ["Item", item.name || "Not provided"],
    ["Total amount", formatCurrency(quotation.totalAmount)]
  ]));
}

function renderFinanceSummary(financeRequest, container) {
  container.innerHTML = "";
  container.appendChild(createDetailsGrid([
    ["Finance Request ID", financeRequest.id],
    ["Requested finance amount", formatCurrency(financeRequest.requestedFinanceAmount)],
    ["Status", createStatusChip(financeRequest.status)],
    ["Risk Score", formatRiskScore(financeRequest.riskScore)],
    ["Risk Level", createRiskLevelChip(financeRequest.riskLevel)],
    ["Recommended Financier Type", financeRequest.recommendedFinancierType || "Not scored"],
    ["Risk Reasons", createRiskReasonsList(financeRequest.riskReasons)]
  ]));
  container.hidden = false;
}

function createSupplierStatusCard(quotation) {
  const financeRequest = quotation.financeRequest;
  const card = document.createElement("article");
  card.className = "request-card";
  card.appendChild(createCardHeader(quotation.id, quotation.buyerName || "Buyer", createStatusChip(quotation.status)));
  card.appendChild(createDetailsGrid([
    ["Quotation status", quotation.status || "created"],
    ["Buyer financing status", financeRequest?.status ? createStatusChip(financeRequest.status) : "No finance request yet"],
    ["Selected financier", financeRequest?.selectedFinancierName || financeRequest?.assignedFinancier || "Not selected"],
    ["Payment / disbursement status", financeRequest?.paymentStatus || "not_paid"],
    ["Total amount", formatCurrency(quotation.totalAmount)],
    ["Financing needed", financeRequest ? formatCurrency(financeRequest.requestedFinanceAmount) : "Not requested"]
  ]));
  return card;
}

function createFinancierCard(financier, requestedFinanceAmount) {
  const card = document.createElement("article");
  card.className = "request-card financier-card";
  card.appendChild(createCardHeader(financier.name, financier.type, createRiskAppetiteChip(financier.riskAppetite)));
  card.appendChild(createDetailsGrid([
    ["Max amount", formatCurrency(financier.maxAmount)],
    ["Interest rate / fee", financier.interestRate],
    ["Repayment period", financier.repaymentPeriod],
    ["Risk appetite", financier.riskAppetite],
    ["Requested amount", formatCurrency(requestedFinanceAmount)],
    ["Benefits", createBenefitsList(financier.benefits)]
  ]));

  const chooseButton = createButton("Choose This Financier", "primary-action");
  chooseButton.type = "button";
  chooseButton.dataset.financierId = financier.id;
  card.appendChild(wrapActions(chooseButton));
  return card;
}

function createFinancierRequestCard(request) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.dataset.requestId = request.id;
  card.appendChild(createCardHeader(request.id, `Quotation ${request.quotationId}`, createStatusChip(request.status)));
  card.appendChild(createDetailsGrid([
    ["Request ID", request.id],
    ["Quotation ID", request.quotationId],
    ["Buyer name", request.buyerName || "Unknown"],
    ["Supplier name", request.supplierName || "Unknown"],
    ["Total amount", formatCurrency(request.totalAmount)],
    ["Buyer contribution", formatCurrency(request.buyerAvailableAmount)],
    ["Requested finance amount", formatCurrency(request.requestedFinanceAmount)],
    ["Risk score", formatRiskScore(request.riskScore)],
    ["Risk level", createRiskLevelChip(request.riskLevel)],
    ["Verification status", request.verificationStatus || "pending"],
    ["Status", createStatusChip(request.status)]
  ]));

  card.appendChild(wrapActions(
    createActionButton("Approve Funding", "approved_by_financier", "primary-action", "financierAction"),
    createActionButton("Reject Funding", "rejected_by_financier", "danger-action", "financierAction"),
    createActionButton("Mark as Paid to Supplier", "paid_to_supplier", "warning-action", "financierAction")
  ));
  return card;
}

function createAdminRequestCard(request) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.dataset.requestId = request.id;
  card.appendChild(createCardHeader(request.id, `Selected financier: ${request.selectedFinancierName || "Not selected"}`, createStatusChip(request.status)));
  card.appendChild(createDetailsGrid([
    ["Quotation ID", request.quotationId],
    ["Buyer", `${request.buyerName || "Unknown"} - ${request.buyerPhone || "No phone"}`],
    ["Supplier", `${request.supplierName || "Unknown"} - ${request.supplierPhone || "No phone"}`],
    ["Total amount", formatCurrency(request.totalAmount)],
    ["Buyer contribution", formatCurrency(request.buyerAvailableAmount)],
    ["Financing needed", formatCurrency(request.requestedFinanceAmount)],
    ["Risk score", formatRiskScore(request.riskScore)],
    ["Risk level", createRiskLevelChip(request.riskLevel)],
    ["Risk reasons", createRiskReasonsList(request.riskReasons)],
    ["Verification status", request.verificationStatus || "pending"],
    ["Payment status", request.paymentStatus || "not_paid"],
    ["Buyer reason", request.buyerReason || "Not provided"]
  ]));

  card.appendChild(createVerificationChecklist(request.verificationChecks));

  const notesLabel = document.createElement("label");
  notesLabel.className = "notes-field";
  notesLabel.textContent = "Admin notes";
  const notesInput = document.createElement("textarea");
  notesInput.dataset.adminNotes = "true";
  notesInput.value = request.adminNotes || "";
  notesLabel.appendChild(notesInput);
  card.appendChild(notesLabel);

  card.appendChild(wrapActions(
    createActionButton("Save Checklist", "save", "secondary-action", "adminAction"),
    createActionButton("Approve for Financier Review", "approve", "primary-action", "adminAction"),
    createActionButton("Request More Information", "request_more_information", "warning-action", "adminAction"),
    createActionButton("Reject Risky Transaction", "reject", "danger-action", "adminAction")
  ));
  return card;
}

function createVerificationChecklist(verificationChecks = {}) {
  const labels = {
    buyerIdentityVerified: "Buyer identity verified",
    phoneVerified: "Phone verified",
    supplierVerified: "Supplier verified",
    quotationVerified: "Quotation verified",
    priceChecked: "Price checked",
    fraudFlagsChecked: "Fraud flags checked",
    repaymentAbilityChecked: "Repayment ability checked"
  };

  const wrapper = document.createElement("div");
  wrapper.className = "checklist";

  Object.keys(labels).forEach((key) => {
    const label = document.createElement("label");
    label.className = "check-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.checkKey = key;
    input.checked = verificationChecks[key] === true;
    const span = document.createElement("span");
    span.textContent = labels[key];
    label.append(input, span);
    wrapper.appendChild(label);
  });

  return wrapper;
}

function getVerificationChecksFromCard(card) {
  const checks = {};
  card.querySelectorAll("[data-check-key]").forEach((input) => {
    checks[input.dataset.checkKey] = input.checked;
  });
  return checks;
}

function areLocalVerificationChecksComplete(checks) {
  return Object.values(checks).every(Boolean);
}

async function requestJson(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    throw new Error(`Cannot reach the TradeFlow backend at ${API_URL}. Start it with npm.cmd run dev, then try again.`);
  }

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}.`);
  }

  return data;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function byId(id) {
  return document.getElementById(id);
}

function value(id) {
  return byId(id).value.trim();
}

function setMessage(element, type, message) {
  if (!element) {
    return;
  }

  element.className = `message ${type}`;
  element.textContent = message;
  element.hidden = false;
}

function hideElement(element) {
  if (!element) {
    return;
  }

  element.hidden = true;
  element.innerHTML = "";
}

function setBusy(button, isBusy, busyLabel = "Working...") {
  if (!button) {
    return;
  }

  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatStatus(status) {
  return String(status || "unknown").replaceAll("_", " ");
}

function formatRiskScore(riskScore) {
  return Number.isFinite(Number(riskScore)) ? `${Number(riskScore)} / 100` : "Not scored";
}

function statusClass(status) {
  return `status-${String(status || "unknown").replaceAll("_", "-")}`;
}

function normalizeRiskLevel(riskLevel) {
  const level = String(riskLevel || "").toLowerCase();
  return ["low", "medium", "high"].includes(level) ? level : "not-scored";
}

function createDetailsGrid(rows) {
  const grid = document.createElement("dl");
  grid.className = "details-grid";

  rows.forEach(([label, detail]) => {
    const item = document.createElement("div");
    item.className = "detail";

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    if (detail instanceof Node) {
      description.appendChild(detail);
    } else {
      description.textContent = detail;
    }

    item.append(term, description);
    grid.appendChild(item);
  });

  return grid;
}

function createCardHeader(titleText, subtitleText, chip) {
  const header = document.createElement("div");
  header.className = "request-header";
  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = titleText;
  const subtitle = document.createElement("p");
  subtitle.textContent = subtitleText || "";
  titleBlock.append(title, subtitle);
  header.append(titleBlock, chip);
  return header;
}

function createStatusChip(status) {
  const chip = document.createElement("span");
  chip.className = `status-chip ${statusClass(status)}`;
  chip.textContent = formatStatus(status);
  return chip;
}

function createRiskLevelChip(riskLevel) {
  const normalizedLevel = normalizeRiskLevel(riskLevel);
  const chip = document.createElement("span");
  chip.className = `risk-level-chip risk-level-${normalizedLevel}`;
  chip.textContent = normalizedLevel === "not-scored" ? "Not scored" : formatStatus(normalizedLevel);
  return chip;
}

function createRiskAppetiteChip(riskAppetite) {
  const level = normalizeRiskLevel(riskAppetite);
  const chip = document.createElement("span");
  chip.className = `risk-level-chip risk-level-${level}`;
  chip.textContent = `${formatStatus(riskAppetite)} appetite`;
  return chip;
}

function createRiskReasonsList(riskReasons) {
  const list = document.createElement("ul");
  list.className = "risk-reasons";

  if (!Array.isArray(riskReasons) || riskReasons.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No risk deductions recorded.";
    list.appendChild(item);
    return list;
  }

  riskReasons.forEach((reason) => {
    const item = document.createElement("li");
    item.textContent = reason;
    list.appendChild(item);
  });

  return list;
}

function createBenefitsList(benefits) {
  const list = document.createElement("ul");
  list.className = "risk-reasons";
  (benefits || []).forEach((benefit) => {
    const item = document.createElement("li");
    item.textContent = benefit;
    list.appendChild(item);
  });
  return list;
}

function createLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  return link;
}

function createButton(label, className) {
  const button = document.createElement("button");
  button.className = className;
  button.textContent = label;
  return button;
}

function createActionButton(label, action, className, dataName) {
  const button = createButton(label, className);
  button.type = "button";
  button.dataset[dataName] = action;
  return button;
}

function wrapActions(...buttons) {
  const actions = document.createElement("div");
  actions.className = "request-actions";
  actions.append(...buttons);
  return actions;
}

function renderEmptyState(container, message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  container.appendChild(empty);
}

async function copyText(text) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Some browsers block clipboard access from file pages, so use the fallback below.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}
