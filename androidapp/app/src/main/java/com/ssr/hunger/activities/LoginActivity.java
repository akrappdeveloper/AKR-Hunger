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
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

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
    }

    private void setupUI() {
        updateUI();

        // Toggle Login/Signup
        binding.tvToggleMode.setOnClickListener(v -> {
            isLoginMode = !isLoginMode;
            logBreadcrumb("Toggled auth mode to: " + (isLoginMode ? "login" : "signup"));
            updateUI();
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
            binding.tilName.setVisibility(View.GONE);
            binding.tilPhone.setVisibility(View.GONE);
        } else {
            binding.tvTitle.setText(R.string.signup_title);
            binding.tvSubtitle.setText(R.string.signup_subtitle);
            binding.btnAuth.setText(R.string.signup_button);
            binding.tvToggleMode.setText(R.string.have_account);
            binding.tilName.setVisibility(View.VISIBLE);
            binding.tilPhone.setVisibility(View.VISIBLE);
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
                    setLoading(false);
                    FirebaseUser user = result.getUser();
                    if (user != null) {
                        crashlyticsHelper.setUser(user);
                        analyticsHelper.setUser(user);
                    }
                    analyticsHelper.logLogin("email_password");
                    logBreadcrumb("Email login successful");
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
                        createCustomerProfile(user.getUid(), name, email, phone);
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

    private void createCustomerProfile(String uid, String name, String email, String phone) {
        Map<String, Object> customerData = new HashMap<>();
        customerData.put("name", name);
        customerData.put("email", email);
        customerData.put("phone", phone);
        customerData.put("avatar", "");
        customerData.put("addresses", new ArrayList<>());
        customerData.put("favorites", new ArrayList<>());
        customerData.put("favoriteRestaurants", new ArrayList<>());
        customerData.put("walletBalance", 0);
        customerData.put("membershipStatus", "none");
        customerData.put("isBlocked", false);
        customerData.put("createdAt", com.google.firebase.Timestamp.now());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                .set(customerData)
                .addOnSuccessListener(aVoid -> {
                    setLoading(false);
                    logBreadcrumb("Customer profile created in Firestore");
                    navigateToMain();
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    showError("Failed to create profile: " + e.getMessage());
                    recordException("createCustomerProfile_failed", e);
                });
    }

    private void navigateToMain() {
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
