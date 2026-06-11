"""SDK identity and the wire-contract major it speaks.

The contract version is surfaced in the X-Dispatch-Sdk header so the backend can observe
which contract a client uses (e.g. "dispatch-python/1.2.0 (contract/1)"). A breaking wire
change bumps CONTRACT_VERSION and the whole SDK family's major together.
"""

SDK_NAME = "dispatch-python"
SDK_VERSION = "1.0.0"
CONTRACT_VERSION = "1"
