/**
 * Estende o app.json. FLUENT_BASE_URL define o subcaminho da versão web/PWA
 * (ex.: "/zanshin" no GitHub Pages: https://<usuario>.github.io/zanshin/).
 */
module.exports = ({ config }) => {
  const baseUrl = (process.env.FLUENT_BASE_URL || "").replace(/\/$/, "");
  return {
    ...config,
    experiments: { ...config.experiments, ...(baseUrl ? { baseUrl } : {}) },
  };
};
