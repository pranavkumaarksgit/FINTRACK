import bcrypt from 'bcryptjs';
import { DEFAULT_CURRENCY } from '../config/currencies.js';

export type AccountType = 'individual' | 'corporate';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  accountType: AccountType;
  corporateId?: string;
  phone?: string;
  currency?: string;
  createdAt: string;
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: number;
  resetPasswordTokenHash?: string;
  resetPasswordExpiresAt?: number;
  passwordChangedAt?: number;
  tokenVersion?: number;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  corporateId?: string;
  phone?: string;
  currency?: string;
  createdAt?: string;
  emailVerified?: boolean;
}

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  corporateId?: string;
  phone: string;
  currency: string;
  createdAt: string;
  emailVerified: boolean;
}

// In-memory prototype store with pre-seeded demo accounts
class UserStore {
  private users: Map<string, User> = new Map();

  constructor() {
    this.seedDemoUsers();
  }

  private seedDemoUsers() {
    // Hash for default dev password: "fintrack2026"
    const salt = bcrypt.genSaltSync(10);
    const demoPasswordHash = bcrypt.hashSync('fintrack2026', salt);

    const individualUser: User = {
      id: 'usr_ind_alex01',
      name: 'Alex Morgan',
      email: 'alex.morgan@fintrack.io',
      passwordHash: demoPasswordHash,
      accountType: 'individual',
      phone: '+91 98765 43210',
      currency: DEFAULT_CURRENCY,
      createdAt: new Date().toISOString(),
      emailVerified: true
    };

    const corporateUser: User = {
      id: 'usr_corp_apex01',
      name: 'Apex Global Enterprises',
      email: 'admin@apexglobal.io',
      corporateId: 'corp_apex_001',
      passwordHash: demoPasswordHash,
      accountType: 'corporate',
      phone: '+91 80 4123 4567',
      currency: DEFAULT_CURRENCY,
      createdAt: new Date().toISOString(),
      emailVerified: true
    };

    this.users.set(individualUser.email.toLowerCase(), individualUser);
    this.users.set(corporateUser.email.toLowerCase(), corporateUser);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.get(email.toLowerCase().trim());
  }

  async findById(id: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return undefined;
  }

  findByIdSync(id: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return undefined;
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    accountType: AccountType;
    corporateId?: string;
    phone?: string;
    currency?: string;
    emailVerified?: boolean;
  }): Promise<User> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Assign a separate internal corporate ID for corporate accounts if needed, keeping customer's email untouched
    const corporateId = data.corporateId || (data.accountType === 'corporate' ? `corp_${Math.random().toString(36).substring(2, 10)}` : undefined);
    const newUser: User = {
      id,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      accountType: data.accountType,
      corporateId,
      phone: data.phone?.trim() || '',
      currency: data.currency ? data.currency.trim().toUpperCase() : DEFAULT_CURRENCY,
      createdAt: new Date().toISOString(),
      emailVerified: data.emailVerified !== undefined ? data.emailVerified : false,
      tokenVersion: 1
    };

    this.users.set(newUser.email, newUser);
    return newUser;
  }

  async updateProfile(
    id: string,
    updates: { name?: string; phone?: string; currency?: string }
  ): Promise<User | undefined> {
    const user = await this.findById(id);
    if (!user) {
      return undefined;
    }
    if (updates.name !== undefined) {
      user.name = updates.name.trim();
    }
    if (updates.phone !== undefined) {
      user.phone = updates.phone.trim();
    }
    if (updates.currency !== undefined) {
      user.currency = updates.currency.trim().toUpperCase();
    }
    return user;
  }

  async setResetPasswordToken(userId: string, tokenHash: string, expiresAt: number): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expiresAt;
    return true;
  }

  async setEmailVerificationToken(userId: string, tokenHash: string, expiresAt: number): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpiresAt = expiresAt;
    return true;
  }

  async findByVerificationTokenHash(tokenHash: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.emailVerificationTokenHash && user.emailVerificationTokenHash === tokenHash) {
        return user;
      }
    }
    return undefined;
  }

  async verifyUserEmail(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;
    user.emailVerified = true;
    delete user.emailVerificationTokenHash;
    delete user.emailVerificationExpiresAt;
    return true;
  }

  async clearEmailVerificationToken(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    delete user.emailVerificationTokenHash;
    delete user.emailVerificationExpiresAt;
  }

  async findByResetTokenHash(tokenHash: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.resetPasswordTokenHash && user.resetPasswordTokenHash === tokenHash) {
        return user;
      }
    }
    return undefined;
  }

  async resetPassword(userId: string, newPasswordHash: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;
    user.passwordHash = newPasswordHash;
    user.emailVerified = true;
    delete user.resetPasswordTokenHash;
    delete user.resetPasswordExpiresAt;
    user.passwordChangedAt = Date.now();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    return true;
  }

  async clearResetPasswordToken(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    delete user.resetPasswordTokenHash;
    delete user.resetPasswordExpiresAt;
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      corporateId: user.corporateId,
      phone: user.phone || '',
      currency: user.currency || DEFAULT_CURRENCY,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified !== false
    };
  }

  toUserProfile(user: User): UserProfileResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      corporateId: user.corporateId,
      phone: user.phone || '',
      currency: user.currency || DEFAULT_CURRENCY,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified !== false
    };
  }
}

export const userStore = new UserStore();
