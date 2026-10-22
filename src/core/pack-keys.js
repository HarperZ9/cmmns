// The public half of Radar's project key, which signs the data that ships inside Radar
// (src/ext/radar-data.pack.json, scripts/pack.mjs bundled). The private half never enters this
// repository (tests/no-private-keys.test.js). Anyone can check a download against this key id.
export const PROJECT_KEY = {
  keyId: "0e5e19840565840c977e0f036c9ac021",
  label: "Radar project key",
  jwk: { kty: "EC", crv: "P-256", x: "0iyHwn2zRDoP7RfuuxvKGxhRYmAXiS7NelteWFPo8CM", y: "8n431mx6HCqh1hNM1xZmJeDX2ZPckhNUlIBezeKro_k" },
};
