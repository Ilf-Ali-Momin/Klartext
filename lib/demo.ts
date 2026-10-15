// Public demo deployment: DEMO_DEPLOYMENT=1 runs the app without an AI key, database or Stripe.
// Every upload gets the fixed fictional card, nothing is limited, and payments are turned off.

export function isPublicDemo(): boolean {
  return process.env.DEMO_DEPLOYMENT === "1";
}
