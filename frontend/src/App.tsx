import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrency,
  getCurrencyConfig
} from './utils/currency';
import {
  api,
  checkHealth,
  HealthCheckResponse,
  authApi,
  userApi,
  transactionApi,
  dashboardApi,
  analyticsApi,
  budgetApi,
  aiApi,
  AiAdviceData,
  supportApi,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  notificationApi,
  Notification,
  NotificationType,
  AnalyticsResponse,
  BudgetsResponse,
  DashboardSummary,
  UserProfile,
  getStoredToken,
  getStoredUser
} from './services/api';
import {
  LayoutDashboard,
  PlusCircle,
  CreditCard,
  LineChart,
  Wallet,
  Bot,
  HelpCircle,
  User,
  Settings,
  LogOut,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Send,
  Building2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  UploadCloud,
  ChevronRight,
  Search,
  Bell,
  Utensils,
  Copy,
  Check,
  Code2,
  FileText,
  DollarSign,
  PieChart,
  ShieldCheck,
  Zap,
  Mail,
  Phone as PhoneIcon,
  Calendar,
  AlertCircle,
  RefreshCw,
  Save,
  Shield,
  Pencil,
  Trash2,
  X,
  FileDown,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  MessageSquare,
  Clock,
  Tag,
  CheckCheck,
  Inbox,
  KeyRound
} from 'lucide-react';
import { INITIAL_TRANSACTIONS, INITIAL_MESSAGES } from './data';
import { TabType, Transaction, ChatMessage, Budget } from './types';

// Curated palette for the Frosted Glass Donut Chart
const DONUT_COLORS = [
  { text: 'text-emerald-400', bg: 'bg-emerald-400', dot: 'shadow-emerald-400' },
  { text: 'text-indigo-400', bg: 'bg-indigo-400', dot: 'shadow-indigo-400' },
  { text: 'text-purple-400', bg: 'bg-purple-400', dot: 'shadow-purple-400' },
  { text: 'text-teal-400', bg: 'bg-teal-400', dot: 'shadow-teal-400' },
  { text: 'text-amber-400', bg: 'bg-amber-400', dot: 'shadow-amber-400' },
  { text: 'text-rose-400', bg: 'bg-rose-400', dot: 'shadow-rose-400' },
  { text: 'text-cyan-400', bg: 'bg-cyan-400', dot: 'shadow-cyan-400' },
  { text: 'text-blue-400', bg: 'bg-blue-400', dot: 'shadow-blue-400' },
];

