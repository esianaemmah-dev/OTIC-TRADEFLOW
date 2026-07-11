const API_URL = "http://localhost:5000";

const quotationForm = document.getElementById("quotationForm");
const financeForm = document.getElementById("financeForm");
const loadRequestsBtn = document.getElementById("loadRequestsBtn");

const apiStatus = document.getElementById("apiStatus");
const quotationMessage = document.getElementById("quotationMessage");
const quotationResult = document.getElementById("quotationResult");
const financeMessage = document.getElementById("financeMessage");
const financeResult = document.getElementById("financeResult");
const adminMessage = document.getElementById("adminMessage");
const adminRequests = document.getElementById("adminRequests");

const ADMIN_STATUS_PAYLOADS = {
  approved: {
    status: "approved",
    assignedFinancier: "Demo SACCO Partner",
    adminNotes: "Buyer and supplier require verification before disbursement."
  },
  rejected: {
    status: "rejected",
    assignedFinancier: null,
    adminNotes: "Request rejected during manual review."
  },
  more_information_required: {
    status: "more_information_required",
    assignedFinancier: null,
    adminNotes: "More buyer or supplier verification information is required."
  }
};

quotationForm.addEventListener("submit", handleQuotationSubmit);
financeForm.addEventListener("submit", handleFinanceSubmit);
loadRequestsBtn.addEventListener("click", loadFinanceRequests);
adminRequests.addEventListener("click", handleAdminAction);

setupSmoothScrolling();
checkBackendHealth();
prefillQuotationFromUrl();

// Adds smooth scrolling to the navbar and hero buttons while keeping normal anchor fallback.
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

