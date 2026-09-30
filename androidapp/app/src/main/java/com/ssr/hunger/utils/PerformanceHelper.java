package com.ssr.hunger.utils;

import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.google.firebase.perf.FirebasePerformance;
import com.google.firebase.perf.metrics.HttpMetric;
import com.google.firebase.perf.metrics.Trace;
import java.util.Map;

/**
 * PerformanceHelper provides utilities for Firebase Performance Monitoring:
 * - Custom Code Traces (measuring critical food delivery flows: checkout, menu load, search)
 * - Custom Metrics (counter/metrics within traces: item counts, latency, total value)
 * - HTTP Network Request Tracing (measuring endpoint latency and payload sizes)
 * - Screen rendering and app startup tracking
 */
public class PerformanceHelper {

    private static final String TAG = "PerformanceHelper";
    private static volatile PerformanceHelper instance;
    private final FirebasePerformance perf;

    // Standard Trace Identifiers
    public static final String TRACE_APP_STARTUP = "app_startup";
    public static final String TRACE_CHECKOUT_PROCESS = "checkout_process";
    public static final String TRACE_PAYMENT_TRANSACTION = "payment_transaction";
    public static final String TRACE_RESTAURANT_MENU_LOAD = "restaurant_menu_load";
    public static final String TRACE_SEARCH_EXECUTION = "search_execution";
    public static final String TRACE_IMAGE_UPLOAD = "cloudinary_image_upload";
    public static final String TRACE_WALLET_ADD_FUNDS = "wallet_add_funds";
    public static final String TRACE_ORDERS_LIST_LOAD = "orders_list_load";

    private PerformanceHelper() {
        this.perf = FirebasePerformance.getInstance();
    }

    public static PerformanceHelper getInstance() {
        if (instance == null) {
            synchronized (PerformanceHelper.class) {
                if (instance == null) {
                    instance = new PerformanceHelper();
                }
            }
        }
        return instance;
    }

    /**
     * Initializes Performance Monitoring and ensures data collection is enabled.
     */
    public void init() {
        try {
            perf.setPerformanceCollectionEnabled(true);
            Log.d(TAG, "Firebase Performance Monitoring collection enabled");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Performance Monitoring", e);
        }
    }

    /**
     * Starts a new custom performance trace.
     *
     * @param traceName Descriptive name (e.g. checkout_process, restaurant_menu_load)
     * @return The running Trace instance, or null if creation failed.
     */
    @Nullable
    public Trace startTrace(@NonNull String traceName) {
        try {
            Trace trace = perf.newTrace(traceName);
            trace.start();
            Log.d(TAG, "Performance trace started: " + traceName);
            return trace;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start trace: " + traceName, e);
            return null;
        }
    }

    /**
     * Stops an active trace.
     */
    public void stopTrace(@Nullable Trace trace) {
        if (trace != null) {
            try {
                trace.stop();
                Log.d(TAG, "Performance trace stopped");
            } catch (Exception e) {
                Log.e(TAG, "Failed to stop trace", e);
            }
        }
    }

    /**
     * Stops an active trace after attaching custom metrics and attributes.
     */
    public void stopTraceWithMetrics(@Nullable Trace trace,
                                     @Nullable Map<String, Long> metrics,
                                     @Nullable Map<String, String> attributes) {
        if (trace == null) return;
        try {
            if (metrics != null) {
                for (Map.Entry<String, Long> entry : metrics.entrySet()) {
                    trace.putMetric(entry.getKey(), entry.getValue());
                }
            }
            if (attributes != null) {
                for (Map.Entry<String, String> entry : attributes.entrySet()) {
                    trace.putAttribute(entry.getKey(), entry.getValue());
                }
            }
            trace.stop();
            Log.d(TAG, "Performance trace stopped with metrics & attributes");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping trace with metrics", e);
        }
    }

    /**
     * Records a numeric metric inside a running trace.
     */
    public void putMetric(@Nullable Trace trace, @NonNull String metricName, long value) {
        if (trace != null) {
            try {
                trace.putMetric(metricName, value);
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Increments an integer counter metric inside a running trace.
     */
    public void incrementMetric(@Nullable Trace trace, @NonNull String metricName, long incrementBy) {
        if (trace != null) {
            try {
                trace.incrementMetric(metricName, incrementBy);
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Attaches an attribute to a running trace.
     */
    public void putAttribute(@Nullable Trace trace, @NonNull String key, @NonNull String value) {
        if (trace != null) {
            try {
                trace.putAttribute(key, value);
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Creates and starts an HttpMetric to track manual HTTP requests (e.g. Cloudinary, Razorpay API).
     */
    @Nullable
    public HttpMetric startHttpMetric(@NonNull String url, @NonNull String httpMethod) {
        try {
            HttpMetric httpMetric = perf.newHttpMetric(url, httpMethod);
            httpMetric.start();
            return httpMetric;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start HttpMetric: " + url, e);
            return null;
        }
    }

    /**
     * Completes an HttpMetric record.
     */
    public void stopHttpMetric(@Nullable HttpMetric metric, int responseCode, long requestBytes, long responseBytes) {
        if (metric == null) return;
        try {
            metric.setHttpResponseCode(responseCode);
            if (requestBytes > 0) metric.setRequestPayloadSize(requestBytes);
            if (responseBytes > 0) metric.setResponsePayloadSize(responseBytes);
            metric.stop();
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop HttpMetric", e);
        }
    }
}
