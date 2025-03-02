package com.example.biteswipe

import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class LoginPage : AppCompatActivity(), ApiHelper {
    private var currentTodoId = 1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login_page)

        val signInButton = findViewById<Button>(R.id.sign_in_button)

        signInButton.setOnClickListener {
            val endpoint = "/todos/$currentTodoId"
            apiRequest(
                context = this,
                endpoint = endpoint,
                method = "GET",
                onSuccess = { response ->
                    val title = response.optString("title", "No Title Found")
                    Toast.makeText(this, "Todo #$currentTodoId: $title", Toast.LENGTH_SHORT).show()
                    currentTodoId++
                }
            )
        }
    }
}