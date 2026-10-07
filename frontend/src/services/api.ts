/**
 * FINTRACK Centralized API Client & Auth Services
 *
 * Uses relative `/api` path leveraging the Vite dev server proxy:
 * /api -> http://localhost:8000
 */
import { Transaction } from '../types';

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  [key: string]: any;
}

export interface ApiError {
  message: string;
  status?: number;
  data?: any;
  isNetworkError?: boolean;
}

export interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export type AccountType = 'individual' | 'corporate';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  currency?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  token: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
}

export interface LoginData {
  email: string;
  password: string;
}

// Token Storage Helpers
const TOKEN_STORAGE_KEY = 'fintrack_auth_token';
const USER_STORAGE_KEY = 'fintrack_auth_user';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Graceful fallback for non-storage environments
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Graceful fallback
  }
}

// Default to relative '/api' or environment variable so Vite reverse-proxy handles routing seamlessly
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${normalizedEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Automatically attach Bearer token if available
    const token = getStoredToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkError: any) {
      // Handles network errors: server offline, connection refused, CORS failure
      const error: ApiError = {
        message: networkError?.message || 'Unable to connect to the FINTRACK server. Please ensure the backend is running.',
        isNetworkError: true,
      };
      console.error(`[API Network Error] ${options.method || 'GET'} ${url}:`, error.message);
      throw error;
    }

    // Parse JSON safely
    let responseData: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        const error: ApiError = {
          message: 'Received an invalid JSON response from the server.',
          status: response.status,
        };
        console.error(`[API Parse Error] ${options.method || 'GET'} ${url}:`, error.message);
        throw error;
      }
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    }

    // Handle HTTP errors (4xx, 5xx)
    if (!response.ok) {
      const errorMessage =
        (responseData && typeof responseData === 'object' && (responseData.message || responseData.error)) ||
        `Request failed with status ${response.status} (${response.statusText})`;

      const error: ApiError = {
        message: String(errorMessage),
        status: response.status,
        data: responseData,
      };

      console.error(`[API HTTP Error ${response.status}] ${options.method || 'GET'} ${url}:`, error.message);
      throw error;
    }

    return responseData as T;
  }

  get<T = any>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  post<T = any>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  put<T = any>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  delete<T = any>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  // Health verification helper
  checkHealth(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health');
  }
}

export const api = new ApiClient();
export const checkHealth = (): Promise<HealthCheckResponse> => api.checkHealth();

// Authentication API Services
export const authApi = {
  async register(data: RegisterData): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/register', data);
    if (res.token && res.user) {
      setStoredToken(res.token);
      setStoredUser(res.user);
    }
    return res;
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/login', data);
    if (res.token && res.user) {
      setStoredToken(res.token);
      setStoredUser(res.user);
    }
    return res;
  },

  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      return await api.post<{ success: boolean; message: string }>('/auth/logout');
    } finally {
      setStoredToken(null);
      setStoredUser(null);
    }
  },

  async getCurrentUser(): Promise<{ success: boolean; user: AuthUser }> {
    return api.get<{ success: boolean; user: AuthUser }>('/auth/me');
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; [key: string]: any }> {
    return api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return api.post('/auth/reset-password', { token, newPassword });
  },

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    return api.post('/auth/verify-email', { token });
  },

  async resendVerification(email: string): Promise<{ success: boolean; message: string; [key: string]: any }> {
    return api.post('/auth/resend-verification', { email });
  }
};

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  phone: string;
  currency: string;
  createdAt: string;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  currency?: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  profile: UserProfile;
  data?: UserProfile;
}

// User Profile API Services (Step 3)
export const userApi = {
  async getProfile(): Promise<ProfileResponse> {
    return api.get<ProfileResponse>('/users/profile');
  },

  async updateProfile(data: UpdateProfileData): Promise<ProfileResponse> {
    return api.put<ProfileResponse>('/users/profile', data);
  }
};

