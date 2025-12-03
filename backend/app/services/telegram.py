import httpx
import logging
from ..core.config import settings

async def send_telegram_message(chat_id: str, text: str, ticket_id: str = None):
    """Send message to Telegram user"""
    if not settings.BOT_TOKEN:
        logging.error("BOT_TOKEN is missing")
        return
    if not chat_id:
        logging.error("chat_id is missing")
        return
    
    try:
        logging.info(f"Sending Telegram message to {chat_id}...")
        async with httpx.AsyncClient() as client:
            url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            
            if ticket_id:
                payload["reply_markup"] = {
                    "inline_keyboard": [[
                        {"text": "💬 Balas", "callback_data": f"reply_ticket_{ticket_id}"}
                    ]]
                }
            
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                logging.error(f"Telegram API Error: {response.text}")
            else:
                logging.info("Telegram message sent successfully")
    except Exception as e:
        logging.error(f"Failed to send Telegram message: {e}")
