export type CourierStatus = {
  state: "delivered" | "not_home" | "refused" | "in_transit";
  at: string;
  evidence: string;
  simulated: boolean;
};
export interface CourierAdapter {
  getStatus(trackingId: string): Promise<CourierStatus>;
}
export class SimulatedLaar implements CourierAdapter {
  constructor(private scenario: CourierStatus["state"] = "in_transit") {}
  async getStatus(trackingId: string): Promise<CourierStatus> {
    return {
      state: this.scenario,
      at: new Date().toISOString(),
      evidence: `Simulated LAAR event for fictional tracking ${trackingId}`,
      simulated: true,
    };
  }
}
export class WhatsAppCodeConfirm implements CourierAdapter {
  constructor(
    private text: string,
    private expectedCode: string,
  ) {}
  async getStatus(trackingId: string): Promise<CourierStatus> {
    const code = this.text.match(/\b\d{4}\b/)?.[0];
    return {
      state: code === this.expectedCode ? "delivered" : "in_transit",
      at: new Date().toISOString(),
      evidence: `Chat simulator · ${trackingId} · ${code === this.expectedCode ? "code matched" : "awaiting matching code"}`,
      simulated: true,
    };
  }
}
