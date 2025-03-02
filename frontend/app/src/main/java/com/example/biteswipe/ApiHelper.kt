package com.example.biteswipe

import android.content.Context
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

interface ApiHelper {
    val client: OkHttpClient
        get() = OkHttpClient()

    /**
     * Retrieves the base API URL dynamically from `strings.xml`
     */
    fun getBaseUrl(context: Context): String {
        return context.getString(R.string.base_url)
    }

    /**
     * Default error handler: Shows a toast and logs the error.
     */
    fun defaultOnError(context: Context, code: Int?, message: String?) {
        (context as? AppCompatActivity)?.runOnUiThread {
            Toast.makeText(context, "API Error", Toast.LENGTH_SHORT).show()
        }
        Log.e("API_ERROR", "Error Code: $code, Message: $message")
    }

    /**
     * Makes a general API request with support for all HTTP methods, headers, and JSON body.
     */
    fun apiRequest(
        context: Context,
        endpoint: String,
        method: String = "GET",
        jsonBody: JSONObject? = null,
        headers: Map<String, String> = emptyMap(),
        onSuccess: (JSONObject) -> Unit,
        onError: ((Int?, String?) -> Unit)? = null // Optional, defaults to `defaultOnError`
    ) {
        val url = getBaseUrl(context) + endpoint

        val requestBody = jsonBody?.let {
            it.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        }

        val requestBuilder = Request.Builder().url(url)

        // Apply headers if provided
        headers.forEach { (key, value) ->
            requestBuilder.addHeader(key, value)
        }

        // Apply method-specific handling
        when (method.uppercase()) {
            "POST" -> requestBuilder.post(requestBody ?: "".toRequestBody(null))
            "PUT" -> requestBuilder.put(requestBody ?: "".toRequestBody(null))
            "DELETE" -> requestBuilder.delete(requestBody)
            "PATCH" -> requestBuilder.patch(requestBody ?: "".toRequestBody(null))
        }

        val request = requestBuilder.build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                (context as? AppCompatActivity)?.runOnUiThread {
                    onError?.invoke(null, "Network error: ${e.message}")
                        ?: defaultOnError(context, null, "Network error: ${e.message}")
                }
                Log.e("NETWORK_ERROR", e.toString())
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                try {
                    if (response.isSuccessful && responseBody != null) {
                        val jsonResponse = JSONObject(responseBody)
                        (context as? AppCompatActivity)?.runOnUiThread {
                            onSuccess(jsonResponse)
                        }
                    } else {
                        (context as? AppCompatActivity)?.runOnUiThread {
                            onError?.invoke(response.code, responseBody)
                                ?: defaultOnError(context, response.code, responseBody)
                        }
                        Log.e("API_ERROR", "Response Code: ${response.code}, Response: $responseBody")
                    }
                } catch (e: Exception) {
                    (context as? AppCompatActivity)?.runOnUiThread {
                        onError?.invoke(response.code, "Parsing error")
                            ?: defaultOnError(context, response.code, "Parsing error")
                    }
                    Log.e("API_ERROR", e.toString())
                }
            }
        })
    }
}
