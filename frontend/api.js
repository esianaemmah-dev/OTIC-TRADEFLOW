const API_BASE_URL = "http://localhost:5000";

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    throw new Error(`Backend is not reachable. Make sure it is running on ${API_BASE_URL}.`);
  }

  const data = await readApiJson(response);

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}.`);
  }

  return data;
}

function apiGet(path) {
  return apiRequest(path);
}

function apiPost(path, body) {
  return apiRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
}

function apiPatch(path, body) {
  return apiRequest(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
}

async function readApiJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
}
