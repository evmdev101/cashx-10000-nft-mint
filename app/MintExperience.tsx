"use client";

import { useState } from "react";

const COLLECTION_SIZE = 10_000;
const PRICE_PER_NFT = 1_000_000;
const DISPLAY_MINTED = 0;

type Tab = "mint" | "collection" | "activity";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export function MintExperience() {
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<Tab>("mint");
  const [showSetupNote, setShowSetupNote] = useState(false);
  const total = quantity * PRICE_PER_NFT;

  const requestWallet = () => setShowSetupNote(true);

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="CashX Ecosystem home">
          <span className="brand-mark" aria-hidden="true">
            X
          </span>
          <span>
            <strong>CashX</strong>
            <small>ECOSYSTEM</small>
          </span>
        </a>

        <nav aria-label="Primary navigation">
          <a href="#mint">Mint</a>
          <a href="#utility">Utility</a>
          <a href="#details">Details</a>
        </nav>

        <button className="wallet-button" type="button" onClick={requestWallet}>
          <span className="status-dot" /> Connect wallet
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> PulseChain collection
          </span>
          <h1>
            The CashX
            <span>Ecosystem NFT</span>
          </h1>
          <p>
            One iconic artwork. Ten thousand ecosystem NFTs. Built as a clean,
            open-ended mint for the CashX community.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#mint">
              Enter the mint <span aria-hidden="true">↓</span>
            </a>
            <span className="chain-pill">◇ PulseChain</span>
          </div>
        </div>

        <div className="hero-art" aria-label="CashX Ecosystem NFT artwork">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-frame">
            <div className="art-crop">
              <img
                className="art-source"
                src="/cashx-art-source.png"
                alt="CashX Ecosystem artwork featuring the CashX, DividendX, DistributionX, and Grand Slam X brands"
              />
            </div>
            <div className="edition-chip">
              <span>Edition</span>
              <strong>01 / 10,000</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="stat-rail" aria-label="Collection facts">
        <article>
          <span>Price per NFT</span>
          <strong>{formatNumber(PRICE_PER_NFT)}</strong>
          <small>PLS</small>
        </article>
        <article>
          <span>Total supply</span>
          <strong>{formatNumber(COLLECTION_SIZE)}</strong>
          <small>NFTs</small>
        </article>
        <article>
          <span>Mint window</span>
          <strong>Open</strong>
          <small>No deadline</small>
        </article>
        <article>
          <span>Artwork</span>
          <strong>1</strong>
          <small>Shared edition</small>
        </article>
      </section>

      <section className="mint-section" id="mint">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div>
            <span className="kicker">Collection portal</span>
            <h2>Mint your CashX NFT</h2>
          </div>
          <p>Choose your quantity, connect on PulseChain, and confirm in your wallet.</p>
        </div>

        <div className="mint-tabs" role="tablist" aria-label="Collection information">
          {(["mint", "collection", "activity"] as Tab[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => setTab(item)}
            >
              {item === "mint" ? "Mint" : item === "collection" ? "Collection" : "Activity"}
            </button>
          ))}
        </div>

        {tab === "mint" && (
          <div className="mint-layout">
            <article className="nft-card">
              <div className="card-art art-crop">
                <img
                  className="art-source"
                  src="/cashx-art-source.png"
                  alt="CashX Ecosystem NFT"
                />
              </div>
              <div className="card-caption">
                <span>
                  <small>COLLECTION</small>
                  <strong>CashX Ecosystem</strong>
                </span>
                <span>
                  <small>NETWORK</small>
                  <strong>PulseChain</strong>
                </span>
              </div>
            </article>

            <div className="mint-console">
              <div className="progress-heading">
                <span>Mint progress</span>
                <strong>
                  {formatNumber(DISPLAY_MINTED)} / {formatNumber(COLLECTION_SIZE)}
                </strong>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={COLLECTION_SIZE}
                aria-valuenow={DISPLAY_MINTED}
              >
                <span style={{ width: `${(DISPLAY_MINTED / COLLECTION_SIZE) * 100}%` }} />
              </div>

              <div className="mint-box">
                <div className="steps">
                  <span className="current"><b>1</b> Choose quantity</span>
                  <i aria-hidden="true">→</i>
                  <span><b>2</b> Mint NFT</span>
                </div>

                <div className="price-line">
                  <span>Price per NFT</span>
                  <strong>{formatNumber(PRICE_PER_NFT)} PLS</strong>
                </div>

                <div className="quantity-row">
                  <span>Quantity</span>
                  <div className="stepper" aria-label="NFT quantity">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    >
                      −
                    </button>
                    <strong aria-live="polite">{quantity}</strong>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((value) => Math.min(100, value + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="total-line">
                  <span>Total</span>
                  <strong>{formatNumber(total)} PLS</strong>
                </div>

                <button className="mint-button" type="button" onClick={requestWallet}>
                  Connect wallet to mint
                </button>

                {showSetupNote && (
                  <div className="setup-note" role="status">
                    Wallet minting will switch on after the new contract and treasury
                    addresses are added. This preview cannot request funds.
                  </div>
                )}

                <p className="network-note">
                  <span>◇</span> PulseChain network · Gas fee not included
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "collection" && (
          <div className="info-panel">
            <span className="info-index">10K</span>
            <div>
              <span className="kicker">One image, one community</span>
              <h3>A shared ecosystem edition</h3>
              <p>
                Every token uses the same CashX Ecosystem artwork. Token ownership
                remains individually verifiable on PulseChain while the collection
                keeps one clear visual identity.
              </p>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="activity-empty">
            <span className="activity-pulse" />
            <div>
              <h3>Live mints will appear here</h3>
              <p>On-chain activity begins after the mint contract is deployed.</p>
            </div>
          </div>
        )}
      </section>

      <section className="utility-section" id="utility">
        <div className="section-heading compact">
          <span className="section-number">02</span>
          <div>
            <span className="kicker">Planned utility</span>
            <h2>Made for the whole ecosystem</h2>
          </div>
        </div>
        <div className="utility-grid">
          <article>
            <span className="utility-icon">✦</span>
            <small>01</small>
            <h3>Stake &amp; earn</h3>
            <p>Designed to connect with CashX, DistroX, DivX, and GSX rewards.</p>
          </article>
          <article>
            <span className="utility-icon">×</span>
            <small>02</small>
            <h3>CashX burn loop</h3>
            <p>Planned ecosystem mechanics can help reduce CashX supply over time.</p>
          </article>
          <article>
            <span className="utility-icon">◇</span>
            <small>03</small>
            <h3>Community access</h3>
            <p>A simple, recognizable on-chain pass for future CashX experiences.</p>
          </article>
        </div>
      </section>

      <section className="details-section" id="details">
        <div>
          <span className="kicker">Clear by design</span>
          <h2>Collection details</h2>
        </div>
        <dl>
          <div><dt>Blockchain</dt><dd>PulseChain</dd></div>
          <div><dt>Standard</dt><dd>ERC-721 draft</dd></div>
          <div><dt>Supply</dt><dd>10,000</dd></div>
          <div><dt>Price</dt><dd>1,000,000 PLS</dd></div>
          <div><dt>Mint deadline</dt><dd>None</dd></div>
          <div><dt>Contract</dt><dd>Awaiting deployment</dd></div>
        </dl>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark" aria-hidden="true">X</span>
          <span><strong>CashX</strong><small>ECOSYSTEM</small></span>
        </a>
        <p>CashX Ecosystem NFT · Built for PulseChain</p>
        <span className="footer-status"><i /> Launch preview</span>
      </footer>
    </main>
  );
}
