package com.example.biteswipe.helpers

import android.content.Context
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.biteswipe.R
import com.example.biteswipe.jsonFormats.Creator
import com.example.biteswipe.jsonFormats.Location
import com.example.biteswipe.jsonFormats.Participant
import com.example.biteswipe.jsonFormats.Preference
import com.example.biteswipe.jsonFormats.Restaurant
import com.example.biteswipe.jsonFormats.RestaurantData
import com.example.biteswipe.jsonFormats.Settings
import com.example.biteswipe.jsonFormats.sessionDetails
import com.example.biteswipe.jsonFormats.UserId

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.security.KeyStore
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

interface ApiHelper {
    /**
     * TokenManager handles storage and retrieval of the Google token
     */
    object TokenManager {
        private const val PREF_FILE_NAME = "biteswipe_prefs"
        private const val KEY_GOOGLE_TOKEN = "google_token"

        /**
         * Stores the Google token using SharedPreferences
         */
        fun storeToken(context: Context, token: String) {
            try {
                context.getSharedPreferences(PREF_FILE_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_GOOGLE_TOKEN, token)
                    .apply()
                Log.d("TokenManager", "Token stored")
            } catch (e: Exception) {
                Log.e("TokenManager", "Error storing token: ${e.message}")
            }
        }

        /**
         * Retrieves the Google token from storage
         */
        fun getToken(context: Context): String? {
            return try {
                context.getSharedPreferences(PREF_FILE_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_GOOGLE_TOKEN, null)
            } catch (e: Exception) {
                Log.e("TokenManager", "Error retrieving token: ${e.message}")
                null
            }
        }
    }

