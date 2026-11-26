
'use strict';

const API_BASE = '/api/admin';

const elements = {
  loginSection: document.getElementById('loginSection'),
  dashboardSection: document.getElementById('dashboardSection'),
  loginForm: document.getElementById('adminLoginForm'),
  loginMessage: document.getElementById('loginMessage'),
  logoutButton: document.getElementById('logoutButton'),
  refreshButton: document.getElementById('refreshButton'),
  searchButton: document.getElementById('searchButton'),
  customerSearch: document.getElementById('customerSearch'),
  customerTableBody: document.getElementById('customerTableBody'),
  customerMessage: document.getElementById('customerMessage'),
  customerDetails: document.getElementById('customerDetails'),
  detailMessage: document.getElementById('detailMessage'),
  accessKeyPanel: document.getElementById('accessKeyPanel'),
  generatedAccessKey: document.getElementById('generatedAccessKey'),
  copyAccessKeyButton: document.getElementById('copyAccessKeyButton'),
  keyMessage: document.getElementById('keyMessage'),
  verifyPaymentButton: document.getElementById('verifyPaymentButton'),
  issueKeyButton: document.getElementById('issueKeyButton'),
  renewSubscriptionButton: document.getElementById('renewSubscriptionButton')
};

let selectedCustomerId = null;
let requestInProgress = false;

function showMessage(element, message, type = '') {
  if (!element) return;

  element.textContent = message;
  element.className = `message ${type}`.trim();
}

function setLoading(button, loading, label) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body
      ? JSON.stringify(options.body)
      : undefined
  });

  const contentType = response.headers.get('content-type') || '';

  const data = contentType.includes('application/json')
    ? await response.json()
    : {};

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function showLogin() {
  elements.loginSection.hidden = false;
  elements.dashboardSection.hidden = true;
  elements.logoutButton.hidden = true;
  selectedCustomerId = null;
}

function showDashboard() {
  elements.loginSection.hidden = true;
  elements.dashboardSection.hidden = false;
  elements.logoutButton.hidden = false;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString();
}

function createCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value ?? '—';
  return cell;
}

function createActionButton(label, customerId) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'secondary-button';
  button.textContent = label;

  button.addEventListener('click', () => {
    loadCustomerDetails(customerId);
  });

  return button;
}

function renderCustomers(customers) {
  elements.customerTableBody.replaceChildren();

  if (!Array.isArray(customers) || customers.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');

    cell.colSpan = 6;
    cell.textContent = 'No customers found.';

    row.appendChild(cell);
    elements.customerTableBody.appendChild(row);
    return;
  }

  for (const customer of customers) {
    const row = document.createElement('tr');

    row.appendChild(createCell(customer.username));
    row.appendChild(createCell(customer.paymentStatus));
    row.appendChild(createCell(customer.subscriptionStatus));
    row.appendChild(createCell(formatDate(customer.expiresAt)));
    row.appendChild(createCell(customer.accessKeyStatus));

    const actionCell = document.createElement('td');

    actionCell.appendChild(
      createActionButton('View', customer.id)
    );

    row.appendChild(actionCell);
    elements.customerTableBody.appendChild(row);
  }
}

function updateStatistics(stats = {}) {
  document.getElementById('totalCustomers').textContent =
    stats.totalCustomers ?? 0;

  document.getElementById('activeSubscriptions').textContent =
    stats.activeSubscriptions ?? 0;

  document.getElementById('expiredSubscriptions').textContent =
    stats.expiredSubscriptions ?? 0;

  document.getElementById('pendingPayments').textContent =
    stats.pendingPayments ?? 0;
}

async function loadCustomers(search = '') {
  if (requestInProgress) return;

  requestInProgress = true;
  setLoading(elements.refreshButton, true, 'Loading...');

  try {
    const query = new URLSearchParams();

    if (search.trim()) {
      query.set('search', search.trim());
    }

    const suffix = query.toString()
      ? `?${query.toString()}`
      : '';

    const result = await apiRequest(`/customers${suffix}`);

    renderCustomers(result.customers || []);
    updateStatistics(result.statistics || {});

    showMessage(
      elements.customerMessage,
      'Customer records updated.',
      'success'
    );
  } catch (error) {
    showMessage(
      elements.customerMessage,
      error.message,
      'error'
    );
  } finally {
    requestInProgress = false;
    setLoading(elements.refreshButton, false);
  }
}

async function loadCustomerDetails(customerId) {
  if (!customerId) return;

  try {
    const result = await apiRequest(
      `/customers/${encodeURIComponent(customerId)}`
    );

    const customer = result.customer;

    if (!customer) {
      throw new Error('Customer record not found.');
    }

    selectedCustomerId = customer.id;

    document.getElementById('detailUsername').textContent =
      customer.username || '—';

    document.getElementById('detailCustomerId').textContent =
      customer.id || '—';

    document.getElementById('detailPaymentStatus').textContent =
      customer.paymentStatus || '—';

    document.getElementById('detailSubscriptionStatus').textContent =
      customer.subscriptionStatus || '—';

    document.getElementById('detailExpiry').textContent =
      formatDate(customer.expiresAt);

    document.getElementById('detailKeyStatus').textContent =
      customer.accessKeyStatus || '—';

    elements.customerDetails.hidden = false;
    elements.accessKeyPanel.hidden = true;

    showMessage(elements.detailMessage, '');
  } catch (error) {
    showMessage(
      elements.customerMessage,
      error.message,
      'error'
    );
  }
}

