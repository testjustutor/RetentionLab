import wave


class AudioWaveformGenerator:

    """
    Generates simple waveform stats.
    """

    @staticmethod
    def generate(
        audio_path
    ):

        with wave.open(
            audio_path,
            "rb"
        ) as wf:

            return {

                "channels": wf.getnchannels(),

                "sample_rate": (
                    wf.getframerate()
                ),

                "frames": (
                    wf.getnframes()
                )
            }