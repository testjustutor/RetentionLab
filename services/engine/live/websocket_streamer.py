# services/engine/live/websocket_streamer.py

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