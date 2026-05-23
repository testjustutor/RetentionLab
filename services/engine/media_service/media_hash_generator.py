import hashlib


class MediaHashGenerator:

    """
    Generates file hashes.
    """

    @staticmethod
    def generate(
        path
    ):

        sha = hashlib.sha256()

        with open(path, "rb") as file:

            while True:

                chunk = file.read(8192)

                if not chunk:

                    break

                sha.update(chunk)

        return sha.hexdigest()