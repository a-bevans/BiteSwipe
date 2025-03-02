package com.example.biteswipe

import RestaurantCard
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.os.Bundle
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class MatchingPage : AppCompatActivity() {
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: SwipeAdapter
    private lateinit var cards: MutableList<RestaurantCard>
    private var currentCardIndex = 0
    private var TAG = "MatchingPage"
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_matching_page)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        cards = mutableListOf(
            RestaurantCard("John Doe", R.drawable.ic_settings),
            RestaurantCard("Jane Doe", R.drawable.ic_settings),
            RestaurantCard("Mike Tyson", R.drawable.ic_launcher_background)
        )

        recyclerView = findViewById(R.id.recycler_view)
        recyclerView.layoutManager =
            LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        adapter = SwipeAdapter(this, cards)
        recyclerView.adapter = adapter
        Log.d(TAG, "Set up cards")
        setupSwipeListener()
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

        recyclerView.setOnTouchListener { v, event ->
            gestureDetector.onTouchEvent(event)

            // Reset the flag when the touch event is finished (e.g., user lifts finger)
            if (event.action == MotionEvent.ACTION_UP || event.action == MotionEvent.ACTION_CANCEL) {
                isSwiping = false
            }

            true
        }




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
                        Log.d(TAG, "Card Removed")
                    }
                })
            }
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
                    }
                })
            }
        }
    }
}
