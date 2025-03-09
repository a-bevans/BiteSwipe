package com.example.biteswipe

import com.example.biteswipe.cards.RestaurantCard
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.biteswipe.adapter.SwipeAdapter
import com.example.biteswipe.cards.UserCard
import com.example.biteswipe.jsonFormats.RestaurantData
import com.example.biteswipe.jsonFormats.sessionDetails
import org.json.JSONObject

class MatchingPage : AppCompatActivity(), ApiHelper {
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: SwipeAdapter
    private lateinit var cards: MutableList<RestaurantCard>
    private lateinit var RestaurantList: MutableList<RestaurantData>
    private var currentCardIndex = 0
    private lateinit var sessionId: String
    private lateinit var userId: String
    private val handler = Handler(Looper.getMainLooper())
    private var userFinished = false
    private var TAG = "MatchingPage"

    private val checkFinished = object: Runnable {

//        TODO: Check for match found, open popup accordingly and go to results (Match found) page if everyone agrees -> Nested API Call


//        TODO: [IN PROGRESS] Tell Backend we have finished swiping (remainingCards = 0), visual update

        override fun run() {
            val endpoint = "/sessions/$sessionId/"
            apiRequest(
                context = this@MatchingPage,
                endpoint = endpoint,
                method = "GET",
                onSuccess = { response ->
                    val session  = parseSessionData(response)
                    if(session.status != "MATCHING") {
                        Log.d(TAG, "Session Finished")
                        val intent = Intent(this@MatchingPage, ResultsPage::class.java)
                        intent.putExtra("sessionId", sessionId)
                        intent.putExtra("userId", userId)
                        startActivity(intent)
                        finish()
                    }
                }
            )
            handler.postDelayed(this, 5000)
        }

    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_matching_page)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        sessionId = intent.getStringExtra("sessionId") ?: ""
        userId = intent.getStringExtra("userId") ?: ""

        Log.d(TAG, "Session ID: $sessionId, User ID: $userId")
        cards = mutableListOf()
        RestaurantList = mutableListOf()


        recyclerView = findViewById(R.id.recycler_view)
        recyclerView.layoutManager =
            LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        adapter = SwipeAdapter(this, cards)
        recyclerView.adapter = adapter
        Log.d(TAG, "Set up cards")
        val endpoint = "/sessions/$sessionId/restaurants"
        // TODO: the response has changed. Update parseRestaurants
        apiRequest(
            context = this@MatchingPage,
            endpoint = endpoint,
            method = "GET",
            onSuccess = { response ->
                RestaurantList  = parseRestaurants(response.toString())
                cards.clear()
                for (restaurant in RestaurantList) {
                    Log.d(TAG, "Restaurant: $restaurant")

                    val restaurantName = restaurant.name
                    val imageResId = 0
                    val address = restaurant.address
                    val contact = restaurant.contactNumber
                    val price = restaurant.price
                    val rating = restaurant.rating
                    val restaurantId = restaurant.restaurantId

                    // Add the UserCard to the list
                    cards.add(RestaurantCard(restaurantName, imageResId, address, contact, price, rating, restaurantId),)
                }
                adapter.notifyDataSetChanged()
            },
            onError = { code, message ->
                Log.d(TAG, "Error: $code, $message")
                Toast.makeText(this@MatchingPage, "Error: $code, $message", Toast.LENGTH_SHORT).show()
            }
        )
        setupSwipeListener()
        checkFinished.run()
    }
    private var isSwiping = false
    private fun setupSwipeListener() {
        val gestureDetector =
            GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {

                override fun onDown(e: MotionEvent): Boolean {
                    return !isSwiping
                }

                override fun onScroll(e1: MotionEvent?,e2: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
                    if(isSwiping) return true

                    // Detect left or right swipe
                    val deltaX = e2.x.minus(e1?.x ?: 0f)
                    if (Math.abs(deltaX) > 200) {
                        isSwiping = true
                        if (deltaX > 0) {
                            swipeCardRight()
                        } else {
                            swipeCardLeft()
                        }
                        Log.d(TAG, "Swipe detected")
                        return true
                    }
                    return false
                }
            })
//        TODO: Set up swipe up and down for more details (reviews, menu, etc...?)
        recyclerView.setOnTouchListener { v, event ->
            gestureDetector.onTouchEvent(event)

            // Reset the flag when the touch event is finished (e.g., user lifts finger)
            if (event.action == MotionEvent.ACTION_UP || event.action == MotionEvent.ACTION_CANCEL) {
                isSwiping = false
            }

            true
        }

