from app.chat_rate_limit import _requests, is_rate_limited


def test_allows_up_to_ten_requests_then_blocks():
    _requests.clear()
    client_ip = "1.2.3.4"

    for _ in range(10):
        assert is_rate_limited(client_ip) is False

    assert is_rate_limited(client_ip) is True


def test_different_ips_are_tracked_independently():
    _requests.clear()

    for _ in range(10):
        assert is_rate_limited("1.1.1.1") is False

    assert is_rate_limited("1.1.1.1") is True
    assert is_rate_limited("2.2.2.2") is False
