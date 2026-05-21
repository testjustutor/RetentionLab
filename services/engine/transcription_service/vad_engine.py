import webrtcvad
import wave


class VoiceActivityDetector:

    """
    Voice activity detector.
    """

    def __init__(self):

        self.vad = webrtcvad.Vad(2)

    # ==========================================
    # DETECT
    # ==========================================

    def detect(
        self,
        audio_path
    ):

        results = []

        try:

            with wave.open(
                audio_path,
                "rb"
            ) as wf:

                sample_rate = wf.getframerate()

                while True:

                    frame = wf.readframes(
                        480
                    )

                    if not frame:

                        break

                    speech = self.vad.is_speech(

                        frame,

                        sample_rate
                    )

                    results.append(
                        speech
                    )

        except Exception:

            pass

        return results