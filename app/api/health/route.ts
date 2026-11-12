export async function GET() {
  return Response.json({
    ok: true,
    product: "Entrega Segura",
    payments: "sandbox-only",
    paypalConfigured: !!process.env.PAYPAL_CLIENT_ID,
    aiConfigured: !!(
      process.env.DEEPINFRA_API_KEY || process.env.OPENAI_API_KEY
    ),
    webhookConfigured: !!process.env.PAYPAL_WEBHOOK_ID,
  });
}
