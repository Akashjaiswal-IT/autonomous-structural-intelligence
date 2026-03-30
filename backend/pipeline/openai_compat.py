import httpx
from openai import OpenAI


def build_openai_client(api_key: str) -> OpenAI:
    """
    Build an OpenAI client with an explicit httpx client.

    openai==1.30.0 can fail against httpx==0.28+ when it tries to pass the
    deprecated `proxies` argument into the default httpx client wrapper.
    Passing our own client avoids that path and keeps the integration stable.
    """
    http_client = httpx.Client(
        follow_redirects=True,
        timeout=60.0,
        trust_env=True,
    )
    return OpenAI(api_key=api_key, http_client=http_client, max_retries=0)
