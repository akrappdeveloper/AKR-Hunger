package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.databinding.ActivityLoginBinding;
import com.ssr.hunger.utils.Constants;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.auth.UserProfileChangeRequest;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.SetOptions;
import com.google.firebase.firestore.WriteBatch;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * Login/Signup Activity matching the web app's authentication flow.
 * Supports email/password and Google Sign-In.
 * Logs Firebase Analytics events (login, sign_up) and identifies users in Crashlytics.
 */
public class LoginActivity extends BaseActivity {

    private static final int RC_SIGN_IN = 9001;

    private ActivityLoginBinding binding;
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private GoogleSignInClient googleSignInClient;
    private boolean isLoginMode = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        // Configure Google Sign-In
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.default_web_client_id))
                .requestEmail()
                .build();
        googleSignInClient = GoogleSignIn.getClient(this, gso);

        setupUI();
        handleIncomingDeepLink();
        handleIncomingEmailPrefill(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Pre-fill email if returned from ForgotPasswordActivity
        android.content.SharedPreferences authPrefs = getSharedPreferences(ForgotPasswordActivity.PREF_AUTH_SECURITY, android.content.Context.MODE_PRIVATE);
        String pendingEmail = authPrefs.getString(ForgotPasswordActivity.KEY_PENDING_RESET_EMAIL, null);
        if (!TextUtils.isEmpty(pendingEmail) && (binding.etEmail.getText() == null || binding.etEmail.getText().toString().trim().isEmpty())) {
            binding.etEmail.setText(pendingEmail);
            binding.etPassword.requestFocus();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingDeepLink();
        handleIncomingEmailPrefill(intent);
    }

    private void handleIncomingEmailPrefill(Intent intent) {
        if (intent != null && intent.hasExtra("email")) {
            String email = intent.getStringExtra("email");
            if (!TextUtils.isEmpty(email)) {
                binding.etEmail.setText(email.trim());
                binding.etPassword.requestFocus();
            }
        }
    }

    private void handleIncomingDeepLink() {
        Intent intent = getIntent();
        if (intent != null && intent.getData() != null) {
            android.net.Uri data = intent.getData();
            String refCode = null;
            java.util.List<String> segments = data.getPathSegments();
            if (segments != null && !segments.isEmpty()) {
                int refIndex = segments.indexOf("referral");
                if (refIndex != -1 && refIndex + 1 < segments.size()) {
                    refCode = segments.get(refIndex + 1);
                }
            }
            if (TextUtils.isEmpty(refCode)) {
                refCode = data.getQueryParameter("ref");
            }
            if (!TextUtils.isEmpty(refCode)) {
                isLoginMode = false;
                updateUI();
                String cleanCode = refCode.trim().toUpperCase();
                binding.etReferralCode.setText(cleanCode);
                binding.etReferralCode.setEnabled(false);
                Toast.makeText(this, "🎁 Referral Code " + cleanCode + " applied! Sign up to get ₹50 free wallet balance.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void setupUI() {
        updateUI();

        // Toggle Login/Signup
        binding.tvToggleMode.setOnClickListener(v -> {
            isLoginMode = !isLoginMode;
            logBreadcrumb("Toggled auth mode to: " + (isLoginMode ? "login" : "signup"));
            updateUI();
        });

        // Forgot Password Navigation
        binding.tvForgotPassword.setOnClickListener(v -> {
            Intent forgotIntent = new Intent(this, ForgotPasswordActivity.class);
            String currentEmail = binding.etEmail.getText() != null ? binding.etEmail.getText().toString().trim() : "";
            if (!TextUtils.isEmpty(currentEmail)) {
                forgotIntent.putExtra("email", currentEmail);
            }
            startActivity(forgotIntent);
        });

        // Email/Password Auth
        binding.btnAuth.setOnClickListener(v -> {
            if (isLoginMode) {
                loginWithEmail();
            } else {
                signUpWithEmail();
            }
        });

        // Google Sign-In
        binding.btnGoogle.setOnClickListener(v -> signInWithGoogle());
    }

    private void updateUI() {
        if (isLoginMode) {
            binding.tvTitle.setText(R.string.login_title);
            binding.tvSubtitle.setText(R.string.login_subtitle);
            binding.btnAuth.setText(R.string.login_button);
            binding.tvToggleMode.setText(R.string.no_account);
            binding.tvForgotPassword.setVisibility(View.VISIBLE);
            binding.tilName.setVisibility(View.GONE);
            binding.tilPhone.setVisibility(View.GONE);
            binding.tilReferralCode.setVisibility(View.GONE);
        } else {
            binding.tvTitle.setText(R.string.signup_title);
            binding.tvSubtitle.setText(R.string.signup_subtitle);
            binding.btnAuth.setText(R.string.signup_button);
            binding.tvToggleMode.setText(R.string.have_account);
            binding.tvForgotPassword.setVisibility(View.GONE);
            binding.tilName.setVisibility(View.VISIBLE);
            binding.tilPhone.setVisibility(View.VISIBLE);
            binding.tilReferralCode.setVisibility(View.VISIBLE);
        }
        binding.tvError.setVisibility(View.GONE);
    }

    private void loginWithEmail() {
        String email = binding.etEmail.getText().toString().trim();
        String password = binding.etPassword.getText().toString().trim();

        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            showError("Please fill in all fields");
            return;
        }

        setLoading(true);
        logBreadcrumb("Attempting email login for: " + email);

        auth.signInWithEmailAndPassword(email, password)
                .addOnSuccessListener(result -> {
                    FirebaseUser user = result.getUser();
                    if (user != null) {
                        crashlyticsHelper.setUser(user);
                        analyticsHelper.setUser(user);

                        // Check if THIS user recently requested a forgot-password reset
                        android.content.SharedPreferences authPrefs = getSharedPreferences(ForgotPasswordActivity.PREF_AUTH_SECURITY, android.content.Context.MODE_PRIVATE);
                        String pendingResetEmail = authPrefs.getString(ForgotPasswordActivity.KEY_PENDING_RESET_EMAIL, null);
                        final boolean wasPasswordResetPending = (pendingResetEmail != null && pendingResetEmail.equalsIgnoreCase(email));

                        // Sync customer profile
                        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                                .get()
                                .addOnSuccessListener(doc -> {
                                    if (!doc.exists()) {
                                        createCustomerProfile(
                                                user.getUid(),
                                                user.getDisplayName() != null && !user.getDisplayName().isEmpty() ? user.getDisplayName() : "Customer",
                                                user.getEmail() != null ? user.getEmail() : email,
                                                user.getPhoneNumber() != null ? user.getPhoneNumber() : "",
                                                password
                                        );
                                    } else if (wasPasswordResetPending) {
                                        // ONLY FORGOT PASSWORD USER: New password replaces existing password in Firestore (ONE TIME)
                                        Map<String, Object> updates = new HashMap<>();
                                        updates.put("password", password);
                                        updates.put("passwordLastReset", Timestamp.now());
                                        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                                                .update(updates)
                                                .addOnSuccessListener(aVoid -> {
                                                    logBreadcrumb("One-time password update completed in customers doc for: " + user.getUid());
                                                });

                                        // Clear the pending reset flag so this only updates ONE TIME
                                        authPrefs.edit()
                                                .remove(ForgotPasswordActivity.KEY_PENDING_RESET_EMAIL)
                                                .remove(ForgotPasswordActivity.KEY_PENDING_RESET_TIMESTAMP)
                                                .apply();

                                        Toast.makeText(this, "✅ New password saved to your account!", Toast.LENGTH_SHORT).show();
                                    }
                                    // For normal logins without forgot password, existing password is NOT rewritten!
                                });
                    }
                    analyticsHelper.logLogin("email_password");
                    logBreadcrumb("Email login successful");
                    setLoading(false);
                    navigateToMain();
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    showError(e.getMessage());
                    recordException("loginWithEmail_failed", e);
                });
    }

    private void signUpWithEmail() {
        String name = binding.etName.getText().toString().trim();
        String email = binding.etEmail.getText().toString().trim();
        String password = binding.etPassword.getText().toString().trim();
        String phone = binding.etPhone.getText().toString().trim();

        if (TextUtils.isEmpty(name) || TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            showError("Please fill in all required fields");
            return;
        }

        setLoading(true);
        logBreadcrumb("Attempting email signup for: " + email);

        auth.createUserWithEmailAndPassword(email, password)
                .addOnSuccessListener(result -> {
                    FirebaseUser user = result.getUser();
                    if (user != null) {
                        crashlyticsHelper.setUser(user);
                        analyticsHelper.setUser(user);
                        analyticsHelper.logSignUp("email_password");
                        logBreadcrumb("Email signup successful: " + user.getUid());

                        // Immediately update Auth profile display name
                        UserProfileChangeRequest profileUpdates = new UserProfileChangeRequest.Builder()
                                .setDisplayName(name)
                                .build();
                        user.updateProfile(profileUpdates);

                        createCustomerProfile(user.getUid(), name, email, phone, password);
                    }
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    showError(e.getMessage());
                    recordException("signUpWithEmail_failed", e);
                });
    }

    private void signInWithGoogle() {
        logBreadcrumb("Initiating Google Sign-In intent");
        Intent signInIntent = googleSignInClient.getSignInIntent();
        startActivityForResult(signInIntent, RC_SIGN_IN);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                firebaseAuthWithGoogle(account.getIdToken());
            } catch (ApiException e) {
                showError("Google sign-in failed: " + e.getMessage());
                recordException("GoogleSignIn_ApiException", e);
            }
        }
    }

    private void firebaseAuthWithGoogle(String idToken) {
        setLoading(true);
        logBreadcrumb("Authenticating with Firebase using Google credential");

        AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        auth.signInWithCredential(credential)
                .addOnSuccessListener(result -> {
                    FirebaseUser user = result.getUser();
                    if (user != null) {
                        crashlyticsHelper.setUser(user);
                        analyticsHelper.setUser(user);
                        analyticsHelper.logLogin("google_sign_in");

                        // Check if customer profile exists
                        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                                .get()
                                .addOnSuccessListener(doc -> {
                                    if (!doc.exists()) {
                                        logBreadcrumb("First Google sign-in, creating customer profile");
                                        analyticsHelper.logSignUp("google_sign_in");
                                        createCustomerProfile(
                                                user.getUid(),
                                                user.getDisplayName() != null ? user.getDisplayName() : "Customer",
                                                user.getEmail() != null ? user.getEmail() : "",
                                                user.getPhoneNumber() != null ? user.getPhoneNumber() : ""
                                        );
                                    } else {
                                        setLoading(false);
                                        navigateToMain();
                                    }
                                })
                                .addOnFailureListener(e -> {
                                    setLoading(false);
                                    showError(e.getMessage());
                                    recordException("GoogleSignIn_FetchProfile_failed", e);
                                });
                    }
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    showError("Authentication failed: " + e.getMessage());
                    recordException("firebaseAuthWithGoogle_failed", e);
                });
    }

    private void createCustomerProfile(String uid, String name, String email, String phone, String password) {
        String enteredReferralCode = binding.etReferralCode != null && binding.etReferralCode.getText() != null
                ? binding.etReferralCode.getText().toString().trim().toUpperCase()
                : "";

        // Generate unique referral code for this user automatically
        String myNewReferralCode = generateUniqueReferralCode(uid);

        if (!TextUtils.isEmpty(enteredReferralCode)) {
            // Check in referralCodes collection first
            db.collection(Constants.COLLECTION_REFERRAL_CODES).document(enteredReferralCode).get()
                    .addOnSuccessListener(refDoc -> {
                        String referrerId = null;
                        String referrerName = "Hunger Friend";

                        if (refDoc != null && refDoc.exists()) {
                            referrerId = refDoc.getString("uid");
                            if (referrerId == null) referrerId = refDoc.getString("userId");
                            if (refDoc.contains("userName") && refDoc.getString("userName") != null) {
                                referrerName = refDoc.getString("userName");
                            }
                        }

                        // Verify not self-referral
                        if (referrerId != null && !referrerId.equals(uid)) {
                            saveProfile(uid, name, email, phone, password, myNewReferralCode, referrerId, referrerName, enteredReferralCode);
                        } else {
                            // Check in customers collection directly if not in referralCodes
                            lookupReferrerInCustomers(enteredReferralCode, uid, name, email, phone, password, myNewReferralCode);
                        }
                    })
                    .addOnFailureListener(e -> lookupReferrerInCustomers(enteredReferralCode, uid, name, email, phone, password, myNewReferralCode));
        } else {
            saveProfile(uid, name, email, phone, password, myNewReferralCode, null, null, null);
        }
    }

    private void lookupReferrerInCustomers(String enteredCode, String uid, String name, String email, String phone, String password, String myNewReferralCode) {
        db.collection(Constants.COLLECTION_CUSTOMERS)
                .whereEqualTo("referralCode", enteredCode)
                .limit(1)
                .get()
                .addOnSuccessListener(snap -> {
                    if (snap != null && !snap.isEmpty()) {
                        DocumentSnapshot doc = snap.getDocuments().get(0);
                        String referrerId = doc.getId();
                        String referrerName = doc.getString("name");
                        if (referrerName == null || referrerName.isEmpty()) referrerName = "Hunger Friend";

                        if (!referrerId.equals(uid)) {
                            saveProfile(uid, name, email, phone, password, myNewReferralCode, referrerId, referrerName, enteredCode);
                            return;
                        }
                    }
                    saveProfile(uid, name, email, phone, password, myNewReferralCode, null, null, null);
                })
                .addOnFailureListener(e -> saveProfile(uid, name, email, phone, password, myNewReferralCode, null, null, null));
    }

    private void saveProfile(String uid, String name, String email, String phone, String password,
                            String myNewReferralCode, String referrerId, String referrerName, String usedCode) {
        Timestamp now = Timestamp.now();
        boolean hasValidReferral = (referrerId != null && !referrerId.isEmpty() && !referrerId.equals(uid));
        double initialWallet = hasValidReferral ? 50.0 : 0.0;

        // 1. Prepare Primary Customer Data
        Map<String, Object> customerData = new HashMap<>();
        customerData.put("name", name);
        customerData.put("email", email);
        if (password != null && !password.isEmpty()) {
            customerData.put("password", password);
        }
        customerData.put("phone", phone != null ? phone : "");
        customerData.put("avatar", "");
        customerData.put("addresses", new ArrayList<>());
        customerData.put("favorites", new ArrayList<>());
        customerData.put("favoriteRestaurants", new ArrayList<>());
        customerData.put("walletBalance", initialWallet);
        customerData.put("membershipStatus", "none");
        customerData.put("isBlocked", false);
        customerData.put("referralCode", myNewReferralCode);
        customerData.put("referralCount", 0);
        customerData.put("referralEarnings", 0.0);
        customerData.put("createdAt", now);
        customerData.put("updatedAt", now);

        if (hasValidReferral) {
            customerData.put("referredBy", referrerId);
            customerData.put("usedReferralCode", usedCode);
        }

        // 2. Save customer document directly to customers/{uid}
        DocumentReference customerRef = db.collection(Constants.COLLECTION_CUSTOMERS).document(uid);
        customerRef.set(customerData, SetOptions.merge())
                .addOnSuccessListener(aVoid -> {
                    logBreadcrumb("Customer profile created successfully in Firestore for: " + uid);
                    setLoading(false);
                    if (hasValidReferral) {
                        Toast.makeText(this, "🎉 Welcome! ₹50 referral bonus added to your wallet!", Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(this, "Welcome to AKR Hunger, " + name + "!", Toast.LENGTH_SHORT).show();
                    }
                    navigateToMain();

                    // Process secondary referral registrations asynchronously in background
                    completeSecondaryReferralRegistration(uid, name, email, phone, myNewReferralCode, referrerId, referrerName, usedCode, customerRef, now);
                })
                .addOnFailureListener(e -> {
                    recordException("customer_profile_save_failed", e);
                    logBreadcrumb("Firestore save warning: " + e.getMessage());
                    setLoading(false);
                    // Auth was already successful, so do not block or strand user on login screen!
                    Toast.makeText(this, "Welcome to AKR Hunger!", Toast.LENGTH_SHORT).show();
                    navigateToMain();

                    // Still attempt secondary registration in background
                    completeSecondaryReferralRegistration(uid, name, email, phone, myNewReferralCode, referrerId, referrerName, usedCode, customerRef, now);
                });
    }

    private void completeSecondaryReferralRegistration(String uid, String name, String email, String phone,
                                                      String myNewReferralCode, String referrerId, String referrerName,
                                                      String usedCode, DocumentReference customerRef, Timestamp now) {
        // Register new referral code in referralCodes collection
        Map<String, Object> codeData = new HashMap<>();
        codeData.put("code", myNewReferralCode);
        codeData.put("uid", uid);
        codeData.put("userId", uid);
        codeData.put("userName", name);
        codeData.put("userEmail", email);
        codeData.put("createdAt", now);
        db.collection(Constants.COLLECTION_REFERRAL_CODES).document(myNewReferralCode)
                .set(codeData, SetOptions.merge())
                .addOnFailureListener(e -> recordException("referralCode_register_failed", e));

        boolean hasValidReferral = (referrerId != null && !referrerId.isEmpty() && !referrerId.equals(uid));
        if (!hasValidReferral) return;

        // Reward referrer (+₹50 wallet, +1 referralCount, +₹50 referralEarnings)
        Map<String, Object> referrerUpdates = new HashMap<>();
        referrerUpdates.put("walletBalance", FieldValue.increment(50.0));
        referrerUpdates.put("referralCount", FieldValue.increment(1));
        referrerUpdates.put("referralEarnings", FieldValue.increment(50.0));
        referrerUpdates.put("referralPointsEarned", FieldValue.increment(50));
        db.collection(Constants.COLLECTION_CUSTOMERS).document(referrerId)
                .update(referrerUpdates)
                .addOnFailureListener(e -> recordException("update_referrer_failed", e));

        // Create record in referrals collection
        DocumentReference referralDocRef = db.collection(Constants.COLLECTION_REFERRALS).document();
        Map<String, Object> referralData = new HashMap<>();
        referralData.put("id", referralDocRef.getId());
        referralData.put("referrerId", referrerId);
        referralData.put("referrerName", referrerName != null ? referrerName : "Hunger Friend");
        referralData.put("referredUserId", uid);
        referralData.put("referredUserName", name);
        referralData.put("referredUserEmail", email);
        referralData.put("referredUserPhone", phone != null ? phone : "");
        referralData.put("referralCode", usedCode);
        referralData.put("rewardAmount", 50.0);
        referralData.put("status", "completed");
        referralData.put("channel", "android");
        referralData.put("createdAt", now);
        referralDocRef.set(referralData, SetOptions.merge())
                .addOnFailureListener(e -> recordException("add_referral_record_failed", e));

        // Wallet transaction for referee
        Map<String, Object> txReferee = new HashMap<>();
        txReferee.put("customerId", uid);
        txReferee.put("amount", 50.0);
        txReferee.put("type", "credit");
        txReferee.put("status", "completed");
        txReferee.put("description", "🎁 Welcome Referral Bonus (" + usedCode + ")");
        txReferee.put("createdAt", now);
        customerRef.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(txReferee)
                .addOnFailureListener(e -> recordException("tx_referee_sub_failed", e));
        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(txReferee)
                .addOnFailureListener(e -> recordException("tx_referee_root_failed", e));

        // Wallet transaction for referrer
        Map<String, Object> txReferrer = new HashMap<>();
        txReferrer.put("customerId", referrerId);
        txReferrer.put("amount", 50.0);
        txReferrer.put("type", "credit");
        txReferrer.put("status", "completed");
        txReferrer.put("description", "🎉 Referral Reward - " + name + " joined");
        txReferrer.put("createdAt", now);
        db.collection(Constants.COLLECTION_CUSTOMERS).document(referrerId)
                .collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(txReferrer)
                .addOnFailureListener(e -> recordException("tx_referrer_sub_failed", e));
        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(txReferrer)
                .addOnFailureListener(e -> recordException("tx_referrer_root_failed", e));

        // Notification for Referrer
        Map<String, Object> notifData = new HashMap<>();
        notifData.put("userId", referrerId);
        notifData.put("title", "🎉 Referral Reward Earned!");
        notifData.put("message", name + " joined using your referral link. ₹50 has been credited to your Hunger Wallet!");
        notifData.put("type", "referral");
        notifData.put("read", false);
        notifData.put("createdAt", now);
        db.collection(Constants.COLLECTION_NOTIFICATIONS).add(notifData)
                .addOnFailureListener(e -> recordException("referrer_notif_failed", e));
    }

    private String generateUniqueReferralCode(String uid) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder("HUNGER");
        Random rnd = new Random();
        for (int i = 0; i < 5; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private void createCustomerProfile(String uid, String name, String email, String phone) {
        createCustomerProfile(uid, name, email, phone, null);
    }

    private void navigateToMain() {
        com.ssr.hunger.utils.NotificationHelper.syncFcmToken(this);
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnAuth.setEnabled(!loading);
        binding.btnGoogle.setEnabled(!loading);
    }

    private void showError(String message) {
        binding.tvError.setText(message);
        binding.tvError.setVisibility(View.VISIBLE);
    }

    @Override
    protected String getScreenName() {
        return isLoginMode ? "Login" : "SignUp";
    }
}