async function handleQuotationSubmit(event) {
  event.preventDefault();

  const submitButton = quotationForm.querySelector("button[type='submit']");
  const itemName = getValue("itemName");
  const itemPrice = Number(document.getElementById("itemPrice").value);

  const payload = {
    supplierName: getValue("supplierName"),
    supplierPhone: getValue("supplierPhone"),
    buyerName: getValue("buyerName"),
    buyerPhone: getValue("buyerPhone"),
    items: [
      {
        name: itemName,
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    document.getElementById("quotationId").value = data.quotation.id;
    renderQuotationSummary(data.quotation, data.buyerLink);
    setMessage(quotationMessage, "success", "Quotation created successfully.");
  } catch (error) {
    hideElement(quotationResult);
    setMessage(quotationMessage, "error", error.message);
  } finally {
    setBusy(submitButton, false);
  }
}

async function handleFinanceSubmit(event) {
  event.preventDefault();

  const submitButton = financeForm.querySelector("button[type='submit']");
  const buyerAvailableAmount = Number(document.getElementById("buyerAvailableAmount").value);

  const payload = {
    quotationId: getValue("quotationId"),
    buyerAvailableAmount,
    repaymentPeriod: getValue("repaymentPeriod"),
    buyerReason: getValue("buyerReason")
  };

  try {
    if (buyerAvailableAmount < 0) {
      throw new Error("Amount currently available cannot be negative.");
    }

    hideElement(financeResult);
    setBusy(submitButton, true, "Submitting...");
    setMessage(financeMessage, "info", "Submitting finance request...");

    const data = await requestJson("/api/finance-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    renderFinanceSummary(data.financeRequest);
    setMessage(financeMessage, "success", "Finance request submitted successfully.");
  } catch (error) {
    hideElement(financeResult);
    setMessage(financeMessage, "error", error.message);
  } finally {
    setBusy(submitButton, false);
  }
}

// Central API helper keeps backend errors and offline states readable in the UI.
async function requestJson(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    throw new Error(
      `Cannot reach the TradeFlow backend at ${API_URL}. Start it with npm.cmd run dev, then try again.`
    );
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

async function checkBackendHealth() {
  try {
    const data = await requestJson("/health");
    apiStatus.textContent = data.status === "healthy" ? "Backend online" : "Backend reachable";
  } catch (error) {
    apiStatus.textContent = "Backend offline";
    setMessage(adminMessage, "error", error.message);
  }
}

function prefillQuotationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const quotationId = params.get("quotationId");

  if (quotationId) {
    document.getElementById("quotationId").value = quotationId;
  }
}

function getValue(elementId) {
  return document.getElementById(elementId).value.trim();
}

function setMessage(element, type, message) {
  element.className = `message ${type}`;
  element.textContent = message;
  element.hidden = false;
}

function hideElement(element) {
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

function statusClass(status) {
  return `status-${String(status || "unknown").replaceAll("_", "-")}`;
}

// Shows the quotation confirmation and wires up copy plus WhatsApp share actions.
function renderQuotationSummary(quotation, buyerLink) {
  const quotationLink = buyerLink || `${API_URL}/api/quotations/${quotation.id}`;
  quotationResult.innerHTML = "";

  quotationResult.appendChild(createDetailsGrid([
    ["Quotation ID", quotation.id],
    ["Total amount", formatCurrency(quotation.totalAmount)],
    ["Buyer quotation link", createLink(quotationLink, quotationLink)]
  ]));

  const actions = document.createElement("div");
  actions.className = "summary-actions";

  const copyButton = createButton("Copy Quotation ID", "ghost-action");
  copyButton.type = "button";
  copyButton.addEventListener("click", () => copyQuotationId(quotation.id));

  const whatsappButton = createButton("Share on WhatsApp", "primary-action");
  whatsappButton.type = "button";
  whatsappButton.addEventListener("click", () => shareQuotationWhatsApp(quotation, quotationLink));

  actions.append(copyButton, whatsappButton);
  quotationResult.appendChild(actions);
  quotationResult.hidden = false;
}

function renderFinanceSummary(financeRequest) {
  financeResult.innerHTML = "";
  financeResult.appendChild(createDetailsGrid([
    ["Finance Request ID", financeRequest.id],
    ["Requested finance amount", formatCurrency(financeRequest.requestedFinanceAmount)],
    ["Status", createStatusChip(financeRequest.status)]
  ]));
  financeResult.hidden = false;
}

async function copyQuotationId(quotationId) {
  try {
    await copyText(quotationId);
    setMessage(quotationMessage, "success", "Quotation ID copied.");
  } catch (error) {
    setMessage(quotationMessage, "error", "Could not copy quotation ID. Please copy it manually.");
  }
}

function shareQuotationWhatsApp(quotation, buyerLink) {
  const message = [
    `TradeFlow quotation ${quotation.id}`,
    `Total: ${formatCurrency(quotation.totalAmount)}`,
    `Buyer link: ${buyerLink}`
  ].join("\n");

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank", "noopener");
}

async function loadFinanceRequests() {
  setBusy(loadRequestsBtn, true, "Loading...");
  setMessage(adminMessage, "info", "Loading finance requests...");
  adminRequests.innerHTML = "";

  try {
    const data = await requestJson("/api/admin/finance-requests");
    const financeRequests = Array.isArray(data.financeRequests) ? data.financeRequests : [];

    if (financeRequests.length === 0) {
      renderEmptyAdminState();
      setMessage(adminMessage, "success", "No finance requests found.");
      return;
    }

    const requests = [...financeRequests].sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    requests.forEach((request) => {
      adminRequests.appendChild(createRequestCard(request));
    });

    setMessage(adminMessage, "success", `${requests.length} finance request${requests.length === 1 ? "" : "s"} loaded.`);
  } catch (error) {
    setMessage(adminMessage, "error", error.message);
  } finally {
    setBusy(loadRequestsBtn, false);
  }
}

function renderEmptyAdminState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "No finance requests found.";
  adminRequests.appendChild(empty);
}

function createRequestCard(request) {
  const card = document.createElement("article");
  card.className = "request-card";
  card.dataset.requestId = request.id;

  const header = document.createElement("div");
  header.className = "request-header";

  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = request.id;
  const subtitle = document.createElement("p");
  subtitle.textContent = `Quotation ${request.quotationId}`;
  titleBlock.append(title, subtitle);

  header.append(titleBlock, createStatusChip(request.status));
  card.appendChild(header);

  card.appendChild(createDetailsGrid([
    ["Request ID", request.id],
    ["Quotation ID", request.quotationId],
    ["Buyer name and phone", `${request.buyerName || "Unknown"} - ${request.buyerPhone || "No phone"}`],
    ["Supplier name and phone", `${request.supplierName || "Unknown"} - ${request.supplierPhone || "No phone"}`],
    ["Total amount", formatCurrency(request.totalAmount)],
    ["Buyer available amount", formatCurrency(request.buyerAvailableAmount)],
    ["Financing needed", formatCurrency(request.requestedFinanceAmount)],
    ["Repayment period", request.repaymentPeriod || "Not provided"],
    ["Buyer reason", request.buyerReason || "Not provided"],
    ["Status", createStatusChip(request.status)],
    ["Assigned financier", request.assignedFinancier || "Not assigned"],
    ["Admin notes", request.adminNotes || "No notes yet"]
  ]));

  const actions = document.createElement("div");
  actions.className = "request-actions";
  actions.append(
    createAdminButton("Approve", "approved", "primary-action"),
    createAdminButton("Reject", "rejected", "danger-action"),
    createAdminButton("Request More Information", "more_information_required", "warning-action")
  );

  card.appendChild(actions);
  return card;
}

function createDetailsGrid(rows) {
  const grid = document.createElement("dl");
  grid.className = "details-grid";

  rows.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "detail";

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    if (value instanceof Node) {
      description.appendChild(value);
    } else {
      description.textContent = value;
    }

    item.append(term, description);
    grid.appendChild(item);
  });

  return grid;
}

function createStatusChip(status) {
  const chip = document.createElement("span");
  chip.className = `status-chip ${statusClass(status)}`;
  chip.textContent = formatStatus(status);
  return chip;
}

function createLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = label;
  return link;
}

function createButton(label, className) {
  const button = document.createElement("button");
  button.className = className;
  button.textContent = label;
  return button;
}

function createAdminButton(label, status, className) {
  const button = createButton(label, className);
  button.type = "button";
  button.dataset.action = status;
  return button;
}

async function handleAdminAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const card = button.closest(".request-card");
  await updateRequestStatus(card.dataset.requestId, button.dataset.action, button);
}

// Sends the exact review payloads expected by the current backend.
async function updateRequestStatus(requestId, status, button) {
  const payload = ADMIN_STATUS_PAYLOADS[status];

  if (!payload) {
    setMessage(adminMessage, "error", "Unknown admin action.");
    return;
  }

  try {
    setBusy(button, true, "Updating...");

    await requestJson(`/api/admin/finance-requests/${requestId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    setMessage(adminMessage, "success", `Finance request ${formatStatus(status)} successfully.`);
    await loadFinanceRequests();
  } catch (error) {
    setMessage(adminMessage, "error", error.message);
  } finally {
    setBusy(button, false);
  }
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
