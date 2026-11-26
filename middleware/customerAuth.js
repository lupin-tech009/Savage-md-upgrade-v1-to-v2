import { bearerToken } from '../security.js';
import { validateSession } from '../services/authenticationService.js';

export async function customerAuth(req, res, next) {
  try {
    const token = bearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const session = await validateSession(token);

    if (
      !session ||
      session.role !== 'customer' ||
      !session.customer_id
    ) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired customer session.'
      });
    }

    req.auth = {
      sessionId: session.id,
      customerId: session.customer_id,
      role: session.role
    };

    return next();
  } catch (error) {
    return next(error);
  }
 }
