import googlemaps

from app.config import settings


def geocode_address(address: str, city: str) -> tuple[float, float] | None:
    client = googlemaps.Client(key=settings.google_maps_api_key)
    results = client.geocode(f"{address}, {city}")
    if not results:
        return None
    location = results[0]["geometry"]["location"]
    return location["lat"], location["lng"]
