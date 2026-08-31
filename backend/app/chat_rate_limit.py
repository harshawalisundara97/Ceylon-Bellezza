import time
from collections import defaultdict

_WINDOW_SECONDS = 60
_MAX_REQUESTS = 10
_requests: dict[str, list[float]] = defaultdict(list)


def is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    timestamps = _requests[client_ip]
    cutoff = now - _WINDOW_SECONDS
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)
    if len(timestamps) >= _MAX_REQUESTS:
        return True
    timestamps.append(now)
    return False