function formatRelativeTime(isoStr: string): string {
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

// Module-scoped deduplication sets to survive React StrictMode mount/unmount/remount cycles
const verifiedTokensSession = new Set<string>();
const inFlightTokensSession = new Set<string>();

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [authMode, setAuthMode] = useState<'app' | 'welcome' | 'login' | 'forgot-password' | 'reset-password' | 'verify-email'>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/forgot-password') return 'forgot-password';
      if (pathname === '/reset-password') return 'reset-password';
      if (pathname === '/verify-email') return 'verify-email';
      if (pathname === '/login') return 'login';
    }
    return getStoredToken() ? 'app' : 'welcome';
  });
  const [accountType, setAccountType] = useState<'Individual' | 'Corporate'>('Individual');
  const [showPassword, setShowPassword] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [backendHealth, setBackendHealth] = useState<HealthCheckResponse | null>(null);

  // Authentication & Login Form State
  const [loginEmail, setLoginEmail] = useState('alex.morgan@fintrack.io');
  const [loginPassword, setLoginPassword] = useState('fintrack2026');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registeredEmailNotice, setRegisteredEmailNotice] = useState<string | null>(null);
  const [unverifiedLoginEmail, setUnverifiedLoginEmail] = useState<string | null>(null);

  // Forgot Password Form State (Step 13)
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  // Reset Password Form State (Step 13)
  const [resetToken, setResetToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('token') || '';
    }
    return '';
  });
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Email Verification State
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  // Synchronize browser history and path for /forgot-password, /reset-password, /verify-email, /login
  const navigateAuth = (
    path: string,
    mode: 'app' | 'welcome' | 'login' | 'forgot-password' | 'reset-password' | 'verify-email'
  ) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setAuthMode(mode);
  };

  const runEmailVerification = async (tokenToVerify: string) => {
    const cleanToken = (tokenToVerify || '').trim();
    if (!cleanToken) {
      setVerificationStatus('error');
      setVerificationMessage('This verification link is invalid or has expired.');
      return;
    }

    // If this token was already verified in this session, keep success status
    if (verifiedTokensSession.has(cleanToken)) {
      setVerificationStatus('success');
      setVerificationMessage('Email verified successfully. You can now sign in.');
      return;
    }

    // Guard against duplicate concurrent calls (e.g., React StrictMode double effect execution)
    if (inFlightTokensSession.has(cleanToken)) {
      return;
    }

    inFlightTokensSession.add(cleanToken);
    setVerificationStatus('verifying');

    try {
      const res = await authApi.verifyEmail(cleanToken);
      verifiedTokensSession.add(cleanToken);
      setVerificationStatus('success');
      setVerificationMessage(res.message || 'Email verified successfully. You can now sign in.');
      triggerToast('Email verified successfully!');
    } catch (err: any) {
      // Only set error if not already successfully verified
      if (!verifiedTokensSession.has(cleanToken)) {
        setVerificationStatus('error');
        setVerificationMessage(err.message || 'This verification link is invalid or has expired.');
      }
    } finally {
      inFlightTokensSession.delete(cleanToken);
    }
  };

  useEffect(() => {
    const handleUrlRouting = () => {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');

      if (pathname === '/forgot-password') {
        setAuthMode('forgot-password');
        setForgotError(null);
      } else if (pathname === '/reset-password') {
        setAuthMode('reset-password');
        if (token) setResetToken(token);
        setResetError(null);
        setResetSuccess(null);
      } else if (pathname === '/verify-email') {
        setAuthMode('verify-email');
        if (token) {
          runEmailVerification(token);
        } else {
          setVerificationStatus('error');
          setVerificationMessage('No verification token provided in the link. Please open the link sent to your email.');
        }
      } else if (pathname === '/login') {
        setAuthMode('login');
      } else if (getStoredToken()) {
        setAuthMode('app');
      }
    };

    handleUrlRouting();
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, []);

  // User Profile State (Step 3 & Currency Preference)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState<string>(() => {
    try {
      return localStorage.getItem('fintrack_currency_preference') || DEFAULT_CURRENCY;
    } catch {
      return DEFAULT_CURRENCY;
    }
  });
  const [editCurrency, setEditCurrency] = useState<string>(() => {
    try {
      return localStorage.getItem('fintrack_currency_preference') || DEFAULT_CURRENCY;
    } catch {
      return DEFAULT_CURRENCY;
    }
  });

  // Fetch authenticated user profile
  const loadProfile = async () => {
    const token = getStoredToken();
    if (!token) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await userApi.getProfile();
      const userProfile = res.profile || res.data;
      if (userProfile) {
        setProfile(userProfile);
        setEditName(userProfile.name);
        setEditPhone(userProfile.phone || '');
        const curr = userProfile.currency || DEFAULT_CURRENCY;
        setPreferredCurrency(curr);
        setEditCurrency(curr);
        try {
          localStorage.setItem('fintrack_currency_preference', curr);
        } catch {}
        if (userProfile.accountType) {
          setAccountType(userProfile.accountType === 'corporate' ? 'Corporate' : 'Individual');
        }
      }
    } catch (err: any) {
      console.error('[Profile] Fetch error:', err);
      if (err.status === 401) {
        setProfileError('Your session has expired. Please log in again.');
        handleLogout();
      } else {
        setProfileError(err.message || 'Failed to load user profile. Please try again.');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Quick Currency Change (Dashboard & Header Selector)
  const handleQuickCurrencyChange = async (newCurrency: string) => {
    const trimmed = newCurrency.trim().toUpperCase();
    if (trimmed === preferredCurrency) return;
    setPreferredCurrency(trimmed);
    setEditCurrency(trimmed);
    try {
      localStorage.setItem('fintrack_currency_preference', trimmed);
    } catch {}
    try {
      const res = await userApi.updateProfile({ currency: trimmed });
      const updated = res.profile || res.data;
      if (updated) {
        setProfile(updated);
        triggerToast(`Currency updated to ${trimmed}!`);
      }
    } catch (err: any) {
      console.error('[Quick Currency Update Error]:', err);
      triggerToast('Failed to save currency preference to server');
    }
  };

  // Save profile updates (name, phone, currency)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName || editName.trim().length < 2) {
      setProfileError('Full Name must be at least 2 characters.');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const res = await userApi.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        currency: editCurrency,
      });
      const updated = res.profile || res.data;
      if (updated) {
        setProfile(updated);
        setEditName(updated.name);
        setEditPhone(updated.phone || '');
        const curr = updated.currency || DEFAULT_CURRENCY;
        setPreferredCurrency(curr);
        setEditCurrency(curr);
        try {
          localStorage.setItem('fintrack_currency_preference', curr);
        } catch {}
        setProfileSuccess('Profile details saved successfully!');
        triggerToast('Profile updated successfully!');
        setTimeout(() => setProfileSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('[Profile] Update error:', err);
      if (err.status === 401) {
        setProfileError('Session expired. Please log in again.');
        handleLogout();
      } else if (err.status === 400) {
        setProfileError(err.message || 'Validation error: please check your inputs.');
      } else {
        setProfileError(err.message || 'Failed to update profile.');
      }
    } finally {
      setProfileSaving(false);
    }
  };

  // Login handler connected to authApi
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    setUnverifiedLoginEmail(null);
    try {
      const res = await authApi.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      triggerToast(`Welcome back, ${res.user.name}!`);
      setAuthMode('app');
      // Load user profile, transactions, dashboard, analytics, budgets & notifications
      loadProfile();
      loadTransactions();
      loadDashboardSummary();
      loadAnalytics();
      loadBudgets();
      loadNotifications();
    } catch (err: any) {
      console.error('[Login Error]:', err);
      if (err.status === 403 || err.data?.requiresVerification) {
        setUnverifiedLoginEmail(loginEmail.trim());
        setResendEmail(loginEmail.trim());
        setLoginError(err.message || 'Please verify your email address before signing in.');
      } else {
        setLoginError(err.message || 'Invalid email or password. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Registration handler connected to authApi (Step 12 & Email Verification)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim()) {
      setLoginError('Please enter your full name');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const emailUsed = loginEmail.trim();
      await authApi.register({
        name: registerName.trim(),
        email: emailUsed,
        password: loginPassword,
        accountType: (accountType.toLowerCase() as 'individual' | 'corporate')
      });
      setRegisteredEmailNotice(emailUsed);
      setResendEmail(emailUsed);
      setIsRegistering(false);
      triggerToast('Account created! Verification link sent to your email.');
    } catch (err: any) {
      console.error('[Register Error]:', err);
      setLoginError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Resend Verification Email handler
  const handleResendVerification = async (e?: React.FormEvent, directEmail?: string) => {
    if (e) e.preventDefault();
    const targetEmail = (directEmail || resendEmail || unverifiedLoginEmail || loginEmail || '').trim();
    if (!targetEmail) {
      setResendError('Please enter a valid email address.');
      return;
    }
    setResendLoading(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const res = await authApi.resendVerification(targetEmail);
      setResendSuccess(res.message || 'Verification link has been sent to your email.');
      triggerToast('Verification email sent!');
    } catch (err: any) {
      setResendError(err.message || 'Failed to send verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  // Forgot Password submission handler (Step 13)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = forgotEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    setDevResetToken(null);

    try {
      const res = await authApi.forgotPassword(trimmed);
      setForgotSuccess(res.message || 'If an account exists for this email, you will receive password reset instructions.');
      if (res._devResetToken || res.resetToken) {
        setDevResetToken(res._devResetToken || res.resetToken);
      }
    } catch (err: any) {
      console.error('[Forgot Password Error]:', err);
      // Consistent generic response to prevent email enumeration
      setForgotSuccess('If an account exists for this email, you will receive password reset instructions.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Reset Password submission handler (Step 13)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setResetError('Password reset token is missing. Please use the link sent to your email.');
      return;
    }
    if (!resetNewPassword) {
      setResetError('Please enter a new password.');
      return;
    }
    if (resetNewPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await authApi.resetPassword(resetToken.trim(), resetNewPassword);
      setResetSuccess(res.message || 'Password has been reset successfully. You can now log in with your new password.');
      setResetNewPassword('');
      setResetConfirmPassword('');
      triggerToast('Password reset successfully!');
    } catch (err: any) {
      console.error('[Reset Password Error]:', err);
      setResetError(err.message || 'Invalid or expired password reset token.');
    } finally {
      setResetLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('[Logout]: Cleared client token despite server error:', err);
    }
    setProfile(null);
    setTransactions([]);
    setDashboardSummary(null);
    setAnalyticsData(null);
    setBudgets([]);
    setBudgetSummary(null);
    setAiAdvice(null);
    setAiAdviceError(null);
    setTickets([]);
    setTicketsError(null);
    setViewingTicket(null);
    setEditingTicket(null);
    setNotifications([]);
    setUnreadNotificationCount(0);
    setNotificationsError(null);
    setShowNotificationCenter(false);
    setAuthMode('welcome');
    setCurrentTab('dashboard');
    triggerToast('Logged out successfully.');
  };

  // Transactions State (Step 4)
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [addTxError, setAddTxError] = useState<string | null>(null);

  // Edit Transaction State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>('expense');
  const [editTxCategory, setEditTxCategory] = useState('');
  const [editTxCustomCategory, setEditTxCustomCategory] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxMethod, setEditTxMethod] = useState('UPI / Wallet');
  const [editTxDescription, setEditTxDescription] = useState('');
  const [isUpdatingTx, setIsUpdatingTx] = useState(false);
  const [editTxError, setEditTxError] = useState<string | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Fetch transactions from backend
  const loadTransactions = async () => {
    const token = getStoredToken();
    if (!token) return;
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const res = await transactionApi.getAll();
      if (res.transactions) {
        setTransactions(res.transactions);
      }
    } catch (err: any) {
      console.error('[Transactions] Fetch error:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setTransactionsError(err.message || 'Failed to load transactions');
      }
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Dashboard Summary State (Step 5)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Fetch dashboard summary from backend
  const loadDashboardSummary = async () => {
    const token = getStoredToken();
    if (!token) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await dashboardApi.getSummary();
      const summary = res.summary || (res as unknown as DashboardSummary);
      if (summary) {
        setDashboardSummary(summary);
      }
    } catch (err: any) {
      console.error('[Dashboard] Fetch error:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setDashboardError(err.message || 'Failed to load dashboard summary');
      }
    } finally {
      setDashboardLoading(false);
    }
  };

  // Step 6: Expense Filtering & PDF Export State
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [expenseMonthFilter, setExpenseMonthFilter] = useState<string>('all');
  const [expenseStartDate, setExpenseStartDate] = useState<string>('');
  const [expenseEndDate, setExpenseEndDate] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Step 7: Analytics State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'3M' | '6M' | '1Y' | 'ALL'>('6M');

  // Fetch analytics metrics from backend
  const loadAnalytics = async (period: '3M' | '6M' | '1Y' | 'ALL' = analyticsPeriod) => {
    const token = getStoredToken();
    if (!token) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await analyticsApi.getMetrics(period);
      setAnalyticsData(res);
    } catch (err: any) {
      console.error('[Analytics Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setAnalyticsError(err.message || 'Failed to load analytics metrics');
      }
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Step 8: Budget Management State
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<{
    totalBudgeted: number;
    totalSpent: number;
    remainingTotal: number;
    overallPercentage: number;
  } | null>(null);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsError, setBudgetsError] = useState<string | null>(null);
  const [budgetPeriod, setBudgetPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modal State for Create / Edit Budget
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetCategoryInput, setBudgetCategoryInput] = useState('Food & Dining');
  const [budgetAmountInput, setBudgetAmountInput] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetFormError, setBudgetFormError] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  // Fetch budgets from backend
  const loadBudgets = async (period: string = budgetPeriod) => {
    const token = getStoredToken();
    if (!token) return;
    setBudgetsLoading(true);
    setBudgetsError(null);
    try {
      const res = await budgetApi.getAll(period);
      setBudgets(res.budgets || []);
      setBudgetSummary(res.summary || null);
    } catch (err: any) {
      console.error('[Budgets Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setBudgetsError(err.message || 'Failed to load budgets');
      }
    } finally {
      setBudgetsLoading(false);
    }
  };

  // Step 9: AI Finance Advisor State
  const [aiAdvice, setAiAdvice] = useState<AiAdviceData | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [aiAdviceError, setAiAdviceError] = useState<string | null>(null);
  const [isAdviceFallback, setIsAdviceFallback] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('fallback');

  // Load AI Advice from backend
  const loadAiAdvice = async (force: boolean = false) => {
    const token = getStoredToken();
    if (!token) return;
    if (aiAdvice && !force) return;
    setAiAdviceLoading(true);
    setAiAdviceError(null);
    try {
      const res = await aiApi.getAdvice();
      if (res.data) {
        setAiAdvice(res.data);
        setIsAdviceFallback(!!res.isFallback);
        setAiProvider(res.provider || 'fallback');
        loadNotifications();
      }
    } catch (err: any) {
      console.error('[AI Advice Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setAiAdviceError(err.message || 'Failed to generate financial advice. Please try again.');
      }
    } finally {
      setAiAdviceLoading(false);
    }
  };

  // Step 10: Support / Tickets State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState<string>('');

  // Create Ticket Modal State
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState<TicketCategory>('Technical Issue');
  const [newTicketPriority, setNewTicketPriority] = useState<TicketPriority>('Medium');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [createTicketError, setCreateTicketError] = useState<string | null>(null);

  // View Ticket Details Modal State
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

  // Edit Ticket Modal State
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editTicketSubject, setEditTicketSubject] = useState('');
  const [editTicketCategory, setEditTicketCategory] = useState<TicketCategory>('Technical Issue');
  const [editTicketPriority, setEditTicketPriority] = useState<TicketPriority>('Medium');
  const [editTicketStatus, setEditTicketStatus] = useState<TicketStatus>('Open');
  const [editTicketDescription, setEditTicketDescription] = useState('');
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);
  const [editTicketError, setEditTicketError] = useState<string | null>(null);

  // Load Tickets from backend
  const loadTickets = async () => {
    const token = getStoredToken();
    if (!token) return;
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const res = await supportApi.getTickets({
        status: ticketStatusFilter,
        category: ticketCategoryFilter,
        search: ticketSearchQuery
      });
      setTickets(res.tickets || []);
    } catch (err: any) {
      console.error('[Support Tickets Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setTicketsError(err.message || 'Failed to load support tickets. Please try again.');
      }
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleOpenCreateTicket = () => {
    setNewTicketSubject('');
    setNewTicketCategory('Technical Issue');
    setNewTicketPriority('Medium');
    setNewTicketDescription('');
    setCreateTicketError(null);
    setShowCreateTicketModal(true);
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || newTicketSubject.trim().length < 3) {
      setCreateTicketError('Subject must be at least 3 characters long.');
      return;
    }
    if (!newTicketDescription.trim() || newTicketDescription.trim().length < 5) {
      setCreateTicketError('Description must be at least 5 characters long.');
      return;
    }

    setIsCreatingTicket(true);
    setCreateTicketError(null);
    try {
      const res = await supportApi.createTicket({
        subject: newTicketSubject.trim(),
        description: newTicketDescription.trim(),
        category: newTicketCategory,
        priority: newTicketPriority
      });
      if (res.ticket) {
        setShowCreateTicketModal(false);
        triggerToast('Support ticket created successfully!');
        await loadTickets();
        loadNotifications();
      }
    } catch (err: any) {
      console.error('[Create Ticket Error]:', err);
      setCreateTicketError(err.message || 'Failed to create support ticket. Please check your inputs.');
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const handleOpenEditTicket = (t: Ticket) => {
    setEditingTicket(t);
    setEditTicketSubject(t.subject);
    setEditTicketCategory(t.category);
    setEditTicketPriority(t.priority);
    setEditTicketStatus(t.status);
    setEditTicketDescription(t.description);
    setEditTicketError(null);
  };

  const handleUpdateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    if (!editTicketSubject.trim() || editTicketSubject.trim().length < 3) {
      setEditTicketError('Subject must be at least 3 characters long.');
      return;
    }
    if (!editTicketDescription.trim() || editTicketDescription.trim().length < 5) {
      setEditTicketError('Description must be at least 5 characters long.');
      return;
    }

    setIsUpdatingTicket(true);
    setEditTicketError(null);
    try {
      const res = await supportApi.updateTicket(editingTicket.id, {
        subject: editTicketSubject.trim(),
        description: editTicketDescription.trim(),
        category: editTicketCategory,
        priority: editTicketPriority,
        status: editTicketStatus
      });
      if (res.ticket) {
        if (viewingTicket?.id === editingTicket.id) {
          setViewingTicket(res.ticket);
        }
        setEditingTicket(null);
        triggerToast('Support ticket updated successfully!');
        await loadTickets();
        loadNotifications();
      }
    } catch (err: any) {
      console.error('[Update Ticket Error]:', err);
      setEditTicketError(err.message || 'Failed to update support ticket.');
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const handleQuickStatusChange = async (t: Ticket, newStatus: TicketStatus) => {
    try {
      const res = await supportApi.updateTicket(t.id, { status: newStatus });
      if (res.ticket) {
        if (viewingTicket?.id === t.id) {
          setViewingTicket(res.ticket);
        }
        triggerToast(`Ticket status updated to ${newStatus}`);
        await loadTickets();
        loadNotifications();
      }
    } catch (err: any) {
      console.error('[Quick Status Error]:', err);
      triggerToast('Failed to update ticket status: ' + (err.message || 'Unknown error'));
    }
  };

  // Step 11: Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | NotificationType>('all');

  // Load Notifications from backend
  const loadNotifications = async () => {
    const token = getStoredToken();
    if (!token) return;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const res = await notificationApi.getAll();
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadNotificationCount(res.unreadCount || 0);
      }
    } catch (err: any) {
      console.error('[Notifications Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setNotificationsError(err?.message || 'Failed to load notifications');
      }
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      const res = await notificationApi.markAsRead(id);
      if (res.success && res.notification) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadNotificationCount(res.unreadCount ?? Math.max(0, unreadNotificationCount - 1));
      }
    } catch (err: any) {
      console.error('[Mark Read Error]:', err);
      triggerToast('Failed to mark notification as read');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await notificationApi.markAllAsRead();
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadNotificationCount(0);
        triggerToast('All notifications marked as read');
      }
    } catch (err: any) {
      console.error('[Mark All Read Error]:', err);
      triggerToast('Failed to mark all notifications as read');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await notificationApi.delete(id);
      if (res.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (res.unreadCount !== undefined) {
          setUnreadNotificationCount(res.unreadCount);
        }
        triggerToast('Notification deleted');
      }
    } catch (err: any) {
      console.error('[Delete Notification Error]:', err);
      triggerToast('Failed to delete notification');
    }
  };

  // Verify backend health and restore session on mount
  useEffect(() => {
    checkHealth()
      .then((res) => {
        setBackendHealth(res);
        console.log('[FINTRACK Connection Test] ✅ Backend connected:', res);
      })
      .catch((err) => {
        console.error('[FINTRACK Connection Test] ❌ Backend connection failed:', err);
      });

    const token = getStoredToken();
    if (token) {
      loadProfile();
      loadTransactions();
      loadDashboardSummary();
      loadAnalytics();
      loadBudgets();
      loadNotifications();
    }
  }, []);

  // Reload data whenever user navigates tabs
  useEffect(() => {
    if (authMode === 'app') {
      if (currentTab === 'profile') {
        loadProfile();
      } else if (currentTab === 'dashboard') {
        loadDashboardSummary();
      } else if (currentTab === 'expenses') {
        loadTransactions();
      } else if (currentTab === 'analytics') {
        loadAnalytics();
      } else if (currentTab === 'budget') {
        loadBudgets();
      } else if (currentTab === 'ai-advisor') {
        loadAiAdvice();
      } else if (currentTab === 'support') {
        loadTickets();
      } else if (currentTab === 'notifications') {
        loadNotifications();
      }
    }
  }, [currentTab, authMode]);

  // Reload tickets when filter/search changes if on support tab
  useEffect(() => {
    if (authMode === 'app' && currentTab === 'support') {
      loadTickets();
    }
  }, [ticketStatusFilter, ticketCategoryFilter, ticketSearchQuery]);

  // Form State for Add Transaction
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [customCategory, setCustomCategory] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI / Wallet');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<string | null>(null);

  // Account-tailored Categories (Individual vs Corporate)
  // Account-tailored Categories (Individual vs Corporate)
  const isCorporate = (profile?.accountType || accountType).toLowerCase() === 'corporate';

  const getCategoryOptions = (corp: boolean, type: 'income' | 'expense') => {
    if (corp) {
      return type === 'income'
        ? [
            { value: 'Client Retainers', label: 'Client Retainers & Contracts' },
            { value: 'Sales Revenue', label: 'Enterprise Sales & Revenue' },
            { value: 'Investment Returns', label: 'Treasury & Investment Yield' },
            { value: 'Consulting & Advisory', label: 'Consulting & Professional Fees' },
            { value: 'Grants & Subsidies', label: 'Corporate Grants & Subsidies' },
            { value: 'others', label: 'Others / Custom Inflow...' },
          ]
        : [
            { value: 'Software & Cloud Infrastructure', label: 'Software & Cloud Infrastructure' },
            { value: 'Office Lease & Facilities', label: 'Office Lease & Real Estate' },
            { value: 'Payroll & Staff Compensation', label: 'Payroll & Staff Compensation' },
            { value: 'Marketing & Advertising', label: 'Marketing & Growth Campaigns' },
            { value: 'Professional & Legal Services', label: 'Legal, Tax & Advisory' },
            { value: 'Travel & Corporate Entertainment', label: 'Business Travel & Entertainment' },
            { value: 'Hardware & Equipment', label: 'Hardware & Capital Equipment' },
            { value: 'Utilities & Telecom', label: 'Utilities & Telecommunications' },
            { value: 'others', label: 'Others / Custom Expense...' },
          ];
    }
    return type === 'income'
      ? [
          { value: 'Salary & Income', label: 'Salary & Primary Income' },
          { value: 'Freelance & Contract', label: 'Freelance & Side Projects' },
          { value: 'Investments & Dividends', label: 'Investments & Dividends' },
          { value: 'Rental Income', label: 'Rental & Property Income' },
          { value: 'Gifts & Refunds', label: 'Gifts, Cashbacks & Refunds' },
          { value: 'others', label: 'Others / Custom Inflow...' },
        ]
      : [
          { value: 'Food & Dining', label: 'Food & Dining (Groceries, Restaurants)' },
          { value: 'Housing & Rent', label: 'Housing & Rent' },
          { value: 'Transportation & Fuel', label: 'Transportation & Commute' },
          { value: 'Utilities & Bills', label: 'Utilities & Household Bills' },
          { value: 'Shopping & Discretionary', label: 'Shopping & Personal Goods' },
          { value: 'Entertainment & Leisure', label: 'Entertainment & Subscriptions' },
          { value: 'Healthcare & Fitness', label: 'Healthcare & Fitness' },
          { value: 'Education & Learning', label: 'Education & Career Courses' },
          { value: 'others', label: 'Others / Custom Expense...' },
        ];
  };

  const categoryOptions = getCategoryOptions(isCorporate, txType);
  const editCategoryOptions = getCategoryOptions(isCorporate, editTxType);

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  // Effective Dashboard metrics: preferred from backend API, gracefully fall back to local store
  const effectiveIncome = dashboardSummary ? dashboardSummary.totalIncome : totalIncome;
  const effectiveExpense = dashboardSummary ? dashboardSummary.totalExpenses : totalExpense;
  const effectiveBalance = dashboardSummary ? dashboardSummary.remainingBalance : balance;
  const effectiveSavingsRate = dashboardSummary ? dashboardSummary.savingsRate : savingsRate;

  // Donut slices for dynamic category breakdown
  const categoryBreakdown = dashboardSummary?.expenseByCategory && dashboardSummary.expenseByCategory.length > 0
    ? dashboardSummary.expenseByCategory
    : (effectiveExpense > 0
        ? [{ category: 'General Expenses', amount: effectiveExpense, percentage: 100 }]
        : []);

  let accumulatedDonutPct = 0;
  const donutSlices = categoryBreakdown.map((item, idx) => {
    const offset = accumulatedDonutPct;
    accumulatedDonutPct += item.percentage;
    return {
      ...item,
      offset,
      color: DONUT_COLORS[idx % DONUT_COLORS.length]
    };
  });

  const recentTxs = dashboardSummary
    ? dashboardSummary.recentTransactions
    : transactions.slice(0, 5);

  // Monthly spending bar chart items
  const monthlySpendingData = dashboardSummary?.monthlySpending || [];
  const maxMonthlySpend = Math.max(...monthlySpendingData.map((m) => m.amount), 1);
  const barColors = [
    'bg-emerald-400/80',
    'bg-indigo-400/80',
    'bg-teal-400/90',
    'bg-cyan-400/80',
    'bg-emerald-400/80',
    'bg-indigo-400/80',
  ];

  // Step 6: Computed filtered transactions and totals
  const filteredTransactions = transactions.filter((t) => {
    if (expenseTypeFilter !== 'all' && t.type !== expenseTypeFilter) return false;
    if (expenseCategoryFilter !== 'all' && (t.category || '').toLowerCase() !== expenseCategoryFilter.toLowerCase()) return false;
    if (expenseMonthFilter !== 'all' && t.date && t.date.slice(0, 7) !== expenseMonthFilter) return false;
    if (expenseStartDate && t.date && t.date < expenseStartDate) return false;
    if (expenseEndDate && t.date && t.date > expenseEndDate) return false;
    return true;
  });

  const filteredIncomeTotal = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredExpenseTotal = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredNetBalance = filteredIncomeTotal - filteredExpenseTotal;

  // Available unique categories for filtering
  const availableCategories = Array.from(
    new Set([
      ...transactions.map((t) => t.category).filter(Boolean),
      ...getCategoryOptions(isCorporate, 'expense').map((c) => c.value).filter((v) => v !== 'others'),
      ...getCategoryOptions(isCorporate, 'income').map((c) => c.value).filter((v) => v !== 'others')
    ])
  );

  // Available months from transactions
  const availableMonths = Array.from(
    new Set(transactions.map((t) => t.date?.slice(0, 7)).filter(Boolean) as string[])
  ).sort().reverse();

  // Step 6: PDF Export Functionality
  const handleExportPdf = () => {
    if (filteredTransactions.length === 0) {
      triggerToast('No transactions found to export.');
      return;
    }

    try {
      setIsExportingPdf(true);
      const doc = new jsPDF();
      const userName = profile?.name || 'FINTRACK User';
      const userType = (profile?.accountType || accountType).toUpperCase();
      const generatedAt = new Date().toLocaleString('en-IN');

      // Title & Branding banner
      doc.setFillColor(2, 6, 23); // dark canvas #020617
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text('FINTRACK', 14, 18);

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('FINANCIAL EXPENSE & ACTIVITY REPORT', 14, 25);
      doc.text(`Account: ${userName} (${userType}) | Generated: ${generatedAt}`, 14, 32);

      // Period & Summary Header
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(`Filter Scope: ${expenseMonthFilter !== 'all' ? `Month: ${expenseMonthFilter}` : 'All Months'} | Type: ${expenseTypeFilter.toUpperCase()} | Category: ${expenseCategoryFilter}`, 14, 46);

      // Summary Table
      autoTable(doc, {
        startY: 50,
        theme: 'plain',
        body: [
          [
            `Total Records: ${filteredTransactions.length}`,
            `Total Inflow: ${formatCurrency(filteredIncomeTotal, preferredCurrency)}`,
            `Total Outflow: ${formatCurrency(filteredExpenseTotal, preferredCurrency)}`,
            `Net Balance: ${formatCurrency(filteredNetBalance, preferredCurrency)}`
          ]
        ],
        styles: { fontSize: 8.5, fontStyle: 'bold', textColor: [30, 41, 59] }
      });

      // Itemized Transactions Table
      const tableRows = filteredTransactions.map((t) => [
        t.date || '—',
        t.description || '—',
        t.category || 'Uncategorized',
        t.paymentMethod || t.method || 'Other',
        t.type.toUpperCase(),
        `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, preferredCurrency)}`
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 4,
        head: [['Date', 'Description', 'Category', 'Payment Method', 'Type', 'Amount']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          5: { halign: 'right', fontStyle: 'bold' }
        }
      });

      const pageCount = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `FINTRACK Confidential Financial Statement — Page ${i} of ${pageCount}`,
          14,
          doc.internal.pageSize.height - 8
        );
      }

      const fileName = `fintrack-report-${expenseMonthFilter !== 'all' ? expenseMonthFilter : 'ledger'}.pdf`;
      doc.save(fileName);
      triggerToast('PDF report downloaded successfully!');
    } catch (err: any) {
      console.error('[PDF Export Error]:', err);
      triggerToast('Failed to generate PDF report: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Step 8: Budget Management Handlers
  const handleOpenCreateBudget = () => {
    setEditingBudget(null);
    setBudgetCategoryInput(isCorporate ? 'Software & Cloud Infrastructure' : 'Food & Dining');
    setBudgetAmountInput('');
    setBudgetFormError(null);
    setShowBudgetModal(true);
  };

  const handleOpenEditBudget = (b: Budget) => {
    setEditingBudget(b);
    setBudgetCategoryInput(b.category);
    setBudgetAmountInput(String(b.amount));
    setBudgetFormError(null);
    setShowBudgetModal(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(budgetAmountInput);
    if (!parsedAmount || parsedAmount <= 0) {
      setBudgetFormError('Please specify a positive budget limit amount.');
      return;
    }

    setBudgetSaving(true);
    setBudgetFormError(null);
    try {
      if (editingBudget) {
        await budgetApi.update(editingBudget.id, {
          category: budgetCategoryInput,
          amount: parsedAmount,
          period: budgetPeriod
        });
        triggerToast('Budget limit updated successfully!');
      } else {
        await budgetApi.create({
          category: budgetCategoryInput,
          amount: parsedAmount,
          period: budgetPeriod
        });
        triggerToast('New budget established successfully!');
      }
      setShowBudgetModal(false);
      await loadBudgets();
    } catch (err: any) {
      console.error('[Save Budget Error]:', err);
      setBudgetFormError(err.message || 'Failed to save budget.');
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget limit?')) return;
    setDeletingBudgetId(id);
    try {
      await budgetApi.delete(id);
      triggerToast('Budget deleted.');
      await loadBudgets();
    } catch (err: any) {
      console.error('[Delete Budget Error]:', err);
      triggerToast(err.message || 'Failed to delete budget.');
    } finally {
      setDeletingBudgetId(null);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setAddTxError('Please enter a valid amount greater than 0.');
      return;
    }

    const finalCategory = category === 'others'
      ? (customCategory.trim() || 'Others')
      : category;

    if (!finalCategory) {
      setAddTxError('Please select or specify a category.');
      return;
    }

    setIsSubmittingTx(true);
    setAddTxError(null);

    try {
      await transactionApi.create({
        amount: parsedAmount,
        type: txType,
        category: finalCategory,
        date: txDate,
        paymentMethod,
        description: description.trim()
      });

      triggerToast(`Successfully recorded ${formatCurrency(parsedAmount, preferredCurrency)} ${txType}!`);
      setAmount('');
      setDescription('');
      setCustomCategory('');
      setReceiptFile(null);
      await loadTransactions();
      await loadDashboardSummary();
      loadAnalytics();
      loadBudgets();
      loadNotifications();
      setCurrentTab('expenses');
    } catch (err: any) {
      console.error('[Transaction Create Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setAddTxError(err.message || 'Failed to create transaction. Please check your inputs.');
      }
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTxAmount(String(tx.amount));
    setEditTxType(tx.type);
    const standardOpts = getCategoryOptions(isCorporate, tx.type);
    const isStandard = standardOpts.some((o) => o.value === tx.category);
    if (isStandard) {
      setEditTxCategory(tx.category);
      setEditTxCustomCategory('');
    } else {
      setEditTxCategory('others');
      setEditTxCustomCategory(tx.category);
    }
    setEditTxDate(tx.date.includes('T') ? tx.date.split('T')[0] : tx.date);
    setEditTxMethod(tx.paymentMethod || tx.method || 'UPI / Wallet');
    setEditTxDescription(tx.description || '');
    setEditTxError(null);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const parsedAmount = parseFloat(editTxAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setEditTxError('Please enter a valid amount greater than 0.');
      return;
    }

    const finalCategory = editTxCategory === 'others'
      ? (editTxCustomCategory.trim() || 'Others')
      : editTxCategory;

    setIsUpdatingTx(true);
    setEditTxError(null);

    try {
      await transactionApi.update(editingTx.id, {
        amount: parsedAmount,
        type: editTxType,
        category: finalCategory,
        date: editTxDate,
        paymentMethod: editTxMethod,
        description: editTxDescription.trim()
      });

      triggerToast('Transaction updated successfully!');
      setEditingTx(null);
      await loadTransactions();
      await loadDashboardSummary();
      loadAnalytics();
      loadBudgets();
    } catch (err: any) {
      console.error('[Transaction Update Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        setEditTxError(err.message || 'Failed to update transaction.');
      }
    } finally {
      setIsUpdatingTx(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    setDeletingTxId(id);
    try {
      await transactionApi.delete(id);
      triggerToast('Transaction deleted successfully.');
      setTransactions(prev => prev.filter(t => t.id !== id));
      loadDashboardSummary();
      loadAnalytics();
      loadBudgets();
    } catch (err: any) {
      console.error('[Transaction Delete Error]:', err);
      if (err.status === 401) {
        handleLogout();
      } else {
        triggerToast(err.message || 'Failed to delete transaction.');
      }
    } finally {
      setDeletingTxId(null);
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isAiTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!textToSend) setInputMessage('');

    setIsAiTyping(true);
    api.post('/chat', {
      message: text.trim(),
      history: newMessages.map(m => ({
        sender: m.sender,
        text: m.text,
        bullets: m.bullets,
        note: m.note
      })),
      financialData: {
        transactions,
        balance,
        totalIncome,
        totalExpense,
        savingsRate
      }
    })
      .then((data: any) => {
        const aiReply: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          sender: 'ai',
          text: data.text,
          bullets: data.bullets,
          note: data.note,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, aiReply]);
      })
      .catch(err => {
        console.error('[API Error]', err);
        triggerToast('Failed to connect to Fintrack AI');
      })
      .finally(() => {
        setIsAiTyping(false);
      });
  };

  const copyPromptText = () => {
    navigator.clipboard.writeText(MASTER_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2500);
  };

  // Welcome / Login Screen
  if (authMode !== 'app') {
    return (
      <div className="bg-[#020617] text-slate-200 font-sans h-screen w-full flex overflow-hidden relative">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/30 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/20 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-[25%] right-[20%] w-[35%] h-[35%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

        {/* Left Hero Section */}
        <div className="hidden lg:flex w-1/2 bg-white/5 backdrop-blur-2xl relative flex-col justify-between p-12 overflow-hidden border-r border-white/10 z-10">
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 bg-gradient-to-tr from-indigo-500 to-emerald-400 rounded-2xl flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-lg shadow-indigo-500/30 border border-white/20">
                <span className="text-emerald-200">F</span>T
              </div>
              <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                FINTRACK
              </span>
            </div>
            
            <span className="inline-block px-3.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold mb-4 tracking-wider">
              FINANCIAL INTELLIGENCE v4.0
            </span>

            <h1 className="text-5xl font-extrabold text-white tracking-tight leading-tight max-w-md">
              Track. Analyze. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-teal-300 to-emerald-400">
                Grow with clarity.
              </span>
            </h1>
            <p className="text-base text-slate-400 mt-5 max-w-md leading-relaxed">
              The institutional-grade platform with frosted glass clarity for managing your financial trajectory with absolute precision.
            </p>
          </div>

          {/* Visual Presentation Card */}
          <div className="relative z-10 mt-auto rounded-3xl overflow-hidden border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">Live Portfolio Analysis</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                +24.8% YTD
              </span>
            </div>
            <div className="py-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-[11px] text-slate-400 font-mono uppercase">TRACKED</div>
                <div className="text-xl font-bold text-white mt-0.5">₹12.4M+</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-mono uppercase">EFFICIENCY</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">99.4%</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-mono uppercase">INSIGHTS</div>
                <div className="text-xl font-bold text-indigo-300 mt-0.5">Real-time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Interaction Section */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative z-10">
          <div className="w-full max-w-md">
            {authMode === 'welcome' ? (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to FINTRACK</h2>
                  <p className="text-slate-400 text-sm">Select your account profile type to proceed.</p>
                </div>

                {/* Individual Card */}
                <button
                  onClick={() => {
                    setAccountType('Individual');
                    setLoginEmail('alex.morgan@fintrack.io');
                    setLoginPassword('fintrack2026');
                    setLoginError(null);
                    setAuthMode('login');
                  }}
                  className="group flex items-start gap-4 p-6 rounded-3xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-emerald-400/50 shadow-2xl transition-all text-left w-full cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-lg shadow-emerald-500/10">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-emerald-300 transition-colors">Individual</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">Manage personal finances, track investments, and plan your wealth growth.</p>
                  </div>
                </button>

                {/* Corporate Card */}
                <button
                  onClick={() => {
                    setAccountType('Corporate');
                    setLoginEmail('admin@apexglobal.io');
                    setLoginPassword('fintrack2026');
                    setLoginError(null);
                    setAuthMode('login');
                  }}
                  className="group flex items-start gap-4 p-6 rounded-3xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-indigo-400/50 shadow-2xl transition-all text-left w-full cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-lg shadow-indigo-500/10">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">Corporate</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">Manage organization expenses, payroll, and enterprise financial analytics.</p>
                  </div>
                </button>

                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      if (getStoredToken()) {
                        setAuthMode('app');
                      } else {
                        // Demo quick-login as Individual
                        setLoginEmail('alex.morgan@fintrack.io');
                        setLoginPassword('fintrack2026');
                        setAuthMode('login');
                      }
                    }}
                    className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Proceed to Account Login →
                  </button>
                </div>
              </div>
            ) : authMode === 'forgot-password' ? (
              <div className="flex flex-col gap-6 animate-fadeIn bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setForgotError(null);
                    setForgotSuccess(null);
                    navigateAuth('/login', 'login');
                  }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-mono transition-colors self-start cursor-pointer"
                >
                  ← Back to Sign In
                </button>

                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-0.5">Forgot Password</h2>
                    <p className="text-xs text-slate-400">Request password reset instructions for your account.</p>
                  </div>
                </div>

                {forgotSuccess ? (
                  <div className="flex flex-col gap-5">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3.5 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                      <div className="leading-relaxed">
                        <p className="font-semibold text-emerald-200 mb-1">Request Received</p>
                        <p>{forgotSuccess}</p>
                      </div>
                    </div>

                    {devResetToken && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-mono font-bold text-[11px] uppercase tracking-wider text-amber-400">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Development Prototype Shortcut</span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                          Before Nodemailer integration in Step 14, you can test the password reset flow directly using this generated dev token:
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setResetToken(devResetToken);
                            setResetError(null);
                            setResetSuccess(null);
                            navigateAuth(`/reset-password?token=${devResetToken}`, 'reset-password');
                          }}
                          className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl py-2.5 px-3 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span>Open Reset Password Form with Token →</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setForgotSuccess(null);
                        navigateAuth('/login', 'login');
                      }}
                      className="w-full bg-white/10 hover:bg-white/15 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer border border-white/10 text-center"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                    {forgotError && (
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Enter your registered email address below. We'll send single-use instructions to securely reset your credentials.
                    </p>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Email Address</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="alex.morgan@fintrack.io"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer mt-2 border border-white/10 flex items-center justify-center gap-2"
                    >
                      {forgotLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing Request...</span>
                        </>
                      ) : (
                        <span>Send Password Reset Instructions</span>
                      )}
                    </button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotError(null);
                          navigateAuth('/login', 'login');
                        }}
                        className="text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Remember your password? <span className="text-emerald-400 hover:underline">Sign In</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : authMode === 'reset-password' ? (
              <div className="flex flex-col gap-6 animate-fadeIn bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setResetError(null);
                    setResetSuccess(null);
                    navigateAuth('/login', 'login');
                  }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-mono transition-colors self-start cursor-pointer"
                >
                  ← Back to Sign In
                </button>

                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-0.5">Reset Password</h2>
                    <p className="text-xs text-slate-400">Establish a new password for your account.</p>
                  </div>
                </div>

                {resetSuccess ? (
                  <div className="flex flex-col gap-5">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3.5 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                      <div className="leading-relaxed">
                        <p className="font-semibold text-emerald-200 mb-1">Password Reset Complete</p>
                        <p>{resetSuccess}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setResetSuccess(null);
                        setResetError(null);
                        navigateAuth('/login', 'login');
                      }}
                      className="w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer border border-white/10 flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Sign In →</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                    {resetError && (
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-xl flex flex-col gap-1.5">
                        <div className="flex items-center gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{resetError}</span>
                        </div>
                        {(resetError.toLowerCase().includes('expired') || resetError.toLowerCase().includes('invalid')) && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetError(null);
                              navigateAuth('/forgot-password', 'forgot-password');
                            }}
                            className="text-[11px] font-mono text-rose-200 hover:underline self-start ml-6.5 cursor-pointer"
                          >
                            Request a new password reset link →
                          </button>
                        )}
                      </div>
                    )}

                    {!new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('token') && !resetToken ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Reset Token</label>
                        <input
                          type="text"
                          required
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="Paste single-use token here"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none backdrop-blur-md text-sm font-mono"
                        />
                      </div>
                    ) : (
                      <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          Single-Use Token Attached
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {resetToken ? `${resetToken.slice(0, 8)}...${resetToken.slice(-6)}` : 'Verified'}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 relative">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-400">New Password</label>
                      <div className="relative">
                        <input
                          type={showResetPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(!showResetPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 relative">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="Re-enter your new password"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Must be at least 6 characters. Bcrypt hashed on server.</span>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer mt-2 border border-white/10 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Updating Credentials...</span>
                        </>
                      ) : (
                        <span>Confirm & Reset Password</span>
                      )}
                    </button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setResetError(null);
                          navigateAuth('/login', 'login');
                        }}
                        className="text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel & return to <span className="text-emerald-400 hover:underline">Sign In</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : authMode === 'verify-email' ? (
              <div className="flex flex-col gap-6 animate-fadeIn bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    navigateAuth('/login', 'login');
                  }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-mono transition-colors self-start cursor-pointer"
                >
                  ← Back to Sign In
                </button>

                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border ${
                    verificationStatus === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10'
                      : verificationStatus === 'error'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-rose-500/10'
                      : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-indigo-500/10'
                  }`}>
                    {verificationStatus === 'verifying' ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    ) : verificationStatus === 'success' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : verificationStatus === 'error' ? (
                      <AlertCircle className="w-6 h-6 text-rose-400" />
                    ) : (
                      <Mail className="w-6 h-6 text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-0.5">
                      {verificationStatus === 'verifying'
                        ? 'Verifying Email...'
                        : verificationStatus === 'success'
                        ? 'Email Verified!'
                        : verificationStatus === 'error'
                        ? 'Verification Link Issue'
                        : 'Email Verification'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {verificationStatus === 'success'
                        ? 'Your FINTRACK account is active and verified.'
                        : verificationStatus === 'error'
                        ? 'The link could not be verified or has expired.'
                        : 'Confirming your account credentials...'}
                    </p>
                  </div>
                </div>

                {verificationStatus === 'verifying' && (
                  <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300 font-mono text-xs">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <span>Validating single-use security token with server...</span>
                  </div>
                )}

                {verificationStatus === 'success' && (
                  <div className="flex flex-col gap-5">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3.5 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                      <div className="leading-relaxed">
                        <p className="font-semibold text-emerald-200 mb-1">Account Ready</p>
                        <p>{verificationMessage || 'Email verified successfully. You can now sign in.'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigateAuth('/login', 'login');
                      }}
                      className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer border border-white/10 flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Sign In →</span>
                    </button>
                  </div>
                )}

                {verificationStatus === 'error' && (
                  <div className="flex flex-col gap-5">
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-3.5 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                      <div className="leading-relaxed">
                        <p className="font-semibold text-rose-200 mb-1">Verification Link Invalid or Expired</p>
                        <p>{verificationMessage || 'This verification link is invalid or has expired.'}</p>
                      </div>
                    </div>

                    <form onSubmit={(e) => handleResendVerification(e)} className="flex flex-col gap-3">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Need a new verification link? Enter your email address below. <span className="text-amber-300 font-semibold">Note:</span> Requesting a new link invalidates any previous links, so please make sure to open the <strong className="text-white">newest email</strong> you receive.
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Email Address</label>
                        <input
                          type="email"
                          required
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          placeholder="your-email@domain.com"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                        />
                      </div>

                      {resendSuccess && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2.5 rounded-xl">
                          {resendSuccess}
                        </div>
                      )}

                      {resendError && (
                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl">
                          {resendError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={resendLoading}
                        className="w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer mt-1 border border-white/10 flex items-center justify-center gap-2"
                      >
                        {resendLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Sending Email...</span>
                          </>
                        ) : (
                          <span>Resend Verification Email</span>
                        )}
                      </button>
                    </form>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => navigateAuth('/login', 'login')}
                        className="text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Return to <span className="text-emerald-400 hover:underline">Sign In</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-fadeIn bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                <button
                  onClick={() => {
                    setLoginError(null);
                    setAuthMode('welcome');
                  }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-mono transition-colors self-start cursor-pointer"
                >
                  ← Back to selection
                </button>

                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {isRegistering ? `Create ${accountType} Account` : `Login to ${accountType}`}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isRegistering
                      ? 'Set up your credentials to establish a dedicated, secure financial workspace.'
                      : 'Enter your credentials to access your financial dashboard and profile.'}
                  </p>
                </div>

                {/* Sign In vs Register Toggle */}
                <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setLoginError(null);
                      if (!loginEmail) {
                        setLoginEmail(accountType === 'Corporate' ? 'admin@apexglobal.io' : 'alex.morgan@fintrack.io');
                        setLoginPassword('fintrack2026');
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                      !isRegistering
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setLoginError(null);
                      // Clear demo credentials so customer enters their real email
                      if (loginEmail === 'alex.morgan@fintrack.io' || loginEmail === 'admin@apexglobal.io') {
                        setLoginEmail('');
                      }
                      if (loginPassword === 'fintrack2026') {
                        setLoginPassword('');
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                      isRegistering
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {registeredEmailNotice && !isRegistering && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3.5 rounded-xl flex flex-col gap-2">
                    <div className="flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <p className="font-semibold text-white">Verification Email Sent!</p>
                        <p>We've sent an activation link to <strong>{registeredEmailNotice}</strong>. Please check your inbox and verify your email to log in.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResendVerification(undefined, registeredEmailNotice)}
                      disabled={resendLoading}
                      className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 underline self-start cursor-pointer"
                    >
                      {resendLoading ? 'Sending email...' : 'Did not receive it? Resend verification link →'}
                    </button>
                  </div>
                )}

                {loginError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{loginError}</span>
                    </div>
                    {unverifiedLoginEmail && (
                      <button
                        type="button"
                        onClick={() => handleResendVerification(undefined, unverifiedLoginEmail)}
                        disabled={resendLoading}
                        className="text-[11px] font-mono text-rose-300 hover:text-rose-200 underline self-start ml-6.5 cursor-pointer"
                      >
                        {resendLoading ? 'Sending email...' : `Resend verification link to ${unverifiedLoginEmail} →`}
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={isRegistering ? handleRegister : handleLogin} className="flex flex-col gap-4">
                  {isRegistering && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Full Name</label>
                      <input
                        type="text"
                        required
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        placeholder={accountType === 'Corporate' ? 'Apex Corporate Administrator' : 'Alex Morgan'}
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      {isRegistering ? 'Your Real Email Address' : 'Username / Email'}
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder={
                        isRegistering
                          ? (accountType === 'Corporate' ? 'company@yourdomain.com' : 'you@gmail.com')
                          : (accountType === 'Corporate' ? 'admin@apexglobal.io' : 'alex.morgan@fintrack.io')
                      }
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 relative">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isRegistering && (
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500" />
                        Remember Me
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(loginEmail);
                          setForgotError(null);
                          setForgotSuccess(null);
                          setDevResetToken(null);
                          navigateAuth('/forgot-password', 'forgot-password');
                        }}
                        className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl py-3 px-4 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer mt-2 border border-white/10 flex items-center justify-center gap-2"
                  >
                    {loginLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isRegistering ? 'Creating Account...' : 'Verifying Credentials...'}</span>
                      </>
                    ) : (
                      <span>{isRegistering ? 'Register & Enter Workspace' : 'Access Dashboard & Profile'}</span>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Primary FINTRACK Application with Frosted Glass Theme
  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden relative">
      {/* Ambient Glowing Orbs for Frosted Glass Backdrop */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/25 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-emerald-500/20 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#020617]/90 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-slideIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Prompt Modal / Prompt Builder */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#020617]/90 backdrop-blur-2xl rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/15 overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Website Generation Prompt</h3>
                  <p className="text-xs font-mono text-slate-400">Copy-ready prompt engineered for AI code generation</p>
                </div>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 bg-black/40 leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30 border-y border-white/5">
              {MASTER_PROMPT}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Includes Frosted Glass Tokens, Layouts, State Model & Charts
              </span>
              <button
                onClick={copyPromptText}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer shadow-lg shadow-emerald-600/20 border border-white/10"
              >
                {promptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {promptCopied ? 'COPIED TO CLIPBOARD!' : 'COPY FULL PROMPT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b132b]/95 backdrop-blur-2xl rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-white/15 overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Transaction</h3>
                  <p className="text-xs font-mono text-slate-400">ID: {editingTx.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
              {editTxError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{editTxError}</span>
                </div>
              )}

              {/* Type Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Type</label>
                <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditTxType('expense')}
                    className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer font-bold ${
                      editTxType === 'expense'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTxType('income')}
                    className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer font-bold ${
                      editTxType === 'income'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  Amount ({getCurrencyConfig(preferredCurrency).symbol})
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-lg font-bold text-slate-400 font-mono">
                    {getCurrencyConfig(preferredCurrency).symbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editTxAmount}
                    onChange={(e) => setEditTxAmount(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white font-mono font-bold text-lg focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                </div>
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Category</label>
                  <select
                    value={editTxCategory}
                    onChange={(e) => setEditTxCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0f172a] border border-white/15 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                  >
                    {editCategoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Date</label>
                  <input
                    type="date"
                    required
                    value={editTxDate}
                    onChange={(e) => setEditTxDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0f172a] border border-white/15 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-400 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Custom Category if others */}
              {editTxCategory === 'others' && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-xs font-mono uppercase tracking-widest text-emerald-400">Custom Category</label>
                  <input
                    type="text"
                    required
                    value={editTxCustomCategory}
                    onChange={(e) => setEditTxCustomCategory(e.target.value)}
                    placeholder="e.g., Equipment Maintenance"
                    className="w-full px-3 py-2 bg-white/5 border border-emerald-500/40 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Payment Method</label>
                <select
                  value={editTxMethod}
                  onChange={(e) => setEditTxMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f172a] border border-white/15 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                >
                  <option value="UPI / Wallet">UPI / Wallet</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Description</label>
                <input
                  type="text"
                  value={editTxDescription}
                  onChange={(e) => setEditTxDescription(e.target.value)}
                  placeholder="Description or notes"
                  className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 rounded-xl border border-white/15 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTx}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingTx ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Budget Modal (Step 8) */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b132b]/95 border border-white/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingBudget ? 'Update Budget Limit' : 'Set Category Budget'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">Period: {budgetPeriod}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              {budgetFormError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{budgetFormError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Category</label>
                <select
                  value={budgetCategoryInput}
                  onChange={(e) => setBudgetCategoryInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0f172a] border border-white/15 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                >
                  {getCategoryOptions(isCorporate, 'expense')
                    .filter((o) => o.value !== 'others')
                    .map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Monthly Limit Amount</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold font-mono">
                    {getCurrencyConfig(preferredCurrency).symbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 15000"
                    value={budgetAmountInput}
                    onChange={(e) => setBudgetAmountInput(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white font-mono font-bold text-lg focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Month / Period</label>
                <input
                  type="month"
                  value={budgetPeriod}
                  onChange={(e) => setBudgetPeriod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0f172a] border border-white/15 rounded-xl text-xs text-white focus:ring-2 focus:ring-emerald-400 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/15 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={budgetSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {budgetSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Budget Limit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col h-full w-64 bg-white/5 backdrop-blur-2xl border-r border-white/10 py-5 z-20 shrink-0 shadow-2xl">
        {/* Brand */}
        <div className="px-6 pb-6 mb-2 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-emerald-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 border border-white/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200 tracking-tight">
              FINTRACK
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${backendHealth?.success ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                {backendHealth?.success ? 'API Connected' : 'Connecting...'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 flex flex-col gap-1.5">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all text-left cursor-pointer ${
              currentTab === 'dashboard'
                ? 'text-white font-bold border-l-4 border-emerald-400 bg-white/10 backdrop-blur-md shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentTab('add-transaction')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all text-left cursor-pointer ${
              currentTab === 'add-transaction'
                ? 'text-white font-bold border-l-4 border-emerald-400 bg-white/10 backdrop-blur-md shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>

          <button
            onClick={() => setCurrentTab('expenses')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all text-left cursor-pointer ${
              currentTab === 'expenses'
                ? 'text-white font-bold border-l-4 border-emerald-400 bg-white/10 backdrop-blur-md shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Expenses</span>
          </button>

          <button
            onClick={() => setCurrentTab('analytics')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all text-left cursor-pointer ${
              currentTab === 'analytics'
                ? 'text-white font-bold border-l-4 border-emerald-400 bg-white/10 backdrop-blur-md shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => setCurrentTab('budget')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all text-left cursor-pointer ${
              currentTab === 'budget'
                ? 'text-white font-bold border-l-4 border-emerald-400 bg-white/10 backdrop-blur-md shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Budget</span>
          </button>

          <button
            onClick={() => setCurrentTab('ai-advisor')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all text-left cursor-pointer ${
              currentTab === 'ai-advisor'
                ? 'text-white font-bold border-l-4 border-emerald-400 bg-white/10 backdrop-blur-md shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>AI Advisor</span>
          </button>

          <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-1">
            <button
              onClick={() => setCurrentTab('support')}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-mono text-left cursor-pointer transition-colors ${
                currentTab === 'support'
                  ? 'bg-white/10 text-emerald-400 font-semibold border-l-2 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Support Desk</span>
            </button>
            <button
              onClick={() => {
                setCurrentTab('notifications');
                loadNotifications();
              }}
              className={`flex items-center justify-between px-4 py-2 rounded-xl text-xs font-mono text-left cursor-pointer transition-colors ${
                currentTab === 'notifications'
                  ? 'bg-white/10 text-emerald-400 font-semibold border-l-2 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span>Notifications</span>
              </div>
              {unreadNotificationCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-sm">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentTab('profile')}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-mono text-left cursor-pointer transition-colors ${
                currentTab === 'profile'
                  ? 'bg-white/10 text-emerald-400 font-semibold border-l-2 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4 text-emerald-400" />
              <span>Profile ({profile?.accountType ? (profile.accountType.charAt(0).toUpperCase() + profile.accountType.slice(1)) : accountType})</span>
            </button>
            <button
              onClick={() => triggerToast('FINTRACK Settings synchronized.')}
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 text-left cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-mono text-rose-400 hover:bg-rose-500/10 text-left cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </nav>

        <div className="px-4 pt-3">
          <button
            onClick={() => triggerToast('Pro Plan: Unlimited automated bank sync, multi-currency & tax optimization enabled!')}
            className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 py-2.5 px-3 rounded-2xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 text-white font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-500/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Upgrade Pro
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto z-10 relative">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#020617]/70 backdrop-blur-xl border-b border-white/10 px-6 py-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
              {currentTab === 'dashboard' && `Good Morning, ${profile?.name || (getStoredUser()?.name) || 'Alex'} 👋`}
              {currentTab === 'profile' && 'User Profile & Identity'}
              {currentTab === 'add-transaction' && 'Record Activity'}
              {currentTab === 'ai-advisor' && 'FINTRACK AI Advisor'}
              {currentTab === 'expenses' && 'Expense Ledger'}
              {currentTab === 'analytics' && 'Financial Analytics & Trends'}
              {currentTab === 'budget' && 'Budget Planner'}
              {currentTab === 'support' && 'Support & Help Desk'}
              {currentTab === 'notifications' && 'Notification Center'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Prompt View / Export Button */}
            <button
              onClick={() => setShowPromptModal(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-mono font-semibold px-4 py-2 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Creation Prompt</span>
            </button>

            {/* Step 11: Connected Header Bell with Popover Dropdown */}
            <div className="relative">
              <button
                id="header-notification-bell"
                onClick={() => {
                  setShowNotificationCenter(!showNotificationCenter);
                  if (!showNotificationCenter) {
                    loadNotifications();
                  }
                }}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer relative ${
                  showNotificationCenter
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/50 animate-pulse">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotificationCenter && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowNotificationCenter(false)}
                  />
                  <div className="absolute right-0 top-12 w-[380px] sm:w-[440px] max-w-[92vw] z-50 bg-[#020617]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden animate-scaleIn">
                    {/* Popover Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <Bell className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-white font-mono">Notifications</span>
                        {unreadNotificationCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {unreadNotificationCount} Unread
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Caught Up
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {unreadNotificationCount > 0 && (
                          <button
                            onClick={handleMarkAllNotificationsRead}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 text-[11px] font-mono border border-white/10 transition-colors cursor-pointer"
                            title="Mark all as read"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>Mark All Read</span>
                          </button>
                        )}
                        <button
                          onClick={loadNotifications}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Refresh"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${notificationsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                        </button>
                        <button
                          onClick={() => setShowNotificationCenter(false)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Close"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-black/20">
                      {[
                        { label: 'All', value: 'all', count: notifications.length },
                        { label: 'Unread', value: 'unread', count: unreadNotificationCount },
                        { label: 'Transactions', value: 'transaction' },
                        { label: 'Budgets', value: 'budget' },
                        { label: 'Support', value: 'support' },
                        { label: 'AI', value: 'ai' },
                        { label: 'System', value: 'system' }
                      ].map((tab) => (
                        <button
                          key={tab.value}
                          onClick={() => setNotificationFilter(tab.value as any)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            notificationFilter === tab.value
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm'
                              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                        </button>
                      ))}
                    </div>

                    {/* Notification Items List */}
                    <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5 p-2 flex flex-col gap-1.5">
                      {notificationsLoading && notifications.length === 0 ? (
                        <div className="p-4 flex flex-col gap-2.5 animate-pulse">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/5" />
                          ))}
                        </div>
                      ) : notificationsError ? (
                        <div className="p-4 text-center">
                          <p className="text-xs text-rose-400 font-mono mb-2">{notificationsError}</p>
                          <button
                            onClick={loadNotifications}
                            className="px-3 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                          >
                            Retry Loading
                          </button>
                        </div>
                      ) : (() => {
                        const filtered = notifications.filter((n) => {
                          if (notificationFilter === 'unread') return !n.isRead;
                          if (notificationFilter !== 'all') return n.type === notificationFilter;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-8 px-4 text-center flex flex-col items-center">
                              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-2.5">
                                <Inbox className="w-5 h-5 text-emerald-400/60" />
                              </div>
                              <p className="text-xs font-mono font-semibold text-slate-300">No notifications found</p>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5 max-w-[220px]">
                                {notificationFilter === 'unread'
                                  ? "You have marked all notifications as read!"
                                  : "Operational updates for transactions, budgets, and AI will appear here."}
                              </p>
                            </div>
                          );
                        }

                        return filtered.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 relative ${
                              !n.isRead
                                ? 'bg-gradient-to-r from-emerald-500/10 via-white/5 to-transparent border-emerald-500/30 shadow-sm'
                                : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'
                            }`}
                          >
                            {/* Type Icon Badge */}
                            <div
                              className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs mt-0.5 border ${
                                n.type === 'transaction'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : n.type === 'budget'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : n.type === 'support'
                                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                  : n.type === 'ai'
                                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              }`}
                            >
                              {n.type === 'transaction' && <DollarSign className="w-3.5 h-3.5" />}
                              {n.type === 'budget' && <Wallet className="w-3.5 h-3.5" />}
                              {n.type === 'support' && <HelpCircle className="w-3.5 h-3.5" />}
                              {n.type === 'ai' && <Sparkles className="w-3.5 h-3.5" />}
                              {n.type === 'system' && <ShieldCheck className="w-3.5 h-3.5" />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-semibold text-white font-mono truncate">{n.title}</h4>
                                {!n.isRead && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-300 font-mono mt-0.5 leading-relaxed break-words">
                                {n.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-slate-400">
                                <span className="uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-semibold">
                                  {n.type}
                                </span>
                                <span>{formatRelativeTime(n.createdAt)}</span>
                              </div>
                            </div>

                            {/* Per-item Quick Actions */}
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              {!n.isRead && (
                                <button
                                  onClick={() => handleMarkNotificationRead(n.id)}
                                  title="Mark as read"
                                  className="p-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteNotification(n.id)}
                                title="Delete notification"
                                className="p-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Popover Footer */}
                    <div className="p-2.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {notifications.length} total notifications
                      </span>
                      <button
                        onClick={() => {
                          setCurrentTab('notifications');
                          setShowNotificationCenter(false);
                        }}
                        className="text-[11px] font-mono font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Full Notification Desk</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Global Compact Currency Selector */}
            <div className="relative flex items-center">
              <select
                value={preferredCurrency}
                onChange={(e) => handleQuickCurrencyChange(e.target.value)}
                aria-label="Select Currency"
                title="Change Currency Preference"
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-mono font-bold py-1.5 px-2.5 rounded-xl border border-white/20 focus:border-emerald-400 focus:outline-none transition-all cursor-pointer backdrop-blur-md"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
            </div>

            <div
              onClick={() => setCurrentTab('profile')}
              title="Open Profile"
              className="h-9 w-9 rounded-xl border border-white/20 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity shadow-sm flex items-center justify-center bg-gradient-to-tr from-indigo-500 to-emerald-400 text-white font-bold text-xs"
            >
              {profile?.name ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM'}
            </div>
          </div>
        </header>

        {/* Tab View Routing */}
        <main className="p-6 lg:p-8 max-w-[1280px] mx-auto w-full flex flex-col gap-6">
          {/* TAB 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <>
              {/* Dashboard Header Bar with Currency Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Financial Overview</h2>
                  <p className="text-xs text-slate-400 font-mono">Real-time calculations across your active portfolio</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl backdrop-blur-md">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Currency:</span>
                  <select
                    value={preferredCurrency}
                    onChange={(e) => handleQuickCurrencyChange(e.target.value)}
                    className="bg-transparent text-emerald-400 text-xs font-mono font-bold focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                        {c.symbol} {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Dashboard Error Alert */}
              {dashboardError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-2xl flex items-center justify-between gap-3 animate-slideIn">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{dashboardError}</span>
                  </div>
                  <button
                    onClick={loadDashboardSummary}
                    className="text-rose-300 underline font-mono text-xs hover:text-white cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Dashboard Loading State */}
              {dashboardLoading && !dashboardSummary && (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Compiling real-time dashboard metrics...</span>
                </div>
              )}

              {/* Empty state when no transactions recorded */}
              {dashboardSummary && effectiveIncome === 0 && effectiveExpense === 0 && (
                <div className="p-6 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-fadeIn">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">Welcome to your FINTRACK Portfolio</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Start by recording your revenue or expenses to view real-time calculations and category distributions.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentTab('add-transaction')}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all shrink-0 cursor-pointer"
                  >
                    Add First Transaction →
                  </button>
                </div>
              )}

              {/* Summary 4-Card Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Income */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl hover:border-white/20 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {dashboardSummary ? `Mo: ${formatCurrency(dashboardSummary.currentMonthIncome ?? 0, preferredCurrency)}` : 'Current Mo'}
                    </span>
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Total Income</p>
                  <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(effectiveIncome ?? 0, preferredCurrency)}</h3>
                </div>

                {/* Total Expenses */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl hover:border-white/20 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {dashboardSummary ? `Mo: ${formatCurrency(dashboardSummary.currentMonthExpenses ?? 0, preferredCurrency)}` : 'Current Mo'}
                    </span>
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Total Expenses</p>
                  <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(effectiveExpense, preferredCurrency)}</h3>
                </div>

                {/* Balance */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl hover:border-white/20 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-lg shadow-indigo-500/10">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-mono text-xs font-semibold ${
                      effectiveBalance >= 0
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}>
                      {effectiveBalance >= 0 ? 'Net Positive' : 'Deficit'}
                    </span>
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Balance</p>
                  <h3 className={`text-2xl font-bold tracking-tight ${effectiveBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    {formatCurrency(effectiveBalance, preferredCurrency)}
                  </h3>
                </div>

                {/* Savings Rate */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl hover:border-white/20 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 shadow-lg shadow-teal-500/10">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {effectiveSavingsRate >= 20 ? 'Target Met' : 'Target: 20%+'}
                    </span>
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Savings Rate</p>
                  <h3 className="text-2xl font-bold text-white tracking-tight">{effectiveSavingsRate}%</h3>
                </div>
              </div>

              {/* Bento Grid Charts & Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Donut Chart: Expense Breakdown */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col">
                  <h4 className="text-lg font-bold text-white mb-4 pb-3 border-b border-white/10 flex items-center justify-between">
                    <span>Expense Breakdown</span>
                    <span className="text-xs font-mono text-slate-400 font-normal">
                      {categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'Category' : 'Categories'}
                    </span>
                  </h4>

                  <div className="flex-1 flex flex-col items-center justify-center my-4 relative">
                    <div className="relative w-44 h-44 flex items-center justify-center">
                      {/* SVG Donut */}
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        {/* Background track circle */}
                        <path
                          className="text-white/10"
                          strokeWidth="4"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        {/* Dynamic category slices */}
                        {donutSlices.map((slice) => (
                          <path
                            key={slice.category}
                            className={slice.color.text}
                            strokeDasharray={`${slice.percentage} ${100 - slice.percentage}`}
                            strokeDashoffset={`-${slice.offset}`}
                            strokeWidth="4.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        ))}
                      </svg>

                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-bold text-white">
                          {formatCurrency(effectiveExpense, preferredCurrency, { compact: true })}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-slate-400">Total Spent</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Legend */}
                  {donutSlices.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-mono">
                      No expenses recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2 mt-auto pt-2 text-xs font-mono max-h-48 overflow-y-auto pr-1">
                      {donutSlices.map((slice) => (
                        <div key={slice.category} className="flex justify-between items-center group">
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <div className={`w-3 h-3 rounded-full ${slice.color.bg} shrink-0`} />
                            <span className="text-slate-300 truncate" title={slice.category}>{slice.category}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-slate-400 text-[11px]">{formatCurrency(slice.amount, preferredCurrency)}</span>
                            <span className="font-bold text-white w-9 text-right">{slice.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right 2 Columns: Bar Chart + Recent Transactions */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Monthly Spending Bar Chart */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                      <h4 className="text-lg font-bold text-white">Monthly Spending</h4>
                      <span className="text-xs font-mono text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        {dashboardSummary ? `Current Mo: ${formatCurrency(dashboardSummary.currentMonthExpenses, preferredCurrency)}` : `Average ${formatCurrency(38200, preferredCurrency)}/mo`}
                      </span>
                    </div>

                    <div className="h-44 flex items-end justify-between gap-3 px-2">
                      {monthlySpendingData.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-mono text-xs">
                          No spending data recorded in recent months
                        </div>
                      ) : (
                        monthlySpendingData.map((item, idx) => {
                          const pct = item.amount > 0 ? Math.max(12, Math.round((item.amount / maxMonthlySpend) * 100)) : 6;
                          const color = barColors[idx % barColors.length];
                          const formattedVal = formatCurrency(item.amount, preferredCurrency);
                          return (
                            <div key={item.key || idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                              <div className="relative w-full flex items-end justify-center">
                                <div
                                  style={{ height: `${pct}%` }}
                                  className={`w-full max-w-[48px] rounded-t-xl ${color} group-hover:brightness-125 transition-all cursor-pointer backdrop-blur-md shadow-lg`}
                                />
                                {/* Hover Tooltip */}
                                <div className="absolute -top-8 bg-[#020617] text-white px-2.5 py-1 rounded-lg text-[10px] font-mono border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-xl">
                                  {formattedVal}
                                </div>
                              </div>
                              <span className="text-xs font-mono text-slate-400">{item.month}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Recent Transactions Table */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-5 pb-3 border-b border-white/10 flex justify-between items-center">
                      <h4 className="text-lg font-bold text-white">Recent Transactions</h4>
                      <button
                        onClick={() => setCurrentTab('expenses')}
                        className="text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                      >
                        View All ({transactions.length}) →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-white/5 text-slate-400 font-mono text-xs uppercase tracking-wider border-b border-white/10">
                          <tr>
                            <th className="p-3.5 font-medium">Date</th>
                            <th className="p-3.5 font-medium">Description</th>
                            <th className="p-3.5 font-medium">Category</th>
                            <th className="p-3.5 font-medium">Method</th>
                            <th className="p-3.5 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {recentTxs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 font-mono text-xs">
                                No recent transactions recorded yet.
                              </td>
                            </tr>
                          ) : (
                            recentTxs.map((tx) => (
                              <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-3.5 text-slate-400 font-mono text-xs">{tx.date}</td>
                                <td className="p-3.5 font-medium text-white">{tx.description || '—'}</td>
                                <td className="p-3.5">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${
                                      tx.type === 'income'
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                    }`}
                                  >
                                    {tx.category}
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-400 text-xs font-mono">{tx.paymentMethod || tx.method || 'Other'}</td>
                                <td
                                  className={`p-3.5 text-right font-mono font-bold ${
                                    tx.type === 'income' ? 'text-emerald-400' : 'text-slate-100'
                                  }`}
                                >
                                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, preferredCurrency)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: ADD TRANSACTION (RECORD ACTIVITY) */}
          {currentTab === 'add-transaction' && (
            <div className="max-w-[800px] mx-auto w-full">
              <form
                onSubmit={handleAddTransaction}
                className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
              >
                <div className="p-6 md:p-8 space-y-6">
                  {/* Toggle: Expense / Income */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Transaction Type</label>
                    <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl w-full max-w-sm">
                      <button
                        type="button"
                        onClick={() => setTxType('expense')}
                        className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer font-bold ${
                          txType === 'expense'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Expense
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxType('income')}
                        className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer font-bold ${
                          txType === 'income'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Income
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Amount</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-2xl font-bold text-slate-400">
                        {getCurrencyConfig(preferredCurrency).symbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className={`block w-full pl-12 pr-4 py-3 text-3xl font-bold bg-white/5 border border-white/15 rounded-2xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none backdrop-blur-md ${
                          txType === 'income' ? 'text-emerald-400' : 'text-white'
                        }`}
                      />
                    </div>
                  </div>

                  {addTxError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-xl flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{addTxError}</span>
                    </div>
                  )}

                  {/* Category & Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-white/15 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                      >
                        {categoryOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Date</label>
                      <input
                        type="date"
                        required
                        value={txDate}
                        onChange={(e) => setTxDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0f172a] border border-white/15 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                    </div>

                    {category === 'others' && (
                      <div className="flex flex-col gap-2 md:col-span-2 animate-fadeIn">
                        <label className="text-xs font-mono uppercase tracking-widest text-emerald-400">Custom Category Name</label>
                        <input
                          type="text"
                          required
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="e.g., Equipment Repair or Freelance Milestone"
                          className="w-full px-4 py-2.5 bg-white/5 border border-emerald-400/50 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-white/15 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-400 outline-none"
                      >
                        <option value="UPI / Wallet">UPI / Wallet (GPay, PhonePe, Paytm)</option>
                        <option value="Credit Card">Credit / Debit Card</option>
                        <option value="Bank Transfer">Bank Transfer / NEFT</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Description (Optional)</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add notes about this transaction..."
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none resize-none backdrop-blur-md"
                    />
                  </div>

                  {/* Receipt Upload */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Receipt / Invoice</label>
                    <div
                      onClick={() => {
                        setReceiptFile('receipt_invoice_sample.pdf');
                        triggerToast('Sample receipt attached!');
                      }}
                      className="border-2 border-dashed border-white/20 hover:border-emerald-400/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-white/5 backdrop-blur-md cursor-pointer transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-slate-300">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-200">
                          {receiptFile ? (
                            <span className="text-emerald-400 font-bold font-mono">✓ {receiptFile} Attached</span>
                          ) : (
                            <>
                              <span className="font-bold text-white">Click to upload</span> or drag and drop
                            </>
                          )}
                        </p>
                        <p className="text-xs font-mono text-slate-400 mt-1">SVG, PNG, JPG or PDF (max. 5MB)</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-white/5 px-8 py-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentTab('dashboard')}
                    className="px-5 py-2 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTx}
                    className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer border border-white/10"
                  >
                    {isSubmittingTx ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>Save Transaction</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: AI ADVISOR (STEP 9) */}
          {currentTab === 'ai-advisor' && (
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">
                        FINTRACK AI Advisor
                      </h3>
                      <p className="text-xs text-slate-400">
                        Neural intelligence analyzing your personal financial trajectory, spending efficiency & wealth opportunities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status Indicator */}
                  {isAdviceFallback ? (
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Simulation / Fallback Mode</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                      <span>AI Powered ({aiProvider.toUpperCase()})</span>
                    </div>
                  )}

                  {/* Re-Analyze / Refresh Button */}
                  <button
                    onClick={() => loadAiAdvice(true)}
                    disabled={aiAdviceLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/15 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiAdviceLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>{aiAdviceLoading ? 'Analyzing...' : 'Re-Analyze Finances'}</span>
                  </button>
                </div>
              </div>

              {/* Compliance & Financial Safety Disclaimer */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 backdrop-blur-xl">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <p>
                  <strong className="text-slate-200">Financial Disclaimer:</strong> AI-generated insights are for informational purposes only and should not be considered professional financial advice.
                </p>
              </div>

              {/* State 1: Insufficient / Empty Data State */}
              {transactions.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-12 border border-white/10 shadow-2xl text-center flex flex-col items-center justify-center max-w-xl mx-auto my-6">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-xl">
                    <Bot className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">No Transaction Data Available</h4>
                  <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
                    Add some transactions to receive personalized financial insights, category breakdowns, and AI-powered recommendations.
                  </p>
                  <button
                    onClick={() => setCurrentTab('add-transaction')}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all shadow-xl shadow-indigo-600/20 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add First Transaction</span>
                  </button>
                </div>
              ) : aiAdviceLoading && !aiAdvice ? (
                /* State 2: Loading Skeleton */
                <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl space-y-6 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-white/10 rounded w-1/3" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-24 bg-white/10 rounded-2xl" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="h-44 bg-white/10 rounded-2xl" />
                    <div className="h-44 bg-white/10 rounded-2xl" />
                  </div>
                  <p className="text-center text-xs font-mono text-emerald-400 pt-2">
                    Synthesizing transaction telemetry & analyzing financial patterns with neural intelligence...
                  </p>
                </div>
              ) : aiAdviceError && !aiAdvice ? (
                /* State 3: Error State with Retry */
                <div className="bg-rose-500/10 backdrop-blur-2xl rounded-3xl p-8 border border-rose-500/20 shadow-2xl text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">Unable to Compile Financial Insights</h4>
                  <p className="text-xs text-rose-300 max-w-md mb-6 leading-relaxed">
                    {aiAdviceError}
                  </p>
                  <button
                    onClick={() => loadAiAdvice(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/20 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Analysis</span>
                  </button>
                </div>
              ) : aiAdvice ? (
                /* State 4: Structured AI Advice Content */
                <div className="space-y-6">
                  {/* Section 1: Executive Financial Summary Card */}
                  <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-emerald-950/30 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                          Executive Financial Summary
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                        Synthesized from {transactions.length} Transactions
                      </span>
                    </div>

                    <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed mb-6">
                      {aiAdvice.summary}
                    </p>

                    {/* Financial Snapshot Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                      <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Net Balance</span>
                        <span className="text-lg font-bold text-white">
                          {formatCurrency(effectiveBalance, preferredCurrency)}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Total Income</span>
                        <span className="text-lg font-bold text-emerald-400">
                          {formatCurrency(effectiveIncome, preferredCurrency)}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Total Outflow</span>
                        <span className="text-lg font-bold text-rose-400">
                          {formatCurrency(effectiveExpense, preferredCurrency)}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Savings Efficiency</span>
                        <span className="text-lg font-bold text-indigo-300">
                          {effectiveSavingsRate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2 & 3 & 4 & 5: Bento Grid of Structured Advice */}
                  <div className="grid grid-cols-12 gap-6">
                    {/* Spending Insights (6 cols) */}
                    <div className="col-span-12 lg:col-span-6 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                              <TrendingUp className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-white text-base">Spending Insights</h4>
                          </div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                            TELEMETRY
                          </span>
                        </div>

                        <div className="space-y-3">
                          {aiAdvice.spendingInsights.map((insight, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-start gap-3"
                            >
                              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0 shadow-sm shadow-indigo-400" />
                              <p className="text-xs text-slate-200 leading-relaxed">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">Deep category breakdown</span>
                        <button
                          onClick={() => setCurrentTab('analytics')}
                          className="text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          View Analytics <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Savings Suggestions (6 cols) */}
                    <div className="col-span-12 lg:col-span-6 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-white text-base">Savings Suggestions</h4>
                          </div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            OPTIMIZATION
                          </span>
                        </div>

                        <div className="space-y-3">
                          {aiAdvice.savingsSuggestions.map((sug, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-start gap-3"
                            >
                              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-sm shadow-emerald-400" />
                              <p className="text-xs text-slate-200 leading-relaxed">{sug}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">Target 20%+ savings buffer</span>
                        <button
                          onClick={() => handleSendMessage('Give me customized savings suggestions')}
                          className="text-xs font-mono font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          Ask Assistant <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Budget Suggestions (6 cols) */}
                    <div className="col-span-12 lg:col-span-6 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-xl">
                              <Wallet className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-white text-base">Budget Suggestions</h4>
                          </div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
                            BUDGETING
                          </span>
                        </div>

                        <div className="space-y-3">
                          {aiAdvice.budgetSuggestions.map((sug, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-start gap-3"
                            >
                              <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 shrink-0 shadow-sm shadow-teal-400" />
                              <p className="text-xs text-slate-200 leading-relaxed">{sug}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">
                          {budgets.length > 0 ? `${budgets.length} Active Budgets Tracked` : 'No Active Budgets'}
                        </span>
                        <button
                          onClick={() => setCurrentTab('budget')}
                          className="text-xs font-mono font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          Manage Budgets <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Alerts (6 cols) */}
                    <div className="col-span-12 lg:col-span-6 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-white text-base">Financial Alerts</h4>
                          </div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                            MONITOR
                          </span>
                        </div>

                        <div className="space-y-3">
                          {aiAdvice.alerts.map((alert, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-start gap-3"
                            >
                              <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 shrink-0 shadow-sm shadow-rose-400" />
                              <p className="text-xs text-slate-200 leading-relaxed">{alert}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">Proactive risk detection</span>
                        <button
                          onClick={() => setCurrentTab('expenses')}
                          className="text-xs font-mono font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          Audit Transactions <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Recommended Action Items (Full 12 cols) */}
                    <div className="col-span-12 bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base sm:text-lg">Recommended Action Items</h4>
                            <p className="text-xs text-slate-400">Key steps to execute to improve your financial posture.</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                          {aiAdvice.actionItems.length} TASKS
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aiAdvice.actionItems.map((action, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/30 transition-all flex items-start gap-3.5 group"
                          >
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                                {action}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Conversational AI Chat Companion */}
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden mt-8">
                {/* Chat Header */}
                <div className="p-4 px-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Ask FINTRACK Advisor</h4>
                      <p className="text-[11px] text-slate-400">Ask customized questions about your budget, trends or savings.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" /> Live Assistant
                  </span>
                </div>

                {/* Message Stream */}
                <div className="p-6 max-h-[420px] overflow-y-auto flex flex-col gap-4 bg-transparent">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-[85%] ${
                        msg.sender === 'user' ? 'self-end flex-row-reverse' : ''
                      }`}
                    >
                      {msg.sender === 'ai' ? (
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shrink-0 flex items-center justify-center text-emerald-400 mt-1 shadow-md">
                          <Bot className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 shrink-0 flex items-center justify-center text-indigo-300 mt-1 shadow-md">
                          <User className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`p-4 rounded-2xl text-sm ${
                          msg.sender === 'user'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-tr-sm shadow-lg shadow-indigo-600/20 border border-indigo-400/20'
                            : 'bg-white/10 backdrop-blur-md text-slate-100 rounded-tl-sm shadow-xl border border-white/15'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.text}</p>
                        {msg.bullets && (
                          <ul className="list-disc pl-5 mt-2.5 space-y-1.5 text-xs text-slate-300">
                            {msg.bullets.map((b, idx) => (
                              <li key={idx}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {msg.note && (
                          <p className="mt-2.5 text-xs text-emerald-300 font-medium pt-2.5 border-t border-white/10">
                            {msg.note}
                          </p>
                        )}
                        <span className="block text-[10px] font-mono text-slate-400 mt-2 text-right">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}

                  {isAiTyping && (
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shrink-0 flex items-center justify-center text-emerald-400 mt-1 shadow-md">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="p-4 rounded-2xl text-sm bg-white/10 backdrop-blur-md text-slate-100 rounded-tl-sm shadow-xl border border-white/15 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}

                  {/* Quick Suggestions Chips */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => handleSendMessage('How can I save more?')}
                      className="px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      How can I save more?
                    </button>
                    <button
                      onClick={() => handleSendMessage('Show me my budget breakdown')}
                      className="px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md"
                    >
                      <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                      Show me my budget breakdown
                    </button>
                    <button
                      onClick={() => handleSendMessage('Analyze my biggest expense')}
                      className="px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      Analyze my biggest expense
                    </button>
                  </div>
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="relative flex items-center"
                  >
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask anything about your finances or advice..."
                      className="w-full bg-white/5 border border-white/15 rounded-2xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all outline-none backdrop-blur-md"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors cursor-pointer shadow-lg shadow-indigo-600/30"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXPENSES LEDGER & PDF EXPORT (STEP 6) */}
          {currentTab === 'expenses' && (
            <div className="space-y-6">
              {/* Header with Title & Action Controls */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-white tracking-tight">Expense & Transaction Ledger</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-white/10 border border-white/15 text-slate-300">
                      {filteredTransactions.length} of {transactions.length} Records
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Filter, inspect, and export your itemized expenditures with branded PDF statements.</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleExportPdf}
                    disabled={isExportingPdf || filteredTransactions.length === 0}
                    title="Generate and download branded PDF report"
                    className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/20 border border-white/10"
                  >
                    {isExportingPdf ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    <span>{isExportingPdf ? 'Generating PDF...' : 'Export PDF Report'}</span>
                  </button>

                  <button
                    onClick={loadTransactions}
                    disabled={transactionsLoading}
                    title="Reload transactions"
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${transactionsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>

                  <button
                    onClick={() => setCurrentTab('add-transaction')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 border border-white/10"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Record
                  </button>
                </div>
              </div>

              {/* Filtered Financial Scope Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-slate-400">Total Outflow</span>
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-400 mt-2">
                    {formatCurrency(filteredExpenseTotal, preferredCurrency)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    {filteredTransactions.filter((t) => t.type === 'expense').length} expense transactions
                  </span>
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-slate-400">Total Inflow</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
                    {formatCurrency(filteredIncomeTotal, preferredCurrency)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    {filteredTransactions.filter((t) => t.type === 'income').length} income streams
                  </span>
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-slate-400">Net Balance</span>
                    <Wallet className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className={`text-2xl font-bold font-mono mt-2 ${filteredNetBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(filteredNetBalance, preferredCurrency, { showPlusSign: true })}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    Net cash flow in view scope
                  </span>
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-slate-400">Avg Transaction</span>
                    <SlidersHorizontal className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-2">
                    {formatCurrency(filteredTransactions.length > 0 ? Math.round((filteredExpenseTotal + filteredIncomeTotal) / filteredTransactions.length) : 0, preferredCurrency)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    Across {filteredTransactions.length} active records
                  </span>
                </div>
              </div>

              {/* Interactive Filter Control Panel */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                    <Filter className="w-4 h-4 text-emerald-400" />
                    <span>Filter & Scope Ledger</span>
                  </div>
                  {(expenseTypeFilter !== 'all' || expenseCategoryFilter !== 'all' || expenseMonthFilter !== 'all' || expenseStartDate || expenseEndDate) && (
                    <button
                      onClick={() => {
                        setExpenseTypeFilter('all');
                        setExpenseCategoryFilter('all');
                        setExpenseMonthFilter('all');
                        setExpenseStartDate('');
                        setExpenseEndDate('');
                      }}
                      className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Reset Filters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  {/* Type Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-400 uppercase tracking-wider text-[11px]">Type</label>
                    <select
                      value={expenseTypeFilter}
                      onChange={(e) => setExpenseTypeFilter(e.target.value as any)}
                      className="bg-[#0f172a] border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400 transition-colors"
                    >
                      <option value="all">All Types (Income & Expense)</option>
                      <option value="expense">Expenses Only</option>
                      <option value="income">Income Only</option>
                    </select>
                  </div>

                  {/* Month Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-400 uppercase tracking-wider text-[11px]">Month</label>
                    <select
                      value={expenseMonthFilter}
                      onChange={(e) => setExpenseMonthFilter(e.target.value)}
                      className="bg-[#0f172a] border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400 transition-colors"
                    >
                      <option value="all">All Months</option>
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-400 uppercase tracking-wider text-[11px]">Category</label>
                    <select
                      value={expenseCategoryFilter}
                      onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                      className="bg-[#0f172a] border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400 transition-colors"
                    >
                      <option value="all">All Categories</option>
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Filters */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-400 uppercase tracking-wider text-[11px]">Date Range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={expenseStartDate}
                        onChange={(e) => setExpenseStartDate(e.target.value)}
                        placeholder="Start"
                        className="w-1/2 bg-[#0f172a] border border-white/15 rounded-xl px-2 py-2 text-[11px] text-white outline-none focus:border-emerald-400 transition-colors"
                      />
                      <span className="text-slate-500 text-xs">to</span>
                      <input
                        type="date"
                        value={expenseEndDate}
                        onChange={(e) => setExpenseEndDate(e.target.value)}
                        placeholder="End"
                        className="w-1/2 bg-[#0f172a] border border-white/15 rounded-xl px-2 py-2 text-[11px] text-white outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table / Empty / Loading States */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl">
                {transactionsError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-2xl flex items-center justify-between gap-3 mb-4 animate-slideIn">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{transactionsError}</span>
                    </div>
                    <button
                      onClick={loadTransactions}
                      className="text-rose-300 underline font-mono text-xs hover:text-white cursor-pointer shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {transactionsLoading && transactions.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span>Loading ledger records from FINTRACK API...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center gap-3 bg-white/[0.02] rounded-2xl border border-white/5">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 shadow-inner">
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">No transactions recorded yet</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Start logging your revenue or expenses to build your financial history.
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('add-transaction')}
                      className="mt-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-mono font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white/10"
                    >
                      <PlusCircle className="w-4 h-4" /> Add First Transaction
                    </button>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-3 bg-white/[0.02] rounded-2xl border border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                      <Filter className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">No records match your filters</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Try clearing one or more active filters to view your transaction logs.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setExpenseTypeFilter('all');
                        setExpenseCategoryFilter('all');
                        setExpenseMonthFilter('all');
                        setExpenseStartDate('');
                        setExpenseEndDate('');
                      }}
                      className="mt-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-mono text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-white/5 text-slate-400 font-mono text-xs uppercase tracking-wider border-b border-white/10">
                        <tr>
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5">Description</th>
                          <th className="p-3.5">Category</th>
                          <th className="p-3.5">Method</th>
                          <th className="p-3.5">Type</th>
                          <th className="p-3.5 text-right">Amount</th>
                          <th className="p-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                            <td className="p-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{t.date}</td>
                            <td className="p-3.5 font-medium text-white">{t.description || '—'}</td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-white/10 border border-white/15 text-slate-200">
                                {t.category}
                              </span>
                            </td>
                            <td className="p-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{t.paymentMethod || t.method || 'Other'}</td>
                            <td className="p-3.5 text-xs font-mono">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                  t.type === 'income'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td
                              className={`p-3.5 text-right font-mono font-bold whitespace-nowrap ${
                                t.type === 'income' ? 'text-emerald-400' : 'text-slate-100'
                              }`}
                            >
                              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, preferredCurrency)}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openEditModal(t)}
                                  title="Edit transaction"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  disabled={deletingTxId === t.id}
                                  title="Delete transaction"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {deletingTxId === t.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: FINANCIAL ANALYTICS (STEP 7) */}
          {currentTab === 'analytics' && (
            <div className="space-y-6">
              {/* Analytics Header & Timeframe Selector */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Portfolio Trajectory & Analytics</h3>
                  <p className="text-xs text-slate-400 mt-1">Multi-month comparative trends, category distributions, and wealth velocity modeling.</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Period Pills */}
                  <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-2xl">
                    {(['3M', '6M', '1Y', 'ALL'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setAnalyticsPeriod(p);
                          loadAnalytics(p);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                          analyticsPeriod === p
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => loadAnalytics(analyticsPeriod)}
                    disabled={analyticsLoading}
                    title="Refresh analytics metrics"
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {analyticsError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-2xl flex items-center justify-between gap-3 animate-slideIn">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{analyticsError}</span>
                  </div>
                  <button
                    onClick={() => loadAnalytics(analyticsPeriod)}
                    className="text-rose-300 underline font-mono text-xs hover:text-white cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* 4 Dynamic Velocity KPI Cards */}
              {(() => {
                const metrics = analyticsData?.metrics;
                const totalInflow = metrics?.totalIncome ?? 0;
                const avgInflow = metrics?.monthlyAverageIncome ?? 0;
                const totalOutflow = metrics?.totalExpenses ?? 0;
                const avgOutflow = metrics?.monthlyAverageExpense ?? 0;
                const netSavingsVal = metrics?.netSavings ?? 0;
                const savingsRateVal = metrics?.savingsRate ?? 0;
                const projectedAnnualVal = metrics?.projectedAnnualSavings ?? 0;
                const expenseRatioVal = metrics?.expenseToIncomeRatio ?? 0;
                const trends = analyticsData?.monthlyTrends || [];
                const catBreakdown = analyticsData?.categoryBreakdown || [];

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-lg">
                        <span className="text-xs font-mono uppercase text-slate-400">Total Inflow</span>
                        <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                          {formatCurrency(totalInflow, preferredCurrency)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                          Avg {formatCurrency(avgInflow, preferredCurrency)}/mo
                        </span>
                      </div>

                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-lg">
                        <span className="text-xs font-mono uppercase text-slate-400">Total Outflow</span>
                        <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                          {formatCurrency(totalOutflow, preferredCurrency)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                          Avg {formatCurrency(avgOutflow, preferredCurrency)}/mo
                        </span>
                      </div>

                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-lg">
                        <span className="text-xs font-mono uppercase text-slate-400">Net Wealth Generated</span>
                        <div className={`text-2xl font-bold font-mono mt-1 ${netSavingsVal >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                          {formatCurrency(netSavingsVal, preferredCurrency)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                          Savings Rate: {savingsRateVal}%
                        </span>
                      </div>

                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-lg">
                        <span className="text-xs font-mono uppercase text-slate-400">Projected Annual Net</span>
                        <div className="text-2xl font-bold font-mono text-indigo-300 mt-1">
                          {formatCurrency(projectedAnnualVal, preferredCurrency)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                          Expense/Income: {expenseRatioVal}%
                        </span>
                      </div>
                    </div>

                    {/* Main Visualizations Bento: Monthly Trends Bar Comparison & Category Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Monthly Trend Comparative Bar Chart (7 cols) */}
                      <div className="lg:col-span-7 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-white">Monthly Cash Flow Comparison</h4>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">Inflow vs. Outflow trajectory across {analyticsPeriod}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                              <span className="text-slate-300">Income</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                              <span className="text-slate-300">Expense</span>
                            </div>
                          </div>
                        </div>

                        {analyticsLoading && !analyticsData ? (
                          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-xs">
                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                            <span>Computing trajectory models...</span>
                          </div>
                        ) : trends.length === 0 ? (
                          <div className="h-64 flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
                            No historical trends recorded in this period.
                          </div>
                        ) : (
                          <div>
                            {(() => {
                              const maxVal = Math.max(
                                ...trends.flatMap((m) => [m.income ?? 0, m.expense ?? (m as any).expenses ?? 0]),
                                1
                              );
                              return (
                                <div className="h-60 flex items-end justify-between gap-3 pt-6 px-2">
                                  {trends.map((trend) => {
                                    const inc = trend.income ?? 0;
                                    const exp = trend.expense ?? (trend as any).expenses ?? 0;
                                    const net = trend.net ?? (inc - exp);
                                    const label = trend.label || `${trend.month} ${trend.year ? String(trend.year).slice(-2) : ''}` || trend.month;
                                    const incomePct = inc > 0 ? Math.max(10, Math.round((inc / maxVal) * 100)) : 4;
                                    const expensePct = exp > 0 ? Math.max(10, Math.round((exp / maxVal) * 100)) : 4;
                                    return (
                                      <div key={trend.key || `${trend.month}-${trend.year}`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                        <div className="w-full flex items-end justify-center gap-1.5 h-full relative">
                                          {/* Income Bar */}
                                          <div
                                            style={{ height: `${incomePct}%` }}
                                            className="w-1/2 max-w-[20px] rounded-t-lg bg-emerald-400/90 group-hover:brightness-125 transition-all shadow-md shadow-emerald-500/10"
                                            title={`Income: ${formatCurrency(inc, preferredCurrency)}`}
                                          />
                                          {/* Expense Bar */}
                                          <div
                                            style={{ height: `${expensePct}%` }}
                                            className="w-1/2 max-w-[20px] rounded-t-lg bg-rose-400/90 group-hover:brightness-125 transition-all shadow-md shadow-rose-500/10"
                                            title={`Expense: ${formatCurrency(exp, preferredCurrency)}`}
                                          />

                                          {/* Hover Tooltip */}
                                          <div className="absolute -top-12 bg-[#020617] text-white p-2 rounded-xl text-[10px] font-mono border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-2xl">
                                            <div className="text-emerald-400">+{formatCurrency(inc, preferredCurrency)}</div>
                                            <div className="text-rose-400">-{formatCurrency(exp, preferredCurrency)}</div>
                                            <div className="text-slate-400 border-t border-white/10 mt-1 pt-0.5">Net: {formatCurrency(net, preferredCurrency, { showPlusSign: true })}</div>
                                          </div>
                                        </div>
                                        <span className="text-[11px] font-mono text-slate-400 truncate w-full text-center">
                                          {label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Right: Category Expenditure Allocation (5 cols) */}
                      <div className="lg:col-span-5 bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-white">Expense Distribution</h4>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">Ranked category expenditure allocation</p>
                          </div>
                          <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                            {catBreakdown.length} Categories
                          </span>
                        </div>

                        {catBreakdown.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 font-mono text-xs">
                            No expense distributions recorded in this period.
                          </div>
                        ) : (
                          <div className="space-y-4 max-h-[270px] overflow-y-auto pr-1">
                            {catBreakdown.map((cat, idx) => {
                              const gradientColors = [
                                'from-emerald-500 to-teal-400',
                                'from-indigo-500 to-cyan-400',
                                'from-purple-500 to-indigo-400',
                                'from-amber-500 to-orange-400',
                                'from-rose-500 to-pink-500',
                              ];
                              const barColor = gradientColors[idx % gradientColors.length];
                              return (
                                <div key={cat.category} className="space-y-1.5 group">
                                  <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-slate-200 font-semibold truncate max-w-[200px]" title={cat.category}>
                                      {cat.category}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400">{formatCurrency(cat.amount, preferredCurrency)}</span>
                                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                                        {cat.percentage}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                                      className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500 shadow-sm`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB 6: BUDGET MANAGEMENT (STEP 8) */}
          {currentTab === 'budget' && (
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Monthly Category Budgets</h3>
                  <p className="text-xs text-slate-400 mt-1">Set expenditure thresholds and monitor real-time consumption against your transactions.</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Period Picker */}
                  <div className="flex items-center gap-2 bg-[#0f172a] border border-white/15 rounded-xl px-3 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <input
                      type="month"
                      value={budgetPeriod}
                      onChange={(e) => {
                        const newPeriod = e.target.value;
                        setBudgetPeriod(newPeriod);
                        loadBudgets(newPeriod);
                      }}
                      className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => loadBudgets(budgetPeriod)}
                    disabled={budgetsLoading}
                    title="Reload budget telemetry"
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${budgetsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>

                  <button
                    onClick={handleOpenCreateBudget}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20 border border-white/10"
                  >
                    <PlusCircle className="w-4 h-4" /> Set Budget
                  </button>
                </div>
              </div>

              {budgetsError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-2xl flex items-center justify-between gap-3 animate-slideIn">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{budgetsError}</span>
                  </div>
                  <button
                    onClick={() => loadBudgets(budgetPeriod)}
                    className="text-rose-300 underline font-mono text-xs hover:text-white cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Overall Budget Consumption Hero Strip */}
              {budgetSummary && (
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Total Monthly Utilization ({budgetPeriod})</span>
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold font-mono text-white">
                          {formatCurrency(budgetSummary?.totalSpent ?? 0, preferredCurrency)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">
                          of {formatCurrency(budgetSummary?.totalBudgeted ?? 0, preferredCurrency)} budgeted
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-xs font-mono uppercase text-slate-400 block">Remaining Buffer</span>
                        <span className={`text-xl font-bold font-mono ${(budgetSummary?.remainingTotal ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(budgetSummary?.remainingTotal ?? 0, preferredCurrency)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono uppercase text-slate-400 block">Overall Depletion</span>
                        <span className={`text-xl font-bold font-mono ${budgetSummary.overallPercentage > 100 ? 'text-rose-400' : budgetSummary.overallPercentage >= 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {budgetSummary.overallPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mt-6 shadow-inner">
                    <div
                      style={{ width: `${Math.min(100, budgetSummary.overallPercentage)}%` }}
                      className={`h-full rounded-full transition-all duration-500 shadow-md ${
                        budgetSummary.overallPercentage > 100
                          ? 'bg-gradient-to-r from-rose-500 to-red-500'
                          : budgetSummary.overallPercentage >= 80
                          ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Category Budgets Grid */}
              {budgetsLoading && budgets.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Loading category budget limits...</span>
                </div>
              ) : budgets.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center gap-3 bg-white/[0.02] rounded-3xl border border-white/5 p-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 shadow-inner">
                    <Wallet className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base">No budget limits set for {budgetPeriod}</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Establish category spending caps to receive warning alerts before overspending.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenCreateBudget}
                    className="mt-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-mono font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white/10"
                  >
                    <PlusCircle className="w-4 h-4" /> Set First Budget Limit
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {budgets.map((b) => {
                    const isExceeded = b.percentage > 100;
                    const isNearLimit = b.percentage >= 80 && !isExceeded;
                    const progressWidth = Math.min(100, b.percentage);
                    return (
                      <div
                        key={b.id}
                        className={`bg-white/5 backdrop-blur-xl rounded-3xl p-5 border shadow-xl flex flex-col justify-between transition-all hover:border-white/20 group ${
                          isExceeded
                            ? 'border-rose-500/40 bg-rose-500/[0.03]'
                            : isNearLimit
                            ? 'border-amber-500/30 bg-amber-500/[0.02]'
                            : 'border-white/10'
                        }`}
                      >
                        <div>
                          {/* Card Top: Category & Action Buttons */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <h4 className="text-base font-bold text-white truncate" title={b.category}>
                                {b.category}
                              </h4>
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mt-0.5">
                                {b.period}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditBudget(b)}
                                title="Edit budget limit"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBudget(b.id)}
                                disabled={deletingBudgetId === b.id}
                                title="Delete budget limit"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {deletingBudgetId === b.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Consumption Stats */}
                          <div className="flex items-baseline justify-between mt-3 mb-2 font-mono">
                            <span className="text-xl font-bold text-white">
                              {formatCurrency(b.spent ?? 0, preferredCurrency)}
                            </span>
                            <span className="text-xs text-slate-400">
                              Cap: {formatCurrency(b.amount ?? 0, preferredCurrency)}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden mb-2.5">
                            <div
                              style={{ width: `${progressWidth}%` }}
                              className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                                isExceeded
                                  ? 'bg-gradient-to-r from-rose-500 to-red-500'
                                  : isNearLimit
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Card Bottom: Status Badge & Remaining Buffer */}
                        <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-white/10 mt-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isExceeded
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : isNearLimit
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {isExceeded ? `OVER BUDGET (${b.percentage}%)` : isNearLimit ? `WARNING (${b.percentage}%)` : `SAFE (${b.percentage}%)`}
                          </span>

                          <span className={`text-[11px] font-medium ${isExceeded ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                            {(b.remaining ?? 0) >= 0 ? `${formatCurrency(b.remaining ?? 0, preferredCurrency)} buffer` : `${formatCurrency(Math.abs(b.remaining ?? 0), preferredCurrency)} over`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: USER PROFILE (STEP 3) */}
          {currentTab === 'profile' && (
            <div className="max-w-[800px] mx-auto w-full space-y-6 animate-fadeIn">
              {/* Profile Header Hero Card */}
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-xl shadow-indigo-500/20 shrink-0">
                      <div className="w-full h-full bg-[#020617] rounded-[14px] flex items-center justify-center text-white font-bold text-xl">
                        {profile?.name ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM'}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                          {profile?.name || 'Loading Profile...'}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider border flex items-center gap-1.5 ${
                          (profile?.accountType || accountType).toLowerCase() === 'corporate'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {(profile?.accountType || accountType).toLowerCase() === 'corporate' ? (
                            <Building2 className="w-3 h-3" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                          {(profile?.accountType || accountType).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        {profile?.email || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <button
                      type="button"
                      onClick={loadProfile}
                      disabled={profileLoading}
                      title="Refresh profile data"
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-mono px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${profileLoading ? 'animate-spin text-emerald-400' : ''}`} />
                      <span className="hidden sm:inline">Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Account Metadata Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10">
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Account ID</div>
                    <div className="text-xs font-mono text-slate-200 font-semibold mt-0.5 truncate">
                      {profile?.id || '—'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Member Since</div>
                    <div className="text-xs font-mono text-slate-200 font-semibold mt-0.5">
                      {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Security Tier</div>
                    <div className="text-xs font-mono text-emerald-400 font-semibold mt-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Institutional JWT
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Notifications */}
              {profileError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-4 rounded-2xl flex items-start justify-between gap-3 animate-slideIn">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                  <button
                    onClick={loadProfile}
                    className="text-rose-300 underline font-mono text-xs hover:text-white cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {profileSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-4 rounded-2xl flex items-center gap-2.5 animate-slideIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {/* Profile Details Form */}
              <form onSubmit={handleSaveProfile} className="bg-white/5 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl space-y-6">
                <div>
                  <h4 className="text-lg font-bold text-white">Profile Details</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Manage your personal identification and contact coordinates.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Editable: Name */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <span>Full Name</span>
                      <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        disabled={profileLoading || profileSaving}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g., Alex Morgan"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm transition-colors disabled:opacity-50"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">Editable name associated with your portfolio.</p>
                  </div>

                  {/* Editable: Phone */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <span>Phone Number</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={profileLoading || profileSaving}
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="e.g., +91 98765 43210"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none backdrop-blur-md text-sm transition-colors disabled:opacity-50"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">Used for financial SMS notifications & security alerts.</p>
                  </div>

                  {/* Read-Only: Email */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Read-only
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        readOnly
                        disabled
                        value={profile?.email || ''}
                        className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed text-sm font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">Primary identifier linked to credentials. Cannot be changed.</p>
                  </div>

                  {/* Read-Only: Account Type */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Account Classification</span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Read-only
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={profile?.accountType ? (profile.accountType === 'corporate' ? 'Corporate Enterprise Account' : 'Individual Personal Account') : ''}
                        className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed text-sm font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">Tier established during account provisioning.</p>
                  </div>

                  {/* Editable: Preferred Currency */}
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Preferred Currency</span>
                        <span className="text-emerald-400">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Global display preference
                      </span>
                    </label>
                    <div className="relative">
                      <select
                        disabled={profileLoading || profileSaving}
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value)}
                        className="w-full bg-[#0f172a] border border-white/15 rounded-xl px-4 py-3 text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-sm transition-colors disabled:opacity-50 font-mono cursor-pointer"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code} className="bg-[#0f172a] text-white">
                            {c.symbol} {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Controls how monetary values are displayed across Dashboard, Transactions, Analytics, Budgets, and Reports.
                    </p>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={profileSaving || profileLoading}
                    onClick={() => {
                      if (profile) {
                        setEditName(profile.name);
                        setEditPhone(profile.phone || '');
                        setEditCurrency(profile.currency || DEFAULT_CURRENCY);
                        setProfileError(null);
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/15 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Reset Changes
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving || profileLoading}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {profileSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Profile...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Profile Details</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
          {/* TAB 8: SUPPORT & HELP DESK (STEP 10) */}
          {currentTab === 'support' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header & Action Controls */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20 shrink-0">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      Support & Service Desk
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submit support tickets, report technical inquiries, and track resolution timelines.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => loadTickets()}
                    disabled={ticketsLoading}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs border border-white/15 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ticketsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleOpenCreateTicket}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 border border-white/10 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>New Ticket</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Total Tickets</span>
                  <span className="text-2xl font-bold text-white font-mono">{tickets.length}</span>
                </div>
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">Open Tickets</span>
                  <span className="text-2xl font-bold text-emerald-400 font-mono">
                    {tickets.filter((t) => t.status === 'Open').length}
                  </span>
                </div>
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 block mb-1">In Progress</span>
                  <span className="text-2xl font-bold text-indigo-300 font-mono">
                    {tickets.filter((t) => t.status === 'In Progress').length}
                  </span>
                </div>
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 block mb-1">Resolved / Closed</span>
                  <span className="text-2xl font-bold text-slate-300 font-mono">
                    {tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length}
                  </span>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={ticketSearchQuery}
                    onChange={(e) => setTicketSearchQuery(e.target.value)}
                    placeholder="Search tickets by subject, description, or ID..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                  {ticketSearchQuery && (
                    <button
                      onClick={() => setTicketSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Status:</span>
                    <select
                      value={ticketStatusFilter}
                      onChange={(e) => setTicketStatusFilter(e.target.value)}
                      className="bg-[#020617] border border-white/15 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Category:</span>
                    <select
                      value={ticketCategoryFilter}
                      onChange={(e) => setTicketCategoryFilter(e.target.value)}
                      className="bg-[#020617] border border-white/15 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      <option value="Account">Account</option>
                      <option value="Transaction">Transaction</option>
                      <option value="Dashboard">Dashboard</option>
                      <option value="Payment">Payment</option>
                      <option value="Technical Issue">Technical Issue</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* State 1: Loading Skeleton */}
              {ticketsLoading && tickets.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl space-y-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-white/10 rounded-2xl" />
                  ))}
                  <p className="text-center text-xs font-mono text-emerald-400 pt-2">
                    Synchronizing support tickets...
                  </p>
                </div>
              ) : ticketsError && tickets.length === 0 ? (
                /* State 2: Error State */
                <div className="bg-rose-500/10 backdrop-blur-2xl rounded-3xl p-8 border border-rose-500/20 shadow-2xl text-center flex flex-col items-center justify-center max-w-md mx-auto my-6">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">Failed to Load Tickets</h4>
                  <p className="text-xs text-rose-300 mb-6">{ticketsError}</p>
                  <button
                    onClick={() => loadTickets()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs border border-white/20 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Loading</span>
                  </button>
                </div>
              ) : tickets.length === 0 ? (
                /* State 3: Empty State */
                <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-12 border border-white/10 shadow-2xl text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-xl">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">No Support Tickets Found</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    {ticketSearchQuery || ticketStatusFilter !== 'all' || ticketCategoryFilter !== 'all'
                      ? 'No tickets match your active filter criteria. Try resetting filters.'
                      : 'Have questions or experiencing technical difficulties? Create a new support ticket and our team will assist you.'}
                  </p>
                  <button
                    onClick={handleOpenCreateTicket}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/20 cursor-pointer border border-white/10"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Support Ticket</span>
                  </button>
                </div>
              ) : (
                /* State 4: Tickets List */
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase bg-white/10 px-2 py-0.5 rounded-md text-slate-300 border border-white/10">
                            #{t.id.slice(-6).toUpperCase()}
                          </span>

                          {/* Category Badge */}
                          <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {t.category}
                          </span>

                          {/* Priority Badge */}
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border font-semibold ${
                              t.priority === 'High'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : t.priority === 'Medium'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                            }`}
                          >
                            {t.priority} Priority
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1.5 ${
                              t.status === 'Open'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : t.status === 'In Progress'
                                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                : t.status === 'Resolved'
                                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                            }`}
                          >
                            {t.status === 'Open' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                            )}
                            {t.status}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                          {t.subject}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-1 leading-relaxed">
                          {t.description}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-[11px] font-mono text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Created: {new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span>•</span>
                          <span>
                            Updated: {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => setViewingTicket(t)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white text-xs font-mono border border-white/10 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditTicket(t)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white text-xs font-mono border border-white/10 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: NOTIFICATIONS CENTER (STEP 11) */}
          {currentTab === 'notifications' && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Notifications Header KPI Banner */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider">Total Received</span>
                    <Bell className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-white">{notifications.length}</span>
                    <span className="text-[11px] text-slate-400 font-mono">events logged</span>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider">Unread & Active</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-rose-400">{unreadNotificationCount}</span>
                    <span className="text-[11px] text-slate-400 font-mono">action items</span>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider">Transactions</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {notifications.filter((n) => n.type === 'transaction').length}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">ledger alerts</span>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider">Advisory & AI</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-purple-400">
                      {notifications.filter((n) => n.type === 'ai' || n.type === 'budget').length}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">insights</span>
                  </div>
                </div>
              </div>

              {/* Notification Controls Toolbar */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { label: 'All', value: 'all', count: notifications.length },
                    { label: 'Unread', value: 'unread', count: unreadNotificationCount },
                    { label: 'Transactions', value: 'transaction' },
                    { label: 'Budgets', value: 'budget' },
                    { label: 'Support', value: 'support' },
                    { label: 'AI Advisory', value: 'ai' },
                    { label: 'System', value: 'system' }
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setNotificationFilter(tab.value as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                        notificationFilter === tab.value
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                  {unreadNotificationCount > 0 && (
                    <button
                      onClick={handleMarkAllNotificationsRead}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-400 hover:text-emerald-300 text-xs font-mono font-semibold border border-white/15 transition-all cursor-pointer shadow-sm"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Mark All Read</span>
                    </button>
                  )}

                  <button
                    onClick={loadNotifications}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    title="Reload notifications"
                  >
                    <RefreshCw className={`w-4 h-4 ${notificationsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Notifications List View */}
              {notificationsLoading && notifications.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl space-y-4 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-white/10 rounded-2xl" />
                  ))}
                  <p className="text-center text-xs font-mono text-emerald-400 pt-2">
                    Synchronizing in-app notifications...
                  </p>
                </div>
              ) : notificationsError && notifications.length === 0 ? (
                <div className="bg-rose-500/10 backdrop-blur-2xl rounded-3xl p-8 border border-rose-500/20 shadow-2xl text-center flex flex-col items-center justify-center max-w-md mx-auto my-6">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">Failed to Load Notifications</h4>
                  <p className="text-xs text-rose-300 mb-6">{notificationsError}</p>
                  <button
                    onClick={() => loadNotifications()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs border border-white/20 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Loading</span>
                  </button>
                </div>
              ) : (() => {
                const list = notifications.filter((n) => {
                  if (notificationFilter === 'unread') return !n.isRead;
                  if (notificationFilter !== 'all') return n.type === notificationFilter;
                  return true;
                });

                if (list.length === 0) {
                  return (
                    <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-12 border border-white/10 shadow-2xl text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6">
                      <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
                        <Inbox className="w-7 h-7" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1 font-mono">No Notifications Found</h4>
                      <p className="text-xs text-slate-400 max-w-sm font-mono mb-6">
                        {notificationFilter === 'unread'
                          ? 'All caught up! You have zero unread notifications.'
                          : 'No notifications matched the selected filter. Real-time updates for transactions, budgets, support tickets, and AI advice will appear here.'}
                      </p>
                      {notificationFilter !== 'all' && (
                        <button
                          onClick={() => setNotificationFilter('all')}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs border border-white/20 transition-colors cursor-pointer"
                        >
                          View All Notifications
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-3">
                    {list.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          !n.isRead
                            ? 'bg-gradient-to-r from-emerald-500/10 via-white/5 to-transparent border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                            : 'bg-white/5 hover:bg-white/[0.08] border-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm border ${
                              n.type === 'transaction'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : n.type === 'budget'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : n.type === 'support'
                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                : n.type === 'ai'
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {n.type === 'transaction' && <DollarSign className="w-5 h-5" />}
                            {n.type === 'budget' && <Wallet className="w-5 h-5" />}
                            {n.type === 'support' && <HelpCircle className="w-5 h-5" />}
                            {n.type === 'ai' && <Sparkles className="w-5 h-5" />}
                            {n.type === 'system' && <ShieldCheck className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300 font-semibold border border-white/5">
                                {n.type}
                              </span>
                              <h4 className="text-sm font-bold text-white font-mono tracking-tight">{n.title}</h4>
                              {!n.isRead && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                  Unread
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 font-mono leading-relaxed mb-1.5">{n.message}</p>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>{formatRelativeTime(n.createdAt)}</span>
                              <span>•</span>
                              <span className="text-slate-500 text-[10px]">{n.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                          {!n.isRead && (
                            <button
                              onClick={() => handleMarkNotificationRead(n.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-400 text-xs font-mono border border-white/10 transition-colors cursor-pointer"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Mark Read</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteNotification(n.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-200 hover:text-rose-400 text-xs font-mono border border-white/10 transition-colors cursor-pointer"
                            title="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>

      {/* CREATE TICKET MODAL */}
      {showCreateTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#020617]/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Create Support Ticket</h3>
              </div>
              <button
                onClick={() => setShowCreateTicketModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createTicketError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createTicketError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="e.g. Issue importing CSV bank statement"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Category *
                  </label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value as TicketCategory)}
                    className="w-full bg-[#020617] border border-white/15 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="Account">Account</option>
                    <option value="Transaction">Transaction</option>
                    <option value="Dashboard">Dashboard</option>
                    <option value="Payment">Payment</option>
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Priority *
                  </label>
                  <select
                    value={newTicketPriority}
                    onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                    className="w-full bg-[#020617] border border-white/15 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  placeholder="Provide comprehensive details regarding the question or technical difficulty encountered..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTicketModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTicket}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 border border-white/10 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingTicket ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Ticket</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TICKET DETAILS MODAL */}
      {viewingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#020617]/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-white/10 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase bg-white/10 px-2 py-0.5 rounded text-slate-300 border border-white/10">
                    #{viewingTicket.id.slice(-6).toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">
                    {viewingTicket.category}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${
                      viewingTicket.priority === 'High'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : viewingTicket.priority === 'Medium'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                    }`}
                  >
                    {viewingTicket.priority} Priority
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border font-semibold ${
                      viewingTicket.status === 'Open'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : viewingTicket.status === 'In Progress'
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                        : viewingTicket.status === 'Resolved'
                        ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {viewingTicket.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">{viewingTicket.subject}</h3>
              </div>
              <button
                onClick={() => setViewingTicket(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <span className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Detailed Description
                </span>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {viewingTicket.description}
                </div>
              </div>

              {/* Metadata Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs font-mono">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">Created At</span>
                  <span className="text-slate-200">
                    {new Date(viewingTicket.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">Last Updated</span>
                  <span className="text-slate-200">
                    {new Date(viewingTicket.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              {/* Quick Status Action Controls */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {viewingTicket.status !== 'Closed' ? (
                    <button
                      onClick={() => handleQuickStatusChange(viewingTicket, 'Closed')}
                      className="px-3.5 py-2 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 font-mono text-xs border border-slate-500/20 transition-colors cursor-pointer"
                    >
                      Close Ticket
                    </button>
                  ) : (
                    <button
                      onClick={() => handleQuickStatusChange(viewingTicket, 'Open')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-mono text-xs border border-emerald-500/20 transition-colors cursor-pointer"
                    >
                      Reopen Ticket
                    </button>
                  )}
                  {viewingTicket.status === 'Open' && (
                    <button
                      onClick={() => handleQuickStatusChange(viewingTicket, 'In Progress')}
                      className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-xs border border-indigo-500/20 transition-colors cursor-pointer"
                    >
                      Mark In Progress
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const t = viewingTicket;
                      setViewingTicket(null);
                      handleOpenEditTicket(t);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold border border-indigo-400/20 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Ticket</span>
                  </button>
                  <button
                    onClick={() => setViewingTicket(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-mono text-xs border border-white/10 transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TICKET MODAL */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#020617]/95 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Edit Support Ticket</h3>
              </div>
              <button
                onClick={() => setEditingTicket(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editTicketError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editTicketError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTicketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={editTicketSubject}
                  onChange={(e) => setEditTicketSubject(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={editTicketCategory}
                    onChange={(e) => setEditTicketCategory(e.target.value as TicketCategory)}
                    className="w-full bg-[#020617] border border-white/15 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    <option value="Account">Account</option>
                    <option value="Transaction">Transaction</option>
                    <option value="Dashboard">Dashboard</option>
                    <option value="Payment">Payment</option>
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={editTicketPriority}
                    onChange={(e) => setEditTicketPriority(e.target.value as TicketPriority)}
                    className="w-full bg-[#020617] border border-white/15 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Status
                  </label>
                  <select
                    value={editTicketStatus}
                    onChange={(e) => setEditTicketStatus(e.target.value as TicketStatus)}
                    className="w-full bg-[#020617] border border-white/15 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={editTicketDescription}
                  onChange={(e) => setEditTicketDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTicket}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 border border-white/10 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingTicket ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Master prompt string ready for copying
const MASTER_PROMPT = `
# FINTRACK: Intelligent Financial Companion & Management Platform (Frosted Glass Edition)

Create a high-performance, institutional-grade financial SaaS web application named "FINTRACK" with the slogan "Track. Analyze. Grow." built with React, TypeScript, and Tailwind CSS using the Frosted Glass theme.

---

## 1. Visual Identity & Design System Tokens

### Palette & Colors:
- **Base Canvas:** Deep Dark Canvas (\`#020617\`)
- **Glowing Ambient Accents:** Indigo Blur (\`indigo-600/30\`), Emerald Glow (\`emerald-500/20\`), Purple Hue (\`purple-600/20\`)
- **Frosted Containers:** \`bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl\`
- **Interactive Badges:** \`bg-white/10 backdrop-blur-md border border-white/20\`
- **Text:**
  - Headings: \`text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70\` or crisp white (\`text-white\`)
  - Subheadings & Labels: \`text-slate-400\`
- **Status Accents:**
  - Positive/Income: \`emerald-400\` (\`bg-emerald-500/15 border-emerald-500/30\`)
  - Alert/Expense: \`rose-400\` (\`bg-rose-500/15 border-rose-500/30\`)

### Typography:
- **Headings & Body:** \`Inter\`
- **Financial Labels, Codes & Numbers:** \`JetBrains Mono\`
`;
