export type MarketSymbol = "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "DOGEUSDT";

export type TradingMode = "demo" | "live";

export interface AlertItem {
  id: string;
  level: "P0" | "P1" | "P2";
  title: string;
  message: string;
  createdAt: string;
}
