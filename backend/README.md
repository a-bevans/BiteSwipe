# BiteSwipe Backend

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update the `.env` file with your own values:
- `PORT`: The port number for the server (default: 3000)
- `DB_URI`: MongoDB connection string (default: mongodb://localhost:27017/biteswipe)
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key
- `YELP_API_KEY`: Your Yelp API key
- `REDIS_URL`: Redis connection string (default: redis://localhost:6379)

Note: The `.env` file is ignored by git to keep your API keys and sensitive information private. Each developer should maintain their own `.env` file based on the `.env.example` template.
