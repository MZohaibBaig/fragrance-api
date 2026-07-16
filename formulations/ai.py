import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

SYSTEM_PROMPT = (
    "You summarize a perfumer's batch observation note. "
    'Respond with STRICT JSON only, no markdown fences, matching exactly: '
    '{"summary": "<one sentence>", "tags": ["3-6 short scent/progress tags"]}.'
)


class AINotConfigured(Exception):
    pass


class AIServiceError(Exception):
    pass


class AIResponseUnparseable(Exception):
    pass


def summarize_note(body: str) -> dict:
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise AINotConfigured('GROQ_API_KEY is not configured')

    model = os.getenv('GROQ_MODEL', DEFAULT_GROQ_MODEL)

    try:
        response = httpx.post(
            GROQ_CHAT_COMPLETIONS_URL,
            headers={'Authorization': f'Bearer {api_key}'},
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': body},
                ],
                'temperature': 0.2,
            },
            timeout=10,
        )
    except httpx.TimeoutException as exc:
        raise AIServiceError('Groq request timed out') from exc
    except httpx.HTTPError as exc:
        raise AIServiceError('Groq request failed') from exc

    if response.status_code >= 500:
        raise AIServiceError(f'Groq returned server error {response.status_code}')
    if response.status_code >= 400:
        raise AIResponseUnparseable(f'Groq returned client error {response.status_code}')

    content = response.json()['choices'][0]['message']['content'].strip()
    content = content.removeprefix('```json').removeprefix('```').removesuffix('```').strip()

    try:
        parsed = json.loads(content)
        summary = str(parsed['summary'])
        tags = [str(tag) for tag in parsed['tags']]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise AIResponseUnparseable('Could not parse Groq response as the expected JSON shape') from exc

    return {'summary': summary, 'tags': tags}
