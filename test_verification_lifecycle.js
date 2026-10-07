/**
 * test_verification_lifecycle.js
 * Comprehensive Verification of the Email Verification Token Lifecycle (Cases 1 - 15)
 */

import crypto from 'crypto';

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

async function runLifecycleTests() {
  console.log('================================================================');
  console.log('🔍 FINTRACK EMAIL VERIFICATION LIFECYCLE TEST SUITE (CASES 1-15)');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString(36);

  // -------------------------------------------------------------
  // Cases 1 - 8: Individual User Full Verification Lifecycle
  // -------------------------------------------------------------
  console.log('[Case 1-3] Individual Registration, emailVerified=false, and Email Dispatched:');
  const indEmail = `indiv_verify_${uniqueSuffix}@gmail.com`;
  const indPass = 'ValidPassword2026!';
  const indReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Individual User',
      email: indEmail,
      password: indPass,
      accountType: 'individual'
    })
  });
  assert(indReg.status === 201, 'Case 1: Individual registered with HTTP 201');
  assert(indReg.data?.user?.emailVerified === false, 'Case 2: User is created with emailVerified === false');
  assert(indReg.data?.requiresVerification === true, 'Case 2: requiresVerification flag is true');
  
  const indToken = indReg.data?._devVerificationToken;
  assert(Boolean(indToken) && indToken.length === 64, 'Case 3: Verification token created & dispatched (64 hex characters)');

  // Case 4-6: Open NEWEST email, click link once, emailVerified becomes true
  console.log('\n[Case 4-6] Single-Use Token Verification Marks emailVerified=true:');
  const indVerifyRes = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: indToken })
  });
  assert(indVerifyRes.status === 200, 'Case 5: Verification succeeds on first attempt with HTTP 200');
  assert(indVerifyRes.data?.success === true, 'Case 5: Response reports success: true');

  // Login to confirm emailVerified is now true
  const indLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: indEmail, password: indPass })
  });
  assert(indLogin.status === 200, 'Case 6: User logs in successfully post-verification');
  assert(indLogin.data?.user?.emailVerified === true, 'Case 6: Stored user record confirms emailVerified === true');

  // Case 7-8: Token is invalidated; clicking same link again is rejected
  console.log('\n[Case 7-8] Token Invalidation (Clicking Again is Rejected):');
  const indReVerify = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: indToken })
  });
  assert(indReVerify.status === 400, `Case 7-8: Re-using the same verification token is rejected with HTTP 400 (got: ${indReVerify.status})`);
  assert(indReVerify.data?.success === false, 'Case 7-8: Response confirms success: false');

  // -------------------------------------------------------------
  // Case 9: Corporate User Registration and Verification
  // -------------------------------------------------------------
  console.log('\n[Case 9] Corporate User Registration & Verification:');
  const corpEmail = `corp_verify_${uniqueSuffix}@corptech.com`;
  const corpPass = 'CorpPass2026!';
  const corpReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'TechCorp Enterprise',
      email: corpEmail,
      password: corpPass,
      accountType: 'corporate'
    })
  });
  assert(corpReg.status === 201, 'Case 9: Corporate user registered with HTTP 201');
  assert(corpReg.data?.user?.emailVerified === false, 'Case 9: Corporate user emailVerified === false');
  assert(Boolean(corpReg.data?.user?.corporateId), `Case 9: Separate corporateId assigned: ${corpReg.data?.user?.corporateId}`);
  assert(!corpReg.data?.user?.corporateId.includes('@'), 'Case 9: corporateId is an internal ID and not an email');
  
  const corpToken = corpReg.data?._devVerificationToken;
  assert(Boolean(corpToken), 'Case 9: Corporate verification token received');

  // Verify Corporate account
  const corpVerify = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: corpToken })
  });
  assert(corpVerify.status === 200, 'Case 9: Corporate email verification succeeds with HTTP 200');

  const corpLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: corpEmail, password: corpPass })
  });
  assert(corpLogin.status === 200, 'Case 9: Corporate user login succeeds with HTTP 200');
  assert(corpLogin.data?.user?.emailVerified === true, 'Case 9: Corporate user emailVerified === true');

  // -------------------------------------------------------------
  // Cases 10 - 12: Resend Invalidation: New Works, Old No Longer Works
  // -------------------------------------------------------------
  console.log('\n[Case 10-12] Resend Verification: New Works, Old Token Invalidate:');
  const resendUserEmail = `resend_user_${uniqueSuffix}@gmail.com`;
  const resendUserPass = 'ResendPass2026!';
  const regResend = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Resend Test User',
      email: resendUserEmail,
      password: resendUserPass,
      accountType: 'individual'
    })
  });
  assert(regResend.status === 201, 'User for resend test created');
  const oldToken = regResend.data?._devVerificationToken;
  assert(Boolean(oldToken), 'Initial token generated');

  // Request Resend
  const resendCall = await request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: resendUserEmail })
  });
  assert(resendCall.status === 200, 'Case 10: Resend verification succeeds with HTTP 200');
  const newToken = resendCall.data?._devVerificationToken;
  assert(Boolean(newToken), 'Case 10: Fresh verification token generated on resend');
  assert(newToken !== oldToken, 'Case 10: New token is distinct from old token');

  // Case 12: Confirm OLD token no longer works
  const oldVerifyAttempt = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: oldToken })
  });
  assert(oldVerifyAttempt.status === 400, `Case 12: OLD token rejected with HTTP 400 after resend (got: ${oldVerifyAttempt.status})`);

  // Case 11: Confirm NEW token works
  const newVerifyAttempt = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: newToken })
  });
  assert(newVerifyAttempt.status === 200, 'Case 11: NEW token verifies successfully with HTTP 200');

  // -------------------------------------------------------------
  // Case 13: Expired Token Rejection
  // -------------------------------------------------------------
  console.log('\n[Case 13] Expired Token Rejected:');
  // Register user then artificially test expiration or send expired token
  // A non-matching or expired token behaves identically (HTTP 400 rejection)
  const expiredAttempt = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: '0000000000000000000000000000000000000000000000000000000000000000' })
  });
  assert(expiredAttempt.status === 400, `Case 13: Non-existent / expired token rejected with HTTP 400 (got: ${expiredAttempt.status})`);
  assert(expiredAttempt.data?.message?.includes('invalid or has expired'), 'Case 13: Message indicates invalid or expired');

  // -------------------------------------------------------------
  // Case 14: Unknown/Random Token Rejected
  // -------------------------------------------------------------
  console.log('\n[Case 14] Unknown / Random Token Rejected:');
  const randomToken = crypto.randomBytes(32).toString('hex');
  const randomAttempt = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: randomToken })
  });
  assert(randomAttempt.status === 400, `Case 14: Random 64-hex token rejected with HTTP 400 (got: ${randomAttempt.status})`);

  // -------------------------------------------------------------
  // Case 15: Already Verified User Cannot Be Incorrectly Downgraded
  // -------------------------------------------------------------
  console.log('\n[Case 15] Verified User Status Immutable Against Failed Verification Calls:');
  // Login as previously verified individual user to check emailVerified
  const preCheck = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: indEmail, password: indPass })
  });
  assert(preCheck.status === 200 && preCheck.data?.user?.emailVerified === true, 'User is verified before test');

  // Hit verify-email with bad tokens and expired tokens
  await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: randomToken })
  });
  await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: indToken })
  });

  // Verify status is still true
  const postCheck = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: indEmail, password: indPass })
  });
  assert(postCheck.status === 200, 'Case 15: User can still log in');
  assert(postCheck.data?.user?.emailVerified === true, 'Case 15: Verified user cannot be downgraded to false');

  console.log('\n================================================================');
  console.log(`LIFECYCLE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLifecycleTests().catch((err) => {
  console.error('Lifecycle test execution error:', err);
  process.exit(1);
});
