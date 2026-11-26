import { Router } from 'express';

import { customerAuth } from '../middleware/customerAuth.js';
import { subscriptionGuard } from '../middleware/subscriptionGuard.js';
import { getCustomerById } from '../repositories/customerRepository.js';
import { updateCustomerNumbers } from '../repositories/customerRepository.js';

const router = Router();

// Get authenticated customer's account.
router.get('/me', customerAuth, async (req, res, next) => {
  try {
    const customer = await getCustomerById(
      req.auth.customerId
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer account not found.'
      });
    }

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        username: customer.username,
        paymentStatus: customer.payment_status,
        subscriptionStatus: customer.subscription_status,
        subscriptionExpiresAt: customer.subscription_expires_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

// Save the customer's pairing and designated numbers.
router.put(
  '/numbers',
  customerAuth,
  subscriptionGuard,
  async (req, res, next) => {
    try {
      const { pairingNumber, designatedNumber } = req.body || {};

      if (
        typeof pairingNumber !== 'string' ||
        typeof designatedNumber !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Both WhatsApp numbers are required.'
        });
      }

      const customer = await updateCustomerNumbers(
        req.auth.customerId,
        pairingNumber,
        designatedNumber
      );

      return res.json({
        success: true,
        message: 'WhatsApp numbers saved successfully.',
        numbers: {
          pairingNumber: customer.pairing_number,
          designatedNumber: customer.designated_number
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