export interface CreateTransactionData {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  paymentMethod?: string;
  description?: string;
}

export interface UpdateTransactionData {
  amount?: number;
  type?: 'income' | 'expense';
  category?: string;
  date?: string;
  paymentMethod?: string;
  description?: string;
}

export interface TransactionFilterParams {
  type?: 'income' | 'expense' | 'all';
  category?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  count?: number;
  incomeTotal?: number;
  expenseTotal?: number;
  netTotal?: number;
}

export interface TransactionResponse {
  success: boolean;
  message?: string;
  transaction: Transaction;
}

// Transaction API Services (Step 4 & Step 6)
export const transactionApi = {
  async getAll(params?: TransactionFilterParams): Promise<TransactionsResponse> {
    const query = new URLSearchParams();
    if (params?.type && params.type !== 'all') query.set('type', params.type);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.month && params.month !== 'all') query.set('month', params.month);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const queryString = query.toString();
    return api.get<TransactionsResponse>(`/transactions${queryString ? `?${queryString}` : ''}`);
  },

  async getById(id: string): Promise<TransactionResponse> {
    return api.get<TransactionResponse>(`/transactions/${id}`);
  },

  async create(data: CreateTransactionData): Promise<TransactionResponse> {
    return api.post<TransactionResponse>('/transactions', data);
  },

  async update(id: string, data: UpdateTransactionData): Promise<TransactionResponse> {
    return api.put<TransactionResponse>(`/transactions/${id}`, data);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/transactions/${id}`);
  }
};

export interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlySpendingPoint {
  month: string;
  year: number;
  key: string;
  amount: number;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  remainingBalance: number;
  savingsRate: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  expenseByCategory: CategoryExpense[];
  recentTransactions: Transaction[];
  monthlySpending?: MonthlySpendingPoint[];
}

export interface DashboardSummaryResponse {
  success: boolean;
  summary: DashboardSummary;
  totalIncome?: number;
  totalExpenses?: number;
  remainingBalance?: number;
  savingsRate?: number;
  currentMonthIncome?: number;
  currentMonthExpenses?: number;
  expenseByCategory?: CategoryExpense[];
  recentTransactions?: Transaction[];
  monthlySpending?: MonthlySpendingPoint[];
}

// Dashboard API Services (Step 5)
export const dashboardApi = {
  async getSummary(): Promise<DashboardSummaryResponse> {
    return api.get<DashboardSummaryResponse>('/dashboard/summary');
  }
};

export interface AnalyticsResponse {
  success: boolean;
  period: string;
  metrics: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
    discretionaryRatio: number;
    averageMonthlyIncome: number;
    averageMonthlyExpense: number;
    projectedAnnualNet: number;
    netInflowGrowth: number;
    topCategory: { category: string; amount: number; percentage: number };
  };
  monthlyTrends: Array<{
    month: string;
    year: number;
    key: string;
    income: number;
    expense: number;
    net: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

// Analytics API Services (Step 7)
export const analyticsApi = {
  async getMetrics(period: string = '6M'): Promise<AnalyticsResponse> {
    return api.get<AnalyticsResponse>(`/analytics?period=${encodeURIComponent(period)}`);
  }
};

export interface BudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  remainingTotal: number;
  overallPercentage: number;
}

export interface BudgetsResponse {
  success: boolean;
  period: string;
  budgets: any[];
  summary: BudgetSummary;
}

export interface BudgetResponse {
  success: boolean;
  message?: string;
  budget: any;
}

export interface CreateBudgetData {
  category: string;
  amount: number;
  period?: string;
}

export interface UpdateBudgetData {
  category?: string;
  amount?: number;
  period?: string;
}

// Budget API Services (Step 8)
export const budgetApi = {
  async getAll(period?: string): Promise<BudgetsResponse> {
    const query = period ? `?period=${encodeURIComponent(period)}` : '';
    return api.get<BudgetsResponse>(`/budgets${query}`);
  },
  async create(data: CreateBudgetData): Promise<BudgetResponse> {
    return api.post<BudgetResponse>('/budgets', data);
  },
  async update(id: string, data: UpdateBudgetData): Promise<BudgetResponse> {
    return api.put<BudgetResponse>(`/budgets/${id}`, data);
  },
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/budgets/${id}`);
  }
};

