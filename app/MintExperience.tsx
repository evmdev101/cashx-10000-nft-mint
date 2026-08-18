"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  type Eip1193Provider,
} from "ethers";
import ThemePicker from "./ThemePicker";
import { TiltCard } from "./TiltCard";
import {
  CASHX_ABI,
  CASHX_CONTRACT_ADDRESS,
  CASHX_DEPLOYMENT_BLOCK,
  CASHX_NETWORK,
  IMPORTANT_CONTRACTS,
  INITIAL_PRICE_WEI,
} from "./contract";
import { DEFAULT_THEME, THEMES, applyTheme, defaultFx } from "./themes";
import {
  applyBgEffectColor,
  applyBgEffectIntensity,
  applyBgEffectSize,
  applyBgPattern,
  applyFrostedGlass,
} from "./themeEffects";

const COLLECTION_SIZE = 10_000;

interface InjectedEthereumProvider extends Eip1193Provider {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: InjectedEthereumProvider;
  }
}

const rpcProvider = new JsonRpcProvider(CASHX_NETWORK.rpcUrls[0]);

type Tab = "mint" | "holders" | "activity";
type PageView = "mint" | "stake";

type HolderRow = {
  address: string;
  tokenIds: number[];
};

type MintActivity = {
  buyer: string;
  firstTokenId: number;
  quantity: number;
  totalPaid: bigint;
  transactionHash: string;
  timestamp: number;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const formatPls = (value: bigint) => {
  const [whole, rawFraction = ""] = formatEther(value).split(".");
  const fraction = rawFraction.replace(/0+$/, "").slice(0, 4);
  const formattedWhole = new Intl.NumberFormat("en-US").format(BigInt(whole));

  return fraction ? `${formattedWhole}.${fraction}` : formattedWhole;
};

const formatCompactPls = (value: bigint) => {
  const pls = Number(formatEther(value));
  // Truncate rather than round so the raised figure is never overstated.
  const compact = (divisor: number, suffix: string) =>
    `${Math.floor((pls / divisor) * 100) / 100}${suffix}`;

  if (pls >= 1_000_000_000) return compact(1_000_000_000, "B");
  if (pls >= 1_000_000) return compact(1_000_000, "M");
  if (pls >= 1_000) return compact(1_000, "K");
  return formatPls(value);
};

const buildFaqs = (priceLabel: string, symbol: string) => [
  {
    q: "What is the CashX Ecosystem NFT?",
    a: `A ${new Intl.NumberFormat("en-US").format(COLLECTION_SIZE)}-piece ERC-721 collection on ${CASHX_NETWORK.chainName}. Every token shares the same CashX Ecosystem artwork, and token IDs are issued in mint order starting at #1.`,
  },
  {
    q: "How much does a mint cost?",
    a: `${priceLabel} per NFT, paid in native ${symbol}, plus ${CASHX_NETWORK.chainName} gas. The mint panel reads the price directly from the deployed contract, so it cannot show a stale figure.`,
  },
  {
    q: "When does the mint end?",
    a: `There is no deadline. The sale stays open until all ${new Intl.NumberFormat("en-US").format(COLLECTION_SIZE)} NFTs are minted, however long that takes.`,
  },
  {
    q: "How many can I mint at once?",
    a: "Any quantity up to the number still remaining in the collection. The project sets no per-transaction cap, but a very large batch costs proportionally more gas and may not fit in a single transaction.",
  },
  {
    q: "Where does my payment go?",
    a: "The full mint payment is forwarded to the project treasury inside the same transaction. The contract itself never holds mint proceeds, and an incorrect payment amount reverts.",
  },
  {
    q: "What wallet and network do I need?",
    a: `Use MetaMask or Rabby on ${CASHX_NETWORK.chainName}. If your wallet is on a different network, the site offers to switch or add it when you connect.`,
  },
  {
    q: "Where does the artwork live?",
    a: "The image and metadata are pinned on IPFS and the metadata URI is stored in the contract, so the artwork does not depend on this website continuing to exist.",
  },
  {
    q: "Can the artwork change later?",
    a: "The owner can update the metadata URI until it is frozen. Freezing is permanent and on-chain: once frozen, nobody can change the artwork, including the owner.",
  },
  {
    q: "What happens after I mint?",
    a: "Your NFT appears in your wallet and in the Holders and Activity tabs. Nexion staking will be enabled only after Nexion confirms the farm and reward contracts for this collection; until then the Stake tab stays in setup mode.",
  },
];

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

const relativeTime = (timestamp: number) => {
  const elapsedSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86_400)}d ago`;
};

async function readCollectionHistory() {
  const contract = new Contract(CASHX_CONTRACT_ADDRESS, CASHX_ABI, rpcProvider);
  const [transferEvents, mintedEvents] = await Promise.all([
    contract.queryFilter(contract.filters.Transfer(), CASHX_DEPLOYMENT_BLOCK),
    contract.queryFilter(contract.filters.Minted(), CASHX_DEPLOYMENT_BLOCK),
  ]);

  const ownersByToken = new Map<number, string>();
  for (const event of transferEvents) {
    if (!("args" in event)) continue;
    const to = String(event.args[1]);
    const tokenId = Number(event.args[2]);
    if (to === "0x0000000000000000000000000000000000000000") {
      ownersByToken.delete(tokenId);
    } else {
      ownersByToken.set(tokenId, to);
    }
  }

  const tokensByHolder = new Map<string, number[]>();
  for (const [tokenId, address] of ownersByToken) {
    const key = address.toLowerCase();
    const tokens = tokensByHolder.get(key) ?? [];
    tokens.push(tokenId);
    tokensByHolder.set(key, tokens);
  }

  const holders: HolderRow[] = [...tokensByHolder.entries()]
    .map(([address, tokenIds]) => ({
      address,
      tokenIds: tokenIds.sort((left, right) => left - right),
    }))
    .sort((left, right) => right.tokenIds.length - left.tokenIds.length);

  const recentMintEvents = mintedEvents.slice(-25).reverse();
  const blockNumbers = [...new Set(recentMintEvents.map((event) => event.blockNumber))];
  const timestamps = new Map(
    await Promise.all(
      blockNumbers.map(async (blockNumber) => {
        const block = await rpcProvider.getBlock(blockNumber);
        return [blockNumber, block?.timestamp ?? 0] as const;
      }),
    ),
  );

  const activity: MintActivity[] = recentMintEvents.flatMap((event) => {
    if (!("args" in event)) return [];
    return [{
      buyer: String(event.args[0]),
      firstTokenId: Number(event.args[1]),
      quantity: Number(event.args[2]),
      totalPaid: BigInt(event.args[3]),
      transactionHash: event.transactionHash,
      timestamp: timestamps.get(event.blockNumber) ?? 0,
    }];
  });

  return { holders, activity };
}

const readableWalletError = (error: unknown) => {
  if (error && typeof error === "object") {
    const candidate = error as {
      shortMessage?: string;
      reason?: string;
      message?: string;
    };
    return candidate.shortMessage ?? candidate.reason ?? candidate.message ?? "Wallet request failed.";
  }

  return "Wallet request failed.";
};

async function switchToConfiguredNetwork(ethereum: InjectedEthereumProvider) {
  const currentChain = await ethereum.request({ method: "eth_chainId" });
  if (currentChain === CASHX_NETWORK.chainIdHex) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CASHX_NETWORK.chainIdHex }],
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? Number((error as { code: unknown }).code)
        : undefined;

    if (code !== 4902) throw error;

    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [CASHX_NETWORK],
    });
  }
}

function OverviewMetric({
  label,
  value,
  unit,
  note,
  long = false,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  long?: boolean;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <div className="metric-value-row">
        <strong className={long ? "is-long" : undefined}>{value}</strong>
        {unit && <em>{unit}</em>}
      </div>
      {note && <small>{note}</small>}
    </article>
  );
}

function StakePreview({
  showSetupNote,
  onConnect,
}: {
  showSetupNote: boolean;
  onConnect: () => void;
}) {
  return (
    <section className="stake-page" id="stake" aria-labelledby="stake-title">
      <div className="stake-page-summary">
        <span>Total staked</span>
        <strong>Pending launch</strong>
      </div>

      <article className="stake-card">
        <header className="stake-card-header">
          <div className="stake-identity">
            <span className="stake-thumbnail">
              <img src="cashx-art-source.png" alt="" />
            </span>
            <div>
              <small>Nexion staking</small>
              <h1 id="stake-title">CashX Ecosystem NFT</h1>
            </div>
          </div>
          <a
            className="nexion-link"
            href="https://nexionpulse.com/farmexplorer"
            target="_blank"
            rel="noreferrer"
          >
            View on Nexion <span aria-hidden="true">↗</span>
          </a>
        </header>

        <div className="stake-status-panel">
          <span>Farm status</span>
          <strong>Awaiting Nexion setup</strong>
          <small>APR and reward totals will load directly from the farm contracts.</small>
        </div>

        <div className="stake-metrics">
          <section>
            <span>Wallet balance</span>
            <strong>—</strong>
            <small>Connect wallet to load NFTs</small>
          </section>
          <section>
            <span>Reward pool</span>
            <strong>Not configured</strong>
            <small>Reward tokens supplied by Nexion</small>
          </section>
          <section>
            <span>Staked</span>
            <strong>— / {formatNumber(COLLECTION_SIZE)}</strong>
            <small>Your deposited CashX NFTs</small>
          </section>
          <section>
            <span>Pending rewards</span>
            <strong>—</strong>
            <small>Updates from the staking contract</small>
          </section>
        </div>

        <div className="stake-actions">
          <button type="button" className="stake-claim" disabled>
            Claim rewards
          </button>
          <div>
            <button type="button" className="stake-connect" onClick={onConnect}>
              Connect wallet to stake
            </button>
            <button type="button" disabled>
              Unstake
            </button>
          </div>
        </div>

        {showSetupNote && (
          <div className="stake-setup-note" role="status">
            Staking will switch on after Nexion supplies the farm contract and reward
            token details. This preview cannot submit staking transactions.
          </div>
        )}

        <footer className="stake-card-footer">
          <span>Network · PulseChain</span>
          <span>Standard · ERC-721</span>
        </footer>
      </article>
    </section>
  );
}

export function MintExperience() {
  const [pageView, setPageView] = useState<PageView>("mint");
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<Tab>("mint");
  const [showSetupNote, setShowSetupNote] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [walletNftCount, setWalletNftCount] = useState<number | null>(null);
  const [lightOn, setLightOn] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState("");
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const [mintPrice, setMintPrice] = useState(INITIAL_PRICE_WEI);
  const [minted, setMinted] = useState(0);
  const [remaining, setRemaining] = useState(COLLECTION_SIZE);
  const [saleActive, setSaleActive] = useState(false);
  const [mintMessage, setMintMessage] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [activity, setActivity] = useState<MintActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState(DEFAULT_THEME);
  const [themeColors, setThemeColors] = useState(THEMES[DEFAULT_THEME]);
  const [themeFx, setThemeFx] = useState(() => defaultFx(DEFAULT_THEME));
  const total = mintPrice * BigInt(quantity);
  const raised = mintPrice * BigInt(minted);
  const raiseGoal = mintPrice * BigInt(COLLECTION_SIZE);
  const mintedPercent = (minted / COLLECTION_SIZE) * 100;

  const refreshContractData = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const contract = new Contract(CASHX_CONTRACT_ADDRESS, CASHX_ABI, rpcProvider);
      const [nextPrice, nextMinted, nextRemaining, nextSaleActive, history] = await Promise.all([
        contract.PRICE_PER_NFT() as Promise<bigint>,
        contract.totalSupply() as Promise<bigint>,
        contract.remainingSupply() as Promise<bigint>,
        contract.saleActive() as Promise<boolean>,
        readCollectionHistory(),
      ]);

      setMintPrice(nextPrice);
      setMinted(Number(nextMinted));
      setRemaining(Number(nextRemaining));
      setSaleActive(nextSaleActive);
      setHolders(history.holders);
      setActivity(history.activity);
    } catch {
      setMintMessage(`Unable to read the ${CASHX_NETWORK.chainName} contract. Please try again.`);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshWalletBalances = useCallback(async (address: string) => {
    try {
      const contract = new Contract(CASHX_CONTRACT_ADDRESS, CASHX_ABI, rpcProvider);
      const [balance, owned] = await Promise.all([
        rpcProvider.getBalance(address),
        contract.balanceOf(address) as Promise<bigint>,
      ]);
      setWalletBalance(balance);
      setWalletNftCount(Number(owned));
    } catch {
      // Balances are informational, so a failed read must not block minting.
    }
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setMintMessage(`Install or open a browser wallet to connect to ${CASHX_NETWORK.chainName}.`);
      return null;
    }

    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await switchToConfiguredNetwork(ethereum);
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setMintMessage(`Wallet connected to ${CASHX_NETWORK.chainName}.`);
      await Promise.all([refreshContractData(), refreshWalletBalances(address)]);
      return { provider, signer };
    } catch (error) {
      setMintMessage(readableWalletError(error));
      return null;
    }
  }, [refreshContractData, refreshWalletBalances]);

  const mintNfts = useCallback(async () => {
    setIsMinting(true);
    setMintMessage("");

    try {
      const wallet = await connectWallet();
      if (!wallet) return;

      const contract = new Contract(CASHX_CONTRACT_ADDRESS, CASHX_ABI, wallet.signer);
      const currentSaleState = (await contract.saleActive()) as boolean;
      if (!currentSaleState) {
        setSaleActive(false);
        setMintMessage("The owner must enable the test sale before the first mint.");
        return;
      }

      const currentPrice = (await contract.PRICE_PER_NFT()) as bigint;
      const payment = currentPrice * BigInt(quantity);
      const transaction = await contract.mint(quantity, { value: payment });
      setMintMessage(`Mint submitted. Waiting for ${CASHX_NETWORK.chainName} confirmation…`);
      await transaction.wait();
      setMintMessage(
        `${quantity} CashX NFT${quantity === 1 ? "" : "s"} minted successfully.`,
      );
      await Promise.all([
        refreshContractData(),
        refreshWalletBalances(await wallet.signer.getAddress()),
      ]);
    } catch (error) {
      setMintMessage(readableWalletError(error));
    } finally {
      setIsMinting(false);
    }
  }, [connectWallet, quantity, refreshContractData, refreshWalletBalances]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshContractData();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refreshContractData]);

  useEffect(() => {
    applyTheme(themeColors);
  }, [themeColors]);

  useEffect(() => {
    applyBgEffectColor(themeFx.effectColor);
    applyBgEffectIntensity(themeFx.intensity);
    applyBgEffectSize(themeFx.size);
    applyFrostedGlass(themeFx.frosted);
    applyBgPattern(themeFx.pattern);
  }, [themeFx]);

  const pickTheme = (name: keyof typeof THEMES) => {
    setActiveTheme(name);
    setThemeColors(THEMES[name]);
    setThemeFx(defaultFx(name));
  };

  const applyCustomColors = (colors: typeof themeColors) => {
    setActiveTheme("custom");
    setThemeColors(colors);
  };

  const openPage = (nextView: PageView) => {
    setPageView(nextView);
    setShowSetupNote(false);
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
    } catch {
      setMintMessage("Unable to copy the address. Please copy it manually.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress("");
    setWalletBalance(null);
    setWalletNftCount(null);
    setWalletMenuOpen(false);
    setWalletCopied(false);
    setMintMessage("Wallet disconnected from this site.");
  };

  const copyWalletAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setWalletCopied(true);
    } catch {
      setMintMessage("Unable to copy the wallet address. Please copy it manually.");
    }
  };

  return (
    <main className="site-shell" id="top">
      <header className="topbar">
        <nav className="nav-left" aria-label="CashX social links">
          <a className="social-icon" href="https://t.me/+Ruw3dQPRTv00NDRl" target="_blank" rel="noreferrer" aria-label="Telegram">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
          </a>
          <a className="social-icon" href="https://x.com/TomkiwMich70997" target="_blank" rel="noreferrer" aria-label="X">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a className="social-icon" href="https://dexscreener.com/pulsechain/0xda942580cee2a69c5fc74109090816157730c64d" target="_blank" rel="noreferrer" aria-label="DexScreener">
            <svg width="20" height="20" viewBox="0 0 252 300" fill="currentColor" fillRule="evenodd" aria-hidden="true">
              <path d="M151.818 106.866c9.177-4.576 20.854-11.312 32.545-20.541 2.465 5.119 2.735 9.586 1.465 13.193-.9 2.542-2.596 4.753-4.826 6.512-2.415 1.901-5.431 3.285-8.765 4.033-6.326 1.425-13.712.593-20.419-3.197m1.591 46.886 12.148 7.017c-24.804 13.902-31.547 39.716-39.557 64.859-8.009-25.143-14.753-50.957-39.556-64.859l12.148-7.017a5.95 5.95 0 003.84-5.845c-1.113-23.547 5.245-33.96 13.821-40.498 3.076-2.342 6.434-3.518 9.747-3.518s6.671 1.176 9.748 3.518c8.576 6.538 14.934 16.951 13.821 40.498a5.95 5.95 0 003.84 5.845zM126 0c14.042.377 28.119 3.103 40.336 8.406 8.46 3.677 16.354 8.534 23.502 14.342 3.228 2.622 5.886 5.155 8.814 8.071 7.897.273 19.438-8.5 24.796-16.709-9.221 30.23-51.299 65.929-80.43 79.589-.012-.005-.02-.012-.029-.018-5.228-3.992-11.108-5.988-16.989-5.988s-11.76 1.996-16.988 5.988c-.009.005-.017.014-.029.018-29.132-13.66-71.209-49.359-80.43-79.589 5.357 8.209 16.898 16.982 24.795 16.709 2.929-2.915 5.587-5.449 8.814-8.071C69.31 16.94 77.204 12.083 85.664 8.406 97.882 3.103 111.959.377 126 0m-25.818 106.866c-9.176-4.576-20.854-11.312-32.544-20.541-2.465 5.119-2.735 9.586-1.466 13.193.901 2.542 2.597 4.753 4.826 6.512 2.416 1.901 5.432 3.285 8.766 4.033 6.326 1.425 13.711.593 20.418-3.197" />
              <path d="M197.167 75.016c6.436-6.495 12.107-13.684 16.667-20.099l2.316 4.359c7.456 14.917 11.33 29.774 11.33 46.494l-.016 26.532.14 13.754c.54 33.766 7.846 67.929 24.396 99.193l-34.627-27.922-24.501 39.759-25.74-24.231L126 299.604l-41.132-66.748-25.739 24.231-24.501-39.759L0 245.25c16.55-31.264 23.856-65.427 24.397-99.193l.14-13.754-.016-26.532c0-16.721 3.873-31.578 11.331-46.494l2.315-4.359c4.56 6.415 10.23 13.603 16.667 20.099l-2.01 4.175c-3.905 8.109-5.198 17.176-2.156 25.799 1.961 5.554 5.54 10.317 10.154 13.953 4.48 3.531 9.782 5.911 15.333 7.161 3.616.814 7.3 1.149 10.96 1.035-.854 4.841-1.227 9.862-1.251 14.978L53.2 160.984l25.206 14.129a41.926 41.926 0 015.734 3.869c20.781 18.658 33.275 73.855 41.861 100.816 8.587-26.961 21.08-82.158 41.862-100.816a41.865 41.865 0 015.734-3.869l25.206-14.129-32.665-18.866c-.024-5.116-.397-10.137-1.251-14.978 3.66.114 7.344-.221 10.96-1.035 5.551-1.25 10.854-3.63 15.333-7.161 4.613-3.636 8.193-8.399 10.153-13.953 3.043-8.623 1.749-17.689-2.155-25.799l-2.01-4.175z" />
            </svg>
          </a>
          <a className="social-icon" href="https://www.youtube.com/watch?v=UefZfzeoU_M" target="_blank" rel="noreferrer" aria-label="YouTube">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
        </nav>

        <nav className="nav-center" aria-label="Primary navigation">
          <button
            className={pageView === "mint" ? "nav-tab active" : "nav-tab"}
            type="button"
            aria-pressed={pageView === "mint"}
            onClick={() => openPage("mint")}
          >
            Mint
          </button>
          <button
            className={pageView === "stake" ? "nav-tab active" : "nav-tab"}
            type="button"
            aria-pressed={pageView === "stake"}
            onClick={() => openPage("stake")}
          >
            Stake
          </button>
        </nav>

        <div className="nav-actions">
          <ThemePicker
            activeName={activeTheme}
            colors={themeColors}
            fx={themeFx}
            onPickTheme={pickTheme}
            onCustomColors={applyCustomColors}
            onFx={setThemeFx}
          />
          <div className="wallet-menu">
            <button
              className="wallet-button"
              type="button"
              aria-expanded={walletAddress ? walletMenuOpen : undefined}
              aria-controls={walletAddress ? "wallet-account-menu" : undefined}
              onClick={() => {
                if (walletAddress) {
                  setWalletCopied(false);
                  setWalletMenuOpen((open) => !open);
                } else {
                  void connectWallet();
                }
              }}
            >
              {walletAddress ? shortAddress(walletAddress) : "Connect wallet"}
            </button>

            {walletAddress && walletMenuOpen && (
              <div
                className="wallet-modal-backdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setWalletMenuOpen(false);
                  }
                }}
              >
                <section
                  className="wallet-popover"
                  id="wallet-account-menu"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Connected wallet"
                >
                  <button
                    className="wallet-popover-close"
                    type="button"
                    onClick={() => setWalletMenuOpen(false)}
                    aria-label="Close wallet menu"
                  >
                    ×
                  </button>
                  <span className="wallet-avatar" aria-hidden="true" />
                  <strong>{shortAddress(walletAddress)}</strong>
                  <small>{walletBalance === null ? "Loading balance…" : `${formatPls(walletBalance)} PLS`}</small>
                  <div className="wallet-popover-actions">
                    <button type="button" onClick={() => void copyWalletAddress()}>
                      <span aria-hidden="true">⧉</span>
                      {walletCopied ? "Copied" : "Copy Address"}
                    </button>
                    <button type="button" onClick={disconnectWallet}>
                      <span aria-hidden="true">↪</span>
                      Disconnect
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </header>

      {pageView === "mint" && <div className="nft-page" id="mint">
        <section className="overview-section" aria-labelledby="mint-overview-title">
          <h1 id="mint-overview-title">Mint Overview</h1>
          <div className="overview-grid" aria-label="Collection facts">
            <OverviewMetric
              label="Price per NFT"
              value={formatPls(mintPrice)}
              unit={CASHX_NETWORK.nativeCurrency.symbol}
              long
            />
            <OverviewMetric
              label="PLS raised"
              value={formatCompactPls(raised)}
              unit={CASHX_NETWORK.nativeCurrency.symbol}
              note={`Goal · ${formatCompactPls(raiseGoal)} ${CASHX_NETWORK.nativeCurrency.symbol}`}
            />
            <OverviewMetric
              label="Total minted"
              value={formatNumber(minted)}
              unit="NFTs"
              note={saleActive ? `${formatNumber(remaining)} remaining` : "Sale awaiting owner activation"}
            />
          </div>
        </section>

        <div className="nft-tabs" role="tablist" aria-label="Collection information">
          {(["mint", "holders", "activity"] as Tab[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => setTab(item)}
            >
              {item === "mint" ? "Mint" : item === "holders" ? "Holders" : "Activity"}
            </button>
          ))}
        </div>

        {tab === "mint" && (
          <section className="degen-mint-layout">
            <div className="art-column">
              <TiltCard
                src="cashx-art-source.png"
                alt="CashX Ecosystem NFT"
                light={lightOn}
              />
              <button
                type="button"
                className={lightOn ? "light-toggle is-on" : "light-toggle"}
                onClick={() => setLightOn((on) => !on)}
                aria-pressed={lightOn}
                title="Toggle the light effect"
              >
                Light {lightOn ? "On" : "Off"}
              </button>
            </div>

            <div className="purchase-column">
              <h2>Mint CashX Ecosystem NFT</h2>

              <div className="mint-progress">
                <div className="mint-progress-head">
                  <span>Items minted</span>
                  <span>{formatNumber(minted)} / {formatNumber(COLLECTION_SIZE)}</span>
                </div>
                <div
                  className="mint-progress-track"
                  role="progressbar"
                  aria-label="Items minted"
                  aria-valuemin={0}
                  aria-valuemax={COLLECTION_SIZE}
                  aria-valuenow={minted}
                >
                  <div
                    className="mint-progress-fill"
                    style={{ width: `${minted === 0 ? 0 : Math.max(mintedPercent, 1)}%` }}
                  />
                </div>
              </div>

              <div className="compact-purchase-panel">
                <div className="steps">
                  <span className="current"><b>1</b> Choose quantity</span>
                  <i aria-hidden="true">→</i>
                  <span><b>2</b> Mint NFT</span>
                </div>

                <div className="compact-mint-row">
                  <div className="compact-price">
                    <strong>{formatPls(mintPrice)} {CASHX_NETWORK.nativeCurrency.symbol}</strong>
                    <small>Total · {formatPls(total)} {CASHX_NETWORK.nativeCurrency.symbol}</small>
                  </div>
                  <div className="compact-mint-actions">
                    <div className="compact-stepper" role="group" aria-label="NFT quantity controls">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={quantity <= 1}
                        onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        aria-label="NFT quantity"
                        min={1}
                        max={Math.max(1, remaining)}
                        step={1}
                        inputMode="numeric"
                        value={quantity}
                        onChange={(event) => {
                          const nextQuantity = event.currentTarget.valueAsNumber;
                          if (Number.isNaN(nextQuantity)) return;
                          setQuantity(
                            Math.min(
                              Math.max(1, Math.trunc(nextQuantity)),
                              Math.max(1, remaining),
                            ),
                          );
                        }}
                        onWheel={(event) => event.currentTarget.blur()}
                      />
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={quantity >= remaining}
                        onClick={() =>
                          setQuantity((value) => Math.min(Math.max(1, remaining), value + 1))
                        }
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="compact-mint-button"
                      type="button"
                      disabled={isMinting}
                      onClick={() => void (walletAddress ? mintNfts() : connectWallet())}
                    >
                      {isMinting
                        ? "Minting…"
                        : walletAddress
                          ? `Mint ${quantity} NFT${quantity === 1 ? "" : "s"}`
                          : "Connect wallet"}
                    </button>
                  </div>
                </div>

                {mintMessage && (
                  <div className="setup-note" role="status">
                    {mintMessage}
                  </div>
                )}
              </div>

              <section className="recent-mints" aria-labelledby="live-mints-title">
                <div className="recent-mints-title">
                  <h3 id="live-mints-title">Live Mints</h3>
                </div>
                <div className="recent-mints-table">
                  <div className="recent-mints-header" aria-hidden="true">
                    <span>Minter</span>
                    <span>Price</span>
                    <span>Qty</span>
                    <span>Time</span>
                  </div>
                  {activity.length === 0 ? (
                    <div className="recent-mints-empty">
                      {historyLoading ? "Loading on-chain mint activity…" : "No NFTs minted yet."}
                    </div>
                  ) : (
                    activity.slice(0, 5).map((mint) => (
                      <div className="recent-mint-row" key={mint.transactionHash}>
                        <a
                          href={`${CASHX_NETWORK.blockExplorerUrls[0]}/address/${mint.buyer}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddress(mint.buyer)}
                          <small>
                            CashX #{mint.firstTokenId}
                            {mint.quantity > 1 ? `–${mint.firstTokenId + mint.quantity - 1}` : ""}
                          </small>
                        </a>
                        <strong>{formatPls(mint.totalPaid)} {CASHX_NETWORK.nativeCurrency.symbol}</strong>
                        <span>{mint.quantity}</span>
                        <time>{relativeTime(mint.timestamp)}</time>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {walletAddress && (
                <div className="wallet-balances">
                  <div>
                    <span>Your {CASHX_NETWORK.nativeCurrency.symbol}</span>
                    <strong>
                      {walletBalance === null ? "…" : formatPls(walletBalance)}
                    </strong>
                  </div>
                  <div>
                    <span>Your CashX NFTs</span>
                    <strong>
                      {walletNftCount === null ? "…" : formatNumber(walletNftCount)}
                    </strong>
                  </div>
                </div>
              )}

              <section className="contract-links" aria-labelledby="contract-links-title">
                <h3 id="contract-links-title">Important contracts</h3>
                {IMPORTANT_CONTRACTS.map(({ label, address }) => (
                  <div className="contract-link-row" key={address}>
                    <div>
                      <span>{label}</span>
                      <a
                        href={`${CASHX_NETWORK.blockExplorerUrls[0]}/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {address.slice(0, 10)}…{address.slice(-8)}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyAddress(address)}
                      aria-label={`Copy the ${label} address`}
                    >
                      {copiedAddress === address ? "Copied" : "Copy"}
                    </button>
                  </div>
                ))}
              </section>
            </div>
          </section>
        )}

        {tab === "holders" && (
          <section className="holders-panel" aria-labelledby="holders-title">
            <div className="chain-tab-heading">
              <div>
                <span>On-chain ownership</span>
                <h2 id="holders-title">Holders</h2>
              </div>
              <strong>{holders.length} holder{holders.length === 1 ? "" : "s"}</strong>
            </div>

            <div className="holders-table">
              <div className="holders-header" aria-hidden="true">
                <span>Wallet</span>
                <span>Owned</span>
                <span>% owned</span>
                <span>Items</span>
              </div>

              {holders.length === 0 ? (
                <div className="chain-empty-state">
                  {historyLoading ? "Loading holders from PulseChain…" : "No holders yet. The first minter will appear here."}
                </div>
              ) : (
                holders.map((holder, index) => (
                  <article className="holder-row" key={holder.address}>
                    <a
                      className="holder-wallet"
                      href={`${CASHX_NETWORK.blockExplorerUrls[0]}/address/${holder.address}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i style={{ "--holder-index": index } as CSSProperties} />
                      {shortAddress(holder.address)}
                    </a>
                    <strong>{formatNumber(holder.tokenIds.length)}</strong>
                    <span>
                      {minted === 0 ? "0" : ((holder.tokenIds.length / minted) * 100).toFixed(1)}%
                    </span>
                    <div className="holder-items">
                      {holder.tokenIds.slice(0, 3).map((tokenId) => (
                        <span title={`CashX #${tokenId}`} key={tokenId}>
                          <img src="cashx-art-source.png" alt="" />
                          <b>#{tokenId}</b>
                        </span>
                      ))}
                      {holder.tokenIds.length > 3 && <em>+{holder.tokenIds.length - 3}</em>}
                    </div>
                  </article>
                ))
              )}
            </div>

            <footer className="chain-tab-footer">
              {holders.length} holder{holders.length === 1 ? "" : "s"} · {formatNumber(minted)} minted
            </footer>
          </section>
        )}

        {tab === "activity" && (
          <section className="activity-panel" aria-labelledby="activity-title">
            <div className="chain-tab-heading">
              <div>
                <span>Latest transactions</span>
                <h2 id="activity-title">Recent Mints</h2>
              </div>
              <strong>{activity.length} event{activity.length === 1 ? "" : "s"}</strong>
            </div>

            <div className="activity-list">
              {activity.length === 0 ? (
                <div className="chain-empty-state">
                  {historyLoading ? "Loading mint activity from PulseChain…" : "No mint events yet."}
                </div>
              ) : (
                activity.map((mint) => (
                  <article className="activity-row" key={mint.transactionHash}>
                    <div>
                      <span>
                        <b>{shortAddress(mint.buyer)}</b> minted {mint.quantity} NFT{mint.quantity === 1 ? "" : "s"}
                      </span>
                      <strong>
                        CashX #{mint.firstTokenId}
                        {mint.quantity > 1 ? `–${mint.firstTokenId + mint.quantity - 1}` : ""}
                      </strong>
                      <small>{formatPls(mint.totalPaid)} {CASHX_NETWORK.nativeCurrency.symbol} total</small>
                    </div>
                    <time>{relativeTime(mint.timestamp)}</time>
                    <a
                      href={`${CASHX_NETWORK.blockExplorerUrls[0]}/tx/${mint.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View tx ↗
                    </a>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        <section className="faq-section" aria-labelledby="faq-title">
          <h2 id="faq-title">FAQ</h2>
          <div className="faq-list">
            {buildFaqs(
              `${formatPls(mintPrice)} ${CASHX_NETWORK.nativeCurrency.symbol}`,
              CASHX_NETWORK.nativeCurrency.symbol,
            ).map(({ q, a }) => (
              <details className="faq-item" key={q}>
                <summary>
                  {q}
                  <i aria-hidden="true">+</i>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>}

      {pageView === "stake" && (
        <StakePreview
          showSetupNote={showSetupNote}
          onConnect={() => {
            setShowSetupNote(true);
            void connectWallet();
          }}
        />
      )}
    </main>
  );
}
