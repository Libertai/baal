from cryptography.fernet import Fernet


def encrypt(value: str, key: str) -> str:
    """Encrypt a string value. Returns encrypted string."""
    fernet = Fernet(key)
    return fernet.encrypt(value.encode()).decode()


def decrypt(encrypted: str, key: str) -> str:
    """Decrypt an encrypted string. Returns original value."""
    fernet = Fernet(key)
    return fernet.decrypt(encrypted.encode()).decode()
