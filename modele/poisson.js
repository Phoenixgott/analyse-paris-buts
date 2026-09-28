const LOG_FACT = [0];
for (let k = 1; k <= 200; k++) LOG_FACT[k] = LOG_FACT[k - 1] + Math.log(k);

export function logFactorielle(k) {
  return LOG_FACT[k] ?? LOG_FACT[200] + Array.from({ length: k - 200 }, (_, i) => Math.log(201 + i)).reduce((a, b) => a + b, 0);
}

/** P(X = k) pour X ~ Poisson(lambda). */
export function poisson(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorielle(k));
}

export function logPoisson(k, lambda) {
  return k * Math.log(lambda) - lambda - logFactorielle(k);
}
