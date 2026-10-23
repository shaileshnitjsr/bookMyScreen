/**
 * Deterministic Simulated Payment Provider
 *
 * Supports configurable simulation outcomes:
 * - 'success': Payment completes immediately with success
 * - 'failure': Payment completes immediately with decline
 * - 'timeout': Simulates a network or provider timeout
 * - 'delayed_success': Payment accepted in 'pending' status for subsequent callback
 */

let globalOutcomeOverride = null;

function setGlobalSimulationOutcome(outcome) {
    globalOutcomeOverride = outcome;
}

function resetSimulation() {
    globalOutcomeOverride = null;
}

/**
 * Execute a simulated payment attempt.
 *
 * @param {Object} params
 * @param {string|number} params.bookingId
 * @param {string|number} params.amount
 * @param {string} params.currency
 * @param {string} params.idempotencyKey
 * @param {string} [params.outcome] - Optional per-request outcome override
 * @returns {Promise<Object>}
 */
async function simulatePayment({
    bookingId,
    amount,
    currency = "INR",
    idempotencyKey,
    outcome,
}) {
    const selectedOutcome = outcome || globalOutcomeOverride || "success";
    const providerRef = `sim_${bookingId}_${idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}_${Date.now()}`;

    switch (selectedOutcome) {
        case "success":
            return {
                status: "succeeded",
                providerRef,
                failureReason: null,
            };

        case "failure":
            return {
                status: "failed",
                providerRef,
                failureReason: "SIMULATED_CARD_DECLINED",
            };

        case "timeout":
            // Throws simulated provider timeout
            const err = new Error("Payment provider timed out");
            err.code = "PROVIDER_TIMEOUT";
            err.providerRef = providerRef;
            throw err;

        case "delayed_success":
            return {
                status: "pending",
                providerRef,
                failureReason: null,
            };

        default:
            return {
                status: "succeeded",
                providerRef,
                failureReason: null,
            };
    }
}

module.exports = {
    simulatePayment,
    setGlobalSimulationOutcome,
    resetSimulation,
};
