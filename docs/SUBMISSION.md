# Entrega Segura — Devpost submission (name may change)

Links: demo https://entrega-segura-app.vercel.app · one-click sandbox run https://entrega-segura-app.vercel.app/judge?mode=sandbox · repo github.com/sheromdevvs/entrega-segura (public)

**Tagline (≤200 chars):** Cash on delivery without the cash. The buyer authorizes once, the 50% deposit funds production, and the balance is captured only when the courier confirms delivery, on PayPal.

**Inspiration**
Pascal Studio is a small custom-gift shop in Quito, Ecuador, that sells over WhatsApp. Every order today starts with a 50% deposit by bank transfer, then photos of the finished item, then the other 50% by transfer before the courier leaves. Someone checks transfer screenshots by hand, and someone always carries the risk: the buyer pays for a box they haven't seen, or the shop ships without the balance.

**What it does**
The buyer approves the full amount once with PayPal from the chat. Entrega Segura captures the deposit immediately (Orders v2 AUTHORIZE + partial capture with final_capture=false) and keeps the balance authorized, not charged. When the courier confirms delivery with the buyer's code, the balance is captured. Refused at the door: the remaining authorization is voided. Not home twice: it waits, then asks the shop. Damaged: the shop approves an explicit partial refund. Couriers can be paid with Payouts. Every PayPal webhook is signature-verified.

**AI's role** — a model reads messy buyer and courier messages and voice notes ("no había nadie", "llegó roto") into typed delivery events, drafts the messages, and explains each decision. Deterministic code, never the model, decides what happens to money.

**Proof on the real PayPal sandbox** (reports/sandbox-e2e.json): delivered (order 9GA51186MN289643N, deposit 8WG56307DG908532N, balance 27J97872DJ7024347); refused → void (auth 4H391159H5245732V); retry ×5 → one capture (7Y877363RC263794G); defect → $4 partial refund; courier payout (batch QRZGXJZSLV4BW). 71/71 tests (13 against the real sandbox). Webhooks: 9 genuine events verified SUCCESS, forged event rejected.

**What's real vs simulated** — PayPal sandbox calls are real; WhatsApp and the courier are simulated in the app (a LAAR Courier adapter is ready, not connected); orders are fictional but use the shop's real prices and delivery options; payouts are shown at $1 because the sandbox balance ran low.

**Built with** — Next.js, TypeScript, Postgres (Neon), Vercel; PayPal Orders v2, Payments v2 (capture, void, reauthorize, refund), Payouts v1, Webhooks; OpenAI for message understanding and transcription.

**What's next** — plug it into Pascal Studio's real WhatsApp bot and LAAR's API, then offer it to other WhatsApp shops in Latin America.
