import type { Metadata } from "next";
import { MintExperience } from "./MintExperience";

export const metadata: Metadata = {
  title: "CashX Ecosystem NFT Mint",
  description:
    "A 10,000-piece CashX Ecosystem NFT collection on PulseChain. One shared artwork, priced at 1,000,000 PLS per NFT, with no mint deadline.",
};

export default function Home() {
  return <MintExperience />;
}
