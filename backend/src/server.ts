import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import transactionRoutes from './routes/transactions.js';
import dashboardRoutes from './routes/dashboard.js';
import analyticsRoutes from './routes/analytics.js';
import budgetRoutes from './routes/budgets.js';
import aiRoutes from './routes/ai.js';
import supportRoutes from './routes/support.js';
import notificationRoutes from './routes/notifications.js';
import { verifyEmailConnection } from './services/email.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env, then root .env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

verifyEmailConnection();

const app = express();

// Step 3: Configure CORS specifically for frontend development server
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, Postman) or requests from allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const PORT = process.env.PORT || 8000;

// Step 2: Backend Health API endpoint
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    success: true,
    message: "FINTRACK API is running",
    timestamp: new Date().toISOString()
  });
});

// Mount Authentication, User Profile, Transaction, Dashboard, Analytics & Budget routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Initialize Groq client exclusively
let groqClient: Groq | null = null;

if (GROQ_API_KEY && GROQ_API_KEY !== 'MY_GROQ_API_KEY' && GROQ_API_KEY.trim() !== '') {
  groqClient = new Groq({ apiKey: GROQ_API_KEY });
  console.log(`Initialized Groq client (Primary model: ${GROQ_MODEL})`);
} else {
  console.warn("WARNING: GROQ_API_KEY is not configured in backend/.env. AI advisor responses will run in simulation mode.");
}

app.post('/api/chat', async (req: express.Request, res: express.Response) => {
  const { message, history, financialData } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Fallback to simulated response if Groq is not configured
  if (!groqClient) {
    const text = message.toLowerCase();
    let reply = {
      text: `[Simulation Mode] Analysis complete for "${message}". Based on your recent transactions, your net balance stands at ₹${financialData?.balance?.toLocaleString('en-IN') || '0'}.`,
      bullets: [
        `Total Monthly Income: ₹${financialData?.totalIncome?.toLocaleString('en-IN') || '0'}`,
        `Current Expenses: ₹${financialData?.totalExpense?.toLocaleString('en-IN') || '0'}`,
        `Savings Efficiency: ${financialData?.savingsRate || 0}%`
      ],
      note: "Set GROQ_API_KEY in backend/.env to enable real Groq AI advisor intelligence."
    };
    return res.json(reply);
  }

  const systemInstruction = `You are Fintrack AI, a high-performance, intelligent financial companion and wealth-building advisor. Your goal is to analyze user finances and provide actionable, custom guidance.

User's financial details:
- Net Balance: ₹${financialData?.balance || 0}
- Total Income: ₹${financialData?.totalIncome || 0}
- Total Expense: ₹${financialData?.totalExpense || 0}
- Savings Rate: ${financialData?.savingsRate || 0}%
- Transactions: ${JSON.stringify(financialData?.transactions || [])}

Analyze the user's message in the context of their chat history and financial status.

Provide your response strictly in a valid JSON object matching this schema:
{
  "text": "The main content text, explaining your analysis and observations.",
  "bullets": ["Bullet point 1", "Bullet point 2"], // 2-4 highly relevant suggestions, statistics, or recommendations.
  "note": "A short, encouraging note or follow-up question (under 20 words)."
}`;

  function parseJsonSafe(raw: string) {
    try {
      return JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    }
  }

  try {
    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction }
    ];

    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        if (h.sender === 'user') {
          groqMessages.push({ role: 'user', content: h.text });
        } else if (h.sender === 'ai') {
          const bulletsText = h.bullets ? h.bullets.map((b: string) => `* ${b}`).join('\n') : '';
          const noteText = h.note ? `\nNote: ${h.note}` : '';
          groqMessages.push({ role: 'assistant', content: `${h.text}\n${bulletsText}${noteText}` });
        }
      });
    }

    groqMessages.push({ role: 'user', content: message });

    const candidateModels = [GROQ_MODEL, 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'].filter((v, i, a) => a.indexOf(v) === i);
    let responseText: string | null | undefined = null;
    let lastErr: any = null;

    for (const model of candidateModels) {
      try {
        const completion = await groqClient.chat.completions.create({
          model: model,
          messages: groqMessages,
          response_format: { type: 'json_object' }
        });
        responseText = completion.choices[0]?.message?.content;
        if (responseText) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`Groq request failed with model ${model}, trying fallback if available...`);
      }
    }

    if (!responseText) {
      throw new Error(lastErr?.message || "Empty response received from Groq API");
    }

    const responseData = parseJsonSafe(responseText);
    return res.json(responseData);
  } catch (error: any) {
    console.error("Groq AI Error:", error);
    res.status(500).json({ error: "Failed to generate AI response: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Fintrack Backend running at http://localhost:${PORT}`);
});
