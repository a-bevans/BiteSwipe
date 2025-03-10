package com.example.biteswipe.adapter

import com.example.biteswipe.cards.RestaurantCard
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.RatingBar
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.biteswipe.R

class SwipeAdapter(private val context: Context, private val cards: List<RestaurantCard>) : RecyclerView.Adapter<SwipeAdapter.SwipeViewHolder>() {

    // ViewHolder that binds the views in the layout file
    class SwipeViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val cardImage: ImageView = itemView.findViewById(R.id.restaurant_image)
        val cardName: TextView = itemView.findViewById(R.id.restaurant_name)
        val cardAddress: TextView = itemView.findViewById(R.id.restaurant_address)
        val cardContact: TextView = itemView.findViewById(R.id.restaurant_contact)
        val cardPrice: TextView = itemView.findViewById(R.id.restaurant_price)
        val cardRating: RatingBar = itemView.findViewById(R.id.restaurant_rating)
    }

    // Called when the RecyclerView needs a new ViewHolder
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SwipeViewHolder {
        // Inflate the card_item layout and return the ViewHolder
        val view = LayoutInflater.from(context).inflate(R.layout.restaurant_card, parent, false)
        return SwipeViewHolder(view)
    }

    // Called to bind the data to the views in each item (each card)
    override fun onBindViewHolder(holder: SwipeViewHolder, position: Int) {
        val card = cards[position]
        holder.cardName.text = card.restaurantName
        holder.cardImage.setImageResource(card.imageRes)
        holder.cardAddress.text = card.address
        holder.cardContact.text = card.contact
        holder.cardPrice.text = when (card.price) {
            1 -> "$"
            2 -> "$$"
            3 -> "$$$"
            else -> ""
        }
        holder.cardRating.rating = card.rating
    }

    // Return the total number of items in the dataset
    override fun getItemCount(): Int {
        return cards.size
    }
}
