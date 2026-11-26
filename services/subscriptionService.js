
import {
  getSubscription,
  expireSubscriptions,
  renewSubscription
} from '../repositories/subscriptionRepository.js';

import {
  recordAudit
} from '../repositories/auditRepository.js';

export async function checkCustomerSubscription(customerId) {
  if (
    typeof customerId !== 'string' ||
    !customerId.trim()
  ) {
    throw new Error('A valid customer ID is required.');
  }

  const subscription = await getSubscription(customerId);

  if (!subscription) {
    return null;
  }

  return {
    ...subscription,
    isActive:
      subscription.subscription_status === 'active' &&
      subscription.subscription_expires_at !== null &&
      new Date(subscription.subscription_expires_at).getTime() > Date.now()
  };
}

export async function processExpiredSubscriptions() {
  const expired = await expireSubscriptions();

  for (const customer of expired) {
    await recordAudit({
      actor: 'system',
      action: 'subscription_expired',
      customerId: customer.id,
      details: {
        username: customer.username
      }
    });
  }

  return expired.length;
}

export async function renewCustomerSubscription({
  customerId,
  paymentId,
  actor
}) {
  if (
    typeof customerId !== 'string' ||
    !customerId.trim()
  ) {
    throw new Error('A valid customer ID is required.');
  }

  if (
    typeof paymentId !== 'string' ||
    !paymentId.trim()
  ) {
    throw new Error('A valid payment ID is required.');
  }

  if (typeof actor !== 'string' || !actor.trim()) {
    throw new Error('An authorized administrator is required.');
  }

  const subscription = await renewSubscription(
    customerId,
    paymentId
  );

  await recordAudit({
    actor,
    action: 'subscription_renewed',
    customerId,
    details: {
      paymentId,
      username: subscription.username,
      expiresAt: subscription.subscription_expires_at
    }
  });

  return subscription;
}
