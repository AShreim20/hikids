// Backend functions come back either as the payload itself or wrapped in `data`
// depending on the SDK path — always read through this helper.
export const unwrap = (raw) => raw?.data ?? raw ?? {};