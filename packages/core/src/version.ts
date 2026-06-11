// The SDK package version and the WIRE CONTRACT major it speaks. The contract version is
// surfaced in the X-Dispatch-Sdk header so the backend can observe which contract a client
// uses (e.g. "dispatch-node/1.2.0 (contract/1)"). A breaking wire change bumps CONTRACT_VERSION
// and the whole SDK family's major together.
export const SDK_NAME = "dispatch-js";
export const SDK_VERSION = "1.0.0";
export const CONTRACT_VERSION = "1";