    /**
     * Retrieves the base API URL dynamically from `strings.xml`
     */
    fun getBaseUrl(context: Context): String {
        return context.getString(R.string.base_url)
//        for testing purposes only
//        return "http://10.0.2.2:3000"
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


    fun logLongMessage(tag: String, message: String) {
        val chunkSize = 4000  // Logcat limit is ~4076 characters
        var i = 0
        while (i < message.length) {
            val end = minOf(i + chunkSize, message.length)
            Log.d(tag, message.substring(i, end))
            i += chunkSize
        }
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
        isFullUrl: Boolean = false,
        onSuccess: (JSONObject) -> Unit,
        onError: ((Int?, String?) -> Unit)? = null,
    ) {
//          For testing purpose only
//        val client = OkHttpClient()
        val client = createTrustedClient(context)

        // Create a mutable map of headers that includes the Google token if available
        val updatedHeaders = headers.toMutableMap()
        TokenManager.getToken(context)?.let { token ->
            updatedHeaders["Authorization"] = "Bearer $token"
        }

        val url = if (isFullUrl) endpoint else getBaseUrl(context) + endpoint

        val requestBody = jsonBody?.let {
            it.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        }

        val requestBuilder = Request.Builder().url(url)

        // Apply headers if provided
        updatedHeaders.forEach { (key, value) ->
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
        Log.d("ApiHelper", "making request: $method to $endpoint")
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
                logLongMessage("ApiHelper", "received response: $responseBody")
                try {
                    if (response.isSuccessful && responseBody != null) {
                        val jsonResponse = when {
                            // Check if the response is a JSONObject
                            responseBody.trim().startsWith("{") -> {
                                JSONObject(responseBody) // JSONObject
                            }
                            // Check if the response is a JSONArray
                            responseBody.trim().startsWith("[") -> {
                                JSONArray(responseBody) // JSONArray
                            }
                            else -> {
                                throw JSONException("Invalid JSON format")
                            }
                        }

                        (context as? AppCompatActivity)?.runOnUiThread {
                            if(jsonResponse is JSONArray){
                                val wrappedJson = JSONObject().put("result", jsonResponse)
                                onSuccess(wrappedJson)
                            }
                            else if (jsonResponse is JSONObject){
                                onSuccess(jsonResponse)
                            }
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

    private fun createTrustedClient(context: Context): OkHttpClient {
        // Load the self-signed certificate from the app's raw resources
        val certificateFactory = CertificateFactory.getInstance("X.509")
        val certInputStream: InputStream = context.resources.openRawResource(R.raw.server) // server.crt
        val certificate = certificateFactory.generateCertificate(certInputStream) as X509Certificate

        // Create a KeyStore containing our trusted certificates
        val keyStore = KeyStore.getInstance(KeyStore.getDefaultType())
        keyStore.load(null, null) // Initialize with no password
        keyStore.setCertificateEntry("server", certificate) // Load the self-signed certificate into the KeyStore

        // Create a TrustManager that trusts the self-signed certificate
        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(keyStore)

        val trustManagers = trustManagerFactory.trustManagers
        if (trustManagers.isEmpty()) {
            throw Exception("No TrustManagers found")
        }

        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustManagers, null)

        // Create and return a custom OkHttpClient that trusts the self-signed certificate
        return OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustManagers[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true } // Disable hostname verification (optional, but useful for development)
            .build()
    }

    fun parseSessionStatus(json: JSONObject, TAG: String = "ApiHelper"): String {
        return json.getString("status")
    }
    fun parseSessionData(json: JSONObject, TAG: String = "ApiHelper"): sessionDetails {
        Log.d(TAG, "Parsing session data: $json")

        // Parse the creator, which is just a string ID (not a full object)
        val creatorId = json.getString("creator")
        val creator = Creator(
            _id = creatorId,          // Assuming the creator's ID is the string itself
            displayName = creatorId   // You can replace this with the actual display name if it's available elsewhere
        )
        Log.d(TAG, "Creator Parsed")
        // Parse the settings and location objects
        val settingsJson = json.getJSONObject("settings")
        val locationJson = settingsJson.getJSONObject("location")
        val location = Location(
            latitude = locationJson.getDouble("latitude"),
            longitude = locationJson.getDouble("longitude"),
            radius = locationJson.getDouble("radius")
        )

        // Parse the participants list
        val participantsJson = json.getJSONArray("participants")
        val participants = mutableListOf<Participant>()
        for (i in 0 until participantsJson.length()) {
            val participantJson = participantsJson.getJSONObject(i)
            val userIdJson = participantJson.getString("userId")  // It's just a string ID here
            val preferencesJson = participantJson.getJSONArray("preferences")
            val preferences = mutableListOf<Preference>()
            for (j in 0 until preferencesJson.length()) {
                val prefJson = preferencesJson.getJSONObject(j)
                preferences.add(Preference(
                    restaurantId = prefJson.getString("restaurantId"),
                    liked = prefJson.getBoolean("liked"),
                    timestamp = prefJson.getString("timestamp")
                ))
            }
            // Add the participant to the list
            participants.add(Participant(UserId(userIdJson, userIdJson), preferences))  // Assuming no display name here
        }

        // Parse the restaurants list
        val restaurantsJson = json.getJSONArray("restaurants")
        val restaurants = mutableListOf<Restaurant>()
        for (i in 0 until restaurantsJson.length()) {
            val restaurantJson = restaurantsJson.getJSONObject(i)
            restaurants.add(Restaurant(
                restaurantId = restaurantJson.getString("restaurantId"),
                score = restaurantJson.getInt("score"),
                totalVotes = restaurantJson.getInt("totalVotes"),
                positiveVotes = restaurantJson.getInt("positiveVotes")
            ))
        }
        Log.d(TAG, "Session Data Parsed")
        // Create the sessionDetails object
        return sessionDetails(
            _id = json.getString("_id"),
            creator = creator,        // Pass the creator object (ID and name)
            settings = Settings(location),
            participants = participants,
            restaurants = restaurants,
            status = json.getString("status"),
            createdAt = json.getString("createdAt"),
            expiresAt = json.getString("expiresAt")
        )
    }

    fun parseRestaurants(jsonString: String, TAG: String = "ApiHelper"): MutableList<RestaurantData> {
        Log.d(TAG, "Parsing restaurants data: $jsonString")

        val restaurantList = mutableListOf<RestaurantData>()

        val jsonObject = JSONObject(jsonString)
        val restaurantsArray = jsonObject.getJSONArray("result")
        if (restaurantsArray.length() == 0) {
            Log.d(TAG, "No restaurants data found.")
            return restaurantList
        }

        for (i in 0 until restaurantsArray.length()) {
            val restaurantJson = restaurantsArray.getJSONObject(i)

            val name = restaurantJson.optString("name", "Unknown")
            val address = restaurantJson.optJSONObject("location")?.optString("address", "Unknown") ?: "Unknown"
            val contactNumber = restaurantJson.optJSONObject("contact")?.optString("phone", "No Contact") ?: "No Contact"
            val price = restaurantJson.optInt("priceLevel", 0) // Defaulting to 0 if missing
            val rating = restaurantJson.opt("rating")?.let { (it as Number).toFloat() } ?: 0.0f // Ensure Float type
            val restaurantId = restaurantJson.optString("_id", "")

            // Get the first image from the gallery if available
            val imagesJson = restaurantJson.optJSONObject("images")
            val primaryImage = imagesJson?.optString("primary", null)
            val galleryImages = imagesJson?.optJSONArray("gallery")
            val imageUrl = primaryImage ?: galleryImages?.optString(0) ?: "No Image Available"

            restaurantList.add(RestaurantData(name, address, contactNumber, price, rating, imageUrl, restaurantId))
        }

        return restaurantList
    }

    fun parseRestaurant(jsonString: String): RestaurantData {

        val jsonObject = JSONObject(jsonString)
        val restaurantJson = jsonObject.getJSONObject("result")

        val name = restaurantJson.optString("name", "Unknown")
        val address = restaurantJson.optJSONObject("location")?.optString("address", "Unknown") ?: "Unknown"
        val contactNumber = restaurantJson.optJSONObject("contact")?.optString("phone", "No Contact") ?: "No Contact"
        val price = restaurantJson.optInt("priceLevel", 0) // Defaulting to 0 if missing
        val rating = restaurantJson.opt("rating")?.let { (it as Number).toFloat() } ?: 0.0f // Ensure Float type
        val restaurantId = restaurantJson.optString("_id", "")

        // Get the first image from the gallery if available
        val imageGallery = restaurantJson.optJSONObject("images")?.optJSONArray("gallery")
        val picture = if (imageGallery != null && imageGallery.length() > 0) {
            imageGallery.optString(0)
        } else {
            "0"
        }

        val restaurantData = RestaurantData(name, address, contactNumber, price, rating, picture, restaurantId)


        return restaurantData
    }

}
