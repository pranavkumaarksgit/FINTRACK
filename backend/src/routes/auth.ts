import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { userStore, AccountType } from '../models/userStore.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';

const router = Router();

function getJwtSecret(): string {
  return process.env.JWT_SECRET_KEY || 'fintrack_default_jwt_secret_dev';
}

function getJwtExpiresIn(): any {
  return process.env.ACCESS_TOKEN_EXPIRE_MINUTES
    ? `${process.env.ACCESS_TOKEN_EXPIRE_MINUTES}m`
    : '60m';
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  // Reject internal identifiers (e.g. corp_xxx, usr_xxx) mistakenly passed as emails
  if (/^(corp|usr|tkt|tx|ntf)_[a-zA-Z0-9]+$/i.test(trimmed)) {
    return false;
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, accountType } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Validate email
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters'
      });
    }

    // Validate accountType
    const normalizedAccountType = (accountType || 'individual').toString().toLowerCase() as AccountType;
    if (normalizedAccountType !== 'individual' && normalizedAccountType !== 'corporate') {
      return res.status(400).json({
        success: false,
        message: 'accountType must be either "individual" or "corporate"'
      });
    }

    // Check duplicate email
    const existingUser = await userStore.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user with actual registered email (defaults to emailVerified: false)
    const newUser = await userStore.create({
      name,
      email: normalizedEmail,
      passwordHash,
      accountType: normalizedAccountType,
      emailVerified: false
    });

    // Generate secure 32-byte cryptographically random verification token (64 hex chars)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 60 minutes expiration

    console.log(`[Token Creation - Register] User email: ${newUser.email}, token hash: ${tokenHash}, expiry timestamp: ${expiresAt}`);

    await userStore.setEmailVerificationToken(newUser.id, tokenHash, expiresAt);

    // Send verification email to the customer's actual registered email address
    try {
      await sendVerificationEmail(newUser.email, verificationToken);
      console.log(`[Register] Verification email dispatched to recipient: ${newUser.email}`);
    } catch (emailErr: any) {
      console.warn(`[Register] Email sending failed: ${emailErr.message}`);
    }

    const userResponse = userStore.toUserResponse(newUser);

    // Sign JWT
    const token = jwt.sign(
      {
        id: userResponse.id,
        name: userResponse.name,
        email: userResponse.email,
        accountType: userResponse.accountType,
        tokenVersion: newUser.tokenVersion || 1
      },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() }
    );

    const responsePayload: { success: boolean; message: string; user: any; token: string; requiresVerification: boolean; [key: string]: any } = {
      success: true,
      message: 'Registration successful! A verification email has been sent to your email address.',
      user: userResponse,
      token,
      requiresVerification: true
    };

    // Safe dev mechanism for automated testing (never exposed in production)
    if (process.env.NODE_ENV !== 'production') {
      responsePayload._devVerificationToken = verificationToken;
      responsePayload.verificationToken = verificationToken;
    }

    return res.status(201).json(responsePayload);
  } catch (error: any) {
    console.error('[Register Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await userStore.findByEmail(email);
    if (!user) {
      // Do not reveal whether email exists
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check email verification status
    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message: 'Please verify your email address before signing in.'
      });
    }

    const userResponse = userStore.toUserResponse(user);

    const token = jwt.sign(
      {
        id: userResponse.id,
        name: userResponse.name,
        email: userResponse.email,
        accountType: userResponse.accountType,
        tokenVersion: user.tokenVersion || 1
      },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error: any) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const user = await userStore.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: userStore.toUserResponse(user)
    });
  } catch (error: any) {
    console.error('[Auth/Me Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await userStore.findByEmail(normalizedEmail);

    let resetToken: string | null = null;

    if (user) {
      // Generate secure 32-byte cryptographically random token (64 hex characters)
      resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Reset token expires in 20 minutes
      const expiresAt = Date.now() + 20 * 60 * 1000;

      await userStore.setResetPasswordToken(user.id, tokenHash, expiresAt);

      // Send password reset email via Nodemailer
      try {
        await sendPasswordResetEmail(user.email, resetToken);
        console.log(`[Forgot-Password] Reset email sent to ${user.email}`);
      } catch (emailErr: any) {
        console.warn(`[Forgot-Password] Email sending failed: ${emailErr.message}`);
      }
    }

    // Generic response preventing email enumeration
    const responsePayload: { success: boolean; message: string; [key: string]: any } = {
      success: true,
      message: 'If an account exists for this email, password reset instructions have been sent.'
    };

    // Safe development prototype mechanism (never exposed in production)
    if (process.env.NODE_ENV !== 'production' && user && resetToken) {
      responsePayload._devResetToken = resetToken;
      responsePayload.resetToken = resetToken;
      responsePayload._devResetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    }

    return res.status(200).json(responsePayload);
  } catch (error: any) {
    console.error('[Forgot-Password Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing password reset request'
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // Validate reset token
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token.'
      });
    }

    // Validate new password rules (reuse existing rule: minimum 6 characters)
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters'
      });
    }

    // Hash provided token with SHA-256 to match stored hash
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Find user by reset token hash
    const user = await userStore.findByResetTokenHash(tokenHash);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token.'
      });
    }

    // Verify token expiration
    if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < Date.now()) {
      await userStore.clearResetPasswordToken(user.id);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token.'
      });
    }

    // Hash new password using existing bcrypt system
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Invalidate reset token immediately and update password
    await userStore.resetPassword(user.id, newPasswordHash);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error: any) {
    console.error('[Reset-Password Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during password reset'
    });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const tokenReceived = Boolean(token && typeof token === 'string' && token.trim().length > 0);
    const tokenLength = tokenReceived ? (token as string).trim().length : 0;
    const tokenHash = tokenReceived
      ? crypto.createHash('sha256').update((token as string).trim()).digest('hex')
      : 'N/A';

    console.log(`[Verify-Email] Token received: ${tokenReceived}, length: ${tokenLength}, SHA-256 hash: ${tokenHash}`);

    // Validate verification token
    if (!tokenReceived) {
      console.log(`[Verify-Email] Token was not received or is empty.`);
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid or has expired.'
      });
    }

    // Find user by verification token hash
    const user = await userStore.findByVerificationTokenHash(tokenHash);
    const matchingUserFound = Boolean(user);
    const expiryExists = Boolean(user?.emailVerificationExpiresAt);
    const currentTimestamp = Date.now();
    const expiryTimestamp = user?.emailVerificationExpiresAt || null;
    const isExpired = expiryExists ? currentTimestamp > (expiryTimestamp as number) : false;

    console.log(`[Verify-Email] Matching user found: ${matchingUserFound}, expiry exists: ${expiryExists}, expired: ${isExpired}, current timestamp: ${currentTimestamp}, expiry timestamp: ${expiryTimestamp}`);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid or has expired.'
      });
    }

    // Verify token expiration
    if (!user.emailVerificationExpiresAt || isExpired) {
      await userStore.clearEmailVerificationToken(user.id);
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid or has expired.'
      });
    }

    // Mark email as verified and invalidate token
    await userStore.verifyUserEmail(user.id);
    console.log(`[Verify-Email] User ${user.email} marked verified and token successfully invalidated.`);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now sign in.'
    });
  } catch (error: any) {
    console.error('[Verify-Email Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during email verification'
    });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await userStore.findByEmail(normalizedEmail);

    let newVerificationToken: string | null = null;

    if (user && user.emailVerified === false) {
      // Invalidate previous token and generate new secure 32-byte token
      newVerificationToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(newVerificationToken).digest('hex');
      const expiresAt = Date.now() + 60 * 60 * 1000; // 60 minutes expiration

      console.log(`[Token Creation - Resend] User email: ${user.email}, token hash: ${tokenHash}, expiry timestamp: ${expiresAt}`);

      await userStore.setEmailVerificationToken(user.id, tokenHash, expiresAt);

      // Send verification email via Nodemailer
      try {
        await sendVerificationEmail(user.email, newVerificationToken);
        console.log(`[Resend-Verification] Verification email sent to ${user.email}`);
      } catch (emailErr: any) {
        console.warn(`[Resend-Verification] Email sending failed: ${emailErr.message}`);
      }
    }

    // Generic response preventing email enumeration and advising to use the newest email
    const responsePayload: { success: boolean; message: string; [key: string]: any } = {
      success: true,
      message: 'If an unverified account exists with this email, a fresh verification link has been sent. Please check your inbox and use the newest email (previous links are invalidated).'
    };

    // Safe dev mechanism for automated testing (never exposed in production)
    if (process.env.NODE_ENV !== 'production' && user && newVerificationToken) {
      responsePayload._devVerificationToken = newVerificationToken;
      responsePayload.verificationToken = newVerificationToken;
    }

    return res.status(200).json(responsePayload);
  } catch (error: any) {
    console.error('[Resend-Verification Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing resend request'
    });
  }
});

export default router;
