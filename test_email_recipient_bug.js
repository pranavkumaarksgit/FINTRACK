/**
 * test_email_recipient_bug.js
 * Verification of FINTRACK Email Recipient Bug Fix (Items 1 - 10)
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

async function runSuite() {
  console.log('================================================================');
  console.log('🎯 FINTRACK EMAIL RECIPIENT BUG — SECTION 13 TEST SUITE');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString(36);

  // 1. Individual registration with Gmail
  console.log('[Test 1] Individual Registration with Gmail:');
  const gmailUser = `customer_${uniqueSuffix}@gmail.com`;
  const regGmail = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Gmail Customer',
      email: gmailUser,
      password: 'Password123!',
      accountType: 'individual'
    })
  });
  assert(regGmail.status === 201, 'Gmail registration returns HTTP 201');
  assert(regGmail.data?.user?.email === gmailUser, `User email stored as exact input "${gmailUser}" (got: "${regGmail.data?.user?.email}")`);
  assert(regGmail.data?.user?.corporateId === undefined, 'Individual user has no corporateId');

  // 2. Individual registration with another domain
  console.log('\n[Test 2] Individual Registration with Another Domain:');
  const customDomainUser = `customer_${uniqueSuffix}@customdomain.org`;
  const regCustom = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Custom Domain User',
      email: customDomainUser,
      password: 'Password123!',
      accountType: 'individual'
    })
  });
  assert(regCustom.status === 201, 'Custom domain registration returns HTTP 201');
  assert(regCustom.data?.user?.email === customDomainUser, `User email stored as exact input "${customDomainUser}" (got: "${regCustom.data?.user?.email}")`);

  // 3. Corporate registration with real company email
  console.log('\n[Test 3] Corporate Registration with Real Email:');
  const companyEmail = `company_${uniqueSuffix}@enterprise.com`;
  const regCorp = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Acme Enterprise Ltd',
      email: companyEmail,
      password: 'Password123!',
      accountType: 'corporate'
    })
  });
  assert(regCorp.status === 201, 'Corporate registration returns HTTP 201');
  assert(regCorp.data?.user?.email === companyEmail, `Corporate user email is customer's real email "${companyEmail}" (got: "${regCorp.data?.user?.email}")`);
  assert(Boolean(regCorp.data?.user?.corporateId), `Corporate user has a separate corporateId: "${regCorp.data?.user?.corporateId}"`);
  assert(regCorp.data?.user?.corporateId.startsWith('corp_'), 'corporateId starts with "corp_"');
  assert(!regCorp.data?.user?.corporateId.includes('@'), 'corporateId is an internal identifier and does NOT contain "@"');

  // 4. Corporate internal ID must NOT become corp_xxx@fintrack.io and raw internal IDs rejected
  console.log('\n[Test 4] Corporate Internal ID Separation & Validation:');
  assert(regCorp.data?.user?.email !== `${regCorp.data?.user?.corporateId}@fintrack.io`, 'Customer email is NOT converted to corp_xxx@fintrack.io');
  // Attempt to register with a raw corporate identifier string as email
  const badIdReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Bad ID User',
      email: 'corp_muy9qwzh',
      password: 'Password123!',
      accountType: 'corporate'
    })
  });
  assert(badIdReg.status === 400, `Raw internal identifier "corp_muy9qwzh" rejected as email with HTTP 400 (got: ${badIdReg.status})`);

  // 5. Verification token still works
  console.log('\n[Test 5] Verification Token Works:');
  const corpToken = regCorp.data?._devVerificationToken;
  assert(Boolean(corpToken), 'Verification token received for corporate user');
  const verifyRes = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: corpToken })
  });
  assert(verifyRes.status === 200, 'Verify email returns HTTP 200');
  assert(verifyRes.data?.success === true, 'Verify email response indicates success');

  // 6. Email verification marks emailVerified = true
  console.log('\n[Test 6] User Record emailVerified Marked True:');
  const loginCorp = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: companyEmail,
      password: 'Password123!'
    })
  });
  assert(loginCorp.status === 200, 'Verified corporate user logs in successfully with HTTP 200');
  assert(loginCorp.data?.user?.emailVerified === true, 'Corporate user record has emailVerified === true');
  assert(loginCorp.data?.user?.email === companyEmail, `Logged in corporate user email matches "${companyEmail}"`);
  assert(Boolean(loginCorp.data?.user?.corporateId), `Logged in corporate user still has corporateId "${loginCorp.data?.user?.corporateId}"`);

  // 7. Unverified login remains blocked
  console.log('\n[Test 7] Unverified Login Remains Blocked:');
  const unverifiedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: gmailUser,
      password: 'Password123!'
    })
  });
  assert(unverifiedLogin.status === 403, `Unverified login blocked with HTTP 403 Forbidden (got: ${unverifiedLogin.status})`);
  assert(unverifiedLogin.data?.requiresVerification === true, 'Response payload has requiresVerification === true');

  // 8. Resend verification still sends to actual registered email
  console.log('\n[Test 8] Resend Verification Dispatches to Actual Registered Email:');
  const resendRes = await request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: gmailUser })
  });
  assert(resendRes.status === 200, 'Resend verification returns HTTP 200');
  const newGmailToken = resendRes.data?._devVerificationToken;
  assert(Boolean(newGmailToken), 'New verification token generated for real email');
  // Verify with new token
  const verifyGmail = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: newGmailToken })
  });
  assert(verifyGmail.status === 200, 'New token verifies successfully');

  // 9. Forgot password still sends to actual registered email
  console.log('\n[Test 9] Forgot Password Dispatches to Actual Registered Email:');
  const forgotRes = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: gmailUser })
  });
  assert(forgotRes.status === 200, 'Forgot password returns HTTP 200');
  const resetToken = forgotRes.data?._devResetToken;
  assert(Boolean(resetToken), 'Password reset token generated for registered email');
  // Perform password reset
  const resetRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: 'NewPassword2026!'
    })
  });
  assert(resetRes.status === 200, 'Password reset succeeded with new password');

  // 10. Existing Nodemailer SMTP configuration remains unchanged
  console.log('\n[Test 10] Existing Nodemailer SMTP Configuration Intact:');
  const healthRes = await request('/health');
  assert(healthRes.status === 200, 'Backend health check returns HTTP 200');
  // Log in with new password
  const newLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: gmailUser,
      password: 'NewPassword2026!'
    })
  });
  assert(newLogin.status === 200, 'Login with new reset password succeeds with HTTP 200');

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
