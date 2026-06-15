# services/shared/ai_config.py
import os
import json
import subprocess


def load_settings_ai():
    """
    Evaluates root/config/settings.js directly via Node and returns
    its `ai` config object. settings.js remains the single source of truth.
    """
    settings_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..", "..", "config", "settings.js"
        )
    )

    result = subprocess.run(
        ["node", "-e", f"console.log(JSON.stringify(require({json.dumps(settings_path)}).ai))"],
        capture_output=True,
        text=True,
        check=True,
        cwd=os.path.dirname(settings_path),
    )

    return json.loads(result.stdout)


def build_ai_config(ai_settings: dict):
    """
    Given the `ai` settings from settings.js, picks the active provider,
    checks whether a usable key exists for it, and returns a ready-to-use
    ai_config dict for AiApiService — or None if AI isn't usable
    (caller should fall back to its non-AI worker).
    """
    provider = os.getenv("AI_PROVIDER", ai_settings.get("provider", "gemini")).lower()

    provider_keys = {
        "groq": ai_settings.get("groqApiKey"),
        "gemini": ai_settings.get("geminiApiKey"),
        "openai": ai_settings.get("openaiApiKey"),
        "xai": ai_settings.get("xaiApiKey"),
    }

    if not provider_keys.get(provider):
        return None

    return {
        "provider": provider,
        "groqApiKey": ai_settings.get("groqApiKey"),
        "openaiApiKey": ai_settings.get("openaiApiKey"),
        "xaiApiKey": ai_settings.get("xaiApiKey"),
        "ollamaUrl": ai_settings.get("ollamaUrl", "http://localhost:11434/v1"),
        "ollamaModel": ai_settings.get("ollamaModel", "llama3.1"),
        "geminiApiKey": ai_settings.get("geminiApiKey"),
        "geminiModel": ai_settings.get("geminiModel", "gemini-2.5-flash"),
    }