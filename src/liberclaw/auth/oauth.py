"""OAuth providers — Google and GitHub."""

from __future__ import annotations

from authlib.integrations.httpx_client import AsyncOAuth2Client


def create_google_client(client_id: str, client_secret: str, redirect_uri: str) -> AsyncOAuth2Client:
    """Create a Google OAuth2 client."""
    return AsyncOAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="openid email profile",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        access_token_url="https://oauth2.googleapis.com/token",
    )


def create_github_client(client_id: str, client_secret: str, redirect_uri: str) -> AsyncOAuth2Client:
    """Create a GitHub OAuth2 client."""
    return AsyncOAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="user:email",
        authorize_url="https://github.com/login/oauth/authorize",
        access_token_url="https://github.com/login/oauth/access_token",
    )


async def get_google_user_info(client: AsyncOAuth2Client, token: dict) -> dict:
    """Fetch user info from Google using the access token."""
    resp = await client.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        token=token,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "provider": "google",
        "provider_id": data["sub"],
        "email": data.get("email"),
        "email_verified": data.get("email_verified", False),
        "name": data.get("name"),
        "avatar_url": data.get("picture"),
    }


async def get_github_user_info(client: AsyncOAuth2Client, token: dict) -> dict:
    """Fetch user info from GitHub using the access token."""
    resp = await client.get(
        "https://api.github.com/user",
        token=token,
        headers={"Accept": "application/json"},
    )
    resp.raise_for_status()
    user_data = resp.json()

    # Get primary email
    email = user_data.get("email")
    if not email:
        email_resp = await client.get(
            "https://api.github.com/user/emails",
            token=token,
            headers={"Accept": "application/json"},
        )
        if email_resp.status_code == 200:
            emails = email_resp.json()
            for e in emails:
                if e.get("primary") and e.get("verified"):
                    email = e["email"]
                    break

    return {
        "provider": "github",
        "provider_id": str(user_data["id"]),
        "email": email,
        "email_verified": email is not None,
        "name": user_data.get("name") or user_data.get("login"),
        "avatar_url": user_data.get("avatar_url"),
    }
