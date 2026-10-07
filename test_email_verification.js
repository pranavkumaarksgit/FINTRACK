/**
 * test_email_verification.js
 * Comprehensive Verification Suite for FINTRACK: EMAIL VERIFICATION & AUTH FLOW
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

async function runEmailVerificationTests() {
  console.log('================================================================');
  console.log('✉️  FINTRACK EMAIL VERIFICATION & AUTH FLOW TEST SUITE');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString(36);
  const testEmail = `verify_user_${uniqueSuffix}@fintrack.io`;
  const testPassword = 'SecurePassword2026!';
  const testName = 'Verification Test User';

  // 1. Existing verified accounts can log in immediately
  console.log('[Test 1] Existing Seeded Demo Users Can Log In (Backward Compatibility):');
  const demoLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'alex.morgan@fintrack.io',
      password: 'fintrack2026'
    })
  });
  assert(demoLogin.status === 200, 'Alex Morgan logs in successfully with HTTP 200');
  assert(demoLogin.data?.user?.emailVerified === true, 'Alex Morgan has emailVerified === true');

  // 2. Register a new user
  console.log('\n[Test 2] Registration Flow & emailVerified Flag:');
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: testPassword,
      accountType: 'individual'
    })
  });
  assert(regRes.status === 201, 'Registration returns HTTP 201 Created');
  assert(regRes.data?.user?.emailVerified === false, 'New user created with emailVerified === false');
  assert(regRes.data?.requiresVerification === true, 'Response payload flags requiresVerification === true');
  const verificationToken = regRes.data?._devVerificationToken || regRes.data?.verificationToken;
  assert(Boolean(verificationToken) && verificationToken.length === 64, 'Secure 32-byte (64 hex) verification token generated');

  // 3. Login attempt before email verification
  console.log('\n[Test 3] Login Security: Unverified User Blocked from Logging In:');
  const unverifiedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  assert(unverifiedLogin.status === 403, `Unverified login returns HTTP 403 Forbidden (got: ${unverifiedLogin.status})`);
  assert(unverifiedLogin.data?.requiresVerification === true, 'Response contains requiresVerification flag');
  assert(
    unverifiedLogin.data?.message?.includes('verify your email'),
    `Message directs user to verify email (got: "${unverifiedLogin.data?.message}")`
  );

  // 4. Invalid Verification Token
  console.log('\n[Test 4] Validation: Invalid Verification Token Rejected:');
  const invalidTokenRes = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: 'completely_bogus_token_12345' })
  });
  assert(invalidTokenRes.status === 400, 'Invalid token returns HTTP 400 Bad Request');
  assert(
    invalidTokenRes.data?.message?.toLowerCase().includes('invalid') ||
    invalidTokenRes.data?.message?.toLowerCase().includes('expired'),
    'Returns proper invalid/expired error message'
  );

  // 5. Empty Verification Token
  console.log('\n[Test 5] Validation: Empty Token Rejected:');
  const emptyTokenRes = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: '' })
  });
  assert(emptyTokenRes.status === 400, 'Empty token returns HTTP 400 Bad Request');

  // 6. Resend Verification Link
  console.log('\n[Test 6] Resend Verification Endpoint:');
  const invalidEmailRes = await request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid-email-format' })
  });
  assert(invalidEmailRes.status === 400, 'Invalid email returns HTTP 400 Bad Request');

  const resendValidRes = await request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail })
  });
  assert(resendValidRes.status === 200, 'Resend request returns HTTP 200 OK');
  assert(resendValidRes.data?.success === true, 'Resend reports success: true');
  const newVerificationToken = resendValidRes.data?._devVerificationToken || resendValidRes.data?.verificationToken;
  assert(Boolean(newVerificationToken) && newVerificationToken !== verificationToken, 'New fresh token generated on resend');

  // 7. Old token invalidated by resend
  console.log('\n[Test 7] Invalidation: Old Token No Longer Usable:');
  const oldTokenTry = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: verificationToken })
  });
  assert(oldTokenTry.status === 400, 'Prior token invalidated and returns HTTP 400');

  // 8. Verify email with valid fresh token
  console.log('\n[Test 8] Successful Email Verification:');
  const verifyRes = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: newVerificationToken })
  });
  assert(verifyRes.status === 200, 'Valid verification returns HTTP 200 OK');
  assert(
    verifyRes.data?.message?.includes('verified successfully'),
    `Returns success confirmation message (got: "${verifyRes.data?.message}")`
  );

  // 9. Single-use token protection (token reuse prevented)
  console.log('\n[Test 9] Token Invalidation: Re-using Verification Token Fails:');
  const reuseRes = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: newVerificationToken })
  });
  assert(reuseRes.status === 400, 'Re-using same token rejected with HTTP 400 Bad Request');

  // 10. Login succeeds now that email is verified
  console.log('\n[Test 10] Login Succeeds Post-Verification:');
  const verifiedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  assert(verifiedLogin.status === 200, 'Login succeeds with HTTP 200 OK');
  assert(verifiedLogin.data?.user?.emailVerified === true, 'User payload confirms emailVerified === true');
  assert(Boolean(verifiedLogin.data?.token), 'Active JWT session issued upon successful login');

  // 11. Profile API reflects emailVerified
  console.log('\n[Test 11] Profile Verification State:');
  const profileRes = await request('/users/profile', {
    headers: { Authorization: `Bearer ${verifiedLogin.data?.token}` }
  });
  assert(profileRes.status === 200, 'GET /users/profile returns HTTP 200');
  assert(profileRes.data?.data?.emailVerified === true, 'Profile confirms emailVerified === true');

  // 12. Non-existent email resend does not reveal account absence
  console.log('\n[Test 12] Resend Non-Existent Email Enumeration Protection:');
  const nonExistentRes = await request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: `fake_nonexistent_${Date.now()}@domain.com` })
  });
  assert(nonExistentRes.status === 200, 'Non-existent email returns generic HTTP 200');
  assert(nonExistentRes.data?._devVerificationToken === undefined, 'No token generated for non-existent email');

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmailVerificationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
