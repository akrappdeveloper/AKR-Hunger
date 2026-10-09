package com.ssr.hunger.delivery.utils;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.firebase.perf.FirebasePerformance;
import com.google.firebase.perf.metrics.Trace;

import java.util.Map;

/**
 * PerformanceHelper provides utilities for Firebase Performance Monitoring:
 * - Code Traces (order acceptance, GPS synchronization, orders list load)
 * - Custom Metrics within traces
 */
public class PerformanceHelper {

    private static final String TAG = "PerformanceHelper";
    private static volatile PerformanceHelper instance;
    private final FirebasePerformance perf;

    public static final String TRACE_APP_STARTUP = "delivery_app_startup";
    public static final String TRACE_ORDER_ACCEPTANCE = "delivery_order_acceptance";
    public static final String TRACE_GPS_SYNC = "delivery_gps_sync";
    public static final String TRACE_FEED_LOAD = "delivery_feed_load";
    public static final String TRACE_WALLET_LOAD = "delivery_wallet_load";

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

    public void init() {
        try {
            perf.setPerformanceCollectionEnabled(true);
            Log.d(TAG, "Firebase Performance Monitoring collection enabled");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Performance Monitoring", e);
        }
    }

    @NonNull
    public Trace startTrace(@NonNull String traceName) {
        Trace trace = perf.newTrace(traceName);
        trace.start();
        return trace;
    }

    public void stopTrace(@Nullable Trace trace) {
        if (trace != null) {
            trace.stop();
        }
    }

    public void stopTraceWithMetrics(@Nullable Trace trace, @Nullable Map<String, Long> metrics) {
        if (trace == null) return;
        if (metrics != null) {
            for (Map.Entry<String, Long> entry : metrics.entrySet()) {
                trace.putMetric(entry.getKey(), entry.getValue());
            }
        }
        trace.stop();
    }
}