export interface AiAdviceData {
  summary: string;
  spendingInsights: string[];
  savingsSuggestions: string[];
  budgetSuggestions: string[];
  alerts: string[];
  actionItems: string[];
}

export interface AiAdviceResponse {
  success: boolean;
  data: AiAdviceData;
  isFallback?: boolean;
  provider?: string;
  message?: string;
}

// AI Advisor API Services (Step 9)
export const aiApi = {
  async getAdvice(): Promise<AiAdviceResponse> {
    return api.post<AiAdviceResponse>('/ai/advice');
  }
};

export type TicketCategory =
  | 'Account'
  | 'Transaction'
  | 'Dashboard'
  | 'Payment'
  | 'Technical Issue'
  | 'Other';

export type TicketPriority = 'Low' | 'Medium' | 'High';

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

export interface UpdateTicketData {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
}

export interface TicketsResponse {
  success: boolean;
  count: number;
  tickets: Ticket[];
  message?: string;
}

export interface TicketResponse {
  success: boolean;
  ticket?: Ticket;
  message?: string;
}

// Support / Ticket API Services (Step 10)
export const supportApi = {
  async getTickets(params?: { status?: string; category?: string; search?: string }): Promise<TicketsResponse> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.search && params.search.trim()) query.set('search', params.search.trim());
    const qStr = query.toString();
    return api.get<TicketsResponse>(`/support/tickets${qStr ? `?${qStr}` : ''}`);
  },

  async getTicket(id: string): Promise<TicketResponse> {
    return api.get<TicketResponse>(`/support/tickets/${encodeURIComponent(id)}`);
  },

  async createTicket(data: CreateTicketData): Promise<TicketResponse> {
    return api.post<TicketResponse>('/support/tickets', data);
  },

  async updateTicket(id: string, data: UpdateTicketData): Promise<TicketResponse> {
    return api.put<TicketResponse>(`/support/tickets/${encodeURIComponent(id)}`, data);
  }
};

export type NotificationType = 'transaction' | 'budget' | 'support' | 'system' | 'ai';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  count: number;
  unreadCount: number;
  notifications: Notification[];
  message?: string;
}

export interface NotificationResponse {
  success: boolean;
  notification?: Notification;
  unreadCount?: number;
  message?: string;
}

export interface MarkAllReadResponse {
  success: boolean;
  message: string;
  updatedCount: number;
  unreadCount: number;
}

export interface DeleteNotificationResponse {
  success: boolean;
  message: string;
  unreadCount: number;
}

// Notifications API Services (Step 11)
export const notificationApi = {
  async getAll(params?: { type?: string; isRead?: boolean }): Promise<NotificationsResponse> {
    const query = new URLSearchParams();
    if (params?.type && params.type !== 'all') query.set('type', params.type);
    if (params?.isRead !== undefined) query.set('isRead', String(params.isRead));
    const qStr = query.toString();
    return api.get<NotificationsResponse>(`/notifications${qStr ? `?${qStr}` : ''}`);
  },

  async markAsRead(id: string): Promise<NotificationResponse> {
    return api.put<NotificationResponse>(`/notifications/${encodeURIComponent(id)}/read`);
  },

  async markAllAsRead(): Promise<MarkAllReadResponse> {
    return api.put<MarkAllReadResponse>('/notifications/read-all');
  },

  async delete(id: string): Promise<DeleteNotificationResponse> {
    return api.delete<DeleteNotificationResponse>(`/notifications/${encodeURIComponent(id)}`);
  }
};

export default api;



