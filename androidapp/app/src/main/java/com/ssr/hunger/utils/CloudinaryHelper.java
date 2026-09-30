package com.ssr.hunger.utils;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import com.google.firebase.perf.metrics.HttpMetric;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

/**
 * Cloudinary image upload utility - matches the web app's cloudinary.ts.
 * Uses unsigned upload preset for direct uploads from the Android client.
 * Profiled with Firebase Performance HttpMetric and monitored via Crashlytics.
 */
public class CloudinaryHelper {

    private static final String CLOUD_NAME = "digacpboi";
    private static final String UPLOAD_PRESET = "akr_unsigned_upload";
    private static final String UPLOAD_URL = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/upload";

    public interface UploadCallback {
        void onSuccess(String imageUrl);
        void onError(String error);
    }

    /**
     * Upload image to Cloudinary from a content URI.
     * Profiled with Firebase Performance HttpMetric.
     */
    public static void uploadImage(Context context, Uri imageUri, UploadCallback callback) {
        new Thread(() -> {
            HttpMetric httpMetric = PerformanceHelper.getInstance().startHttpMetric(UPLOAD_URL, "POST");
            CrashlyticsHelper.getInstance().log("Starting Cloudinary image upload");

            try {
                ContentResolver resolver = context.getContentResolver();
                InputStream inputStream = resolver.openInputStream(imageUri);
                if (inputStream == null) {
                    if (httpMetric != null) httpMetric.stop();
                    callback.onError("Could not open image");
                    return;
                }

                // Read file bytes
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    baos.write(buffer, 0, bytesRead);
                }
                inputStream.close();
                byte[] fileBytes = baos.toByteArray();

                if (httpMetric != null) {
                    httpMetric.setRequestPayloadSize(fileBytes.length);
                }

                // Build multipart form data
                String boundary = "----AndroidBoundary" + System.currentTimeMillis();
                URL url = new URL(UPLOAD_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setDoOutput(true);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

                OutputStream os = conn.getOutputStream();

                // Upload preset field
                writeFormField(os, boundary, "upload_preset", UPLOAD_PRESET);

                // File field
                String fileName = "android_upload_" + System.currentTimeMillis() + ".jpg";
                os.write(("--" + boundary + "\r\n").getBytes());
                os.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"\r\n").getBytes());
                os.write(("Content-Type: image/jpeg\r\n\r\n").getBytes());
                os.write(fileBytes);
                os.write("\r\n".getBytes());

                // End boundary
                os.write(("--" + boundary + "--\r\n").getBytes());
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                if (httpMetric != null) {
                    httpMetric.setHttpResponseCode(responseCode);
                }

                if (responseCode == 200) {
                    InputStream responseStream = conn.getInputStream();
                    ByteArrayOutputStream responseBytes = new ByteArrayOutputStream();
                    while ((bytesRead = responseStream.read(buffer)) != -1) {
                        responseBytes.write(buffer, 0, bytesRead);
                    }
                    responseStream.close();

                    if (httpMetric != null) {
                        httpMetric.setResponsePayloadSize(responseBytes.size());
                        httpMetric.stop();
                    }

                    JSONObject jsonResponse = new JSONObject(responseBytes.toString("UTF-8"));
                    String secureUrl = jsonResponse.getString("secure_url");
                    CrashlyticsHelper.getInstance().log("Cloudinary image upload succeeded");
                    callback.onSuccess(secureUrl);
                } else {
                    InputStream errorStream = conn.getErrorStream();
                    ByteArrayOutputStream errorBytes = new ByteArrayOutputStream();
                    while ((bytesRead = errorStream.read(buffer)) != -1) {
                        errorBytes.write(buffer, 0, bytesRead);
                    }
                    errorStream.close();

                    if (httpMetric != null) {
                        httpMetric.stop();
                    }

                    String errStr = errorBytes.toString("UTF-8");
                    CrashlyticsHelper.getInstance().recordException("Cloudinary_HTTP_Error", new Exception("HTTP " + responseCode + ": " + errStr));
                    callback.onError("Upload failed: " + errStr);
                }

                conn.disconnect();
            } catch (Exception e) {
                if (httpMetric != null) {
                    httpMetric.stop();
                }
                CrashlyticsHelper.getInstance().recordException("Cloudinary_Exception", e);
                callback.onError("Upload error: " + e.getMessage());
            }
        }).start();
    }

    private static void writeFormField(OutputStream os, String boundary, String name, String value) throws Exception {
        os.write(("--" + boundary + "\r\n").getBytes());
        os.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes());
        os.write((value + "\r\n").getBytes());
    }
}
