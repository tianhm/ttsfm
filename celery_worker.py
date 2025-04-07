from celery import Celery
import os
from dotenv import load_dotenv
import requests
import time
import random
import logging
import uuid
from fake_useragent import UserAgent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize User-Agent
ua = UserAgent()

# Create Celery instance
celery = Celery('ttsfm',
                broker=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
                backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0'))

# Celery Configuration
celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
)

def _get_headers():
    """Generate realistic browser headers with rotation"""
    browsers = [
        {
            "User-Agent": ua.chrome,
            "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        },
        {
            "User-Agent": ua.firefox,
            "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        },
        {
            "User-Agent": ua.edge,
            "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="121", "Microsoft Edge";v="121"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }
    ]
    
    browser = random.choice(browsers)
    return {
        "Authority": "www.openai.fm",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Dnt": "1",
        "Referer": "https://www.openai.fm/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Requested-With": "XMLHttpRequest",
        **browser
    }

def _get_random_delay():
    """Get random delay time (1-5 seconds) with jitter"""
    base_delay = random.uniform(1, 5)
    jitter = random.uniform(0.1, 0.5)
    return base_delay + jitter

@celery.task(bind=True, name='tasks.process_tts_request')
def process_tts_request(self, task_data):
    """Process a TTS request and return the audio data"""
    max_retries = 3
    retry_count = 0
    base_delay = 1
    verify_ssl = os.getenv("VERIFY_SSL", "true").lower() != "false"
    
    while retry_count < max_retries:
        try:
            # Add random delay between requests for more natural behavior
            time.sleep(_get_random_delay())
            
            logger.info(f"Sending request to OpenAI.fm with data: {task_data['data']}")
            
            # Add generation ID to request data
            task_data['data']['generation'] = str(uuid.uuid4())
            
            # Check format setting
            if 'format' in task_data['data']:
                logger.info(f"Requesting audio in format: {task_data['data']['format']}")
            
            response = requests.post(
                "https://www.openai.fm/api/generate",
                data=task_data['data'],
                headers=_get_headers(),
                timeout=30,
                verify=verify_ssl
            )
            
            if response.status_code == 403:
                logger.warning("Received 403 Forbidden from OpenAI.fm")
                retry_count += 1
                time.sleep(base_delay * (2 ** retry_count))  # Exponential backoff
                continue
            
            if response.status_code == 429:
                logger.warning("Rate limited by OpenAI.fm")
                retry_after = int(response.headers.get('Retry-After', 60))
                self.retry(countdown=retry_after)
            
            if response.status_code == 503:
                logger.warning("Service unavailable from OpenAI.fm")
                retry_count += 1
                time.sleep(base_delay * (2 ** retry_count))
                continue
            
            if response.status_code != 200:
                logger.error(f"Error from OpenAI.fm: {response.status_code}")
                error_msg = f"Error from upstream service: {response.status_code}"
                return None, error_msg, response.status_code
            
            # Return the audio data, content type, and status code
            return response.content, None, 200
            
        except requests.exceptions.Timeout:
            logger.error("Request timeout")
            retry_count += 1
            time.sleep(base_delay * (2 ** retry_count))
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error: {str(e)}")
            retry_count += 1
            time.sleep(base_delay * (2 ** retry_count))
        except Exception as e:
            logger.error(f"Error processing TTS request: {str(e)}")
            retry_count += 1
            time.sleep(base_delay * (2 ** retry_count))
            if retry_count >= max_retries:
                return None, str(e), 500
    
    # If we've exhausted retries
    logger.error("Exhausted retries for TTS request")
    return None, "Failed to process request after multiple retries", 500 