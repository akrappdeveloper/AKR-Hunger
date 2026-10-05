const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..');
const write = (rel, content) => {
    const full = path.join(base, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    console.log('✓', rel, '(' + content.length + ' bytes)');
};

// ─────────────────────────────────────────────────────────────────────
// 1. Permission Dialog Layout (Beautiful custom bottom sheet)
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/layout/dialog_permission.xml', `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:background="@color/surface"
    android:gravity="center_horizontal"
    android:orientation="vertical"
    android:paddingHorizontal="28dp"
    android:paddingTop="36dp"
    android:paddingBottom="28dp">

    <!-- Animated Permission Icon Container -->
    <FrameLayout
        android:layout_width="88dp"
        android:layout_height="88dp"
        android:layout_marginBottom="20dp">

        <!-- Background Circle -->
        <View
            android:layout_width="88dp"
            android:layout_height="88dp"
            android:background="@drawable/bg_permission_icon_circle" />

        <!-- Icon -->
        <ImageView
            android:id="@+id/iv_permission_icon"
            android:layout_width="44dp"
            android:layout_height="44dp"
            android:layout_gravity="center"
            android:src="@drawable/ic_location"
            app:tint="@color/primary" />
    </FrameLayout>

    <!-- Title -->
    <TextView
        android:id="@+id/tv_permission_title"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:fontFamily="sans-serif-black"
        android:gravity="center"
        android:text="Enable Location"
        android:textColor="@color/text_primary"
        android:textSize="22sp" />

    <!-- Subtitle -->
    <TextView
        android:id="@+id/tv_permission_subtitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:fontFamily="sans-serif"
        android:gravity="center"
        android:lineSpacingMultiplier="1.4"
        android:text="We need your location to show nearby restaurants and deliver your food to the right address."
        android:textColor="@color/text_secondary"
        android:textSize="14sp" />

    <!-- Features List -->
    <LinearLayout
        android:id="@+id/ll_permission_features"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="20dp"
        android:background="@drawable/bg_card_subtle"
        android:orientation="vertical"
        android:padding="16dp">

        <!-- Feature rows added programmatically -->
    </LinearLayout>

    <!-- Primary CTA Button -->
    <com.google.android.material.button.MaterialButton
        android:id="@+id/btn_permission_allow"
        style="@style/Widget.AKR.Button.Primary"
        android:layout_width="match_parent"
        android:layout_height="56dp"
        android:layout_marginTop="24dp"
        android:text="Allow Access"
        android:textSize="16sp" />

    <!-- Skip / Deny Button -->
    <com.google.android.material.button.MaterialButton
        android:id="@+id/btn_permission_deny"
        style="@style/Widget.Material3.Button.TextButton"
        android:layout_width="match_parent"
        android:layout_height="48dp"
        android:layout_marginTop="6dp"
        android:text="Not Now"
        android:textColor="@color/text_hint"
        android:textSize="14sp" />

    <!-- Settings Redirect (shown when permanently denied) -->
    <LinearLayout
        android:id="@+id/ll_settings_hint"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="12dp"
        android:background="@drawable/bg_warning_subtle"
        android:gravity="center"
        android:orientation="horizontal"
        android:padding="10dp"
        android:visibility="gone">

        <ImageView
            android:layout_width="14dp"
            android:layout_height="14dp"
            android:src="@drawable/ic_info"
            app:tint="@color/warning" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="6dp"
            android:fontFamily="sans-serif-medium"
            android:text="Permission denied. Open Settings to enable."
            android:textColor="@color/warning"
            android:textSize="12sp" />
    </LinearLayout>
</LinearLayout>
`);

// ─────────────────────────────────────────────────────────────────────
// 2. Permission Feature Row item layout
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/layout/item_permission_feature.xml', `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginBottom="10dp"
    android:gravity="center_vertical"
    android:orientation="horizontal">

    <ImageView
        android:id="@+id/iv_feature_icon"
        android:layout_width="18dp"
        android:layout_height="18dp"
        android:src="@drawable/ic_check_circle"
        app:tint="@color/success" />

    <TextView
        android:id="@+id/tv_feature_text"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_marginStart="10dp"
        android:layout_weight="1"
        android:fontFamily="sans-serif-medium"
        android:textColor="@color/text_secondary"
        android:textSize="13sp" />
</LinearLayout>
`);

// ─────────────────────────────────────────────────────────────────────
// 3. bg_permission_icon_circle drawable
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/bg_permission_icon_circle.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="@color/primary_tint" />
</shape>
`);

