# services/engine/transcription_service/audio_fingerprint.py

import hashlib


class AudioFingerprint:

    """
    Generates audio fingerprints.
    """

    @staticmethod
    def generate(
        audio_bytes
    ):

        return hashlib.sha256(
            audio_bytes
        ).hexdigest()