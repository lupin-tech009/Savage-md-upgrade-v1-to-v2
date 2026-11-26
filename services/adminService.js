
import {
  registerCustomer,
  findCustomerById
} from './customerService.js';

import {
  generateCustomerAccessKey
} from './accessKeyService.js';

import {
  verifyCustomerPayment,
  rejectCustomerPayment
} from './paymentService.js';

import {
  checkCustomerSubscription
} from './subscriptionService.js';

import {
  recordAudit,
  getCustomerAuditHistory
} from '../repositories/auditRepository.js';

import { getDatabase } from '../database.js';

function requireAdmin(actor) {
  if (
    typeof actor !== 'string' ||
    !actor.trim()
  ) {
    throw new Error('Administrator authentication required.');
  }

  return actor.trim().slice(0, 64);
}

export async function createCustomerAccount({
  username,
  actor
}) {
  const administrator = requireAdmin(actor);

  return registerCustomer(username, administrator);
}

export async function getAdminCustomerDetails({
  customerId,
  actor
}) {
  requireAdmin(actor);

  const customer = await findCustomerById(customerId);

  if (!customer) {
    return null;
  }

  const subscription = await checkCustomerSubscription(customerId);

  return {
    id: customer.id,
    username: customer.username,
    paymentStatus: customer.payment_status,
    subscriptionStatus: subscription?.subscription_status,
    subscriptionStartedAt: subscription?.subscription_started_at,
    subscriptionExpiresAt: subscription?.subscription_expires_at,
    pairingNumberConfigured: Boolean(customer.pairing_number),
    designatedNumberConfigured: Boolean(customer.designated_number),
    createdAt: customer.created_at
  };
}

export async function adminVerifyPayment({
  paymentId,
  actor
}) {
  const administrator = requireAdmin(actor);

  return verifyCustomerPayment({
    paymentId,
    actor: administrator
  });
}

export async function adminRejectPayment({
  paymentId,
  actor
}) {
  const administrator = requireAdmin(actor);

  return rejectCustomerPayment({
    paymentId,
    actor: administrator
  });
}

export async function adminIssueAccessKey({
  customerId,
  actor
}) {
  const administrator = requireAdmin(actor);

  return generateCustomerAccessKey({
    customerId,
    actor: administrator
  });
}

export async function suspendCustomer({
  customerId,
  actor
}) {
  const administrator = requireAdmin(actor);
  const database = getDatabase();

  const result = await database.query(
    `UPDATE customers
     SET
       subscription_status = 'suspended',
       updated_at = NOW()
     WHERE id = $1
       AND subscription_status IN ('active', 'inactive', 'expired')
     RETURNING id, username, subscription_status`,
    [customerId]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      'Customer not found or cannot be suspended.'
    );
  }

  await recordAudit({
    actor: administrator,
    action: 'customer_suspended',
    customerId,
    details: {
      status: 'suspended'
    }
  });

  return result.rows[0];
}

export async function reactivateCustomer({
  customerId,
  actor
}) {
  const administrator = requireAdmin(actor);
  const database = getDatabase();

  const result = await database.query(
    `UPDATE customers
     SET
       subscription_status = CASE
         WHEN subscription_expires_at > NOW()
           THEN 'active'
         ELSE 'expired'
       END,
       updated_at = NOW()
     WHERE id = $1
       AND subscription_status = 'suspended'
     RETURNING
       id,
       username,
       subscription_status,
       subscription_expires_at`,
    [customerId]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      'Customer not found or is not suspended.'
    );
  }

  await recordAudit({
    actor: administrator,
    action: 'customer_reactivated',
    customerId,
    details: {
      newStatus: result.rows[0].subscription_status
    }
  });

  return result.rows[0];
}

export async function getAdminCustomerHistory({
  customerId,
  actor,
  limit = 50
}) {
  requireAdmin(actor);

  return getCustomerAuditHistory(customerId, limit);
}