// ─────────────────────────────────────────────────────────────────────
// 4. bg_card_subtle for feature list box
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/bg_card_subtle.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/surface_variant" />
    <corners android:radius="16dp" />
</shape>
`);

// ─────────────────────────────────────────────────────────────────────
// 5. bg_warning_subtle
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/bg_warning_subtle.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFF8E1" />
    <corners android:radius="12dp" />
    <stroke android:width="1dp" android:color="#FFD54F" />
</shape>
`);

// ─────────────────────────────────────────────────────────────────────
// 6. ic_check_circle drawable (simple vector)
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/ic_check_circle.xml', `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="@android:color/transparent"
        android:pathData="M9,12l2,2l4,-4m6,2a9,9 0,1 1,-18,0a9,9 0,0 1,18,0z"
        android:strokeColor="#4CAF50"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:strokeWidth="2" />
</vector>
`);

// ─────────────────────────────────────────────────────────────────────
// 7. ic_info drawable
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/ic_info.xml', `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="@android:color/transparent"
        android:pathData="M12,2A10,10 0,1 0,22 12,10,10 0,0 0,12 2ZM12,6a1,1 0,1 1,0 2,1,1 0,0 1,0 -2ZM11,10h2v8h-2z"
        android:strokeColor="#FFA000"
        android:strokeWidth="1.5" />
</vector>
`);

// ─────────────────────────────────────────────────────────────────────
// 8. Redesigned activity_splash.xml  (Professional gradient with animation)
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/layout/activity_splash.xml', `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/bg_splash_gradient">

    <!-- Ambient blurred orbs (decorative circles) -->
    <View
        android:layout_width="320dp"
        android:layout_height="320dp"
        android:layout_gravity="top|end"
        android:layout_marginTop="-80dp"
        android:layout_marginEnd="-80dp"
        android:alpha="0.18"
        android:background="@drawable/bg_orb_primary" />

    <View
        android:layout_width="260dp"
        android:layout_height="260dp"
        android:layout_gravity="bottom|start"
        android:layout_marginStart="-60dp"
        android:layout_marginBottom="-60dp"
        android:alpha="0.12"
        android:background="@drawable/bg_orb_secondary" />

    <!-- Center Content -->
    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:gravity="center"
        android:orientation="vertical">

        <!-- Logo with soft shadow card -->
        <com.google.android.material.card.MaterialCardView
            android:layout_width="100dp"
            android:layout_height="100dp"
            app:cardCornerRadius="28dp"
            app:cardElevation="16dp"
            app:strokeWidth="0dp"
            xmlns:app="http://schemas.android.com/apk/res-auto">

            <ImageView
                android:id="@+id/iv_logo"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:padding="16dp"
                android:scaleType="fitCenter"
                android:src="@drawable/logo_akr_hunger" />
        </com.google.android.material.card.MaterialCardView>

        <!-- App Name -->
        <TextView
            android:id="@+id/tv_app_name"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="20dp"
            android:fontFamily="sans-serif-black"
            android:letterSpacing="0.04"
            android:text="AKR Hunger"
            android:textColor="@color/text_primary"
            android:textSize="32sp" />

        <!-- Tagline -->
        <TextView
            android:id="@+id/tv_tagline"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="6dp"
            android:fontFamily="sans-serif-medium"
            android:text="Order Food Online • Fast Delivery"
            android:textColor="@color/text_secondary"
            android:textSize="13sp"
            android:letterSpacing="0.02" />
    </LinearLayout>

    <!-- Bottom loader + version -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_gravity="bottom"
        android:layout_marginBottom="40dp"
        android:gravity="center"
        android:orientation="vertical">

        <com.google.android.material.progressindicator.LinearProgressIndicator
            android:id="@+id/progress_splash"
            android:layout_width="120dp"
            android:layout_height="wrap_content"
            android:indeterminate="true"
            app:indicatorColor="@color/primary"
            app:trackColor="@color/primary_tint"
            app:trackCornerRadius="4dp"
            app:trackThickness="4dp"
            xmlns:app="http://schemas.android.com/apk/res-auto" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:fontFamily="sans-serif"
            android:text="© 2024 AKR Hunger"
            android:textColor="@color/text_hint"
            android:textSize="11sp" />
    </LinearLayout>
