import httpx
import logging
import asyncio
from ..core.config import settings

# Reusable HTTP client with connection pooling
_http_client = None

def get_http_client():
    """Get or create a reusable HTTP client with connection pooling"""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),  # 10s total, 5s connect
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
    return _http_client

async def send_telegram_message(chat_id: str, text: str, ticket_id: str = None, retry_count: int = 3):
    """Send message to Telegram user with retry logic"""
    if not settings.BOT_TOKEN:
        logging.error("BOT_TOKEN is missing")
        return False
    if not chat_id:
        logging.error("chat_id is missing")
        return False
    
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
    
    for attempt in range(retry_count):
        try:
            logging.info(f"Sending Telegram message to {chat_id} (attempt {attempt + 1}/{retry_count})")
            client = get_http_client()
            response = await client.post(url, json=payload)
            
            if response.status_code == 200:
                logging.info("Telegram message sent successfully")
                return True
            elif response.status_code == 429:
                # Rate limited - wait and retry
                retry_after = int(response.headers.get('Retry-After', 5))
                logging.warning(f"Rate limited by Telegram, waiting {retry_after}s")
                await asyncio.sleep(retry_after)
            else:
                logging.error(f"Telegram API Error ({response.status_code}): {response.text}")
                
        except httpx.TimeoutException:
            logging.error(f"Telegram request timeout (attempt {attempt + 1})")
            await asyncio.sleep(1)
        except httpx.ConnectError as e:
            logging.error(f"Telegram connection error: {e}")
            # Reset client on connection error
            global _http_client
            if _http_client:
                await _http_client.aclose()
                _http_client = None
            await asyncio.sleep(1)
        except Exception as e:
            logging.error(f"Failed to send Telegram message: {e}")
            await asyncio.sleep(1)
    
    logging.error(f"Failed to send Telegram message after {retry_count} attempts")
    return False

async def send_telegram_photo(chat_id: str, photo_url: str, caption: str = None, ticket_id: str = None, retry_count: int = 3):
    """Send photo to Telegram user with optional caption"""
    if not settings.BOT_TOKEN:
        logging.error("BOT_TOKEN is missing")
        return False
    if not chat_id:
        logging.error("chat_id is missing")
        return False
    
    # Construct full URL if relative path
    if photo_url.startswith('/'):
        photo_url = f"https://roc-6-sdv-bges.site/api{photo_url}"
    
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendPhoto"
    payload = {
        "chat_id": chat_id,
        "photo": photo_url,
        "parse_mode": "Markdown"
    }
    
    if caption:
        payload["caption"] = caption
    
    if ticket_id:
        payload["reply_markup"] = {
            "inline_keyboard": [[
                {"text": "💬 Balas", "callback_data": f"reply_ticket_{ticket_id}"}
            ]]
        }
    
    for attempt in range(retry_count):
        try:
            logging.info(f"Sending Telegram photo to {chat_id} (attempt {attempt + 1}/{retry_count})")
            client = get_http_client()
            response = await client.post(url, json=payload)
            
            if response.status_code == 200:
                logging.info("Telegram photo sent successfully")
                return True
            elif response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 5))
                logging.warning(f"Rate limited by Telegram, waiting {retry_after}s")
                await asyncio.sleep(retry_after)
            else:
                logging.error(f"Telegram API Error ({response.status_code}): {response.text}")
                
        except httpx.TimeoutException:
            logging.error(f"Telegram photo request timeout (attempt {attempt + 1})")
            await asyncio.sleep(1)
        except Exception as e:
            logging.error(f"Failed to send Telegram photo: {e}")
            await asyncio.sleep(1)
    
    logging.error(f"Failed to send Telegram photo after {retry_count} attempts")
    return False

async def close_http_client():
    """Close the HTTP client - call on shutdown"""
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None


