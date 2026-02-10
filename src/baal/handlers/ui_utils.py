# src/baal/handlers/ui_utils.py

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

# Status emoji mapping
STATUS_EMOJIS = {
    "running": "🟢",
    "deploying": "🟡",
    "pending": "⏳",
    "failed": "🔴",
    "stopped": "⚫",
}

def format_section(title: str, content: str) -> str:
    """Format a message section with clean header."""
    if not content:
        return f"*{title}*"
    return f"*{title}*\n{content}"

def get_quick_actions_keyboard() -> InlineKeyboardMarkup:
    """Standard quick actions for main menu."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🚀 Create Agent", callback_data="quick_create"),
            InlineKeyboardButton("📋 My Agents", callback_data="quick_list"),
        ],
        [
            InlineKeyboardButton("💳 Account", callback_data="quick_account"),
            InlineKeyboardButton("ℹ️ Help", callback_data="quick_help"),
        ],
    ])

def get_persistent_nav_keyboard() -> InlineKeyboardMarkup:
    """Persistent navigation for chat mode."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🏠 Main Menu", callback_data="nav_main"),
            InlineKeyboardButton("📋 My Agents", callback_data="nav_list"),
            InlineKeyboardButton("⚙️ Account", callback_data="nav_account"),
        ],
    ])

def format_time_delta(seconds: int) -> str:
    """Format seconds into human-readable duration."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

def format_age(created_at: str) -> str:
    """Format ISO timestamp into relative age."""
    from datetime import datetime, timezone
    created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    age = datetime.now(timezone.utc) - created

    if age.days > 0:
        return f"{age.days} day{'s' if age.days != 1 else ''} ago"
    elif age.seconds > 3600:
        hours = age.seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    else:
        minutes = age.seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
