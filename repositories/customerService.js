
import {
  createCustomer,
  getCustomerById,
  getCustomerByUsername,
  updateCustomerNumbers
} from '../repositories/customerRepository.js';

import {
  recordAudit
} from '../repositories/auditRepository.js';

export async function registerCustomer(username, actor = 'system') {
  const customer = await createCustomer(username);

  await recordAudit({
    actor,
    action: 'customer_created',
    customerId: customer.id,
    details: {
      username: customer.username
    }
  });

  return customer;
}

export async function findCustomerById(customerId) {
  if (typeof customerId !== 'string' || !customerId.trim()) {
    throw new Error('A valid customer ID is required.');
  }

  return getCustomerById(customerId);
}

export async function findCustomerByUsername(username) {
  if (typeof username !== 'string' || !username.trim()) {
    throw new Error('A username is required.');
  }

  return getCustomerByUsername(username);
}

export async function configureCustomerNumbers({
  customerId,
  pairingNumber,
  designatedNumber,
  actor
}) {
  if (
    typeof customerId !== 'string' ||
    !customerId.trim()
  ) {
    throw new Error('A valid customer ID is required.');
  }

  if (typeof actor !== 'string' || !actor.trim()) {
    throw new Error('An authorized actor is required.');
  }

  const customer = await updateCustomerNumbers(
    customerId,
    pairingNumber,
    designatedNumber
  );

  if (!customer) {
    throw new Error('Customer account not found.');
  }

  await recordAudit({
    actor,
    action: 'customer_numbers_updated',
    customerId: customer.id,
    details: {
      settingsUpdated: true
    }
  });

  return customer;
}
