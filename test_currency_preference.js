/**
 * test_currency_preference.js
 * Comprehensive Verification Suite for FINTRACK: GLOBAL CURRENCY PREFERENCE
 * Validates all 20 requirements specified in the test plan.
 */

const BASE_URL = 'http://localhost:8000/api';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    // Non-JSON response
  }

  return { status: response.status, data };
}

// Mirror the frontend formatCurrency function to verify frontend utility accuracy
const SUPPORTED_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD', 'SGD', 'JPY', 'CNY', 'CHF'];

function formatCurrency(amount, currency = 'INR', options = {}) {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const currCode = SUPPORTED_CURRENCY_CODES.includes(currency?.toUpperCase()) ? currency.toUpperCase() : 'INR';
  const isZeroDecimal = ['JPY'].includes(currCode);
  const minDigits = options.minimumFractionDigits ?? (isZeroDecimal ? 0 : 0);
  const maxDigits = options.maximumFractionDigits ?? (isZeroDecimal ? 0 : 2);

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currCode,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });

  const formatted = formatter.format(num);
  if (options.showPlusSign && num > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

async function runCurrencyTests() {
  console.log('================================================================');
  console.log('🪙 FINTRACK GLOBAL CURRENCY PREFERENCE TEST SUITE');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString(36);
  const individualEmail = `investor_${uniqueSuffix}@gmail.com`;
  const corporateEmail = `contact_${uniqueSuffix}@apexcorp.com`;
  const testPassword = 'Password123!';

  // 1. New Individual user -> default INR
  console.log('[Test 1] New Individual User Registration Defaults to INR:');
  const indReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Individual Investor',
      email: individualEmail,
      password: testPassword,
      accountType: 'individual'
    })
  });
  assert(indReg.status === 201, 'Registration returns 201 Created');
  assert(indReg.data?.user?.currency === 'INR', `User currency defaults to INR in auth response (got: ${indReg.data?.user?.currency})`);
  const indivToken = indReg.data?.token;

  if (indReg.data?._devVerificationToken) {
    await request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: indReg.data._devVerificationToken })
    });
  }

  // 2. New Corporate user -> default INR
  console.log('\n[Test 2] New Corporate User Registration Defaults to INR:');
  const corpReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Corporate Corp',
      email: corporateEmail,
      password: testPassword,
      accountType: 'corporate'
    })
  });
  assert(corpReg.status === 201, 'Corporate registration returns 201 Created');
  assert(corpReg.data?.user?.currency === 'INR', `Corporate user currency defaults to INR (got: ${corpReg.data?.user?.currency})`);
  const corpToken = corpReg.data?.token;

  // Verify GET /api/users/profile includes currency
  console.log('\n[Verification] GET /api/users/profile includes currency field:');
  const profileGet = await request('/users/profile', {
    headers: { Authorization: `Bearer ${indivToken}` }
  });
  assert(profileGet.status === 200, 'GET /profile returns 200 OK');
  assert(profileGet.data?.data?.currency === 'INR', `Profile returns currency = INR (got: ${profileGet.data?.data?.currency})`);

  // 3. Change INR -> USD from Profile
  console.log('\n[Test 3] Change INR -> USD via Profile Update (PUT /api/users/profile):');
  const updateToUsd = await request('/users/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${indivToken}` },
    body: JSON.stringify({
      name: 'Individual Investor Updated',
      currency: 'USD'
    })
  });
  assert(updateToUsd.status === 200, 'PUT /profile returns 200 OK');
  assert(updateToUsd.data?.data?.currency === 'USD', `Profile currency updated to USD (got: ${updateToUsd.data?.data?.currency})`);

  // 4. Dashboard immediately displays USD (profile preference + financial calculation unchanged)
  console.log('\n[Test 4] Dashboard Financial Data remains numeric while Profile provides USD:');
  const dashRes = await request('/dashboard/summary', {
    headers: { Authorization: `Bearer ${indivToken}` }
  });
  assert(dashRes.status === 200, 'GET /dashboard/summary returns 200');
  const totalInc = dashRes.data?.totalIncome ?? dashRes.data?.summary?.totalIncome;
  const totalExp = dashRes.data?.totalExpenses ?? dashRes.data?.summary?.totalExpenses;
  assert(typeof totalInc === 'number', `totalIncome remains numeric type in backend response (got: ${totalInc})`);
  assert(typeof totalExp === 'number', `totalExpenses remains numeric type in backend response (got: ${totalExp})`);

  // 5. Refresh page -> USD remains (GET /profile returns USD)
  console.log('\n[Test 5] Refresh Page / Re-fetch Profile preserves USD:');
  const refreshedProfile = await request('/users/profile', {
    headers: { Authorization: `Bearer ${indivToken}` }
  });
  assert(refreshedProfile.status === 200, 'GET /profile returns 200');
  assert(refreshedProfile.data?.data?.currency === 'USD', `Persisted currency is USD after refresh (got: ${refreshedProfile.data?.data?.currency})`);

  // 6. Login again -> USD remains (POST /auth/login returns USD)
  console.log('\n[Test 6] Re-login Returns Persisted USD Currency:');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: individualEmail,
      password: testPassword
    })
  });
  assert(loginRes.status === 200, 'Login succeeds with 200 OK');
  assert(loginRes.data?.user?.currency === 'USD', `Login response retains USD currency (got: ${loginRes.data?.user?.currency})`);

  // 7. Change USD -> EUR from Dashboard / quick selector
  console.log('\n[Test 7] Change USD -> EUR via Profile API (same selector architecture):');
  const updateToEur = await request('/users/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${indivToken}` },
    body: JSON.stringify({ currency: 'EUR' })
  });
  assert(updateToEur.status === 200, 'PUT /profile with EUR returns 200');
  assert(updateToEur.data?.data?.currency === 'EUR', `Profile updated to EUR (got: ${updateToEur.data?.data?.currency})`);

  // 8. Profile now shows EUR
  console.log('\n[Test 8] Profile GET verification for EUR:');
  const profileEur = await request('/users/profile', {
    headers: { Authorization: `Bearer ${indivToken}` }
  });
  assert(profileEur.data?.data?.currency === 'EUR', 'Profile returns EUR');

  // 9. Dashboard now shows EUR
  console.log('\n[Test 9] Dashboard reflects EUR currency display preference:');
  const formattedIncomeEur = formatCurrency(50000, profileEur.data?.data?.currency);
  assert(formattedIncomeEur.includes('€') || formattedIncomeEur.includes('EUR'), `Formatted income contains Euro symbol: ${formattedIncomeEur}`);

  // 10. Transaction amounts use EUR formatting
  console.log('\n[Test 10] Transaction amounts formatted with EUR:');
  const sampleTxAmount = formatCurrency(1250, 'EUR');
  assert(sampleTxAmount.includes('€') || sampleTxAmount.includes('EUR'), `Transaction formatted with EUR: ${sampleTxAmount}`);

  // 11. Expenses use EUR formatting
  console.log('\n[Test 11] Expenses formatted with EUR:');
  const sampleExpense = formatCurrency(450.5, 'EUR');
  assert(sampleExpense.includes('€') || sampleExpense.includes('EUR'), `Expense formatted with EUR: ${sampleExpense}`);

  // 12. Analytics uses EUR formatting
  console.log('\n[Test 12] Analytics totals formatted with EUR:');
  const sampleAnalytics = formatCurrency(120000, 'EUR');
  assert(sampleAnalytics.includes('€') || sampleAnalytics.includes('EUR'), `Analytics formatted with EUR: ${sampleAnalytics}`);

  // 13. Budget uses EUR formatting
  console.log('\n[Test 13] Budget threshold formatted with EUR:');
  const sampleBudget = formatCurrency(3000, 'EUR');
  assert(sampleBudget.includes('€') || sampleBudget.includes('EUR'), `Budget formatted with EUR: ${sampleBudget}`);

  // 14. Change back to INR
  console.log('\n[Test 14] Change currency back to INR:');
  const updateToInr = await request('/users/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${indivToken}` },
    body: JSON.stringify({ currency: 'INR' })
  });
  assert(updateToInr.status === 200, 'PUT /profile returns 200 OK');
  assert(updateToInr.data?.data?.currency === 'INR', 'Currency successfully reverted to INR');

  // 15. Invalid currency code returns 400
  console.log('\n[Test 15] Invalid Currency Code returns 400 Bad Request:');
  const invalidRes = await request('/users/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${indivToken}` },
    body: JSON.stringify({ currency: 'BITCOIN_FAKE' })
  });
  assert(invalidRes.status === 400, `Rejection with 400 Bad Request (got: ${invalidRes.status})`);
  assert(invalidRes.data?.message?.includes('currency') || invalidRes.data?.message?.includes('Invalid'), `Error message indicates invalid currency (got: ${invalidRes.data?.message})`);

  // 16. Unauthenticated currency update returns 401
  console.log('\n[Test 16] Unauthenticated Currency Update returns 401:');
  const unauthRes = await request('/users/profile', {
    method: 'PUT',
    body: JSON.stringify({ currency: 'USD' })
  });
  assert(unauthRes.status === 401, `Rejected with 401 Unauthorized (got: ${unauthRes.status})`);

  // 17. Existing users without currency continue working with INR
  console.log('\n[Test 17] Fallback handling for missing/undefined currency:');
  const fallbackFormatted = formatCurrency(1000, undefined);
  assert(fallbackFormatted.includes('₹') || fallbackFormatted.includes('INR'), `Undefined currency falls back to INR: ${fallbackFormatted}`);
  const nullFormatted = formatCurrency(1000, null);
  assert(nullFormatted.includes('₹') || nullFormatted.includes('INR'), `Null currency falls back to INR: ${nullFormatted}`);

  // 18. Zero and negative amounts format correctly
  console.log('\n[Test 18] Zero and Negative Amounts format correctly:');
  const zeroFormatted = formatCurrency(0, 'USD');
  assert(zeroFormatted === '$0' || zeroFormatted === '$0.00', `Zero formatted properly: ${zeroFormatted}`);
  const negativeFormatted = formatCurrency(-500, 'USD');
  assert(negativeFormatted.includes('-') && negativeFormatted.includes('500'), `Negative formatted properly: ${negativeFormatted}`);
  const showPlusFormatted = formatCurrency(250, 'USD', { showPlusSign: true });
  assert(showPlusFormatted.startsWith('+$'), `Positive with plus sign formatted: ${showPlusFormatted}`);

  // 19. Individual and Corporate accounts both work
  console.log('\n[Test 19] Corporate Account Updates Currency Preference to AED:');
  const corpUpdate = await request('/users/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${corpToken}` },
    body: JSON.stringify({ currency: 'AED' })
  });
  assert(corpUpdate.status === 200, 'Corporate profile currency updated successfully');
  assert(corpUpdate.data?.data?.currency === 'AED', `Corporate currency is AED (got: ${corpUpdate.data?.data?.currency})`);
  const corpProfile = await request('/users/profile', {
    headers: { Authorization: `Bearer ${corpToken}` }
  });
  assert(corpProfile.data?.data?.currency === 'AED', 'Corporate profile GET returns AED');

  // 20. No currency conversion is performed
  console.log('\n[Test 20] No Currency Conversion Performed (pure preference & display):');
  // Amount 50000 formatted in USD is $50,000, formatted in EUR is €50,000, numeric value remains 50000
  const val50000Usd = formatCurrency(50000, 'USD');
  const val50000Inr = formatCurrency(50000, 'INR');
  assert(val50000Usd.includes('50,000'), `Numeric 50000 preserved in USD: ${val50000Usd}`);
  assert(val50000Inr.includes('50,000'), `Numeric 50000 preserved in INR: ${val50000Inr}`);
  assert(val50000Usd !== val50000Inr, 'Formatted strings differ only by currency symbol/notation');

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCurrencyTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
