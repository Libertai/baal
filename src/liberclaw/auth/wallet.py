"""Web3 wallet challenge-response authentication."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.database.models import WalletChallenge

CHALLENGE_EXPIRY_MINUTES = 5
SIGN_MESSAGE_TEMPLATE = (
    "Sign this message to authenticate with LiberClaw.\n\n"
    "Nonce: {nonce}\n"
    "Timestamp: {timestamp}"
)


async def create_challenge(db: AsyncSession, address: str) -> dict:
    """Create a sign-in challenge for a wallet address."""
    address = address.lower()
    nonce = secrets.token_hex(16)
    timestamp = datetime.now(timezone.utc).isoformat()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CHALLENGE_EXPIRY_MINUTES)

    # Remove old challenges for this address
    await db.execute(
        delete(WalletChallenge).where(WalletChallenge.address == address)
    )

    challenge = WalletChallenge(
        address=address,
        nonce=nonce,
        expires_at=expires_at,
    )
    db.add(challenge)
    await db.flush()

    message = SIGN_MESSAGE_TEMPLATE.format(nonce=nonce, timestamp=timestamp)
    return {"nonce": nonce, "message": message}


async def verify_signature(
    db: AsyncSession, address: str, signature: str, nonce: str
) -> bool:
    """Verify a wallet signature against a stored challenge."""
    address = address.lower()

    # Get the challenge
    result = await db.execute(
        select(WalletChallenge).where(
            WalletChallenge.address == address,
            WalletChallenge.nonce == nonce,
            WalletChallenge.expires_at > datetime.now(timezone.utc),
        )
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        return False

    # Verify signature using eth_account
    try:
        from eth_account.messages import encode_defunct
        from web3 import Web3

        message = SIGN_MESSAGE_TEMPLATE.format(
            nonce=nonce,
            timestamp=challenge.created_at.isoformat(),
        )
        msg = encode_defunct(text=message)
        recovered = Web3().eth.account.recover_message(msg, signature=signature)

        if recovered.lower() != address:
            return False
    except Exception:
        return False

    # Delete used challenge
    await db.execute(
        delete(WalletChallenge).where(WalletChallenge.id == challenge.id)
    )
    return True
