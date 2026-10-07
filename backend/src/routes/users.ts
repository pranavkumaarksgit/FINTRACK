import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { userStore } from '../models/userStore.js';
import { isValidCurrency, SUPPORTED_CURRENCIES } from '../config/currencies.js';

const router = Router();

// Phone validation regex: optional leading +, followed by digits, spaces, hyphens, and parentheses (min 7, max 20 characters)
function isValidPhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // Allowed to clear phone
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,18}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * GET /api/users/profile
 * Returns authenticated user's profile: id, name, email, accountType, phone, currency, createdAt.
 * Sensitive fields (password, passwordHash, secrets) are NEVER returned.
 */
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await userStore.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    const profile = userStore.toUserProfile(user);

    return res.status(200).json({
      success: true,
      profile,
      data: profile
    });
  } catch (error: any) {
    console.error('[Get Profile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile'
    });
  }
});

/**
 * PUT /api/users/profile
 * Updates authenticated user's profile: name, phone, and currency.
 * Email and accountType remain strictly read-only.
 */
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { name, phone, currency } = req.body;

    // Check if at least one updatable field is provided
    if (name === undefined && phone === undefined && currency === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (name, phone, or currency) is required to update profile'
      });
    }

    const updates: { name?: string; phone?: string; currency?: string } = {};

    // Validate Name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must be a valid string of at least 2 characters'
        });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot exceed 100 characters'
        });
      }
      updates.name = name.trim();
    }

    // Validate Phone if provided
    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone must be a valid string'
        });
      }
      const trimmedPhone = phone.trim();
      if (trimmedPhone !== '' && !isValidPhone(trimmedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid phone number (e.g., +91 98765 43210)'
        });
      }
      updates.phone = trimmedPhone;
    }

    // Validate Currency if provided
    if (currency !== undefined) {
      if (typeof currency !== 'string' || !isValidCurrency(currency)) {
        return res.status(400).json({
          success: false,
          message: `Invalid currency code. Supported currencies: ${SUPPORTED_CURRENCIES.map((c) => c.code).join(', ')}`
        });
      }
      updates.currency = currency.trim().toUpperCase();
    }

    const updatedUser = await userStore.updateProfile(userId, updates);
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const profile = userStore.toUserProfile(updatedUser);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile,
      data: profile
    });
  } catch (error: any) {
    console.error('[Update Profile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating profile'
    });
  }
});

export default router;
