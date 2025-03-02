package com.example.biteswipe

import RestaurantCard
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class SwipeAdapter(private val context: Context, private val cards: List<RestaurantCard>) : RecyclerView.Adapter<SwipeAdapter.SwipeViewHolder>() {

    // ViewHolder that binds the views in the layout file
    class SwipeViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val cardImage: ImageView = itemView.findViewById(R.id.card_image)
        val cardName: TextView = itemView.findViewById(R.id.card_name)
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
        holder.cardName.text = card.name
        holder.cardImage.setImageResource(card.imageRes)
    }

    // Return the total number of items in the dataset
    override fun getItemCount(): Int {
        return cards.size
    }
}
