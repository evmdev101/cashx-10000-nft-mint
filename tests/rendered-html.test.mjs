import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function productionBuild() {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const assetDirectory = new URL("../dist/assets/", import.meta.url);
  const scripts = (await readdir(assetDirectory)).filter((name) => name.endsWith(".js"));
  const bundles = await Promise.all(
    scripts.map((name) => readFile(new URL(name, assetDirectory), "utf8")),
  );

  return { html, bundle: bundles.join("\n") };
}

test("builds the mainnet CashX mint experience for static hosting", async () => {
  const { html, bundle } = await productionBuild();
  assert.match(html, /<title>CashX Ecosystem NFT Mint<\/title>/i);
  assert.match(html, /evmdev101\.github\.io\/cashx-10000-nft-mint/);
  assert.match(bundle, /Mint Overview/);
  assert.match(bundle, /Connect wallet/);
  assert.match(bundle, /0x744351E2846498D040B649D694CAB21f32f14AFe/);
  assert.match(bundle, /27306495/);
  assert.match(bundle, /1000000/);
  assert.doesNotMatch(`${html}\n${bundle}`, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps the Nexion staking tab honest and ready for contract wiring", async () => {
  const [experience, css, packageJson] = await Promise.all([
    readFile(new URL("../app/MintExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(experience, /type PageView = "mint" \| "stake"/);
  assert.match(experience, /https:\/\/nexionpulse\.com\/farmexplorer/);
  assert.match(experience, /Awaiting Nexion setup/);
  assert.match(experience, /APR and reward totals will load directly from the farm contracts/);
  assert.match(experience, /This preview cannot submit staking transactions/);
  assert.match(experience, /Claim rewards[\s\S]*disabled/);
  assert.match(css, /\.stake-page\s*\{/);
  assert.match(css, /\.stake-metrics\s*\{/);
  assert.match(css, /\.stake-actions\s*\{/);
  assert.match(css, /@media \(max-width: 650px\)[\s\S]*\.stake-metrics/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("starts with Cyberpunk colors and the Constellations animation", async () => {
  const [themes, experience] = await Promise.all([
    readFile(new URL("../app/themes.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MintExperience.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(themes, /export const DEFAULT_THEME = 'cyberpunk'/);
  assert.match(themes, /cyberpunk:\s*'constellations'/);
  assert.match(experience, /useState\(DEFAULT_THEME\)/);
  assert.match(experience, /useState\(THEMES\[DEFAULT_THEME\]\)/);
  assert.match(experience, /useState\(\(\) => defaultFx\(DEFAULT_THEME\)\)/);
});

test("loads holders and mint activity from the deployed contract", async () => {
  const [experience, contract, css] = await Promise.all([
    readFile(new URL("../app/MintExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/contract.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(experience, /type Tab = "mint" \| "holders" \| "activity"/);
  assert.match(experience, /readCollectionHistory/);
  assert.match(experience, /contract\.queryFilter\(contract\.filters\.Transfer/);
  assert.match(experience, /Recent Mints/);
  assert.match(contract, /event Transfer/);
  assert.match(contract, /event Minted/);
  assert.match(css, /\.holders-table/);
  assert.match(css, /\.activity-row/);
});

test("reports the PLS raised and mint progress instead of a static supply box", async () => {
  const [experience, css] = await Promise.all([
    readFile(new URL("../app/MintExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(experience, /label="PLS raised"/);
  assert.match(experience, /const raised = mintPrice \* BigInt\(minted\)/);
  assert.match(experience, /const raiseGoal = mintPrice \* BigInt\(COLLECTION_SIZE\)/);
  assert.match(experience, /Items minted/);
  assert.match(experience, /role="progressbar"/);
  assert.match(css, /\.mint-progress-track\s*\{/);
  assert.match(css, /\.mint-progress-fill\s*\{/);

  // The replaced supply box and its captions should be gone.
  assert.doesNotMatch(experience, /label="Total supply"/);
  assert.doesNotMatch(experience, /Shared edition collection/);
  assert.doesNotMatch(experience, /chainName\} price/);
});

test("offers a local wallet disconnect without altering the browser wallet", async () => {
  const [experience, css] = await Promise.all([
    readFile(new URL("../app/MintExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(experience, /Wallet disconnected from this site\./);
  assert.match(experience, /Copy Address/);
  assert.match(experience, /Disconnect/);
  assert.match(experience, /navigator\.clipboard\.writeText\(walletAddress\)/);
  assert.match(experience, /setWalletAddress\(""\)/);
  assert.match(experience, /provider\.getBalance\(address\)/);
  assert.match(experience, /wallet-modal-backdrop/);
  assert.match(css, /\.wallet-popover\s*\{/);
  assert.match(css, /\.wallet-popover-actions\s*\{/);
  assert.match(css, /\.wallet-modal-backdrop\s*\{/);
});

test("allows a typed mint quantity up to the remaining supply", async () => {
  const experience = await readFile(
    new URL("../app/MintExperience.tsx", import.meta.url),
    "utf8",
  );

  assert.match(experience, /type="number"/);
  assert.match(experience, /aria-label="NFT quantity"/);
  assert.match(experience, /max=\{Math\.max\(1, remaining\)\}/);
  assert.match(experience, /Math\.trunc\(nextQuantity\)/);
});

test("pins the verified deployment values for the mainnet site build", async () => {
  const contract = await readFile(
    new URL("../app/contract.ts", import.meta.url),
    "utf8",
  );

  assert.match(contract, /NEXT_PUBLIC_CASHX_CHAIN_ID/);
  assert.match(contract, /NEXT_PUBLIC_CASHX_CONTRACT_ADDRESS/);
  assert.match(contract, /NEXT_PUBLIC_CASHX_DEPLOYMENT_BLOCK/);
  assert.match(contract, /configuredChainId === 369/);
  assert.match(contract, /https:\/\/rpc\.pulsechain\.com/);
  assert.match(contract, /1000000000000000000000000/);
  assert.match(contract, /0x744351E2846498D040B649D694CAB21f32f14AFe/);
  assert.match(contract, /27_306_495/);

  const validator = await readFile(
    new URL("../scripts/validate-site-config.mjs", import.meta.url),
    "utf8",
  );
  assert.match(validator, /Mainnet build refused/);
  assert.match(validator, /chainId === "369"/);
  assert.match(validator, /0x744351E2846498D040B649D694CAB21f32f14AFe/);
});
