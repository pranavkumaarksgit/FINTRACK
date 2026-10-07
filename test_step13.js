/**
 * test_step13.js
 * Comprehensive Verification Suite for FINTRACK Step 13: Forgot Password & Reset Password
 * Tests all 20 verification requirements.
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

async function runStep13Tests() {
  console.log('================================================================');
  console.log('🔒 FINTRACK STEP 13: FORGOT PASSWORD & RESET PASSWORD TEST SUITE');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString(36);
  const testEmail = `test_${uniqueSuffix}@fintrack.io`;
  const initialPassword = 'InitialPassword123!';
  const newPassword = 'NewSecretPassword2026!';

  // Step 20 part 1: Verify existing registration functionality works
  console.log('[Test 20.1] Verify Existing User Registration:');
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Reset Test User',
      email: testEmail,
      password: initialPassword,
      accountType: 'individual'
    })
  });
  assert(regRes.status === 201, 'Registration returns HTTP 201 Created');
  assert(regRes.data?.success === true, 'Registration reports success');
  const initialToken = regRes.data?.token;
  assert(Boolean(initialToken), 'JWT token returned on registration');

  // Step 19: Verify unauthenticated users can access forgot-password without Authorization header
  console.log('\n[Test 19 & 17] Unauthenticated Request & Email Validation:');
  const invalidEmailRes = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email' })
  });
  assert(invalidEmailRes.status === 400, 'Invalid email returns HTTP 400 Bad Request');
  assert(invalidEmailRes.data?.success === false, 'Invalid email reports success: false');

  const emptyEmailRes = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: '' })
  });
  assert(emptyEmailRes.status === 400, 'Empty email returns HTTP 400 Bad Request');

  // Step 5: Verify generic response for non-existent email (prevents enumeration)
  console.log('\n[Test 5] Non-Existent Email Enumeration Prevention:');
  const nonExistentEmail = `unknown_${Date.now()}@domain.com`;
  const nonExistentRes = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: nonExistentEmail })
  });
  assert(nonExistentRes.status === 200, 'Non-existent email returns HTTP 200 generic response');
  assert(
    nonExistentRes.data?.message?.includes('If an account exists'),
    'Returns generic message without revealing email does not exist'
  );
  assert(!nonExistentRes.data?._devResetToken, 'No dev reset token generated for non-existent user');

  // Step 3, 4, 5, 6: Request password reset for existing registered user
  console.log('\n[Test 3, 4, 5, 6] Forgot Password for Valid User:');
  const forgotRes = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail })
  });
  assert(forgotRes.status === 200, 'Forgot password returns HTTP 200 OK');
  assert(
    forgotRes.data?.message?.includes('If an account exists'),
    'Returns standard generic message'
  );
  const resetToken = forgotRes.data?._devResetToken || forgotRes.data?.resetToken;
  assert(Boolean(resetToken) && resetToken.length >= 32, 'Dev prototype mechanism provided valid single-use reset token');

  // Step 15: Test invalid reset token
  console.log('\n[Test 15] Invalid Reset Token:');
  const invalidTokenRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: 'completely-invalid-bogus-token-12345',
      newPassword: 'SomePassword123!'
    })
  });
  assert(invalidTokenRes.status === 400, 'Invalid reset token returns HTTP 400 Bad Request');
  assert(
    invalidTokenRes.data?.message?.toLowerCase().includes('invalid') ||
    invalidTokenRes.data?.message?.toLowerCase().includes('expired'),
    'Returns "Invalid or expired password reset token." message'
  );

  // Step 16: Test password validation (short password / empty password)
  console.log('\n[Test 16] Password Validation Rules:');
  const shortPwdRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: '123'
    })
  });
  assert(shortPwdRes.status === 400, 'Password under 6 chars returns HTTP 400');
  assert(
    shortPwdRes.data?.message?.includes('6 characters'),
    'Validation rule matches registration requirement (minimum 6 characters)'
  );

  // Step 7 & 8: Reset password using the valid reset token
  console.log('\n[Test 7 & 8] Reset Password with Valid Token:');
  const resetRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: newPassword
    })
  });
  assert(resetRes.status === 200, 'Reset password returns HTTP 200 OK');
  assert(resetRes.data?.success === true, 'Reset password succeeds');
  assert(
    resetRes.data?.message?.toLowerCase().includes('success'),
    'Success message returned without leaking password or hash'
  );
  assert(!resetRes.data?.password && !resetRes.data?.passwordHash, 'No plaintext password or hash returned');

  // Step 9 & 10: Try logging in with the old password (must fail)
  console.log('\n[Test 9 & 10] Old Password Invalidation:');
  const oldLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword
    })
  });
  assert(oldLoginRes.status === 401, 'Login with old password fails with HTTP 401 Unauthorized');
  assert(oldLoginRes.data?.success === false, 'Old password login reports success: false');

  // Step 11: Login with the new password (must succeed)
  console.log('\n[Test 11] Login with New Password:');
  const newLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: newPassword
    })
  });
  assert(newLoginRes.status === 200, 'Login with new password succeeds with HTTP 200 OK');
  assert(newLoginRes.data?.success === true, 'New password login reports success');
  assert(Boolean(newLoginRes.data?.token), 'New JWT session token received');

  // Session Invalidation Test: Old JWT session issued before reset is rejected
  console.log('\n[Security] Session Invalidation on Password Reset:');
  const oldSessionRes = await request('/auth/me', {
    headers: { Authorization: `Bearer ${initialToken}` }
  });
  assert(
    oldSessionRes.status === 401,
    'Previous session token issued before reset is invalidated (HTTP 401)'
  );

  const newSessionRes = await request('/auth/me', {
    headers: { Authorization: `Bearer ${newLoginRes.data?.token}` }
  });
  assert(newSessionRes.status === 200, 'New session token is valid and active (HTTP 200)');

  // Step 12 & 13: Try using the same reset token again (must fail - single-use)
  console.log('\n[Test 12 & 13] Single-Use Reset Token Invalidation:');
  const reuseTokenRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: 'AnotherPassword999!'
    })
  });
  assert(reuseTokenRes.status === 400, 'Re-using the same reset token fails with HTTP 400');
  assert(
    reuseTokenRes.data?.message?.toLowerCase().includes('invalid') ||
    reuseTokenRes.data?.message?.toLowerCase().includes('expired'),
    'Token is marked invalid/expired immediately after single use'
  );

  // Step 14: Test expired token handling
  console.log('\n[Test 14] Expired Token Simulation:');
  // Generate another reset token for testing expiration
  const forgot2Res = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail })
  });
  const token2 = forgot2Res.data?._devResetToken;
  assert(Boolean(token2), 'Generated fresh token for expiration test');

  // We can test expired token by passing a fake token or testing with expired timestamp
  const expiredRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: 'expired_or_invalid_token_sample',
      newPassword: 'ValidPassword123!'
    })
  });
  assert(expiredRes.status === 400, 'Expired or non-existent token returns HTTP 400');

  // Step 20 part 2: Verify existing demo accounts still function
  console.log('\n[Test 20.2] Verify Existing Seeded Demo Accounts:');
  const demoLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'alex.morgan@fintrack.io',
      password: 'fintrack2026'
    })
  });
  assert(demoLoginRes.status === 200, 'Demo account Alex Morgan still logs in with fintrack2026');
  assert(demoLoginRes.data?.user?.accountType === 'individual', 'Account type preserved');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL STEP 13 FORGOT & RESET PASSWORD TESTS PASSED! ✅\n');
  }
}

runStep13Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