async function verifyPayment() {
  if (!selectedCustomerId) return;

  const confirmed = window.confirm(
    'Confirm that you have independently checked this payment?'
  );

  if (!confirmed) return;

  setLoading(elements.verifyPaymentButton, true, 'Verifying...');

  try {
    await apiRequest(
      `/customers/${encodeURIComponent(selectedCustomerId)}/verify-payment`,
      {
        method: 'POST'
      }
    );

    showMessage(
      elements.detailMessage,
      'Payment verification submitted.',
      'success'
    );

    await loadCustomerDetails(selectedCustomerId);
    await loadCustomers(elements.customerSearch.value);
  } catch (error) {
    showMessage(elements.detailMessage, error.message, 'error');
  } finally {
    setLoading(elements.verifyPaymentButton, false);
  }
}

async function issueAccessKey() {
  if (!selectedCustomerId) return;

  const confirmed = window.confirm(
    'Issue the single access key assigned to this customer?'
  );

  if (!confirmed) return;

  setLoading(elements.issueKeyButton, true, 'Issuing...');

  try {
    const result = await apiRequest(
      `/customers/${encodeURIComponent(selectedCustomerId)}/access-key`,
      {
        method: 'POST'
      }
    );

    if (!result.accessKey) {
      throw new Error(
        'No new key was returned. Check the customer key status.'
      );
    }

    elements.generatedAccessKey.textContent = result.accessKey;
    elements.accessKeyPanel.hidden = false;

    showMessage(
      elements.keyMessage,
      'Key issued. Copy it and deliver it securely.',
      'success'
    );

    await loadCustomerDetails(selectedCustomerId);
    await loadCustomers(elements.customerSearch.value);
  } catch (error) {
    showMessage(elements.detailMessage, error.message, 'error');
  } finally {
    setLoading(elements.issueKeyButton, false);
  }
}

async function renewSubscription() {
  if (!selectedCustomerId) return;

  const confirmed = window.confirm(
    'Confirm that the renewal payment has been manually verified?'
  );

  if (!confirmed) return;

  setLoading(
    elements.renewSubscriptionButton,
    true,
    'Renewing...'
  );

  try {
    await apiRequest(
      `/customers/${encodeURIComponent(selectedCustomerId)}/renew`,
      {
        method: 'POST'
      }
    );

    showMessage(
      elements.detailMessage,
      'Renewal request completed.',
      'success'
    );

    await loadCustomerDetails(selectedCustomerId);
    await loadCustomers(elements.customerSearch.value);
  } catch (error) {
    showMessage(elements.detailMessage, error.message, 'error');
  } finally {
    setLoading(elements.renewSubscriptionButton, false);
  }
}

async function adminLogin(event) {
  event.preventDefault();

  if (requestInProgress) return;

  const formData = new FormData(elements.loginForm);

  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');

  if (!username || !password) {
    showMessage(
      elements.loginMessage,
      'Enter your administrator credentials.',
      'error'
    );
    return;
  }

  requestInProgress = true;

  const submitButton = elements.loginForm.querySelector(
    'button[type="submit"]'
  );

  setLoading(submitButton, true, 'Signing in...');

  try {
    await apiRequest('/login', {
      method: 'POST',
      body: { username, password }
    });

    elements.loginForm.reset();
    showDashboard();

    await loadCustomers();
  } catch (error) {
    showMessage(
      elements.loginMessage,
      error.message,
      'error'
    );
  } finally {
    requestInProgress = false;
    setLoading(submitButton, false);
  }
}

async function adminLogout() {
  try {
    await apiRequest('/logout', {
      method: 'POST'
    });
  } catch {
    // The server may already have expired the session.
  }

  elements.loginForm.reset();
  elements.customerTableBody.replaceChildren();
  elements.customerDetails.hidden = true;
  elements.accessKeyPanel.hidden = true;

  showLogin();
}

async function checkAdminSession() {
  try {
    await apiRequest('/me');
    showDashboard();
    await loadCustomers();
  } catch {
    showLogin();
  }
}

async function copyAccessKey() {
  const key = elements.generatedAccessKey.textContent;

  if (!key) return;

  try {
    await navigator.clipboard.writeText(key);

    showMessage(
      elements.keyMessage,
      'Access key copied.',
      'success'
    );
  } catch {
    showMessage(
      elements.keyMessage,
      'Copy failed. Use a secure browser context and try again.',
      'error'
    );
  }
}

elements.loginForm.addEventListener('submit', adminLogin);

elements.logoutButton.addEventListener('click', adminLogout);

elements.refreshButton.addEventListener('click', () => {
  loadCustomers(elements.customerSearch.value);
});

elements.searchButton.addEventListener('click', () => {
  loadCustomers(elements.customerSearch.value);
});

elements.customerSearch.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    loadCustomers(elements.customerSearch.value);
  }
});

elements.verifyPaymentButton.addEventListener(
  'click',
  verifyPayment
);

elements.issueKeyButton.addEventListener(
  'click',
  issueAccessKey
);

elements.renewSubscriptionButton.addEventListener(
  'click',
  renewSubscription
);

elements.copyAccessKeyButton.addEventListener(
  'click',
  copyAccessKey
);

checkAdminSession();
