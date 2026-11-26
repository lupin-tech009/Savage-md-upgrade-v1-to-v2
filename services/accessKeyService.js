
import { newSecret } from '../security.js';

import {
  issueAccessKey,
  redeemAccessKey
} from '../repositories/accessKeyRepository.js';

import {
  recordAudit
} from '../repositories/auditRepository.js';

import {
  getCustomerById
} from '../repositories/customerRepository.js';

export async function generateCustomerAccessKey({
  customerId,
  actor
}) {
  if (
    typeof customerId !== 'string' ||
    !customerId.trim()
  ) {
    throw new Error('A valid customer ID is required.');
  }

  if (typeof actor !== 'string' || !actor.trim()) {
    throw new Error('An authorized administrator is required.');
  }

  const customer = await getCustomerById(customerId);

  if (!customer) {
    throw new Error('Customer account not found.');
  }

  if (customer.payment_status !== 'verified') {
    throw new Error(
      'Payment must be verified before issuing an access key.'
    );
  }

  // Generate a strong random key.
  // The repository stores only its hash.
  const rawKey = newSecret(48);

  const issuedKey = await issueAccessKey(
    customerId,
    rawKey,
    actor
  );

  await recordAudit({
    actor,
    action: 'access_key_issued',
    customerId,
    details: {
      accessKeyRecordId: issuedKey.id,
      issued: true
    }
  });

  // The raw key is returned once to the authorized caller.
  // Never log it or store it in the database.
  return {
    accessKey: rawKey,
    issuedAt: issuedKey.issued_at
  };
}

export async function activateCustomerWithAccessKey(rawKey) {
  const customer = await redeemAccessKey(rawKey);

  await recordAudit({
    actor: 'customer',
    action: 'access_key_redeemed',
    customerId: customer.id,
    details: {
      username: customer.username,
      subscriptionActivated: true
    }
  });

  return customer;
}
