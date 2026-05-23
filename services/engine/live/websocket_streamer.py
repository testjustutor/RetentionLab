class WebsocketStreamer:

    """
    Streams realtime events.
    """

    @staticmethod
    def send(
        socket,
        payload
    ):

        socket.send_json(
            payload
        )