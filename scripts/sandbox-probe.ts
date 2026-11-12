import { api } from "../lib/paypal/client";
import { createOrder } from "../lib/orders";
import { hold, completeApproval, release } from "../lib/paypal";
import { get } from "../lib/store";
async function main() {
  const ref = process.argv[2];
  if (!ref) {
    const r = await createOrder("local-probe");
    const order = await hold({
      orderRef: r.ref,
      total: r.total,
      depositNow: r.deposit,
      currency: r.currency,
    });
    console.log(
      JSON.stringify(
        {
          orderRef: r.ref,
          paypalOrderId: order.paypalOrderId,
          approvalUrl: order.approvalUrl,
          instruction:
            "Open approval URL, log in with sandbox buyer, approve. Then rerun npm run sandbox:probe -- ORDER_REF",
        },
        null,
        2,
      ),
    );
    return;
  }
  await completeApproval({ orderRef: ref });
  const r = await release({ orderRef: ref });
  const auth = await api(
    `/v2/payments/authorizations/${r.authorizationId}`,
    "GET",
    undefined,
    { ref, verb: "status" },
  );
  console.log(
    JSON.stringify(
      {
        orderRef: ref,
        authorization: r.authorizationId,
        captures: r.captures,
        authorizationStatus: auth.status,
        multiplePartialCaptureProven:
          r.captures.length === 2 &&
          r.captures.every((x) => x.status === "COMPLETED"),
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
