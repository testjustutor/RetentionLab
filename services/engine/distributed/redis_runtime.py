class RedisRuntime:

    """
    Placeholder Redis runtime.
    """

    def __init__(
        self,
        host="localhost",
        port=6379
    ):

        self.host = host

        self.port = port

    # ==========================================
    # CONNECT
    # ==========================================

    def connect(
        self
    ):

        return {

            "connected": True,

            "host": self.host,

            "port": self.port
        }