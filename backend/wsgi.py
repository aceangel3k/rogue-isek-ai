from app import app
from database import init_database

# Initialize database when module loads (for Gunicorn/production)
try:
    init_database()
    print("✓ Database initialized (WSGI)")
except Exception as e:
    print(f"Warning: Database initialization failed: {e}")

# Run sprite cache migration (for Gunicorn/production)
try:
    from migrate_sprite_cache import migrate_sprite_cache
    migrate_sprite_cache(verbose=False)  # Silent mode for production
except Exception as e:
    print(f"Warning: Sprite cache migration failed: {e}")

if __name__ == "__main__":
    app.run()