//        IF match found and everyone agrees: goto chosenRestaurantPage
//        IF no more matches: goto ResultsPage


    }

    private fun swipeCardRight() {
        if (currentCardIndex < cards.size) {
            // Get the current card and its view holder
            val viewHolder = recyclerView.findViewHolderForAdapterPosition(currentCardIndex)
            val cardView = viewHolder?.itemView

            // Apply translation to move the card off the screen to the right
            cardView?.let {
                val animator = android.animation.ObjectAnimator.ofFloat(
                    it,
                    "translationX",
                    it.translationX,
                    1000f
                ) // move 1000px to the right
                animator.duration = 300 // duration of the animation (in ms)
                animator.start()

                // After animation ends, remove the card from the list
                animator.addListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        cards.removeAt(currentCardIndex)
                        adapter.notifyItemRemoved(currentCardIndex)
                        if(cards.isEmpty()){
                            val epoint = "/sessions/$sessionId/doneSwiping"
                            val body = JSONObject().apply {
                                put("userId", userId)
                            }
                            apiRequest(
                                context = this@MatchingPage,
                                endpoint = epoint,
                                method = "POST",
                                jsonBody = body,
                                onSuccess = { response ->
                                    userFinished = true
                                    val finishText = findViewById<TextView>(R.id.waiting_for_finish_text)
                                    finishText.visibility = View.VISIBLE
                                    Log.d(TAG, "User Finished Swiping")
                                }
                            )
                        }
                        Log.d(TAG, "Card Removed")
                    }
                })
            }
            val endpoint = "/sessions/$sessionId/votes"
            val body = JSONObject().apply {
                put("userId", userId)
                put("restaurantId", cards[currentCardIndex].restaurantId)
                put("liked", true)
            }
            apiRequest(
                context = this@MatchingPage,
                endpoint = endpoint,
                method = "POST",
                jsonBody = body,
                onSuccess = { response ->
                    Log.d(TAG, "Vote sent")
                },
                onError = { code, message ->
                    Log.d(TAG, "Error: $code, $message")
                    Toast.makeText(this@MatchingPage, "Error: Vote was not sent", Toast.LENGTH_SHORT).show()
                }
            )
        }

    }

    private fun swipeCardLeft() {
        if (currentCardIndex < cards.size) {
            // Get the current card and its view holder
            val viewHolder = recyclerView.findViewHolderForAdapterPosition(currentCardIndex)
            val cardView = viewHolder?.itemView

            // Apply translation to move the card off the screen to the left
            cardView?.let {
                val animator = android.animation.ObjectAnimator.ofFloat(
                    it,
                    "translationX",
                    it.translationX,
                    -1000f
                ) // move 1000px to the left
                animator.duration = 300 // duration of the animation (in ms)
                animator.start()

                // After animation ends, remove the card from the list
                animator.addListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        cards.removeAt(currentCardIndex)
                        adapter.notifyItemRemoved(currentCardIndex)
                        Log.d(TAG, "Card Removed")

                        if(cards.isEmpty()){
                            val epoint = "/sessions/$sessionId/doneSwiping"
                            val body = JSONObject().apply {
                                put("userId", userId)
                            }
                            apiRequest(
                                context = this@MatchingPage,
                                endpoint = epoint,
                                method = "POST",
                                jsonBody = body,
                                onSuccess = { response ->
                                    userFinished = true
                                    val finishText = findViewById<TextView>(R.id.waiting_for_finish_text)
                                    finishText.visibility = View.VISIBLE
                                    Log.d(TAG, "User Finished Swiping")
                                }
                            )
                        }
                    }
                })
            }
            val endpoint = "/sessions/$sessionId/votes"
            val body = JSONObject().apply {
                put("userId", userId)
                put("restaurantId", cards[currentCardIndex].restaurantId)
                put("liked", false)
            }
            apiRequest(
                context = this@MatchingPage,
                endpoint = endpoint,
                method = "POST",
                jsonBody = body,
                onSuccess = { response ->
                    Log.d(TAG, "Vote sent")
                },
                onError = { code, message ->
                    Log.d(TAG, "Error: $code, $message")
                    Toast.makeText(this@MatchingPage, "Error: Vote was not sent", Toast.LENGTH_SHORT).show()
                }
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(checkFinished)
    }
}