</FrameLayout>
`);

// ─────────────────────────────────────────────────────────────────────
// 9. Splash background gradient drawable
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/bg_splash_gradient.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/background" />
</shape>
`);

// Orb drawables
write('androidapp/app/src/main/res/drawable/bg_orb_primary.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="@color/primary" />
</shape>
`);

write('androidapp/app/src/main/res/drawable/bg_orb_secondary.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="@color/secondary" />
</shape>
`);

// ─────────────────────────────────────────────────────────────────────
// 10. Redesigned activity_login.xml
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/layout/activity_login.xml', `<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background"
    android:fitsSystemWindows="true">

    <androidx.core.widget.NestedScrollView
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:fillViewport="true">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:minHeight="100dp"
            android:orientation="vertical"
            android:paddingHorizontal="28dp"
            android:paddingTop="72dp"
            android:paddingBottom="32dp">

            <!-- Logo + Greeting -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="center"
                android:orientation="vertical"
                android:layout_marginBottom="36dp">

                <com.google.android.material.card.MaterialCardView
                    android:layout_width="72dp"
                    android:layout_height="72dp"
                    app:cardCornerRadius="20dp"
                    app:cardElevation="8dp"
                    app:strokeWidth="0dp">

                    <ImageView
                        android:layout_width="match_parent"
                        android:layout_height="match_parent"
                        android:padding="12dp"
                        android:scaleType="fitCenter"
                        android:src="@drawable/logo_akr_hunger" />
                </com.google.android.material.card.MaterialCardView>

                <TextView
                    android:id="@+id/tv_login_title"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="18dp"
                    android:fontFamily="sans-serif-black"
                    android:text="@string/login_title"
                    android:textColor="@color/text_primary"
                    android:textSize="28sp" />

                <TextView
                    android:id="@+id/tv_login_subtitle"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="6dp"
                    android:fontFamily="sans-serif"
                    android:text="@string/login_subtitle"
                    android:textColor="@color/text_secondary"
                    android:textSize="14sp" />
            </LinearLayout>

            <!-- Tab Switcher -->
            <com.google.android.material.tabs.TabLayout
                android:id="@+id/tab_auth"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:background="@drawable/bg_card_subtle"
                android:layout_marginBottom="28dp"
                app:tabBackground="@android:color/transparent"
                app:tabGravity="fill"
                app:tabIndicator="@drawable/tab_indicator_pill"
                app:tabIndicatorColor="@color/primary"
                app:tabIndicatorHeight="0dp"
                app:tabMode="fixed"
                app:tabRippleColor="@android:color/transparent"
                app:tabSelectedTextColor="@color/primary"
                app:tabTextAppearance="@style/TextAppearance.AKR.Tab"
                app:tabTextColor="@color/text_hint"
                app:tabPaddingStart="6dp"
                app:tabPaddingEnd="6dp" />

            <!-- Form Card -->
            <com.google.android.material.card.MaterialCardView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                app:cardCornerRadius="24dp"
                app:cardElevation="4dp"
                app:strokeWidth="1dp"
                app:strokeColor="@color/card_border">

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:padding="20dp">

                    <!-- Name (Sign Up only) -->
                    <com.google.android.material.textfield.TextInputLayout
                        android:id="@+id/til_name"
                        style="@style/Widget.AKR.TextInput"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:layout_marginBottom="14dp"
                        android:hint="@string/name_hint"
                        android:visibility="gone"
                        app:startIconDrawable="@drawable/ic_profile"
                        app:startIconTint="@color/text_hint">

                        <com.google.android.material.textfield.TextInputEditText
                            android:id="@+id/et_name"
                            android:layout_width="match_parent"
                            android:layout_height="wrap_content"
                            android:imeOptions="actionNext"
                            android:inputType="textPersonName|textCapWords"
                            android:textColor="@color/text_primary"
                            android:textSize="15sp" />
                    </com.google.android.material.textfield.TextInputLayout>

                    <!-- Phone (Sign Up only) -->
                    <com.google.android.material.textfield.TextInputLayout
                        android:id="@+id/til_phone"
                        style="@style/Widget.AKR.TextInput"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:layout_marginBottom="14dp"
                        android:hint="@string/phone_hint"
                        android:visibility="gone"
                        app:startIconDrawable="@drawable/ic_phone"
                        app:startIconTint="@color/text_hint">

                        <com.google.android.material.textfield.TextInputEditText
                            android:id="@+id/et_phone"
                            android:layout_width="match_parent"
                            android:layout_height="wrap_content"
                            android:imeOptions="actionNext"
                            android:inputType="phone"
                            android:textColor="@color/text_primary"
                            android:textSize="15sp" />
                    </com.google.android.material.textfield.TextInputLayout>

                    <!-- Email -->
                    <com.google.android.material.textfield.TextInputLayout
                        android:id="@+id/til_email"
                        style="@style/Widget.AKR.TextInput"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:layout_marginBottom="14dp"
                        android:hint="@string/email_hint"
                        app:startIconDrawable="@drawable/ic_mail"
                        app:startIconTint="@color/text_hint">

                        <com.google.android.material.textfield.TextInputEditText
                            android:id="@+id/et_email"
                            android:layout_width="match_parent"
                            android:layout_height="wrap_content"
                            android:imeOptions="actionNext"
                            android:inputType="textEmailAddress"
                            android:textColor="@color/text_primary"
                            android:textSize="15sp" />
                    </com.google.android.material.textfield.TextInputLayout>

                    <!-- Password -->
                    <com.google.android.material.textfield.TextInputLayout
                        android:id="@+id/til_password"
                        style="@style/Widget.AKR.TextInput"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:hint="@string/password_hint"
                        app:endIconMode="password_toggle"
                        app:startIconDrawable="@drawable/ic_lock"
                        app:startIconTint="@color/text_hint">

                        <com.google.android.material.textfield.TextInputEditText
                            android:id="@+id/et_password"
                            android:layout_width="match_parent"
                            android:layout_height="wrap_content"
                            android:imeOptions="actionDone"
                            android:inputType="textPassword"
                            android:textColor="@color/text_primary"
                            android:textSize="15sp" />
                    </com.google.android.material.textfield.TextInputLayout>

                    <!-- Forgot Password -->
                    <TextView
                        android:id="@+id/tv_forgot_password"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_gravity="end"
                        android:layout_marginTop="8dp"
                        android:clickable="true"
                        android:focusable="true"
                        android:fontFamily="sans-serif-medium"
                        android:text="Forgot Password?"
                        android:textColor="@color/primary"
                        android:textSize="13sp" />
                </LinearLayout>
            </com.google.android.material.card.MaterialCardView>

            <!-- Error Text -->
            <TextView
                android:id="@+id/tv_error"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:background="@drawable/bg_error_subtle"
                android:fontFamily="sans-serif-medium"
                android:gravity="center"
                android:padding="12dp"
                android:textColor="@color/error"
                android:textSize="13sp"
                android:visibility="gone" />

            <!-- Primary Auth Button -->
            <com.google.android.material.button.MaterialButton
                android:id="@+id/btn_login"
                style="@style/Widget.AKR.Button.Primary"
                android:layout_width="match_parent"
                android:layout_height="56dp"
                android:layout_marginTop="20dp"
                android:text="@string/login_button"
                android:textSize="16sp" />

            <!-- Divider -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginVertical="20dp"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <View
                    android:layout_width="0dp"
                    android:layout_height="1dp"
                    android:layout_weight="1"
                    android:background="@color/card_border" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginHorizontal="14dp"
                    android:fontFamily="sans-serif-medium"
                    android:text="or continue with"
                    android:textColor="@color/text_hint"
                    android:textSize="12sp" />

                <View
                    android:layout_width="0dp"
                    android:layout_height="1dp"
                    android:layout_weight="1"
                    android:background="@color/card_border" />
            </LinearLayout>

            <!-- Google Sign-In -->
            <com.google.android.material.button.MaterialButton
                android:id="@+id/btn_google"
                style="@style/Widget.Material3.Button.OutlinedButton"
                android:layout_width="match_parent"
                android:layout_height="54dp"
                android:fontFamily="sans-serif-medium"
                android:text="Sign in with Google"
                android:textColor="@color/text_primary"
                android:textSize="15sp"
                app:cornerRadius="28dp"
                app:icon="@drawable/ic_google"
                app:iconGravity="textStart"
                app:iconPadding="10dp"
                app:strokeColor="@color/card_border"
                app:strokeWidth="1.5dp" />

            <!-- Progress Indicator -->
            <com.google.android.material.progressindicator.CircularProgressIndicator
                android:id="@+id/progress_login"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="center"
                android:layout_marginTop="16dp"
                android:indeterminate="true"
                android:visibility="gone"
                app:indicatorColor="@color/primary"
                app:trackThickness="3dp" />
        </LinearLayout>
    </androidx.core.widget.NestedScrollView>
