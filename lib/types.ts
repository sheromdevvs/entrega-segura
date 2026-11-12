export const eventKinds = [
  "delivered",
  "refused",
  "not_home",
  "partial_delivery",
  "defect_reported",
  "authorization_expiring",
  "unknown",
] as const;
export type EventKind = (typeof eventKinds)[number];
export type DeliveryEvent = {
  id: string;
  kind: EventKind;
  at: string;
  code?: string;
  hasPhoto?: boolean;
  observedState?: MoneyState;
  photo?: string;
  applied?: boolean;
  decision?: Decision;
  interpretation?: {
    kind: EventKind;
    explanation: string;
    reply: string;
    provider: string;
    model: string;
  };
  source: "chat" | "simulated_laar" | "system";
  text: string;
};
export type Decision = {
  action: "release" | "cancel" | "wait" | "ask_shop" | "refund_partial";
  reason: string;
};
export type ApiCall = {
  at: string;
  method: string;
  path: string;
  status: number;
  debugId: string | null;
  requestId?: string;
  response: Record<string, unknown>;
};
export type MoneyState =
  | "awaiting_approval"
  | "authorized"
  | "deposit_pending"
  | "held"
  | "released"
  | "voided"
  | "refunded"
  | "review";
export type Reservation = {
  ref: string;
  owner: string;
  source: "judge" | "pascal";
  merchantRef?: string;
  product: string;
  total: number;
  deposit: number;
  currency: "USD";
  code: string;
  createdAt: string;
  state: MoneyState;
  paypalOrderId?: string;
  approvalUrl?: string;
  authorizationId?: string;
  authorizationAt?: string;
  originalAuthorizationAt?: string;
  captures: {
    id: string;
    amount: number;
    status: string;
    role: "deposit" | "balance";
  }[];
  refunds: { id: string; amount: number; status: string }[];
  events: DeliveryEvent[];
  decisions: Decision[];
  calls: ApiCall[];
  lastWebhook?: {
    id: string;
    type: string;
    transmissionId: string;
    verification_status: "SUCCESS";
    at: string;
  };
  lastError?: string;
  refundIntent?: number;
  payout?: Record<string, unknown>;
};
