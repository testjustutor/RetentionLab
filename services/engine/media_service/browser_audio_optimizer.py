class BrowserAudioOptimizer:

    """
    Browser audio cleanup settings.
    """

    @staticmethod
    def build_ffmpeg_args():

        return [

            "-ac", "1",
            "-ar", "16000",
            "-af", "highpass=f=200,lowpass=f=3000"
        ]