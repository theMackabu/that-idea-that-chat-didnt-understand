import type { UitermApi } from "../../preload";

declare global {
  interface Window {
    uiterm: UitermApi;
  }
}
