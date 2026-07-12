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
    const data = await apiGet("/health");
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
  const supplierCommitmentsList = byId("supplierCommitmentsList");

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

      const data = await apiPost("/api/quotations", payload);

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
  loadSupplierQuotations(supplierLookupPhone.value || "0790872387");

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
      supplierCommitmentsList.innerHTML = "";

      const [data, commitmentsData] = await Promise.all([
        apiGet(`/api/suppliers/${encodeURIComponent(supplierPhone)}/quotations`),
        apiGet("/api/payment-commitments")
      ]);
      const quotations = Array.isArray(data.quotations) ? data.quotations : [];
      const quotationIds = new Set(quotations.map((quotation) => quotation.id));
      const commitments = (commitmentsData.paymentCommitments || []).filter((commitment) => {
        return quotationIds.has(commitment.quotationId);
      });

      if (quotations.length === 0) {
        renderEmptyState(supplierQuotationsList, "No quotations found for this supplier phone.");
        renderEmptyState(supplierCommitmentsList, "No buyer commitments found for this supplier phone.");
        setMessage(supplierStatusMessage, "success", "No quotations found yet.");
        return;
      }

      quotations.forEach((quotation) => {
        supplierQuotationsList.appendChild(createSupplierStatusCard(quotation));
      });
      if (commitments.length === 0) {
        renderEmptyState(supplierCommitmentsList, "Buyer has not committed payment for these quotations.");
      } else {
        commitments.forEach((commitment) => {
          supplierCommitmentsList.appendChild(createPaymentCommitmentCard(commitment));
        });
      }
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
  const paymentCommitmentAmount = byId("paymentCommitmentAmount");
  const paymentMode = byId("paymentMode");
  const paymentModeNotice = byId("paymentModeNotice");
  const paymentCommitmentForm = byId("paymentCommitmentForm");
  const paymentCommitmentMessage = byId("paymentCommitmentMessage");
  const paymentCommitmentResult = byId("paymentCommitmentResult");
  const requestedFinanceAmountDisplay = byId("requestedFinanceAmountDisplay");
  const showFinanciersBtn = byId("showFinanciersBtn");
  const financierRecommendationMessage = byId("financierRecommendationMessage");
  const recommendedFinanciers = byId("recommendedFinanciers");
  const verificationCard = byId("verificationCard");
  const selectedFinancierSummary = byId("selectedFinancierSummary");
  const buyerFinanceForm = byId("buyerFinanceForm");
  const financeMessage = byId("financeMessage");
  const financeResult = byId("financeResult");
  const buyerStatusSummary = byId("buyerStatusSummary");

  const state = {
    quotation: null,
    selectedFinancier: null,
    financeRequest: null,
    paymentCommitment: null,
    paymentModes: [],
    providerMode: "mock",
    requestedFinanceAmount: 0
  };

  const quotationId = new URLSearchParams(window.location.search).get("quotationId") || "TFQ-506031-4049";
  buyerAvailableAmount.value = buyerAvailableAmount.value || "50000";
  paymentCommitmentAmount.value = paymentCommitmentAmount.value || "50000";

  renderBuyerStatusSummary();
  loadPaymentModes();
  loadBuyerQuotation(quotationId);

  buyerAvailableAmount.addEventListener("input", updateFinancingGap);
  showFinanciersBtn.addEventListener("click", loadRecommendedFinanciers);
  paymentCommitmentResult.addEventListener("click", handlePaymentCommitmentAction);

  recommendedFinanciers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-financier-id]");

    if (!button) {
      return;
    }

    const financier = state.financiers?.find((item) => item.id === button.dataset.financierId);

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
        financierId: state.selectedFinancier.id,
        selectedFinancierId: state.selectedFinancier.id,
        selectedFinancierName: state.selectedFinancier.name,
        repaymentPeriod: state.selectedFinancier.repaymentPeriod,
        buyerReason: verificationInfo.businessPurpose,
        verificationInfo
      };

      setBusy(submitButton, true, "Submitting...");
      setMessage(financeMessage, "info", "Submitting finance request...");
      hideElement(financeResult);

      const data = await apiPost("/api/finance-requests", payload);

      state.financeRequest = data.financeRequest;
      renderFinanceSummary(data.financeRequest, financeResult, data.paymentCommitment);
      renderBuyerStatusSummary();
      setMessage(financeMessage, "success", `Finance request submitted to ${state.selectedFinancier.name}.`);
    } catch (error) {
      hideElement(financeResult);
      setMessage(financeMessage, "error", `Could not submit finance request. ${error.message}`);
    } finally {
      setBusy(submitButton, false);
    }
  });

  paymentCommitmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = paymentCommitmentForm.querySelector("button[type='submit']");

    try {
      if (!state.quotation) {
        throw new Error("Quotation has not loaded yet.");
      }

      const amountCommitted = Number(paymentCommitmentAmount.value || 0);

      if (amountCommitted <= 0) {
        throw new Error("Commitment amount must be greater than zero.");
      }

      setBusy(submitButton, true, "Committing...");
      setMessage(paymentCommitmentMessage, "info", "Creating provider commitment...");

      const data = await apiPost("/api/payment-commitments/initiate", {
        quotationId: state.quotation.id,
        financeRequestId: state.financeRequest?.id,
        buyerName: state.quotation.buyerName,
        buyerPhone: state.quotation.buyerPhone,
        supplierName: state.quotation.supplierName,
        supplierPhone: state.quotation.supplierPhone,
        selectedPaymentMode: paymentMode.value,
        amountCommitted,
        currency: "UGX"
      });

      state.paymentCommitment = data.paymentCommitment;
      state.financeRequest = data.financeRequest || state.financeRequest;
      renderPaymentCommitmentSummary(state.paymentCommitment, paymentCommitmentResult);
      renderBuyerStatusSummary();
      setMessage(paymentCommitmentMessage, "success", "Payment commitment created through provider.");
    } catch (error) {
      setMessage(paymentCommitmentMessage, "error", `Payment commitment failed. ${error.message}`);
    } finally {
      setBusy(submitButton, false);
    }
  });

  async function loadPaymentModes() {
    try {
      const data = await apiGet("/api/payment-modes");
      state.paymentModes = data.paymentModes || [];
      state.providerMode = data.providerMode || "mock";
      paymentMode.innerHTML = "";

      state.paymentModes.forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode.id;
        option.textContent = mode.label;
        paymentMode.appendChild(option);
      });

      if (state.paymentModes.length === 0) {
        const option = document.createElement("option");
        option.value = "mtn_mobile_money";
        option.textContent = "MTN Mobile Money";
        paymentMode.appendChild(option);
      }

      paymentModeNotice.textContent = state.providerMode === "mock"
        ? "Payment provider is currently mock/provider-ready. No live MTN, Airtel, card, or bank API is connected."
        : "Payment modes are loaded from configured provider integrations.";
      renderBuyerStatusSummary();
    } catch (error) {
      paymentMode.innerHTML = '<option value="mtn_mobile_money">MTN Mobile Money</option>';
      paymentModeNotice.textContent = `Could not load payment modes. ${error.message}`;
    }
  }

  async function loadBuyerQuotation(id) {
    try {
      setMessage(buyerQuotationMessage, "info", "Loading quotation...");
      const quotation = await apiGet(`/api/quotations/${encodeURIComponent(id)}`);
      state.quotation = quotation;
      renderBuyerQuotation(quotation, buyerQuotationDetails);
      setMessage(buyerQuotationMessage, "success", "Quotation loaded.");
      updateFinancingGap();
      await loadRecommendedFinanciers();
      renderBuyerStatusSummary();
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

    if (paymentCommitmentAmount && !state.paymentCommitment) {
      paymentCommitmentAmount.value = Math.max(1, availableAmount || Number(paymentCommitmentAmount.value || 50000));
    }

    renderBuyerStatusSummary();
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

      const data = await apiGet(
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

  async function handlePaymentCommitmentAction(event) {
    const button = event.target.closest("[data-payment-action]");

    if (!button || !state.paymentCommitment) {
      return;
    }

    try {
      setBusy(button, true, button.dataset.paymentAction === "verify" ? "Verifying..." : "Cancelling...");

      const data = button.dataset.paymentAction === "verify"
        ? await apiPost(`/api/payment-commitments/${encodeURIComponent(state.paymentCommitment.id)}/verify`, { simulatedStatus: "successful" })
        : await apiPatch(`/api/payment-commitments/${encodeURIComponent(state.paymentCommitment.id)}/cancel`, {});

      state.paymentCommitment = data.paymentCommitment;
      state.financeRequest = data.financeRequest || state.financeRequest;
      renderPaymentCommitmentSummary(state.paymentCommitment, paymentCommitmentResult);
      renderBuyerStatusSummary();
      setMessage(paymentCommitmentMessage, "success", button.dataset.paymentAction === "verify"
        ? "Provider commitment verified."
        : "Provider commitment cancelled.");
    } catch (error) {
      setMessage(paymentCommitmentMessage, "error", error.message);
    } finally {
      setBusy(button, false);
    }
  }

  function renderBuyerStatusSummary() {
    if (!buyerStatusSummary) {
      return;
    }

    buyerStatusSummary.innerHTML = "";
    buyerStatusSummary.appendChild(createDetailsGrid([
      ["Quotation", state.quotation?.id || "Loading"],
      ["Selected financier", state.financeRequest?.selectedFinancierName || state.selectedFinancier?.name || "Not selected"],
      ["Finance request status", state.financeRequest?.status ? createStatusChip(state.financeRequest.status) : "Not submitted"],
      ["Payment commitment status", createStatusChip(state.paymentCommitment?.status || state.financeRequest?.paymentCommitmentStatus || "not_started")],
      ["Verification status", state.financeRequest?.verificationStatus || "Not started"],
      ["Provider mode", state.providerMode === "mock" ? "Mock provider mode" : state.providerMode]
    ]));
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
    const card = button.closest(".request-card");
    const financierNotes = card.querySelector("[data-financier-notes]")?.value.trim();

    try {
      setBusy(button, true, "Updating...");

      if (action === "verify_commitment") {
        await apiPost(`/api/payment-commitments/${button.dataset.commitmentId}/verify`, {
            simulatedStatus: "successful"
          });
      } else if (action === "mark_payment") {
        await apiPatch(`/api/financier/finance-requests/${requestId}/payment`, {
          paymentStatus: "verified",
          paymentReference: `TF-PROVIDER-${Date.now()}`
        });
      } else {
        await apiPatch(`/api/financier/finance-requests/${requestId}/decision`, {
          status: action,
          financierNotes: financierNotes || getDefaultFinancierNote(action)
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
      const data = await apiGet("/api/financiers");
      const financiers = data.financiers || [];
      financierSelector.innerHTML = '<option value="">Select financier</option>';
      financiers.forEach((financier) => {
        const option = document.createElement("option");
        option.value = financier.id;
        option.textContent = financier.name;
        financierSelector.appendChild(option);
      });
      const defaultFinancier = financiers.find((financier) => financier.id === "FIN-SACCO-001") || financiers[0];
      if (defaultFinancier) {
        financierSelector.value = defaultFinancier.id;
        await loadFinancierRequests(defaultFinancier.id);
      }
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
      const [data, commitmentsData] = await Promise.all([
        apiGet(`/api/financiers/${encodeURIComponent(financierId)}/finance-requests`),
        apiGet("/api/payment-commitments")
      ]);
      const requests = data.financeRequests || [];
      const commitments = commitmentsData.paymentCommitments || [];

      if (requests.length === 0) {
        renderEmptyState(financierRequests, "No requests assigned to this financier.");
        setMessage(financierMessage, "success", "No assigned requests yet.");
        return;
      }

      requests.forEach((request) => {
        const linkedCommitment = request.paymentCommitment || commitments.find((commitment) => {
          return commitment.financeRequestId === request.id || commitment.quotationId === request.quotationId;
        }) || null;
        financierRequests.appendChild(createFinancierRequestCard({
          ...request,
          paymentCommitment: linkedCommitment
        }));
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
  const adminFinanciers = byId("adminFinanciers");
  const adminPaymentCommitments = byId("adminPaymentCommitments");
  const adminPaymentLogs = byId("adminPaymentLogs");

  loadAdminRequestsBtn.addEventListener("click", loadAdminDashboard);
  adminRequests.addEventListener("click", handleAdminAction);
  loadAdminDashboard();

  async function loadAdminDashboard() {
    try {
      setBusy(loadAdminRequestsBtn, true, "Loading...");
      setMessage(adminMessage, "info", "Loading admin dashboard...");
      adminRequests.innerHTML = "";
      adminFinanciers.innerHTML = "";
      adminPaymentCommitments.innerHTML = "";
      adminPaymentLogs.innerHTML = "";

      const [financeData, financiersData, commitmentsData] = await Promise.all([
        apiGet("/api/admin/finance-requests"),
        apiGet("/api/financiers"),
        apiGet("/api/payment-commitments")
      ]);
      const requests = financeData.financeRequests || [];
      const financiers = financiersData.financiers || [];
      const commitments = commitmentsData.paymentCommitments || [];
      const mockPaymentLogs = commitmentsData.mockPaymentLogs || [];

      if (financiers.length === 0) {
        renderEmptyState(adminFinanciers, "No financiers found.");
      } else {
        financiers.forEach((financier) => {
          adminFinanciers.appendChild(createAdminFinancierCard(financier));
        });
      }

      if (commitments.length === 0) {
        renderEmptyState(adminPaymentCommitments, "No payment commitments found.");
      } else {
        commitments
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .forEach((commitment) => {
            adminPaymentCommitments.appendChild(createPaymentCommitmentCard(commitment));
          });
      }

      if (requests.length === 0) {
        renderEmptyState(adminRequests, "No finance requests found.");
      } else {
        requests
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .forEach((request) => {
            adminRequests.appendChild(createAdminRequestCard(request));
          });
      }

      if (mockPaymentLogs.length === 0) {
        renderEmptyState(adminPaymentLogs, "No mock provider logs yet.");
      } else {
        mockPaymentLogs
          .slice()
          .reverse()
          .forEach((log) => {
            adminPaymentLogs.appendChild(createMockPaymentLogCard(log));
          });
      }

      setMessage(adminMessage, "success", `${requests.length} finance request${requests.length === 1 ? "" : "s"}, ${commitments.length} commitment${commitments.length === 1 ? "" : "s"}, and ${financiers.length} financier${financiers.length === 1 ? "" : "s"} loaded.`);
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
    const selectedStatus = card.querySelector("[data-admin-status]")?.value;

    if (action === "approve" && !areLocalVerificationChecksComplete(verificationChecks)) {
      setMessage(adminMessage, "error", "All verification checks must be complete before financier review.");
      return;
    }

    try {
      setBusy(button, true, "Saving...");
      if (action === "update_status") {
        await apiPatch(`/api/admin/finance-requests/${requestId}/status`, {
          status: selectedStatus,
          adminNotes
        });
      } else {
        await apiPatch(`/api/admin/finance-requests/${requestId}/verification`, {
          verificationChecks,
          adminNotes,
          action: action === "save" || action === "approve" ? undefined : action
        });
      }

      setMessage(adminMessage, "success", "Admin update saved.");
      await loadAdminDashboard();
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

function renderFinanceSummary(financeRequest, container, paymentCommitment = null) {
  const commitment = paymentCommitment || financeRequest.paymentCommitment || null;

  container.innerHTML = "";
  container.appendChild(createDetailsGrid([
    ["Finance Request ID", financeRequest.id],
    ["Requested finance amount", formatCurrency(financeRequest.requestedFinanceAmount)],
    ["Status", createStatusChip(financeRequest.status)],
    ["Buyer commitment status", createStatusChip(commitment?.status || financeRequest.paymentCommitmentStatus || "not_started")],
    ["Commitment amount", commitment ? formatCurrency(commitment.amountCommitted) : "Not started"],
    ["Commitment provider", commitment?.providerDisplayName || financeRequest.paymentCommitmentProvider || "Not started"],
    ["Provider reference", commitment?.providerTransactionReference || financeRequest.paymentCommitmentReference || "Not started"],
    ["Risk Score", formatRiskScore(financeRequest.riskScore)],
    ["Risk Level", createRiskLevelChip(financeRequest.riskLevel)],
    ["Recommended Financier Type", financeRequest.recommendedFinancierType || "Not scored"],
    ["Risk Reasons", createRiskReasonsList(financeRequest.riskReasons)]
  ]));

  if (commitment?.id && commitment.status === "pending") {
    const verifyButton = createButton("Verify Mock Commitment", "secondary-action");
    verifyButton.type = "button";
    verifyButton.addEventListener("click", async () => {
      try {
        setBusy(verifyButton, true, "Verifying...");
        setMessage(byId("financeMessage"), "info", "Checking mock provider status...");
        const data = await apiPost(`/api/payment-commitments/${encodeURIComponent(commitment.id)}/verify`, {
          simulatedStatus: "successful"
        });
        renderFinanceSummary(data.financeRequest || financeRequest, container, data.paymentCommitment);
        setMessage(byId("financeMessage"), "success", "Provider commitment verified.");
      } catch (error) {
        setMessage(byId("financeMessage"), "error", error.message);
      } finally {
        setBusy(verifyButton, false);
      }
    });
    container.appendChild(wrapActions(verifyButton));
  }

  container.hidden = false;
}

function createSupplierStatusCard(quotation) {
  const financeRequest = quotation.financeRequest;
  const commitment = financeRequest?.paymentCommitment || quotation.paymentCommitment || null;
  const card = document.createElement("article");
  card.className = "request-card";
  card.appendChild(createCardHeader(quotation.id, quotation.buyerName || "Buyer", createStatusChip(quotation.status)));
  card.appendChild(createDetailsGrid([
    ["Quotation status", quotation.status || "created"],
    ["Buyer name", quotation.buyerName || "Unknown"],
    ["Buyer phone", quotation.buyerPhone || "Unknown"],
    ["Items", formatItems(quotation.items)],
    ["Buyer financing status", financeRequest?.status ? createStatusChip(financeRequest.status) : "No finance request yet"],
    ["Selected financier", financeRequest?.selectedFinancierName || financeRequest?.assignedFinancier || "Not selected"],
    ["Buyer commitment", describeCommitmentStatus(commitment?.status || financeRequest?.paymentCommitmentStatus || quotation.paymentCommitmentStatus || "not_started")],
    ["Commitment provider", commitment?.providerDisplayName || financeRequest?.paymentCommitmentProvider || "Not started"],
    ["Total amount", formatCurrency(quotation.totalAmount)],
    ["Buyer available amount", financeRequest ? formatCurrency(financeRequest.buyerAvailableAmount) : "Not submitted"],
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
  const commitment = request.paymentCommitment || null;
  const card = document.createElement("article");
  card.className = "request-card";
  card.dataset.requestId = request.id;
  card.appendChild(createCardHeader(request.id, `Quotation ${request.quotationId}`, createStatusChip(request.status)));
  card.appendChild(createDetailsGrid([
    ["Request ID", request.id],
    ["Quotation ID", request.quotationId],
    ["Buyer name", request.buyerName || "Unknown"],
    ["Buyer phone", request.buyerPhone || "Unknown"],
    ["Supplier name", request.supplierName || "Unknown"],
    ["Supplier phone", request.supplierPhone || "Unknown"],
    ["Total amount", formatCurrency(request.totalAmount)],
    ["Buyer contribution", formatCurrency(request.buyerAvailableAmount)],
    ["Requested finance amount", formatCurrency(request.requestedFinanceAmount)],
    ["Buyer commitment status", createStatusChip(commitment?.status || request.paymentCommitmentStatus || "not_started")],
    ["Commitment amount", commitment ? formatCurrency(commitment.amountCommitted) : "Not started"],
    ["Commitment provider", commitment?.providerDisplayName || request.paymentCommitmentProvider || "Not started"],
    ["Provider reference", commitment?.providerTransactionReference || request.paymentCommitmentReference || "Not started"],
    ["Risk score", formatRiskScore(request.riskScore)],
    ["Risk level", createRiskLevelChip(request.riskLevel)],
    ["Verification status", request.verificationStatus || "pending"],
    ["Status", createStatusChip(request.status)]
  ]));

  const notesLabel = document.createElement("label");
  notesLabel.className = "notes-field";
  notesLabel.textContent = "Financier comment / reason";
  const notesInput = document.createElement("textarea");
  notesInput.dataset.financierNotes = "true";
  notesInput.value = request.financierNotes || "";
  notesLabel.appendChild(notesInput);
  card.appendChild(notesLabel);

  const actionButtons = [
    createActionButton("Approve Funding", "approved_by_financier", "primary-action", "financierAction"),
    createActionButton("Needs More Info", "needs_more_info", "warning-action", "financierAction"),
    createActionButton("Reject Funding", "rejected_by_financier", "danger-action", "financierAction")
  ];

  if (commitment?.id && commitment.status === "pending") {
    const verifyButton = createActionButton("Verify Commitment", "verify_commitment", "secondary-action", "financierAction");
    verifyButton.dataset.commitmentId = commitment.id;
    actionButtons.push(verifyButton);
  }

  if (commitment?.id) {
    actionButtons.push(createActionButton("Mark Provider Verified", "mark_payment", "ghost-action", "financierAction"));
  }

  card.appendChild(wrapActions(...actionButtons));
  return card;
}

function createAdminRequestCard(request) {
  const commitment = request.paymentCommitment || null;
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
    ["Buyer commitment status", createStatusChip(commitment?.status || request.paymentCommitmentStatus || "not_started")],
    ["Commitment provider", commitment?.providerDisplayName || request.paymentCommitmentProvider || "Not started"],
    ["Provider reference", commitment?.providerTransactionReference || request.paymentCommitmentReference || "Not started"],
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

  const statusLabel = document.createElement("label");
  statusLabel.className = "notes-field";
  statusLabel.textContent = "Manual status";
  const statusSelect = document.createElement("select");
  statusSelect.dataset.adminStatus = "true";
  getAdminStatusOptions().forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = formatStatus(status);
    option.selected = status === request.status;
    statusSelect.appendChild(option);
  });
  statusLabel.appendChild(statusSelect);
  card.appendChild(statusLabel);

  card.appendChild(wrapActions(
    createActionButton("Save Checklist", "save", "secondary-action", "adminAction"),
    createActionButton("Approve for Financier Review", "approve", "primary-action", "adminAction"),
    createActionButton("Request More Information", "request_more_information", "warning-action", "adminAction"),
    createActionButton("Reject Risky Transaction", "reject", "danger-action", "adminAction"),
    createActionButton("Update Status", "update_status", "ghost-action", "adminAction")
  ));
  return card;
}

function createAdminFinancierCard(financier) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.appendChild(createCardHeader(financier.name, financier.type, createRiskAppetiteChip(financier.riskAppetite)));
  card.appendChild(createDetailsGrid([
    ["Financier ID", financier.id],
    ["Max amount", formatCurrency(financier.maxAmount)],
    ["Interest rate / fee", financier.interestRate],
    ["Repayment period", financier.repaymentPeriod],
    ["Benefits", createBenefitsList(financier.benefits)]
  ]));
  return card;
}

function createPaymentCommitmentCard(commitment) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.appendChild(createCardHeader(commitment.id, `Quotation ${commitment.quotationId}`, createStatusChip(commitment.status)));
  card.appendChild(createDetailsGrid([
    ["Buyer", commitment.buyerName || "Unknown"],
    ["Supplier", commitment.supplierName || "Unknown"],
    ["Finance request", commitment.financeRequestId || "Not linked"],
    ["Payment mode", formatPaymentMode(commitment.selectedPaymentMode)],
    ["Amount committed", formatCurrency(commitment.amountCommitted)],
    ["Provider", commitment.providerDisplayName || commitment.provider || "Unknown"],
    ["Provider reference", commitment.providerTransactionReference || "Pending"],
    ["Status", createStatusChip(commitment.status)]
  ]));
  return card;
}

function createMockPaymentLogCard(log) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.appendChild(createCardHeader(log.id, log.action || "Provider event", createStatusChip(log.status)));
  card.appendChild(createDetailsGrid([
    ["Commitment ID", log.commitmentId],
    ["Quotation ID", log.quotationId],
    ["Finance request", log.financeRequestId || "Not linked"],
    ["Provider", log.provider || "mock"],
    ["Provider status", log.providerStatus || "Unknown"],
    ["Provider reference", log.providerTransactionReference || "Pending"],
    ["Created", formatDateTime(log.createdAt)]
  ]));
  return card;
}

function renderPaymentCommitmentSummary(commitment, container) {
  container.innerHTML = "";

  if (!commitment) {
    renderEmptyState(container, "No payment commitment has been created yet.");
    container.hidden = false;
    return;
  }

  container.appendChild(createDetailsGrid([
    ["Commitment ID", commitment.id],
    ["Amount committed", formatCurrency(commitment.amountCommitted)],
    ["Payment mode", formatPaymentMode(commitment.selectedPaymentMode)],
    ["Provider", commitment.providerDisplayName || commitment.provider || "Unknown"],
    ["Provider reference", commitment.providerTransactionReference || "Pending"],
    ["Status", createStatusChip(commitment.status)]
  ]));

  const actions = [];

  if (commitment.status === "pending") {
    actions.push(createActionButton("Verify Commitment", "verify", "secondary-action", "paymentAction"));
    actions.push(createActionButton("Cancel Commitment", "cancel", "danger-action", "paymentAction"));
  }

  if (actions.length > 0) {
    container.appendChild(wrapActions(...actions));
  }

  container.hidden = false;
}

function describeCommitmentStatus(status) {
  const normalized = String(status || "not_started");

  if (normalized === "verified") {
    return "Buyer commitment verified";
  }

  if (normalized === "pending") {
    return "Buyer commitment pending";
  }

  if (normalized === "failed") {
    return "Buyer commitment failed";
  }

  if (normalized === "cancelled") {
    return "Buyer commitment cancelled";
  }

  return "Buyer has not committed payment";
}

function formatItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "No items listed";
  }

  return items.map((item) => {
    const quantity = Number(item.quantity || 1);
    const name = item.name || "Item";
    return `${quantity} x ${name}`;
  }).join(", ");
}

function formatPaymentMode(mode) {
  const labels = {
    mtn_mobile_money: "MTN Mobile Money",
    airtel_money: "Airtel Money",
    bank_transfer: "Bank Transfer",
    card: "Card / future provider"
  };

  return labels[mode] || formatStatus(mode);
}

function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString();
}

function getDefaultFinancierNote(action) {
  if (action === "approved_by_financier") {
    return "Funding approved by demo financier.";
  }

  if (action === "needs_more_info") {
    return "More information requested by demo financier.";
  }

  return "Funding rejected by demo financier.";
}

function getAdminStatusOptions() {
  return [
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
    "needs_more_info",
    "provider_commitment_verified",
    "delivery_pending",
    "repayment_active",
    "completed"
  ];
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
