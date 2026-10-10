package com.ssr.hunger.delivery.utils;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;
import com.google.firebase.storage.UploadTask;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Robust document upload helper supporting Firebase Storage with automatic Cloudinary fallback.
 * Guarantees delivery documents (RC & Driving License) are securely uploaded and stored.
 */
public class DocumentUploadHelper {

    private static final String TAG = "DocumentUploadHelper";
    private static final String CLOUDINARY_CLOUD_NAME = "digacpboi";
    private static final String CLOUDINARY_UPLOAD_PRESET = "akr_unsigned_upload";

    public interface UploadCallback {
        void onProgress(int percent, String stageMessage);
        void onSuccess(@NonNull String downloadUrl);
        void onFailure(@NonNull Exception error);
    }

    /**
     * Upload document (Firebase Storage first, falls back to Cloudinary if needed).
     */
    public static void uploadDocument(
            @NonNull Context context,
            @NonNull Uri fileUri,
            @NonNull String userId,
            @NonNull String documentType, // "rc" or "driving_license"
            @NonNull UploadCallback callback
    ) {
        callback.onProgress(10, "Preparing " + documentType + " document...");

        // Try Firebase Storage first
        try {
            String extension = getFileExtension(context, fileUri);
            String fileName = documentType + "_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 6) + extension;
            StorageReference storageRef = FirebaseStorage.getInstance().getReference()
                    .child("delivery_documents")
                    .child(userId)
                    .child(fileName);

            UploadTask uploadTask = storageRef.putFile(fileUri);
            uploadTask.addOnProgressListener(snapshot -> {
                if (snapshot.getTotalByteCount() > 0) {
                    int progress = (int) ((snapshot.getBytesTransferred() * 80) / snapshot.getTotalByteCount());
                    callback.onProgress(progress, "Uploading to secure cloud (" + progress + "%)...");
                }
            }).addOnSuccessListener(taskSnapshot -> {
                storageRef.getDownloadUrl()
                        .addOnSuccessListener(uri -> {
                            callback.onProgress(100, "Upload complete!");
                            callback.onSuccess(uri.toString());
                        })
                        .addOnFailureListener(e -> {
                            Log.w(TAG, "Storage getDownloadUrl failed, trying Cloudinary fallback", e);
                            uploadToCloudinaryFallback(context, fileUri, callback);
                        });
            }).addOnFailureListener(e -> {
                Log.w(TAG, "Firebase Storage failed, trying Cloudinary fallback", e);
                uploadToCloudinaryFallback(context, fileUri, callback);
            });
        } catch (Exception e) {
            Log.w(TAG, "Error starting Firebase Storage upload, trying Cloudinary fallback", e);
            uploadToCloudinaryFallback(context, fileUri, callback);
        }
    }

    /**
     * Fallback to Cloudinary unsigned upload if Firebase Storage fails.
     */
    private static void uploadToCloudinaryFallback(
            @NonNull Context context,
            @NonNull Uri fileUri,
            @NonNull UploadCallback callback
    ) {
        new Thread(() -> {
            try {
                callback.onProgress(30, "Connecting to high-speed cloud storage...");
                byte[] fileBytes = readUriBytes(context, fileUri);
                if (fileBytes == null || fileBytes.length == 0) {
                    throw new Exception("Unable to read selected file");
                }

                String fileName = getFileName(context, fileUri);
                String lineEnd = "\r\n";
                String twoHyphens = "--";
                String boundary = "----AKRHungerBoundary" + System.currentTimeMillis();

                URL url = new URL("https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/auto/upload");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setDoInput(true);
                conn.setDoOutput(true);
                conn.setUseCaches(false);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Connection", "Keep-Alive");
                conn.setRequestProperty("Content-Type", "multipart/form-data;boundary=" + boundary);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(30000);

                DataOutputStream dos = new DataOutputStream(conn.getOutputStream());

                // Field: upload_preset
                dos.writeBytes(twoHyphens + boundary + lineEnd);
                dos.writeBytes("Content-Disposition: form-data; name=\"upload_preset\"" + lineEnd + lineEnd);
                dos.writeBytes(CLOUDINARY_UPLOAD_PRESET + lineEnd);

                // Field: file
                dos.writeBytes(twoHyphens + boundary + lineEnd);
                dos.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"" + lineEnd);
                dos.writeBytes("Content-Type: application/octet-stream" + lineEnd + lineEnd);
                dos.write(fileBytes);
                dos.writeBytes(lineEnd);

                // End boundary
                dos.writeBytes(twoHyphens + boundary + twoHyphens + lineEnd);
                dos.flush();
                dos.close();

                int responseCode = conn.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        response.append(line);
                    }
                    in.close();

                    JSONObject json = new JSONObject(response.toString());
                    String secureUrl = json.getString("secure_url");
                    callback.onProgress(100, "Uploaded successfully!");
                    callback.onSuccess(secureUrl);
                } else {
                    BufferedReader err = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8));
                    StringBuilder errResponse = new StringBuilder();
                    String line;
                    while ((line = err.readLine()) != null) {
                        errResponse.append(line);
                    }
                    err.close();
                    throw new Exception("Upload failed (HTTP " + responseCode + "): " + errResponse);
                }
            } catch (Exception ex) {
                Log.e(TAG, "Cloudinary upload error", ex);
                callback.onFailure(ex);
            }
        }).start();
    }

    private static byte[] readUriBytes(Context context, Uri uri) {
        try (InputStream inputStream = context.getContentResolver().openInputStream(uri);
             ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream()) {
            if (inputStream == null) return null;
            byte[] buffer = new byte[16384];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                byteBuffer.write(buffer, 0, len);
            }
            return byteBuffer.toByteArray();
        } catch (Exception e) {
            Log.e(TAG, "Error reading Uri bytes", e);
            return null;
        }
    }

    public static String getFileName(Context context, Uri uri) {
        String result = null;
        if ("content".equalsIgnoreCase(uri.getScheme())) {
            try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (index >= 0) {
                        result = cursor.getString(index);
                    }
                }
            } catch (Exception ignored) {}
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result != null ? result.lastIndexOf('/') : -1;
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return result != null ? result : "document_" + System.currentTimeMillis();
    }

    private static String getFileExtension(Context context, Uri uri) {
        String name = getFileName(context, uri);
        int dot = name.lastIndexOf('.');
        if (dot >= 0) {
            return name.substring(dot);
        }
        return ".jpg";
    }
}