</androidx.coordinatorlayout.widget.CoordinatorLayout>
`);

// ─────────────────────────────────────────────────────────────────────
// 11. bg_error_subtle drawable
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/bg_error_subtle.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFF5F5" />
    <corners android:radius="14dp" />
    <stroke android:width="1dp" android:color="#FFCDD2" />
</shape>
`);

// ─────────────────────────────────────────────────────────────────────
// 12. tab_indicator_pill
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/tab_indicator_pill.xml', `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/primary_tint" />
    <corners android:radius="20dp" />
</shape>
`);

// ─────────────────────────────────────────────────────────────────────
// 13. Redesigned activity_search.xml (Professional search screen)
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/layout/activity_search.xml', `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background"
    android:orientation="vertical">

    <!-- Header with search bar -->
    <com.google.android.material.appbar.AppBarLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="@color/surface"
        android:elevation="0dp"
        app:liftOnScroll="true">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:gravity="center_vertical"
            android:orientation="horizontal"
            android:paddingHorizontal="16dp"
            android:paddingTop="12dp"
            android:paddingBottom="12dp">

            <!-- Back button -->
            <FrameLayout
                android:id="@+id/btn_back"
                android:layout_width="44dp"
                android:layout_height="44dp"
                android:background="@drawable/bg_icon_btn"
                android:clickable="true"
                android:focusable="true">

                <ImageView
                    android:layout_width="20dp"
                    android:layout_height="20dp"
                    android:layout_gravity="center"
                    android:src="@drawable/ic_back"
                    app:tint="@color/text_primary" />
            </FrameLayout>

            <!-- Search Input -->
            <com.google.android.material.textfield.TextInputLayout
                android:layout_width="0dp"
                android:layout_height="48dp"
                android:layout_marginHorizontal="10dp"
                android:layout_weight="1"
                style="@style/Widget.AKR.TextInput.Search"
                app:startIconDrawable="@drawable/ic_search"
                app:startIconTint="@color/text_hint"
                app:endIconMode="clear_text"
                app:endIconTint="@color/text_hint"
                app:boxStrokeWidth="1.5dp"
                app:boxStrokeWidthFocused="2dp">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/et_search"
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:hint="@string/search_hint"
                    android:imeOptions="actionSearch"
                    android:inputType="text"
                    android:maxLines="1"
                    android:textColor="@color/text_primary"
                    android:textSize="15sp" />
            </com.google.android.material.textfield.TextInputLayout>

            <!-- Voice Search -->
            <FrameLayout
                android:id="@+id/btn_voice_search"
                android:layout_width="44dp"
                android:layout_height="44dp"
                android:background="@drawable/bg_icon_btn"
                android:clickable="true"
                android:focusable="true">

                <ImageView
                    android:layout_width="20dp"
                    android:layout_height="20dp"
                    android:layout_gravity="center"
                    android:src="@drawable/ic_microphone"
                    app:tint="@color/primary" />
            </FrameLayout>
        </LinearLayout>

        <!-- Filter Chips -->
        <HorizontalScrollView
            android:id="@+id/hsv_filters"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:paddingHorizontal="16dp"
            android:paddingBottom="12dp"
            android:scrollbars="none"
            android:visibility="gone">

            <com.google.android.material.chip.ChipGroup
                android:id="@+id/cg_filters"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                app:singleSelection="false" />
        </HorizontalScrollView>
    </com.google.android.material.appbar.AppBarLayout>

    <!-- Content -->
    <FrameLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1">

        <!-- Default: Trending & Categories -->
        <androidx.core.widget.NestedScrollView
            android:id="@+id/sv_suggestions"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:clipToPadding="false"
            android:paddingBottom="24dp">

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:padding="16dp">

                <!-- Recent Searches -->
                <LinearLayout
                    android:id="@+id/ll_recent"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:visibility="gone">

                    <LinearLayout
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:gravity="center_vertical"
                        android:orientation="horizontal"
                        android:layout_marginBottom="10dp">

                        <TextView
                            android:layout_width="0dp"
                            android:layout_height="wrap_content"
                            android:layout_weight="1"
                            android:fontFamily="sans-serif-black"
                            android:text="@string/recent_searches"
                            android:textColor="@color/text_primary"
                            android:textSize="16sp" />

                        <TextView
                            android:id="@+id/tv_clear_recent"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:clickable="true"
                            android:focusable="true"
                            android:fontFamily="sans-serif-medium"
                            android:text="@string/clear_all"
                            android:textColor="@color/primary"
                            android:textSize="13sp" />
                    </LinearLayout>

                    <androidx.recyclerview.widget.RecyclerView
                        android:id="@+id/rv_recent"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:layout_marginBottom="20dp"
                        android:nestedScrollingEnabled="false" />
                </LinearLayout>

                <!-- Trending -->
                <TextView
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginBottom="10dp"
                    android:fontFamily="sans-serif-black"
                    android:text="@string/trending"
                    android:textColor="@color/text_primary"
                    android:textSize="16sp" />

                <androidx.recyclerview.widget.RecyclerView
                    android:id="@+id/rv_trending"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginBottom="24dp"
                    android:nestedScrollingEnabled="false" />

                <!-- Popular Cuisines -->
                <TextView
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginBottom="12dp"
                    android:fontFamily="sans-serif-black"
                    android:text="@string/popular_cuisines"
                    android:textColor="@color/text_primary"
                    android:textSize="16sp" />

                <androidx.recyclerview.widget.RecyclerView
                    android:id="@+id/rv_cuisines"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:nestedScrollingEnabled="false" />
            </LinearLayout>
        </androidx.core.widget.NestedScrollView>

        <!-- Search Results -->
        <androidx.recyclerview.widget.RecyclerView
            android:id="@+id/rv_results"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:clipToPadding="false"
            android:paddingHorizontal="16dp"
            android:paddingVertical="12dp"
            android:visibility="gone" />

        <!-- Empty State -->
        <LinearLayout
            android:id="@+id/ll_empty_state"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:gravity="center"
            android:orientation="vertical"
            android:padding="40dp"
            android:visibility="gone">

            <ImageView
                android:layout_width="100dp"
                android:layout_height="100dp"
                android:src="@drawable/ic_search"
                app:tint="@color/text_hint" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="16dp"
                android:fontFamily="sans-serif-black"
                android:text="@string/no_results"
                android:textColor="@color/text_primary"
                android:textSize="18sp" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:fontFamily="sans-serif"
                android:gravity="center"
                android:text="Try a different search term or browse our popular dishes"
                android:textColor="@color/text_secondary"
                android:textSize="13sp" />
        </LinearLayout>

        <!-- Loading -->
        <com.google.android.material.progressindicator.CircularProgressIndicator
            android:id="@+id/progress_search"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_gravity="center"
            android:indeterminate="true"
            android:visibility="gone"
            app:indicatorColor="@color/primary"
            app:trackThickness="3dp" />
    </FrameLayout>
</LinearLayout>
`);

// ─────────────────────────────────────────────────────────────────────
// 14. bg_icon_btn drawable (rounded square icon button bg)
// ─────────────────────────────────────────────────────────────────────
write('androidapp/app/src/main/res/drawable/bg_icon_btn.xml', `<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:state_pressed="true">
        <shape android:shape="rectangle">
            <solid android:color="@color/surface_variant" />
            <corners android:radius="14dp" />
        </shape>
    </item>
    <item>
        <shape android:shape="rectangle">
            <solid android:color="@color/surface_variant" />
            <corners android:radius="14dp" />
        </shape>
    </item>
</selector>
`);

// ─────────────────────────────────────────────────────────────────────
// 15. TextInput Search style addition - themes.xml addendum (separate file for reference)
// ─────────────────────────────────────────────────────────────────────
// [will be added to themes.xml directly]

console.log('\\n✅ All resource files generated successfully!');
